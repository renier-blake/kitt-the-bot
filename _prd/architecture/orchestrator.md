# KITT Orchestrator Architecture

> **Status:** v5 — Background context mode, per-capability tool restrictions, 3-phase memory search, safe/developer mode
> **Laatst bijgewerkt:** 13 feb 2026

---

## Overview

De KITT Orchestrator stuurt messages naar direct handling (Opus) of background tasks. Elke skill draait met precies de tools en context die het nodig heeft — niet meer, niet minder.

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
│       │ └──────┬───────┘
└───────┘        │
            ┌────┴────┐
            │         │
            ▼         ▼
      ┌──────────┐ ┌──────────────┐
      │ Inline   │ │ Background   │
      │ Execute  │ │ Agent        │
      │ (geen    │ │ (per-skill   │
      │  agent)  │ │  tools)      │
      │ ~10s     │ │ ~10-40s      │
      └────┬─────┘ └──────┬───────┘
           │              │
           └──────┬───────┘
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

| Fase | Wanneer | Wat | Impact |
|------|---------|-----|--------|
| 1 | feb week 1 | Alles via Opus, skills in prompt | 35K tokens, 43s response |
| 2 | 10 feb | GPT-4o-mini classifier | +300ms overhead, false positives |
| 3 | 11 feb | Opus inline routing (BACKGROUND_TASK) | 5-8s direct, geen classifier |
| 4 | 11 feb | Overlap guard, background dispatch | Think loop protected |
| **5** | **13 feb** | **Background context mode, per-skill tools, 3-phase memory** | **11K prompt (was 40K), memory 10s (was 88s)** |

---

## Execution Modes

Elke capability heeft een `execution` mode die bepaalt HOE het draait:

| Mode | Gedrag | Agent? | Voorbeeld |
|------|--------|--------|-----------|
| `direct` | Inline in chat, geen background | Nee | Apple Reminders, brainstorm |
| `background` | Async agent met skill context | Ja | Garmin, Gmail, blog |
| `inline` | Programmatische execution, geen agent | Nee | Memory search |

### Direct

Skill wordt inline uitgevoerd tijdens het chat gesprek. Geen aparte agent, geen tools — Opus leest de SKILL.md en voert het direct uit.

### Background

Een sub-agent wordt gespawned met:
- **Lichtgewicht system prompt** (~11K ipv ~40K chat prompt)
- **Alleen SKILL.md** als context (niet alle skills)
- **Per-skill tools** — alleen wat de skill nodig heeft

### Inline

Geen agent spawn. Code roept direct functies aan. Snelste execution mode.

Momenteel alleen `memory-search` — gebruikt 3-phase aanpak (zie hieronder).

---

## Context Modes

Drie context modes bepalen wat er in de system prompt geladen wordt:

| Mode | Wie | Blocks | Prompt grootte |
|------|-----|--------|---------------|
| `chat` | Opus (user conversatie) | identity, soul, humor, user-info, working-memory, skills catalog, transcripts, memory-search, core-instructions, capabilities | ~43K chars |
| `think` | Think loop (autonoom) | identity, soul, humor, user-info, working-memory, open-tasks, background-tasks, think-loop instructions | ~35K chars |
| `background` | Skill agents (async) | user-info alleen | ~11K chars |

### Waarom background mode licht is

Background agents hoeven niet te weten wie KITT is, wat z'n humor is, of wat de recente transcripts zijn. Ze krijgen:
1. **User info** (~11K) — wie is Renier, voorkeuren
2. **SKILL.md** — instructies voor deze specifieke skill
3. **De taak prompt** — wat ze moeten doen

De SKILL.md wordt apart geïnjecteerd door de background runner, niet via blocks.json.

### Configuratie

`profile/context/blocks.json` — per block een `modes` array:

```json
{ "id": "user-info",    "modes": ["chat", "think", "background"] }
{ "id": "identity",     "modes": ["chat", "think"] }
{ "id": "soul",         "modes": ["chat", "think"] }
{ "id": "skills",       "modes": ["chat", "think"] }
{ "id": "core-instructions", "modes": ["chat"] }
```

---

## Per-Capability Tool Restrictions

Elke skill krijgt ALLEEN de tools die het nodig heeft. Geen Haiku agent met volledige file system access meer.

### Tool gevaarlijkheid

