import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserWithTenant } from '@/lib/auth-local';
import { prisma } from '@/lib/db';

/**
 * PATCH /api/time-off/[id] — Update a time-off entry
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { activeTenant } = await getAuthenticatedUserWithTenant();
    if (!activeTenant) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const existing = await prisma.timeOff.findFirst({
      where: { id, tenantId: activeTenant.id },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const body = await req.json();
    const updateData: Record<string, unknown> = {};

    if (body.title !== undefined) updateData.title = body.title;
    if (body.reason !== undefined) updateData.reason = body.reason || null;
    if (body.allDay !== undefined) updateData.allDay = body.allDay;
    if (body.startDate !== undefined) updateData.startDate = new Date(body.startDate);
    if (body.endDate !== undefined) updateData.endDate = new Date(body.endDate);

    const timeOff = await prisma.timeOff.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ success: true, timeOff });
  } catch {
    return NextResponse.json({ error: 'Failed to update time-off entry' }, { status: 500 });
  }
}

/**
 * DELETE /api/time-off/[id] — Delete a time-off entry
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { activeTenant } = await getAuthenticatedUserWithTenant();
    if (!activeTenant) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const existing = await prisma.timeOff.findFirst({
      where: { id, tenantId: activeTenant.id },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    await prisma.timeOff.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Failed to delete time-off entry' }, { status: 500 });
  }
}
