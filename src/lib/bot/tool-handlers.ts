import { prisma } from '@/lib/db';
import { logger } from './logger';
import { GoogleCalendarService } from './google-calendar';
import {
  dayjs,
  generateTimeSlots,
  isWorkDay,
  formatDateTime,
  formatTime,
  formatDate,
} from './date-helpers';
import { createAppointmentReminders, cancelAppointmentReminders, rescheduleAppointmentReminders } from './auto-reminders';
import type { AgentContext, ToolResult } from './types';

/**
 * Get the Google Calendar service for a tenant (using their OAuth tokens).
 */
async function getCalendar(tenantId: string): Promise<GoogleCalendarService> {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant?.googleAccessToken || !tenant?.googleRefreshToken) {
    throw new Error('Tenant has no Google Calendar tokens configured');
  }
  return new GoogleCalendarService(tenant.googleAccessToken, tenant.googleRefreshToken, tenantId);
}

/**
 * Check available appointment slots for a given date.
 */
export async function checkAvailability(
  args: Record<string, unknown>,
  context: AgentContext
): Promise<ToolResult> {
  try {
    const dateStr = args.date as string;
    const { timezone, workStartHour, workEndHour, workDays, slotDurationMin, maxAdvanceDays } =
      context.businessSettings;

    const requestedDate = dayjs.tz(dateStr, 'YYYY-MM-DD', timezone);
    if (!requestedDate.isValid()) {
      return { success: false, error: `Invalid date format: "${dateStr}". Use YYYY-MM-DD format.` };
    }

    const now = dayjs().tz(timezone);
    if (requestedDate.isBefore(now, 'day')) {
      return { success: false, error: 'Cannot check availability for past dates.' };
    }

    const maxDate = now.add(maxAdvanceDays, 'day');
    if (requestedDate.isAfter(maxDate, 'day')) {
      return {
        success: false,
        error: `Cannot book more than ${maxAdvanceDays} days in advance. Latest: ${maxDate.format('YYYY-MM-DD')}.`,
      };
    }

    if (!isWorkDay(requestedDate.toDate(), workDays, timezone)) {
      return {
        success: false,
        error: `${formatDate(requestedDate.toDate(), timezone)} is not a business day.`,
      };
    }

    // Check for all-day time-off blocking the entire day
    const dayStart = requestedDate.startOf('day').utc().toDate();
    const dayEnd = requestedDate.endOf('day').utc().toDate();

    const timeOffs = await prisma.timeOff.findMany({
      where: {
        tenantId: context.tenantId,
        startDate: { lte: dayEnd },
        endDate: { gte: dayStart },
      },
    });

    // Check if the entire day is blocked by an all-day time-off
    const allDayBlock = timeOffs.find(
      (to) => to.allDay && to.startDate <= dayStart && to.endDate >= dayEnd
    );
    if (allDayBlock) {
      return {
        success: true,
        data: {
          date: formatDate(requestedDate.toDate(), timezone),
          available: false,
          message: `${formatDate(requestedDate.toDate(), timezone)} is unavailable (${allDayBlock.title}). Please choose another date.`,
          slots: [],
        },
      };
    }

    const allSlots = generateTimeSlots(
      requestedDate.toDate(),
      timezone,
      workStartHour,
      workEndHour,
      slotDurationMin
    );

    const calendarService = await getCalendar(context.tenantId);
    const busySlots = await calendarService.getBusySlots(dayStart, dayEnd);

    // Build time-off busy ranges (for partial-day blocks)
    const timeOffBusySlots = timeOffs.map((to) => ({
      start: to.startDate,
      end: to.endDate,
    }));

    const nowUtc = new Date();
    const availableSlots = allSlots.filter((slot) => {
      if (slot.start <= nowUtc) return false;
      // Check Google Calendar busy slots
      if (busySlots.some((busy) => slot.start < busy.end && slot.end > busy.start)) return false;
      // Check time-off blocked slots
      if (timeOffBusySlots.some((blocked) => slot.start < blocked.end && slot.end > blocked.start)) return false;
      return true;
    });

    if (availableSlots.length === 0) {
      return {
        success: true,
        data: {
          date: formatDate(requestedDate.toDate(), timezone),
          available: false,
          message: `No available slots on ${formatDate(requestedDate.toDate(), timezone)}.`,
          slots: [],
        },
      };
    }

    const formattedSlots = availableSlots.map((slot) => ({
      start: slot.start.toISOString(),
      end: slot.end.toISOString(),
      display: `${formatTime(slot.start, timezone)} - ${formatTime(slot.end, timezone)}`,
    }));

    return {
      success: true,
      data: {
        date: formatDate(requestedDate.toDate(), timezone),
        available: true,
        slotCount: formattedSlots.length,
        slots: formattedSlots,
      },
    };
  } catch (error) {
    logger.error({ error }, 'Error checking availability');
    return { success: false, error: 'Failed to check availability. Please try again.' };
  }
}

