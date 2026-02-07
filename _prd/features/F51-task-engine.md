# F51 - Task Engine

> **Status:** ✅ Done
> **Priority:** 🔴 P0
> **Type:** Architecture

---

## Doel

Bouw een **Task Engine** die scheduled skills vervangt. De Task Engine is KITT's "mentale to-do-list" - een systeem dat bijhoudt WAT er moet gebeuren en WANNEER, terwijl skills puur templates blijven voor HOE iets gedaan wordt.

---

## Waarom?

| Probleem nu | Oplossing met Task Engine |
|-------------|---------------------------|
| Skills combineren template + scheduling + execution | Scheiding: Tasks = engine, Skills = templates |
| Think Loop leest alle skill content elke tick | Skill content alleen laden bij uitvoering |
| "Al gedaan?" check via transcript parsing | SQL query op task_log |
| Geen formele takenlijst voor KITT | `kitt_tasks` tabel |
| Token usage hoog door skill content laden | ~70% token reductie |

---

## Architectuur

```
┌─────────────────────────────────────────────────────────────┐
│                      Think Loop (elke 5 min)                 │
│                                                              │
│  1. Query kitt_tasks → welke taken zijn open?               │
│  2. Check transcripts → al uitgevoerd vandaag/deze week?    │
│  3. Filter: time window, snooze, priority                   │
│  4. Execute: laad skill content, voer taak uit              │
│  5. Log: schrijf resultaat naar transcripts (role=task)     │
│                                                              │
└─────────────────────────────────────────────────────────────┘
         │                                      │
         ▼                                      ▼
┌─────────────────────┐              ┌─────────────────────┐
│    kitt_tasks        │              │    transcripts      │
│    (WAT + WANNEER)   │              │    (LOG + HISTORY)  │
│                      │              │                      │
│ • title              │              │ • role='task'       │
│ • frequency          │              │ • task_id           │
│ • priority           │              │ • status            │
│ • skill_refs         │              │ • executed_at       │
│ • time_window        │              │                      │
│ • snoozed_until      │              │                      │
└─────────────────────┘              └─────────────────────┘
         │
         ▼
┌─────────────────────┐
│  .claude/skills/     │
│  (HOE - templates)   │
│                      │
│ • nutrition-log/     │
│ • daily-reflection/  │
│ • garmin/            │
│ • etc.               │
└─────────────────────┘
```

---

## Database Schema

### kitt_tasks tabel

```sql
CREATE TABLE IF NOT EXISTS kitt_tasks (
    id INTEGER PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    frequency TEXT DEFAULT 'once',           -- 'once', 'daily', 'weekly', 'monthly'
    priority TEXT DEFAULT 'medium',          -- 'high', 'medium', 'low'
    skill_refs TEXT,                         -- JSON array: ["nutrition-log"]
    time_window_start TEXT,                  -- '07:00' (HH:MM)
    time_window_end TEXT,                    -- '11:00' (HH:MM)
    grace_period_minutes INTEGER DEFAULT 0,
    snoozed_until INTEGER,                   -- unix timestamp ms
    next_run INTEGER,                        -- unix timestamp ms (voor retry)
    created_by TEXT DEFAULT 'kitt',          -- 'kitt' of 'renier'
    active INTEGER DEFAULT 1,
    created_at INTEGER DEFAULT (unixepoch() * 1000)
);
```

### Task logs in transcripts

Task events worden opgeslagen in de bestaande `transcripts` tabel met:
- `role = 'task'`
- `metadata` bevat JSON met task_id, status, notes

---

## Seed Tasks (proof of concept)

| id | title | frequency | priority | skill_refs | time_window |
|----|-------|-----------|----------|------------|-------------|
| 1 | Ontbijt check | daily | low | ["nutrition-log"] | 07:00-11:00 |
| 2 | Lunch check | daily | low | ["nutrition-log"] | 11:30-15:00 |
| 3 | Avondeten check | daily | low | ["nutrition-log"] | 17:00-21:00 |

---

## Gewijzigde Bestanden

| File | Actie |
|------|-------|
| `src/memory/schema.ts` | kitt_tasks tabel + seedDefaultTasks() |
| `src/scheduler/task-engine.ts` | Nieuwe module met task logica |
| `src/scheduler/think-loop.ts` | Integratie met Task Engine |
| `.claude/skills/nutrition-log/SKILL.md` | Scheduling verwijderd, pure template |

---

## API (task-engine.ts)

```typescript
// Types
type TaskFrequency = 'once' | 'daily' | 'weekly' | 'monthly';
type TaskPriority = 'high' | 'medium' | 'low';
type TaskStatus = 'sent' | 'completed' | 'skipped' | 'deferred';

// Query open tasks
getOpenTasks(db: Client): Promise<OpenTasksResult>

// Log task execution
logTaskExecution(db: Client, execution: TaskExecution): Promise<string>

// Task management
snoozeTask(db: Client, taskId: number, untilTimestamp: number): Promise<void>
createTask(db: Client, task: Partial<KittTask>): Promise<number>
deleteTask(db: Client, taskId: number): Promise<void>
```

---

## Verificatie

- [x] `kitt_tasks` tabel bestaat met seed data
- [x] Open tasks query retourneert correcte taken
- [x] Tasks gefilterd op time window, snooze, frequency
- [x] Think Loop toont open tasks in prompt
- [x] Nutrition-log skill werkt als on-demand template
- [x] Build succesvol

---

## Toekomstige Migraties

Na proof of concept kunnen andere skills gemigreerd worden:
- daily-reflection → Task met time window
- garmin scheduled checks → Tasks
- apple-reminders → Already every_time, geen change nodig
