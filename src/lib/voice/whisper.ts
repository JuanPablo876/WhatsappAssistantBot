import OpenAI, { toFile } from 'openai';
import { logger } from '../bot/logger';

/**
 * OpenAI Whisper integration for speech-to-text transcription.
 * Used to transcribe incoming voice messages from WhatsApp.
 */
export class WhisperService {
  private client: OpenAI;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      logger.warn('OPENAI_API_KEY not set — Whisper transcription will be unavailable');
    }
    this.client = new OpenAI({ apiKey });
  }

  /**
   * Transcribe audio to text using OpenAI Whisper API.
   * Supports mp3, mp4, mpeg, mpga, m4a, wav, webm formats.
   * 
   * @param audioBuffer - The audio data as a Buffer
   * @param options - Optional settings for transcription
   * @returns The transcribed text
   */
  async transcribe(
    audioBuffer: Buffer,
    options: {
      language?: string; // ISO-639-1 code (e.g., 'en', 'es', 'fr')
      prompt?: string; // Hint for better transcription accuracy
      filename?: string; // Original filename with extension
    } = {}
  ): Promise<string> {
    const { language, prompt, filename = 'audio.mp3' } = options;

    try {
      // Create a file from the buffer using OpenAI's toFile helper
      const file = await toFile(audioBuffer, filename);

      const response = await this.client.audio.transcriptions.create({
        file,
        model: 'whisper-1',
        language,
        prompt,
        response_format: 'text',
      });

      // response is a string when response_format is 'text'
      const text = typeof response === 'string' ? response : (response as any).text || '';
      logger.info({ length: text.length, language }, 'Whisper transcription complete');
      return text;
    } catch (error) {
      logger.error({ error }, 'Whisper transcription failed');
      throw new Error(`Whisper API error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Transcribe audio with timestamps (useful for longer audio).
   * Returns segments with start/end times.
   */
  async transcribeVerbose(
    audioBuffer: Buffer,
    options: {
      language?: string;
      prompt?: string;
      filename?: string;
    } = {}
  ): Promise<{
    text: string;
    segments: Array<{
      text: string;
      start: number;
      end: number;
    }>;
    language: string;
    duration: number;
  }> {
    const { language, prompt, filename = 'audio.mp3' } = options;

    try {
      const file = await toFile(audioBuffer, filename);

      const response = await this.client.audio.transcriptions.create({
        file,
        model: 'whisper-1',
        language,
        prompt,
        response_format: 'verbose_json',
      });

      return {
        text: response.text,
        segments: response.segments?.map(seg => ({
          text: seg.text,
          start: seg.start,
          end: seg.end,
        })) || [],
        language: response.language,
        duration: response.duration,
      };
    } catch (error) {
      logger.error({ error }, 'Whisper verbose transcription failed');
      throw new Error(`Whisper API error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Translate audio from any language to English text.
   */
  async translateToEnglish(
    audioBuffer: Buffer,
    options: {
      prompt?: string;
      filename?: string;
    } = {}
  ): Promise<string> {
    const { prompt, filename = 'audio.mp3' } = options;

    try {
      const file = await toFile(audioBuffer, filename);

      const response = await this.client.audio.translations.create({
        file,
        model: 'whisper-1',
        prompt,
        response_format: 'text',
      });

      // response is a string when response_format is 'text'
      const text = typeof response === 'string' ? response : (response as any).text || '';
      logger.info({ length: text.length }, 'Whisper translation complete');
      return text;
    } catch (error) {
      logger.error({ error }, 'Whisper translation failed');
      throw new Error(`Whisper API error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

// Singleton
let instance: WhisperService | null = null;

export function getWhisper(): WhisperService {
  if (!instance) {
    instance = new WhisperService();
  }
  return instance;
}
