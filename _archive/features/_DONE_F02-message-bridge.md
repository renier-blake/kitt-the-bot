# F02: Message Bridge

> **Priority:** 🔴 MVP
> **Status:** 🔄 In Progress
> **Owner:** Claude Code + Renier
> **Started:** 5 februari 2026
> **Updated:** 5 februari 2026 - Agent SDK approach

---

## Lees Eerst

> **Belangrijk:** Dit is de eerste "echte" implementatie feature.

### 1. Briefings
- `_prd/briefings/bridge.md` - Message bridge architectuur
- `_prd/briefings/typescript.md` - TypeScript/Node.js kennis

### 2. Architecture Docs
- `_prd/architecture/bridge.md` - Bridge design
- `_prd/architecture/overview.md` - Systeem context

### 3. Reference Code
- NanoClaw Agent SDK pattern (`_repos/nanoclaw/container/agent-runner/`)
- OpenClaw Telegram handlers (grammy)

### 4. Setup Guide
- `_prd/guides/telegram-setup.md` - Bot aanmaken via @BotFather

---

## 🚦 Current Status

| Component | Status | Notes |
|-----------|--------|-------|
| Spec | ✅ | Dit document |
| Telegram Adapter | ✅ | grammy bot werkt |
| User Whitelist | ✅ | Security ingebouwd |
| Agent SDK Integration | 🔄 | In progress |
| Session Persistence | ⏳ | Nog te bouwen |
| E2E Test | ⏳ | Nog te doen |

---

## Overview

F02 bouwt de "Message Bridge" - de brug tussen Telegram en Claude Agent.

**Doel:** Berichten ontvangen via Telegram, verwerken met Claude Agent SDK (volledige tool access), en responses terugsturen naar Telegram.

### Architecture Evolution

**Oude aanpak (file-based IPC):**
```
Telegram → Bridge → inbox/ → [handmatig] → outbox/ → Bridge → Telegram
           ❌ Geen automatische processing
```

**Nieuwe aanpak (Agent SDK):**
```
Telegram → Bridge → Claude Agent SDK → Response → Bridge → Telegram
                         ↓
                   KITT workspace
                   (CLAUDE.md, MEMORY.md, tools)
           ✅ Volledige agent capabilities
           ✅ Session persistence
           ✅ Tool access (Read, Write, Bash, etc.)
```

---

## Scope

### In Scope (MVP)
- Telegram bot met grammy
- User whitelist (security)
- Claude Agent SDK integratie
- Session persistence per chat
- Volledige tool access voor agent
- Error handling met fallback responses

### Out of Scope (Later)
- WhatsApp channel
- Email channel
- Voice message transcriptie
- Media/images handling
- Rate limiting
- Queue management

---

## Technical Design

### Project Structure

```
src/
├── bridge/
│   ├── index.ts           # Entry point
│   ├── telegram.ts        # Telegram adapter (grammy)
│   ├── agent.ts           # Claude Agent SDK wrapper (NEW)
│   ├── sessions.ts        # Session management (NEW)
│   ├── types.ts           # Shared types
│   ├── state.ts           # Bridge state
│   └── logger.ts          # Structured logging
├── package.json
├── tsconfig.json
└── .env.example
```

### Core: Agent SDK Integration

```typescript
// agent.ts - Claude Agent SDK wrapper
import { query } from '@anthropic-ai/claude-agent-sdk';

interface AgentResponse {
  result: string | null;
  sessionId: string;
  error?: string;
}

export async function runAgent(
  prompt: string,
  sessionId?: string
): Promise<AgentResponse> {
  let result: string | null = null;
  let newSessionId: string | undefined;

  try {
    for await (const message of query({
      prompt,
      options: {
        cwd: process.env.KITT_WORKSPACE || process.cwd(),
        resume: sessionId,  // Session persistence!
        allowedTools: [
          'Bash',
          'Read', 'Write', 'Edit',
          'Glob', 'Grep',
          'WebSearch', 'WebFetch',
        ],
        permissionMode: 'bypassPermissions',
        allowDangerouslySkipPermissions: true,
      }
    })) {
      // Capture session ID from init
      if (message.type === 'system' && message.subtype === 'init') {
        newSessionId = message.session_id;
      }

      // Capture final result
      if ('result' in message && message.result) {
        result = message.result as string;
      }
    }

    return {
      result,
      sessionId: newSessionId || sessionId || '',
    };
  } catch (err) {
    return {
      result: null,
      sessionId: sessionId || '',
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
```

### Session Management

```typescript
// sessions.ts - Per-chat session persistence
interface ChatSession {
  chatId: string;
  sessionId: string;
  lastActivity: string;
  messageCount: number;
}

const sessions: Map<string, ChatSession> = new Map();
const SESSIONS_FILE = './sessions.json';

export function getSessionId(chatId: string): string | undefined {
  return sessions.get(chatId)?.sessionId;
}

export function updateSession(chatId: string, sessionId: string): void {
  const existing = sessions.get(chatId);
  sessions.set(chatId, {
    chatId,
    sessionId,
    lastActivity: new Date().toISOString(),
    messageCount: (existing?.messageCount || 0) + 1,
  });
  saveSessions();
}
```

### Updated Telegram Handler

