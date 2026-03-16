import type { AIMessage, AIToolDefinition, ToolResult } from '../types';

// ─── Admin Agent Context ────────────────────────────────
export interface AdminAgentContext {
  userId: string;
  userName: string;
  sessionId: string;
}

export type AdminToolHandler = (
  args: Record<string, unknown>,
  context: AdminAgentContext
) => Promise<ToolResult>;

// ─── Admin Agent Session ────────────────────────────────
export interface AdminSessionMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: AIMessage['tool_calls'];
  tool_call_id?: string;
  name?: string;
  timestamp: string;
}

// ─── Admin Agent Request/Response ───────────────────────
export interface AdminAgentRequest {
  message: string;
  sessionId?: string;
}

export interface AdminAgentResponse {
  response: string;
  sessionId: string;
  toolCalls?: Array<{
    name: string;
    args: Record<string, unknown>;
    result: ToolResult;
  }>;
}

// ─── Skill Types ────────────────────────────────────────
export interface SkillFilters {
  category?: string;
  reviewStatus?: string;
  isEnabled?: boolean;
  search?: string;
}

// ─── Admin Tool Allowlist ───────────────────────────────
export const ADMIN_TOOL_ALLOWLIST = [
  'brave_web_search',
  'fetch_url',
  'search_skills',
  'read_skill',
  'recommend_skill',
  'propose_skill',
  'update_skill',
  'archive_skill',
  'list_whatsapp_contacts',
  'send_whatsapp_message',
  'get_conversation_history',
  'make_call',
  'search_openclaw_skills',
  'get_openclaw_skill_details',
  'import_openclaw_skill',
] as const;

export type AdminToolName = typeof ADMIN_TOOL_ALLOWLIST[number];
