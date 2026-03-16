import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/bot/logger';
import { generateGatherTwiML, generatePlayAudioTwiML } from '@/lib/voice/twilio';
import { AgentService } from '@/lib/bot/agent-service';
import { ElevenLabsService } from '@/lib/voice/elevenlabs';
import { storeAudio, generateAudioId } from '@/lib/voice/audio-cache';

const TWILIO_WEBHOOK_URL = process.env.TWILIO_WEBHOOK_URL || 'https://iatransmisor.com';

// Shared agent instance (same brain for WhatsApp + phone)
const agent = new AgentService();

/**
 * POST /api/voice/twilio/gather
 * Phone channel adapter: parses Twilio speech, delegates to AgentService,
 * renders the response via TTS/TwiML.
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const params: Record<string, string> = {};
    formData.forEach((value, key) => {
      params[key] = value.toString();
    });

    const { CallSid, SpeechResult, Confidence, From } = params;
    const tenantId = request.nextUrl.searchParams.get('tenantId');

    logger.info({ 
      callSid: CallSid, 
      speech: SpeechResult, 
      confidence: Confidence,
      from: From,
      tenantId 
    }, 'Phone speech input received');

    if (!tenantId) {
      return new NextResponse(
        generateErrorTwiML('Configuration error.'),
        { headers: { 'Content-Type': 'text/xml' } }
      );
    }

    // Get tenant voice config (for TTS settings and language)
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { voiceConfig: true },
    });

    if (!tenant || !tenant.voiceConfig) {
      return new NextResponse(
        generateErrorTwiML('This service is not configured.'),
        { headers: { 'Content-Type': 'text/xml' } }
      );
    }

    const lang = tenant.voiceConfig.callLanguage || 'en-US';
    const isSpanish = lang.startsWith('es');

    // If no speech detected
    if (!SpeechResult) {
      return new NextResponse(
        generateGatherTwiML({
          message: isSpanish ? 'No escuché eso. ¿Puede repetirlo por favor?' : "I didn't catch that. Could you please repeat?",
          nextUrl: `${TWILIO_WEBHOOK_URL}/api/voice/twilio/gather?tenantId=${tenantId}`,
          language: lang,
        }),
        { headers: { 'Content-Type': 'text/xml' } }
      );
    }

    // Check for end-call phrases
    const endPhrases = ['goodbye', 'bye', 'hang up', 'end call', 'that\'s all', 'thank you goodbye', 'adiós', 'adios', 'hasta luego', 'eso es todo', 'gracias adiós', 'colgar'];
    if (endPhrases.some(phrase => SpeechResult.toLowerCase().includes(phrase))) {
      await prisma.callLog.updateMany({
        where: { callSid: CallSid },
        data: { status: 'completed', endedAt: new Date() },
      });

      return new NextResponse(
        generateGatherTwiML({
          message: isSpanish ? 'Gracias por llamar. ¡Hasta luego!' : 'Thank you for calling. Goodbye!',
          nextUrl: '',
          language: lang,
          endCall: true,
        }),
        { headers: { 'Content-Type': 'text/xml' } }
      );
    }

    // ── Delegate to the unified agent ──────────────────────
    const aiResponse = await agent.handlePhoneMessage({
      tenantId,
      callerPhone: From || 'unknown',
      text: SpeechResult,
    });

    const callLanguage = tenant.voiceConfig.callLanguage || 'en-US';
    const fallbackMsg = callLanguage.startsWith('es') 
      ? 'Disculpe, no pude procesar eso. ¿Puede repetirlo?'
      : "I'm sorry, I couldn't process that. Could you repeat?";
    const responseText = aiResponse || fallbackMsg;

    // Update call log transcript
    await prisma.callLog.updateMany({
      where: { callSid: CallSid },
      data: { transcript: responseText },
    });

    // ── Render response via TTS ────────────────────────────
    const callTtsProvider = tenant.voiceConfig.callTtsProvider || 'twilio';
    const nextUrl = `${TWILIO_WEBHOOK_URL}/api/voice/twilio/gather?tenantId=${tenantId}`;
    let twiml: string;

    if (callTtsProvider === 'elevenlabs') {
      try {
        const apiKey = tenant.voiceConfig.apiKey || process.env.ELEVENLABS_API_KEY;
        if (!apiKey) throw new Error('ElevenLabs API key not configured');

        const elevenlabs = new ElevenLabsService(apiKey);
        const voiceId = tenant.voiceConfig.callVoiceId || tenant.voiceConfig.voiceId || '21m00Tcm4TlvDq8ikWAM';
        
        const audio = await elevenlabs.textToSpeech(responseText, {
          voiceId,
          stability: tenant.voiceConfig.stability,
          similarityBoost: tenant.voiceConfig.similarityBoost,
        });

        const audioId = generateAudioId();
        storeAudio(audioId, audio);

        const audioUrl = `${TWILIO_WEBHOOK_URL}/api/voice/elevenlabs/audio?id=${audioId}`;
        twiml = generatePlayAudioTwiML({
          audioUrl,
          gatherUrl: nextUrl,
          language: callLanguage,
        });

        logger.info({ audioId, ttsProvider: 'elevenlabs' }, 'Using ElevenLabs TTS for call');
      } catch (error) {
        logger.error({ error }, 'ElevenLabs TTS failed, falling back to Twilio');
        twiml = generateGatherTwiML({ message: responseText, nextUrl, language: callLanguage });
      }
    } else {
      const voiceName = tenant.voiceConfig.callPollyVoice || 'Polly.Joanna-Neural';
      twiml = generateGatherTwiML({ message: responseText, nextUrl, language: callLanguage, voiceName });
    }

    return new NextResponse(twiml, { headers: { 'Content-Type': 'text/xml' } });
  } catch (error) {
    logger.error({ error }, 'Error handling phone speech gather');
    return new NextResponse(
      generateErrorTwiML('I had trouble processing that. Please try again.'),
      { headers: { 'Content-Type': 'text/xml' } }
    );
  }
}

function generateErrorTwiML(message: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">${message}</Say>
  <Gather input="speech" action="${TWILIO_WEBHOOK_URL}/api/voice/twilio/gather" method="POST" speechTimeout="auto">
    <Say voice="Polly.Joanna">Please try again.</Say>
  </Gather>
</Response>`;
}
