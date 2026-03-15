import { NextRequest, NextResponse } from 'next/server';

/**
 * Server-side proxy for ElevenLabs TTS API.
 * This avoids CORS issues in Electron and keeps the API key server-side.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { text, voiceId, apiKey, stability, similarityBoost, modelId } = body;

    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    if (!voiceId) {
      return NextResponse.json({ error: 'Voice ID is required' }, { status: 400 });
    }

    // Use provided API key or fall back to environment variable
    const elevenLabsKey = apiKey || process.env.ELEVENLABS_API_KEY;
    if (!elevenLabsKey) {
      return NextResponse.json({ error: 'ElevenLabs API key not configured' }, { status: 500 });
    }

    // Call ElevenLabs API
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': elevenLabsKey,
      },
      body: JSON.stringify({
        text: text.slice(0, 5000), // ElevenLabs has a character limit
        model_id: modelId || 'eleven_multilingual_v2',
        voice_settings: {
          stability: stability ?? 0.5,
          similarity_boost: similarityBoost ?? 0.75,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('ElevenLabs API error:', response.status, errorText);
      
      if (response.status === 401) {
        return NextResponse.json({ error: 'Invalid ElevenLabs API key' }, { status: 401 });
      }
      if (response.status === 404) {
        return NextResponse.json({ error: 'Voice not found. Please select a valid voice.' }, { status: 404 });
      }
      
      return NextResponse.json(
        { error: `ElevenLabs error: ${response.statusText}` },
        { status: response.status }
      );
    }

    // Get the audio buffer
    const buffer = Buffer.from(await response.arrayBuffer());

    // Return as audio/mpeg
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': buffer.length.toString(),
      },
    });
  } catch (error: any) {
    console.error('ElevenLabs proxy error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate speech' },
      { status: 500 }
    );
  }
}