/**
 * Create a new appointment — multi-tenant aware.
 * Supports service_type parameter for service-specific durations.
 */
export async function createAppointment(
  args: Record<string, unknown>,
  context: AgentContext
): Promise<ToolResult> {
  try {
    const dateStr = args.date as string;
    const timeStr = args.time as string;
    const title = (args.title as string) || 'Appointment';
    const description = (args.description as string) || '';
    const serviceTypeArg = (args.service_type as string) || '';
    const { timezone, slotDurationMin, businessName, serviceTypes } = context.businessSettings;

    // Resolve service type if provided
    let matchedService: typeof serviceTypes[number] | undefined;
    if (serviceTypeArg && serviceTypes.length > 0) {
      // Try matching by ID first, then by name (case-insensitive)
      matchedService = serviceTypes.find(st => st.id === serviceTypeArg)
        || serviceTypes.find(st => st.name.toLowerCase() === serviceTypeArg.toLowerCase())
        || serviceTypes.find(st => st.name.toLowerCase().includes(serviceTypeArg.toLowerCase()));
    }

    const duration = matchedService?.duration || slotDurationMin;

    const startTime = dayjs.tz(`${dateStr} ${timeStr}`, 'YYYY-MM-DD HH:mm', timezone);
    if (!startTime.isValid()) {
      return { success: false, error: `Invalid date/time: ${dateStr} ${timeStr}` };
    }
    if (startTime.isBefore(dayjs())) {
      return { success: false, error: 'Cannot create appointments in the past.' };
    }

    const endTime = startTime.add(duration, 'minute');

    // Check time-off blocks
    const timeOffs = await prisma.timeOff.findMany({
      where: {
        tenantId: context.tenantId,
        startDate: { lte: endTime.utc().toDate() },
        endDate: { gte: startTime.utc().toDate() },
      },
    });

    if (timeOffs.length > 0) {
      const block = timeOffs[0];
      return {
        success: false,
        error: `That time is unavailable (${block.title}). Please choose a different date or time.`,
      };
    }

    const calendarService = await getCalendar(context.tenantId);
    const busySlots = await calendarService.getBusySlots(
      startTime.utc().toDate(),
      endTime.utc().toDate()
    );

    if (busySlots.length > 0) {
      return {
        success: false,
        error: `The time slot ${formatTime(startTime.toDate(), timezone)} - ${formatTime(endTime.toDate(), timezone)} is already booked.`,
      };
    }

    // Create Google Calendar event
    const eventId = await calendarService.createEvent({
      title: `${title} - ${context.contactName || context.contactPhone}`,
      description: `${description}\n\nBooked via WhatsApp by ${context.contactName || context.contactPhone}`,
      start: startTime.utc().toDate(),
      end: endTime.utc().toDate(),
    });

    // Find or create contact scoped to this tenant
    let contact = await prisma.contact.findUnique({
      where: {
        tenantId_phone: {
          tenantId: context.tenantId,
          phone: context.contactPhone,
        },
      },
    });
    if (!contact) {
      contact = await prisma.contact.create({
        data: {
          tenantId: context.tenantId,
          phone: context.contactPhone,
          name: context.contactName,
        },
      });
    }

    const appointment = await prisma.appointment.create({
      data: {
        tenantId: context.tenantId,
        contactId: contact.id,
        calendarEventId: eventId,
        serviceTypeId: matchedService?.id || null,
        title,
        description,

        startTime: startTime.utc().toDate(),
        endTime: endTime.utc().toDate(),
        status: 'CONFIRMED',
      },
    });

    // Auto-create reminder jobs based on tenant notification settings
    await createAppointmentReminders(appointment.id, context.tenantId, contact.id);

    return {
      success: true,
      data: {
        appointmentId: appointment.id,
        title,
        serviceType: matchedService?.name || null,
        duration: `${duration} minutes`,
        date: formatDate(startTime.toDate(), timezone),
        time: `${formatTime(startTime.toDate(), timezone)} - ${formatTime(endTime.toDate(), timezone)}`,
        businessName,
        message: `Appointment confirmed! "${title}"${matchedService ? ` (${matchedService.name}, ${duration} min)` : ''} on ${formatDateTime(startTime.toDate(), timezone)}.`,
      },
    };
  } catch (error) {
    logger.error({ error }, 'Error creating appointment');
    return { success: false, error: 'Failed to create appointment. Please try again.' };
  }
}

