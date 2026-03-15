import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import { Readable, PassThrough } from 'stream';
import { logger } from '../bot/logger';

// Set ffmpeg path from ffmpeg-static
if (ffmpegStatic) {
  ffmpeg.setFfmpegPath(ffmpegStatic);
}

/**
 * Convert MP3 audio buffer to OGG Opus format.
 * WhatsApp Android requires OGG Opus for voice notes to play correctly.
 */
export async function convertMp3ToOggOpus(mp3Buffer: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const inputStream = Readable.from(mp3Buffer);
    const outputStream = new PassThrough();
    const chunks: Buffer[] = [];

    outputStream.on('data', (chunk) => chunks.push(chunk));
    outputStream.on('end', () => {
      const oggBuffer = Buffer.concat(chunks);
      logger.debug({ inputSize: mp3Buffer.length, outputSize: oggBuffer.length }, 'Converted MP3 to OGG Opus');
      resolve(oggBuffer);
    });
    outputStream.on('error', reject);

    ffmpeg(inputStream)
      .inputFormat('mp3')
      .audioCodec('libopus')
      .audioFrequency(48000)
      .audioChannels(1)
      .audioBitrate('64k')
      .format('ogg')
      .on('error', (err) => {
        logger.error({ error: err.message }, 'FFmpeg conversion error');
        reject(err);
      })
      .pipe(outputStream, { end: true });
  });
}

/**
 * Check if audio buffer is already OGG format (starts with OggS magic bytes)
 */
export function isOggFormat(buffer: Buffer): boolean {
  return buffer.length >= 4 && 
    buffer[0] === 0x4F && // O
    buffer[1] === 0x67 && // g
    buffer[2] === 0x67 && // g
    buffer[3] === 0x53;   // S
}
