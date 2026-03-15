import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthenticatedUserWithTenant } from '@/lib/auth-local';

/**
 * GET /api/appointments/[id] - Get appointment details
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { activeTenant: tenant } = await getAuthenticatedUserWithTenant();
    if (!tenant) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const appointment = await prisma.appointment.findFirst({
      where: { id, tenantId: tenant.id },
      include: { contact: true, serviceType: true },
    });

    if (!appointment) {
      return NextResponse.json({ error: 'Appointment not found' }, { status: 404 });
    }

    return NextResponse.json(appointment);
  } catch (error) {
    console.error('Get appointment error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PATCH /api/appointments/[id] - Update appointment (edit, confirm, cancel)
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { activeTenant: tenant } = await getAuthenticatedUserWithTenant();
    if (!tenant) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    // Verify appointment belongs to tenant
    const existing = await prisma.appointment.findFirst({
      where: { id, tenantId: tenant.id },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Appointment not found' }, { status: 404 });
    }

    // Build update data
    const updateData: Record<string, unknown> = {};

    if (body.status !== undefined) {
      if (!['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED'].includes(body.status)) {
        return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
      }
      updateData.status = body.status;
    }

    if (body.title !== undefined) {
      updateData.title = body.title;
    }

    if (body.description !== undefined) {
      updateData.description = body.description;
    }

    if (body.startTime !== undefined) {
      updateData.startTime = new Date(body.startTime);
    }

    if (body.endTime !== undefined) {
      updateData.endTime = new Date(body.endTime);
    }

    if (body.serviceTypeId !== undefined) {
      updateData.serviceTypeId = body.serviceTypeId || null;
    }

    const updated = await prisma.appointment.update({
      where: { id },
      data: updateData,
      include: { contact: true, serviceType: true },
    });

    // TODO: Update Google Calendar event if calendarEventId exists

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Update appointment error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/appointments/[id] - Delete appointment
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { activeTenant: tenant } = await getAuthenticatedUserWithTenant();
    if (!tenant) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Verify appointment belongs to tenant
    const existing = await prisma.appointment.findFirst({
      where: { id, tenantId: tenant.id },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Appointment not found' }, { status: 404 });
    }

    await prisma.appointment.delete({ where: { id } });

    // TODO: Delete Google Calendar event if calendarEventId exists

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete appointment error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
