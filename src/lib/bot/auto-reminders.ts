/**
 * Auto-Reminder Utilities
 * 
 * Creates reminder jobs automatically when appointments are created,
 * based on the tenant's notification preferences.
 */

import { prisma } from '@/lib/db';
import { logger } from './logger';
import { ReminderChannel, ReminderStatus } from '@prisma/client';

/**
 * Create automatic reminder jobs for a newly created appointment.
 * Uses the tenant's BusinessProfile settings for lead time, channels, and quiet hours.
 */
export async function createAppointmentReminders(
  appointmentId: string,
  tenantId: string,
  contactId: string
): Promise<number> {
  try {
    // Get tenant notification settings
    const profile = await prisma.businessProfile.findUnique({
      where: { tenantId },
      select: {
        reminderLeadMinutes: true,
        reminderChannels: true,
        businessName: true,
      },
    });

    if (!profile) {
      logger.warn({ tenantId }, 'No business profile found for tenant');
      return 0;
    }

    // Parse JSON strings to arrays (SQLite stores as JSON strings)
    const leadMinutes: number[] = JSON.parse(profile.reminderLeadMinutes || '[]');
    const channels: string[] = JSON.parse(profile.reminderChannels || '[]');

    if (leadMinutes.length === 0 || channels.length === 0) {
      logger.debug({ tenantId }, 'Reminders not configured for tenant');
      return 0;
    }

    // Get appointment details
    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: { contact: true },
    });

    if (!appointment) {
      logger.warn({ appointmentId }, 'Appointment not found');
      return 0;
    }

    // Check if contact has opted out
    if (appointment.contact?.reminderOptOut) {
      logger.info(
        { contactId: appointment.contactId },
        'Contact has opted out of reminders'
      );
      return 0;
    }

    // Get contact's preferred channel if set
    const preferredChannel = appointment.contact?.preferredChannel;
    const effectiveChannels = preferredChannel
      ? [preferredChannel]
      : channels;

    // Create reminder jobs for each lead time and channel combination
    const jobs: Array<{
      appointmentId: string;
      tenantId: string;
      contactId: string;
      channel: ReminderChannel;
      scheduledFor: Date;
      payload: string;
    }> = [];

    for (const leadMin of leadMinutes) {
      // Calculate scheduled time
      const scheduledFor = new Date(appointment.startTime.getTime() - leadMin * 60 * 1000);

      // Skip if reminder would be in the past
      if (scheduledFor <= new Date()) {
        continue;
      }

      for (const channel of effectiveChannels) {
        // Prepare payload (message content)
        const payload = JSON.stringify({
          contactName: appointment.contact?.name || 'Customer',
          contactPhone: appointment.contact?.phone,
          contactEmail: appointment.contact?.email,
          appointmentTitle: appointment.title,
          appointmentStart: appointment.startTime.toISOString(),
          appointmentEnd: appointment.endTime.toISOString(),
          businessName: profile.businessName || 'Our Business',
          leadMinutes: leadMin,
        });

        jobs.push({
          appointmentId,
          tenantId,
          contactId,
          channel: channel as ReminderChannel,
          scheduledFor,
          payload,
        });
      }
    }

    // Batch create all reminder jobs
    if (jobs.length > 0) {
      await prisma.reminderJob.createMany({
        data: jobs.map((job) => ({
          appointmentId: job.appointmentId,
          tenantId: job.tenantId,
          contactId: job.contactId,
          channel: job.channel,
          scheduledFor: job.scheduledFor,
          status: ReminderStatus.PENDING,
          payload: job.payload,
        })),
      });

      logger.info(
        { appointmentId, count: jobs.length },
        'Created reminder jobs for appointment'
      );
    }

    return jobs.length;
  } catch (error) {
    logger.error({ error, appointmentId }, 'Failed to create appointment reminders');
    return 0;
  }
}

/**
 * Cancel all pending reminders for an appointment.
 * Called when an appointment is cancelled or rescheduled.
 */
export async function cancelAppointmentReminders(
  appointmentId: string
): Promise<number> {
  try {
    const result = await prisma.reminderJob.updateMany({
      where: {
        appointmentId,
        status: ReminderStatus.PENDING,
      },
      data: {
        status: ReminderStatus.CANCELLED,
        updatedAt: new Date(),
      },
    });

    logger.info(
      { appointmentId, count: result.count },
      'Cancelled reminder jobs for appointment'
    );

    return result.count;
  } catch (error) {
    logger.error({ error, appointmentId }, 'Failed to cancel appointment reminders');
    return 0;
  }
}

/**
 * Reschedule reminders when an appointment time is changed.
 */
export async function rescheduleAppointmentReminders(
  appointmentId: string,
  tenantId: string,
  contactId: string
): Promise<number> {
  // Cancel existing reminders
  await cancelAppointmentReminders(appointmentId);

  // Create new reminders based on updated appointment time
  return createAppointmentReminders(appointmentId, tenantId, contactId);
}
