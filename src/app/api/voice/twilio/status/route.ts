import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/bot/logger';

/**
 * POST /api/voice/twilio/status
 * Handles call status callbacks from Twilio
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const params: Record<string, string> = {};
    formData.forEach((value, key) => {
      params[key] = value.toString();
    });

    const { 
      CallSid, 
      CallStatus, 
      CallDuration,
      From,
      To,
      Direction,
      RecordingUrl,
      RecordingSid,
    } = params;

    logger.info({ 
      callSid: CallSid, 
      status: CallStatus, 
      duration: CallDuration,
      direction: Direction,
    }, 'Call status update');

    // Update call log
    const updateData: Record<string, unknown> = {
      status: CallStatus,
    };

    if (CallDuration) {
      updateData.duration = parseInt(CallDuration, 10);
    }

    if (RecordingUrl) {
      updateData.recordingUrl = RecordingUrl;
      updateData.recordingSid = RecordingSid;
    }

    if (CallStatus === 'completed' || CallStatus === 'failed' || CallStatus === 'busy' || CallStatus === 'no-answer') {
      updateData.endedAt = new Date();
    }

    await prisma.callLog.updateMany({
      where: { callSid: CallSid },
      data: updateData,
    });

    // Return empty 200 response
    return new NextResponse(null, { status: 200 });
  } catch (error) {
    logger.error({ error }, 'Error handling call status');
    return new NextResponse(null, { status: 500 });
  }
}
