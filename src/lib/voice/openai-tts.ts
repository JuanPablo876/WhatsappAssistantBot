import OpenAI from 'openai';
import { logger } from '../bot/logger';

/**
 * Available OpenAI TTS voices.
 * Each has distinct characteristics:
 * - alloy: Neutral, balanced
 * - echo: Warm, conversational
 * - fable: Expressive, storytelling
 * - onyx: Deep, authoritative
 * - nova: Friendly, energetic
 * - shimmer: Soft, calm
 */
export type OpenAIVoice = 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';

/**
 * OpenAI TTS models:
 * - tts-1: Optimized for real-time, lower latency
 * - tts-1-hd: Higher quality but more expensive
 */
export type OpenAITTSModel = 'tts-1' | 'tts-1-hd';

/**
 * OpenAI Text-to-Speech integration.
 * Alternative to ElevenLabs, uses the same API key as the AI.
 */
export class OpenAITTSService {
  private client: OpenAI;
  private apiKeyAvailable: boolean;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    this.apiKeyAvailable = !!apiKey;
    if (!apiKey) {
      logger.warn('OPENAI_API_KEY not set — OpenAI TTS will be unavailable');
    }
    this.client = new OpenAI({ apiKey });
  }

  /**
   * Check if OpenAI TTS is available (API key is set)
   */
  isAvailable(): boolean {
    return this.apiKeyAvailable;
  }

  /**
   * Generate speech audio from text using OpenAI TTS API.
   * Returns the audio as a Buffer (mp3 format by default).
   * 
   * Pricing (as of 2024):
   * - tts-1: $0.015 per 1,000 characters
   * - tts-1-hd: $0.030 per 1,000 characters
   */
  async textToSpeech(
    text: string,
    options: {
      voice?: OpenAIVoice;
      model?: OpenAITTSModel;
      speed?: number; // 0.25 to 4.0, default 1.0
      format?: 'mp3' | 'opus' | 'aac' | 'flac' | 'wav' | 'pcm';
    } = {}
  ): Promise<Buffer> {
    if (!this.apiKeyAvailable) {
      throw new Error('OpenAI TTS unavailable: OPENAI_API_KEY not set. Please configure the environment variable or switch to ElevenLabs provider.');
    }

    const {
      voice = 'nova',
      model = 'tts-1',
      speed = 1.0,
      format = 'mp3',
    } = options;

    try {
      const response = await this.client.audio.speech.create({
        model,
        voice,
        input: text,
        speed,
        response_format: format,
      });

      // Convert response to Buffer
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      logger.info(
        { voice, model, textLength: text.length, audioSize: buffer.length },
        'OpenAI TTS complete'
      );

      return buffer;
    } catch (error) {
      logger.error({ error, voice, model }, 'OpenAI TTS failed');
      throw new Error(`OpenAI TTS error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get list of available voices with descriptions.
   */
  getVoices(): Array<{ voice_id: OpenAIVoice; name: string; description: string }> {
    return [
      { voice_id: 'alloy', name: 'Alloy', description: 'Neutral and balanced' },
      { voice_id: 'echo', name: 'Echo', description: 'Warm and conversational' },
      { voice_id: 'fable', name: 'Fable', description: 'Expressive, good for storytelling' },
      { voice_id: 'onyx', name: 'Onyx', description: 'Deep and authoritative' },
      { voice_id: 'nova', name: 'Nova', description: 'Friendly and energetic' },
      { voice_id: 'shimmer', name: 'Shimmer', description: 'Soft and calm' },
    ];
  }
}

// Singleton
let instance: OpenAITTSService | null = null;

export function getOpenAITTS(): OpenAITTSService {
  if (!instance) {
    instance = new OpenAITTSService();
  }
  return instance;
}
