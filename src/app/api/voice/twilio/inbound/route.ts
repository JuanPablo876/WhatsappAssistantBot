import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/bot/logger';
import {
  generateInboundCallTwiML,
  generatePlayAudioTwiML,
  validateWebhookSignature,
  isTwilioConfigured,
} from '@/lib/voice/twilio';
import { getTenantByPhoneNumber } from '@/lib/tenant-lookup';
import { ElevenLabsService } from '@/lib/voice/elevenlabs';
import { storeAudio, generateAudioId } from '@/lib/voice/audio-cache';

const TWILIO_WEBHOOK_URL = process.env.TWILIO_WEBHOOK_URL || 'https://iatransmisor.com';

/**
 * POST /api/voice/twilio/inbound
 * Handles incoming phone calls from Twilio
 * 
 * Routing logic:
 * 1. Look up which tenant owns the "To" phone number
 * 2. For RENT_NUMBER: use our platform Twilio credentials
 * 3. For BYOP: use the client's credentials (from encrypted storage)
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const params: Record<string, string> = {};
    formData.forEach((value, key) => {
      params[key] = value.toString();
    });

    const { From, To, CallSid, CallStatus } = params;
    const timeout = request.nextUrl.searchParams.get('timeout') === 'true';

    logger.info({ from: From, to: To, callSid: CallSid, status: CallStatus }, 'Inbound call received');

    if (!isTwilioConfigured()) {
      logger.error('Twilio not configured');
      return new NextResponse(
        generateErrorTwiML('Phone service is not available. Please try again later.'),
        { headers: { 'Content-Type': 'text/xml' } }
      );
    }

    // Validate webhook signature (opt-in via env var, since Electron + tunnel breaks NODE_ENV detection)
    if (process.env.TWILIO_VALIDATE_SIGNATURES === 'true') {
      const signature = request.headers.get('X-Twilio-Signature') || '';
      const url = `${TWILIO_WEBHOOK_URL}/api/voice/twilio/inbound`;
      if (!validateWebhookSignature(signature, url, params)) {
        logger.warn({ CallSid }, 'Invalid Twilio webhook signature');
        return new NextResponse('Forbidden', { status: 403 });
      }
    }

    // Look up which tenant owns this phone number
    const tenantCredentials = await getTenantByPhoneNumber(To);
    
    if (!tenantCredentials) {
      logger.warn({ to: To }, 'No tenant found for this phone number');
      return new NextResponse(
        generateErrorTwiML('This number is not configured to receive calls.'),
        { headers: { 'Content-Type': 'text/xml' } }
      );
    }

    // Get the full tenant info
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantCredentials.tenantId },
      include: {
        voiceConfig: true,
        businessProfile: true,
      },
    });

    if (!tenant || !tenant.voiceConfig?.callsEnabled) {
      logger.warn({ tenantId: tenantCredentials.tenantId }, 'Tenant not found or calls not enabled');
      return new NextResponse(
        generateErrorTwiML('This number is not configured to receive calls.'),
        { headers: { 'Content-Type': 'text/xml' } }
      );
    }

    // Get business name
    const businessName = tenant.businessProfile?.businessName || tenant.name || 'our business';
    
    // Generate greeting based on tenant settings
    const greeting = tenant.voiceConfig?.callGreeting || 
      `Hello, thank you for calling ${businessName}. `;

    // If timeout, ask again
    if (timeout) {
      return new NextResponse(
        generateInboundCallTwiML({
          greeting: "I didn't catch that. ",
          gatherUrl: `${TWILIO_WEBHOOK_URL}/api/voice/twilio/gather?tenantId=${tenant.id}`,
          language: tenant.voiceConfig?.callLanguage || 'en-US',
          voiceName: tenant.voiceConfig?.callPollyVoice || 'Polly.Joanna-Neural',
        }),
        { headers: { 'Content-Type': 'text/xml' } }
      );
    }

    // Log the call
    await prisma.callLog.create({
      data: {
        tenantId: tenant.id,
        callSid: CallSid,
        direction: 'INBOUND',
        from: From,
        to: To,
        status: CallStatus,
        startedAt: new Date(),
      },
    });

    // Return TwiML to greet and gather speech
    const gatherUrl = `${TWILIO_WEBHOOK_URL}/api/voice/twilio/gather?tenantId=${tenant.id}`;
    const callTtsProvider = tenant.voiceConfig?.callTtsProvider || 'twilio';
    let twiml: string;

    if (callTtsProvider === 'elevenlabs') {
      try {
        const apiKey = tenant.voiceConfig?.apiKey || process.env.ELEVENLABS_API_KEY;
        if (!apiKey) throw new Error('ElevenLabs API key not configured');

        const elevenlabs = new ElevenLabsService(apiKey);
        const voiceId = tenant.voiceConfig?.callVoiceId || tenant.voiceConfig?.voiceId || '21m00Tcm4TlvDq8ikWAM';

        const helpQuestion = (tenant.voiceConfig?.callLanguage || 'en-US').startsWith('es') ? '¿En qué puedo ayudarle hoy?' : 'How can I help you today?';
        const fullGreeting = greeting + ' ' + helpQuestion;
        const audio = await elevenlabs.textToSpeech(fullGreeting, {
          voiceId,
          stability: tenant.voiceConfig?.stability ?? undefined,
          similarityBoost: tenant.voiceConfig?.similarityBoost ?? undefined,
        });

        const audioId = generateAudioId();
        storeAudio(audioId, audio);

        const audioUrl = `${TWILIO_WEBHOOK_URL}/api/voice/elevenlabs/audio?id=${audioId}`;
        logger.info({ audioId, ttsProvider: 'elevenlabs' }, 'Using ElevenLabs TTS for inbound greeting');
        twiml = generatePlayAudioTwiML({ audioUrl, gatherUrl, language: tenant.voiceConfig?.callLanguage || 'en-US' });
      } catch (err) {
        logger.warn({ error: err }, 'ElevenLabs TTS failed for inbound, falling back to Twilio');
        twiml = generateInboundCallTwiML({
          greeting,
          gatherUrl,
          language: tenant.voiceConfig?.callLanguage || 'en-US',
          voiceName: tenant.voiceConfig?.callPollyVoice || 'Polly.Joanna-Neural',
          recordCall: tenant.voiceConfig?.callRecordingEnabled || false,
          recordingStatusCallback: `${TWILIO_WEBHOOK_URL}/api/voice/twilio/status`,
        });
      }
    } else {
      twiml = generateInboundCallTwiML({
        greeting,
        gatherUrl,
        language: tenant.voiceConfig?.callLanguage || 'en-US',
        voiceName: tenant.voiceConfig?.callPollyVoice || 'Polly.Joanna-Neural',
        recordCall: tenant.voiceConfig?.callRecordingEnabled || false,
        recordingStatusCallback: `${TWILIO_WEBHOOK_URL}/api/voice/twilio/status`,
      });
    }

    return new NextResponse(twiml, {
      headers: { 'Content-Type': 'text/xml' },
    });
  } catch (error) {
    logger.error({ error }, 'Error handling inbound call');
    return new NextResponse(
      generateErrorTwiML('An error occurred. Please try again later.'),
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
