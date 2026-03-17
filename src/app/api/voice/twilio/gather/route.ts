import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/bot/logger';
import { generateGatherTwiML, generatePlayAudioTwiML } from '@/lib/voice/twilio';
import { AgentService } from '@/lib/bot/agent-service';
import { ConversationService } from '@/lib/bot/conversation-service';
import { ElevenLabsService } from '@/lib/voice/elevenlabs';
import { storeAudio, generateAudioId } from '@/lib/voice/audio-cache';

const TWILIO_WEBHOOK_URL = process.env.TWILIO_WEBHOOK_URL || 'https://iatransmisor.com';
const conversationService = new ConversationService();

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
      include: { voiceConfig: true, businessProfile: true },
    });

    if (!tenant || !tenant.voiceConfig) {
      return new NextResponse(
        generateErrorTwiML('This service is not configured.', tenantId),
        { headers: { 'Content-Type': 'text/xml' } }
      );
    }

    const lang = tenant.voiceConfig.callLanguage || 'en-US';
    const isSpanish = lang.startsWith('es');
    const nextUrl = `${TWILIO_WEBHOOK_URL}/api/voice/twilio/gather?tenantId=${tenantId}`;

    // Build speech hints from tenant's business context (service names, business name)
    const speechHints = await buildSpeechHints(tenantId, tenant.businessProfile?.businessName);

    // If no speech detected
    if (!SpeechResult) {
      return new NextResponse(
        generateGatherTwiML({
          message: isSpanish ? 'No escuché eso. ¿Puede repetirlo por favor?' : "I didn't catch that. Could you please repeat?",
          nextUrl,
          language: lang,
          speechHints,
        }),
        { headers: { 'Content-Type': 'text/xml' } }
      );
    }

    // Low-confidence recognition — ask to repeat instead of misunderstanding
    const confidence = parseFloat(Confidence || '1');
    if (confidence < 0.4) {
      logger.warn({ callSid: CallSid, speech: SpeechResult, confidence }, 'Low-confidence speech — re-prompting');
      return new NextResponse(
        generateGatherTwiML({
          message: isSpanish ? 'Disculpe, no entendí bien. ¿Podría repetirlo?' : "I'm sorry, I didn't quite get that. Could you repeat?",
          nextUrl,
          language: lang,
          speechHints,
        }),
        { headers: { 'Content-Type': 'text/xml' } }
      );
    }

    // Check for end-call phrases
    const endPhrases = ['goodbye', 'bye', 'hang up', 'end call', 'that\'s all', 'thank you goodbye', 'adiós', 'adios', 'hasta luego', 'eso es todo', 'gracias adiós', 'colgar'];
    if (endPhrases.some(phrase => SpeechResult.toLowerCase().includes(phrase))) {
      const farewellMsg = isSpanish ? 'Gracias por llamar. ¡Hasta luego!' : 'Thank you for calling. Goodbye!';

      // Save farewell exchange to conversation history so the agent remembers it
      try {
        const { conversationId } = await conversationService.getOrCreateConversation(tenantId, From || 'unknown', 'phone');
        await conversationService.saveMessage(conversationId, 'user', SpeechResult);
        await conversationService.saveMessage(conversationId, 'assistant', farewellMsg);
      } catch (err) {
        logger.error({ err }, 'Failed to save farewell to conversation');
      }

      // Append farewell to cumulative transcript and finalize call log
      await appendTranscript(CallSid, SpeechResult, farewellMsg);
      await prisma.callLog.updateMany({
        where: { callSid: CallSid },
        data: { status: 'completed', endedAt: new Date() },
      });

      return new NextResponse(
        generateGatherTwiML({
          message: farewellMsg,
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

    // Append turn to cumulative transcript on CallLog
    await appendTranscript(CallSid, SpeechResult, responseText);

    // ── Render response via TTS ────────────────────────────
    const callTtsProvider = tenant.voiceConfig.callTtsProvider || 'twilio';
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
          speechHints,
        });

        logger.info({ audioId, ttsProvider: 'elevenlabs' }, 'Using ElevenLabs TTS for call');
      } catch (error) {
        logger.error({ error }, 'ElevenLabs TTS failed, falling back to Twilio');
        twiml = generateGatherTwiML({ message: responseText, nextUrl, language: callLanguage, speechHints });
      }
    } else {
      const voiceName = tenant.voiceConfig.callPollyVoice || 'Polly.Joanna-Neural';
      twiml = generateGatherTwiML({ message: responseText, nextUrl, language: callLanguage, voiceName, speechHints });
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

function generateErrorTwiML(message: string, tenantId?: string | null): string {
  const gatherUrl = tenantId
    ? `${TWILIO_WEBHOOK_URL}/api/voice/twilio/gather?tenantId=${tenantId}`
    : `${TWILIO_WEBHOOK_URL}/api/voice/twilio/gather`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">${message}</Say>
  <Gather input="speech" action="${gatherUrl}" method="POST" speechTimeout="auto" speechModel="experimental_conversations" enhanced="true">
    <Say voice="Polly.Joanna">Please try again.</Say>
  </Gather>
</Response>`;
}

/**
 * Build speech recognition hints from the tenant's business context.
 * Hints improve recognition accuracy for domain-specific vocabulary.
 */
async function buildSpeechHints(tenantId: string, businessName?: string | null): Promise<string[]> {
  const hints: string[] = [];

  if (businessName) hints.push(businessName);

  // Add service type names as hints
  try {
    const services = await prisma.serviceType.findMany({
      where: { tenantId, isActive: true },
      select: { name: true },
    });
    for (const s of services) {
      hints.push(s.name);
    }
  } catch { /* ignore */ }

  // Common appointment/scheduling terms
  hints.push('appointment', 'reservation', 'schedule', 'cancel', 'reschedule', 'available');
  hints.push('cita', 'reservación', 'cancelar', 'reagendar', 'disponible');

  return hints;
}

/**
 * Append a user/assistant turn to the cumulative JSON transcript on CallLog.
 * Format: [{ role, content, timestamp }, ...]
 */
async function appendTranscript(callSid: string, userText: string, assistantText: string) {
  try {
    const callLog = await prisma.callLog.findUnique({ where: { callSid } });
    let transcript: { role: string; content: string; timestamp: string }[] = [];

    if (callLog?.transcript) {
      try { transcript = JSON.parse(callLog.transcript); } catch { transcript = []; }
    }

    const now = new Date().toISOString();
    transcript.push({ role: 'user', content: userText, timestamp: now });
    transcript.push({ role: 'assistant', content: assistantText, timestamp: now });

    await prisma.callLog.updateMany({
      where: { callSid },
      data: { transcript: JSON.stringify(transcript) },
    });
  } catch (err) {
    logger.error({ err, callSid }, 'Failed to append call transcript');
  }
}