| Tool | Read-only | Gevaarlijk bij prompt injection |
|------|-----------|-------------------------------|
| Read | Ja | Nee |
| Glob | Ja | Nee |
| Grep | Ja | Nee |
| WebSearch | Ja | Nee |
| WebFetch | Ja | Nee |
| **Bash** | **Nee** | **JA** — kan commands uitvoeren, data exfiltreren |
| **Write** | **Nee** | **JA** — kan files aanmaken (malicious skill) |
| **Edit** | **Nee** | **JA** — kan bestaande files wijzigen |

### Hoe het werkt

1. `capabilities` tabel heeft `allowed_tools` kolom (JSON array, nullable)
2. Background runner leest `capability.allowedTools`
3. Fallback naar `DEFAULT_BACKGROUND_TOOLS` als null

```typescript
// background-runner.ts
const DEFAULT_BACKGROUND_TOOLS = ['Bash', 'Read', 'Glob', 'Grep'];
const tools = capability?.allowedTools ?? DEFAULT_BACKGROUND_TOOLS;
```

### Tool sets per skill categorie

| Categorie | Skills | Tools | Reden |
|-----------|--------|-------|-------|
| Data fetch | Garmin, Gmail, Calendar | `['Bash', 'Read', 'Glob', 'Grep']` | API calls lezen data, schrijven niks |
| Content creation | Blog, LinkedIn, Podcast | `['Bash', 'Read', 'Write', 'Edit', 'Glob', 'Grep', 'WebSearch', 'WebFetch']` | Moeten files schrijven |
| Read-only | Self-diagnostics | `['Read', 'Grep', 'Glob']` | Leest alleen logs |
| Geen tools | Memory search (inline) | `[]` | Geen agent, programmatische execution |

---

## 3-Phase Memory Search

Memory search was de traagste skill: 88 seconden (Haiku + alle tools + sqlite3 bash commands). Nu: ~10 seconden via 3-phase inline execution.

### Architectuur

```
Fase 1: Query Planning (Haiku, ~3-4s)
     │
     │  "weet je nog waarom ik zo vroeg wakker werd?"
     │
     ▼
┌──────────────────────────────────────┐
│ Haiku analyseert de vraag:           │
│                                      │
│ Stap 1: Onderwerp BEKEND of niet?   │
│   → ONBEKEND (user weet het niet)   │
│                                      │
│ Stap 2: Tijd BEKEND of niet?        │
│   → BEKEND (vanochtend)             │
│                                      │
│ Conclusie: alleen transcriptSearch  │
│                                      │
│ Output JSON:                         │
│ {"transcriptSearch":                 │
│   {"fromDate":"...T05:00:00",       │
│    "toDate":"...T10:00:00"}}        │
└─────────────┬────────────────────────┘
              │
              ▼
Fase 2: Search Execution (~200-500ms)
              │
     ┌────────┴────────┐
     │                 │
     ▼                 ▼
┌──────────┐    ┌────────────┐
│ Vector   │    │ Transcript │
│ Search   │    │ Search     │
│ (hybrid) │    │ (time      │
│          │    │  range)    │
└────┬─────┘    └─────┬──────┘
     │                │
     └────────┬───────┘
              │  Promise.all (parallel)
              ▼
Fase 3: Synthesis (Opus, ~6-10s)
              │
              │  Alle zoekresultaten + originele vraag
              │
              ▼
┌──────────────────────────────────────┐
│ Opus leest de resultaten en geeft   │
│ een natuurlijk antwoord             │
│                                      │
│ "Je werd vanochtend vroeg wakker    │
│  door de rookmelder die afging."    │
└──────────────────────────────────────┘
```

### Query Planner — Redeneerlogica

De Haiku query planner krijgt een gestructureerde redeneer-opdracht:

| Vraag | Onderwerp | Tijd | Strategie |
|-------|-----------|------|-----------|
| "waarom werd ik wakker?" | ONBEKEND (user weet het niet) | vanochtend | Alleen transcripts |
| "wat bespraken we over het project?" | project (BEKEND) | gisteren | Beide |
| "heb ik het ooit over rookmelders gehad?" | rookmelders (BEKEND) | geen | Alleen vector |
| "wat deed ik twee weken geleden?" | ONBEKEND | 2 weken geleden | Alleen transcripts |

**Kritiek punt:** Als de user "waarom?" of "wat gebeurde er?" vraagt, is het onderwerp per definitie ONBEKEND — de user weet het antwoord niet, daarom vraagt hij het. Vector search met gok-woorden ("wakker ochtend") zal het echte antwoord ("rookmelder") nooit vinden.

### SearchPlan Interface

```typescript
interface SearchPlan {
  vectorQuery?: string;     // Semantische zoekterm (Nederlands)
  transcriptSearch?: {
    fromDate?: string;      // ISO 8601
    toDate?: string;        // ISO 8601
  };
  // textQuery is bewust VERWIJDERD — filterde goede resultaten weg
}
```

