/**
 * Reminder Channel Adapters
 * 
 * Adapters for sending reminders via different channels:
 * - WhatsApp (via existing Cloud API or Baileys)
 * - Email (via SendGrid)
 * - Voice calls (placeholder for future implementation)
 */

import { prisma } from '@/lib/db';
import { logger } from './logger';
import { CloudAPIChannel } from './channels/cloud-api';

/**
 * Send a WhatsApp reminder to a contact.
 */
export async function sendWhatsAppReminder(
  tenantId: string,
  phone: string,
  message: string
): Promise<boolean> {
  try {
    const config = await prisma.whatsappConfig.findUnique({
      where: { tenantId },
    });

    if (!config || !config.isActive) {
      logger.warn({ tenantId }, 'WhatsApp not configured for tenant');
      return false;
    }

    if (config.channel === 'CLOUD_API') {
      if (!config.phoneNumberId || !config.accessToken) {
        logger.warn({ tenantId }, 'Cloud API credentials missing');
        return false;
      }

      await CloudAPIChannel.sendMessage(
        { to: phone, text: message, tenantId },
        config.phoneNumberId,
        config.accessToken
      );
      return true;
    } else if (config.channel === 'BAILEYS') {
      // For Baileys, we need to communicate with the worker process
      // This is a simplified implementation — in production you'd use
      // a message queue or HTTP endpoint to the Baileys worker
      logger.warn({ tenantId }, 'Baileys reminder delivery not yet implemented');
      return false;
    }

    return false;
  } catch (error) {
    logger.error({ error, tenantId, phone }, 'Failed to send WhatsApp reminder');
    return false;
  }
}

/**
 * Send an email reminder via SendGrid.
 */
export async function sendEmailReminder(
  tenantId: string,
  email: string,
  subject: string,
  message: string
): Promise<boolean> {
  try {
    const profile = await prisma.businessProfile.findUnique({
      where: { tenantId },
    });

    if (!profile || !profile.emailProvider || !profile.emailApiKey) {
      logger.warn({ tenantId }, 'Email not configured for tenant');
      return false;
    }

    if (profile.emailProvider !== 'sendgrid') {
      logger.warn({ tenantId, provider: profile.emailProvider }, 'Unknown email provider');
      return false;
    }

    const fromAddress = profile.emailFromAddress || 'noreply@example.com';

    // SendGrid API call
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${profile.emailApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email }] }],
        from: { email: fromAddress },
        subject,
        content: [
          { type: 'text/plain', value: message },
          {
            type: 'text/html',
            value: `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #1a1a2e;">Appointment Reminder</h2>
              <div style="white-space: pre-wrap; line-height: 1.6;">${message}</div>
              <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
              <p style="font-size: 12px; color: #888;">
                This is an automated reminder from ${profile.businessName || 'our scheduling system'}.
              </p>
            </div>`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error({ tenantId, status: response.status, error: errorText }, 'SendGrid API error');
      return false;
    }

    logger.info({ tenantId, email }, 'Email reminder sent via SendGrid');
    return true;
  } catch (error) {
    logger.error({ error, tenantId, email }, 'Failed to send email reminder');
    return false;
  }
}

/**
 * Send a voice call reminder via Twilio.
 */
export async function sendVoiceCallReminder(
  tenantId: string,
  phone: string,
  message: string
): Promise<boolean> {
  try {
    // Dynamic import to avoid loading Twilio if not used
    const { makeOutboundCall, isTwilioConfigured } = await import('@/lib/voice/twilio');
    
    if (!isTwilioConfigured()) {
      logger.warn({ tenantId, phone }, 'Twilio not configured for voice calls');
      return false;
    }

    const result = await makeOutboundCall(phone, {
      tenantId,
      greeting: message,
      recordCall: false,
      timeout: 30,
    });

    logger.info({ 
      tenantId, 
      phone, 
      callSid: result.callSid 
    }, 'Voice call reminder initiated');
    
    return true;
  } catch (error) {
    logger.error({ error, tenantId, phone }, 'Failed to send voice call reminder');
    return false;
  }
}