/**
 * Cancel an existing appointment — multi-tenant aware.
 */
export async function cancelAppointment(
  args: Record<string, unknown>,
  context: AgentContext
): Promise<ToolResult> {
  try {
    const { timezone } = context.businessSettings;

    const contact = await prisma.contact.findUnique({
      where: {
        tenantId_phone: {
          tenantId: context.tenantId,
          phone: context.contactPhone,
        },
      },
    });
    if (!contact) {
      return { success: false, error: 'No appointments found for your phone number.' };
    }

    const appointmentId = args.appointment_id as string | undefined;
    let appointment;

    if (appointmentId) {
      appointment = await prisma.appointment.findFirst({
        where: { id: appointmentId, contactId: contact.id, tenantId: context.tenantId, status: 'CONFIRMED' },
      });
    } else {
      appointment = await prisma.appointment.findFirst({
        where: {
          contactId: contact.id,
          tenantId: context.tenantId,
          status: 'CONFIRMED',
          startTime: { gte: new Date() },
        },
        orderBy: { startTime: 'asc' },
      });
    }

    if (!appointment) {
      return { success: false, error: 'No upcoming confirmed appointment found to cancel.' };
    }

    if (appointment.calendarEventId) {
      const calendarService = await getCalendar(context.tenantId);
      await calendarService.cancelEvent(appointment.calendarEventId);
    }

    // Cancel any pending reminders for this appointment
    await cancelAppointmentReminders(appointment.id);

    await prisma.appointment.update({
      where: { id: appointment.id },
      data: { status: 'CANCELLED' },
    });

    return {
      success: true,
      data: {
        appointmentId: appointment.id,
        title: appointment.title,
        wasScheduledFor: formatDateTime(appointment.startTime, timezone),
        message: `Your appointment "${appointment.title}" on ${formatDateTime(appointment.startTime, timezone)} has been cancelled.`,
      },
    };
  } catch (error) {
    logger.error({ error }, 'Error cancelling appointment');
    return { success: false, error: 'Failed to cancel appointment. Please try again.' };
  }
}

/**
 * Reschedule an existing appointment — multi-tenant aware.
 */
