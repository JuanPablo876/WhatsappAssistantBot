import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { text, provider, voice, model, speed } = body;

    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    if (provider !== 'openai') {
      // ElevenLabs is handled client-side directly
      return NextResponse.json({ error: 'Only OpenAI provider is supported via this endpoint' }, { status: 400 });
    }

    // Check for OpenAI API key
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 });
    }

    const openai = new OpenAI({ apiKey });

    // Generate speech using OpenAI TTS
    const mp3Response = await openai.audio.speech.create({
      model: model || 'tts-1',
      voice: voice || 'nova',
      input: text.slice(0, 4096), // OpenAI has a 4096 char limit
      speed: speed || 1.0,
    });

    // Get the audio buffer
    const buffer = Buffer.from(await mp3Response.arrayBuffer());

    // Return as audio/mpeg
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': buffer.length.toString(),
      },
    });
  } catch (error: any) {
    console.error('Voice test error:', error);
    
    if (error?.code === 'invalid_api_key') {
      return NextResponse.json({ error: 'Invalid OpenAI API key' }, { status: 401 });
    }
    
    return NextResponse.json(
      { error: error.message || 'Failed to generate speech' },
      { status: 500 }
    );
  }
}
