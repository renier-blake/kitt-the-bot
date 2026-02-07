# F04: Basic Response Flow

> **Priority:** 🔴 MVP
> **Status:** 📝 Spec
> **Owner:** -

---

## Lees Eerst

> **Belangrijk:** Eén agent werkt aan de complete feature. Lees ALLE documenten hieronder voordat je begint.

### 1. Workflow
- `_prd/WORKFLOW.md` - De 8-stappen workflow

### 2. Briefings
- `_prd/briefings/bridge.md` - Message bridge kennis
- `_prd/briefings/memory.md` - Memory systeem kennis
- `_prd/briefings/typescript.md` - TypeScript/Node.js kennis

### 3. Architecture
- `_prd/architecture/overview.md` - Systeem overzicht
- `_prd/architecture/bridge.md` - Message bridge details
- `_prd/architecture/memory.md` - Memory systeem details

### 4. Reference Code
- `src/bridge/telegram.ts` - Huidige message handling
- `src/bridge/agent.ts` - Agent SDK wrapper
- `profile/identity/` - KITT personality files

---

## 🚦 Current Status

| Component | Status | Notes |
|-----------|--------|-------|
| Basic flow | ✅ | Bridge werkt (F02) |
| Memory integration | ✅ | F03 klaar, triggers werken |
| Personality | ✅ | Via systemPrompt injection |
| Context injection | ✅ | IDENTITY, SOUL, USER, MEMORY |
| Response formatting | ✅ | splitMessage, MarkdownV2 prep |

---

## Overview

F04 verbindt de Message Bridge (F02) met het Memory System (F03) tot een complete KITT response flow. De basis werkt al - F04 maakt het "KITT-like".

**Wat er nu is:**
- Telegram message → Agent SDK → Response → Telegram

**Wat F04 toevoegt:**
- KITT personality injection (SOUL.md, IDENTITY.md)
- Working memory context (MEMORY.md)
- Transcript opslag (naar F03 memory)
- Betere response formatting (Markdown)
- "Thinking" indicators

---

## User Stories

**US-01:** Als Renier wil ik dat KITT antwoordt met zijn eigen persoonlijkheid (niet generic Claude), zodat het voelt als mijn persoonlijke assistent.

**US-02:** Als Renier wil ik dat KITT mijn preferences en context uit MEMORY.md gebruikt, zodat hij relevante antwoorden geeft.

**US-03:** Als Renier wil ik dat gesprekken automatisch worden opgeslagen, zodat KITT later kan terugvinden wat we besproken hebben.

**US-04:** Als Renier wil ik mooi geformateerde responses in Telegram (code blocks, bold, etc.), zodat antwoorden leesbaar zijn.

---

## Architecture

### Complete Response Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    KITT Response Flow                            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  1. RECEIVE                                                      │
│  ─────────                                                       │
│  • Telegram message ontvangen                                    │
│  • User validatie (whitelist)                                    │
│  • Show typing indicator                                         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  2. CONTEXT LOADING                                              │
│  ─────────────────                                               │
│  • Load KITT identity (SOUL.md, IDENTITY.md)                     │
│  • Load working memory (MEMORY.md)                               │
│  • Get conversation session (for resume)                         │
│  • [Optional] Search relevant memory (F03)                       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  3. PROCESS                                                      │
│  ────────                                                        │
│  • Build prompt with context                                     │
│  • Call Agent SDK with full tool access                          │
│  • Handle streaming response                                     │
│  • Update typing indicator periodically                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  4. STORE                                                        │
│  ──────                                                          │
│  • Store user message in memory (F03)                            │
│  • Store assistant response in memory (F03)                      │
│  • Update session for next message                               │
│  • Check for "onthoud dit" triggers                              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  5. RESPOND                                                      │
│  ────────                                                        │
│  • Format response for Telegram (Markdown)                       │
│  • Split long messages if needed                                 │
│  • Send response(s)                                              │
└─────────────────────────────────────────────────────────────────┘
```

### Context Injection

```typescript
// Pseudo-code for context building
const context = {
  // KITT Identity (altijd meegeven)
  identity: await readFile('profile/identity/IDENTITY.md'),
  soul: await readFile('profile/identity/SOUL.md'),

  // Working Memory (altijd meegeven)
  workingMemory: await readFile('profile/memory/MEMORY.md'),

  // User Info
  user: await readFile('profile/user/USER.md'),

  // [Optional] Relevant memory search results
  relevantContext: await memoryService.search(userMessage, { maxResults: 5 }),
};
```

---

## Implementation

### 1. Context Service (`src/bridge/context.ts`)

```typescript
export interface KITTContext {
  identity: string;
  soul: string;
  workingMemory: string;
  userInfo: string;
  relevantMemory?: SearchResult[];
}

export async function loadContext(
  userMessage?: string
): Promise<KITTContext> {
  // Load static files
  const [identity, soul, workingMemory, userInfo] = await Promise.all([
    readFile('profile/identity/IDENTITY.md', 'utf-8').catch(() => ''),
    readFile('profile/identity/SOUL.md', 'utf-8').catch(() => ''),
    readFile('profile/memory/MEMORY.md', 'utf-8').catch(() => ''),
    readFile('profile/user/USER.md', 'utf-8').catch(() => ''),
  ]);

  return { identity, soul, workingMemory, userInfo };
}

export function buildSystemPrompt(context: KITTContext): string {
  return `
# KITT Identity
${context.identity}

# Personality
${context.soul}

# User Information
${context.userInfo}

# Working Memory
${context.workingMemory}
  `.trim();
}
```

### 2. Enhanced Agent Wrapper (`src/bridge/agent.ts`)

```typescript
import { loadContext, buildSystemPrompt } from './context.js';
import { memoryService } from '../memory/index.js';

