import { getAuthenticatedUserWithTenant } from '@/lib/auth-local';
import { prisma } from '@/lib/db';
import { redirect } from 'next/navigation';
import { SettingsClient } from './settings-client';

export default async function SettingsPage() {
  const { activeTenant: tenant } = await getAuthenticatedUserWithTenant();
  if (!tenant) redirect('/create-tenant');
  if (!tenant.onboardingComplete) redirect('/dashboard/onboarding');

  // Reload tenant to get latest google token info
  const freshTenant = await prisma.tenant.findUnique({ where: { id: tenant.id } });

  const profile = await prisma.businessProfile.findUnique({
    where: { tenantId: tenant.id },
  });

  const serviceTypes = await prisma.serviceType.findMany({
    where: { tenantId: tenant.id },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  });

  const timeOffs = await prisma.timeOff.findMany({
    where: { tenantId: tenant.id },
    orderBy: { startDate: 'asc' },
  });

  const googleConnected = !!(freshTenant?.googleAccessToken && freshTenant?.googleRefreshToken);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-1">Settings</h1>
        <p className="text-[var(--muted)]">
          Customize your AI assistant&apos;s behavior, schedule, and persona.
        </p>
      </div>

      <SettingsClient
        googleConnected={googleConnected}
        ownerPhone={freshTenant?.ownerPhone || ''}
        timeOffs={timeOffs.map(to => ({
          id: to.id,
          title: to.title,
          reason: to.reason || '',
          allDay: to.allDay,
          startDate: to.startDate.toISOString(),
          endDate: to.endDate.toISOString(),
        }))}
        serviceTypes={serviceTypes.map(st => ({
          id: st.id,
          name: st.name,
          description: st.description || '',
          duration: st.duration,
          price: st.price,
          color: st.color || '',
          isActive: st.isActive,
        }))}
        profile={profile ? {
          businessName: profile.businessName,
          businessType: profile.businessType,
          description: profile.description || '',
          services: profile.services || '',
          systemPrompt: profile.systemPrompt,
          tone: profile.tone || 'professional',
          language: profile.language || 'en',
          timezone: profile.timezone || 'America/New_York',
          workingDays: profile.workingDays,
          openTime: profile.openTime || '09:00',
          closeTime: profile.closeTime || '17:00',
          slotDuration: profile.slotDuration || 30,
          welcomeMessage: profile.welcomeMessage || '',
          // Notification settings - parse JSON strings to arrays
          reminderLeadMinutes: JSON.parse(profile.reminderLeadMinutes || '[]') as number[],
          reminderChannels: JSON.parse(profile.reminderChannels || '[]') as string[],
          quietHoursStart: profile.quietHoursStart || '',
          quietHoursEnd: profile.quietHoursEnd || '',
          emailProvider: profile.emailProvider || '',
          emailApiKey: profile.emailApiKey || '',
          emailFromAddress: profile.emailFromAddress || '',
        } : null}
      />
    </div>
  );
}
