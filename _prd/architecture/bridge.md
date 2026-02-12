# Message Bridge Architecture

> Hoe de message bridge werkt tussen channels en Claude Agent SDK.
> **Status:** v2.2 - Channel Adapter Pattern + Agent Pool + Slack

---

## Overview

De Message Bridge is een Node.js process dat:
1. Messages ontvangt via **Channel Adapters** (Telegram, WhatsApp, etc.)
2. Berichten routeert via de **MessageRouter** (shared logic)
3. De **Claude Agent SDK** aanroept voor verwerking
4. Responses terugstuurt via de juiste adapter
5. **Sessions** beheert per chat voor context persistence

---

## Architecture (v2.0)

```
┌─────────────────────────────────────────────────────────────┐
│                        KITT Bridge                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   ┌──────────────┐    ┌──────────────┐    ┌─────────────┐  │
│   │   Telegram   │    │   WhatsApp   │    │    Slack    │  │
│   │   Adapter    │    │   Adapter    │    │   Adapter   │  │
│   │   (grammy)   │    │  (baileys)   │    │ (web-api)   │  │
│   └──────┬───────┘    └──────┬───────┘    └──────┬──────┘  │
│          │                   │                   │          │
│          └───────────────────┼───────────────────┘          │
│                              ▼                              │
│                    ┌─────────────────┐                      │
│                    │  MessageRouter  │                      │
│                    │  (shared logic) │                      │
│                    └────────┬────────┘                      │
│                             │                               │
│          ┌──────────────────┼──────────────────┐            │
│          ▼                  ▼                  ▼            │
│   ┌────────────┐    ┌─────────────┐    ┌─────────────┐     │
│   │ Agent Pool │    │   Memory    │    │  Sessions   │     │
│   │  registry  │    │(transcripts)│    │ (per chat)  │     │
│   │  timeouts  │    └─────────────┘    └─────────────┘     │
│   │  persist   │                                           │
│   └─────┬──────┘                                           │
│         ▼                                                  │
│   ┌────────────┐    ┌─────────────┐                        │
│   │   Agent    │    │  kitt.db    │                        │
│   │  (Claude)  │    │  agent_    │                        │
│   │            │    │  executions│                        │
│   └────────────┘    └─────────────┘                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Channel Adapter Pattern

### Interface

Elke adapter implementeert de `ChannelAdapter` interface:

```typescript
// src/bridge/adapters/types.ts
interface ChannelAdapter {
  readonly channel: 'telegram' | 'whatsapp' | 'slack';
  readonly displayName: string;

  start(): Promise<void>;
  stop(): Promise<void>;
  sendMessage(chatId: string, content: string, options?: SendOptions): Promise<void>;
  sendVoice?(chatId: string, audioBuffer: Buffer): Promise<void>;
  isConnected(): boolean;
  getStatus(): AdapterStatus;
}
```

### Chat ID Format

Alle chat IDs gebruiken een **channel prefix**:

```
telegram:123456789              # Telegram user/group
whatsapp:31612345678@s.whatsapp.net  # WhatsApp user
whatsapp:120363...@g.us         # WhatsApp group
slack:C1234567890               # Slack channel
```

### Verantwoordelijkheden

**Adapters handelen:**
- Platform-specifieke API calls
- Message parsing & formatting
- Voice transcriptie (indien supported)
- Auth (bot token, QR code, OAuth)
- Reconnect logic

**Router handelt:**
- Agent SDK aanroepen
- Memory/transcripts opslaan
- Session management
- Sleep/DND modes
- Skill routing
- Message splitting

---

## Project Structure

```
src/bridge/
├── index.ts              # Entry point, start router + adapters + tunnel + graceful shutdown
├── router.ts             # MessageRouter (shared logic)
├── agent.ts              # Agent SDK wrapper (runAgent → pool.register/complete/fail)
├── agent-pool.ts         # Agent Pool — registry, timeouts, DB persistence
├── adapters/
│   ├── types.ts          # ChannelAdapter interface
│   ├── telegram.ts       # TelegramAdapter (grammy)
│   ├── whatsapp.ts       # WhatsAppAdapter (baileys)
│   ├── slack.ts          # SlackAdapter (@slack/web-api, user token)
│   └── slack-bot.ts      # SlackBotAdapter (@slack/bolt, Socket Mode, bot token)
├── slack-events.ts       # Slack Events API endpoint (signing verification + dedup)
├── tunnel.ts             # Cloudflare Tunnel child process manager
├── context.ts            # KITT personality loading
├── sessions.ts           # Per-chat session management
├── format.ts             # Response formatting (Telegram, Slack mrkdwn)
├── log-server.ts         # Portal API (Express + WebSocket) + Slack events route
├── transcribe.ts         # Voice → text (Whisper)
├── tts.ts                # Text → voice (ElevenLabs)
├── logger.ts             # Structured logging
└── types.ts              # Shared types
```

---

## Channel Adapters

### Telegram (Active)

| Aspect | Detail |
|--------|--------|
| Library | `grammy` |
| Auth | Bot token via @BotFather |
| File | `src/bridge/adapters/telegram.ts` |
| Env | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_ALLOWED_USERS` |