export async function runAgent(
  userMessage: string,
  sessionId?: string,
  options?: {
    channel: 'telegram' | 'claude_ui';
    chatId: string;
    metadata?: Record<string, unknown>;
  }
): Promise<AgentResponse> {
  // 1. Load context
  const context = await loadContext(userMessage);
  const systemPrompt = buildSystemPrompt(context);

  // 2. Store user message (before processing)
  if (options?.chatId) {
    await memoryService.storeMessage({
      sessionId: options.chatId,
      channel: options.channel,
      role: 'user',
      content: userMessage,
      metadata: options.metadata,
    });
  }

  // 3. Run agent with context
  const response = await queryAgent({
    prompt: userMessage,
    systemPrompt,
    sessionId,
  });

  // 4. Store assistant response
  if (options?.chatId && response.result) {
    await memoryService.storeMessage({
      sessionId: options.chatId,
      channel: options.channel,
      role: 'assistant',
      content: response.result,
    });

    // 5. Check for memory triggers
    await checkMemoryTriggers(userMessage, response.result);
  }

  return response;
}
```

### 3. Response Formatting (`src/bridge/format.ts`)

```typescript
/**
 * Format response for Telegram
 * - Convert markdown to Telegram-compatible format
 * - Handle code blocks
 * - Escape special characters
 */
export function formatForTelegram(text: string): string {
  // Telegram uses MarkdownV2 with specific escaping rules
  // Code blocks: ```language\ncode```
  // Bold: *text*
  // Italic: _text_
  // Monospace: `text`

  return text
    // Preserve code blocks
    .replace(/```(\w+)?\n([\s\S]*?)```/g, (_, lang, code) => {
      return `\`\`\`${lang || ''}\n${code}\`\`\``;
    })
    // Escape special chars outside code blocks
    // ... implementation
}
```

---

## Files te Maken/Wijzigen

| File | Actie | Beschrijving |
|------|-------|--------------|
| `src/bridge/context.ts` | Create | Context loading service |
| `src/bridge/format.ts` | Create | Response formatting |
| `src/bridge/agent.ts` | Modify | Add context injection + memory storage |
| `src/bridge/telegram.ts` | Modify | Use enhanced agent, better typing indicators |

---

## Acceptance Criteria

- [x] KITT antwoordt met persoonlijkheid (niet generic Claude) ✅ systemPrompt injection
- [x] MEMORY.md context wordt meegenomen in responses ✅ via loadContext()
- [x] User messages worden opgeslagen in F03 memory ✅ (al in F02)
- [x] Assistant responses worden opgeslagen in F03 memory ✅ (al in F02)
- [x] "Onthoud dit" trigger werkt (voegt toe aan MEMORY.md) ✅ checkMemoryTriggers()
- [ ] Telegram responses zijn correct geformateerd (Markdown) ⏳ Needs testing
- [ ] Code blocks worden correct weergegeven ⏳ Needs testing
- [x] Lange responses worden correct gesplitst ✅ splitMessage()

---

## Dependencies

| Depends On | Status |
|------------|--------|
| F02 - Message Bridge | ✅ Done |
| F03 - Memory System | 🔄 In Progress |

**Opmerking:** F04 kan parallel met F03 ontwikkeld worden, maar memory storage calls worden no-ops totdat F03 klaar is.

---

## Test Cases

1. **Personality test:**
   - Send: "Wie ben je?"
   - Expected: KITT antwoordt met zijn persoonlijkheid, niet als "Claude"

2. **Memory context test:**
   - Add fact to MEMORY.md: "User houdt van koffie"
   - Send: "Wat weet je over mij?"
   - Expected: Response bevat info over koffie preference

3. **Onthoud dit test:**
   - Send: "Onthoud dat ik morgen een meeting heb om 10:00"
   - Expected: Fact wordt toegevoegd aan MEMORY.md

4. **Code formatting test:**
   - Send: "Geef me een voorbeeld Python functie"
   - Expected: Code block wordt correct weergegeven in Telegram

5. **Long response test:**
   - Ask for detailed explanation
   - Expected: Response wordt correct gesplitst, geen truncation

---

## Implementation Notes (na completion)

> **Geïmplementeerd:** 5 februari 2026

### Wat is gebouwd

1. **Context Service** - Laadt KITT personality (IDENTITY.md, SOUL.md), user info (USER.md), en working memory (MEMORY.md) voor elke agent call
2. **System Prompt Injection** - KITT personality wordt via Agent SDK `systemPrompt` option geïnjecteerd
3. **Memory Triggers** - "Onthoud dit/dat" en "Remember" triggers detecteren en slaan facts op in MEMORY.md
4. **Response Formatting** - Utility functies voor Telegram MarkdownV2 escaping en message splitting

### Files gewijzigd/aangemaakt

| File | Actie | Beschrijving |
|------|-------|--------------|
| `src/bridge/context.ts` | Created | Context loading + system prompt building |
| `src/bridge/format.ts` | Created | Telegram formatting + message splitting |
| `src/bridge/agent.ts` | Modified | Added systemPrompt injection via getKITTSystemPrompt() |
| `src/bridge/telegram.ts` | Modified | Added memory trigger detection, uses shared splitMessage |

### Learnings/Beslissingen

1. **Agent SDK `systemPrompt` option** - Werkt direct als string, geen preset nodig
2. **Memory triggers simpel gehouden** - Extractie van fact uit user message, niet uit LLM response
3. **Markdown formatting optioneel** - Plain text fallback bij problemen (Telegram MarkdownV2 is tricky)
4. **Non-blocking memory operations** - Fire-and-forget met error logging
