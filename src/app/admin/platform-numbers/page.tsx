import { prisma } from '@/lib/db';
import { getAuthenticatedUserWithTenant } from '@/lib/auth-local';
import { redirect } from 'next/navigation';
import { PlatformNumbersClient } from './platform-numbers-client';

export default async function PlatformNumbersPage() {
  const authResult = await getAuthenticatedUserWithTenant();
  
  if (!authResult.user || authResult.user.role !== 'ADMIN') {
    redirect('/login');
  }

  // Fetch all platform numbers with tenant info
  const numbers = await prisma.platformPhoneNumber.findMany({
    orderBy: { createdAt: 'desc' },
  });

  // Get tenant names for assigned numbers
  const tenantIds = numbers.filter(n => n.tenantId).map(n => n.tenantId as string);
  const tenants = await prisma.tenant.findMany({
    where: { id: { in: tenantIds } },
    select: { id: true, name: true },
  });
  const tenantMap = Object.fromEntries(tenants.map(t => [t.id, t.name]));

  // Also get all tenants for the assignment dropdown
  const allTenants = await prisma.tenant.findMany({
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });

  const numbersWithTenantNames = numbers.map(n => ({
    id: n.id,
    phoneNumber: n.phoneNumber,
    twilioSid: n.twilioSid,
    countryCode: n.countryCode,
    areaCode: n.areaCode,
    friendlyName: n.friendlyName,
    tenantId: n.tenantId,
    tenantName: n.tenantId ? tenantMap[n.tenantId] || 'Unknown' : null,
    assignedAt: n.assignedAt?.toISOString() || null,
    voiceEnabled: n.voiceEnabled,
    smsEnabled: n.smsEnabled,
    monthlyPrice: n.monthlyPrice,
    twilioCost: n.twilioCost,
    status: n.status,
    createdAt: n.createdAt.toISOString(),
  }));

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-1">Platform Phone Numbers</h1>
        <p className="text-[var(--muted)]">
          Manage phone numbers purchased with our Twilio account that are rented to clients.
        </p>
      </div>
      <PlatformNumbersClient 
        numbers={numbersWithTenantNames} 
        tenants={allTenants}
      />
    </div>
  );
}
