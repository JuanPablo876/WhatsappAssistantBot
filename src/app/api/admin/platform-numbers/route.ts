import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthenticatedUserWithTenant } from '@/lib/auth-local';
import { logger } from '@/lib/bot/logger';

/**
 * GET /api/admin/platform-numbers
 * List all platform phone numbers
 */
export async function GET() {
  try {
    const authResult = await getAuthenticatedUserWithTenant();
    if (!authResult.user || authResult.user.role !== 'ADMIN') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    const numbers = await prisma.platformPhoneNumber.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ success: true, numbers });
  } catch (error) {
    logger.error({ error }, 'Failed to list platform numbers');
    return NextResponse.json({ success: false, error: 'Failed to list numbers' }, { status: 500 });
  }
}

/**
 * POST /api/admin/platform-numbers
 * Add a new platform phone number
 */
export async function POST(req: NextRequest) {
  try {
    const authResult = await getAuthenticatedUserWithTenant();
    if (!authResult.user || authResult.user.role !== 'ADMIN') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    const body = await req.json();
    const { 
      phoneNumber, 
      twilioSid, 
      countryCode, 
      areaCode, 
      friendlyName,
      monthlyPrice,
      twilioCost,
    } = body;

    if (!phoneNumber || !countryCode) {
      return NextResponse.json({ 
        success: false, 
        error: 'Phone number and country code are required' 
      }, { status: 400 });
    }

    // Normalize phone number (ensure + prefix, remove spaces/dashes)
    const normalizedNumber = (phoneNumber.startsWith('+') ? phoneNumber : `+${phoneNumber}`)
      .replace(/[\s\-\(\)]/g, '');

    // Auto-generate twilioSid if not provided
    const finalTwilioSid = twilioSid || `PN_${Date.now()}_${normalizedNumber.slice(-4)}`;

    // Check if number already exists
    const existing = await prisma.platformPhoneNumber.findFirst({
      where: { phoneNumber: normalizedNumber },
    });

    if (existing) {
      return NextResponse.json({ 
        success: false, 
        error: 'Phone number already exists' 
      }, { status: 400 });
    }

    const number = await prisma.platformPhoneNumber.create({
      data: {
        phoneNumber: normalizedNumber,
        twilioSid: finalTwilioSid,
        countryCode,
        areaCode: areaCode || null,
        friendlyName: friendlyName || null,
        monthlyPrice: monthlyPrice || 0,
        twilioCost: twilioCost || 0,
        status: 'AVAILABLE',
      },
    });

    logger.info({ 
      phoneNumber: normalizedNumber,
      twilioSid: finalTwilioSid,
      adminId: authResult.user.id,
    }, 'Platform phone number added');

    return NextResponse.json({ success: true, number });
  } catch (error) {
    logger.error({ error }, 'Failed to add platform number');
    return NextResponse.json({ success: false, error: 'Failed to add number' }, { status: 500 });
  }
}
