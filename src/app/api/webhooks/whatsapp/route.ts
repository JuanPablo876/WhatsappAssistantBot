import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { CloudAPIChannel } from '@/lib/bot/channels/cloud-api';
import { processIncomingMessage } from '@/lib/bot/message-handler';

/**
 * GET /api/webhooks/whatsapp?tenantId=xxx
 * Handles Meta webhook verification (hub.challenge).
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');
  const tenantId = searchParams.get('tenantId');

  if (!tenantId) {
    return NextResponse.json({ error: 'Missing tenantId' }, { status: 400 });
  }

  // Verify the token matches the tenant's stored verify token
  const config = await prisma.whatsappConfig.findUnique({
    where: { tenantId },
  });

  // Use a default verify token if none configured
  const expectedToken = config?.verifyToken || process.env.WHATSAPP_VERIFY_TOKEN || 'verify-token';

  if (mode === 'subscribe' && token === expectedToken) {
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json({ error: 'Verification failed' }, { status: 403 });
}

/**
 * POST /api/webhooks/whatsapp?tenantId=xxx
 * Receives incoming WhatsApp messages via Meta Cloud API.
 */
export async function POST(request: NextRequest) {
  const tenantId = request.nextUrl.searchParams.get('tenantId');

  if (!tenantId) {
    return NextResponse.json({ error: 'Missing tenantId' }, { status: 400 });
  }

  // Always respond 200 immediately to Meta
  const body = await request.json();

  // Parse messages and process asynchronously
  const messages = CloudAPIChannel.parseWebhookPayload(body, tenantId);

  // Process each message (fire and forget — Meta expects fast 200)
  for (const msg of messages) {
    processIncomingMessage(msg).catch((err) => {
      console.error('Error processing webhook message:', err);
    });
  }

  return NextResponse.json({ status: 'ok' });
}
