# KITT Orchestrator Architecture

> **Status:** v4 — Overlap guard, background dispatch, verbeterd dispatch protocol
> **Laatst bijgewerkt:** 11 feb 2026

---

## Overview

De KITT Orchestrator stuurt messages naar direct handling (Opus) of background tasks. Opus beslist zelf inline of een skill nodig is — geen aparte classifier meer.

```
User Message
     │
     ▼
┌─────────────────┐
│ Opus Agent      │  ~5-8 sec
│ (geen tools)    │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌───────┐ ┌──────────────┐
│Direct │ │BACKGROUND_   │
│answer │ │TASK signal   │
│       │ │→ Background  │
│       │ │  Runner      │
└───────┘ └──────┬───────┘
                 │
                 ▼
            ┌──────────┐
            │ Haiku/   │  10-40 sec
            │ Opus     │
            │ met tools│
            └──────┬───┘
                   │
                   ▼
            ┌──────────┐
            │ Result   │
            │ Delivery │
            │(lock-    │
            │ aware)   │
            └──────────┘
```

---

## Evolutie

### Fase 1: Alles via Opus (feb 2026, week 1)
- Alle skills in system prompt → 35k tokens → 43 sec response

### Fase 2: GPT-4o-mini Classifier (10 feb 2026)
- Pre-routing via classifier → 6 sec direct, 2 sec ack
- Skills uit chat context gehaald
- **Probleem:** +300ms op elke message, false positives, Opus prompt kwaliteit beter

### Fase 3: Opus Inline Routing (11 feb 2026)
- Classifier verwijderd
- Opus krijgt skills overzicht in context en beslist zelf
- BACKGROUND_TASK signal in response text
- Skills terug in chat context (compact overzicht, niet volledige SKILL.md)
- Response time: 5-8 sec direct

### Fase 4: Overlap Guard + Background Dispatch (11 feb 2026, huidige staat)
- Think loop overlap guard: `tickRunning` flag voorkomt concurrent ticks (KITT-138)
- Task execution modes: `sync` (awaited think-sub, 5 min) vs `background` (fire-and-forget, 30 min) (KITT-139)
- Zware tasks (blog, codebase audit) draaien via `dispatchBackgroundTask()` i.p.v. `runAgent()` in think loop
- Dispatch protocol verbeterd: "liever dispatchen dan zelf gokken"
- Chat timeout 60s → 90s (SDK subprocess init overhead)

---

## Components

### 1. Capabilities Registry (`src/capabilities/`)

Database-driven registry voor alle tools en skills.

**Table: `capabilities`**
```sql
id TEXT PRIMARY KEY,        -- 'garmin', 'gmail', 'bash'
category TEXT,              -- 'tool' | 'skill'
execution TEXT,             -- 'direct' | 'background'
model TEXT,                 -- 'opus' | 'haiku'
modes TEXT,                 -- '["secure", "developer"]'
triggers TEXT,              -- '["garmin", "slaap", "hrv"]'
path TEXT,                  -- '.claude/skills/garmin'
enabled INTEGER
```

**Model toewijzing:**

| Model | Skills | Rationale |
|-------|--------|-----------|
| Haiku | gmail, garmin, nutrition-log, apple-reminders, calendar | API-only, snel |
| Opus | gym-race-coach, blog-writer, browser, linkedin-post, podcast | Complex reasoning |

**Key functions:**
- `getBackgroundSkills(mode)` — Skills die async draaien
- `isCapabilityAvailable(id, mode)` — Mode-aware access check
- `getAgentMode()` / `setAgentMode()` — Secure/developer toggle

### 2. Background Runner (`src/scheduler/background-runner.ts`)

Async task execution met lock-aware delivery.

**Flow:**
1. `dispatchBackgroundTask()` — Maakt task, returned direct met ack
2. `executeTask()` — Runt agent async met skill context (SKILL.md)
3. Agent krijgt instructie: gebruik tools direct, geen BACKGROUND_TASK signalen
4. `deliverResult()` — Wacht op processing lock, stuurt naar user
5. Result opgeslagen in transcripts voor context behoud

**Instructie aan background agent:**
```
BELANGRIJK: Je bent een background agent. Gebruik je tools (Bash, Read, etc.)
om de taak DIRECT uit te voeren. Stuur NOOIT een BACKGROUND_TASK signaal —
dat is alleen voor chat mode.
```

### 3. Agent Pool (`src/bridge/agent-pool.ts`)

Centraal register voor alle agent subprocessen. Tracked wat er draait, dwingt timeouts af, en persist history naar DB.

**Timeouts per agent type:**

| Type | Timeout | Gebruik |
|------|---------|---------|
| `chat` | 90s | Directe tekst response (geen tools) |
| `think` | 2 min | Think loop reasoning |
| `think-sub` | 5 min | Skill execution met tools (sync tasks) |
| `background` | 30 min | Lange taken (blog, LinkedIn, audit) |

**Persistence:** Completed/failed/timeout agents worden opgeslagen in `agent_executions` tabel in kitt.db. Active agents zijn in-memory. Zie `_prd/architecture/agent-pool.md` voor details.

### 4. Think Loop Overlap Guard + Task Dispatch (`src/scheduler/index.ts`)

De think loop (elke 5 min) heeft twee beschermingen:

