# Agent Pool Architecture

> **Status:** v1.1 — DB persistence
> **Laatst bijgewerkt:** 12 feb 2026
> **Issues:** KITT-146 (pool), KITT-147 (observability)

---

## Probleem

KITT spawnt agent subprocessen vanuit 3 onafhankelijke systemen (chat, think loop, background tasks). Zonder centraal register:
- Geen zicht op wat er draait
- Geen timeouts op hangende agents
- Geen recovery bij crashes
- Bij restart: alle history verloren

## Oplossing

Een **Agent Pool** (singleton) die alle `runAgent()` calls registreert, timeouts afdwingt, en opruimt bij crashes. Completed agents worden gepersisteerd in SQLite zodat history restarts overleeft.

---

## Architecture

```
┌───────────────────────────────────────────────────────┐
│                  Node.js Process (PM2)                 │
│                                                       │
│  Chat ──┐                                             │
│          │    ┌────────────────────────────────────┐   │
│  Think ──┼──► │         Agent Pool                 │   │
│          │    │    (src/bridge/agent-pool.ts)       │   │
│  Bgnd ───┘    │                                    │   │
│               │  Registry   │ Timeouts  │ Persist  │   │
│               │  (in-mem)   │ (watchdog)│ (SQLite) │   │
│               └──────────────┬─────────────────────┘   │
│                              │                         │
│               ┌──────────────┼──────────────┐          │
│               ▼              ▼              ▼          │
│         ┌──────────┐  ┌──────────┐  ┌────────────┐    │
│         │ Agent SDK│  │  Portal  │  │  kitt.db    │    │
│         │ query()  │  │ /api/    │  │ agent_      │    │
│         │          │  │ agents   │  │ executions  │    │
│         └──────────┘  └──────────┘  └────────────┘    │
│                                                       │
└───────────────────────────────────────────────────────┘
```

---

## Agent Lifecycle

```
              register()                   markRunning()
  Caller ──────────────► [starting] ─────────────────► [running]
                              │                            │
                              │                            │
                              │ (watchdog timeout)         │ complete() / fail()
                              ▼                            ▼
                         [timeout]                  [completed] / [error]
                              │                            │
                              └──────────┬─────────────────┘
                                         │
                                         ▼
                                   persistExecution()
                                   → INSERT INTO agent_executions
                                   → remove from active Map
```

### States

| Status | Betekenis |
|--------|-----------|
| `starting` | Geregistreerd, Agent SDK subprocess wordt gestart |
| `running` | SDK init message ontvangen, agent is actief |
| `completed` | Agent klaar, resultaat opgeslagen |
| `timeout` | Max duration overschreden, AbortController.abort() |
| `error` | Agent gefaild (API error, SDK crash, etc.) |

---

## Timeouts

Elke agent type heeft een max duration. De watchdog checkt elke 5 seconden of agents over tijd zijn.

| Type | Timeout | Gebruik |
|------|---------|---------|
| `chat` | 60s | Puur tekst, geen tools |
| `think` | 2 min | Think loop reasoning + response format |
| `think-sub` | 5 min | Skill execution met tools (garmin, nutrition, etc.) |
| `background` | 30 min | Lange taken (blog, LinkedIn, codebase audit) |

Bij timeout:
1. `AbortController.abort()` — stopt SDK subprocess
2. Status → `timeout`, error message met timing
3. `persistExecution()` — opslaan in DB
4. Log: `[agent-pool] ⚠️ TIMEOUT agent-id type=... duration=...`

---

## Data Model

### In-Memory (live state)

```typescript
// Alleen actieve agents — verdwijnt bij restart
Map<string, AgentEntry>

interface AgentEntry {
  id: string;                    // "chat-abc12345"
  type: AgentType;               // chat | think | think-sub | background
  status: AgentStatus;           // starting | running | completed | timeout | error
  chatId?: string;               // welke chat (als relevant)
  capabilityId?: string;         // welke skill/task
  startedAt: number;             // Unix ms
  completedAt?: number;
  durationMs?: number;
  resultLength?: number;
  error?: string;
  abortController: AbortController;
}
```

### Database (persistent)

```sql
-- kitt.db — overleeft restarts
CREATE TABLE agent_executions (
  id TEXT PRIMARY KEY,            -- "chat-abc12345"
  type TEXT NOT NULL,             -- chat | think | think-sub | background
  status TEXT NOT NULL,           -- completed | timeout | error
  chat_id TEXT,
  capability_id TEXT,
  started_at INTEGER NOT NULL,    -- Unix ms
  completed_at INTEGER,
  duration_ms INTEGER,
  result_length INTEGER,
  error TEXT
);

-- Indexes
CREATE INDEX idx_agent_exec_started ON agent_executions(started_at);
CREATE INDEX idx_agent_exec_type ON agent_executions(type);
CREATE INDEX idx_agent_exec_status ON agent_executions(status);
```

