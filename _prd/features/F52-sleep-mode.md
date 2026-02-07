# F52 - KITT Sleep Mode

> **Status:** ✅ Completed (2026-02-07)
> **Scope:** Global sleep/snooze mode voor KITT
> **Builds on:** F51 Task Engine (completed)

---

## Doel

KITT krijgt een **sleep mode** - een globale pauze waarin geen taken worden uitgevoerd en geen berichten worden gestuurd. Dit bespaart tokens en respecteert de gebruiker's rust.

---

## Concept

```
┌─────────────────────────────────────────────────────────────┐
│                      Think Loop (elke 5 min)                 │
│                                                              │
│  STAP 0: Check kitt_sleep_until                             │
│          ↓                                                   │
│          Sleeping? → EXIT (geen verwerking, geen tokens)    │
│          ↓                                                   │
│  STAP 1: Normale flow (tasks, skills, etc.)                 │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Triggers

| User zegt | KITT doet | `kitt_sleep_until` |
|-----------|-----------|-------------------|
| "Ik ga slapen" | Sleep onbeperkt | `9999999999999` (far future) |
| "Ik ga slapen, 8:00" | Sleep tot 8:00 | `08:00 morgen timestamp` |
| "Focus mode 2 uur" | Sleep 2 uur | `now + 2 uur` |
| "Laat me met rust" | Sleep onbeperkt | `9999999999999` |
| "Stop" | Sleep 2 uur (default) | `now + 2 uur` |

---

## Wakker Worden

| Trigger | Actie |
|---------|-------|
| Timestamp verloopt | Automatisch wakker (Think Loop check) |
| User stuurt bericht | Message handler cleart `kitt_sleep_until` |

---

## Database

Gebruik bestaande `meta` tabel:

```sql
-- Sleep activeren
INSERT OR REPLACE INTO meta (key, value)
VALUES ('kitt_sleep_until', '1707350400000');

-- Sleep deactiveren
DELETE FROM meta WHERE key = 'kitt_sleep_until';
```

---

## Implementatie

### Stap 1: Sleep Helper Functions

**Bestand:** `src/scheduler/sleep-mode.ts` (nieuw)

```typescript
import type { Client } from '@libsql/client';

const FAR_FUTURE = 9999999999999; // ~2286 AD

/**
 * Check of KITT slaapt
 */
export async function isKittSleeping(db: Client): Promise<boolean> {
  const result = await db.execute(
    "SELECT value FROM meta WHERE key = 'kitt_sleep_until'"
  );
  if (result.rows.length === 0) return false;
  const sleepUntil = Number(result.rows[0].value);
  return sleepUntil > Date.now();
}

/**
 * Get sleep until timestamp (of null als wakker)
 */
export async function getSleepUntil(db: Client): Promise<number | null> {
  const result = await db.execute(
    "SELECT value FROM meta WHERE key = 'kitt_sleep_until'"
  );
  if (result.rows.length === 0) return null;
  const sleepUntil = Number(result.rows[0].value);
  return sleepUntil > Date.now() ? sleepUntil : null;
}

/**
 * Zet KITT in sleep mode
 */
export async function setSleep(db: Client, until: number | 'indefinite'): Promise<void> {
  const value = until === 'indefinite' ? FAR_FUTURE : until;
  await db.execute({
    sql: "INSERT OR REPLACE INTO meta (key, value) VALUES ('kitt_sleep_until', ?)",
    args: [String(value)]
  });
}

/**
 * Maak KITT wakker
 */
export async function clearSleep(db: Client): Promise<void> {
  await db.execute("DELETE FROM meta WHERE key = 'kitt_sleep_until'");
}
```

### Stap 2: Think Loop Check

**Bestand:** `src/scheduler/think-loop.ts` (modify)

Voeg toe aan het BEGIN van `runThinkLoop()`:

```typescript
import { getSleepUntil } from './sleep-mode.js';

export async function runThinkLoop(db: Client, sendMessage: SendMessageFn): Promise<ThinkLoopResult> {
  // ========================================
  // SLEEP MODE CHECK - MUST BE FIRST
  // ========================================
  const sleepUntil = await getSleepUntil(db);
  if (sleepUntil) {
    const wakeTime = new Date(sleepUntil).toLocaleTimeString('nl-NL', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/Amsterdam'
    });
    console.log(`[think-loop] 😴 Sleeping until ${wakeTime}`);
    return {
      shouldAct: false,
      reasoning: `KITT is in sleep mode until ${wakeTime}`,
    };
  }

  // ... rest van bestaande code ...
}
```

### Stap 3: Message Handler Wake-up

**Bestand:** `src/bridge/telegram.ts` (modify)

In beide message handlers (`bot.on('message:text')` en `bot.on('message:voice')`), direct na de whitelist check:

```typescript
import { clearSleep } from '../scheduler/sleep-mode.js';

// In bot.on('message:text', ...) rond regel 280, na whitelist check:
const memory = getMemoryService();
const db = memory.getDb();
if (db) {
  await clearSleep(db);
}

// Zelfde in bot.on('message:voice', ...) rond regel 440
```

**Note:** MemoryService heeft al `getDb()` method (line 135 in `src/memory/index.ts`).

### Stap 4: KITT Prompt Instructies

**Bestand:** `profile/identity/SOUL.md` (modify)

Voeg toe aan SOUL.md:

```markdown
## Sleep Mode

