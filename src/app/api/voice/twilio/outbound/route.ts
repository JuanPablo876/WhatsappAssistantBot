import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/bot/logger';
import { generateGatherTwiML } from '@/lib/voice/twilio';

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

    const { CallSid, CallStatus, To } = params;
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
        from: process.env.TWILIO_PHONE_NUMBER || '',
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

    // Return TwiML to speak and gather response
    const twiml = generateGatherTwiML({
      message,
      nextUrl: `${TWILIO_WEBHOOK_URL}/api/voice/twilio/gather?tenantId=${tenantId}`,
      language: tenant.voiceConfig?.callLanguage || 'en-US',
    });

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
