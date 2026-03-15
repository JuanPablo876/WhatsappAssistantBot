import type { AIToolDefinition, ToolHandler } from './types';
import {
  checkAvailability,
  createAppointment,
  cancelAppointment,
  rescheduleAppointment,
  listAppointments,
  listServices,
} from './tool-handlers';

export const toolDefinitions: AIToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'check_availability',
      description: 'Check available appointment time slots for a specific date.',
      parameters: {
        type: 'object',
        properties: {
          date: {
            type: 'string',
            description: 'The date to check in YYYY-MM-DD format',
          },
        },
        required: ['date'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_appointment',
      description:
        'Book a new appointment for the client. Only call after confirming date and time.',
      parameters: {
        type: 'object',
        properties: {
          date: { type: 'string', description: 'YYYY-MM-DD format' },
          time: { type: 'string', description: 'HH:mm 24-hour format' },
          title: { type: 'string', description: 'Short title/reason' },
          description: { type: 'string', description: 'Optional additional details' },
          service_type: { type: 'string', description: 'The name or ID of the service type (e.g., "Haircut", "Consultation"). If provided, the appointment duration will match the service type duration instead of the default.' },
        },
        required: ['date', 'time', 'title'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'cancel_appointment',
      description: 'Cancel an existing appointment.',
      parameters: {
        type: 'object',
        properties: {
          appointment_id: {
            type: 'string',
            description: 'The ID to cancel (optional — omit to cancel next upcoming)',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'reschedule_appointment',
      description: 'Reschedule an appointment to a new date/time.',
      parameters: {
        type: 'object',
        properties: {
          new_date: { type: 'string', description: 'New date YYYY-MM-DD' },
          new_time: { type: 'string', description: 'New time HH:mm' },
          appointment_id: {
            type: 'string',
            description: 'The ID to reschedule (optional)',
          },
        },
        required: ['new_date', 'new_time'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_appointments',
      description: "List the client's upcoming confirmed appointments.",
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_services',
      description: 'List the available services/appointment types offered by the business, including their duration and price.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
];

export const toolHandlers: Record<string, ToolHandler> = {
  check_availability: checkAvailability,
  create_appointment: createAppointment,
  cancel_appointment: cancelAppointment,
  reschedule_appointment: rescheduleAppointment,
  list_appointments: listAppointments,
  list_services: listServices,
};
