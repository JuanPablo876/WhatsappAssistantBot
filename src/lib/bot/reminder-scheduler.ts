/**
 * Reminder Scheduler Worker
 * 
 * This worker runs on a cron schedule to process pending reminder jobs.
 * It should be started as a separate process: `npm run reminder:worker`
 */

import cron from 'node-cron';
import { prisma } from '@/lib/db';
import { logger } from './logger';
import { sendWhatsAppReminder, sendEmailReminder } from './reminder-channels';
import type { ReminderChannel, ReminderStatus } from '@prisma/client';

const MAX_ATTEMPTS = 3;
const BATCH_SIZE = 50;

/**
 * Process a single reminder job.
 */
async function processJob(jobId: string): Promise<void> {
  const job = await prisma.reminderJob.findUnique({
    where: { id: jobId },
    include: {
      appointment: true,
      contact: true,
      tenant: { include: { businessProfile: true } },
    },
  });

  if (!job || job.status !== 'PENDING') {
    return;
  }

  // Check if contact has opted out
  if (job.contact.reminderOptOut) {
    await prisma.reminderJob.update({
      where: { id: jobId },
      data: { status: 'CANCELLED' as ReminderStatus },
    });
    logger.info({ jobId }, 'Reminder cancelled — contact opted out');
    return;
  }

  // Check quiet hours
  if (job.tenant.businessProfile) {
    const bp = job.tenant.businessProfile;
    if (bp.quietHoursStart && bp.quietHoursEnd) {
      const now = new Date();
      const nowMinutes = now.getHours() * 60 + now.getMinutes();
      const [startH, startM] = bp.quietHoursStart.split(':').map(Number);
      const [endH, endM] = bp.quietHoursEnd.split(':').map(Number);
      const startMinutes = startH * 60 + startM;
      const endMinutes = endH * 60 + endM;

      // Handle overnight quiet hours (e.g., 22:00 - 08:00)
      const inQuietHours =
        startMinutes > endMinutes
          ? nowMinutes >= startMinutes || nowMinutes < endMinutes
          : nowMinutes >= startMinutes && nowMinutes < endMinutes;

      if (inQuietHours) {
        // Reschedule for after quiet hours
        const nextAttempt = new Date(now);
        nextAttempt.setHours(endH, endM + 5, 0, 0);
        if (nextAttempt < now) {
          nextAttempt.setDate(nextAttempt.getDate() + 1);
        }
        await prisma.reminderJob.update({
          where: { id: jobId },
          data: { scheduledFor: nextAttempt },
        });
        logger.info({ jobId, nextAttempt }, 'Reminder rescheduled — quiet hours');
        return;
      }
    }
  }

  // Build the reminder message
  const appt = job.appointment;
  const businessName = job.tenant.businessProfile?.businessName || job.tenant.name;
  const apptDate = new Date(appt.startTime);
  const formattedDate = apptDate.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
  const formattedTime = apptDate.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  const message = `Hi${job.contact.name ? ` ${job.contact.name}` : ''}! This is a reminder about your appointment at ${businessName}.\n\n📅 ${formattedDate}\n⏰ ${formattedTime}\n📍 ${appt.title}\n\nReply CANCEL to cancel or RESCHEDULE to change the time.`;

  let success = false;
  let errorMessage: string | undefined;

  try {
    switch (job.channel) {
      case 'WHATSAPP':
        success = await sendWhatsAppReminder(job.tenantId, job.contact.phone, message);
        break;
      case 'EMAIL':
        if (job.contact.email) {
          success = await sendEmailReminder(
            job.tenantId,
            job.contact.email,
            `Appointment Reminder - ${businessName}`,
            message
          );
        } else {
          errorMessage = 'No email address for contact';
        }
        break;
      case 'VOICE_CALL':
        // Voice calls not implemented yet
        errorMessage = 'Voice call reminders not yet implemented';
        break;
    }
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error({ error, jobId }, 'Reminder delivery failed');
  }

  // Update job status
  const newAttempts = job.attempts + 1;
  const newStatus: ReminderStatus = success
    ? 'SENT'
    : newAttempts >= MAX_ATTEMPTS
      ? 'FAILED'
      : 'PENDING';

  await prisma.reminderJob.update({
    where: { id: jobId },
    data: {
      status: newStatus,
      attempts: newAttempts,
      lastError: errorMessage,
    },
  });

  // Log to history
  await prisma.reminderHistory.create({
    data: {
      jobId,
      channel: job.channel,
      status: success ? 'SENT' : 'FAILED',
      deliveredAt: success ? new Date() : null,
      errorDetail: errorMessage,
    },
  });

  if (success) {
    logger.info({ jobId, channel: job.channel }, 'Reminder sent successfully');
    // Mark appointment as reminded
    await prisma.appointment.update({
      where: { id: job.appointmentId },
      data: { reminderSent: true },
    });
  } else if (newStatus === 'FAILED') {
    logger.warn({ jobId, attempts: newAttempts }, 'Reminder permanently failed');
  }
}

/**
 * Process all pending reminder jobs that are due.
 */
async function processReminders(): Promise<void> {
  const now = new Date();

  // Find pending jobs where scheduledFor <= now
  const jobs = await prisma.reminderJob.findMany({
    where: {
      status: 'PENDING',
      scheduledFor: { lte: now },
    },
    select: { id: true },
    take: BATCH_SIZE,
    orderBy: { scheduledFor: 'asc' },
  });

  if (jobs.length === 0) return;

  logger.info({ count: jobs.length }, 'Processing reminder jobs');

  // Process jobs sequentially to avoid rate limits
  for (const job of jobs) {
    try {
      await processJob(job.id);
    } catch (error) {
      logger.error({ error, jobId: job.id }, 'Error processing reminder job');
    }
    // Small delay between jobs to avoid rate limits
    await new Promise((r) => setTimeout(r, 100));
  }
}

/**
 * Start the reminder scheduler.
 */
export function startReminderScheduler(): void {
  // Run every minute
  cron.schedule('* * * * *', async () => {
    try {
      await processReminders();
    } catch (error) {
      logger.error({ error }, 'Reminder scheduler error');
    }
  });

  logger.info('Reminder scheduler started — running every minute');
}

// If running as a standalone script
if (require.main === module) {
  startReminderScheduler();
  logger.info('Reminder worker started');
}
