// ─── AI Provider Types ──────────────────────────────────
export interface AIMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: AIToolCall[];
  tool_call_id?: string;
  name?: string;
}

export interface AIToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

export interface AIToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface AICompletionOptions {
  messages: AIMessage[];
  tools?: AIToolDefinition[];
  temperature?: number;
  maxTokens?: number;
}

export interface AICompletionResult {
  message: AIMessage;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  finishReason: 'stop' | 'tool_calls' | 'length' | 'error';
}

// ─── WhatsApp Channel Types ─────────────────────────────
export interface IncomingMessage {
  id: string;
  from: string;
  text: string;
  timestamp: Date;
  type: 'text' | 'image' | 'audio' | 'document' | 'location';
  tenantId: string;
  raw?: unknown;
}

export interface OutgoingMessage {
  to: string;
  text: string;
  tenantId: string;
}

// ─── Calendar Types ─────────────────────────────────────
export interface TimeSlot {
  start: Date;
  end: Date;
}

export interface CalendarEvent {
  id?: string;
  title: string;
  description?: string;
  start: Date;
  end: Date;
  attendeeEmail?: string;
  attendeeName?: string;
}

// ─── Multi-Tenant Agent Context ─────────────────────────
export interface AgentContext {
  tenantId: string;
  contactPhone: string;
  contactName?: string;
  conversationId: string;
  businessSettings: {
    businessName: string;
    businessType: string;
    description: string;
    services: string;
    systemPrompt: string;
    tone: string;
    language: string;
    timezone: string;
    slotDurationMin: number;
    workStartHour: number;
    workEndHour: number;
    workDays: number[];
    maxAdvanceDays: number;
    welcomeMessage: string;
    serviceTypes: Array<{
      id: string;
      name: string;
      description: string | null;
      duration: number;
      price: number | null;
    }>;
  };
}

export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

export type ToolHandler = (
  args: Record<string, unknown>,
  context: AgentContext
) => Promise<ToolResult>;
