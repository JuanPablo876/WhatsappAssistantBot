import type { AIToolDefinition } from '../types';

export const adminToolDefinitions: AIToolDefinition[] = [
  // ─── Retrieval Tools ─────────────────────────────────
  {
    type: 'function',
    function: {
      name: 'brave_web_search',
      description:
        'Search the web using Brave Search API. Use for researching APIs, libraries, best practices, documentation, and technical topics. Returns structured search results with titles, URLs, and snippets.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'The search query. Be specific and technical for best results.',
          },
          count: {
            type: 'number',
            description: 'Number of results to return (1-10, default 5)',
          },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'fetch_url',
      description:
        'Fetch the text content of a URL. HTTPS only. Returns stripped text (no HTML/scripts). Use for reading documentation pages, API references, and articles found via search. Max 500KB.',
      parameters: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: 'The HTTPS URL to fetch. Must start with https://',
          },
        },
        required: ['url'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_skills',
      description:
        'Search existing knowledge skills in the database. Always check existing skills before doing web research to avoid duplicates.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search terms to match against skill titles, summaries, categories, and tags',
          },
          category: {
            type: 'string',
            description: 'Optional category filter (e.g., "api-integration", "workflow", "product-knowledge")',
          },
          enabled_only: {
            type: 'boolean',
            description: 'If true, only return enabled skills (default true)',
          },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'read_skill',
      description:
        'Read the full details of a specific knowledge skill, including all sources and guidance.',
      parameters: {
        type: 'object',
        properties: {
          skill_id: {
            type: 'string',
            description: 'The ID of the skill to read',
          },
        },
        required: ['skill_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'recommend_skill',
      description:
        'Check if a topic already has existing skills before proposing a new one. Returns matching skills ranked by relevance. Use this before propose_skill to avoid duplicates.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'The topic or capability to check for existing skills',
          },
        },
        required: ['query'],
      },
    },
  },

  // ─── Skill Writing Tools ─────────────────────────────
  {
    type: 'function',
    function: {
      name: 'propose_skill',
      description:
        'Create a new knowledge skill in the database. The skill is usable immediately as knowledge and guidance. It is NOT executable code. Always search existing skills first to avoid duplicates.',
      parameters: {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            description: 'Clear, descriptive title for the skill',
          },
          category: {
            type: 'string',
            description: 'Category: "api-integration", "workflow", "product-knowledge", "troubleshooting", "best-practice", or custom',
          },
          summary: {
            type: 'string',
            description: 'Concise summary of what this skill covers (1-3 sentences)',
          },
          workflow_guidance: {
            type: 'string',
            description: 'Step-by-step guidance for using this knowledge. Markdown formatting allowed.',
          },
          implementation_notes: {
            type: 'string',
            description: 'Technical notes for developers who may later convert this to native code',
          },
          tags: {
            type: 'array',
            items: { type: 'string' },
            description: 'Tags for searchability (e.g., ["sendgrid", "email", "notifications"])',
          },
          source_urls: {
            type: 'array',
            items: { type: 'string' },
            description: 'URLs of sources used to compile this skill',
          },
          code_snippets: {
            type: 'array',
            items: { type: 'string' },
            description: 'Vetted code snippets as reference (knowledge only, not for runtime execution)',
          },
          priority: {
            type: 'number',
            description: 'Priority level (0=normal, 1=important, 2=critical)',
          },
        },
        required: ['title', 'category', 'summary', 'workflow_guidance'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_skill',
      description:
        'Update an existing knowledge skill. Can modify any field. Cannot update archived skills.',
      parameters: {
        type: 'object',
        properties: {
          skill_id: {
            type: 'string',
            description: 'The ID of the skill to update',
          },
          title: { type: 'string', description: 'Updated title' },
          category: { type: 'string', description: 'Updated category' },
          summary: { type: 'string', description: 'Updated summary' },
          workflow_guidance: { type: 'string', description: 'Updated workflow guidance' },
          implementation_notes: { type: 'string', description: 'Updated implementation notes' },
          tags: { type: 'array', items: { type: 'string' }, description: 'Updated tags' },
          code_snippets: { type: 'array', items: { type: 'string' }, description: 'Updated code snippets' },
          priority: { type: 'number', description: 'Updated priority' },
        },
        required: ['skill_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'archive_skill',
      description:
        'Archive a knowledge skill. Archived skills are hidden from search and no longer usable. Use instead of deleting to preserve audit trail.',
      parameters: {
        type: 'object',
        properties: {
          skill_id: {
            type: 'string',
            description: 'The ID of the skill to archive',
          },
          reason: {
            type: 'string',
            description: 'Reason for archiving (e.g., "duplicate", "outdated", "low-value")',
          },
        },
        required: ['skill_id'],
      },
    },
  },

  // ─── WhatsApp Tools ──────────────────────────────────
  {
    type: 'function',
    function: {
      name: 'list_whatsapp_contacts',
      description:
        'List contacts and recent conversations from WhatsApp. Returns phone numbers, names, and last message timestamps. Use this to find who to message.',
      parameters: {
        type: 'object',
        properties: {
          search: {
            type: 'string',
            description: 'Optional search term to filter contacts by name or phone number',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of contacts to return (default 20, max 50)',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'send_whatsapp_message',
      description:
        'Send a WhatsApp message to a phone number. The message is sent via the configured WhatsApp channel. Use list_whatsapp_contacts first to find valid recipients.',
      parameters: {
        type: 'object',
        properties: {
          phone_number: {
            type: 'string',
            description: 'The phone number to send to, with country code (e.g., "5213318888888")',
          },
          message: {
            type: 'string',
            description: 'The message text to send. Keep it concise and professional.',
          },
          tenant_id: {
            type: 'string',
            description: 'Optional: specific tenant ID to send from. If not provided, uses the first active WhatsApp config.',
          },
        },
        required: ['phone_number', 'message'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_conversation_history',
      description:
        'Get recent message history with a specific WhatsApp contact. Useful for understanding context before sending a follow-up.',
      parameters: {
        type: 'object',
        properties: {
          phone_number: {
            type: 'string',
            description: 'The phone number to get history for (with country code)',
          },
          limit: {
            type: 'number',
            description: 'Number of recent messages to retrieve (default 10, max 50)',
          },
        },
        required: ['phone_number'],
      },
    },
  },

  // ─── Skill Discovery Tools ───────────────────────────
  {
    type: 'function',
    function: {
      name: 'search_openclaw_skills',
      description:
        'Search the web for API integrations, skills, and automation resources. Uses Brave Search to find GitHub repos, documentation, and tutorials. Best for discovering how to integrate with external services like OpenTable, Stripe, Twilio, etc.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query for integrations/APIs (e.g., "OpenTable API", "restaurant reservation integration", "Stripe payments")',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of results (default 10, max 20)',
          },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_openclaw_skill_details',
      description:
        '[DEPRECATED] Use fetch_url instead to get documentation from any URL.',
      parameters: {
        type: 'object',
        properties: {
          skill_path: {
            type: 'string',
            description: 'URL to fetch (use fetch_url instead)',
          },
        },
        required: ['skill_path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'import_openclaw_skill',
      description:
        '[DEPRECATED] Use propose_skill instead to create skills from fetched documentation.',
      parameters: {
        type: 'object',
        properties: {
          skill_path: {
            type: 'string',
            description: 'Not used - use propose_skill instead',
          },
        },
        required: ['skill_path'],
      },
    },
  },
];
