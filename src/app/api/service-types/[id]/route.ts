import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthenticatedUserWithTenant } from '@/lib/auth-local';

/**
 * PATCH /api/service-types/[id] — update a service type
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { activeTenant: tenant } = await getAuthenticatedUserWithTenant();
    if (!tenant) return NextResponse.json({ error: 'No tenant' }, { status: 404 });

    const { id } = await params;
    const body = await request.json();

    // Verify ownership
    const existing = await prisma.serviceType.findFirst({
      where: { id, tenantId: tenant.id },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Service type not found' }, { status: 404 });
    }

    const updated = await prisma.serviceType.update({
      where: { id },
      data: {
        name: body.name ?? existing.name,
        description: body.description !== undefined ? (body.description || null) : existing.description,
        duration: body.duration ? parseInt(body.duration) : existing.duration,
        price: body.price !== undefined ? (body.price ? parseFloat(body.price) : null) : existing.price,
        color: body.color !== undefined ? (body.color || null) : existing.color,
        isActive: body.isActive !== undefined ? body.isActive : existing.isActive,
        sortOrder: body.sortOrder !== undefined ? body.sortOrder : existing.sortOrder,
      },
    });

    return NextResponse.json({ success: true, serviceType: updated });
  } catch (error) {
    console.error('Service type PATCH error:', error);
    return NextResponse.json({ error: 'Failed to update service type' }, { status: 500 });
  }
}

/**
 * DELETE /api/service-types/[id] — delete a service type
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { activeTenant: tenant } = await getAuthenticatedUserWithTenant();
    if (!tenant) return NextResponse.json({ error: 'No tenant' }, { status: 404 });

    const { id } = await params;

    // Verify ownership
    const existing = await prisma.serviceType.findFirst({
      where: { id, tenantId: tenant.id },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Service type not found' }, { status: 404 });
    }

    // Soft-nullify appointments that reference this service type (the FK is onDelete: SetNull)
    await prisma.serviceType.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Service type DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete service type' }, { status: 500 });
  }
}
