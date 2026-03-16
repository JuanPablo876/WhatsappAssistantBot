import OpenAI from 'openai';
import { logger } from './logger';
import type {
  AICompletionOptions,
  AICompletionResult,
  AIMessage,
  AIToolCall,
} from './types';

/**
 * AI Provider configuration.
 * Supports: 'openai' (default) or 'ollama' (local development)
 * 
 * For Ollama:
 * - Install: https://ollama.ai
 * - Pull a model: `ollama pull llama3.2` or `ollama pull mistral`
 * - Set AI_PROVIDER=ollama and AI_MODEL=llama3.2 in .env
 */
type AIProvider = 'openai' | 'ollama';

let clientInstance: OpenAI | null = null;
let currentProvider: AIProvider | null = null;

function getProvider(): AIProvider {
  return (process.env.AI_PROVIDER as AIProvider) || 'openai';
}

function getClient(): OpenAI {
  const provider = getProvider();
  
  // Reinitialize if provider changed
  if (clientInstance && currentProvider !== provider) {
    clientInstance = null;
  }
  
  if (!clientInstance) {
    currentProvider = provider;
    
    if (provider === 'ollama') {
      // Ollama provides OpenAI-compatible API at localhost:11434
      const baseURL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434/v1';
      clientInstance = new OpenAI({
        apiKey: 'ollama', // Ollama doesn't require an API key but SDK needs something
        baseURL,
      });
      logger.info({ baseURL }, 'Using Ollama for AI completions');
    } else {
      // Default: OpenAI
      if (!process.env.OPENAI_API_KEY) {
        logger.warn('OPENAI_API_KEY not set — AI completions will fail');
      }
      clientInstance = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY!,
      });
    }
  }
  return clientInstance;
}

function getDefaultModel(): string {
  const provider = getProvider();
  if (provider === 'ollama') {
    // Common Ollama models: llama3.2, mistral, codellama, phi3, qwen2.5
    return process.env.AI_MODEL || 'llama3.2';
  }
  // OpenAI models: gpt-5-mini (fast/cheap), gpt-5.4 (flagship), gpt-4.1
  return process.env.AI_MODEL || 'gpt-5-mini';
}

