# KITT Orchestrator Model

> **Vervanger voor:** KITT-109 (Block Streaming - werkt niet voor agent workflows)
> **Probleem:** KITT reageert pas na 10-90 seconden, gebruiker heeft geen feedback

## Waarom Streaming Niet Werkt

Bij agent workflows gaat 95% van de tijd naar **tool execution** (bash, read, osascript, web search). Tijdens tool execution is er geen tekst om te streamen. Streaming helpt alleen de laatste paar seconden wanneer de agent tekst schrijft.

---

## ⚠️ Zorgen & Risico Mitigaties

### 1. Te veel nieuwe code

**Zorg:** Drie nieuwe TypeScript files + config = veel complexity.

**Mitigatie: Incrementele aanpak**
- **Fase 1:** Alleen task registry (database + CRUD) — ~100 lines code
- **Fase 2:** Background runner — hergebruikt bestaande `runAgent()`
- **Fase 3:** Classifier — **OPTIONEEL**, alleen als Fase 1-2 werken

De Haiku classifier is een **optimalisatie**, geen vereiste. Opus kan zelf al dispatchen (zie `core.md:9`).

### 2. Processing lock risico

**Zorg:** Race conditions tussen parallel tasks en chat agent.

**Huidige processing-lock.ts:**
- Global lock (`agent_processing_since`)
- Think Loop skipt als lock actief
- Stale lock verloopt na 2 minuten

**Voorstel: Lock blijft ONGEWIJZIGD**

```
Chat agent:     Acquire lock → process → release lock (zoals nu)
Background:     GEEN lock — runs async, results queued
Completion:     Wacht tot lock vrij → stuur result
Think Loop:     Checkt lock zoals nu
```

Background tasks concurreren NIET met de chat agent. Ze draaien parallel en leveren resultaten via een completion queue die wacht tot de lock vrij is.

### 3. Classifier accuracy

**Zorg:** Haiku maakt verkeerde routing beslissingen.

**Mitigatie: Classifier is OPTIONEEL**

**Initiële aanpak (zonder classifier):**
- Opus agent bepaalt zelf of iets background moet
- Instructie `core.md:9`: "dispatch to sub-agent and stay available for chat"
- Agent stuurt acknowledgment + dispatcht zelf
- Geen Haiku nodig in eerste versie

**Later (met classifier):**
- Bij twijfel → altijd fallback naar Opus (veilig)
- Gradual rollout: start met simpele regels
- Classifier prompt is configureerbaar (geen code change)

### 4. Think Loop conflict

**Zorg:** Think Loop en background tasks interfereren.

**Bestaand patroon: Task Engine**

De Think Loop heeft al task awareness via het `open-tasks` block in `blocks.json`:

```json
{
  "id": "open-tasks",
  "type": "dynamic",
  "source": "task-engine",
  "modes": ["think"],
  "enabled": true
}
```

**Voorstel:** Zelfde patroon voor background tasks:

```json
{
  "id": "active-background-tasks",
  "type": "dynamic",
  "source": "background-task-loader",
  "modes": ["think"],
  "enabled": true
}
```

Think Loop ziet dan active background tasks in zijn context, zonder code changes aan think-loop.ts.

---

## Nieuw Model: KITT als Orchestrator

```
HUIDIGE SITUATIE:
User ──► KITT (agent) ──► tools ──► response (10-90 sec later)
         [blokkeerd]

NIEUWE SITUATIE:
User ──► KITT (snel) ──► "Ik check dat even"
              │
              └──► Background Task ──► tools ──► notificatie
                   [parallel]
```

### Hoe het werkt

1. **User stuurt bericht**
2. **KITT (lightweight)** bepaalt snel:
   - Is dit een simpele vraag? → Direct beantwoorden
   - Is dit een taak? → Spawn background task, stuur bevestiging
3. **Background task** voert werk uit
4. **Notificatie** wanneer taak klaar is

### Voorbeeld Flow

```
14:00:00  User: "Check mijn reminders"
14:00:01  KITT: "Ik check je reminders even..."
          └── spawnt: BackgroundTask(apple-reminders)

14:01:25  KITT: "Hier zijn je openstaande reminders:
          - Gwens kms — due 8 feb
          - Pakketje terugsturen — due 9 feb
          ..."
```

## Architectuur

### Componenten

