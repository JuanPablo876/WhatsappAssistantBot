/**
 * Dynamic Tool Registry
 * 
 * Provides runtime tool registration, lookup, versioning, and analytics.
 * Bridges static tools with database-backed skills.
 */

import { ChatCompletionTool } from 'openai/resources/chat/completions';
import { prisma } from '../db';
import { logger } from './logger';

// ============================================================================
// Types
// ============================================================================

export interface ToolMetadata {
  name: string;
  version: string;
  category: 'scheduling' | 'concierge' | 'communication' | 'search' | 'admin' | 'skill';
  description: string;
  whenToUse: string;
  examples?: string[];
  requiredContext?: string[];  // e.g., ['tenantId', 'contactPhone']
  rateLimit?: { maxCalls: number; windowMs: number };
  deprecated?: { reason: string; replacement?: string };
}

export interface ToolDefinition {
  spec: ChatCompletionTool;
  metadata: ToolMetadata;
  handler: ToolHandler;
}

export interface ToolContext {
  tenantId: string;
  userId?: string;
  contactPhone?: string;
  sessionId?: string;
  [key: string]: unknown;
}

export type ToolHandler = (
  args: Record<string, unknown>,
  context: ToolContext
) => Promise<ToolResult>;

export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
  metadata?: {
    durationMs?: number;
    cached?: boolean;
    version?: string;
  };
}

export interface ToolCallRecord {
  toolName: string;
  args: Record<string, unknown>;
  result: ToolResult;
  durationMs: number;
  timestamp: Date;
  context: Partial<ToolContext>;
}

// ============================================================================
// Tool Registry Class
// ============================================================================

class ToolRegistry {
  private tools: Map<string, ToolDefinition> = new Map();
  private callHistory: ToolCallRecord[] = [];
  private maxHistorySize = 100;

  /**
   * Register a tool with metadata and handler
   */
  register(definition: ToolDefinition): void {
    const { name } = definition.metadata;
    
    if (definition.metadata.deprecated) {
      logger.warn({ tool: name, ...definition.metadata.deprecated }, 'Registering deprecated tool');
    }

    this.tools.set(name, definition);
    logger.debug({ tool: name, category: definition.metadata.category }, 'Tool registered');
  }

  /**
   * Register multiple tools at once
   */
  registerAll(definitions: ToolDefinition[]): void {
    for (const def of definitions) {
      this.register(def);
    }
  }

