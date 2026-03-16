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

/**
 * Make an outbound phone call to a customer.
 */
export async function makeCall(
  args: Record<string, unknown>,
  context: AgentContext
): Promise<ToolResult> {
  try {
    // Check if calls are enabled for this tenant
    const tenant = await prisma.tenant.findUnique({
      where: { id: context.tenantId },
      include: {
        voiceConfig: true,
        businessProfile: true,
      },
    });

    if (!tenant?.voiceConfig?.callsEnabled) {
      return {
        success: false,
        error: 'Phone calls are not enabled for this business. Please enable them in Dashboard → Voice settings.',
      };
    }

    // Import Twilio module dynamically to avoid circular dependencies
    const { makeOutboundCall, isTwilioConfigured } = await import('@/lib/voice/twilio');

    if (!isTwilioConfigured()) {
      return {
        success: false,
        error: 'Twilio phone service is not configured. Please set up Twilio credentials.',
      };
    }

    // Get the phone number to call
    let phoneNumber = args.phone_number as string | undefined;
    
    if (!phoneNumber) {
      // Use the current customer's phone if not specified
      phoneNumber = context.contactPhone;
    }

    if (!phoneNumber) {
      return {
        success: false,
        error: 'No phone number provided and could not determine customer phone number.',
      };
    }

    // Normalize phone number
    const normalizedPhone = phoneNumber.startsWith('+') ? phoneNumber : `+${phoneNumber.replace(/\D/g, '')}`;

    const greeting = args.greeting as string || 
      `Hello, this is ${tenant.businessProfile?.businessName || tenant.name || 'your service provider'}. How can I assist you today?`;
    
    const reason = args.reason as string || 'AI-initiated callback';

    logger.info({ 
      tenantId: context.tenantId, 
      phone: normalizedPhone, 
      reason 
    }, 'AI agent initiating outbound call');

    // Make the call
    const result = await makeOutboundCall(normalizedPhone, {
      tenantId: context.tenantId,
      greeting,
      recordCall: tenant.voiceConfig.callRecordingEnabled ?? false,
      timeout: 30,
    });

    return {
      success: true,
      data: {
        callSid: result.callSid,
        status: result.status,
        phoneNumber: normalizedPhone,
        greeting,
        message: `Call initiated to ${normalizedPhone}. The call is now ${result.status}. The customer will receive the call momentarily.`,
      },
    };
  } catch (error) {
    logger.error({ error, args }, 'Error making outbound call');
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      error: `Failed to initiate call: ${errorMessage}`,
    };
  }
}

// ═══════════════════════════════════════════════════════════
// CONCIERGE TOOLS - External business search & booking
// ═══════════════════════════════════════════════════════════

/**
 * Search for nearby businesses (spas, restaurants, hotels, etc.)
 * Uses Brave Search or Google Places, depending on configuration.
 */
export async function searchPlaces(
  args: Record<string, unknown>,
  context: AgentContext
): Promise<ToolResult> {
  try {
    const { searchBusinesses, formatSearchResultsForChat } = await import('./search-providers');
    
    const query = args.query as string;
    const location = args.location as string;
    const minRating = args.min_rating as number | undefined;

    if (!query) {
      return {
        success: false,
        error: 'Please specify what type of place you\'re looking for (e.g., "spa", "restaurant").',
      };
    }

    if (!location) {
      return {
        success: false,
        error: 'I need to know where to search. What city or area are you looking in?',
      };
    }

    const results = await searchBusinesses(query, location, 5);

    // Filter by rating if requested
    const filtered = minRating 
      ? results.filter(r => !r.rating || r.rating >= minRating)
      : results;

    if (filtered.length === 0) {
      return {
        success: true,
        data: {
          message: `I couldn't find any "${query}" in ${location}. Try a different location or search term.`,
          businesses: [],
        },
      };
    }

    // Format results for the AI to present nicely
    const formatted = filtered.map((b, i) => ({
      number: i + 1,
      placeId: b.placeId || `${b.name}-${i}`, // Use placeId if available (Google)
      name: b.name,
      address: b.address || 'Address not available',
      rating: b.rating ? `${b.rating}★${b.reviewCount ? ` (${b.reviewCount} reviews)` : ''}` : 'Not rated',
      priceLevel: b.priceLevel || '',
      phone: b.phone || null,
      website: b.website || null,
      source: b.source,
    }));

    return {
      success: true,
      data: {
        searchQuery: query,
        location,
        count: formatted.length,
        businesses: formatted,
        message: `Found ${formatted.length} ${query} options in ${location}. Ask the user which one they'd like more details about, or if they want to make a reservation.`,
      },
    };
  } catch (error) {
    logger.error({ error, args }, 'Error searching places');
    return {
      success: false,
      error: 'Failed to search for places. Please try again.',
    };
  }
}

