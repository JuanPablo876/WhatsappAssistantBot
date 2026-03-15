import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthenticatedUserWithTenant } from '@/lib/auth-local';

/**
 * POST /api/auth/google/disconnect
 * Removes Google Calendar tokens from the tenant.
 */
export async function POST() {
  try {
    const { activeTenant } = await getAuthenticatedUserWithTenant();
    if (!activeTenant) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await prisma.tenant.update({
      where: { id: activeTenant.id },
      data: {
        googleAccessToken: null,
        googleRefreshToken: null,
        googleTokenExpiry: null,
        googleCalendarId: null,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to disconnect', details: error.message },
      { status: 500 }
    );
  }
}
