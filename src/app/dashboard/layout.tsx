import { getAuthenticatedUserWithTenant, isAdmin } from '@/lib/auth-local';
import { redirect } from 'next/navigation';
import { DashboardShell } from './components/dashboard-shell';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, tenants, activeTenant } = await getAuthenticatedUserWithTenant();

  // If user has no tenant yet, redirect to create one (outside /dashboard to avoid loop)
  if (!activeTenant) {
    redirect('/create-tenant');
  }

  return (
    <DashboardShell
      user={{
        name: user.name,
        email: user.email,
        role: user.role,
        isAdmin: isAdmin(user),
      }}
      tenant={{
        id: activeTenant.id,
        name: activeTenant.name,
        plan: activeTenant.plan,
        onboardingComplete: activeTenant.onboardingComplete,
      }}
      tenants={tenants.map(t => ({ id: t.id, name: t.name }))}
      businessName={activeTenant.businessProfile?.businessName || activeTenant.name}
    >
      {children}
    </DashboardShell>
  );
}