```
┌─────────────────────────────────────────────────────┐
│                    Message Router                    │
├─────────────────────────────────────────────────────┤
│                                                      │
│  ┌──────────────┐    ┌─────────────────────────┐   │
│  │  KITT Quick  │    │    Task Registry        │   │
│  │  (Haiku)     │───►│  - active tasks         │   │
│  │              │    │  - chatId → taskId      │   │
│  └──────────────┘    │  - status tracking      │   │
│         │            └─────────────────────────┘   │
│         │                       │                   │
│         ▼                       ▼                   │
│  ┌──────────────┐    ┌─────────────────────────┐   │
│  │   Quick      │    │   Background Agent      │   │
│  │   Response   │    │   (Opus)                │   │
│  │   "Ik check  │    │   - full tool access    │   │
│  │    dat..."   │    │   - runs in parallel    │   │
│  └──────────────┘    └─────────────────────────┘   │
│                                 │                   │
│                                 ▼                   │
│                      ┌─────────────────────────┐   │
│                      │   Completion Notifier   │   │
│                      │   - sends result        │   │
│                      │   - updates registry    │   │
│                      └─────────────────────────┘   │
│                                                      │
└─────────────────────────────────────────────────────┘
```

### Task Registry (Database)

> **Locatie:** `profile/data/kitt.db` (bestaande database)
> **Conventie:** snake_case kolommen, prefix `background_`

```sql
-- Tabel: background_tasks (volgt ARCHITECTURE.md naming)
CREATE TABLE background_tasks (
  id TEXT PRIMARY KEY,
  chat_id TEXT NOT NULL,
  channel TEXT NOT NULL,
  task_type TEXT NOT NULL,      -- 'skill' | 'query' | 'action'
  description TEXT,             -- "Checking reminders"
  status TEXT DEFAULT 'pending', -- pending | running | completed | failed
  created_at INTEGER NOT NULL,  -- Unix milliseconds (ARCHITECTURE.md standaard)
  started_at INTEGER,
  completed_at INTEGER,
  result TEXT,                  -- JSON result or error
  session_id TEXT               -- Agent session for context
);

CREATE INDEX idx_background_tasks_chat ON background_tasks(chat_id, status);
CREATE INDEX idx_background_tasks_status ON background_tasks(status);
```

### KITT Quick (Classifier)

Lightweight agent (Haiku) die bepaalt:

```typescript
interface TaskDecision {
  type: 'direct' | 'background';
  response?: string;           // Voor direct responses
  taskType?: string;           // 'skill' | 'query' | 'action'
  taskDescription?: string;    // "Checking your reminders"
  skillName?: string;          // Voor skill tasks
}
```

**Direct beantwoorden:**
- Simpele vragen ("hoe laat is het?")
- Begroetingen ("hoi")
- Snelle lookups (geen tools nodig)

**Background task:**
- Skills (garmin, reminders, gmail, etc.)
- Web searches
- File operations
- Anything needing tools

### Implementation

#### 1. Quick Classifier (`src/bridge/classifier.ts`)

```typescript
export async function classifyMessage(
  message: string,
  context: ChatContext
): Promise<TaskDecision> {
  // Load classifier prompt from profile/context/instructions/classifier.md
  // NOT hardcoded - follows blocks.json pattern
  const systemPrompt = await buildContextForMode('classifier');

  // Use Haiku for fast classification
  const response = await runAgent(message, {
    model: 'haiku',
    systemPrompt,  // From config, not code
  });
  return parseDecision(response.result);
}
```

#### 2. Task Registry (`src/scheduler/task-registry.ts`)

```typescript
export async function createTask(
  chatId: string,
  channel: Channel,
  type: TaskType,
  description: string
): Promise<string>;

export async function getActiveTask(chatId: string): Promise<Task | null>;

export async function completeTask(
  taskId: string,
  result: string
): Promise<void>;
```

#### 3. Background Runner (`src/scheduler/background-runner.ts`)

```typescript
export async function runBackgroundTask(task: Task): Promise<void> {
  // Mark as running
  await updateTaskStatus(task.id, 'running');

  try {
    // Run full agent with Opus
    const response = await runAgent(task.prompt, {
      model: 'opus',
      skillContext: task.skillContext,
    });

    // Complete and notify
    await completeTask(task.id, response.result);
    await notifyCompletion(task);
  } catch (err) {
    await failTask(task.id, err);
  }
}
```

