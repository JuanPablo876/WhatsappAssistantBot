import { getAuthenticatedUserWithTenant } from '@/lib/auth-local';
import { prisma } from '@/lib/db';
import { redirect } from 'next/navigation';
import { AnalyticsDashboard } from './components/analytics-dashboard';

export default async function DashboardPage() {
  const { activeTenant: tenant } = await getAuthenticatedUserWithTenant();
  if (!tenant) redirect('/create-tenant');
  if (!tenant.onboardingComplete) redirect('/dashboard/onboarding');

  // Load stats
  const [contactCount, appointmentCount, conversationCount, profile] = await Promise.all([
    prisma.contact.count({ where: { tenantId: tenant.id } }),
    prisma.appointment.count({ where: { tenantId: tenant.id, status: 'CONFIRMED' } }),
    prisma.conversation.count({ where: { tenantId: tenant.id, status: 'ACTIVE' } }),
    prisma.businessProfile.findUnique({ where: { tenantId: tenant.id } }),
  ]);

  const stats = [
    { label: 'Active Conversations', value: conversationCount, icon: '💬', color: 'from-blue-500 to-cyan-400' },
    { label: 'Total Contacts', value: contactCount, icon: '👥', color: 'from-violet-500 to-fuchsia-500' },
    { label: 'Upcoming Appointments', value: appointmentCount, icon: '📅', color: 'from-emerald-500 to-blue-500' },
  ];

  return (
    <AnalyticsDashboard stats={stats} profile={profile} />
  );
}