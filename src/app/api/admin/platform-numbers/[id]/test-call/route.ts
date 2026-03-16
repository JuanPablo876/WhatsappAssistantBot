import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthenticatedUserWithTenant } from '@/lib/auth-local';
import { logger } from '@/lib/bot/logger';
import Twilio from 'twilio';

const TWILIO_WEBHOOK_URL = process.env.TWILIO_WEBHOOK_URL || 'https://assistant.iatransmisor.com';

/**
 * POST /api/admin/platform-numbers/[id]/test-call
 * Place a test call from a platform number to verify configuration
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await getAuthenticatedUserWithTenant();
    if (!authResult.user || authResult.user.role !== 'ADMIN') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();
    const { testPhoneNumber } = body;

    if (!testPhoneNumber) {
      return NextResponse.json({ 
        success: false, 
        error: 'Test phone number is required' 
      }, { status: 400 });
    }

    // Get the platform number
    const platformNumber = await prisma.platformPhoneNumber.findUnique({
      where: { id },
    });

    if (!platformNumber) {
      return NextResponse.json({ 
        success: false, 
        error: 'Platform number not found' 
      }, { status: 404 });
    }

    // Get Twilio credentials from environment (our platform account)
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;

    if (!accountSid || !authToken) {
      return NextResponse.json({ 
        success: false, 
        error: 'Twilio credentials not configured in environment' 
      }, { status: 500 });
    }

    // Initialize Twilio client
    const client = Twilio(accountSid, authToken);

    // Normalize phone numbers
    const fromNumber = platformNumber.phoneNumber;
    const toNumber = testPhoneNumber.startsWith('+') 
      ? testPhoneNumber 
      : `+${testPhoneNumber.replace(/\D/g, '')}`;

    logger.info({ 
      platformNumberId: id,
      from: fromNumber, 
      to: toNumber,
      adminId: authResult.user.id,
    }, 'Initiating test call');

    try {
      // Make the test call
      const call = await client.calls.create({
        to: toNumber,
        from: fromNumber,
        twiml: `
          <Response>
            <Say voice="Polly.Joanna">
              This is a test call from your WhatsApp Assistant Bot platform.
              Phone number ${fromNumber.split('').join(' ')} is working correctly.
              Goodbye!
            </Say>
            <Hangup/>
          </Response>
        `,
        statusCallback: `${TWILIO_WEBHOOK_URL}/api/voice/twilio/status`,
        statusCallbackEvent: ['completed'],
        statusCallbackMethod: 'POST',
        timeout: 30,
      });

      logger.info({ 
        callSid: call.sid, 
        status: call.status,
        from: fromNumber,
        to: toNumber,
      }, 'Test call initiated successfully');

      return NextResponse.json({ 
        success: true, 
        callSid: call.sid,
        status: call.status,
        message: `Test call initiated from ${fromNumber} to ${toNumber}`,
      });

    } catch (twilioError: any) {
      logger.error({ 
        error: twilioError,
        code: twilioError.code,
        from: fromNumber,
        to: toNumber,
      }, 'Twilio test call failed');

      // Return friendly error messages for common issues
      let errorMessage = 'Failed to place test call';
      
      if (twilioError.code === 21211) {
        errorMessage = `Invalid "To" phone number: ${toNumber}`;
      } else if (twilioError.code === 21212) {
        errorMessage = `Invalid "From" phone number: ${fromNumber}. Make sure it's a valid Twilio number.`;
      } else if (twilioError.code === 21214) {
        errorMessage = `The "To" phone number ${toNumber} is not reachable`;
      } else if (twilioError.code === 21608) {
        errorMessage = `The phone number ${fromNumber} is not verified or doesn't have calling enabled`;
      } else if (twilioError.code === 21215) {
        errorMessage = `Geographic permission: Your Twilio account cannot call ${toNumber}`;
      } else if (twilioError.message) {
        errorMessage = twilioError.message;
      }

      return NextResponse.json({ 
        success: false, 
        error: errorMessage,
        twilioCode: twilioError.code,
      }, { status: 400 });
    }

  } catch (error) {
    logger.error({ error }, 'Failed to process test call request');
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to process request' 
    }, { status: 500 });
  }
}
