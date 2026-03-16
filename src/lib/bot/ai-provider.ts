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
      // Try to extract the actual generated content from the reasoning
      // Look for patterns like "Drafting content:" or "Final output:" or Spanish text blocks
      const draftPatterns = [
        /(?:Drafting[^:]*:|Final[^:]*:|Output[^:]*:)\s*([\s\S]{100,})/i,
        /(?:Eres el asistente|You are the|Soy el asistente)[\s\S]{50,}/i,
      ];
      
      for (const pattern of draftPatterns) {
        const match = reasoning.match(pattern);
        if (match) {
          content = match[1] || match[0];
          // Clean up common artifacts
          content = content.replace(/^[\s*-]+/, '').trim();
          logger.info({ extractedLength: content.length }, 'Extracted content from reasoning field');
          break;
        }
      }
      
      // If no pattern matched but reasoning has substantial content, use the last substantial paragraph
      if (!content && reasoning.length > 500) {
        const paragraphs = reasoning.split(/\n\n+/).filter(p => p.length > 100);
        if (paragraphs.length > 0) {
          content = paragraphs[paragraphs.length - 1].trim();
          logger.info({ extractedLength: content.length }, 'Extracted last paragraph from reasoning');
        }
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
