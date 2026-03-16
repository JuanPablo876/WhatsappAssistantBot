import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/bot/logger';
import { generateGatherTwiML, generatePlayAudioTwiML } from '@/lib/voice/twilio';
import { complete } from '@/lib/bot/ai-provider';
import { ElevenLabsService } from '@/lib/voice/elevenlabs';
import { storeAudio, generateAudioId } from '@/lib/voice/audio-cache';

const TWILIO_WEBHOOK_URL = process.env.TWILIO_WEBHOOK_URL || 'https://iatransmisor.com';

// Conversation context cache (in-memory, for demo - use Redis in production)
const conversationContext = new Map<string, Array<{ role: string; content: string }>>();

/**
 * POST /api/voice/twilio/gather
 * Handles speech input from caller and generates AI response
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const params: Record<string, string> = {};
    formData.forEach((value, key) => {
      params[key] = value.toString();
    });

    const { CallSid, SpeechResult, Confidence } = params;
    const tenantId = request.nextUrl.searchParams.get('tenantId');

    logger.info({ 
      callSid: CallSid, 
      speech: SpeechResult, 
      confidence: Confidence,
      tenantId 
    }, 'Speech input received');

    if (!tenantId) {
      return new NextResponse(
        generateErrorTwiML('Configuration error.'),
        { headers: { 'Content-Type': 'text/xml' } }
      );
    }

    // Get tenant with voice config and business profile
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        voiceConfig: true,
        businessProfile: true,
      },
    });

    if (!tenant || !tenant.voiceConfig) {
      return new NextResponse(
        generateErrorTwiML('This service is not configured.'),
        { headers: { 'Content-Type': 'text/xml' } }
      );
    }

    // If no speech detected
    if (!SpeechResult) {
      return new NextResponse(
        generateGatherTwiML({
          message: "I didn't catch that. Could you please repeat?",
          nextUrl: `${TWILIO_WEBHOOK_URL}/api/voice/twilio/gather?tenantId=${tenantId}`,
          language: tenant.voiceConfig.callLanguage || 'en-US',
        }),
        { headers: { 'Content-Type': 'text/xml' } }
      );
    }

    // Check for end-call phrases
    const endPhrases = ['goodbye', 'bye', 'hang up', 'end call', 'that\'s all', 'thank you goodbye'];
    if (endPhrases.some(phrase => SpeechResult.toLowerCase().includes(phrase))) {
      // Update call log
      await prisma.callLog.updateMany({
        where: { callSid: CallSid },
        data: { 
          status: 'completed',
          endedAt: new Date(),
        },
      });

      conversationContext.delete(CallSid);

      return new NextResponse(
        generateGatherTwiML({
          message: 'Thank you for calling. Goodbye!',
          nextUrl: '',
          language: tenant.voiceConfig.callLanguage || 'en-US',
          endCall: true,
        }),
        { headers: { 'Content-Type': 'text/xml' } }
      );
    }

    // Get or create conversation context
    let context = conversationContext.get(CallSid) || [];
    
    // Get business name from profile or tenant name
    const businessName = tenant.businessProfile?.businessName || tenant.name || 'the business';
    
    // Build system prompt for the call
    const systemPrompt = tenant.voiceConfig.callSystemPrompt || 
      `You are a helpful AI phone assistant for ${businessName}. 
       Keep responses brief and conversational - suitable for phone calls.
       Be friendly and helpful. If you don't know something, say so.
       ${tenant.businessProfile?.systemPrompt || ''}`;

    // Add user message to context
    context.push({ role: 'user', content: SpeechResult });

    // Generate AI response
    const messages = [
      { role: 'system' as const, content: systemPrompt },
      ...context.map(m => ({ 
        role: m.role as 'user' | 'assistant', 
        content: m.content 
      })),
    ];

    const result = await complete({
      messages,
      temperature: 0.7,
      maxTokens: 150, // Keep responses short for phone
    });

    const aiResponse = result.message.content || "I'm sorry, I couldn't process that.";

    // Add AI response to context
    context.push({ role: 'assistant', content: aiResponse });
    
    // Keep context reasonable size (last 10 exchanges)
    if (context.length > 20) {
      context = context.slice(-20);
    }
    conversationContext.set(CallSid, context);

    // Log the exchange
    await prisma.callLog.updateMany({
      where: { callSid: CallSid },
      data: { 
        transcript: JSON.stringify(context),
      },
    });

    // Check which TTS provider to use for calls
    const callTtsProvider = tenant.voiceConfig.callTtsProvider || 'twilio';
    const nextUrl = `${TWILIO_WEBHOOK_URL}/api/voice/twilio/gather?tenantId=${tenantId}`;
    let twiml: string;

    if (callTtsProvider === 'elevenlabs') {
      // Use ElevenLabs for higher quality voice
      try {
        const apiKey = tenant.voiceConfig.apiKey || process.env.ELEVENLABS_API_KEY;
        if (!apiKey) {
          throw new Error('ElevenLabs API key not configured');
        }

        const elevenlabs = new ElevenLabsService(apiKey);
        const voiceId = tenant.voiceConfig.callVoiceId || tenant.voiceConfig.voiceId || '21m00Tcm4TlvDq8ikWAM';
        
        // Generate audio
        const audio = await elevenlabs.textToSpeech(aiResponse, {
          voiceId,
          stability: tenant.voiceConfig.stability,
          similarityBoost: tenant.voiceConfig.similarityBoost,
        });

        // Store in shared cache for serving
        const audioId = generateAudioId();
        storeAudio(audioId, audio);

        // Use Play TwiML with audio URL
        const audioUrl = `${TWILIO_WEBHOOK_URL}/api/voice/elevenlabs/audio?id=${audioId}`;
        twiml = generatePlayAudioTwiML({
          audioUrl,
          gatherUrl: nextUrl,
          language: tenant.voiceConfig.callLanguage || 'en-US',
        });

        logger.info({ audioId, ttsProvider: 'elevenlabs' }, 'Using ElevenLabs TTS for call');
      } catch (error) {
        // Fallback to Twilio TTS on error
        logger.error({ error }, 'ElevenLabs TTS failed, falling back to Twilio');
        twiml = generateGatherTwiML({
          message: aiResponse,
          nextUrl,
          language: tenant.voiceConfig.callLanguage || 'en-US',
        });
      }
    } else {
      // Use Twilio's built-in TTS (Polly) with Neural voice
      const voiceName = tenant.voiceConfig.callPollyVoice || 'Polly.Joanna-Neural';
      twiml = generateGatherTwiML({
        message: aiResponse,
        nextUrl,
        language: tenant.voiceConfig.callLanguage || 'en-US',
        voiceName,
      });
    }

    return new NextResponse(twiml, {
      headers: { 'Content-Type': 'text/xml' },
    });
  } catch (error) {
    logger.error({ error }, 'Error handling speech gather');
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
