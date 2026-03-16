import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthenticatedUserWithTenant } from '@/lib/auth-local';
import { logger } from '@/lib/bot/logger';

export async function PATCH(
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
    const { status, assignedNumber, twilioSid, adminNotes, monthlyPrice } = body;

    // Find the request
    const request = await prisma.phoneRentalRequest.findUnique({
      where: { id },
    });

    if (!request) {
      return NextResponse.json({ success: false, error: 'Request not found' }, { status: 404 });
    }

    // Prepare update data
    const updateData: Record<string, unknown> = {};

    if (status) {
      updateData.status = status;
      
      if (status === 'PROCESSING' && !request.processedAt) {
        updateData.processedAt = new Date();
      }
      
      if (status === 'FULFILLED') {
        if (!assignedNumber) {
          return NextResponse.json({ 
            success: false, 
            error: 'Assigned number is required for fulfillment' 
          }, { status: 400 });
        }
        
        updateData.fulfilledAt = new Date();
        updateData.assignedNumber = assignedNumber;
        if (monthlyPrice) updateData.monthlyPrice = monthlyPrice;
        if (twilioSid) updateData.twilioNumberSid = twilioSid;

        // Create or update the PlatformPhoneNumber record
        // This tracks OUR numbers (purchased with our Twilio account)
        const platformNumber = await prisma.platformPhoneNumber.upsert({
          where: { phoneNumber: assignedNumber },
          create: {
            phoneNumber: assignedNumber,
            twilioSid: twilioSid || `PN_${Date.now()}`, // Use provided SID or generate placeholder
            countryCode: request.countryCode,
            areaCode: request.preferredArea || undefined,
            friendlyName: `Rented to tenant ${request.tenantId}`,
            tenantId: request.tenantId,
            assignedAt: new Date(),
            monthlyPrice: monthlyPrice || 0,
            status: 'ASSIGNED',
          },
          update: {
            tenantId: request.tenantId,
            assignedAt: new Date(),
            status: 'ASSIGNED',
            friendlyName: `Rented to tenant ${request.tenantId}`,
            monthlyPrice: monthlyPrice || 0,
          },
        });

        // Update the tenant's WhatsApp config to link to this platform number
        // Note: NO client credentials needed - we use OUR Twilio account
        await prisma.whatsappConfig.upsert({
          where: { tenantId: request.tenantId },
          create: {
            tenantId: request.tenantId,
            setupType: 'RENT_NUMBER',
            channel: 'CLOUD_API',
            platformPhoneNumberId: platformNumber.id,
            isActive: true,
          },
          update: {
            setupType: 'RENT_NUMBER',
            platformPhoneNumberId: platformNumber.id,
            // Clear any BYOP credentials that might have been there
            twilioAccountSid: null,
            twilioAuthToken: null,
            twilioPhoneNumber: null,
            isActive: true,
          },
        });
      }
    }

    if (adminNotes !== undefined) {
      updateData.adminNotes = adminNotes;
    }

    if (assignedNumber !== undefined) {
      updateData.assignedNumber = assignedNumber;
    }

    // Update the request
    await prisma.phoneRentalRequest.update({
      where: { id },
      data: updateData,
    });

    logger.info({ 
      requestId: id, 
      status, 
      assignedNumber,
      adminId: authResult.user.id,
    }, 'Phone rental request updated');

    return NextResponse.json({ success: true });

  } catch (error) {
    logger.error({ error }, 'Failed to update rental request');
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to update request' 
    }, { status: 500 });
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await getAuthenticatedUserWithTenant();
    if (!authResult.user || authResult.user.role !== 'ADMIN') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    const { id } = await params;
    
    const request = await prisma.phoneRentalRequest.findUnique({
      where: { id },
    });

    if (!request) {
      return NextResponse.json({ success: false, error: 'Request not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, request });

  } catch (error) {
    logger.error({ error }, 'Failed to get rental request');
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to get request' 
    }, { status: 500 });
  }
}