### Zoeksystemen

| Systeem | Wat | Wanneer | Snelheid |
|---------|-----|---------|----------|
| **Vector search** | `memory.search()` — hybrid vector + keyword | Onderwerp BEKEND | ~200ms |
| **Transcript search** | `memory.searchTranscripts()` — raw SQL met tijdfilter | Tijd BEKEND | ~50ms |

Beide zoeksystemen draaien parallel via `Promise.all`.

### Performance

| Metric | Oud (v4, skill) | Nieuw (v5, inline) |
|--------|-----------------|-------------------|
| Agent spawn | Ja (Haiku + 8 tools) | Nee |
| System prompt | ~40K chars | ~11K chars |
| Execution | sqlite3 via Bash | Directe functie calls |
| Totale tijd | **88 seconden** | **~10 seconden** |
| Token gebruik | ~50K+ | ~15K |

---

## Safe Mode / Developer Mode

### Kernidee

| Mode | Wat mag | Doel |
|------|---------|------|
| **Safe** | Bestaande skills werken normaal, geen nieuwe skills/files | Dagelijks gebruik |
| **Developer** | Alles mag, nieuwe skills aanmaken, volledige toegang | Bouwen en ontwikkelen |

### Opslag

```sql
-- meta tabel
INSERT OR REPLACE INTO meta (key, value) VALUES ('agent_mode', 'safe');
-- of
INSERT OR REPLACE INTO meta (key, value) VALUES ('agent_mode', 'developer');
```

Schakelbaar via Portal UI (toekomstig) of direct in DB.

### Enforcement

```
SAFE MODE:
├── Chat (Opus) → geen tools (al zo)
├── Bestaande skills → werken normaal, inclusief Bash
│   (pre-approved, staan in capabilities tabel met modes: ["secure"])
├── Nieuwe skills aanmaken → GEBLOKKEERD
├── Write naar .claude/skills/ → GEBLOKKEERD
└── Think loop → Read/Grep alleen

DEVELOPER MODE:
├── Alles van safe mode, plus:
├── Nieuwe skills aanmaken → TOEGESTAAN
├── Write naar .claude/skills/ → TOEGESTAAN
└── Think loop → Alle tools
```

### Per-skill mode filtering

Elke capability heeft een `modes` array. In safe mode worden alleen skills met `"secure"` in hun modes geladen:

| Skill | Modes | Safe? | Developer? |
|-------|-------|-------|-----------|
| Garmin | `["secure", "developer"]` | Ja | Ja |
| Gmail | `["secure", "developer"]` | Ja | Ja |
| Memory search | `["secure", "developer"]` | Ja | Ja |
| Blog writer | `["secure", "developer"]` | Ja | Ja |
| Blog publisher | `["developer"]` | Nee | Ja |
| Browser | `["developer"]` | Nee | Ja |
| Self-diagnostics | `["developer"]` | Nee | Ja |
| Issue workflow | `["developer"]` | Nee | Ja |

### Verdedigingslagen

| Laag | Bescherming |
|------|------------|
| 1. Chat agent | Geen tools → prompt injection via chat is machteloos |
| 2. BACKGROUND_TASK routing | Alleen naar bekende capabilities |
| 3. SKILL.md instructies | Agent weet exact wat te doen → injection moet dit overriden |
| 4. Per-skill tool restrictions | Alleen tools die de skill nodig heeft |
| 5. Safe mode: geen Write naar skills/ | Voorkomt persistente backdoors |
| 6. Capability mode filtering | Skills gefilterd op active mode |

### Security risico's

| Risico | Mitigatie | Status |
|--------|----------|--------|
| Prompt injection in email/calendar | SKILL.md instructies + beperkte tools | Gemitigeerd |
| Malicious skill aanmaken | Safe mode blokkeert Write naar skills/ | Toekomstig |
| One-time Bash exploit | Per-skill tool restriction | Gemitigeerd |
| Data exfiltratie via Bash | Per-skill tool restriction + monitoring | Deels gemitigeerd |

---

## User Flows — End-to-End

### Flow 1: Gewoon praten

```
"Hoe gaat het?" → Opus (geen tools, 43K prompt) → direct antwoord
```

Geen skill, geen background task. Opus antwoordt uit z'n context.

### Flow 2: Memory in context (recent)

```
"Wat heb ik net gegeten?" → Opus (memory-search block in prompt) → direct antwoord
```