**Overlap guard (KITT-138):**
```typescript
private tickRunning = false;

async runThinkLoop() {
  if (this.tickRunning) return; // skip als vorige tick nog draait
  this.tickRunning = true;
  try { await this._runThinkLoopInner(); }
  finally { this.tickRunning = false; }
}
```

**Task execution modes (KITT-139):**

Tasks in `kitt_tasks` hebben een `execution` kolom: `sync` of `background`.

| Mode | Agent Type | Timeout | Gedrag |
|------|-----------|---------|--------|
| `sync` | think-sub | 5 min | Awaited in think loop tick |
| `background` | background | 30 min | Fire-and-forget via `dispatchBackgroundTask()` |

Zware tasks (blog, codebase audit) draaien als `background` — blokkeren de think loop niet.

### 5. Task Registry (`src/scheduler/task-registry.ts`)

CRUD voor `background_tasks` tabel:
- Voorkomt duplicate tasks per capability
- Status tracking: pending → running → completed/failed

### 6. Router Integration (`src/bridge/router.ts`)

Opus beslist inline via BACKGROUND_TASK signal in response text:

```typescript
// Run Opus (geen tools) — registered bij Agent Pool als type 'chat'
const response = await runAgent(message.content, {
  agentType: 'chat',
  chatId: message.chatId,
  allowedTools: [],
});

// Parse response voor BACKGROUND_TASK signal
const { message: userMessage, task } = parseBackgroundTask(response.result);

// Stuur direct antwoord naar user
await sendMessage(chatId, userMessage);

// Dispatch background task als aangevraagd
if (task) {
  await dispatchBackgroundTask({
    chatId, channel,
    capabilityId: task.skill,
    prompt: task.prompt,
    onComplete: (chatId, result) => sendMessage(chatId, result),
  });
}
```

---

## BACKGROUND_TASK Signal

Format in Opus response:

```
[Kort antwoord aan user]
BACKGROUND_TASK:{"skill":"skill-id","prompt":"Doe X"}
```

**Voorbeelden:**
```
Ik check je inbox!
BACKGROUND_TASK:{"skill":"gmail","prompt":"Haal de laatste 5 ongelezen emails op"}

Ik zoek het even op!
BACKGROUND_TASK:{"skill":"memory-search","prompt":"Zoek alle gesprekken van gisteren en vat samen"}
```

**Parsing:** `router.ts` → `parseBackgroundTask()` — regex op `BACKGROUND_TASK:({...})$`

**Dispatch Protocol (`skills-loader.ts`):**

Opus krijgt in chat mode expliciete instructies:
- "Je hebt GEEN tools" — voorkomt dat Opus zelf probeert te zoeken
- "ALTIJD dispatchen" bij vragen over het verleden, externe data, of acties
- "NOOIT zelf proberen" als het niet in de recente context (15 min) staat
- "Liever dispatchen dan zelf gokken"

---

## Database Tables

### capabilities
Unified registry voor tools + skills met mode filtering en model toewijzing.

### kitt_tasks (task engine)
```sql
-- Relevante kolommen voor orchestrator:
execution TEXT DEFAULT 'sync',  -- 'sync' (think-sub) | 'background' (fire-and-forget)
model TEXT,                     -- Override model per task
```

### background_tasks (background runner)
```sql
id TEXT PRIMARY KEY,
chat_id TEXT,
capability_id TEXT,
status TEXT,          -- pending | running | completed | failed
prompt TEXT,
result TEXT,
error TEXT,
created_at INTEGER,
completed_at INTEGER
```

---

## Modes

### Developer Mode (default)
- Alle tools en skills beschikbaar
- Full file system access

### Secure Mode
- Read-only tools (Read, Glob, Grep, WebSearch)
- Skills met `modes: ["secure"]`

Toggle via:
```sql
INSERT OR REPLACE INTO meta (key, value) VALUES ('agent_mode', 'secure');
```

---

## Performance

| Metric | Fase 1 | Fase 2 (classifier) | Fase 3 (inline) |
|--------|--------|---------------------|------------------|
| Context size | ~35k tokens | ~4k tokens | ~8-12k tokens |
| Direct response | ~43 sec | ~6 sec | ~5-8 sec |
| Pre-routing | N/A | ~1-2 sec | N/A |
| Background ack | N/A | ~2 sec | ~7 sec |
| Background result | N/A | ~20 sec | ~10-40 sec |

---

## Files

| File | Purpose |
|------|---------|
| `src/bridge/router.ts` | Message routing + BACKGROUND_TASK parsing |
| `src/bridge/agent.ts` | Agent SDK wrapper (runAgent → pool) |
| `src/bridge/agent-pool.ts` | Agent Pool — registry, timeouts, DB persistence |
| `src/capabilities/index.ts` | Capabilities CRUD |
| `src/capabilities/seed.ts` | Initial capabilities data |
| `src/scheduler/background-runner.ts` | Async task execution (agentType: background) |
| `src/scheduler/task-registry.ts` | Task CRUD |
| `src/scheduler/processing-lock.ts` | Lock vs think loop |
| `profile/context/blocks.json` | Context configuration |

---

## Gerelateerde Docs

| Doc | Onderwerp |
|-----|-----------|
| `chat-ux.md` | Volledige Chat UX flow (end-to-end) |
| `context.md` | Unified context builder |
| `bridge.md` | Channel adapter pattern |
| `agent-pool.md` | Agent Pool — registry, timeouts, persistence |
| `think-loop.md` | Think loop & yielding |
