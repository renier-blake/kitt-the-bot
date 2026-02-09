# Message Bridge Architecture

> Hoe de message bridge werkt tussen channels en Claude Agent SDK.
> **Status:** v2.0 - Channel Adapter Pattern (PAS-06)

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
│   │   Adapter    │    │   Adapter    │    │   (later)   │  │
│   │   (grammy)   │    │  (baileys)   │    │             │  │
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
│   │   Agent    │    │   Memory    │    │  Sessions   │     │
│   │  (Claude)  │    │(transcripts)│    │ (per chat)  │     │
│   └────────────┘    └─────────────┘    └─────────────┘     │
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
├── index.ts              # Entry point, start router + adapters
├── router.ts             # MessageRouter (shared logic)
├── adapters/
│   ├── types.ts          # ChannelAdapter interface
│   ├── telegram.ts       # TelegramAdapter (grammy)
│   └── whatsapp.ts       # WhatsAppAdapter (baileys)
├── agent.ts              # Agent SDK wrapper
├── context.ts            # KITT personality loading
├── sessions.ts           # Per-chat session management
├── format.ts             # Response formatting
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

### Slack (Planned)

| Aspect | Detail |
|--------|--------|
| Library | `@slack/bolt` |
| Auth | OAuth via Nango |
| Status | PAS-17 |

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
