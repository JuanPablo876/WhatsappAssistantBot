/**
 * Unified Voice Service
 * Handles both STT (ElevenLabs Scribe or Whisper) and TTS (ElevenLabs or OpenAI)
 * Provider selection is per-tenant via VoiceConfig.
 */

import { getWhisper } from './whisper';
import { getElevenLabs } from './elevenlabs';
import { getOpenAITTS, OpenAIVoice, OpenAITTSModel } from './openai-tts';
import { logger } from '../bot/logger';

export type TTSProvider = 'elevenlabs' | 'openai';
export type STTProvider = 'elevenlabs' | 'whisper';

export interface VoiceServiceConfig {
  // STT settings
  sttProvider: STTProvider;
  sttFallbackEnabled?: boolean; // If true, falls back to other provider on error
  // TTS settings
  ttsProvider: TTSProvider;
  // ElevenLabs settings (shared API key for both STT and TTS)
  elevenlabsApiKey?: string;
  elevenlabsVoiceId?: string;
  elevenlabsStability?: number;
  elevenlabsSimilarityBoost?: number;
  // OpenAI TTS settings
  openaiVoice?: OpenAIVoice;
  openaiModel?: OpenAITTSModel;
  openaiSpeed?: number;
}

/**
 * Unified voice service that handles:
 * - Speech-to-Text (STT) via ElevenLabs Scribe or OpenAI Whisper
 * - Text-to-Speech (TTS) via ElevenLabs or OpenAI
 */
export class VoiceService {
  private config: VoiceServiceConfig;

  constructor(config: VoiceServiceConfig) {
    this.config = config;
  }

  /**
   * Transcribe audio to text using configured STT provider.
   * Falls back to alternate provider if enabled and primary fails.
   */
  async transcribe(
    audioBuffer: Buffer,
    options: { language?: string; filename?: string } = {}
  ): Promise<string> {
    const { sttProvider, sttFallbackEnabled } = this.config;

    try {
      if (sttProvider === 'elevenlabs') {
        return await this.elevenlabsSTT(audioBuffer, options);
      } else {
        return await this.whisperSTT(audioBuffer, options);
      }
    } catch (error) {
      logger.warn({ error, provider: sttProvider }, 'Primary STT failed');

      // Fallback to alternate provider
      if (sttFallbackEnabled) {
        logger.info({ fallbackProvider: sttProvider === 'elevenlabs' ? 'whisper' : 'elevenlabs' }, 'Attempting STT fallback');
        try {
          if (sttProvider === 'elevenlabs') {
            return await this.whisperSTT(audioBuffer, options);
          } else {
            return await this.elevenlabsSTT(audioBuffer, options);
          }
        } catch (fallbackError) {
          logger.error({ fallbackError }, 'STT fallback also failed');
          throw fallbackError;
        }
      }

      throw error;
    }
  }

  private async elevenlabsSTT(
    audioBuffer: Buffer,
    options: { language?: string; filename?: string }
  ): Promise<string> {
    const elevenlabs = getElevenLabs(this.config.elevenlabsApiKey);
    return elevenlabs.transcribe(audioBuffer, options);
  }

  private async whisperSTT(
    audioBuffer: Buffer,
    options: { language?: string; filename?: string }
  ): Promise<string> {
    const whisper = getWhisper();
    return whisper.transcribe(audioBuffer, options);
  }

  /**
   * Translate audio from any language to English.
   * Uses Whisper (only provider with translation support).
   */
  async translateToEnglish(
    audioBuffer: Buffer,
    options: { filename?: string } = {}
  ): Promise<string> {
    // ElevenLabs Scribe doesn't have translation, so always use Whisper
    const whisper = getWhisper();
    return whisper.translateToEnglish(audioBuffer, options);
  }

  /**
   * Generate speech from text using configured TTS provider.
   */
  async textToSpeech(text: string): Promise<Buffer> {
    if (this.config.ttsProvider === 'elevenlabs') {
      return this.elevenlabsTTS(text);
    } else {
      return this.openaiTTS(text);
    }
  }

  private async elevenlabsTTS(text: string): Promise<Buffer> {
    const elevenlabs = getElevenLabs();
    return elevenlabs.textToSpeech(text, {
      voiceId: this.config.elevenlabsVoiceId,
      stability: this.config.elevenlabsStability,
      similarityBoost: this.config.elevenlabsSimilarityBoost,
    });
  }

  private async openaiTTS(text: string): Promise<Buffer> {
    const openai = getOpenAITTS();
    return openai.textToSpeech(text, {
      voice: this.config.openaiVoice || 'nova',
      model: this.config.openaiModel || 'tts-1',
      speed: this.config.openaiSpeed || 1.0,
    });
  }

  /**
   * Get available voices for the configured provider.
   */
  async getAvailableVoices(): Promise<Array<{ voice_id: string; name: string; description?: string }>> {
    if (this.config.ttsProvider === 'elevenlabs') {
      const elevenlabs = getElevenLabs();
      const voices = await elevenlabs.getVoices();
      return voices.map(v => ({
        voice_id: v.voice_id,
        name: v.name,
        description: v.category,
      }));
    } else {
      const openai = getOpenAITTS();
      return openai.getVoices();
    }
  }
}

/**
 * Create a VoiceService for a tenant based on their VoiceConfig.
 * Uses ElevenLabs STT by default (if ElevenLabs API key available), 
 * with Whisper as fallback.
 */
export function createVoiceServiceFromConfig(voiceConfig: {
  provider: string;
  apiKey?: string | null;
  voiceId?: string | null;
  stability?: number;
  similarityBoost?: number;
  // OpenAI specific
  openaiVoice?: string | null;
  openaiModel?: string | null;
  openaiSpeed?: number | null;
}): VoiceService {
  const ttsProvider = voiceConfig.provider as TTSProvider;
  
  // Use ElevenLabs STT if we have an ElevenLabs API key, otherwise Whisper
  const hasElevenLabsKey = !!(voiceConfig.apiKey || process.env.ELEVENLABS_API_KEY);
  const sttProvider: STTProvider = hasElevenLabsKey ? 'elevenlabs' : 'whisper';
  
  return new VoiceService({
    sttProvider,
    sttFallbackEnabled: true, // Always enable fallback for robustness
    ttsProvider,
    elevenlabsApiKey: voiceConfig.apiKey || undefined,
    elevenlabsVoiceId: voiceConfig.voiceId || undefined,
    elevenlabsStability: voiceConfig.stability,
    elevenlabsSimilarityBoost: voiceConfig.similarityBoost,
    openaiVoice: (voiceConfig.openaiVoice as OpenAIVoice) || 'nova',
    openaiModel: (voiceConfig.openaiModel as OpenAITTSModel) || 'tts-1',
    openaiSpeed: voiceConfig.openaiSpeed || 1.0,
  });
}

// Export individual services for direct access if needed
export { getWhisper } from './whisper';
export { getElevenLabs } from './elevenlabs';
export { getOpenAITTS } from './openai-tts';
