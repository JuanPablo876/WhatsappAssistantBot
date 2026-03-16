/**
 * Reasoning Scratchpad
 * 
 * Provides chain-of-thought tracking, intermediate step persistence,
 * and structured reasoning for the AI agent.
 */

import { logger } from './logger';

// ============================================================================
// Types
// ============================================================================

export type StepType = 
  | 'thought'          // Internal reasoning
  | 'observation'      // Information gathered
  | 'action'           // Tool call or decision
  | 'result'           // Tool result or outcome
  | 'reflection'       // Self-correction or learning
  | 'plan'             // Multi-step planning
  | 'question'         // Question to clarify
  | 'conclusion';      // Final answer or decision

export interface ReasoningStep {
  id: string;
  type: StepType;
  content: string;
  timestamp: Date;
  metadata?: {
    toolName?: string;
    confidence?: number;  // 0-1
    alternatives?: string[];
    source?: string;
  };
}

export interface ReasoningChain {
  sessionId: string;
  goal: string;
  steps: ReasoningStep[];
  status: 'active' | 'completed' | 'failed' | 'paused';
  startedAt: Date;
  completedAt?: Date;
  summary?: string;
}

export interface ScratchpadConfig {
  maxSteps: number;
  persistToDb: boolean;
  includeInContext: boolean;
  verbosity: 'minimal' | 'standard' | 'verbose';
}

// ============================================================================
// Reasoning Scratchpad Class
// ============================================================================

export class ReasoningScratchpad {
  private chains: Map<string, ReasoningChain> = new Map();
  private config: ScratchpadConfig;

  constructor(config: Partial<ScratchpadConfig> = {}) {
    this.config = {
      maxSteps: 50,
      persistToDb: false,
      includeInContext: true,
      verbosity: 'standard',
      ...config
    };
  }

  /**
   * Start a new reasoning chain for a goal
   */
  startChain(sessionId: string, goal: string): ReasoningChain {
    const chain: ReasoningChain = {
      sessionId,
      goal,
      steps: [],
      status: 'active',
      startedAt: new Date()
    };
    
    this.chains.set(sessionId, chain);
    this.addStep(sessionId, 'plan', `Goal: ${goal}`);
    
    logger.debug({ sessionId, goal }, 'Started reasoning chain');
    return chain;
  }

