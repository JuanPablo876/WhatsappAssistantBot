import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/bot/logger';
import { analyzeCallTranscript } from '@/lib/voice/voice-intelligence';

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
      recordingUrl: RecordingUrl,
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

    // Run voice intelligence analysis when call completes
    if (CallStatus === 'completed') {
      // Run analysis in background (don't block the webhook response)
      runCallAnalysis(CallSid).catch(err => 
        logger.error({ error: err, callSid: CallSid }, 'Background call analysis failed')
      );
    }

    // Return empty 200 response
    return new NextResponse(null, { status: 200 });
  } catch (error) {
    logger.error({ error }, 'Error handling call status');
    return new NextResponse(null, { status: 500 });
  }
}

/**
 * Run AI analysis on completed call transcript
 */
async function runCallAnalysis(callSid: string): Promise<void> {
  try {
    // Get call log with transcript
    const callLog = await prisma.callLog.findUnique({
      where: { callSid },
      include: {
        voiceConfig: {
          include: {
            tenant: {
              include: {
                businessProfile: true,
              },
            },
          },
        },
      },
    });

    if (!callLog || !callLog.transcript) {
      logger.info({ callSid }, 'No transcript available for analysis');
      return;
    }

    // Parse transcript
    let transcript: Array<{ role: string; content: string }>;
    try {
      transcript = JSON.parse(callLog.transcript);
    } catch {
      logger.warn({ callSid }, 'Could not parse transcript for analysis');
      return;
    }

    if (transcript.length < 2) {
      logger.info({ callSid }, 'Transcript too short for meaningful analysis');
      return;
    }

    // Run analysis
    const businessName = callLog.voiceConfig?.tenant?.businessProfile?.businessName || 
                         callLog.voiceConfig?.tenant?.name || 'Unknown';
    
    const analysis = await analyzeCallTranscript(transcript, {
      businessName,
      callDuration: callLog.duration ?? undefined,
      callerPhone: callLog.from,
    });

    // Save analysis
    await prisma.callLog.update({
      where: { callSid },
      data: {
        analysis: JSON.stringify(analysis),
      },
    });

    logger.info({ 
      callSid, 
      sentiment: analysis.sentiment,
      resolution: analysis.resolutionStatus,
    }, 'Call analysis completed and saved');
  } catch (error) {
    logger.error({ error, callSid }, 'Failed to run call analysis');
    throw error;
  }
}
