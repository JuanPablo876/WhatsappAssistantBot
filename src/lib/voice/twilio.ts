import Twilio from 'twilio';
import { logger } from '../bot/logger';

const VoiceResponse = Twilio.twiml.VoiceResponse;

// Default voice settings
const DEFAULT_VOICE = 'Polly.Joanna';
const DEFAULT_LANGUAGE = 'en-US';

/**
 * Twilio phone call integration for AI-powered voice calls.
 * Supports:
 * - Outbound calls with AI voice
 * - Inbound call handling with webhooks
 * - Real-time conversation with AI
 */

// Environment variables
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;
const TWILIO_WEBHOOK_URL = process.env.TWILIO_WEBHOOK_URL || 'https://iatransmisor.com';

// Twilio client (lazy init)
let twilioClient: Twilio.Twilio | null = null;

function getClient(): Twilio.Twilio {
  if (!twilioClient) {
    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
      throw new Error('Twilio credentials not configured');
    }
    twilioClient = Twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  }
  return twilioClient;
}

/**
 * Check if Twilio is configured and ready
 */
export function isTwilioConfigured(): boolean {
  return !!(TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_PHONE_NUMBER);
}

/**
 * Get the configured Twilio phone number
 */
export function getTwilioPhoneNumber(): string | undefined {
  return TWILIO_PHONE_NUMBER;
}

/**
 * Make an outbound call with AI voice
 */
export async function makeOutboundCall(
  to: string,
  options: {
    tenantId: string;
    greeting?: string;
    recordCall?: boolean;
    timeout?: number;
  }
): Promise<{ callSid: string; status: string }> {
  const client = getClient();
  
  if (!TWILIO_PHONE_NUMBER) {
    throw new Error('TWILIO_PHONE_NUMBER not configured');
  }

  // Normalize phone number
  const toNumber = to.startsWith('+') ? to : `+${to}`;
  
  logger.info({ to: toNumber, tenantId: options.tenantId }, 'Initiating outbound call');

  try {
    const call = await client.calls.create({
      to: toNumber,
      from: TWILIO_PHONE_NUMBER,
      url: `${TWILIO_WEBHOOK_URL}/api/voice/twilio/outbound?tenantId=${options.tenantId}&greeting=${encodeURIComponent(options.greeting || '')}`,
      statusCallback: `${TWILIO_WEBHOOK_URL}/api/voice/twilio/status`,
      statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
      statusCallbackMethod: 'POST',
      record: options.recordCall ?? false,
      timeout: options.timeout ?? 30,
    });

    logger.info({ callSid: call.sid, status: call.status }, 'Outbound call initiated');
    
    return {
      callSid: call.sid,
      status: call.status,
    };
  } catch (error) {
    logger.error({ error, to: toNumber }, 'Failed to initiate outbound call');
    throw error;
  }
}

/**
 * Generate TwiML for answering an inbound call
 */
export function generateInboundCallTwiML(options: {
  greeting: string;
  gatherUrl: string;
  voiceName?: string;
  language?: string;
}): string {
  const response = new VoiceResponse();
  const voice = (options.voiceName || DEFAULT_VOICE) as any;
  const language = (options.language || DEFAULT_LANGUAGE) as any;
  
  // Say the greeting with natural voice
  response.say({ voice, language }, options.greeting);

  // Gather speech input
  const gather = response.gather({
    input: ['speech'],
    action: options.gatherUrl,
    method: 'POST',
    speechTimeout: 'auto',
    language,
  });

  gather.say({ voice, language }, 'How can I help you today?');

  // If no input, redirect
  response.redirect(`${TWILIO_WEBHOOK_URL}/api/voice/twilio/inbound?timeout=true`);

  return response.toString();
}

/**
 * Generate TwiML to speak a message and gather response
 */
