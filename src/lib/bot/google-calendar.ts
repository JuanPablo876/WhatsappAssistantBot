import { google, calendar_v3 } from 'googleapis';
import { logger } from './logger';
import type { CalendarEvent, TimeSlot } from './types';

/**
 * Multi-tenant Google Calendar service.
 * Uses the tenant's OAuth access/refresh tokens (obtained during Google sign-in).
 */
export class GoogleCalendarService {
  private calendar: calendar_v3.Calendar;
  private calendarId = 'primary'; // Each user's primary calendar
  private tenantId?: string;

  constructor(accessToken: string, refreshToken: string, tenantId?: string) {
    this.tenantId = tenantId;

    const port = process.env.PORT || '3005';
    const baseUrl = process.env.NEXTAUTH_URL || `http://localhost:${port}`;

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      `${baseUrl}/api/auth/google/callback`
    );

    oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    // Auto-refresh: when tokens are refreshed, save them to the DB
    oauth2Client.on('tokens', async (tokens) => {
      if (this.tenantId) {
        try {
          const { prisma } = await import('@/lib/db');
          await prisma.tenant.update({
            where: { id: this.tenantId },
            data: {
              googleAccessToken: tokens.access_token || undefined,
              googleTokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
            },
          });
          logger.info({ tenantId: this.tenantId }, 'Google Calendar tokens refreshed');
        } catch (err) {
          logger.error({ err }, 'Failed to save refreshed Google tokens');
        }
      }
    });

    this.calendar = google.calendar({ version: 'v3', auth: oauth2Client });
  }

  async getBusySlots(startDate: Date, endDate: Date): Promise<TimeSlot[]> {
    try {
      const response = await this.calendar.freebusy.query({
        requestBody: {
          timeMin: startDate.toISOString(),
          timeMax: endDate.toISOString(),
          items: [{ id: this.calendarId }],
        },
      });

      const busy = response.data.calendars?.[this.calendarId]?.busy || [];
      return busy.map((slot) => ({
        start: new Date(slot.start!),
        end: new Date(slot.end!),
      }));
    } catch (error) {
      logger.error({ error }, 'Failed to fetch busy slots from Google Calendar');
      throw error;
    }
  }

  async createEvent(event: CalendarEvent): Promise<string> {
    try {
      const response = await this.calendar.events.insert({
        calendarId: this.calendarId,
        requestBody: {
          summary: event.title,
          description: event.description || '',
          start: { dateTime: event.start.toISOString() },
          end: { dateTime: event.end.toISOString() },
          attendees: event.attendeeEmail
            ? [{ email: event.attendeeEmail, displayName: event.attendeeName }]
            : undefined,
          reminders: {
            useDefault: false,
            overrides: [{ method: 'popup', minutes: 30 }],
          },
        },
      });

      const eventId = response.data.id!;
      logger.info({ eventId, title: event.title }, 'Google Calendar event created');
      return eventId;
    } catch (error) {
      logger.error({ error }, 'Failed to create Google Calendar event');
      throw error;
    }
  }

  async updateEvent(eventId: string, updates: Partial<CalendarEvent>): Promise<void> {
    try {
      const requestBody: any = {};
      if (updates.title) requestBody.summary = updates.title;
      if (updates.description) requestBody.description = updates.description;
      if (updates.start) requestBody.start = { dateTime: updates.start.toISOString() };
      if (updates.end) requestBody.end = { dateTime: updates.end.toISOString() };

      await this.calendar.events.patch({
        calendarId: this.calendarId,
        eventId,
        requestBody,
      });
      logger.info({ eventId }, 'Google Calendar event updated');
    } catch (error) {
      logger.error({ error, eventId }, 'Failed to update Google Calendar event');
      throw error;
    }
  }

  async cancelEvent(eventId: string): Promise<void> {
    try {
      await this.calendar.events.delete({
        calendarId: this.calendarId,
        eventId,
      });
      logger.info({ eventId }, 'Google Calendar event cancelled');
    } catch (error) {
      logger.error({ error, eventId }, 'Failed to cancel Google Calendar event');
      throw error;
    }
  }

  async listEvents(startDate: Date, endDate: Date): Promise<CalendarEvent[]> {
    try {
      const response = await this.calendar.events.list({
        calendarId: this.calendarId,
        timeMin: startDate.toISOString(),
        timeMax: endDate.toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
      });

      return (response.data.items || []).map((item) => ({
        id: item.id || undefined,
        title: item.summary || 'Untitled',
        description: item.description || undefined,
        start: new Date(item.start?.dateTime || item.start?.date || ''),
        end: new Date(item.end?.dateTime || item.end?.date || ''),
      }));
    } catch (error) {
      logger.error({ error }, 'Failed to list Google Calendar events');
      throw error;
    }
  }
}
