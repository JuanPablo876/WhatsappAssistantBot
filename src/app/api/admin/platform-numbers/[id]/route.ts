import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthenticatedUserWithTenant } from '@/lib/auth-local';
import { logger } from '@/lib/bot/logger';

/**
 * GET /api/admin/platform-numbers/[id]
 * Get a specific platform phone number
 */
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
    const number = await prisma.platformPhoneNumber.findUnique({
      where: { id },
    });

    if (!number) {
      return NextResponse.json({ success: false, error: 'Number not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, number });
  } catch (error) {
    logger.error({ error }, 'Failed to get platform number');
    return NextResponse.json({ success: false, error: 'Failed to get number' }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/platform-numbers/[id]
 * Update a platform phone number (assign/unassign tenant)
 */
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
    const { tenantId, status, monthlyPrice, friendlyName } = body;

    const number = await prisma.platformPhoneNumber.findUnique({
      where: { id },
    });

    if (!number) {
      return NextResponse.json({ success: false, error: 'Number not found' }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};

    // Handle tenant assignment
    if (tenantId !== undefined) {
      if (tenantId) {
        // Assigning to a tenant
        const tenant = await prisma.tenant.findUnique({
          where: { id: tenantId },
        });
        if (!tenant) {
          return NextResponse.json({ success: false, error: 'Tenant not found' }, { status: 404 });
        }

        updateData.tenantId = tenantId;
        updateData.assignedAt = new Date();
        updateData.status = 'ASSIGNED';

        // Update the tenant's WhatsApp config to use this number
        await prisma.whatsappConfig.upsert({
          where: { tenantId },
          create: {
            tenantId,
            setupType: 'RENT_NUMBER',
            channel: 'CLOUD_API',
            platformPhoneNumberId: id,
            isActive: true,
          },
          update: {
            setupType: 'RENT_NUMBER',
            platformPhoneNumberId: id,
            // Clear any BYOP credentials
            twilioAccountSid: null,
            twilioAuthToken: null,
            twilioPhoneNumber: null,
            isActive: true,
          },
        });

        logger.info({ 
          phoneNumber: number.phoneNumber,
          tenantId,
          adminId: authResult.user.id,
        }, 'Platform number assigned to tenant');
      } else {
        // Unassigning from tenant
        if (number.tenantId) {
          // Clear the tenant's WhatsApp config reference
          await prisma.whatsappConfig.updateMany({
            where: { 
              tenantId: number.tenantId,
              platformPhoneNumberId: id,
            },
            data: {
              platformPhoneNumberId: null,
              isActive: false,
            },
          });
        }

        updateData.tenantId = null;
        updateData.assignedAt = null;
        updateData.status = 'AVAILABLE';

        logger.info({ 
          phoneNumber: number.phoneNumber,
          previousTenantId: number.tenantId,
          adminId: authResult.user.id,
        }, 'Platform number unassigned');
      }
    }

    if (status !== undefined) {
      updateData.status = status;
    }

    if (monthlyPrice !== undefined) {
      updateData.monthlyPrice = monthlyPrice;
    }

    if (friendlyName !== undefined) {
      updateData.friendlyName = friendlyName;
    }

    await prisma.platformPhoneNumber.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error({ error }, 'Failed to update platform number');
    return NextResponse.json({ success: false, error: 'Failed to update number' }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/platform-numbers/[id]
 * Delete a platform phone number
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await getAuthenticatedUserWithTenant();
    if (!authResult.user || authResult.user.role !== 'ADMIN') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    const { id } = await params;
    const number = await prisma.platformPhoneNumber.findUnique({
      where: { id },
    });

    if (!number) {
      return NextResponse.json({ success: false, error: 'Number not found' }, { status: 404 });
    }

    if (number.status === 'ASSIGNED' && number.tenantId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Cannot delete an assigned number. Unassign it first.' 
      }, { status: 400 });
    }

    await prisma.platformPhoneNumber.delete({
      where: { id },
    });

    logger.info({ 
      phoneNumber: number.phoneNumber,
      twilioSid: number.twilioSid,
      adminId: authResult.user.id,
    }, 'Platform number deleted');

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error({ error }, 'Failed to delete platform number');
    return NextResponse.json({ success: false, error: 'Failed to delete number' }, { status: 500 });
  }
}