  /**
   * Get a tool by name
   */
  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  /**
   * Check if a tool exists
   */
  has(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * Get all tools matching a filter
   */
  filter(predicate: (def: ToolDefinition) => boolean): ToolDefinition[] {
    return Array.from(this.tools.values()).filter(predicate);
  }

  /**
   * Get tools by category
   */
  getByCategory(category: ToolMetadata['category']): ToolDefinition[] {
    return this.filter(def => def.metadata.category === category);
  }

  /**
   * Get all non-deprecated tools as OpenAI specs
   */
  getActiveSpecs(): ChatCompletionTool[] {
    return this.filter(def => !def.metadata.deprecated).map(def => def.spec);
  }

  /**
   * Get tools filtered by required context availability
   */
  getAvailableFor(context: ToolContext): ChatCompletionTool[] {
    return this.filter(def => {
      if (def.metadata.deprecated) return false;
      if (!def.metadata.requiredContext) return true;
      return def.metadata.requiredContext.every(key => key in context && context[key]);
    }).map(def => def.spec);
  }

  /**
   * Execute a tool with tracking
   */
  async execute(
    name: string,
    args: Record<string, unknown>,
    context: ToolContext
  ): Promise<ToolResult> {
    const definition = this.tools.get(name);
    
    if (!definition) {
      return {
        success: false,
        error: `Unknown tool: ${name}. Available tools: ${this.listToolNames().join(', ')}`
      };
    }

    // Check for deprecation
    if (definition.metadata.deprecated) {
      logger.warn({
        tool: name,
        reason: definition.metadata.deprecated.reason,
        replacement: definition.metadata.deprecated.replacement
      }, 'Deprecated tool called');
    }

    // Check required context
    if (definition.metadata.requiredContext) {
      const missing = definition.metadata.requiredContext.filter(
        key => !(key in context) || !context[key]
      );
      if (missing.length > 0) {
        return {
          success: false,
          error: `Missing required context: ${missing.join(', ')}`
        };
      }
    }

    const startTime = Date.now();
    let result: ToolResult;

    try {
      result = await definition.handler(args, context);
      result.metadata = {
        ...result.metadata,
        durationMs: Date.now() - startTime,
        version: definition.metadata.version
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error({ tool: name, error: errorMessage, args }, 'Tool execution failed');
      result = {
        success: false,
        error: `Tool error: ${errorMessage}`,
        metadata: { durationMs: Date.now() - startTime }
      };
    }

    // Record the call
    this.recordCall({
      toolName: name,
      args,
      result,
      durationMs: Date.now() - startTime,
      timestamp: new Date(),
      context: { tenantId: context.tenantId, userId: context.userId }
    });

    return result;
  }

  /**
   * Record a tool call for analytics
   */
  private recordCall(record: ToolCallRecord): void {
    this.callHistory.push(record);
    if (this.callHistory.length > this.maxHistorySize) {
      this.callHistory.shift();
    }
  }

  /**
   * Get analytics for tools
   */
  getAnalytics(): {
    totalCalls: number;
    byTool: Record<string, { calls: number; avgDurationMs: number; errorRate: number }>;
  } {
    const byTool: Record<string, { calls: number; totalDuration: number; errors: number }> = {};

    for (const record of this.callHistory) {
      if (!byTool[record.toolName]) {
        byTool[record.toolName] = { calls: 0, totalDuration: 0, errors: 0 };
      }
      byTool[record.toolName].calls++;
      byTool[record.toolName].totalDuration += record.durationMs;
      if (!record.result.success) {
        byTool[record.toolName].errors++;
      }
    }

    const result: Record<string, { calls: number; avgDurationMs: number; errorRate: number }> = {};
    for (const [name, data] of Object.entries(byTool)) {
      result[name] = {
        calls: data.calls,
        avgDurationMs: Math.round(data.totalDuration / data.calls),
        errorRate: data.errors / data.calls
      };
    }

    return { totalCalls: this.callHistory.length, byTool: result };
  }

  /**
   * List all tool names
   */
  listToolNames(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * Search tools by keyword
   */
  search(query: string): ToolDefinition[] {
    const q = query.toLowerCase();
    return this.filter(def => {
      const searchable = [
        def.metadata.name,
        def.metadata.description,
        def.metadata.whenToUse,
        def.metadata.category,
        ...(def.metadata.examples || [])
      ].join(' ').toLowerCase();
      return searchable.includes(q);
    });
  }

  /**
   * Get a summary of all tools for the LLM
   */
  getSummaryForLLM(): string {
    const categories = new Map<string, ToolDefinition[]>();
    
    for (const def of this.tools.values()) {
      if (def.metadata.deprecated) continue;
      const cat = def.metadata.category;
      if (!categories.has(cat)) categories.set(cat, []);
      categories.get(cat)!.push(def);
    }

    let summary = '## Available Tools\n\n';
    for (const [category, tools] of categories) {
      summary += `### ${category.charAt(0).toUpperCase() + category.slice(1)}\n`;
      for (const tool of tools) {
        summary += `- **${tool.metadata.name}**: ${tool.metadata.whenToUse}\n`;
      }
      summary += '\n';
    }

    return summary;
  }

  /**
   * Clear all registered tools (for testing)
   */
  clear(): void {
    this.tools.clear();
    this.callHistory = [];
  }
}

// ============================================================================
// Skill-to-Tool Bridge
// ============================================================================

/**
 * Load skills from database and create tool definitions
 */
export async function loadSkillsAsTools(_tenantId?: string): Promise<ToolDefinition[]> {
  try {
    const skills = await prisma.agentSkill.findMany({
      where: {
        reviewStatus: 'REVIEWED',
        deliveryMode: 'KNOWLEDGE',
        isEnabled: true
      },
      orderBy: { priority: 'desc' },
      take: 20  // Limit to avoid context overflow
    });

    return skills.map(skill => ({
      spec: {
        type: 'function' as const,
        function: {
          name: `skill_${skill.id.slice(0, 8)}`,
          description: `[Skill: ${skill.title}] ${skill.summary}`,
          parameters: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'What specific information do you need from this skill?'
              }
            },
            required: ['query']
          }
        }
      },
      metadata: {
        name: `skill_${skill.id.slice(0, 8)}`,
        version: '1.0.0',
        category: 'skill' as const,
        description: skill.summary || skill.title,
        whenToUse: skill.workflowGuidance || `When dealing with: ${skill.category}`
      },
      handler: async (args: Record<string, unknown>) => {
        // Update usage count
        await prisma.agentSkill.update({
          where: { id: skill.id },
          data: { usageCount: { increment: 1 }, lastUsedAt: new Date() }
        });

        return {
          success: true,
          data: {
            title: skill.title,
            category: skill.category,
            guidance: skill.workflowGuidance,
            implementation: skill.implementationNotes,
            codeSnippets: skill.codeSnippets
          }
        };
      }
    }));
  } catch (error) {
    logger.error({ error }, 'Failed to load skills as tools');
    return [];
  }
}

/**
 * Search skills and return relevant ones
 */
export async function searchSkillsForContext(
  query: string,
  _tenantId?: string  // Skills are global, tenantId not used
): Promise<{ id: string; title: string; summary: string; relevance: string }[]> {
  try {
    const skills = await prisma.agentSkill.findMany({
      where: {
        reviewStatus: 'REVIEWED',
        OR: [
          { title: { contains: query } },
          { summary: { contains: query } },
          { category: { contains: query } },
          { workflowGuidance: { contains: query } }
        ]
      },
      select: {
        id: true,
        title: true,
        summary: true,
        category: true,
        workflowGuidance: true
      },
      take: 5
    });

    return skills.map(s => ({
      id: s.id,
      title: s.title,
      summary: s.summary || '',
      relevance: s.workflowGuidance || `Category: ${s.category}`
    }));
  } catch (error) {
    logger.error({ error }, 'Failed to search skills');
    return [];
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const toolRegistry = new ToolRegistry();

// ============================================================================
// Helper to convert existing static tools to registry format
// ============================================================================

export function createToolDefinition(
  spec: ChatCompletionTool,
  metadata: Omit<ToolMetadata, 'name' | 'description'>,
  handler: ToolHandler
): ToolDefinition {
  return {
    spec,
    metadata: {
      ...metadata,
      name: spec.function.name,
      description: spec.function.description || ''
    },
    handler
  };
}
