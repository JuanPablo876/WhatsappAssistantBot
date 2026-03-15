import axios from 'axios';
import { logger } from '../logger';
import type { IncomingMessage, OutgoingMessage } from '../types';

const GRAPH_API_URL = 'https://graph.facebook.com/v21.0';

/**
 * Multi-tenant Cloud API channel.
 * Each call takes config per-tenant (phoneNumberId, accessToken).
 */
export class CloudAPIChannel {
  /**
   * Send a message via Meta Cloud API for a specific tenant.
   */
  static async sendMessage(
    message: OutgoingMessage,
    phoneNumberId: string,
    accessToken: string
  ): Promise<void> {
    const url = `${GRAPH_API_URL}/${phoneNumberId}/messages`;
    try {
      await axios.post(
        url,
        {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: message.to,
          type: 'text',
          text: { preview_url: false, body: message.text },
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );
      logger.debug({ to: message.to, tenant: message.tenantId }, 'Message sent via Cloud API');
    } catch (error: any) {
      logger.error(
        { error: error?.response?.data || error.message, to: message.to },
        'Failed to send message via Cloud API'
      );
      throw error;
    }
  }

  /**
   * Parse a webhook payload from Meta and extract messages.
   * Returns an array of IncomingMessage with the resolved tenantId.
   */
  static parseWebhookPayload(body: any, tenantId: string): IncomingMessage[] {
    const messages: IncomingMessage[] = [];

    try {
      const entries = body?.entry;
      if (!entries) return messages;

      for (const entry of entries) {
        const changes = entry.changes;
        if (!changes) continue;

        for (const change of changes) {
          const value = change.value;
          if (!value?.messages) continue;

          for (const msg of value.messages) {
            if (msg.type !== 'text') continue;

            messages.push({
              id: msg.id,
              from: msg.from,
              text: msg.text.body,
              timestamp: new Date(parseInt(msg.timestamp) * 1000),
              type: 'text',
              tenantId,
              raw: msg,
            });
          }
        }
      }
    } catch (error) {
      logger.error({ error }, 'Error parsing Cloud API webhook payload');
    }

    return messages;
  }
}
