import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthenticatedUserWithTenant } from '@/lib/auth-local';
import { baileysManager } from '@/lib/bot/channels/baileys';
import { processIncomingMessage } from '@/lib/bot/message-handler';
import { encrypt } from '@/lib/encryption';

export async function POST(request: Request) {
  try {
    const { activeTenant: tenant } = await getAuthenticatedUserWithTenant();
    if (!tenant) return NextResponse.json({ error: 'No tenant' }, { status: 404 });
    const body = await request.json();

    const data: Record<string, unknown> = {
      channel: body.channel || 'CLOUD_API',
      isActive: true,
    };

    // Handle setup type
    if (body.setupType) {
      data.setupType = body.setupType;
    }

    // BYOP Twilio configuration - encrypt sensitive credentials
    if (body.setupType === 'BYOP_TWILIO') {
      data.twilioAccountSid = body.twilioAccountSid; // Not sensitive
      data.twilioPhoneNumber = body.twilioPhoneNumber;
      // Only update token if a new one was provided (not masked)
      // ENCRYPT the auth token before storing
      if (body.twilioAuthToken && !body.twilioAuthToken.includes('•')) {
        data.twilioAuthToken = encrypt(body.twilioAuthToken);
      }
    }

    // BYOP Meta / Cloud API configuration - encrypt sensitive credentials
    if (body.setupType === 'BYOP_META' || body.channel === 'CLOUD_API') {
      if (body.phoneNumberId) data.phoneNumberId = body.phoneNumberId;
      if (body.businessId) data.businessId = body.businessId;
      // Only update token if a new one was provided (not masked)
      // ENCRYPT the access token before storing
      if (body.accessToken && !body.accessToken.includes('•')) {
        data.accessToken = encrypt(body.accessToken);
      }
      // ENCRYPT webhook secret if provided
      if (body.webhookSecret && !body.webhookSecret.includes('•')) {
        data.webhookSecret = encrypt(body.webhookSecret);
      }
    }

    // Baileys configuration
    if (body.channel === 'BAILEYS' || body.setupType === 'BAILEYS') {
      data.channel = 'BAILEYS';
      data.setupType = 'BAILEYS';
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
    if (body.channel === 'BAILEYS' || body.setupType === 'BAILEYS') {
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