export async function complete(options: AICompletionOptions): Promise<AICompletionResult> {
  const client = getClient();
  const model = getDefaultModel();
  const provider = getProvider();

  try {
    // Prepare messages, handling Qwen3 thinking mode
    let messages = options.messages.map((m) => toOpenAIMessage(m));
    
    // For Qwen3 models, disable thinking mode by appending /no_think to the last user message
    // This prevents Qwen3 from using the reasoning field instead of content
    if (provider === 'ollama' && model.toLowerCase().includes('qwen')) {
      const lastUserIdx = messages.findLastIndex((m: any) => m.role === 'user');
      if (lastUserIdx !== -1 && messages[lastUserIdx].content) {
        messages[lastUserIdx] = {
          ...messages[lastUserIdx],
          content: messages[lastUserIdx].content + ' /no_think'
        };
      }
    }
    
    const response = await client.chat.completions.create({
      model,
      messages,
      tools: options.tools?.length ? (options.tools as any) : undefined,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 1024,
      // Disable thinking mode for Ollama reasoning models (qwen3, etc.)
      ...(provider === 'ollama' ? { think: false } as any : {}),
    });

    const choice = response.choices[0];
    const assistantMsg = choice.message;
    
    // Debug: Log the raw response structure for Ollama
    if (provider === 'ollama') {
      console.log('[AI Provider] Raw Ollama response message:', JSON.stringify(assistantMsg, null, 2));
    }

    // Extract content - handle Qwen3 thinking mode fallback
    // If content is empty but reasoning exists, the model is in thinking mode
    let content = assistantMsg.content ?? '';
    const reasoning = (assistantMsg as any).reasoning as string | undefined;
    
    if (!content && reasoning) {
      logger.warn('Ollama returned empty content with reasoning field - extracting from reasoning');
      
      // Strategy: Find the actual user-facing response, not the thinking process.
      // Models typically structure reasoning as: analysis -> draft response -> final response
      // Look for quoted response drafts or the final response section.
      
      // 1. Look for explicit response markers
      const responseMarkers = [
        /(?:My response|Final response|Here'?s my response|Respuesta|Mi respuesta)[:\s]*["']?([^"'\n][\s\S]*?)(?:\n\n(?:\d+\.|\*|Thinking|Analysis|Note:|Wait|Let me)|$)/i,
        /(?:I (?:will|would|should) (?:say|respond|reply))[:\s]*["']?([^"'\n][\s\S]*?)(?:\n\n(?:\d+\.|\*|Thinking|Analysis|Note:|Wait|Let me)|$)/i,
      ];
      
      for (const pattern of responseMarkers) {
        const match = reasoning.match(pattern);
        if (match && match[1] && match[1].trim().length > 20) {
          content = match[1].replace(/["']$/, '').trim();
          // Strip markdown artifacts
          content = content.replace(/\*\*/g, '').replace(/^[\s*-]+/, '').trim();
          logger.info({ extractedLength: content.length }, 'Extracted response from reasoning markers');
          break;
        }
      }
      
      // 2. Look for quoted text blocks that look like actual responses (not analysis)
      if (!content) {
        const quotedBlocks = reasoning.match(/["']([^"']{30,}?)["']/g);
        if (quotedBlocks) {
          // Find the longest quoted block that looks like a response (not a user quote)
          const candidates = quotedBlocks
            .map(q => q.slice(1, -1))
            .filter(q => !q.includes('Analyze') && !q.includes('Thinking') && q.length > 30);
          if (candidates.length > 0) {
            content = candidates[candidates.length - 1].trim();
            logger.info({ extractedLength: content.length }, 'Extracted quoted response from reasoning');
          }
        }
      }
      
      // 3. Last resort: take everything AFTER the last "---" or section break
      if (!content && reasoning.length > 200) {
        // Look for a clean response section at the end (no bullet points, no numbering)
        const sections = reasoning.split(/\n---+\n|\n={3,}\n/);
        if (sections.length > 1) {
          const lastSection = sections[sections.length - 1].trim();
          if (lastSection.length > 20 && !lastSection.startsWith('*') && !lastSection.match(/^\d+\./)) {
            content = lastSection;
            logger.info({ extractedLength: content.length }, 'Extracted last section from reasoning');
          }
        }
      }
      
      // 4. Final fallback: return a generic response rather than leaking reasoning
      if (!content) {
        logger.error({ reasoningLength: reasoning.length }, 'Could not extract clean response from reasoning');
        content = '';
      }
    }

    const toolCalls: AIToolCall[] | undefined = assistantMsg.tool_calls?.map((tc) => ({
      id: tc.id,
      type: 'function' as const,
      function: {
        name: tc.function.name,
        arguments: tc.function.arguments,
      },
    }));

    const message: AIMessage = {
      role: 'assistant',
      content,
      tool_calls: toolCalls,
    };

    const finishReason =
      choice.finish_reason === 'tool_calls'
        ? 'tool_calls'
        : choice.finish_reason === 'length'
        ? 'length'
        : 'stop';

    return {
      message,
      usage: response.usage
        ? {
            promptTokens: response.usage.prompt_tokens,
            completionTokens: response.usage.completion_tokens,
            totalTokens: response.usage.total_tokens,
          }
        : undefined,
      finishReason,
    };
  } catch (error) {
    logger.error({ error, provider, model }, 'AI completion failed');
    throw error;
  }
}

function toOpenAIMessage(msg: AIMessage): any {
  const base: any = { role: msg.role, content: msg.content };

  if (msg.role === 'assistant' && msg.tool_calls?.length) {
    base.tool_calls = msg.tool_calls.map((tc) => ({
      id: tc.id,
      type: 'function',
      function: {
        name: tc.function.name,
        arguments: tc.function.arguments,
      },
    }));
  }

  if (msg.role === 'tool') {
    base.tool_call_id = msg.tool_call_id;
    base.name = msg.name;
  }

  return base;
}
