# F53 - Transcript Schema Refactor

> **Status:** ✅ Done
> **Priority:** P1 (nodig voor task tracking)
> **Depends on:** F51 Task Engine

---

## Probleem

Het huidige transcript schema is een mix van concerns:
- `role` bevat zowel actors (`user`, `assistant`) als types (`thought`)
- Geen manier om task executions te tracken
- Agent kan niet queryen of een task al is uitgevoerd

---

## Oplossing

### Nieuw Schema

```sql
transcripts (
  id INTEGER PRIMARY KEY,
  session_id TEXT,
  channel TEXT,              -- 'telegram', 'think-loop'

  -- Actor: wie zegt/doet dit
  role TEXT NOT NULL,        -- 'kitt' of 'user'

  -- Type: wat voor log is dit
  type TEXT DEFAULT 'message', -- 'message', 'thought', 'task'

  -- Task tracking (alleen voor type='task')
  task_id INTEGER,           -- FK naar kitt_tasks.id
  task_status TEXT,          -- 'reminder', 'completed', 'skipped', 'deferred'

  content TEXT,
  metadata TEXT,             -- JSON
  embedding BLOB,
  created_at INTEGER
)
```

### Role waarden
| Role | Betekenis |
|------|-----------|
| `kitt` | KITT zegt/doet iets |
| `user` | Gebruiker (Renier) zegt iets |

### Type waarden
| Type | Betekenis | Voorbeeld |
|------|-----------|-----------|
| `message` | Conversatie bericht | "Goedemorgen!" |
| `thought` | Interne reflectie | Think loop observatie |
| `task` | Task execution log | Reminder gestuurd, task completed |

### Task Status waarden
| Status | Betekenis |
|--------|-----------|
| `reminder` | KITT heeft een reminder gestuurd |
| `completed` | Task is afgerond (user heeft actie gedaan) |
| `skipped` | Task overgeslagen (bijv. buiten window) |
| `deferred` | Task uitgesteld naar later |

---

## Flow Voorbeelden

### Voorbeeld 1: Ontbijt Reminder

KITT stuurt een reminder voor ontbijt logging:

```
# Log 1: Het bericht zelf
role=kitt, type=message, content="Hey, heb je al ontbijt gehad?"

# Log 2: Task tracking
role=kitt, type=task, task_id=1, task_status=reminder
```

### Voorbeeld 2: Task Completed

User logt ontbijt, KITT bevestigt:

```
# Log 1: User response
role=user, type=message, content="Ja, 2 broodjes kaas"

# Log 2: KITT bevestiging
role=kitt, type=message, content="Top, gelogd! 320 kcal"

# Log 3: Task completed
role=kitt, type=task, task_id=1, task_status=completed
```

### Voorbeeld 3: Wake-up Check

User stuurt eerste bericht van de dag:

```
# Log 1: User message
role=user, type=message, content="Goedemorgen"

# Log 2: Wake-up task auto-completed
role=kitt, type=task, task_id=0, task_status=completed
```

---

## Query Mogelijkheden

### Is task vandaag al uitgevoerd?

```sql
SELECT task_status FROM transcripts
WHERE type = 'task'
  AND task_id = ?
  AND date(created_at/1000, 'unixepoch', 'localtime') = date('now', 'localtime')
ORDER BY created_at DESC
LIMIT 1
```

### Alle task executions vandaag

```sql
SELECT t.task_id, k.title, t.task_status, t.created_at
FROM transcripts t
JOIN kitt_tasks k ON t.task_id = k.id
WHERE t.type = 'task'
  AND date(t.created_at/1000, 'unixepoch', 'localtime') = date('now', 'localtime')
ORDER BY t.created_at DESC
```

### Wake-up check (special case)

```sql
-- Is user wakker? (heeft bericht gestuurd OF wake-up task completed)
SELECT 1 FROM transcripts
WHERE date(created_at/1000, 'unixepoch', 'localtime') = date('now', 'localtime')
  AND (
    (role = 'user' AND type = 'message')
    OR (type = 'task' AND task_id = 0 AND task_status = 'completed')
  )
LIMIT 1
```

---

## Implementatie

### Stap 1: Schema Migratie

**File:** `src/memory/schema.ts`