export async function rescheduleAppointment(
  args: Record<string, unknown>,
  context: AgentContext
): Promise<ToolResult> {
  try {
    const newDateStr = args.new_date as string;
    const newTimeStr = args.new_time as string;
    const { timezone, slotDurationMin } = context.businessSettings;

    const contact = await prisma.contact.findUnique({
      where: {
        tenantId_phone: {
          tenantId: context.tenantId,
          phone: context.contactPhone,
        },
      },
    });
    if (!contact) {
      return { success: false, error: 'No appointments found for your phone number.' };
    }

    const appointmentId = args.appointment_id as string | undefined;
    let appointment;

    if (appointmentId) {
      appointment = await prisma.appointment.findFirst({
        where: { id: appointmentId, contactId: contact.id, tenantId: context.tenantId, status: 'CONFIRMED' },
      });
    } else {
      appointment = await prisma.appointment.findFirst({
        where: {
          contactId: contact.id,
          tenantId: context.tenantId,
          status: 'CONFIRMED',
          startTime: { gte: new Date() },
        },
        orderBy: { startTime: 'asc' },
      });
    }

    if (!appointment) {
      return { success: false, error: 'No upcoming confirmed appointment found to reschedule.' };
    }

    const newStart = dayjs.tz(`${newDateStr} ${newTimeStr}`, 'YYYY-MM-DD HH:mm', timezone);
    if (!newStart.isValid()) {
      return { success: false, error: `Invalid date/time: ${newDateStr} ${newTimeStr}` };
    }
    if (newStart.isBefore(dayjs())) {
      return { success: false, error: 'Cannot reschedule to a past time.' };
    }

    const newEnd = newStart.add(slotDurationMin, 'minute');

    const calendarService = await getCalendar(context.tenantId);
    const busySlots = await calendarService.getBusySlots(
      newStart.utc().toDate(),
      newEnd.utc().toDate()
    );
    if (busySlots.length > 0) {
      return {
        success: false,
        error: 'The new time slot is not available. Please choose a different time.',
      };
    }

    if (appointment.calendarEventId) {
      await calendarService.updateEvent(appointment.calendarEventId, {
        start: newStart.utc().toDate(),
        end: newEnd.utc().toDate(),
      });
    }

    const oldTime = formatDateTime(appointment.startTime, timezone);

    await prisma.appointment.update({
      where: { id: appointment.id },
      data: {
        startTime: newStart.utc().toDate(),
        endTime: newEnd.utc().toDate(),
        status: 'CONFIRMED',
      },
    });

    // Reschedule reminders for the new appointment time
    await rescheduleAppointmentReminders(appointment.id, context.tenantId, contact.id);

    return {
      success: true,
      data: {
        appointmentId: appointment.id,
        title: appointment.title,
        oldTime,
        newTime: formatDateTime(newStart.toDate(), timezone),
        message: `Your appointment "${appointment.title}" has been rescheduled from ${oldTime} to ${formatDateTime(newStart.toDate(), timezone)}.`,
      },
    };
  } catch (error) {
    logger.error({ error }, 'Error rescheduling appointment');
    return { success: false, error: 'Failed to reschedule appointment. Please try again.' };
  }
}

/**
 * List a contact's upcoming appointments — multi-tenant aware.
 */
export async function listAppointments(
  args: Record<string, unknown>,
  context: AgentContext
): Promise<ToolResult> {
  try {
    const { timezone } = context.businessSettings;

    const contact = await prisma.contact.findUnique({
      where: {
        tenantId_phone: {
          tenantId: context.tenantId,
          phone: context.contactPhone,
        },
      },
    });

    if (!contact) {
      return { success: true, data: { appointments: [], message: 'No appointments found.' } };
    }

    const appointments = await prisma.appointment.findMany({
      where: {
        contactId: contact.id,
        tenantId: context.tenantId,
        status: 'CONFIRMED',
        startTime: { gte: new Date() },
      },
      orderBy: { startTime: 'asc' },
      take: 10,
    });

    if (appointments.length === 0) {
      return { success: true, data: { appointments: [], message: 'You have no upcoming appointments.' } };
    }

    const formatted = appointments.map((apt) => ({
      id: apt.id,
      title: apt.title,
      dateTime: formatDateTime(apt.startTime, timezone),
      date: formatDate(apt.startTime, timezone),
      time: `${formatTime(apt.startTime, timezone)} - ${formatTime(apt.endTime, timezone)}`,
    }));

    return {
      success: true,
      data: { count: formatted.length, appointments: formatted },
    };
  } catch (error) {
    logger.error({ error }, 'Error listing appointments');
    return { success: false, error: 'Failed to retrieve appointments.' };
  }
}

/**
 * List available service types for the business.
 */
export async function listServices(
  _args: Record<string, unknown>,
  context: AgentContext
): Promise<ToolResult> {
  const { serviceTypes, slotDurationMin } = context.businessSettings;

  if (serviceTypes.length === 0) {
    return {
      success: true,
      data: {
        services: [],
        defaultDuration: slotDurationMin,
        message: `All appointments use the standard ${slotDurationMin}-minute slot.`,
      },
    };
  }

  const formatted = serviceTypes.map((st) => ({
    name: st.name,
    duration: `${st.duration} minutes`,
    price: st.price !== null ? `$${st.price}` : 'Contact for pricing',
    description: st.description || '',
  }));

  return {
    success: true,
    data: {
      count: formatted.length,
      services: formatted,
    },
  };
}
