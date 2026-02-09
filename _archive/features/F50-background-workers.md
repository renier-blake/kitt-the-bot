# F50 - Background Workers

> **Status:** 📝 Spec
> **Priority:** 🟠 P1
> **Type:** Architecture

---

## Doel

Lange taken uitvoeren zonder Telegram te blokkeren:
- Main agent blijft responsief
- Worker voert taak uit op achtergrond
- Resultaat wordt automatisch naar Telegram gestuurd
- Meerdere workers kunnen parallel draaien

---

## Waarom?

| Nu (synchroon) | Met Workers |
|----------------|-------------|
| ❌ Telegram blokkeert tijdens lange taak | ✅ Direct antwoord, taak op achtergrond |
| ❌ Kan niet praten tijdens browser task | ✅ Main agent blijft beschikbaar |
| ❌ Één taak tegelijk | ✅ Meerdere taken parallel |
| ❌ Timeout bij lange taken | ✅ Workers hebben geen timeout |

---

## Architectuur

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Telegram   │────▶│ Main Agent  │────▶│  Job Queue  │
│   Bridge    │◀────│  (snel)     │     │  (SQLite)   │
└─────────────┘     └─────────────┘     └──────┬──────┘
       ▲                                       │
       │                              ┌────────┴────────┐
       │                              ▼                 ▼
       │                        ┌──────────┐     ┌──────────┐
       └────────────────────────│ Worker 1 │     │ Worker 2 │
          resultaat             └──────────┘     └──────────┘
```

---

## Componenten

### 1) Job Queue (SQLite)

```sql
CREATE TABLE jobs (
  id INTEGER PRIMARY KEY,
  chat_id TEXT NOT NULL,
  prompt TEXT NOT NULL,
  status TEXT DEFAULT 'pending',  -- pending, running, done, failed
  result TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  started_at DATETIME,
  completed_at DATETIME,
  worker_id TEXT
);
```

### 2) Queue API (`src/bridge/queue.ts`)

```typescript
// Add job to queue
async function addJob(chatId: string, prompt: string): Promise<number>;

// Get next pending job
async function getNextJob(): Promise<Job | null>;

// Update job status
async function updateJob(id: number, status: string, result?: string): Promise<void>;

// Get running jobs count
async function getRunningCount(): Promise<number>;
```

### 3) Worker (`src/bridge/worker.ts`)

```typescript
// Worker loop
while (true) {
  const job = await queue.getNextJob();
  if (job) {
    await queue.updateJob(job.id, 'running');

    try {
      // Run Agent SDK
      const result = await runAgent(job.prompt);

      // Send to Telegram
      await telegram.sendMessage(job.chat_id, result);

      await queue.updateJob(job.id, 'done', result);
    } catch (e) {
      await queue.updateJob(job.id, 'failed', e.message);
    }
  }
  await sleep(1000);
}
```

### 4) Main Agent Integration

De main agent krijgt een tool/instructie om taken te queuen:

```typescript
// In bridge, als agent bepaalt dat taak lang is:
if (shouldRunInBackground(response)) {
  const jobId = await queue.addJob(chatId, originalPrompt);
  await telegram.sendMessage(chatId, "Ik ga dit op de achtergrond doen. Je hoort van me.");
}
```

---

## Folder Structuur

```
src/bridge/
├── index.ts          # Main bridge (update: queue integration)
├── queue.ts          # Job queue API
├── worker.ts         # Background worker
└── telegram.ts       # Telegram API (al bestaand)
```

---

## PM2 Setup

```javascript
// ecosystem.config.cjs
module.exports = {
  apps: [
    {
      name: 'kitt-bridge',
      script: 'npm',
      args: 'run bridge',
    },
    {
      name: 'kitt-worker-1',
      script: 'npm',
      args: 'run worker',
    },
    {
      name: 'kitt-worker-2',
      script: 'npm',
      args: 'run worker',
    },
  ],
};
```

---

## Hoe bepaalt agent of taak lang is?

Opties:

1. **Keyword detection**: "zoek op", "browser", "analyseer" → background
2. **Skill metadata**: Skills kunnen `background: true` hebben
3. **Agent zelf**: Agent krijgt instructie om zelf te beslissen
4. **User trigger**: User zegt "op de achtergrond" of "async"

Aanbeveling: **Optie 3** - agent beslist zelf op basis van taak complexiteit.

---

## Kritieke Files

| File | Actie |
|------|-------|
| `src/bridge/queue.ts` | Create |
| `src/bridge/worker.ts` | Create |
| `src/bridge/index.ts` | Update - queue integration |
| `profile/memory/kitt.db` | Update - jobs table |
| `ecosystem.config.cjs` | Update - worker processes |
| `package.json` | Update - worker script |

---

## Verificatie

1. **Queue test:**
   ```bash
   # Add job
   npm run queue:add "zoek vluchten naar barcelona"

   # Check queue
   sqlite3 profile/memory/kitt.db "SELECT * FROM jobs"
   ```

2. **Worker test:**
   ```bash
   # Start worker
   npm run worker

   # Check dat job wordt opgepakt en resultaat naar Telegram gaat
   ```

3. **Integration test:**
   - Stuur "zoek iets op google" via Telegram
   - Verwacht: direct antwoord "ik ga dit doen"
   - Verwacht: later resultaat in Telegram
   - Verwacht: ondertussen kun je andere vragen stellen

---

## Acceptatiecriteria

- [ ] Job queue in SQLite
- [ ] Worker process dat jobs uitvoert
- [ ] Main agent kan taken queuen
- [ ] Resultaat wordt naar Telegram gestuurd
- [ ] Meerdere workers kunnen parallel draaien
- [ ] Main agent blijft responsief tijdens background taken
- [ ] PM2 config voor workers

---

## Toekomstig

- Job prioriteit (urgent vs normal)
- Job cancellation
- Progress updates naar Telegram
- Worker health monitoring
- Retry failed jobs
