# WhatsApp AI Assistant — Multi-Tenant SaaS

A multi-tenant SaaS platform where business owners sign in with Google, describe their business, and get an AI-powered WhatsApp assistant that handles conversations and books appointments on Google Calendar.

## Features

- **Multi-tenant** — Each business owner gets their own AI bot
- **Google OAuth** — Sign in with Google, Calendar access included
- **AI Onboarding** — Describe your business, AI generates the perfect prompt
- **WhatsApp Integration** — Two options:
  - **Cloud API** (Meta official) — reliable, for production
  - **Baileys** (WhatsApp Web) — free, for testing/small scale
- **Google Calendar Sync** — Appointments auto-sync to the business owner's calendar
- **ElevenLabs Voice** (Pro plan) — AI voice messages and phone calls
- **Pricing Tiers** — Free, Basic ($29/mo), Pro ($79/mo)

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15 (App Router), React 19, Tailwind CSS v4 |
| Auth | Supabase Auth (Google OAuth) |
| Database | Supabase PostgreSQL + Prisma ORM |
| AI | OpenAI GPT-4o-mini (function calling) |
| Calendar | Google Calendar API (per-tenant OAuth) |
| WhatsApp | Meta Cloud API + Baileys |
| Voice | ElevenLabs (text-to-speech) |

## Project Structure

```
src/
├── app/                        # Next.js App Router
│   ├── page.tsx                # Landing page
│   ├── login/                  # Google OAuth login
│   ├── auth/callback/          # OAuth callback
│   ├── dashboard/              # Protected dashboard
│   │   ├── page.tsx            # Overview
│   │   ├── onboarding/         # Setup wizard
│   │   ├── conversations/      # Chat history
│   │   ├── appointments/       # Appointment management
│   │   ├── whatsapp/           # WhatsApp connection
│   │   ├── voice/              # Voice & Calls (Pro)
│   │   ├── settings/           # Business settings & AI prompt
│   │   └── billing/            # Plans & pricing
│   └── api/                    # API Routes
│       ├── onboarding/         # Prompt generation
│       ├── settings/           # Save settings
│       ├── whatsapp/           # WhatsApp config
│       ├── voice/              # Voice config
│       └── webhooks/whatsapp/  # Meta webhook receiver
├── lib/
│   ├── bot/                    # Core bot engine
│   │   ├── agent-service.ts    # Multi-tenant AI agent
│   │   ├── tool-handlers.ts    # Tool implementations
│   │   ├── tools.ts            # Tool definitions
│   │   ├── google-calendar.ts  # Calendar API (OAuth)
│   │   ├── conversation-service.ts
│   │   ├── message-handler.ts  # Message routing
│   │   ├── channels/           # WhatsApp channels
│   │   └── worker.ts           # Baileys worker process
│   ├── voice/
│   │   └── elevenlabs.ts       # ElevenLabs TTS
│   ├── supabase/               # Auth helpers
│   └── db.ts                   # Prisma client
└── middleware.ts               # Route protection
```

## Getting Started

### Prerequisites

- Node.js 18+
- A Supabase project (free tier works)
- An OpenAI API key
- A Google Cloud project with Calendar API enabled

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Fill in your Supabase, OpenAI, and Google OAuth credentials
```

### 3. Set up Supabase Auth

1. Go to Supabase Dashboard → Authentication → Providers
2. Enable Google provider
3. Add your Google OAuth Client ID and Secret
4. Add redirect URL: `https://your-project.supabase.co/auth/v1/callback`

### 4. Set up database

```bash
npm run db:push    # Push schema to Supabase
npm run db:generate # Generate Prisma client
```

### 5. Run the app

```bash
npm run dev        # Start Next.js dev server (port 3000)
```

For Baileys (WhatsApp Web) connections:
```bash
npm run bot:worker # Start the Baileys worker process
```

### 6. Set up WhatsApp webhook (Cloud API)

Configure your Meta webhook URL as:
```
https://your-domain.com/api/webhooks/whatsapp?tenantId=TENANT_ID
```

## Scripts

| Command | Description |
|---------|------------|
| `npm run dev` | Start Next.js dev server |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run bot:worker` | Start Baileys worker for WhatsApp Web connections |
| `npm run db:push` | Push Prisma schema to database |
| `npm run db:generate` | Generate Prisma client |
| `npm run db:studio` | Open Prisma Studio (database GUI) |

## Architecture

### How messages flow

1. **Cloud API**: Meta sends webhook → `/api/webhooks/whatsapp?tenantId=X` → `AgentService` → AI processes with tools → response sent back via Cloud API
2. **Baileys**: Bot worker connects to WhatsApp Web per tenant → messages arrive via WebSocket → `AgentService` → response sent back via Baileys socket

### Multi-tenant isolation

- Each tenant has their own: contacts, conversations, appointments, WhatsApp config, voice config
- Google Calendar uses the tenant's own OAuth tokens (their calendar)
- AI system prompt is customized per-tenant based on their business profile
- All database queries are scoped by `tenantId`

## License

MIT
