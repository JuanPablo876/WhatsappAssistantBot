import { prisma } from '@/lib/db';
import { logger } from './logger';
import { dayjs } from './date-helpers';
import * as aiProvider from './ai-provider';
import { ConversationService } from './conversation-service';
import { toolDefinitions, toolHandlers } from './tools';
import { buildSystemPrompt, buildMinimalPrompt } from './prompts/system-prompt-builder';
import { scratchpad } from './reasoning-scratchpad';
import type { AIMessage, AgentContext, IncomingMessage } from './types';

const MAX_TOOL_ROUNDS = 5;

/**
 * Multi-tenant AI Agent Service.
 *
 * Each incoming message includes a tenantId.
 * The agent loads that tenant's business profile, system prompt,
 * and calendar tokens to handle the conversation.
 */
export class AgentService {
  private conversationService = new ConversationService();

  /**
   * Main entry point: processes an incoming WhatsApp message for a tenant.
   * Returns the AI response text (caller is responsible for sending it back).
   */
  async handleMessage(incoming: IncomingMessage): Promise<string> {
    return this.processMessage({
      tenantId: incoming.tenantId,
      phone: incoming.from,
      text: incoming.text,
      channel: 'whatsapp',
    });
  }

  /**
   * Handle a phone call speech input. Same agent, same tools — phone is just a channel.
   * Returns the AI response text (caller renders it via TTS/TwiML).
   */
  async handlePhoneMessage(params: {
    tenantId: string;
    callerPhone: string;
    text: string;
  }): Promise<string> {
    return this.processMessage({
      tenantId: params.tenantId,
      phone: params.callerPhone,
      text: params.text,
      channel: 'phone',
    });
  }

  /**
   * Unified message handler — processes messages from any channel.
   */
  private async processMessage(params: {
    tenantId: string;
    phone: string;
    text: string;
    channel: 'whatsapp' | 'phone';
  }): Promise<string> {
    const { tenantId, phone, text, channel } = params;
    logger.info({ tenantId, phone, text, channel }, 'Processing message');

    try {
      // Load tenant's business profile
      const profile = await this.loadBusinessProfile(tenantId);
      if (!profile) {
        return "Sorry, this business hasn't finished setting up yet. Please try again later.";
      }

      // Load service types for this tenant
      const serviceTypes = await prisma.serviceType.findMany({
        where: { tenantId, isActive: true },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        select: { id: true, name: true, description: true, duration: true, price: true },
      });

      // Get or create conversation
      const { conversationId, contactName } = await this.conversationService.getOrCreateConversation(
        tenantId,
        phone
      );

      // Build agent context
      const workDays = this.parseWorkDays(profile.workingDays);
      const [workStartHour] = (profile.openTime || '09:00').split(':').map(Number);
      const [workEndHour] = (profile.closeTime || '17:00').split(':').map(Number);

      const context: AgentContext = {
        tenantId,
        contactPhone: phone,
        contactName,
        conversationId,
        businessSettings: {
          businessName: profile.businessName,
          businessType: profile.businessType,
          description: profile.description || '',
          services: profile.services || '',
          systemPrompt: profile.systemPrompt,
          tone: profile.tone || 'professional',
          language: profile.language || 'en',
          timezone: profile.timezone || 'America/New_York',
          slotDurationMin: profile.slotDuration || 30,
          workStartHour,
          workEndHour,
          workDays,
          maxAdvanceDays: 30,
          welcomeMessage: profile.welcomeMessage || '',
          serviceTypes,
        },
      };

      // Save user message
      await this.conversationService.saveMessage(conversationId, 'user', text);

      // Get conversation history
      const history = await this.conversationService.getHistory(conversationId);

      // Build system prompt with business context (channel-aware)
      const systemPrompt = this.buildSystemPrompt(context, channel);
      const messages: AIMessage[] = [
        { role: 'system', content: systemPrompt },
        ...history,
      ];

      // Run the agent loop (handles tool calls automatically)
      const response = await this.runAgentLoop(messages, context, conversationId);
      return response;
    } catch (error) {
      logger.error({ error, tenantId, phone, channel }, 'Error processing message');
      if (channel === 'phone') return '';
      return "I'm sorry, I encountered an error processing your request. Please try again in a moment.";
    }
  }

