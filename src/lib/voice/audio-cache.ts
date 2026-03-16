/**
 * Shared audio cache for ElevenLabs generated audio.
 * Used by both the gather route (to store) and the audio endpoint (to serve).
 * 
 * Note: This is in-memory and will not persist across server restarts.
 * For production, consider using Redis or a database.
 */

interface AudioEntry {
  audio: Buffer;
  timestamp: number;
}

// In-memory audio cache
const audioCache = new Map<string, AudioEntry>();

// TTL for audio entries (5 minutes)
const AUDIO_TTL_MS = 5 * 60 * 1000;

/**
 * Store audio in the cache
 */
export function storeAudio(audioId: string, audio: Buffer): void {
  audioCache.set(audioId, { 
    audio, 
    timestamp: Date.now() 
  });
}

/**
 * Retrieve audio from the cache
 */
export function getAudio(audioId: string): Buffer | null {
  const entry = audioCache.get(audioId);
  if (!entry) {
    return null;
  }
  
  // Check if expired
  if (Date.now() - entry.timestamp > AUDIO_TTL_MS) {
    audioCache.delete(audioId);
    return null;
  }
  
  return entry.audio;
}

/**
 * Generate a unique audio ID
 */
export function generateAudioId(): string {
  return `el_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Clean up expired audio entries
 */
export function cleanupExpiredAudio(): void {
  const now = Date.now();
  for (const [id, entry] of audioCache.entries()) {
    if (now - entry.timestamp > AUDIO_TTL_MS) {
      audioCache.delete(id);
    }
  }
}

// Run cleanup every minute
if (typeof setInterval !== 'undefined') {
  setInterval(cleanupExpiredAudio, 60 * 1000);
}