```typescript
// telegram.ts - Message processing with Agent SDK
import { runAgent } from './agent.js';
import { getSessionId, updateSession } from './sessions.js';

bot.on('message:text', async (ctx) => {
  if (!shouldProcess(ctx)) return;

  const chatId = String(ctx.chat.id);
  const content = ctx.message.text;

  // Get existing session for this chat
  const sessionId = getSessionId(chatId);

  // Show typing indicator
  await ctx.replyWithChatAction('typing');

  // Run agent with full capabilities
  const response = await runAgent(content, sessionId);

  if (response.error) {
    await ctx.reply(`Sorry, er ging iets mis: ${response.error}`);
    return;
  }

  // Update session for next message
  updateSession(chatId, response.sessionId);

  // Send response
  if (response.result) {
    await ctx.reply(response.result);
  } else {
    await ctx.reply('Ik heb je bericht verwerkt, maar heb geen specifiek antwoord.');
  }
});
```

---

## Configuration

### Environment Variables

```bash
# .env
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_ALLOWED_USERS=1306998969

# Agent SDK (uses Claude Code's auth)
CLAUDE_CODE_OAUTH_TOKEN=  # Optional, uses existing auth
ANTHROPIC_API_KEY=        # Optional fallback

# Workspace
KITT_WORKSPACE=/Users/renierbleeker/Projects/KITT V1
```

### package.json (Updated)

```json
{
  "name": "kitt",
  "version": "0.1.0",
  "type": "module",
  "dependencies": {
    "@anthropic-ai/claude-agent-sdk": "^0.1.0",
    "grammy": "^1.21.0",
    "dotenv": "^16.4.0"
  },
  "devDependencies": {
    "@types/node": "^20.11.0",
    "tsx": "^4.7.0",
    "typescript": "^5.3.0"
  }
}
```

---

## Agent Capabilities

Met de Agent SDK heeft KITT toegang tot:

| Tool | Capability |
|------|------------|
| `Read` | Files lezen in workspace |
| `Write` | Files aanmaken |
| `Edit` | Files bewerken |
| `Bash` | Commands uitvoeren |
| `Glob` | Files zoeken |
| `Grep` | Content zoeken |
| `WebSearch` | Internet zoeken |
| `WebFetch` | URLs ophalen |

**Session Persistence:** Elk chat (chatId) krijgt een eigen session. Context blijft behouden tussen berichten.

---

## Security

| Maatregel | Status |
|-----------|--------|
| User whitelist | ✅ `TELEGRAM_ALLOWED_USERS` |
| Bot token in .env | ✅ Niet in git |
| Permission bypass | ✅ Alleen voor KITT agent |
| Workspace isolation | ✅ Alleen KITT V1/ toegang |

---

## Error Handling

| Error | Handling |
|-------|----------|
| Agent SDK fails | Return error message to user |
| Session not found | Start new session |
| Telegram API down | Log error, don't crash |
| Tool execution fails | Agent handles internally |

---

## Acceptance Criteria

- [x] Telegram bot start succesvol
- [x] DM berichten worden verwerkt
- [x] User whitelist werkt
- [ ] Agent SDK verwerkt berichten
- [ ] Session persistence werkt
- [ ] Agent heeft tool access
- [ ] Responses komen terug in Telegram
- [ ] Bridge blijft draaien na errors

---

## Test Scenarios

### 1. Basic Chat
```
User: "Hoi KITT!"
KITT: "Hey Renier! Wat kan ik voor je doen?"
```

### 2. Tool Usage
```
User: "Wat staat er in MEMORY.md?"
KITT: [Leest file met Read tool, geeft samenvatting]
```

### 3. Session Persistence
```
User: "Onthoud dat ik morgen naar de gym ga"
KITT: "Genoteerd!"
[Later]
User: "Wat had ik morgen ook alweer?"
KITT: "Je zou morgen naar de gym gaan."
```

### 4. Error Recovery
```
User: [Stuurt bericht terwijl agent crashed]
KITT: "Sorry, er ging iets mis. Probeer het opnieuw."
```

---

## Implementation Progress

### Phase 1: Telegram Adapter ✅
- [x] grammy bot setup
- [x] Message normalization
- [x] User whitelist
- [x] DM handling
- [x] Group mention detection

### Phase 2: Agent SDK Integration ✅
- [x] Install @anthropic-ai/claude-agent-sdk
- [x] Create agent.ts wrapper
- [x] Create sessions.ts manager
- [x] Wire into telegram.ts
- [x] Test basic chat

### Phase 3: Polish ✅
- [x] Error handling
- [x] Logging improvements
- [x] Session cleanup (auto-save)

---

## Files Changed/Created

| File | Status | Description |
|------|--------|-------------|
| `src/bridge/index.ts` | ✅ | Entry point |
| `src/bridge/telegram.ts` | ✅ → Update | Telegram + Agent |
| `src/bridge/agent.ts` | 🆕 | Agent SDK wrapper |
| `src/bridge/sessions.ts` | 🆕 | Session management |
| `src/bridge/types.ts` | ✅ | Types |
| `src/bridge/state.ts` | ✅ | State |
| `src/bridge/logger.ts` | ✅ | Logging |
| `package.json` | ✅ → Update | Add agent-sdk |

---

## Learnings/Beslissingen

| Datum | Beslissing | Rationale |
|-------|------------|-----------|
| 5 feb | File-based IPC → Agent SDK | Volledige agent capabilities nodig, niet alleen chat |
| 5 feb | Session per chatId | Context behouden tussen berichten |
| 5 feb | NanoClaw pattern volgen | Bewezen aanpak met Agent SDK |
