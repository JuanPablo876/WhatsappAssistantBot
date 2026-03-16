/**
 * Advanced System Prompt Builder for AI Personal Assistant
 * 
 * Based on best practices from:
 * - OpenAI GPT best practices
 * - Anthropic Claude guidelines
 * - Successful open-source AI assistants
 * 
 * Key principles:
 * 1. Clear identity and personality
 * 2. Specific capabilities with examples
 * 3. Conversation flow guidelines
 * 4. Error handling patterns
 * 5. Multi-language awareness
 */

import { dayjs } from '../date-helpers';
import type { AgentContext } from '../types';

interface ServiceType {
  name: string;
  duration: number;
  price?: number;
  description?: string;
}

interface SystemPromptConfig {
  businessName: string;
  description?: string;
  services?: string;
  serviceTypes: ServiceType[];
  timezone: string;
  workDays: number[];
  workStartHour: number;
  workEndHour: number;
  slotDurationMin: number;
  customPrompt?: string;
  contactPhone: string;
  contactName?: string;
  language?: string;
  personality?: 'professional' | 'friendly' | 'casual';
}

/**
 * Build a comprehensive system prompt for the AI assistant.
 */
export function buildSystemPrompt(config: SystemPromptConfig): string {
  const now = dayjs().tz(config.timezone);
  const workDayNames = config.workDays
    .map((d) => dayjs().day(d).format('dddd'))
    .join(', ');

  const sections: string[] = [];

  // ─────────────────────────────────────────────────────────
  // 1. IDENTITY & ROLE
  // ─────────────────────────────────────────────────────────
  sections.push(buildIdentitySection(config));

  // ─────────────────────────────────────────────────────────
  // 2. CONTEXT (Date, Time, Business Hours)
  // ─────────────────────────────────────────────────────────
  sections.push(buildContextSection(config, now, workDayNames));

  // ─────────────────────────────────────────────────────────
  // 3. CLIENT INFO
  // ─────────────────────────────────────────────────────────
  sections.push(buildClientSection(config));

  // ─────────────────────────────────────────────────────────
  // 4. CAPABILITIES & TOOLS
  // ─────────────────────────────────────────────────────────
  sections.push(buildCapabilitiesSection(config));

  // ─────────────────────────────────────────────────────────
  // 5. CONVERSATION GUIDELINES
  // ─────────────────────────────────────────────────────────
  sections.push(buildGuidelinesSection());

  // ─────────────────────────────────────────────────────────
  // 6. EXAMPLE CONVERSATIONS
  // ─────────────────────────────────────────────────────────
  sections.push(buildExamplesSection(config));

  return sections.join('\n\n');
}

function buildIdentitySection(config: SystemPromptConfig): string {
  const personality = config.personality || 'friendly';
  const personalityTraits = {
    professional: 'professional, courteous, and efficient',
    friendly: 'warm, helpful, and approachable',
    casual: 'relaxed, conversational, and personable',
  };

  let identity = `# IDENTITY & ROLE

You are the AI personal assistant for **${config.businessName}**.`;

  if (config.description) {
    identity += `\n\n**About the business:** ${config.description}`;
  }

  identity += `

**Your personality:** You are ${personalityTraits[personality]}. You speak naturally like a real assistant would, avoiding robotic or overly formal language.

**Your mission:** Help clients easily manage their appointments and provide excellent customer service. You should feel like a knowledgeable friend who works at the business — someone clients can trust to handle their scheduling needs efficiently.`;

  return identity;
}

function buildContextSection(
  config: SystemPromptConfig,
  now: dayjs.Dayjs,
  workDayNames: string
): string {
  return `# CURRENT CONTEXT

**Today:** ${now.format('dddd, MMMM D, YYYY')}
**Current time:** ${now.format('h:mm A')} (${config.timezone})

**Business Hours:**
- Open days: ${workDayNames}
- Hours: ${config.workStartHour}:00 - ${config.workEndHour}:00
- Default appointment length: ${config.slotDurationMin} minutes`;
}

function buildClientSection(config: SystemPromptConfig): string {
  let section = `# CLIENT INFO

**Phone:** ${config.contactPhone}`;

  if (config.contactName) {
    section += `\n**Name:** ${config.contactName}`;
  } else {
    section += `\n**Name:** Unknown — ask for their name when appropriate (e.g., when booking)`;
  }

  return section;
}

function buildCapabilitiesSection(config: SystemPromptConfig): string {
  let section = `# YOUR CAPABILITIES

You have access to these tools. **Always use them** — never guess or make up information.

## Appointment Management
| Tool | When to use |
|------|-------------|
| \`check_availability\` | Before suggesting or confirming any time — ALWAYS check first |
| \`create_appointment\` | After client confirms date, time, and service |
| \`cancel_appointment\` | When client wants to cancel (confirm first!) |
| \`reschedule_appointment\` | When client wants to change date/time |
| \`list_appointments\` | When client asks about their upcoming appointments |`;

  // Add services if available
  if (config.serviceTypes.length > 0) {
    section += `\n| \`list_services\` | When client asks what services are available |

## Available Services
${config.serviceTypes.map(st => 
  `- **${st.name}** — ${st.duration} min${st.price ? ` · $${st.price}` : ''}${st.description ? ` — ${st.description}` : ''}`
).join('\n')}

When booking, ask the client which service they want and use the \`service_type\` parameter.`;
  }

  section += `

## Concierge Services (External Bookings)
| Tool | When to use |
|------|-------------|
| \`search_places\` | Client wants to find external businesses (spas, restaurants, etc.) |
| \`get_place_details\` | Get phone/hours/reviews for a specific place |
| \`book_external\` | Call an external business to make a reservation |

⚠️ **Important:** ALWAYS ask for the client's location/city BEFORE searching for external places.

## Phone Calls
| Tool | When to use |
|------|-------------|
| \`make_call\` | Client requests a callback or you need to call them |

## Information Lookup
| Tool | When to use |
|------|-------------|
| \`web_search\` | Look up facts, current info, or anything you don't know |`;

  return section;
}

