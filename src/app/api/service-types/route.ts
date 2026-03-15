import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthenticatedUserWithTenant } from '@/lib/auth-local';

/**
 * GET /api/service-types — list service types for current tenant
 */
export async function GET() {
  try {
    const { activeTenant: tenant } = await getAuthenticatedUserWithTenant();
    if (!tenant) return NextResponse.json({ error: 'No tenant' }, { status: 404 });

    const serviceTypes = await prisma.serviceType.findMany({
      where: { tenantId: tenant.id },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });

    return NextResponse.json({ serviceTypes });
  } catch (error) {
    console.error('Service types GET error:', error);
    return NextResponse.json({ error: 'Failed to load service types' }, { status: 500 });
  }
}

/**
 * POST /api/service-types — create a new service type
 */
export async function POST(request: Request) {
  try {
    const { activeTenant: tenant } = await getAuthenticatedUserWithTenant();
    if (!tenant) return NextResponse.json({ error: 'No tenant' }, { status: 404 });

    const body = await request.json();
    const { name, description, duration, price, color } = body;

    if (!name || !duration) {
      return NextResponse.json({ error: 'Name and duration are required' }, { status: 400 });
    }

    // Get max sortOrder for this tenant
    const maxSort = await prisma.serviceType.aggregate({
      where: { tenantId: tenant.id },
      _max: { sortOrder: true },
    });

    const serviceType = await prisma.serviceType.create({
      data: {
        tenantId: tenant.id,
        name,
        description: description || null,
        duration: parseInt(duration),
        price: price ? parseFloat(price) : null,
        color: color || null,
        sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
      },
    });

    return NextResponse.json({ success: true, serviceType });
  } catch (error) {
    console.error('Service types POST error:', error);
    return NextResponse.json({ error: 'Failed to create service type' }, { status: 500 });
  }
}