/**
 * Get detailed information about a specific business
 */
export async function getPlaceDetails(
  args: Record<string, unknown>,
  context: AgentContext
): Promise<ToolResult> {
  try {
    const { googlePlaceDetails } = await import('./search-providers');
    
    const placeId = args.place_id as string;
    const placeName = args.place_name as string || 'this place';

    if (!placeId) {
      return {
        success: false,
        error: 'Missing place ID. Use search_places first to find businesses.',
      };
    }

    const result = await googlePlaceDetails(placeId);

    if (!result) {
      return {
        success: false,
        error: 'Could not get business details. The place ID may be invalid.',
      };
    }
    
    return {
      success: true,
      data: {
        name: result.name,
        address: result.address || 'Not available',
        phone: result.phone || 'Not available',
        rating: result.rating ? `${result.rating}★${result.reviewCount ? ` (${result.reviewCount} reviews)` : ''}` : 'Not rated',
        priceLevel: result.priceLevel || 'Not specified',
        website: result.website || 'Not available',
        hours: result.hours || 'Hours not available',
        canCall: !!result.phone,
        message: result.phone 
          ? `Here are the details for ${result.name}. If the user wants to make a reservation, use the book_external tool with the phone number.`
          : `Here are the details for ${result.name}. Unfortunately, no phone number is available for booking.`,
      },
    };
  } catch (error) {
    logger.error({ error, args }, 'Error getting place details');
    return {
      success: false,
      error: 'Failed to get place details.',
    };
  }
}

/**
 * Book/reserve at an external business by calling them
 */
export async function bookExternal(
  args: Record<string, unknown>,
  context: AgentContext
): Promise<ToolResult> {
  try {
    const businessName = args.business_name as string;
    const phoneNumber = args.phone_number as string;
    const reservationDetails = args.reservation_details as string;
    const customerName = args.customer_name as string || 'Customer';

    if (!businessName || !phoneNumber) {
      return {
        success: false,
        error: 'Missing business name or phone number for booking.',
      };
    }

    if (!reservationDetails) {
      return {
        success: false,
        error: 'Please provide reservation details (date, time, party size, service type, etc.).',
      };
    }

    // Check if calls are enabled
    const tenant = await prisma.tenant.findUnique({
      where: { id: context.tenantId },
      include: { voiceConfig: true, businessProfile: true },
    });

    if (!tenant?.voiceConfig?.callsEnabled) {
      // If calls aren't enabled, provide the info for manual booking
      return {
        success: true,
        data: {
          manualBooking: true,
          businessName,
          phone: phoneNumber,
          details: reservationDetails,
          message: `Phone calls are not enabled. Please have the customer call ${businessName} directly at ${phoneNumber} with these details: ${reservationDetails}`,
        },
      };
    }

    // Import Twilio module
    const { makeOutboundCall, isTwilioConfigured } = await import('@/lib/voice/twilio');

    if (!isTwilioConfigured()) {
      return {
        success: true,
        data: {
          manualBooking: true,
          businessName,
          phone: phoneNumber,
          details: reservationDetails,
          message: `Twilio is not configured. Please have the customer call ${businessName} directly at ${phoneNumber}.`,
        },
      };
    }

    // Normalize phone number
    const normalizedPhone = phoneNumber.startsWith('+') 
      ? phoneNumber 
      : `+${phoneNumber.replace(/\D/g, '')}`;

    // Create a greeting for the business
    const greeting = `Hello, I'm calling on behalf of ${customerName} to make a reservation. ${reservationDetails}. Is that available?`;

    logger.info({ 
      tenantId: context.tenantId, 
      business: businessName,
      phone: normalizedPhone,
      details: reservationDetails,
    }, 'AI agent calling external business for reservation');

    // Make the call to the business
    const result = await makeOutboundCall(normalizedPhone, {
      tenantId: context.tenantId,
      greeting,
      recordCall: true, // Record external booking calls for reference
      timeout: 45, // Give more time for business to answer
    });

    return {
      success: true,
      data: {
        callSid: result.callSid,
        status: result.status,
        businessName,
        phoneNumber: normalizedPhone,
        reservationDetails,
        customerName,
        message: `I'm now calling ${businessName} at ${phoneNumber} to make your reservation. The call status is: ${result.status}. I'll attempt to book: ${reservationDetails}. Please wait for confirmation.`,
      },
    };
  } catch (error) {
    logger.error({ error, args }, 'Error booking at external business');
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      error: `Failed to call the business: ${errorMessage}. You can try calling them directly.`,
    };
  }
}

// ═══════════════════════════════════════════════════════════
// WEB SEARCH TOOL
// ═══════════════════════════════════════════════════════════

/**
 * Search the web for information.
 * Uses Brave Search or Google Custom Search depending on configuration.
 */