#### 4. Router Integration (`src/bridge/router.ts`)

```typescript
async handleIncoming(message: IncomingMessage): Promise<void> {
  // Classify the message
  const decision = await classifyMessage(message.content, context);

  if (decision.type === 'direct') {
    // Send direct response
    await this.sendMessage(message.chatId, decision.response);
    return;
  }

  // Create background task
  const taskId = await createTask(
    message.chatId,
    channel,
    decision.taskType,
    decision.taskDescription
  );

  // Send acknowledgment
  await this.sendMessage(
    message.chatId,
    decision.taskDescription // "Ik check je reminders even..."
  );

  // Start background task (non-blocking)
  runBackgroundTask(task).catch(err => {
    log.error('Background task failed', { taskId, error: err });
  });
}
```

## Voordelen

| Aspect | Nu | Straks |
|--------|-----|--------|
| **Feedback** | 10-90 sec | < 2 sec |
| **Parallel** | Nee | Ja, user kan doorpraten |
| **Transparant** | Nee | "Ik werk aan X" |
| **Token gebruik** | Hoog (Opus altijd) | Lager (Haiku classifier) |

## Risico's & Mitigaties

| Risico | Mitigatie |
|--------|-----------|
| Classifier maakt fouten | Fallback naar background bij twijfel |
| Tasks accumuleren | Max concurrent tasks per chat, timeout |
| Context verlies | Task bevat originele prompt + chat context |
| Dubbele responses | Task registry voorkomt duplicates |

## Fasering (Incrementeel & Reversible)

### Fase 1: Task Registry (Minimal Risk)
- Database tabel (`background_tasks`)
- Basic CRUD operations (`src/scheduler/task-registry.ts`)
- Portal view voor active tasks
- **Geen gedragsverandering** — alleen infrastructure

### Fase 2: Background Runner + Manual Dispatch
- `src/scheduler/background-runner.ts` — hergebruikt `runAgent()`
- Completion queue met lock-aware delivery
- Opus agent kan nu `dispatchBackgroundTask()` aanroepen
- **core.md:9 instructie werkt nu echt**
- Think Loop awareness via `background-task-loader`

### Fase 3: Quick Classifier (OPTIONEEL)
> **Alleen bouwen als Fase 1-2 stabiel zijn**

1. **Config bestanden:**
   - `profile/context/instructions/classifier.md`
   - `profile/context/orchestrator/task-types.json`
   - Update `blocks.json` met "classifier" mode
2. **Code:**
   - `src/bridge/classifier.ts` — Laadt config, roept Haiku aan
   - Fallback naar Opus bij classifier fout

### Fase 4: Observatie & Tuning
- Monitor classifier accuracy
- Tune prompts (config, geen code)
- Rollback naar Fase 2 als classifier niet werkt

## Acceptatiecriteria

- [ ] User krijgt binnen 2 sec feedback
- [ ] Background tasks draaien parallel
- [ ] User kan doorpraten tijdens task
- [ ] Completion notificaties werken
- [ ] Geen dubbele responses
- [ ] Think Loop blijft werken
- [ ] Portal toont active tasks

## Architectuur Alignment

> **Referentie:** `_prd/architecture/ARCHITECTURE.md`
> Dit model volgt KITT's architectuur principes exact.

### Checklist uit ARCHITECTURE.md

- [x] Instructies gaan in `.md` files, niet in code
- [x] State gaat in `kitt.db`, niet in JSON
- [x] Database queries gebruiken snake_case
- [x] Logging heeft `[module]` prefix
- [x] Component staat op de juiste locatie
- [x] Configuratie via `blocks.json` of JSON config

---

### Principe 1: Geen hardcoded instructies in code

> Ref: ARCHITECTURE.md Principe 1

| Component | Waar | ARCHITECTURE.md regel |
|-----------|------|----------------------|
| Classifier prompt | `profile/context/instructions/classifier.md` | Agent instructies → `profile/context/instructions/*.md` |
| Acknowledgment templates | `profile/context/orchestrator/acknowledgments.md` | Agent instructies → `profile/context/instructions/*.md` |
| Task type definities | `profile/context/orchestrator/task-types.json` | Task types → `profile/context/*.json` |
| Quick response regels | In classifier instructies | Agent instructies → `.md` files |

