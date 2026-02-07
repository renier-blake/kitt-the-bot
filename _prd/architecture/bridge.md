# Message Bridge Architecture

> Hoe de message bridge werkt tussen channels en Claude Agent SDK.
> **Status:** ✅ Geïmplementeerd (F02 + F04)

---

## Overview

De Message Bridge is een Node.js process dat:
1. Messages ontvangt van Telegram (later WhatsApp, Email)
2. Direct de **Claude Agent SDK** aanroept voor verwerking
3. Responses terugstuurt naar de juiste channel
4. **Sessions** beheert voor context persistence

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    KITT Message Bridge                       │
│                                                              │
│  ┌──────────────┐                                           │
│  │ Telegram     │                                           │
│  │ Adapter      │──┐                                        │
│  │ (grammy)     │  │                                        │
│  └──────────────┘  │                                        │
│                    │    ┌──────────────────────────────┐    │
│  ┌──────────────┐  │    │                              │    │
│  │ WhatsApp     │  ├───▶│    Claude Agent SDK          │    │
│  │ (Future)     │  │    │    (query function)          │    │
│  └──────────────┘  │    │                              │    │
│                    │    │  - Full tool access           │    │
│  ┌──────────────┐  │    │  - Session persistence        │    │
│  │ Email        │──┘    │  - KITT workspace context     │    │
│  │ (Future)     │       │                              │    │
│  └──────────────┘       └──────────────────────────────┘    │
│                                   │                          │
│                                   ▼                          │
│                         ┌─────────────────┐                  │
│                         │ KITT Workspace   │                  │
│                         │ - CLAUDE.md      │                  │
│                         │ - MEMORY.md      │                  │
│                         │ - SOUL.md        │                  │
│                         │ - sessions.json  │                  │
│                         └─────────────────┘                  │
└─────────────────────────────────────────────────────────────┘
```

---

## Agent SDK Integration

### Core Pattern (van NanoClaw)

```typescript
import { query } from '@anthropic-ai/claude-agent-sdk';

for await (const message of query({
  prompt: userMessage,
  options: {
    cwd: '/path/to/KITT V1',
    resume: sessionId,  // Session persistence
    allowedTools: ['Bash', 'Read', 'Write', 'Edit', 'Glob', 'Grep', 'WebSearch', 'WebFetch'],
    permissionMode: 'bypassPermissions',
  }
})) {
  // Handle streaming response
  if (message.type === 'system' && message.subtype === 'init') {
    newSessionId = message.session_id;
  }
  if ('result' in message) {
    result = message.result;
  }
}
```

### Session Management

Elke chat (chatId) krijgt een eigen session voor context persistence:

```typescript
// sessions.json
{
  "sessions": {
    "1306998969": {
      "chatId": "1306998969",
      "sessionId": "abc123-def456",
      "lastActivity": "2026-02-05T12:00:00Z",
      "messageCount": 5,
      "displayName": "Renier"
    }
  }
}
```

---

## Channel Adapters

### Telegram (✅ Implemented)
- **Library:** `grammy`
- **Auth:** Bot token via @BotFather
- **Security:** User whitelist via `TELEGRAM_ALLOWED_USERS`
- **Files:** `src/bridge/telegram.ts`

### WhatsApp (🔜 Planned)
- **Library:** `@whiskeysockets/baileys`
- **Auth:** QR code
- **Reference:** `_repos/nanoclaw/src/index.ts`

### Email (🔜 Planned)
- **Library:** Gmail API
- **Auth:** OAuth2
- **Reference:** `_repos/nanoclaw/.claude/skills/add-gmail/`

---

## Trigger Patterns

| Channel | Context | Trigger | Behavior |
|---------|---------|---------|----------|
| Telegram DM | Private | Any message | Always process |
| Telegram Group | Group | `@botname` mention | Only mentioned |
| Telegram Group | Group | Reply to bot | Process replies |
| WhatsApp Private | Private | Any message | Always process |
| WhatsApp Group | Group | `@kitt` prefix | Only triggered |

---

## Project Structure

```
src/
├── bridge/
│   ├── index.ts         # Entry point + Think Loop scheduler
│   ├── telegram.ts      # Telegram adapter (grammy) + memory triggers
│   ├── agent.ts         # Agent SDK wrapper + KITT personality injection
│   ├── context.ts       # Context loading (IDENTITY, SOUL, USER, MEMORY)
│   ├── skills.ts        # Skill loader (.claude/skills/)
│   ├── transcribe.ts    # Voice transcription (OpenAI Whisper)
│   ├── tts.ts           # Text-to-speech (ElevenLabs) - F44
│   ├── format.ts        # Response formatting (Telegram MarkdownV2)
│   ├── sessions.ts      # Session management
│   ├── state.ts         # Bridge state
│   ├── logger.ts        # Structured logging
│   └── types.ts         # TypeScript types
```

---

## Configuration

```bash
# .env
TELEGRAM_BOT_TOKEN=xxx
TELEGRAM_ALLOWED_USERS=1306998969
KITT_WORKSPACE=/path/to/KITT V1
```

---

## Security

| Maatregel | Implementatie |
|-----------|---------------|
| User whitelist | `TELEGRAM_ALLOWED_USERS` env var |
| Token security | `.env` file, in `.gitignore` |
| Permission bypass | Alleen voor KITT agent |
| Workspace isolation | Alleen KITT V1/ toegang |

---

## Vergelijking: Oude vs Nieuwe Aanpak

| Aspect | File-based IPC (oud) | Agent SDK (nieuw) |
|--------|---------------------|-------------------|
| Processing | Handmatig via inbox/outbox | Direct SDK call |
| Tool access | Geen | Volledig (Read, Write, Bash, etc.) |
| Sessions | Geen | Per-chat persistence |
| Latency | Polling delay | Direct |
| Complexity | Meer files/watchers | Simpeler flow |

---

## Running the Bridge

```bash
# Development (with watch)
npm run bridge

# Production
npm run bridge:start
```

---

## KITT Response Flow (F04)

### Context Loading
Bij elke message wordt KITT personality geladen:

```typescript
// context.ts
const context = await loadContext();
// Laadt: IDENTITY.md, SOUL.md, USER.md, MEMORY.md

const systemPrompt = buildSystemPrompt(context);
// Bouwt KITT personality prompt
```

### Memory Triggers
"Onthoud dit/dat" en "Remember" triggers worden gedetecteerd:

```typescript
// telegram.ts
const MEMORY_TRIGGERS = ['onthoud dit', 'onthoud dat', 'remember this', ...];

// Extracted fact wordt opgeslagen in profile/memory/MEMORY.md
await memory.addFact(fact, 'Notes');
```

### Response Formatting
Responses worden geformateerd voor Telegram:

```typescript
// format.ts
const chunks = splitMessage(response, 4000);  // Telegram limit
const { text, parseMode } = formatForTelegramSafe(chunk);
// MarkdownV2 met plain text fallback
```

---

## Key Decisions

| Beslissing | Rationale |
|------------|-----------|
| Agent SDK over file IPC | Volledige agent capabilities (tools, sessions) |
| grammy voor Telegram | Bewezen library, goede types |
| Per-chat sessions | Context persistence tussen berichten |
| User whitelist | Security - alleen geautoriseerde users |
| systemPrompt injection | KITT personality via Agent SDK option |
| Non-blocking memory ops | Fire-and-forget met error logging |