### Wat waar leeft

| Data | Bron | Overleeft restart? |
|------|------|-------------------|
| Active agents | In-memory `Map` | Nee (live state) |
| Recent history | `agent_executions` tabel | Ja |
| Today's stats | DB query + active count | Ja |

---

## Portal API

### `GET /api/agents`

```json
{
  "active": [
    {
      "id": "chat-abc12345",
      "type": "chat",
      "status": "running",
      "chatId": "renier-tg",
      "duration": "2.3s",
      "startedAt": 1739357845000
    }
  ],
  "recent": [
    {
      "id": "think-xyz78901",
      "type": "think",
      "status": "completed",
      "duration": "8.1s",
      "resultLength": 1240,
      "completedAt": 1739357800000
    }
  ],
  "stats": {
    "totalToday": 47,
    "active": 1,
    "completed": 44,
    "timeouts": 1,
    "errors": 1,
    "byType": {
      "chat": { "total": 30, "active": 1, "timeouts": 0, "errors": 0 },
      "think": { "total": 12, "active": 0, "timeouts": 1, "errors": 0 },
      "think-sub": { "total": 3, "active": 0, "timeouts": 0, "errors": 1 },
      "background": { "total": 2, "active": 0, "timeouts": 0, "errors": 0 }
    }
  }
}
```

| Veld | Bron |
|------|------|
| `active` | In-memory — `pool.getActive()` |
| `recent` | Database — `SELECT ... FROM agent_executions ORDER BY completed_at DESC LIMIT 20` |
| `stats` | Database + in-memory — `SELECT COUNT(*) ... WHERE started_at >= today` + `active.size` |

---

## Structured Logging

Elke state change wordt gelogd met `[agent-pool]` prefix:

```
[agent-pool] 🟢 START  chat-abc12345  type=chat  chatId=renier-tg
[agent-pool] ✅ DONE   chat-abc12345  type=chat  duration=2.3s  result=1240chars
[agent-pool] ⚠️ TIMEOUT think-xyz     type=think  duration=120.0s  max=120.0s
[agent-pool] ❌ ERROR  bg-def456      type=background  duration=45.0s  error="API rate limit"
[agent-pool] 🛑 SHUTDOWN abort chat-abc12345
```

---

## Callers

### Chat (router.ts)

```typescript
const response = await runAgent(message.content, {
  agentType: 'chat',
  chatId: message.chatId,
  allowedTools: [],
});
```

### Think Loop (scheduler/index.ts)

```typescript
// Main think loop agent
const response = await runAgent(thinkPrompt, {
  agentType: 'think',
  model,
  skipMemorySearch: true,
});

// Sub-agents for task execution
const subResponse = await runAgent(taskPrompt, {
  agentType: 'think-sub',
  capabilityId: task.skill_refs[0] || task.title,
  model: task.model,
  skipMemorySearch: true,
});
```

### Background Runner (scheduler/background-runner.ts)

```typescript
const response = await runAgent(backgroundPrompt, {
  agentType: 'background',
  chatId: task.chatId,
  capabilityId: task.capabilityId,
  model,
  skillContext,
  skipMemorySearch: true,
});
```

---

## Graceful Shutdown

Bij SIGINT/SIGTERM (pm2 restart):

```typescript
// bridge/index.ts
const { getAgentPool } = await import('./agent-pool.js');
getAgentPool().shutdown();
// → Stopt watchdog timer
// → Abort alle active agents (AbortController.abort())
// → Log: [agent-pool] 🛑 SHUTDOWN abort <id> voor elke agent
```

---

## Bestanden

| File | Rol |
|------|-----|
| `src/bridge/agent-pool.ts` | Agent Pool singleton — registry, timeouts, persistence |
| `src/bridge/agent.ts` | `runAgent()` — registreert bij pool, Promise.race timeout |
| `src/bridge/router.ts` | Chat caller — `agentType: 'chat'` |
| `src/scheduler/index.ts` | Think loop caller — `agentType: 'think'` / `'think-sub'` |
| `src/scheduler/background-runner.ts` | Background caller — `agentType: 'background'` |
| `src/bridge/log-server.ts` | Portal API — `GET /api/agents` |
| `src/bridge/index.ts` | Graceful shutdown — `pool.shutdown()` |
| `src/memory/schema.ts` | Migration v18 — `agent_executions` tabel |
| `frontends/portal/src/pages/system/Dashboard.tsx` | Portal UI — Agents tab |

---

## Gerelateerde Docs

| Doc | Relatie |
|-----|---------|
| `_prd/architecture/bridge.md` | Bridge architectuur (adapter pattern, router) |
| `_prd/architecture/orchestrator.md` | Orchestrator (routing, background tasks) |
| `_prd/architecture/think-loop.md` | Think loop (autonomous agent) |
| `_prd/architecture/ARCHITECTURE.md` | Architectuur principes |