  /**
   * Add a step to the reasoning chain
   */
  addStep(
    sessionId: string,
    type: StepType,
    content: string,
    metadata?: ReasoningStep['metadata']
  ): ReasoningStep | null {
    const chain = this.chains.get(sessionId);
    if (!chain) {
      logger.warn({ sessionId }, 'No active chain for session');
      return null;
    }

    if (chain.steps.length >= this.config.maxSteps) {
      // Summarize and trim old steps
      this.summarizeAndTrim(sessionId);
    }

    const step: ReasoningStep = {
      id: `step_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      type,
      content,
      timestamp: new Date(),
      metadata
    };

    chain.steps.push(step);
    return step;
  }

  /**
   * Add a thought (internal reasoning)
   */
  think(sessionId: string, thought: string, confidence?: number): ReasoningStep | null {
    return this.addStep(sessionId, 'thought', thought, { confidence });
  }

  /**
   * Add an observation (information gathered)
   */
  observe(sessionId: string, observation: string, source?: string): ReasoningStep | null {
    return this.addStep(sessionId, 'observation', observation, { source });
  }

  /**
   * Record a tool action
   */
  act(sessionId: string, toolName: string, reason: string): ReasoningStep | null {
    return this.addStep(sessionId, 'action', reason, { toolName });
  }

  /**
   * Record a tool result
   */
  recordResult(sessionId: string, toolName: string, result: string): ReasoningStep | null {
    return this.addStep(sessionId, 'result', result, { toolName });
  }

  /**
   * Add a reflection (self-correction)
   */
  reflect(sessionId: string, reflection: string, alternatives?: string[]): ReasoningStep | null {
    return this.addStep(sessionId, 'reflection', reflection, { alternatives });
  }

  /**
   * Add a planning step
   */
  plan(sessionId: string, planContent: string): ReasoningStep | null {
    return this.addStep(sessionId, 'plan', planContent);
  }

  /**
   * Record final conclusion
   */
  conclude(sessionId: string, conclusion: string): ReasoningStep | null {
    const step = this.addStep(sessionId, 'conclusion', conclusion);
    const chain = this.chains.get(sessionId);
    if (chain) {
      chain.status = 'completed';
      chain.completedAt = new Date();
    }
    return step;
  }

  /**
   * Get the current chain
   */
  getChain(sessionId: string): ReasoningChain | undefined {
    return this.chains.get(sessionId);
  }

  /**
   * Get recent steps for context
   */
  getRecentSteps(sessionId: string, count: number = 10): ReasoningStep[] {
    const chain = this.chains.get(sessionId);
    if (!chain) return [];
    return chain.steps.slice(-count);
  }

  /**
   * Format chain for LLM context
   */
  formatForContext(sessionId: string): string {
    const chain = this.chains.get(sessionId);
    if (!chain || chain.steps.length === 0) return '';

    const relevantSteps = this.getRelevantSteps(chain);
    
    let output = '## Your Reasoning So Far\n\n';
    
    for (const step of relevantSteps) {
      const icon = this.getStepIcon(step.type);
      const meta = step.metadata?.toolName ? ` [${step.metadata.toolName}]` : '';
      const conf = step.metadata?.confidence 
        ? ` (confidence: ${Math.round(step.metadata.confidence * 100)}%)`
        : '';
      output += `${icon} **${step.type.toUpperCase()}**${meta}${conf}: ${step.content}\n`;
    }

    return output;
  }

  /**
   * Get steps relevant for context (based on verbosity)
   */
  private getRelevantSteps(chain: ReasoningChain): ReasoningStep[] {
    const steps = chain.steps;
    
    switch (this.config.verbosity) {
      case 'minimal':
        // Only actions, results, and conclusions
        return steps.filter(s => 
          ['action', 'result', 'conclusion'].includes(s.type)
        ).slice(-5);
      
      case 'verbose':
        // All steps
        return steps.slice(-15);
      
      case 'standard':
      default:
        // Exclude some thoughts, keep recent important steps
        return steps.filter(s => 
          s.type !== 'thought' || s.metadata?.confidence && s.metadata.confidence > 0.7
        ).slice(-10);
    }
  }

  /**
   * Get icon for step type
   */
  private getStepIcon(type: StepType): string {
    const icons: Record<StepType, string> = {
      thought: '💭',
      observation: '👁️',
      action: '⚡',
      result: '✅',
      reflection: '🔄',
      plan: '📋',
      question: '❓',
      conclusion: '🎯'
    };
    return icons[type] || '•';
  }

  /**
   * Summarize and trim old steps to stay within limits
   */
  private summarizeAndTrim(sessionId: string): void {
    const chain = this.chains.get(sessionId);
    if (!chain) return;

    const halfMax = Math.floor(this.config.maxSteps / 2);
    const stepsToSummarize = chain.steps.slice(0, halfMax);
    const stepsToKeep = chain.steps.slice(halfMax);

    // Create a summary of old steps
    const summary = this.createSummary(stepsToSummarize);
    
    // Replace with summary + recent steps
    chain.steps = [
      {
        id: `summary_${Date.now()}`,
        type: 'reflection',
        content: `[Summary of ${stepsToSummarize.length} earlier steps] ${summary}`,
        timestamp: new Date()
      },
      ...stepsToKeep
    ];

    logger.debug({ sessionId, trimmed: stepsToSummarize.length }, 'Trimmed reasoning chain');
  }

  /**
   * Create a summary of steps
   */
  private createSummary(steps: ReasoningStep[]): string {
    const actions = steps.filter(s => s.type === 'action');
    const conclusions = steps.filter(s => s.type === 'conclusion' || s.type === 'result');
    
    const parts: string[] = [];
    
    if (actions.length > 0) {
      parts.push(`Took ${actions.length} actions`);
    }
    if (conclusions.length > 0) {
      const lastConclusion = conclusions[conclusions.length - 1];
      parts.push(`Key finding: ${lastConclusion.content.slice(0, 100)}`);
    }

    return parts.join('. ') || 'Explored multiple approaches.';
  }

  /**
   * Export chain for persistence
   */
  exportChain(sessionId: string): ReasoningChain | null {
    const chain = this.chains.get(sessionId);
    if (!chain) return null;
    return JSON.parse(JSON.stringify(chain));
  }

  /**
   * Import a chain (for resuming)
   */
  importChain(chain: ReasoningChain): void {
    this.chains.set(chain.sessionId, chain);
  }

  /**
   * Clear a chain
   */
  clearChain(sessionId: string): void {
    this.chains.delete(sessionId);
  }

  /**
   * Get all active chains (for debugging)
   */
  getActiveChains(): string[] {
    return Array.from(this.chains.entries())
      .filter(([_, chain]) => chain.status === 'active')
      .map(([id]) => id);
  }
}

// ============================================================================
// ReAct Pattern Helpers
// ============================================================================

/**
 * Parse LLM response for reasoning markers (ReAct pattern)
 */
export function parseReActResponse(response: string): {
  thought?: string;
  action?: string;
  actionInput?: string;
  observation?: string;
  finalAnswer?: string;
} {
  const result: ReturnType<typeof parseReActResponse> = {};

  // Match Thought: ...
  const thoughtMatch = response.match(/Thought:\s*(.+?)(?=Action:|Observation:|Final Answer:|$)/si);
  if (thoughtMatch) result.thought = thoughtMatch[1].trim();

  // Match Action: ...
  const actionMatch = response.match(/Action:\s*(.+?)(?=Action Input:|Observation:|$)/si);
  if (actionMatch) result.action = actionMatch[1].trim();

  // Match Action Input: ...
  const inputMatch = response.match(/Action Input:\s*(.+?)(?=Observation:|Final Answer:|$)/si);
  if (inputMatch) result.actionInput = inputMatch[1].trim();

  // Match Observation: ...
  const obsMatch = response.match(/Observation:\s*(.+?)(?=Thought:|Action:|Final Answer:|$)/si);
  if (obsMatch) result.observation = obsMatch[1].trim();

  // Match Final Answer: ...
  const answerMatch = response.match(/Final Answer:\s*(.+?)$/si);
  if (answerMatch) result.finalAnswer = answerMatch[1].trim();

  return result;
}

/**
 * Format a ReAct-style prompt section
 */
export function formatReActSection(
  thought?: string,
  action?: string,
  observation?: string
): string {
  const parts: string[] = [];
  
  if (thought) parts.push(`Thought: ${thought}`);
  if (action) parts.push(`Action: ${action}`);
  if (observation) parts.push(`Observation: ${observation}`);
  
  return parts.join('\n');
}

// ============================================================================
// Singleton Export
// ============================================================================

export const scratchpad = new ReasoningScratchpad({
  maxSteps: 50,
  persistToDb: false,
  includeInContext: true,
  verbosity: 'standard'
});
