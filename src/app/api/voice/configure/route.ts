import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthenticatedUserWithTenant } from '@/lib/auth-local';

export async function POST(request: Request) {
  try {
    const { activeTenant: tenant } = await getAuthenticatedUserWithTenant();
    if (!tenant) return NextResponse.json({ error: 'No tenant' }, { status: 404 });
    const body = await request.json();

    await prisma.voiceConfig.upsert({
      where: { tenantId: tenant.id },
      update: {
        enabled: body.voiceEnabled ?? body.enabled,
        callsEnabled: body.callsEnabled,
        provider: body.provider || 'openai',
        // ElevenLabs settings
        voiceId: body.voiceId,
        stability: body.stability,
        similarityBoost: body.similarityBoost,
        // OpenAI TTS settings
        openaiVoice: body.openaiVoice || 'nova',
        openaiModel: body.openaiModel || 'tts-1',
        openaiSpeed: body.openaiSpeed ?? 1.0,
      },
      create: {
        tenantId: tenant.id,
        enabled: body.voiceEnabled ?? body.enabled,
        callsEnabled: body.callsEnabled,
        provider: body.provider || 'openai',
        // ElevenLabs settings
        voiceId: body.voiceId,
        stability: body.stability,
        similarityBoost: body.similarityBoost,
        // OpenAI TTS settings
        openaiVoice: body.openaiVoice || 'nova',
        openaiModel: body.openaiModel || 'tts-1',
        openaiSpeed: body.openaiSpeed ?? 1.0,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Voice configure error:', error);
    return NextResponse.json({ error: 'Failed to configure' }, { status: 500 });
  }
}
