import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth-local';

// POST create new tenant for the current user
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { name } = await request.json();

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: 'Business name is required' },
        { status: 400 }
      );
    }

    const tenant = await prisma.tenant.create({
      data: {
        userId: user.id,
        name: name.trim(),
      },
    });

    return NextResponse.json(tenant, { status: 201 });
  } catch (error) {
    console.error('Create tenant error:', error);
    return NextResponse.json({ error: 'Failed to create business' }, { status: 500 });
  }
}

// GET list tenants for current user
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tenants = await prisma.tenant.findMany({
      where: { userId: user.id },
      include: { businessProfile: true },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json(tenants);
  } catch (error) {
    console.error('Get tenants error:', error);
    return NextResponse.json({ error: 'Failed to get businesses' }, { status: 500 });
  }
}