export async function webSearchTool(
  args: Record<string, unknown>,
  context: AgentContext
): Promise<ToolResult> {
  try {
    const { webSearch } = await import('./search-providers');
    
    const query = args.query as string;

    if (!query) {
      return {
        success: false,
        error: 'Please provide a search query.',
      };
    }

    const results = await webSearch(query, 5);

    if (results.length === 0) {
      // Check if search is configured
      if (!process.env.BRAVE_SEARCH_API_KEY && !process.env.GOOGLE_SEARCH_API_KEY) {
        return {
          success: false,
          error: 'Web search is not configured. Please set up Brave Search or Google Custom Search API.',
        };
      }
      return {
        success: true,
        data: {
          query,
          results: [],
          message: `No results found for "${query}". Try a different search term.`,
        },
      };
    }

    // Format results for the AI
    const formatted = results.map((r, i) => ({
      number: i + 1,
      title: r.title,
      url: r.url,
      description: r.description,
      source: r.source,
    }));

    return {
      success: true,
      data: {
        query,
        count: formatted.length,
        results: formatted,
        message: `Found ${formatted.length} web results. Use these to answer the user's question.`,
      },
    };
  } catch (error) {
    logger.error({ error, args }, 'Error performing web search');
    return {
      success: false,
      error: 'Web search failed. Please try again.',
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// META / REASONING TOOLS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Discover available tools and skills by keyword search
 */
export async function discoverTools(
  args: Record<string, unknown>,
  context: AgentContext
): Promise<ToolResult> {
  try {
    const query = (args.query as string || '').toLowerCase();
    const includeSkills = args.include_skills !== false;

    // Define tool capabilities with metadata
    const toolCapabilities = [
      { name: 'check_availability', category: 'scheduling', keywords: ['availability', 'slots', 'free', 'time', 'date', 'open'], 
        description: 'Check available appointment time slots for a specific date' },
      { name: 'create_appointment', category: 'scheduling', keywords: ['book', 'appointment', 'schedule', 'reserve', 'create'],
        description: 'Book a new appointment for the client' },
      { name: 'cancel_appointment', category: 'scheduling', keywords: ['cancel', 'remove', 'delete', 'appointment'],
        description: 'Cancel an existing appointment' },
      { name: 'reschedule_appointment', category: 'scheduling', keywords: ['reschedule', 'move', 'change', 'appointment', 'new time'],
        description: 'Move an appointment to a new date/time' },
      { name: 'list_appointments', category: 'scheduling', keywords: ['list', 'show', 'appointments', 'upcoming', 'my'],
        description: 'Show client\'s upcoming confirmed appointments' },
      { name: 'list_services', category: 'scheduling', keywords: ['services', 'offerings', 'types', 'prices', 'menu'],
        description: 'List available services with duration and price' },
      { name: 'make_call', category: 'communication', keywords: ['call', 'phone', 'callback', 'ring', 'dial'],
        description: 'Make an outbound phone call to a customer' },
      { name: 'search_places', category: 'concierge', keywords: ['search', 'find', 'nearby', 'places', 'restaurant', 'spa', 'hotel', 'business'],
        description: 'Search for nearby businesses (requires location)' },
      { name: 'get_place_details', category: 'concierge', keywords: ['details', 'info', 'hours', 'phone', 'reviews', 'place'],
        description: 'Get detailed information about a specific business' },
      { name: 'book_external', category: 'concierge', keywords: ['book', 'reserve', 'external', 'restaurant', 'reservation', 'call'],
        description: 'Help book at an external business by calling them' },
      { name: 'web_search', category: 'search', keywords: ['search', 'web', 'google', 'lookup', 'find', 'information', 'facts'],
        description: 'Search the web for information' },
      { name: 'think', category: 'reasoning', keywords: ['think', 'reason', 'plan', 'reflect', 'organize'],
        description: 'Record reasoning steps for complex tasks' },
      { name: 'lookup_skill', category: 'skills', keywords: ['skill', 'lookup', 'knowledge', 'guidance'],
        description: 'Get detailed guidance from a specific skill' },
    ];

    // Search tools by keyword match
    const matchingTools = toolCapabilities.filter(tool => {
      if (tool.name.includes(query)) return true;
      if (tool.category.includes(query)) return true;
      if (tool.description.toLowerCase().includes(query)) return true;
      return tool.keywords.some(k => k.includes(query) || query.includes(k));
    });

    // Search skills from database if requested
    let matchingSkills: { id: string; title: string; summary: string; category: string }[] = [];
    if (includeSkills) {
      try {
        const skills = await prisma.agentSkill.findMany({
          where: {
            reviewStatus: 'REVIEWED',
            OR: [
              { title: { contains: query } },
              { summary: { contains: query } },
              { category: { contains: query } },
            ]
          },
          select: { id: true, title: true, summary: true, category: true },
          take: 5
        });
        matchingSkills = skills.map(s => ({
          id: s.id,
          title: s.title,
          summary: s.summary || '',
          category: s.category
        }));
      } catch {
        // Skill search failed, continue without skills
      }
    }

    const toolResults = matchingTools.map(t => ({
      name: t.name,
      category: t.category,
      description: t.description,
      type: 'tool' as const
    }));

    const skillResults = matchingSkills.map(s => ({
      name: `skill:${s.id.slice(0, 8)}`,
      category: s.category,
      description: `[SKILL] ${s.title}: ${s.summary}`,
      type: 'skill' as const,
      skill_id: s.id
    }));

    const allResults = [...toolResults, ...skillResults];

    if (allResults.length === 0) {
      return {
        success: true,
        data: {
          query,
          results: [],
          message: `No tools or skills found matching "${query}". Available categories: scheduling, communication, concierge, search, reasoning.`,
          hint: 'Try broader terms like "book", "call", "search", or "find".'
        }
      };
    }

    return {
      success: true,
      data: {
        query,
        count: allResults.length,
        results: allResults,
        message: `Found ${allResults.length} matching capabilities. Use these tools to help the user.`
      }
    };
  } catch (error) {
    logger.error({ error, args }, 'Error discovering tools');
    return {
      success: false,
      error: 'Failed to search tools. Use the tools you know about.'
    };
  }
}

/**
 * Record a reasoning step in the scratchpad
 */
export async function thinkStep(
  args: Record<string, unknown>,
  context: AgentContext
): Promise<ToolResult> {
  try {
    const { scratchpad } = await import('./reasoning-scratchpad');
    
    const thought = args.thought as string;
    const stepType = (args.step_type as string) || 'thought';
    const confidence = args.confidence as number | undefined;

    if (!thought) {
      return {
        success: false,
        error: 'Please provide a thought to record.'
      };
    }

    // Use conversation ID or contact phone as session ID
    const sessionId = context.conversationId || context.contactPhone || 'default';

    // Ensure chain exists
    let chain = scratchpad.getChain(sessionId);
    if (!chain) {
      chain = scratchpad.startChain(sessionId, 'Assist with user request');
    }

    // Record the step based on type
    let step;
    switch (stepType) {
      case 'observation':
        step = scratchpad.observe(sessionId, thought);
        break;
      case 'plan':
        step = scratchpad.plan(sessionId, thought);
        break;
      case 'reflection':
        step = scratchpad.reflect(sessionId, thought);
        break;
      default:
        step = scratchpad.think(sessionId, thought, confidence);
    }

    // Get recent context
    const recentSteps = scratchpad.getRecentSteps(sessionId, 5);

    return {
      success: true,
      data: {
        recorded: thought,
        type: stepType,
        totalSteps: chain.steps.length,
        recentContext: recentSteps.map(s => `${s.type}: ${s.content.slice(0, 100)}`),
        message: 'Thought recorded. Continue with your reasoning or take action.'
      }
    };
  } catch (error) {
    logger.error({ error, args }, 'Error recording thought');
    return {
      success: false,
      error: 'Failed to record thought, but continue with your task.'
    };
  }
}

/**
 * Look up a specific skill by ID for detailed guidance
 */
export async function lookupSkill(
  args: Record<string, unknown>,
  context: AgentContext
): Promise<ToolResult> {
  try {
    const skillId = args.skill_id as string;

    if (!skillId) {
      return {
        success: false,
        error: 'Please provide a skill_id to look up.'
      };
    }

    // Handle both full ID and short ID (from discover_tools)
    const skill = await prisma.agentSkill.findFirst({
      where: {
        OR: [
          { id: skillId },
          { id: { startsWith: skillId } }
        ]
      }
    });

    if (!skill) {
      return {
        success: false,
        error: `Skill not found: ${skillId}. Use discover_tools to find available skills.`
      };
    }

    // Update usage count
    await prisma.agentSkill.update({
      where: { id: skill.id },
      data: { 
        usageCount: { increment: 1 },
        lastUsedAt: new Date()
      }
    });

    return {
      success: true,
      data: {
        id: skill.id,
        title: skill.title,
        category: skill.category,
        summary: skill.summary,
        workflow_guidance: skill.workflowGuidance,
        implementation_notes: skill.implementationNotes,
        code_snippets: skill.codeSnippets,
        message: 'Use this guidance to help the user. Follow the workflow steps carefully.'
      }
    };
  } catch (error) {
    logger.error({ error, args }, 'Error looking up skill');
    return {
      success: false,
      error: 'Failed to retrieve skill. Continue with your best judgment.'
    };
  }
}
