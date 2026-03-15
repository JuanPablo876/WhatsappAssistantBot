import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import isBetween from 'dayjs/plugin/isBetween';
import customParseFormat from 'dayjs/plugin/customParseFormat';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(isBetween);
dayjs.extend(customParseFormat);

export { dayjs };

export function formatDateTime(date: Date, tz: string): string {
  return dayjs(date).tz(tz).format('dddd, MMMM D, YYYY [at] h:mm A');
}

export function formatTime(date: Date, tz: string): string {
  return dayjs(date).tz(tz).format('h:mm A');
}

export function formatDate(date: Date, tz: string): string {
  return dayjs(date).tz(tz).format('dddd, MMMM D, YYYY');
}

export function parseInTimezone(dateStr: string, format: string, tz: string): Date {
  return dayjs.tz(dateStr, format, tz).utc().toDate();
}

export function startOfDay(date: Date, tz: string): Date {
  return dayjs(date).tz(tz).startOf('day').utc().toDate();
}

export function endOfDay(date: Date, tz: string): Date {
  return dayjs(date).tz(tz).endOf('day').utc().toDate();
}

export function isWorkDay(date: Date, workDays: number[], tz: string): boolean {
  return workDays.includes(dayjs(date).tz(tz).day());
}

export function generateTimeSlots(
  date: Date,
  tz: string,
  startHour: number,
  endHour: number,
  slotDurationMin: number
): { start: Date; end: Date }[] {
  const slots: { start: Date; end: Date }[] = [];
  const dayStart = dayjs(date).tz(tz).startOf('day');
  let current = dayStart.hour(startHour).minute(0).second(0);
  const dayEnd = dayStart.hour(endHour).minute(0).second(0);

  while (
    current.add(slotDurationMin, 'minute').isBefore(dayEnd) ||
    current.add(slotDurationMin, 'minute').isSame(dayEnd)
  ) {
    const slotEnd = current.add(slotDurationMin, 'minute');
    slots.push({ start: current.utc().toDate(), end: slotEnd.utc().toDate() });
    current = slotEnd;
  }
  return slots;
}

export function sanitizePhone(phone: string): string {
  let cleaned = phone.replace(/[^\d+]/g, '');
  if (!cleaned.startsWith('+')) cleaned = `+${cleaned}`;
  return cleaned;
}
