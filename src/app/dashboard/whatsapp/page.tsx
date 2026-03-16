import { getAuthenticatedUserWithTenant } from '@/lib/auth-local';
import { prisma } from '@/lib/db';
import { redirect } from 'next/navigation';
import { PhoneSetupClient } from './phone-setup-client';

export default async function WhatsAppPage() {
  const { activeTenant: tenant } = await getAuthenticatedUserWithTenant();
  if (!tenant) redirect('/create-tenant');
  if (!tenant.onboardingComplete) redirect('/dashboard/onboarding');

  const config = await prisma.whatsappConfig.findUnique({
    where: { tenantId: tenant.id },
  });

  // Check for pending rental request
  const rentalRequest = await prisma.phoneRentalRequest.findFirst({
    where: { tenantId: tenant.id },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <div className="max-w-4xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-1">Phone & WhatsApp Setup</h1>
        <p className="text-[var(--muted)]">
          Choose how you want to connect your AI assistant for WhatsApp and phone calls.
        </p>
      </div>

      <PhoneSetupClient
        currentConfig={config ? {
          setupType: config.setupType,
          channel: config.channel,
          isActive: config.isActive,
          phoneNumberId: config.phoneNumberId || '',
          accessToken: config.accessToken ? '••••••••' : '',
          businessId: config.businessId || '',
          twilioAccountSid: config.twilioAccountSid || '',
          twilioAuthToken: config.twilioAuthToken ? '••••••••' : '',
          twilioPhoneNumber: config.twilioPhoneNumber || '',
        } : null}
        rentalRequest={rentalRequest ? {
          id: rentalRequest.id,
          status: rentalRequest.status,
          countryCode: rentalRequest.countryCode,
          assignedNumber: rentalRequest.assignedNumber,
          requestedAt: rentalRequest.requestedAt.toISOString(),
          fulfilledAt: rentalRequest.fulfilledAt?.toISOString(),
        } : null}
        tenantId={tenant.id}
      />
    </div>
  );
}
