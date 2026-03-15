import { NextResponse } from 'next/server';
import { getAuthenticatedUserWithTenant } from '@/lib/auth-local';
import { baileysManager } from '@/lib/bot/channels/baileys';
import { prisma } from '@/lib/db';
import { processIncomingMessage } from '@/lib/bot/message-handler';
import QRCode from 'qrcode';

/**
 * GET /api/whatsapp/qr
 * Returns the current QR code status and image data for Baileys connection.
 */
export async function GET() {
  try {
    const { activeTenant } = await getAuthenticatedUserWithTenant();
    
    if (!activeTenant) {
      return NextResponse.json({ error: 'No tenant found' }, { status: 404 });
    }

    const config = await (prisma as any).whatsappConfig.findUnique({
      where: { tenantId: activeTenant.id },
      select: { channel: true, isActive: true },
    });

    if (config?.channel === 'BAILEYS' && config.isActive) {
      const state = baileysManager.getConnectionState(activeTenant.id);
      if (!state.hasSocket && state.status === 'disconnected' && state.hasAuthState) {
        baileysManager.ensureConnection(activeTenant.id, processIncomingMessage).catch((error) => {
          console.error('Failed to auto-start Baileys connection:', error);
        });
      }
    }
    
    const status = baileysManager.getStatus(activeTenant.id);
    const qrData = baileysManager.getQRCode(activeTenant.id);
    const pairingData = baileysManager.getPairingCode(activeTenant.id);
    
    if (status === 'connected') {
      return NextResponse.json({
        status: 'connected',
        qrCode: null,
        pairingCode: null,
      });
    }

    if (pairingData) {
      return NextResponse.json({
        status: 'pairing',
        qrCode: null,
        pairingCode: pairingData.code,
        timestamp: pairingData.timestamp,
      });
    }
    
    if (qrData) {
      // Generate QR code as data URL for display in UI
      try {
        const qrImageUrl = await QRCode.toDataURL(qrData.qr, {
          width: 256,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#ffffff',
          },
        });
        
        return NextResponse.json({
          status: 'qr',
          qrCode: qrImageUrl,
          pairingCode: null,
          timestamp: qrData.timestamp,
        });
      } catch (qrError) {
        console.error('Error generating QR code image:', qrError);
        return NextResponse.json({
          status: 'qr',
          qrCode: null,
          pairingCode: null,
          qrRaw: qrData.qr, // Fallback: raw QR string
        });
      }
    }
    
    return NextResponse.json({
      status,
      qrCode: null,
      pairingCode: null,
    });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error getting QR status:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