### WhatsApp (Active)

| Aspect | Detail |
|--------|--------|
| Library | `@whiskeysockets/baileys` |
| Auth | QR code scan |
| File | `src/bridge/adapters/whatsapp.ts` |
| Env | `WHATSAPP_ENABLED=true`, `WHATSAPP_ALLOWED_NUMBERS` |
| Auth storage | `data/whatsapp-auth/` |

### Slack (Active)

| Aspect | Detail |
|--------|--------|
| Library | `@slack/web-api` |
| Auth | User token (xoxp-) via eigen OAuth framework |
| File | `src/bridge/adapters/slack.ts` |
| Events | HTTP webhook via Slack Events API (`/slack/events`) |
| Tunnel | Cloudflare Tunnel (child process, `src/bridge/tunnel.ts`) |
| Signing | HMAC SHA256 verificatie (`SLACK_SIGNING_SECRET`) |
| Credentials | `SLACK_USER_TOKEN`, `SLACK_SIGNING_SECRET` (vault) |
| Setup guide | `_prd/guides/slack-setup.md` |

**Architectuur:** KITT verschijnt als reguliere Slack user (geen "APP" label). Events komen binnen via Cloudflare Tunnel → `localhost:8000/slack/events`. Berichten worden verstuurd met een user token via `chat.postMessage`. DMs: altijd reageren. Channels: alleen bij `@mention`.

### Slack Bot (Active)

| Aspect | Detail |
|--------|--------|
| Library | `@slack/bolt` |
| Auth | Bot token (xoxb-) + App-Level token (xapp-) |
| File | `src/bridge/adapters/slack-bot.ts` |
| Events | Socket Mode (outbound WebSocket, geen tunnel nodig) |
| Credentials | `SLACK_BOT_TOKEN`, `SLACK_APP_TOKEN` (vault) |
| Channel type | `slack-bot` (apart van `slack`) |

**Architectuur:** KITT verschijnt als bot met "APP" label. Socket Mode maakt een outbound WebSocket verbinding — geen tunnel of public URL nodig. DMs via App Home "Messages" tab. Channels: alleen bij `@mention` (via `app_mention` event). Antwoorden in channels gaan als thread reply. Kan naast de User adapter draaien (verschillende channel types, verschillende tokens, zelfde Slack App).

