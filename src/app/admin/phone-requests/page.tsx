import { prisma } from '@/lib/db';
import { PhoneRequestsClient } from './phone-requests-client';

export default async function PhoneRequestsPage() {
  const requests = await prisma.phoneRentalRequest.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  // Get tenant info for each request
  const tenantIds = [...new Set(requests.map(r => r.tenantId))];
  const tenants = await prisma.tenant.findMany({
    where: { id: { in: tenantIds } },
    include: { user: { select: { email: true, name: true } } },
  });
  const tenantMap = new Map(tenants.map(t => [t.id, t]));

  const requestsWithTenant = requests.map(r => ({
    ...r,
    tenant: tenantMap.get(r.tenantId),
  }));

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-1">Phone Number Requests</h1>
        <p className="text-[var(--muted)]">
          Manage rental requests from tenants waiting for phone numbers.
        </p>
      </div>

      <PhoneRequestsClient 
        requests={requestsWithTenant.map(r => ({
          id: r.id,
          tenantId: r.tenantId,
          tenantName: r.tenant?.name || 'Unknown',
          userEmail: r.tenant?.user?.email || 'Unknown',
          countryCode: r.countryCode,
          preferredArea: r.preferredArea,
          purpose: r.purpose,
          status: r.status,
          assignedNumber: r.assignedNumber,
          adminNotes: r.adminNotes,
          requestedAt: r.requestedAt.toISOString(),
          processedAt: r.processedAt?.toISOString(),
          fulfilledAt: r.fulfilledAt?.toISOString(),
        }))}
      />
    </div>
  );
}
