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
    const { status, assignedNumber, adminNotes } = body;

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

        // Also update the tenant's WhatsApp config with the assigned number
        await prisma.whatsappConfig.upsert({
          where: { tenantId: request.tenantId },
          create: {
            tenantId: request.tenantId,
            setupType: 'RENT_NUMBER',
            channel: 'CLOUD_API',
            twilioPhoneNumber: assignedNumber,
            isActive: true,
          },
          update: {
            setupType: 'RENT_NUMBER',
            twilioPhoneNumber: assignedNumber,
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