De `memory-search` context loader injecteert relevante vector resultaten in de chat prompt (block priority 31). Als het antwoord in de recente context zit, hoeft Opus niet te dispatchen.

### Flow 3: Memory search (diep/tijdgebonden)

```
"Weet je nog waarom ik zo vroeg wakker werd?"
→ Opus: "Ik zoek het even op!"
  BACKGROUND_TASK:{"skill":"memory-search","prompt":"..."}
→ Background runner: inline execution
→ Phase 1: Haiku planner → {"transcriptSearch":{"fromDate":"...T05:00","toDate":"...T10:00"}}
→ Phase 2: searchTranscripts() → 50 berichten van die ochtend
→ Phase 3: Opus synthesis → "Je werd wakker door de rookmelder"
→ Result delivery (~10s totaal)
```

### Flow 4: Data fetch skill (Garmin, Gmail)

```
"Check mijn slaap"
→ Opus: "Ik check je slaapdata!"
  BACKGROUND_TASK:{"skill":"garmin","prompt":"..."}
→ Background runner: agent spawn
  - System prompt: 11K (background mode)
  - Skill context: SKILL.md van garmin
  - Tools: ['Bash', 'Read', 'Glob', 'Grep']
  - Model: Haiku
→ Agent voert garmin python script uit
→ Result delivery (~15-30s)
```

### Flow 5: Content creation (Blog, LinkedIn)

```
"Schrijf een LinkedIn post"
→ Opus: "Ik schrijf een LinkedIn post!"
  BACKGROUND_TASK:{"skill":"linkedin-post","prompt":"..."}
→ Background runner: agent spawn
  - System prompt: 11K (background mode)
  - Skill context: SKILL.md van linkedin-post
  - Tools: ['Bash', 'Read', 'Write', 'Edit', 'Glob', 'Grep', 'WebSearch', 'WebFetch']
  - Model: Opus
→ Agent schrijft en publiceert
→ Result delivery (~30-120s)
```

---

## Components

### 1. Capabilities Registry (`src/capabilities/`)

Database-driven registry voor alle tools en skills.

**Table: `capabilities`**
```sql
id TEXT PRIMARY KEY,           -- 'garmin', 'gmail', 'memory-search'
name TEXT NOT NULL,
description TEXT,
icon TEXT,
category TEXT NOT NULL,        -- 'tool' | 'skill'
skill_type TEXT,               -- 'system' | 'user'
execution TEXT DEFAULT 'direct', -- 'direct' | 'background' | 'inline'
model TEXT,                    -- 'opus' | 'haiku' | 'sonnet'
path TEXT,                     -- '.claude/skills/garmin'
triggers TEXT,                 -- '["garmin", "slaap", "hrv"]'
modes TEXT DEFAULT '["developer"]', -- '["secure", "developer"]'
allowed_tools TEXT,            -- '["Bash","Read"]' of NULL (= default)
enabled INTEGER DEFAULT 1,
sort_order INTEGER DEFAULT 0,
created_at INTEGER NOT NULL,
updated_at INTEGER NOT NULL
```

**Key functions:**
- `getCapability(id)` — Per-skill config ophalen
- `getBackgroundSkills(mode)` — Skills die async draaien (background + inline)
- `getCapabilitiesForMode(mode)` — Mode-filtered lijst
- `getAgentMode()` / `setAgentMode()` — Safe/developer toggle

### 2. Background Runner (`src/scheduler/background-runner.ts`)

Async task execution met drie paden:

```typescript
async function executeTask(task, model, onComplete) {
  const capability = await getCapability(task.capabilityId);

  // Pad 1: Inline execution (geen agent)
  if (capability?.execution === 'inline') {
    await executeInlineTask(task, capability, onComplete);
    return;
  }

  // Pad 2: Background agent met per-skill tools
  const tools = capability?.allowedTools ?? DEFAULT_BACKGROUND_TOOLS;
  const response = await runAgent(prompt, {
    agentType: 'background',  // → 11K prompt
    model,
    skillContext,             // SKILL.md content
    allowedTools: tools,      // Per-skill restriction
  });

  // Pad 3: Result delivery (lock-aware)
  await deliverResult(task, result, onComplete);
}
```

**Heartbeat:** Stuurt elke 60s een progress update (max 3). Voorkomt dat de user denkt dat het vastloopt.

### 3. Agent Pool (`src/bridge/agent-pool.ts`)

Centraal register voor alle agent subprocessen.

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

### 5. Context Builder (`src/context/`)

Bouwt system prompts op basis van mode:

```typescript
// Chat mode (~43K)
await buildContext({ mode: 'chat', userQuery, db });

// Think mode (~35K)
await buildContext({ mode: 'think' });

// Background mode (~11K)
await buildContext({ mode: 'background' });
```

Configuratie via `profile/context/blocks.json` — per block een `modes` array.

### 6. Task Registry (`src/scheduler/task-registry.ts`)

CRUD voor `background_tasks` tabel:
- Voorkomt duplicate tasks per capability
- Status tracking: pending → running → completed/failed

### 7. Router Integration (`src/bridge/router.ts`)

Opus beslist inline via BACKGROUND_TASK signal:

```
[Kort antwoord aan user]
BACKGROUND_TASK:{"skill":"skill-id","prompt":"Doe X"}
```

Parsing: `router.ts` → `parseBackgroundTask()` — regex op `BACKGROUND_TASK:({...})$`

**Dispatch Protocol (`skills-loader.ts`):**

Opus krijgt in chat mode expliciete instructies:
- "Je hebt GEEN tools" — voorkomt dat Opus zelf probeert te zoeken
- "ALTIJD dispatchen" bij vragen over het verleden, externe data, of acties
- "NOOIT zelf proberen" als het niet in de recente context (15 min) staat
- "Liever dispatchen dan zelf gokken"

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

---

## Database Tables

### capabilities
Unified registry voor tools + skills (zie boven voor volledig schema).

### background_tasks
```sql
id TEXT PRIMARY KEY,
chat_id TEXT,
channel TEXT,
capability_id TEXT,
description TEXT,
status TEXT,          -- pending | running | completed | failed
prompt TEXT,
result TEXT,
error TEXT,
created_at INTEGER,
started_at INTEGER,
completed_at INTEGER
```

### agent_executions
```sql
id TEXT PRIMARY KEY,
agent_type TEXT,      -- chat | think | think-sub | background
chat_id TEXT,
capability_id TEXT,
model TEXT,
status TEXT,          -- active | completed | failed | timeout
started_at INTEGER,
completed_at INTEGER,
duration_ms INTEGER,
error TEXT
```

### kitt_tasks (task engine)
```sql
execution TEXT DEFAULT 'sync',  -- 'sync' (think-sub) | 'background' (fire-and-forget)
model TEXT,                     -- Override model per task
```

### meta
```sql
key TEXT PRIMARY KEY,
value TEXT
```

Gebruikt voor: `agent_mode` (safe/developer), en andere key-value settings.

---

## Performance Overzicht

| Metric | v1 | v3 (inline routing) | v5 (huidige staat) |
|--------|------|---------------------|-------------------|
| Chat prompt | ~35K tokens | ~8-12K tokens | ~43K chars (10 blocks) |
| Background prompt | ~35K tokens | ~35K tokens | **~11K chars (1 block)** |
| Direct response | ~43s | ~5-8s | ~5-8s |
| Memory search | N/A | ~88s (skill) | **~10s (inline)** |
| Background ack | N/A | ~7s | ~7s |
| Garmin result | N/A | ~20s | ~15s |

---

## Files

| File | Doel |
|------|------|
| `src/bridge/router.ts` | Message routing + BACKGROUND_TASK parsing |
| `src/bridge/agent.ts` | Agent SDK wrapper (runAgent → pool) |
| `src/bridge/agent-pool.ts` | Agent Pool — registry, timeouts, persistence |
| `src/bridge/context.ts` | System prompt factories (chat, background) |
| `src/context/builder.ts` | Unified context builder (blocks.json) |
| `src/context/types.ts` | ContextMode type ('chat' \| 'think' \| 'background') |
| `src/capabilities/index.ts` | Capabilities CRUD + mode management |
| `src/capabilities/seed.ts` | Seed data (alle tools + skills) |
| `src/scheduler/background-runner.ts` | Async task execution + inline memory search |
| `src/scheduler/task-registry.ts` | Task CRUD |
| `src/memory/index.ts` | MemoryService (vector search, transcript search) |
| `src/memory/types.ts` | Search types (TranscriptSearchOptions, SearchResult) |
| `profile/context/blocks.json` | Context configuratie per mode |

---

## Gerelateerde Docs

| Doc | Onderwerp |
|-----|-----------|
| `context.md` | Unified context builder details |
| `skills.md` | Skill systeem, discovery, SKILL.md format |
| `agent-pool.md` | Agent Pool — registry, timeouts, persistence |
| `memory.md` | Memory service, embeddings, hybrid search |
| `think-loop.md` | Think loop & yielding |
| `bridge.md` | Channel adapter pattern |
| `chat-ux.md` | Chat UX flow (end-to-end) |
