import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthenticatedUserWithTenant } from '@/lib/auth-local';
import { baileysManager } from '@/lib/bot/channels/baileys';
import { processIncomingMessage } from '@/lib/bot/message-handler';

export async function POST(request: Request) {
  try {
    const { activeTenant: tenant } = await getAuthenticatedUserWithTenant();
    if (!tenant) return NextResponse.json({ error: 'No tenant' }, { status: 404 });
    const body = await request.json();

    const data: Record<string, unknown> = {
      channel: body.channel,
      isActive: true,
    };

    if (body.channel === 'CLOUD_API') {
      data.phoneNumberId = body.phoneNumberId;
      data.businessId = body.businessId;
      // Only update token if a new one was provided (not masked)
      if (body.accessToken && !body.accessToken.includes('•')) {
        data.accessToken = body.accessToken;
      }
    }

    await prisma.whatsappConfig.upsert({
      where: { tenantId: tenant.id },
      update: data,
      create: {
        tenantId: tenant.id,
        ...(data as any),
      },
    });

    // Start Baileys connection if channel is BAILEYS
    if (body.channel === 'BAILEYS') {
      const freshStart = Boolean(body.freshStart);

      // If phone number provided, use pairing code instead of QR
      if (body.phoneNumber) {
        const cleanPhone = body.phoneNumber.replace(/\D/g, '');
        if (cleanPhone) {
          baileysManager.setPendingPairingPhone(tenant.id, cleanPhone);
        }
      } else {
        baileysManager.clearPendingPairingPhone(tenant.id);
      }

      baileysManager.startConnection(tenant.id, processIncomingMessage, freshStart).catch((error) => {
        console.error('Failed to start Baileys connection:', error);
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('WhatsApp configure error:', error);
    return NextResponse.json({ error: 'Failed to configure' }, { status: 500 });
  }
}
