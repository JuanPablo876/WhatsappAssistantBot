import { getAuthenticatedUserWithTenant } from '@/lib/auth-local';
import { redirect } from 'next/navigation';
import { BillingClient } from './billing-client';

export default async function BillingPage() {
  const { activeTenant: tenant } = await getAuthenticatedUserWithTenant();
  if (!tenant) redirect('/create-tenant');
  if (!tenant.onboardingComplete) redirect('/dashboard/onboarding');

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-1">Billing & Plans</h1>
        <p className="text-[var(--muted)]">
          Manage your subscription and see what&apos;s included in each plan.
        </p>
      </div>

      <BillingClient currentPlan={tenant.plan} />
    </div>
  );
}
