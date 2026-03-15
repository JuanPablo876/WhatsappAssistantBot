import { prisma } from '@/lib/db';
import Link from 'next/link';
import AdminOverviewClient from './components/admin-overview-client';

export default async function AdminPage() {
  const [
    userCount,
    tenantCount,
    conversationCount,
    appointmentCount,
    recentUsers,
    recentTenants,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.tenant.count(),
    prisma.conversation.count(),
    prisma.appointment.count(),
    prisma.user.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    }),
    prisma.tenant.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { name: true } }, businessProfile: true },
    }),
  ]);

  return (
    <AdminOverviewClient
      stats={{ userCount, tenantCount, conversationCount, appointmentCount }}
      recentUsers={recentUsers}
      recentTenants={recentTenants.map(t => ({
        id: t.id,
        name: t.name,
        ownerName: t.user.name,
        businessType: t.businessProfile?.businessType || null,
        onboardingComplete: t.onboardingComplete,
      }))}
    />
  );
}
