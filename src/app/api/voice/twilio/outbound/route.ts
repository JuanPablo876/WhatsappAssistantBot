import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/bot/logger';
import { generateGatherTwiML, generatePlayAudioTwiML } from '@/lib/voice/twilio';
import { ElevenLabsService } from '@/lib/voice/elevenlabs';
import { storeAudio, generateAudioId } from '@/lib/voice/audio-cache';

const TWILIO_WEBHOOK_URL = process.env.TWILIO_WEBHOOK_URL || 'https://iatransmisor.com';

/**
 * POST /api/voice/twilio/outbound
 * Handles outbound call connection (when recipient answers)
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const params: Record<string, string> = {};
    formData.forEach((value, key) => {
      params[key] = value.toString();
    });

    const { CallSid, CallStatus, To, From } = params;
    const tenantId = request.nextUrl.searchParams.get('tenantId');
    const greeting = decodeURIComponent(request.nextUrl.searchParams.get('greeting') || '');

    logger.info({ callSid: CallSid, status: CallStatus, tenantId }, 'Outbound call answered');

    if (!tenantId) {
      return new NextResponse(
        generateErrorTwiML('Configuration error.'),
        { headers: { 'Content-Type': 'text/xml' } }
      );
    }

    // Get tenant
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        voiceConfig: true,
        businessProfile: true,
      },
    });

    if (!tenant) {
      return new NextResponse(
        generateErrorTwiML('Configuration error.'),
        { headers: { 'Content-Type': 'text/xml' } }
      );
    }

    // Log the call
    await prisma.callLog.create({
      data: {
        tenantId,
        callSid: CallSid,
        direction: 'OUTBOUND',
        from: From || process.env.TWILIO_PHONE_NUMBER || '',
        to: To,
        status: CallStatus,
        startedAt: new Date(),
      },
    });

    // Get business name
    const businessName = tenant.businessProfile?.businessName || tenant.name || 'your service provider';
    
    // Use provided greeting or default
    const message = greeting || 
      `Hello, this is an automated call from ${businessName}.`;

    const nextUrl = `${TWILIO_WEBHOOK_URL}/api/voice/twilio/gather?tenantId=${tenantId}`;
    const callTtsProvider = tenant.voiceConfig?.callTtsProvider || 'twilio';
    let twiml: string;

    if (callTtsProvider === 'elevenlabs') {
      try {
        const apiKey = tenant.voiceConfig?.apiKey || process.env.ELEVENLABS_API_KEY;
        if (!apiKey) throw new Error('ElevenLabs API key not configured');

        const elevenlabs = new ElevenLabsService(apiKey);
        const voiceId = tenant.voiceConfig?.callVoiceId || tenant.voiceConfig?.voiceId || '21m00Tcm4TlvDq8ikWAM';

        const audio = await elevenlabs.textToSpeech(message, {
          voiceId,
          stability: tenant.voiceConfig?.stability ?? undefined,
          similarityBoost: tenant.voiceConfig?.similarityBoost ?? undefined,
        });

        const audioId = generateAudioId();
        storeAudio(audioId, audio);

        const audioUrl = `${TWILIO_WEBHOOK_URL}/api/voice/elevenlabs/audio?id=${audioId}`;
        twiml = generatePlayAudioTwiML({ audioUrl, gatherUrl: nextUrl, language: tenant.voiceConfig?.callLanguage || 'en-US' });
      } catch (err) {
        logger.warn({ error: err }, 'ElevenLabs TTS failed for outbound, falling back to Twilio');
        twiml = generateGatherTwiML({
          message,
          nextUrl,
          voiceName: tenant.voiceConfig?.callPollyVoice || 'Polly.Joanna-Neural',
          language: tenant.voiceConfig?.callLanguage || 'en-US',
        });
      }
    } else {
      twiml = generateGatherTwiML({
        message,
        nextUrl,
        voiceName: tenant.voiceConfig?.callPollyVoice || 'Polly.Joanna-Neural',
        language: tenant.voiceConfig?.callLanguage || 'en-US',
      });
    }

    return new NextResponse(twiml, {
      headers: { 'Content-Type': 'text/xml' },
    });
  } catch (error) {
    logger.error({ error }, 'Error handling outbound call');
    return new NextResponse(
      generateErrorTwiML('An error occurred.'),
      { headers: { 'Content-Type': 'text/xml' } }
    );
  }
}

function generateErrorTwiML(message: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">${message}</Say>
  <Hangup/>
</Response>`;
}
