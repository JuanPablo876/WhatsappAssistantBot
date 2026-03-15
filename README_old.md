# 🤖 WhatsApp Assistant Bot

An AI-powered WhatsApp chatbot that schedules appointments using Google Calendar. Built with TypeScript, OpenAI, and a modular architecture that supports both **WhatsApp Cloud API** (production) and **Baileys** (free local development).

## ✨ Features

- **Natural conversation** — AI agent handles appointment scheduling via natural WhatsApp chat
- **Google Calendar integration** — Checks real availability, creates/updates/deletes events
- **Smart scheduling** — Respects business hours, work days, and slot duration
- **Appointment management** — Book, cancel, reschedule, and list appointments
- **Automatic reminders** — Sends WhatsApp reminders before appointments
- **Conversation memory** — Remembers context within a conversation
- **Dual WhatsApp support** — Baileys (free, for development) + Cloud API (production)
- **Budget-friendly AI** — Uses GPT-4o-mini by default (very low cost per conversation)

## 📁 Project Structure

```
src/
├── channels/           # WhatsApp channel abstraction
│   ├── baileys.ts      # Free local dev (WhatsApp Web protocol)
│   ├── cloud-api.ts    # Meta official API (production)
│   └── index.ts        # Channel factory
├── config/             # Environment configuration
├── database/           # Prisma client & seed script
├── providers/          # AI provider abstraction
│   ├── openai.ts       # OpenAI GPT integration
│   └── index.ts        # Provider factory
├── routes/             # Express HTTP routes
│   └── webhook.ts      # WhatsApp Cloud API webhook
├── services/
│   ├── agent/          # Core AI agent logic (conversation loop)
│   ├── calendar/       # Google Calendar service
│   ├── conversation/   # Conversation history management
│   └── reminder/       # Cron-based appointment reminders
├── tools/              # AI function-calling tools
│   ├── handlers.ts     # Tool implementations
│   └── index.ts        # Tool definitions & registry
├── types/              # TypeScript type definitions
├── utils/              # Logger, date helpers
└── index.ts            # Application entry point
```

## 🚀 Quick Start

### Prerequisites

- **Node.js 20+**
- **OpenAI API key** — [Get one here](https://platform.openai.com/api-keys)
- **Google Calendar service account** — [Setup guide below](#google-calendar-setup)
- **WhatsApp** — Either a phone for Baileys, or a Meta Business account for Cloud API

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env with your API keys
```

### 3. Set up the database

```bash
npx prisma generate
npx prisma db push
npm run db:seed
```

### 4. Start the bot

```bash
# Development (with hot reload)
npm run dev

# Production
npm run build
npm start
```

### 5. Connect WhatsApp

**Baileys mode (default):** Scan the QR code that appears in the terminal with your WhatsApp app (Settings → Linked Devices → Link a Device).

**Cloud API mode:** Set `WHATSAPP_CHANNEL=cloud-api` in `.env` and configure your Meta webhook URL to point to `https://your-domain/webhook`.

## 🔧 Google Calendar Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select existing)
3. Enable the **Google Calendar API**
4. Create a **Service Account** (IAM & Admin → Service Accounts)
5. Create a key for the service account (JSON format)
6. Copy the `client_email` and `private_key` from the JSON into your `.env`
7. Go to Google Calendar → Settings → Share your calendar with the service account email (give "Make changes to events" permission)
8. Copy your calendar ID (found in Calendar Settings → Integrate calendar) into `GOOGLE_CALENDAR_ID`

## ⚙️ Configuration

### Business Settings

After seeding the database, you can customize business settings by modifying the `BusinessSettings` table:

| Setting | Default | Description |
|---------|---------|-------------|
| `businessName` | My Business | Shown in appointment confirmations |
| `businessDesc` | — | Business description for AI context |
| `timezone` | America/New_York | Business timezone |
| `slotDurationMin` | 60 | Appointment duration in minutes |
| `workStartHour` | 9 | Business opens (24h format) |
| `workEndHour` | 17 | Business closes (24h format) |
| `workDays` | 1,2,3,4,5 | Working days (0=Sun, 6=Sat) |
| `maxAdvanceDays` | 30 | Max days ahead for booking |
| `reminderMinutes` | 60 | Minutes before appointment to send reminder |
| `systemPrompt` | — | Custom system prompt addition |

### Switching AI Models

Change `AI_MODEL` in `.env`:
- `gpt-4o-mini` — Cheapest, great for scheduling tasks (recommended)
- `gpt-4o` — More capable, higher cost
- `gpt-4-turbo` — Strong reasoning, moderate cost

## 💬 Example Conversation

```
Client: Hi! I'd like to book an appointment
Bot: Hi there! 👋 I'd be happy to help you schedule an appointment. 
     What date works best for you?

Client: How about next Tuesday?
Bot: Let me check availability for Tuesday, March 10...
     
     Here are the available slots:
     • 9:00 AM - 10:00 AM
     • 10:00 AM - 11:00 AM
     • 2:00 PM - 3:00 PM
     • 3:00 PM - 4:00 PM
     
     Which time works for you?

Client: 2 PM please. It's for a consultation.
Bot: ✅ Your appointment is confirmed!
     
     📋 Consultation
     📅 Tuesday, March 10, 2026 at 2:00 PM
     ⏱️ Duration: 1 hour
     
     You'll receive a reminder 1 hour before. 
     Need anything else?
```

## 🏗️ Architecture

The bot uses a **tool-calling agent loop**:

1. User sends a WhatsApp message
2. Message is received by the WhatsApp channel (Baileys or Cloud API)
3. The Agent Service loads conversation history and builds the AI prompt
4. OpenAI processes the message and may call tools (check availability, book, etc.)
5. Tools execute against Google Calendar and the local database
6. The AI generates a human-friendly response
7. Response is sent back via WhatsApp

```
WhatsApp ←→ Channel Layer ←→ Agent Service ←→ AI Provider (OpenAI)
                                    ↕
                              Tool Handlers
                                    ↕
                         Google Calendar + Database
```

## 📄 License

MIT
