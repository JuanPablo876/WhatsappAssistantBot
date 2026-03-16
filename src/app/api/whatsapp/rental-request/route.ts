import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthenticatedUserWithTenant } from '@/lib/auth-local';
import { logger } from '@/lib/bot/logger';

export async function POST(req: NextRequest) {
  try {
    const authResult = await getAuthenticatedUserWithTenant();
    if (!authResult.user) {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }
    
    const tenant = authResult.activeTenant;
    if (!tenant) {
      return NextResponse.json({ success: false, error: 'No tenant found' }, { status: 400 });
    }

    const body = await req.json();
    const { countryCode, preferredArea, purpose } = body;

    if (!countryCode) {
      return NextResponse.json({ success: false, error: 'Country code is required' }, { status: 400 });
    }

    // Check for existing pending request
    const existingRequest = await prisma.phoneRentalRequest.findFirst({
      where: {
        tenantId: tenant.id,
        status: { in: ['PENDING', 'PROCESSING'] },
      },
    });

    if (existingRequest) {
      return NextResponse.json({ 
        success: false, 
        error: 'You already have a pending request' 
      }, { status: 400 });
    }

    // Create the rental request
    const request = await prisma.phoneRentalRequest.create({
      data: {
        tenantId: tenant.id,
        countryCode,
        preferredArea: preferredArea || null,
        purpose: purpose || null,
        status: 'PENDING',
      },
    });

    // Update WhatsApp config to show rental setup type
    await prisma.whatsappConfig.upsert({
      where: { tenantId: tenant.id },
      create: {
        tenantId: tenant.id,
        setupType: 'RENT_NUMBER',
        channel: 'CLOUD_API',
        isActive: false,
      },
      update: {
        setupType: 'RENT_NUMBER',
      },
    });

    // Log for admin notification
    logger.info({ 
      tenantId: tenant.id, 
      tenantName: tenant.name,
      requestId: request.id,
      countryCode,
      preferredArea,
      userId: authResult.user.id,
      userEmail: authResult.user.email,
    }, 'New phone rental request submitted');

    // TODO: Send notification to admin (email, Slack, etc.)
    // This could be:
    // - Email to admin
    // - Slack webhook
    // - Create an AdminNotification record in DB
    // - Push notification

    return NextResponse.json({ 
      success: true, 
      requestId: request.id,
      message: 'Request submitted! We will process it within 1-3 business days.',
    });

  } catch (error) {
    logger.error({ error }, 'Failed to create rental request');
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to submit request' 
    }, { status: 500 });
  }
}

// Get current rental request status
export async function GET() {
  try {
    const authResult = await getAuthenticatedUserWithTenant();
    if (!authResult.user) {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }
    
    const tenant = authResult.activeTenant;
    if (!tenant) {
      return NextResponse.json({ success: false, error: 'No tenant found' }, { status: 400 });
    }

    const request = await prisma.phoneRentalRequest.findFirst({
      where: { tenantId: tenant.id },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ 
      success: true, 
      request: request ? {
        id: request.id,
        status: request.status,
        countryCode: request.countryCode,
        preferredArea: request.preferredArea,
        assignedNumber: request.assignedNumber,
        adminNotes: request.adminNotes,
        requestedAt: request.requestedAt.toISOString(),
        processedAt: request.processedAt?.toISOString(),
        fulfilledAt: request.fulfilledAt?.toISOString(),
      } : null,
    });

  } catch (error) {
    logger.error({ error }, 'Failed to get rental request');
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to get request status' 
    }, { status: 500 });
  }
}

// Cancel a pending request
export async function DELETE() {
  try {
    const authResult = await getAuthenticatedUserWithTenant();
    if (!authResult.user) {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }
    
    const tenant = authResult.activeTenant;
    if (!tenant) {
      return NextResponse.json({ success: false, error: 'No tenant found' }, { status: 400 });
    }

    // Can only cancel PENDING requests
    const request = await prisma.phoneRentalRequest.findFirst({
      where: { 
        tenantId: tenant.id,
        status: 'PENDING',
      },
    });

    if (!request) {
      return NextResponse.json({ 
        success: false, 
        error: 'No pending request to cancel' 
      }, { status: 400 });
    }

    await prisma.phoneRentalRequest.update({
      where: { id: request.id },
      data: { status: 'CANCELLED' },
    });

    return NextResponse.json({ success: true });

  } catch (error) {
    logger.error({ error }, 'Failed to cancel rental request');
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to cancel request' 
    }, { status: 500 });
  }
}