**Permissions:** Database-backed via `slack_bot_allowed_users` meta key (apart van User adapter's `slack_allowed_users`). Levels: `respond`, `read-only`, `blocked`. Geen config = iedereen mag (backwards compatible).

---

## MessageRouter

De router bevat alle channel-agnostische logica:

```typescript
// src/bridge/router.ts
class MessageRouter {
  // Adapter registry
  registerAdapter(adapter: ChannelAdapter): void;
  getAdapter(channel: ChannelType): ChannelAdapter;

  // Message handling
  async handleIncoming(message: IncomingMessage): Promise<void> {
    // 1. Wake KITT if sleeping
    // 2. Store user message in memory
    // 3. Acquire processing lock
    // 4. Run Claude Agent
    // 5. Handle skill routing
    // 6. Update session
    // 7. Store KITT response
    // 8. Release lock
    // 9. Send response via adapter
  }

  // Outgoing messages
  async sendMessage(chatId: string, content: string): Promise<void> {
    const channel = extractChannel(chatId);  // 'telegram' from 'telegram:123'
    const adapter = this.adapters.get(channel);
    await adapter.sendMessage(chatId, content);
  }
}
```

---

## Session Management

Elke chat krijgt een eigen session voor context persistence:

```typescript
// profile/state/sessions.json
{
  "sessions": {
    "telegram:1306998969": {
      "chatId": "telegram:1306998969",
      "sessionId": "abc123-def456",
      "lastActivity": "2026-02-09T18:00:00Z",
      "messageCount": 42,
      "displayName": "Renier"
    }
  }
}
```

---

## Trigger Patterns

| Channel | Context | Trigger | Behavior |
|---------|---------|---------|----------|
| Telegram DM | Private | Any message | Always process |
| Telegram Group | Group | `@botname` mention | Only mentioned |
| Telegram Group | Group | Reply to bot | Process replies |
| WhatsApp Private | Private | Any message | Always process |
| WhatsApp Group | Group | Any message | Process all (configurable) |
| Slack User DM | Private | Any message | Always process |
| Slack User Channel | Group | `@mention` | Only mentioned, replies in thread |
| Slack Bot DM | Private | Any message | Always process (App Home) |
| Slack Bot Channel | Group | `@mention` | Only mentioned, replies in thread |

---

## Configuration

```bash
# .env

# Telegram
TELEGRAM_BOT_TOKEN=xxx
TELEGRAM_ALLOWED_USERS=1306998969

# WhatsApp (optional)
WHATSAPP_ENABLED=true
WHATSAPP_ALLOWED_NUMBERS=31612345678,31698765432

# General
KITT_WORKSPACE=/path/to/KITT V1
```

### Slack credentials (credential vault, niet .env)

| Key | Type | Bron |
|-----|------|------|
| `CLOUDFLARE_TUNNEL_TOKEN` | token | Cloudflare dashboard |
| `SLACK_CLIENT_ID` | oauth | Slack App → Basic Information |
| `SLACK_CLIENT_SECRET` | oauth | Slack App → Basic Information |
| `SLACK_SIGNING_SECRET` | api_key | Slack App → Basic Information |
| `SLACK_USER_TOKEN` | token | Via OAuth flow (automatisch) |
| `SLACK_BOT_TOKEN` | token | Via OAuth flow (slack-bot integratie) |
| `SLACK_APP_TOKEN` | token | Slack App → Basic Information → App-Level Tokens |

Slack heeft geen `.env` variabelen nodig. Auto-detectie:
- `SLACK_USER_TOKEN` + `SLACK_SIGNING_SECRET` in vault → Slack User adapter start
- `SLACK_BOT_TOKEN` + `SLACK_APP_TOKEN` in vault → Slack Bot adapter start (Socket Mode)
- `CLOUDFLARE_TUNNEL_TOKEN` in vault → Cloudflared tunnel start als child process
- Beide adapters kunnen tegelijk draaien (verschillende channel types)

---

## Adding a New Channel

1. Create adapter in `src/bridge/adapters/newchannel.ts`
2. Implement `ChannelAdapter` interface
3. Add channel to `ChannelType` in `adapters/types.ts`
4. Add channel to `Channel` in `memory/types.ts`
5. Register in `index.ts`:

```typescript
if (process.env.NEWCHANNEL_ENABLED === 'true') {
  const adapter = createNewChannelAdapter();
  router.registerAdapter(adapter);
}
```

---

## Running the Bridge

```bash
# Via pm2 (recommended)
pm2 start npm --name kitt -- run bridge

# Development
npm run bridge

# Logs
pm2 logs kitt
```

---

## Migration Notes

### v1 → v2 (PAS-06)

- Chat IDs nu prefixed: `123456` → `telegram:123456`
- Migratie script: `npx tsx scripts/migrate-chat-ids.ts --apply`
- `sendTelegramMessage()` verwijderd, gebruik `getRouter().sendMessage()`
- `startTelegramBot()` verwijderd, adapters starten via router
