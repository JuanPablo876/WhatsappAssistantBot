import type { AIToolDefinition, ToolHandler } from './types';
import {
  checkAvailability,
  createAppointment,
  cancelAppointment,
  rescheduleAppointment,
  listAppointments,
  listServices,
  makeCall,
  searchPlaces,
  getPlaceDetails,
  bookExternal,
  webSearchTool,
  discoverTools,
  thinkStep,
  lookupSkill,
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
  {
    type: 'function',
    function: {
      name: 'make_call',
      description: 'Make an outbound phone call to a customer. Use this when the customer requests a call back or when you need to call them for important matters like appointment confirmations.',
      parameters: {
        type: 'object',
        properties: {
          phone_number: {
            type: 'string',
            description: 'The phone number to call in E.164 format (e.g., +1234567890). If not provided, will call the current customer.',
          },
          greeting: {
            type: 'string',
            description: 'The initial message to say when the call is answered. Should be friendly and explain the purpose of the call.',
          },
          reason: {
            type: 'string',
            description: 'Internal note about why this call is being made (e.g., "appointment confirmation", "customer callback request").',
          },
        },
        required: ['greeting'],
      },
    },
  },
  // ═══════════════════════════════════════════════════════════
  // CONCIERGE / EXTERNAL BOOKING TOOLS
  // ═══════════════════════════════════════════════════════════
  {
    type: 'function',
    function: {
      name: 'search_places',
      description: 'Search for nearby businesses like spas, restaurants, salons, hotels, etc. IMPORTANT: Always ask the user for their location/city BEFORE searching. Use this when the user wants to find or book at an external business.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'What to search for (e.g., "spa", "italian restaurant", "hair salon", "hotel")',
          },
          location: {
            type: 'string',
            description: 'The city, address, or area to search in. REQUIRED - always ask the user for this first!',
          },
          min_rating: {
            type: 'number',
            description: 'Minimum rating filter (1-5). Use 4+ for "good" or "well-reviewed" places.',
          },
        },
        required: ['query', 'location'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_place_details',
      description: 'Get detailed information about a specific business including phone number, hours, reviews, and website. Use after search_places to get more info about a place the user is interested in.',
      parameters: {
        type: 'object',
        properties: {
          place_id: {
            type: 'string',
            description: 'The Google Place ID from a previous search result',
          },
          place_name: {
            type: 'string',
            description: 'The name of the place (for reference in response)',
          },
        },
        required: ['place_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'book_external',
      description: 'Help the user book/reserve at an external business by calling them. Use this after the user has selected a specific place and wants to make a reservation.',
      parameters: {
        type: 'object',
        properties: {
          business_name: {
            type: 'string',
            description: 'Name of the business to call',
          },
          phone_number: {
            type: 'string',
            description: 'Phone number of the business to call',
          },
          reservation_details: {
            type: 'string',
            description: 'Details to mention: date, time, party size, service type, customer name, etc.',
          },
          customer_name: {
            type: 'string',
            description: 'Name to make the reservation under',
          },
        },
        required: ['business_name', 'phone_number', 'reservation_details'],
      },
    },
  },
  // ═══════════════════════════════════════════════════════════
  // WEB SEARCH TOOL
  // ═══════════════════════════════════════════════════════════
  {
    type: 'function',
    function: {
      name: 'web_search',
      description: 'Search the web for information. Use this to look up facts, current events, business info, reviews, or any other information the user asks about that you don\'t know.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'The search query',
          },
        },
        required: ['query'],
      },
    },
  },
  // ═══════════════════════════════════════════════════════════
  // META / REASONING TOOLS
  // ═══════════════════════════════════════════════════════════
  {
    type: 'function',
    function: {
      name: 'discover_tools',
      description: 'Search for available tools and skills by keyword. Use this when you need to find what capabilities you have for a specific task, or when the user asks something you\'re unsure how to handle.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'What kind of capability or task are you looking for? (e.g., "booking", "search", "call", "reservation")',
          },
          include_skills: {
            type: 'boolean',
            description: 'Whether to also search database-backed skills (default: true)',
          },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'think',
      description: 'Record your reasoning or thinking process. Use this for complex multi-step tasks to plan your approach, note observations, or reflect on what you\'ve learned. This helps you stay organized.',
      parameters: {
        type: 'object',
        properties: {
          thought: {
            type: 'string',
            description: 'Your thought, observation, plan, or reflection',
          },
          step_type: {
            type: 'string',
            enum: ['thought', 'observation', 'plan', 'reflection'],
            description: 'Type of reasoning step (default: thought)',
          },
          confidence: {
            type: 'number',
            description: 'How confident you are in this reasoning (0-1, optional)',
          },
        },
        required: ['thought'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'lookup_skill',
      description: 'Look up a specific skill by ID to get its full guidance and implementation details. Use after discover_tools returns a matching skill.',
      parameters: {
        type: 'object',
        properties: {
          skill_id: {
            type: 'string',
            description: 'The skill ID to look up',
          },
        },
        required: ['skill_id'],
      },
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
  make_call: makeCall,
  // Concierge tools
  search_places: searchPlaces,
  get_place_details: getPlaceDetails,
  book_external: bookExternal,
  // Web search
  web_search: webSearchTool,
  // Meta / Reasoning tools
  discover_tools: discoverTools,
  think: thinkStep,
  lookup_skill: lookupSkill,
};
