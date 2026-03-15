import { getAuthenticatedUserWithTenant } from '@/lib/auth-local';
import { prisma } from '@/lib/db';
import { redirect } from 'next/navigation';
import { AppointmentsClient } from './appointments-client';

export default async function AppointmentsPage() {
  const { activeTenant: tenant } = await getAuthenticatedUserWithTenant();
  if (!tenant) redirect('/create-tenant');
  if (!tenant.onboardingComplete) redirect('/dashboard/onboarding');

  const appointments = await prisma.appointment.findMany({
    where: { tenantId: tenant.id },
    include: { contact: true, serviceType: true },
    orderBy: { startTime: 'asc' },
    take: 100,
  });

  const serviceTypes = await prisma.serviceType.findMany({
    where: { tenantId: tenant.id },
  });

  // Convert dates to strings for client component
  const serializedAppointments = appointments.map(apt => ({
    ...apt,
    startTime: apt.startTime.toISOString(),
    endTime: apt.endTime.toISOString(),
    createdAt: apt.createdAt.toISOString(),
    updatedAt: apt.updatedAt.toISOString(),
  }));

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-1">Appointments</h1>
        <p className="text-[var(--muted)]">
          Manage appointments booked by your AI assistant.
        </p>
      </div>

      <AppointmentsClient 
        appointments={serializedAppointments} 
        serviceTypes={serviceTypes}
      />
    </div>
  );
}
