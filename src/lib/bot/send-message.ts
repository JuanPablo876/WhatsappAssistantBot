import { prisma } from '@/lib/db';
import { CloudAPIChannel } from './channels/cloud-api';
import { baileysManager } from './channels/baileys';
import { logger } from './logger';
import type { OutgoingMessage } from './types';
import { createVoiceServiceFromConfig } from '../voice';
import { convertMp3ToOggOpus } from '../voice/audio-converter';

/**
 * Send a message back to a contact via the tenant's configured WhatsApp channel.
 * Optionally sends as a voice message if voiceConfig is provided.
 */
export async function sendMessage(
  message: OutgoingMessage,
  voiceConfig?: {
    provider: string;
    apiKey: string | null;
    voiceId: string | null;
    stability: number;
    similarityBoost: number;
    openaiVoice: string;
    openaiModel: string;
    openaiSpeed: number;
  } | null
): Promise<void> {
  const config = await prisma.whatsappConfig.findUnique({
    where: { tenantId: message.tenantId },
  });

  if (!config || !config.isActive) {
    logger.warn({ tenantId: message.tenantId }, 'No active WhatsApp config for tenant');
    return;
  }

  try {
    // Generate voice audio if voice config provided
    let audioBuffer: Buffer | null = null;
    if (voiceConfig) {
      try {
        const voiceService = createVoiceServiceFromConfig({
          provider: voiceConfig.provider,
          apiKey: voiceConfig.apiKey,
          voiceId: voiceConfig.voiceId,
          stability: voiceConfig.stability,
          similarityBoost: voiceConfig.similarityBoost,
          openaiVoice: voiceConfig.openaiVoice,
          openaiModel: voiceConfig.openaiModel,
          openaiSpeed: voiceConfig.openaiSpeed,
        });
        const mp3Buffer = await voiceService.textToSpeech(message.text);
        // Convert MP3 to OGG Opus for WhatsApp Android compatibility
        audioBuffer = await convertMp3ToOggOpus(mp3Buffer);
        logger.info({ tenantId: message.tenantId, mp3Size: mp3Buffer.length, oggSize: audioBuffer.length }, 'Generated and converted voice response');
      } catch (error) {
        logger.error({ error, tenantId: message.tenantId }, 'Failed to generate voice, falling back to text');
        audioBuffer = null;
      }
    }

    if (config.channel === 'CLOUD_API') {
      if (!config.phoneNumberId || !config.accessToken) {
        logger.error({ tenantId: message.tenantId }, 'Cloud API missing credentials');
        return;
      }
      // Cloud API voice sending would require media upload - fall back to text for now
      await CloudAPIChannel.sendMessage(message, config.phoneNumberId, config.accessToken);
    } else if (config.channel === 'BAILEYS') {
      if (audioBuffer) {
        // Send as voice note
        await baileysManager.sendAudioMessage(message.tenantId, message.to, audioBuffer, true);
      } else {
        // Send as text
        await baileysManager.sendMessage(message.tenantId, message.to, message.text);
      }
    }
  } catch (error) {
    logger.error({ error, tenantId: message.tenantId, to: message.to }, 'Failed to send message');
  }
}
