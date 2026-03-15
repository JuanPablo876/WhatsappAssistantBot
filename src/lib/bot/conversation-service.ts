import { prisma } from '@/lib/db';
import { logger } from './logger';
import type { AIMessage } from './types';

const MAX_HISTORY_MESSAGES = 20;

/**
 * Multi-tenant conversation service.
 * All operations are scoped by tenantId to ensure data isolation.
 */
export class ConversationService {
  /**
   * Get or create a conversation for a contact under a specific tenant.
   */
  async getOrCreateConversation(
    tenantId: string,
    phone: string
  ): Promise<{ conversationId: string; contactName?: string }> {
    // Find or create contact scoped to tenant
    let contact = await prisma.contact.findUnique({
      where: { tenantId_phone: { tenantId, phone } },
    });

    if (!contact) {
      contact = await prisma.contact.create({
        data: { tenantId, phone },
      });
    }

    // Find active conversation or create new one
    let conversation = await prisma.conversation.findFirst({
      where: {
        tenantId,
        contactId: contact.id,
        status: 'ACTIVE',
      },
      orderBy: { updatedAt: 'desc' },
    });

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          tenantId,
          contactId: contact.id,
          status: 'ACTIVE',
        },
      });
      logger.debug({ conversationId: conversation.id, tenantId, phone }, 'New conversation started');
    }

    return {
      conversationId: conversation.id,
      contactName: contact.name ?? undefined,
    };
  }

  /**
   * Save a message to a conversation.
   */
  async saveMessage(
    conversationId: string,
    role: string,
    content: string,
    extra?: {
      toolCalls?: string;
      toolCallId?: string;
      tokenCount?: number;
    }
  ): Promise<void> {
    await prisma.message.create({
      data: {
        conversationId,
        role,
        content,
        toolCalls: extra?.toolCalls,
        toolCallId: extra?.toolCallId,
        tokenCount: extra?.tokenCount,
      },
    });

    await prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });
  }

  /**
   * Get conversation history formatted as AI messages.
   */
  async getHistory(conversationId: string): Promise<AIMessage[]> {
    const messages = await prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      take: MAX_HISTORY_MESSAGES,
    });

    return messages.map((m) => {
      const msg: AIMessage = {
        role: m.role as AIMessage['role'],
        content: m.content,
      };
      if (m.toolCalls) {
        try {
          msg.tool_calls = JSON.parse(m.toolCalls);
        } catch {
          // ignore malformed tool_calls
        }
      }
      if (m.toolCallId) {
        msg.tool_call_id = m.toolCallId;
      }
      return msg;
    });
  }

  /**
   * Update a contact's name after the AI learns it.
   */
  async updateContactName(tenantId: string, phone: string, name: string): Promise<void> {
    await prisma.contact.update({
      where: { tenantId_phone: { tenantId, phone } },
      data: { name },
    });
  }

  /**
   * Close a conversation.
   */
  async closeConversation(conversationId: string): Promise<void> {
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { status: 'CLOSED' },
    });
  }
}