Je kunt jezelf in sleep mode zetten wanneer Renier dat vraagt.

### Wanneer sleep mode activeren:
- "Ik ga slapen" → sleep onbeperkt
- "Ik ga slapen, [tijd]" → sleep tot die tijd
- "Focus mode [duur]" → sleep voor die duur
- "Stop" / "Laat me met rust" → sleep 2 uur

### Hoe te doen:
Gebruik de sqlite3 tool om meta tabel te updaten:
```bash
sqlite3 profile/memory/kitt.db "INSERT OR REPLACE INTO meta (key, value) VALUES ('kitt_sleep_until', '<timestamp>');"
```

### Wake-up:
- Je wordt automatisch wakker als de timestamp verloopt
- Je wordt wakker zodra Renier een bericht stuurt
```

---

## Bestanden die wijzigen

| Bestand | Actie | Beschrijving |
|---------|-------|--------------|
| `src/scheduler/sleep-mode.ts` | **Create** | Sleep helper functions |
| `src/scheduler/think-loop.ts` | Modify | Sleep check aan begin van runThinkLoop() |
| `src/bridge/telegram.ts` | Modify | Clear sleep bij user message (text + voice) |
| `src/scheduler/task-engine.ts` | Modify | Dependency check in getOpenTasks() |
| `src/memory/schema.ts` | Modify | ALTER TABLE voor depends_on kolom |
| `profile/identity/SOUL.md` | Modify | Sleep mode instructies voor KITT |

---

## Task Dependencies

Taken kunnen afhangen van andere taken via `depends_on`.

### Database Schema Update

```sql
-- Voeg depends_on kolom toe aan kitt_tasks
ALTER TABLE kitt_tasks ADD COLUMN depends_on INTEGER REFERENCES kitt_tasks(id);
```

### Voorbeeld: Wake-up Task

```sql
-- Wake-up task (geen dependencies)
INSERT INTO kitt_tasks (id, title, frequency, priority, description)
VALUES (10, 'Wake-up check', 'daily', 'high', 'Goedemorgen routine');

-- Andere taken hangen af van wake-up
UPDATE kitt_tasks SET depends_on = 10 WHERE id IN (1, 2, 3);
```

| id | title | depends_on | Betekenis |
|----|-------|------------|-----------|
| 10 | Wake-up check | NULL | Geen dependencies |
| 1 | Ontbijt check | 10 | Wacht op wake-up |
| 2 | Lunch check | 10 | Wacht op wake-up |
| 3 | Avondeten check | 10 | Wacht op wake-up |

### Task Engine Logic

**Bestand:** `src/scheduler/task-engine.ts` (modify)

In `getOpenTasks()`, filter taken waarvan dependency nog niet completed is:

```typescript
// Check of dependency vandaag al completed is
async function isDependencyCompleted(db: Client, dependsOnId: number): Promise<boolean> {
  const result = await db.execute({
    sql: `
      SELECT 1 FROM transcripts
      WHERE role = 'task'
        AND json_extract(metadata, '$.task_id') = ?
        AND json_extract(metadata, '$.status') IN ('sent', 'completed')
        AND date(created_at/1000, 'unixepoch', 'localtime') = date('now', 'localtime')
      LIMIT 1
    `,
    args: [dependsOnId]
  });
  return result.rows.length > 0;
}

// In getOpenTasks():
for (const task of tasks) {
  if (task.depends_on) {
    const depCompleted = await isDependencyCompleted(db, task.depends_on);
    if (!depCompleted) {
      skippedReasons.set(task.id, `Wacht op task #${task.depends_on}`);
      continue;
    }
  }
  // ... rest van filtering
}
```

### Wake-up Task Completion

Wake-up task wordt completed wanneer:
1. User stuurt eerste bericht van de dag, OF
2. KITT stuurt "Goedemorgen" en user reageert

---

## Out of Scope

- Per-task snooze (bestaat al via `snoozed_until`)

---

## Verificatie

### Sleep Mode
1. **Database:** `meta` tabel accepteert `kitt_sleep_until` entry
2. **Sleep activeren:** Think Loop exit early als sleeping
3. **Logging:** `[think-loop] 😴 Sleeping until HH:MM` in logs
4. **Wake on message:** User bericht cleart sleep mode
5. **Wake on timeout:** Timestamp verloopt → KITT wordt wakker
6. **Tokens:** Geen API calls tijdens sleep mode

### Task Dependencies
7. **Database:** `kitt_tasks.depends_on` kolom bestaat
8. **Filtering:** Taken met onvoltooide dependency verschijnen niet in open tasks
9. **Skipped reason:** "Wacht op task #X" wordt gelogd
10. **Wake-up flow:** Na wake-up completion, andere taken worden vrijgegeven

---

## Test Scenarios

```
1. Zeg "ik ga slapen" → KITT slaapt onbeperkt
2. Wacht 5 min → Think Loop logt "😴 Sleeping"
3. Stuur bericht → KITT wordt wakker
4. Zeg "focus mode 1 minuut" → KITT slaapt 1 minuut
5. Wacht 2 min → KITT is automatisch wakker
```
