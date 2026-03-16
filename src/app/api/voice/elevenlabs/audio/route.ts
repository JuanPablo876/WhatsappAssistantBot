import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/bot/logger';
import { ElevenLabsService } from '@/lib/voice/elevenlabs';
import { storeAudio, getAudio, generateAudioId } from '@/lib/voice/audio-cache';

/**
 * POST /api/voice/elevenlabs/audio
 * Generate speech audio and return an audio ID for playback
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { text, voiceId, stability, similarityBoost, apiKey } = body;

    if (!text) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    // Use provided API key or fall back to env
    const elevenlabs = new ElevenLabsService(apiKey || process.env.ELEVENLABS_API_KEY);

    // Generate audio
    const audio = await elevenlabs.textToSpeech(text, {
      voiceId: voiceId || '21m00Tcm4TlvDq8ikWAM', // Rachel default
      stability: stability ?? 0.5,
      similarityBoost: similarityBoost ?? 0.75,
    });

    // Store with unique ID
    const audioId = generateAudioId();
    storeAudio(audioId, audio);

    logger.info({ audioId, textLength: text.length }, 'ElevenLabs audio generated for call');

    return NextResponse.json({ 
      success: true, 
      audioId,
      audioUrl: `/api/voice/elevenlabs/audio?id=${audioId}`,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to generate ElevenLabs audio');
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Failed to generate audio' 
    }, { status: 500 });
  }
}

/**
 * GET /api/voice/elevenlabs/audio?id=xxx
 * Serve pre-generated audio to Twilio
 */
export async function GET(request: NextRequest) {
  try {
    const audioId = request.nextUrl.searchParams.get('id');

    if (!audioId) {
      return new NextResponse('Audio ID required', { status: 400 });
    }

    const audio = getAudio(audioId);
    if (!audio) {
      logger.warn({ audioId }, 'Audio not found in cache');
      return new NextResponse('Audio not found or expired', { status: 404 });
    }

    // Return audio as MP3
    return new NextResponse(new Uint8Array(audio), {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': audio.length.toString(),
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error) {
    logger.error({ error }, 'Failed to serve ElevenLabs audio');
    return new NextResponse('Internal error', { status: 500 });
  }
}