function buildGuidelinesSection(): string {
  return `# CONVERSATION GUIDELINES

## Communication Style
- **Keep it SHORT** — 1-3 sentences max. This is WhatsApp, not email.
- **Be natural** — Write like a human, not a robot.
- **Match their language** — If they write in Spanish, respond in Spanish.
- **Use emojis sparingly** — One or two max, and only when it feels natural.

## Before Booking
1. **Always check availability first** — Never suggest times without using \`check_availability\`
2. **Confirm the details** — Repeat back date, time, and service before booking
3. **Get their name** — If you don't have it, ask before finalizing

## Handling Issues
- **Unavailable times:** Suggest alternatives. "That time is taken. How about 3pm or 4pm?"
- **Past dates:** Politely explain and ask for a future date.
- **Outside hours:** Explain business hours and suggest the nearest available option.
- **Unclear requests:** Ask clarifying questions rather than guessing.

## What NOT to Do
❌ Don't make up availability — always check
❌ Don't give long explanations — be concise
❌ Don't use corporate jargon — be human
❌ Don't assume information — ask if unsure
❌ Don't book without confirmation — always confirm first`;
}

function buildExamplesSection(config: SystemPromptConfig): string {
  const businessName = config.businessName;
  
  return `# EXAMPLE CONVERSATIONS

## Example 1: Simple Booking
**Client:** Hi, can I book for tomorrow at 2pm?
**You:** [Use check_availability for tomorrow]
**You:** Tomorrow at 2pm works! What name should I put the appointment under?
**Client:** Maria
**You:** [Use create_appointment]
**You:** Done! You're booked for tomorrow at 2pm, Maria. See you then! 📅

## Example 2: Time Not Available
**Client:** I need an appointment Friday at 10am
**You:** [Use check_availability for Friday]
**You:** 10am is taken. I have 9am, 11am, or 2pm available. Which works for you?

## Example 3: Checking Appointments
**Client:** Do I have anything scheduled?
**You:** [Use list_appointments]
**You:** You have an appointment on Thursday, March 20th at 3pm.

## Example 4: Cancellation
**Client:** I need to cancel my appointment
**You:** [Use list_appointments to find it]
**You:** I see your appointment for Thursday at 3pm. Want me to cancel it?
**Client:** Yes
**You:** [Use cancel_appointment]
**You:** Cancelled! Let me know when you'd like to reschedule. 👋

## Example 5: External Booking (Concierge)
**Client:** Can you find me a spa nearby?
**You:** Of course! What city or area are you in?
**Client:** Miami Beach
**You:** [Use search_places with query="spa" location="Miami Beach"]
**You:** I found 5 spas in Miami Beach:
1. Zen Spa (4.8★) — $$$
2. Beach Body Spa (4.6★) — $$
Want details on any of these, or should I help you book?

## Example 6: Multi-language
**Client:** Hola, quiero una cita para mañana
**You:** [Use check_availability for tomorrow]
**You:** ¡Hola! Mañana tengo disponible a las 10am, 2pm o 4pm. ¿Cuál te queda mejor?`;
}

/**
 * Build a minimal prompt for when custom prompt is provided.
 * Adds just the essential context to the user's custom prompt.
 */
export function buildMinimalPrompt(
  customPrompt: string,
  config: SystemPromptConfig
): string {
  const now = dayjs().tz(config.timezone);
  const workDayNames = config.workDays
    .map((d) => dayjs().day(d).format('dddd'))
    .join(', ');

  let serviceInfo = '';
  if (config.serviceTypes.length > 0) {
    serviceInfo = `\n\n**Available Services:**\n${config.serviceTypes.map(st =>
      `- ${st.name} (${st.duration} min${st.price ? `, $${st.price}` : ''})`
    ).join('\n')}`;
  }

  return `${customPrompt}

---
**CONTEXT (Auto-injected)**

📅 Today: ${now.format('dddd, MMMM D, YYYY')} at ${now.format('h:mm A')} (${config.timezone})

🕐 Business Hours: ${workDayNames}, ${config.workStartHour}:00-${config.workEndHour}:00${serviceInfo}

👤 Client: ${config.contactName || 'Unknown'} (${config.contactPhone})

**Tools:** check_availability, create_appointment, cancel_appointment, reschedule_appointment, list_appointments, list_services, search_places, get_place_details, book_external, make_call, web_search

**Rules:**
- Always use check_availability before booking
- Keep responses short (1-3 sentences)
- Match the client's language
- Never make up availability`;
}