export function generateGatherTwiML(options: {
  message: string;
  nextUrl: string;
  voiceName?: string;
  language?: string;
  endCall?: boolean;
}): string {
  const response = new VoiceResponse();
  const voice = (options.voiceName || DEFAULT_VOICE) as any;
  const language = (options.language || DEFAULT_LANGUAGE) as any;

  if (options.endCall) {
    response.say({ voice, language }, options.message);
    response.hangup();
  } else {
    const gather = response.gather({
      input: ['speech'],
      action: options.nextUrl,
      method: 'POST',
      speechTimeout: 'auto',
      language,
    });

    gather.say({ voice, language }, options.message);

    response.redirect(options.nextUrl);
  }

  return response.toString();
}

/**
 * Generate TwiML to play an audio URL (for ElevenLabs generated audio)
 */
export function generatePlayAudioTwiML(options: {
  audioUrl: string;
  gatherUrl: string;
  language?: string;
}): string {
  const response = new VoiceResponse();
  const language = (options.language || DEFAULT_LANGUAGE) as any;

  const gather = response.gather({
    input: ['speech'],
    action: options.gatherUrl,
    method: 'POST',
    speechTimeout: 'auto',
    language,
  });

  gather.play(options.audioUrl);

  response.redirect(options.gatherUrl);

  return response.toString();
}

/**
 * Generate TwiML to end call with message
 */
export function generateHangupTwiML(message: string, voiceName?: string): string {
  const response = new VoiceResponse();
  response.say({
    voice: (voiceName || DEFAULT_VOICE) as any,
    language: DEFAULT_LANGUAGE as any,
  }, message);
  response.hangup();
  return response.toString();
}

/**
 * Get call details
 */
export async function getCallDetails(callSid: string): Promise<{
  status: string;
  duration: string;
  direction: string;
  from: string;
  to: string;
  startTime: Date | null;
  endTime: Date | null;
}> {
  const client = getClient();
  const call = await client.calls(callSid).fetch();
  
  return {
    status: call.status,
    duration: call.duration || '0',
    direction: call.direction,
    from: call.from,
    to: call.to,
    startTime: call.startTime,
    endTime: call.endTime,
  };
}

/**
 * End an active call
 */
export async function endCall(callSid: string): Promise<void> {
  const client = getClient();
  await client.calls(callSid).update({ status: 'completed' });
  logger.info({ callSid }, 'Call ended');
}

/**
 * Validate Twilio webhook signature
 */
export function validateWebhookSignature(
  signature: string,
  url: string,
  params: Record<string, string>
): boolean {
  if (!TWILIO_AUTH_TOKEN) {
    logger.warn('Cannot validate webhook - TWILIO_AUTH_TOKEN not set');
    return false;
  }
  
  return Twilio.validateRequest(
    TWILIO_AUTH_TOKEN,
    signature,
    url,
    params
  );
}

/**
 * Get list of available Twilio phone numbers
 */
export async function listPhoneNumbers(): Promise<Array<{
  phoneNumber: string;
  friendlyName: string;
  capabilities: { voice: boolean; sms: boolean };
}>> {
  const client = getClient();
  const numbers = await client.incomingPhoneNumbers.list({ limit: 20 });
  
  return numbers.map(n => ({
    phoneNumber: n.phoneNumber,
    friendlyName: n.friendlyName,
    capabilities: {
      voice: n.capabilities.voice,
      sms: n.capabilities.sms,
    },
  }));
}

/**
 * Update webhook URLs for a phone number
 */
export async function configurePhoneNumberWebhooks(
  phoneNumberSid: string,
  options: {
    voiceUrl?: string;
    voiceFallbackUrl?: string;
    statusCallback?: string;
  }
): Promise<void> {
  const client = getClient();
  
  await client.incomingPhoneNumbers(phoneNumberSid).update({
    voiceUrl: options.voiceUrl,
    voiceFallbackUrl: options.voiceFallbackUrl,
    statusCallback: options.statusCallback,
    voiceMethod: 'POST',
  });

  logger.info({ phoneNumberSid }, 'Phone number webhooks configured');
}