```typescript
// Migration v4 -> v5
if (currentVersion < 5) {
  // Add type column
  await db.execute("ALTER TABLE transcripts ADD COLUMN type TEXT DEFAULT 'message'");

  // Add task tracking columns
  await db.execute('ALTER TABLE transcripts ADD COLUMN task_id INTEGER');
  await db.execute('ALTER TABLE transcripts ADD COLUMN task_status TEXT');

  // Migrate existing data
  await db.execute("UPDATE transcripts SET role = 'kitt' WHERE role = 'assistant'");
  await db.execute("UPDATE transcripts SET type = 'thought' WHERE role = 'thought'");
  await db.execute("UPDATE transcripts SET role = 'kitt' WHERE role = 'thought'");

  console.log('[schema] Migration: Added type, task_id, task_status columns');
}
```

### Stap 2: Memory Service Update

**File:** `src/memory/index.ts`

```typescript
interface StoreMessageOptions {
  sessionId: string;
  channel: string;
  role: 'kitt' | 'user';
  type?: 'message' | 'thought' | 'task';
  content: string;
  taskId?: number;
  taskStatus?: 'reminder' | 'completed' | 'skipped' | 'deferred';
}

async storeMessage(options: StoreMessageOptions): Promise<void> {
  await this.db.execute({
    sql: `INSERT INTO transcripts (session_id, channel, role, type, content, task_id, task_status, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      options.sessionId,
      options.channel,
      options.role,
      options.type || 'message',
      options.content,
      options.taskId || null,
      options.taskStatus || null,
      Date.now(),
    ],
  });
}
```

### Stap 3: Task Engine Integration

**File:** `src/scheduler/task-engine.ts`

```typescript
/**
 * Log a task execution
 */
export async function logTaskExecution(
  db: Client,
  taskId: number,
  status: 'reminder' | 'completed' | 'skipped' | 'deferred',
  notes?: string
): Promise<void> {
  await db.execute({
    sql: `INSERT INTO transcripts (session_id, channel, role, type, task_id, task_status, content, created_at)
          VALUES ('task-engine', 'system', 'kitt', 'task', ?, ?, ?, ?)`,
    args: [taskId, status, notes || null, Date.now()],
  });

  console.log(`[task-engine] 📝 Logged: task #${taskId} = ${status}`);
}

/**
 * Check if task was executed today
 */
export async function wasTaskExecutedToday(
  db: Client,
  taskId: number,
  statuses: string[] = ['reminder', 'completed']
): Promise<boolean> {
  const placeholders = statuses.map(() => '?').join(', ');
  const result = await db.execute({
    sql: `SELECT 1 FROM transcripts
          WHERE type = 'task'
            AND task_id = ?
            AND task_status IN (${placeholders})
            AND date(created_at/1000, 'unixepoch', 'localtime') = date('now', 'localtime')
          LIMIT 1`,
    args: [taskId, ...statuses],
  });
  return result.rows.length > 0;
}
```

### Stap 4: Think Loop Integration

Na het sturen van een message voor een task, log de task execution:

```typescript
// In think loop, na MESSAGE actie:
if (thought.action === 'message' && thought.message) {
  await sendTelegramMessage(chatId, thought.message);

  // Als dit voor een task was, log het
  if (context.tasks.length > 0) {
    const task = context.tasks[0]; // Hoogste priority task
    await logTaskExecution(db, task.id, 'reminder');
  }
}
```

---

## Bestanden die wijzigen

| Bestand | Actie | Beschrijving |
|---------|-------|--------------|
| `src/memory/schema.ts` | Modify | Schema v5 met type, task_id, task_status |
| `src/memory/index.ts` | Modify | storeMessage() uitbreiden |
| `src/scheduler/task-engine.ts` | Modify | logTaskExecution(), wasTaskExecutedToday() |
| `src/scheduler/index.ts` | Modify | Task logging na actions |
| `src/bridge/telegram.ts` | Modify | Role 'kitt' ipv 'assistant' |

---

## Verificatie

1. **Schema:** Nieuwe kolommen bestaan na migratie
2. **Logging:** Task executions verschijnen in transcripts tabel
3. **Query:** `wasTaskExecutedToday()` werkt correct
4. **Portal:** Database viewer toont type/task_id/task_status kolommen
5. **Think Loop:** Logs tonen "📝 Logged: task #1 = reminder"

---

## Out of Scope

- UI voor task history (kan later in portal)
- Task analytics/statistics
- Undo/retry van task executions