  /**
   * Multi-round agent loop with tool calling.
   */
  private async runAgentLoop(
    messages: AIMessage[],
    context: AgentContext,
    conversationId: string
  ): Promise<string> {
    let round = 0;
    const sessionId = conversationId;

    // Start or resume reasoning chain
    if (!scratchpad.getChain(sessionId)) {
      scratchpad.startChain(sessionId, 'Process user request');
    }

    while (round < MAX_TOOL_ROUNDS) {
      round++;

      const result = await aiProvider.complete({
        messages,
        tools: toolDefinitions,
        temperature: 0.7,
        maxTokens: 1024,
      });

      const assistantMessage = result.message;

      // Save assistant message
      await this.conversationService.saveMessage(
        conversationId,
        'assistant',
        assistantMessage.content || '',
        {
          toolCalls: assistantMessage.tool_calls
            ? JSON.stringify(assistantMessage.tool_calls)
            : undefined,
          tokenCount: result.usage?.totalTokens,
        }
      );

      messages.push(assistantMessage);

      // If no tool calls, return the final text response
      if (result.finishReason !== 'tool_calls' || !assistantMessage.tool_calls?.length) {
        // Record conclusion in scratchpad
        if (assistantMessage.content) {
          scratchpad.conclude(sessionId, assistantMessage.content.slice(0, 200));
        }
        return assistantMessage.content;
      }

      // Execute each tool call
      for (const toolCall of assistantMessage.tool_calls) {
        const handler = toolHandlers[toolCall.function.name];

        if (!handler) {
          logger.warn({ tool: toolCall.function.name }, 'Unknown tool called');
          const errorMsg: AIMessage = {
            role: 'tool',
            content: JSON.stringify({
              success: false,
              error: `Unknown tool: ${toolCall.function.name}`,
            }),
            tool_call_id: toolCall.id,
            name: toolCall.function.name,
          };
          messages.push(errorMsg);
          await this.conversationService.saveMessage(conversationId, 'tool', errorMsg.content, {
            toolCallId: toolCall.id,
          });
          continue;
        }

        let args: Record<string, unknown>;
        try {
          args = JSON.parse(toolCall.function.arguments);
        } catch {
          args = {};
        }

        // Record action in scratchpad (skip for 'think' tool to avoid recursion)
        if (toolCall.function.name !== 'think') {
          scratchpad.act(sessionId, toolCall.function.name, `Called with: ${JSON.stringify(args).slice(0, 100)}`);
        }

        logger.info({ tool: toolCall.function.name, args }, 'Executing tool');
        const toolResult = await handler(args, context);

        // Record result in scratchpad (skip for 'think' tool)
        if (toolCall.function.name !== 'think') {
          const resultSummary = toolResult.success
            ? `Success: ${JSON.stringify(toolResult.data || {}).slice(0, 100)}`
            : `Error: ${toolResult.error?.slice(0, 100)}`;
          scratchpad.recordResult(sessionId, toolCall.function.name, resultSummary);
        }

        const toolMessage: AIMessage = {
          role: 'tool',
          content: JSON.stringify(toolResult),
          tool_call_id: toolCall.id,
          name: toolCall.function.name,
        };
        messages.push(toolMessage);
        await this.conversationService.saveMessage(conversationId, 'tool', toolMessage.content, {
          toolCallId: toolCall.id,
        });
      }
    }

    logger.warn({ conversationId }, 'Agent loop hit max rounds');
    return "I'm having trouble processing this. Could you try rephrasing your request?";
  }