### Principe 2: Configuratie buiten code

```
profile/context/
├── blocks.json                    # Bestaand - voeg "classifier" mode toe
├── instructions/
│   ├── classifier.md              # NIEUW: Classifier gedrag & regels
│   └── ...
└── orchestrator/
    ├── task-types.json            # NIEUW: Task type definities
    └── acknowledgments.md         # NIEUW: Response templates
```

**Voorbeeld `classifier.md`:**
```markdown
Je bent KITT's snelle classifier. Bepaal hoe dit bericht verwerkt moet worden.

## Direct beantwoorden (type: "direct")
- Begroetingen: "hoi", "hey", "goedemorgen"
- Simpele vragen zonder tools: "hoe laat is het?", "wat is 2+2?"
- Bevestigingen: "oke", "top", "dankje"

## Background task (type: "background")
- Skills: garmin, reminders, gmail, nutrition, calendar
- Web searches: "zoek op...", "wat is het weer?"
- File operations: lezen, schrijven, code
- Alles met tools

## Output format
Respond ONLY with JSON:
{"type": "direct", "response": "..."}
OF
{"type": "background", "taskType": "skill", "skillName": "garmin", "acknowledgment": "Ik check je Garmin data..."}
```

**Voorbeeld `task-types.json`:**
```json
{
  "skill": {
    "timeout": 120,
    "maxConcurrent": 2,
    "model": "opus"
  },
  "query": {
    "timeout": 60,
    "maxConcurrent": 3,
    "model": "sonnet"
  },
  "action": {
    "timeout": 300,
    "maxConcurrent": 1,
    "model": "opus"
  }
}
```

### Principe 3: Database voor state

Task registry past bij bestaand patroon (zoals `portal_issues`, `portal_projects`):

```sql
-- Zelfde database: profile/data/kitt.db
CREATE TABLE background_tasks (...);
```

### Principe 4: Bestaande patterns hergebruiken

> Ref: ARCHITECTURE.md Principe 6 - Modes & Blocks

| Bestaand | Hergebruiken voor |
|----------|-------------------|
| `blocks.json` modes | Nieuwe "classifier" mode |
| `runAgent()` | Background task execution |
| `buildContext({ mode })` | Classifier prompt laden |
| Skills loader | Task type detection |
| Memory service | Task context opslaan |

**Toevoegen aan blocks.json:**

```json
{
  "id": "classifier-instructions",
  "type": "instruction",
  "path": "profile/context/instructions/classifier.md",
  "header": "Classifier Instructions",
  "modes": ["classifier"],
  "priority": 100,
  "enabled": true
}
```

Dit volgt exact het patroon uit ARCHITECTURE.md:
1. Nieuwe mode in blocks.json
2. Instructie file in `profile/context/instructions/`
3. Code roept `buildContext({ mode: 'classifier' })` aan

### Wat NIET verandert

- Identity files (`IDENTITY.md`, `SOUL.md`, etc.)
- Skills systeem (`.claude/skills/`)
- Think Loop (`profile/context/instructions/think-loop.md`)
- Context builder (`src/context/`)
- Memory service (`src/memory/`)

### Code vs Configuratie

**Code (minimaal):**
- `src/bridge/classifier.ts` — Roept agent aan met classifier instructies
- `src/scheduler/background-runner.ts` — Task execution wrapper
- `src/scheduler/task-registry.ts` — Database CRUD

**Configuratie (maximaal):**
- Classifier gedrag → markdown instructies
- Task types → JSON config
- Acknowledgments → markdown templates
- Timeouts/limits → environment variables of JSON config

### Logging Prefixes (ARCHITECTURE.md Principe 5)

| Module | Prefix |
|--------|--------|
| Classifier | `[classifier]` |
| Background runner | `[background-runner]` |
| Task registry | `[task-registry]` |

```typescript
// Voorbeeld
console.log('[classifier] Classifying message', { chatId });
console.log('[background-runner] Task started', { taskId });
console.log('[task-registry] Task completed', { taskId, elapsed });
```

---

## Gerelateerd

- **KITT-109**: Block Streaming (afgesloten - niet geschikt)
- **Processing Lock**: Moet slimmer worden voor parallel tasks
- **Think Loop**: Moet weten van active tasks
- **core.md:9**: "dispatch to sub-agent" instructie bestaat al
