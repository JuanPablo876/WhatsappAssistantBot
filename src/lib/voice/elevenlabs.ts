import { logger } from '../bot/logger';

/**
 * ElevenLabs voice integration for:
 * - TTS (Text-to-Speech) for generating voice messages
 * - STT (Speech-to-Text) via Scribe API for transcription
 * Used by PRO-tier tenants for voice interactions via WhatsApp.
 */
export class ElevenLabsService {
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.ELEVENLABS_API_KEY || '';
    if (!this.apiKey) {
      logger.warn('ELEVENLABS_API_KEY not set — voice features will be unavailable');
    }
  }

  /**
   * Transcribe audio to text using ElevenLabs Scribe API.
   * Supports mp3, mp4, mpeg, mpga, m4a, wav, webm, ogg formats.
   * 
   * @param audioBuffer - The audio data as a Buffer
   * @param options - Optional settings for transcription
   * @returns The transcribed text
   */
  async transcribe(
    audioBuffer: Buffer,
    options: {
      language?: string; // ISO-639-1 code (e.g., 'en', 'es', 'fr') - optional, auto-detected if omitted
      filename?: string; // Original filename with extension
    } = {}
  ): Promise<string> {
    const { language, filename = 'audio.mp3' } = options;

    try {
      // Create FormData with the audio file
      // Use arrayBuffer slice with type assertion for full compatibility
      const arrayBuffer = audioBuffer.buffer.slice(
        audioBuffer.byteOffset,
        audioBuffer.byteOffset + audioBuffer.byteLength
      ) as ArrayBuffer;
      const formData = new FormData();
      formData.append('file', new Blob([arrayBuffer]), filename);
      formData.append('model_id', 'scribe_v1');
      if (language) {
        formData.append('language_code', language);
      }

      const response = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
        method: 'POST',
        headers: {
          'xi-api-key': this.apiKey,
        },
        body: formData,
      });

      if (!response.ok) {
        const error = await response.text();
        logger.error({ error, status: response.status }, 'ElevenLabs STT failed');
        throw new Error(`ElevenLabs STT error: ${response.status} ${error}`);
      }

      const data = await response.json();
      const text = data.text || '';
      logger.info({ length: text.length, language: data.language_code }, 'ElevenLabs STT transcription complete');
      return text;
    } catch (error) {
      logger.error({ error }, 'ElevenLabs STT transcription failed');
      throw new Error(`ElevenLabs STT error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Transcribe audio with word-level timestamps using ElevenLabs Scribe API.
   * Returns detailed transcription with timing information.
   */
  async transcribeVerbose(
    audioBuffer: Buffer,
    options: {
      language?: string;
      filename?: string;
    } = {}
  ): Promise<{
    text: string;
    words: Array<{
      text: string;
      start: number;
      end: number;
      type: string;
    }>;
    language: string;
  }> {
    const { language, filename = 'audio.mp3' } = options;

    try {
      // Use arrayBuffer slice with type assertion for full compatibility
      const arrayBuffer = audioBuffer.buffer.slice(
        audioBuffer.byteOffset,
        audioBuffer.byteOffset + audioBuffer.byteLength
      ) as ArrayBuffer;
      const formData = new FormData();
      formData.append('file', new Blob([arrayBuffer]), filename);
      formData.append('model_id', 'scribe_v1');
      formData.append('timestamps_granularity', 'word');
      if (language) {
        formData.append('language_code', language);
      }

      const response = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
        method: 'POST',
        headers: {
          'xi-api-key': this.apiKey,
        },
        body: formData,
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`ElevenLabs STT error: ${response.status} ${error}`);
      }

      const data = await response.json();
      return {
        text: data.text || '',
        words: data.words || [],
        language: data.language_code || 'unknown',
      };
    } catch (error) {
      logger.error({ error }, 'ElevenLabs verbose transcription failed');
      throw error;
    }
  }

  /**
   * Generate speech audio from text using ElevenLabs API.
   * Returns the audio as a Buffer (mp3 format).
   */
  async textToSpeech(
    text: string,
    options: {
      voiceId?: string;
      stability?: number;
      similarityBoost?: number;
    } = {}
  ): Promise<Buffer> {
    const voiceId = options.voiceId || '21m00Tcm4TlvDq8ikWAM'; // Rachel
    const stability = options.stability ?? 0.5;
    const similarityBoost = options.similarityBoost ?? 0.75;

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': this.apiKey,
          'Content-Type': 'application/json',
          Accept: 'audio/mpeg',
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability,
            similarity_boost: similarityBoost,
          },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      logger.error({ error, voiceId }, 'ElevenLabs TTS failed');
      throw new Error(`ElevenLabs API error: ${response.status} ${error}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  /**
   * Get list of available voices from ElevenLabs.
   */
  async getVoices(): Promise<
    Array<{ voice_id: string; name: string; category: string }>
  > {
    const response = await fetch('https://api.elevenlabs.io/v1/voices', {
      headers: { 'xi-api-key': this.apiKey },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch voices: ${response.status}`);
    }

    const data = await response.json();
    return data.voices.map((v: any) => ({
      voice_id: v.voice_id,
      name: v.name,
      category: v.category,
    }));
  }
}

// Singleton instance for default API key (env var)
let instance: ElevenLabsService | null = null;

export function getElevenLabs(apiKey?: string): ElevenLabsService {
  // If a custom API key is provided, return a new instance
  if (apiKey) {
    return new ElevenLabsService(apiKey);
  }
  // Otherwise use singleton with env var
  if (!instance) {
    instance = new ElevenLabsService();
  }
  return instance;
}