  /**
   * Build the system prompt incorporating the tenant's business profile.
   * Channel-aware: adjusts output rules for phone vs WhatsApp.
   */
  private buildSystemPrompt(context: AgentContext, channel: 'whatsapp' | 'phone' = 'whatsapp'): string {
    const bs = context.businessSettings;
    const now = dayjs().tz(bs.timezone);
    const workDayNames = bs.workDays
      .map((d) => dayjs().day(d).format('dddd'))
      .join(', ');

    // If the tenant has a custom AI-generated system prompt, use it as the base
    if (bs.systemPrompt) {
      let serviceInfo = '';
      if (bs.serviceTypes.length > 0) {
        serviceInfo = `\n\nAVAILABLE SERVICES/APPOINTMENT TYPES:\n${bs.serviceTypes.map(st =>
          `- ${st.name} (${st.duration} min${st.price ? `, $${st.price}` : ''})${st.description ? ` — ${st.description}` : ''}`
        ).join('\n')}\n\nWhen booking, ask which service the client wants. Use the service's specific duration for the appointment. If they mention the service name, use the matching service_type parameter in create_appointment.`;
      }

      return `${bs.systemPrompt}

CURRENT DATE AND TIME: ${now.format('dddd, MMMM D, YYYY [at] h:mm A')} (${bs.timezone})

BUSINESS HOURS:
- Working days: ${workDayNames}
- Hours: ${bs.workStartHour}:00 - ${bs.workEndHour}:00
- Default appointment duration: ${bs.slotDurationMin} minutes${serviceInfo}

CLIENT INFO:
- Phone: ${context.contactPhone}
${context.contactName ? `- Name: ${context.contactName}` : '- Name: Unknown (ask for their name when appropriate)'}

YOUR CAPABILITIES (use the provided tools):
1. Check available time slots for a specific date
2. Book new appointments${bs.serviceTypes.length > 0 ? ' (with service type selection)' : ''}
3. Cancel existing appointments
4. Reschedule appointments
5. List the client's upcoming appointments${bs.serviceTypes.length > 0 ? '\n6. List available services/appointment types' : ''}

CONCIERGE SERVICES (for external bookings):
- Search for nearby businesses (spas, restaurants, etc.) using search_places
- Get business details (hours, phone, reviews) using get_place_details
- Call external businesses to make reservations on the client's behalf using book_external
IMPORTANT: When booking external services, ALWAYS ask for the client's location/city first to avoid booking in the wrong area.

WEB SEARCH:
- Use web_search to look up facts, information, or anything you don't know
- Good for: current events, business info, reviews, general knowledge

REASONING & DISCOVERY:
- Use discover_tools to search for capabilities when unsure how to handle a request
- Use think to record your reasoning for complex multi-step tasks
- Use lookup_skill to get detailed guidance from knowledge skills

IMPORTANT RULES:
${channel === 'phone' ? `- CHANNEL: Phone call. Your response will be SPOKEN ALOUD via text-to-speech.
- Keep responses VERY brief — 1-2 sentences maximum. The caller is listening, not reading.
- Use natural spoken language. Do NOT use markdown, bullet points, links, emojis, or any formatting.
- Do NOT read out long lists — summarize instead (e.g., "I have 5 slots available in the morning and 3 in the afternoon. What time works for you?")` : `- Keep responses SHORT and CONCISE — aim for 2-3 sentences maximum (WhatsApp style)
- Be conversational but brief — no unnecessary greetings or filler text`}
- Always confirm details before booking
- Always check availability before booking — the system automatically handles blocked time-off periods
- If a date is unavailable due to time off, suggest the next available business day
- Respond in the same language the client uses
- Do NOT make up availability — always use check_availability tool`;
    }

    // Fallback generic prompt
    return `You are a friendly appointment scheduling assistant for ${bs.businessName}.
${bs.description ? `About: ${bs.description}` : ''}
${bs.services ? `Services offered: ${bs.services}` : ''}

CURRENT DATE AND TIME: ${now.format('dddd, MMMM D, YYYY [at] h:mm A')} (${bs.timezone})

BUSINESS HOURS:
- Working days: ${workDayNames}
- Hours: ${bs.workStartHour}:00 - ${bs.workEndHour}:00
- Appointment duration: ${bs.slotDurationMin} minutes

CLIENT INFO:
- Phone: ${context.contactPhone}
${context.contactName ? `- Name: ${context.contactName}` : '- Name: Unknown (ask for their name when appropriate)'}

YOUR CAPABILITIES:
1. Check available time slots
2. Book appointments
3. Cancel appointments
4. Reschedule appointments
5. List upcoming appointments

CONCIERGE SERVICES (for external bookings):
- Search for nearby businesses (spas, restaurants, etc.)
- Get business details (hours, phone, reviews)
- Call external businesses to make reservations
IMPORTANT: Always ask for the client's location/city before searching for external businesses.

WEB SEARCH:
- Use web_search to look up facts, information, or anything you don't know

REASONING & DISCOVERY:
- Use discover_tools to search for capabilities when unsure how to handle a request
- Use think to record your reasoning for complex multi-step tasks  
- Use lookup_skill to get detailed guidance from knowledge skills

GUIDELINES:
${channel === 'phone' ? `- CHANNEL: Phone call. Your response will be SPOKEN ALOUD via text-to-speech.
- Keep responses VERY brief — 1-2 sentences maximum. The caller is listening, not reading.
- Use natural spoken language. No markdown, bullet points, links, emojis, or formatting.
- Summarize lists instead of reading items one by one.` : `- Keep responses SHORT and CONCISE — aim for 2-3 sentences maximum (WhatsApp style)
- Be conversational but brief — no unnecessary greetings or filler`}
- Always confirm before booking
- Use the check_availability tool before suggesting times
- Respond in the same language the client uses`;
  }

  /**
   * Parse working days string (e.g., "Mon,Tue,Wed,Thu,Fri") to day numbers.
   */
  private parseWorkDays(workingDays: string): number[] {
    const dayMap: Record<string, number> = {
      Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
    };
    return workingDays
      .split(',')
      .map((d) => dayMap[d.trim()])
      .filter((d) => d !== undefined);
  }

  /**
   * Load tenant's business profile.
   */
  private async loadBusinessProfile(tenantId: string) {
    return prisma.businessProfile.findUnique({
      where: { tenantId },
    });
  }
}
