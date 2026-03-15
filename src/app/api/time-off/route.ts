import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserWithTenant } from '@/lib/auth-local';
import { prisma } from '@/lib/db';

/**
 * GET /api/time-off — List all time-off entries for the current tenant
 */
export async function GET() {
  try {
    const { activeTenant } = await getAuthenticatedUserWithTenant();
    if (!activeTenant) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const timeOffs = await prisma.timeOff.findMany({
      where: { tenantId: activeTenant.id },
      orderBy: { startDate: 'asc' },
    });

    return NextResponse.json({ success: true, timeOffs });
  } catch {
    return NextResponse.json({ error: 'Failed to load time-off entries' }, { status: 500 });
  }
}

/**
 * POST /api/time-off — Create a new time-off entry
 */
export async function POST(req: NextRequest) {
  try {
    const { activeTenant } = await getAuthenticatedUserWithTenant();
    if (!activeTenant) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { title, reason, allDay, startDate, endDate } = body;

    if (!title || !startDate || !endDate) {
      return NextResponse.json(
        { error: 'Title, start date, and end date are required' },
        { status: 400 }
      );
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return NextResponse.json({ error: 'Invalid date format' }, { status: 400 });
    }

    if (end < start) {
      return NextResponse.json({ error: 'End date must be after start date' }, { status: 400 });
    }

    const timeOff = await prisma.timeOff.create({
      data: {
        tenantId: activeTenant.id,
        title,
        reason: reason || null,
        allDay: allDay !== false, // default true
        startDate: start,
        endDate: end,
      },
    });

    return NextResponse.json({ success: true, timeOff });
  } catch {
    return NextResponse.json({ error: 'Failed to create time-off entry' }, { status: 500 });
  }
}
