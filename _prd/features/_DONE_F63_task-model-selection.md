# F63: Task Model Selection

> **Priority:** 🟠 P1
> **Status:** ✅ Done
> **Owner:** Agent

---

## Overview

Sommige taken zijn te complex voor Haiku (zelfreflectie, blog schrijven). Deze feature voegt een `model` kolom toe aan `kitt_tasks` zodat specifieke taken met een krachtiger model (Opus/Sonnet) kunnen draaien.

---

## User Stories

**US-01:** Als KITT wil ik complexe taken zoals zelfreflectie met Opus uitvoeren, zodat de kwaliteit beter is.

**US-02:** Als Renier wil ik dat simpele taken op Haiku blijven, zodat kosten laag blijven.

---

## Componenten

| Component | Nodig | Beschrijving |
|-----------|-------|--------------|
| Skill | ❌ | - |
| Task | ❌ | Bestaande taken krijgen model veld |
| Schema | ✅ | `model` kolom toevoegen aan `kitt_tasks` |
| Backend | ✅ | Think Loop aanpassen voor model routing |
| Portal | ❌ | - |

---

## Schema Change

**Migration v11 → v12:**

```sql
ALTER TABLE kitt_tasks ADD COLUMN model TEXT;
-- NULL = gebruik Think Loop default (haiku)
-- 'opus' = spawn Opus sub-agent
-- 'sonnet' = spawn Sonnet sub-agent
```

**Seed data updates:**

```sql
-- KITT zelfreflectie → Opus
UPDATE kitt_tasks SET model = 'opus' WHERE id = 7;

-- Blog Writer → Opus (als task bestaat)
UPDATE kitt_tasks SET model = 'opus' WHERE title LIKE '%Blog Writer%';
```

---

## Think Loop Aanpassingen

### Huidige flow (alles Haiku):

```
Think Loop (Haiku)
    → ziet taak
    → voert taak UIT in zelfde context
    → stuurt resultaat naar Telegram
```

### Nieuwe flow (model per task):

```
Think Loop (Haiku)
    → ziet taak met model='opus'
    → spawn sub-agent: runAgent(taskPrompt, { model: 'opus' })
    → Opus voert taak uit
    → output terug naar Think Loop
    → Think Loop verwerkt resultaat (Telegram, db, etc.)
```

### Code change in `src/scheduler/index.ts`:

```typescript
// In runThinkLoop(), na het vinden van een taak:

if (task.model && task.model !== model) {
  // Task needs different model - spawn sub-agent
  console.log(`[think-loop] Task "${task.title}" requires ${task.model}, spawning sub-agent...`);

  const taskPrompt = buildTaskPrompt(task, context);
  const { runAgent } = await import('../bridge/agent.js');
  const taskResponse = await runAgent(taskPrompt, {
    model: task.model as AgentModel,
    skipMemorySearch: true
  });

  // Process sub-agent response
  // ... handle taskResponse.result
} else {
  // Current flow: Haiku handles inline
}
```

### Task prompt builder:

```typescript
function buildTaskPrompt(task: KittTask, context: ThinkLoopContext): string {
  const skillContent = task.skill_refs
    ? loadSkillContent(task.skill_refs[0])
    : '';

  return `
Je bent KITT en je voert nu de volgende taak uit:

**Taak:** ${task.title}
**Beschrijving:** ${task.description}

${skillContent ? `## Skill Instructies\n\n${skillContent}` : ''}

## Context
- Tijd: ${context.currentTime}
- Dag: ${context.dayOfWeek}

Voer de taak uit volgens de skill instructies.
Output je resultaat met ACTION: COMPLETE_TASK #${task.id} als je klaar bent.
`;
}
```

---

## Model Toewijzingen

| Task | Huidig | Nieuw Model | Reden |
|------|--------|-------------|-------|
| KITT zelfreflectie | Haiku | **opus** | Introspectie, patroonherkenning |
| Blog Writer | Haiku | **opus** | Creatief schrijven |
| Blog Publisher | Haiku | haiku (null) | Technisch, geen creativiteit |
| Daily reflection (Renier) | Haiku | sonnet | Samenvatten |
| Workout check | Haiku | haiku (null) | Simpele query |
| Nutrition reminder | Haiku | haiku (null) | Simpele reminder |
| Apple Reminders | Haiku | haiku (null) | Simpele query |

---

## Acceptance Criteria

- [x] `model` kolom bestaat in `kitt_tasks`
- [x] KITT zelfreflectie draait op Opus
- [x] Blog Writer draait op Opus (indien task bestaat)
- [x] Think Loop spawnt sub-agent voor tasks met ander model
- [x] Sub-agent output wordt correct verwerkt
- [x] Tasks zonder model blijven op Haiku

---

## Test Cases

1. **Opus task:** KITT zelfreflectie triggert → logs tonen "spawning Opus sub-agent"
2. **Haiku task:** Workout check triggert → geen sub-agent, normale flow
3. **Null model:** Task zonder model → gebruikt Think Loop default

---

## Cost Impact

| Scenario | Haiku | Opus | Verschil |
|----------|-------|------|----------|
| Zelfreflectie (~2k tokens) | $0.002 | $0.06 | +$0.058/dag |
| Blog Writer (~3k tokens) | $0.003 | $0.09 | +$0.087/dag |
| **Totaal extra/maand** | - | - | ~$4.50 |

Acceptabel voor kwaliteitsverbetering.

---

## Implementation

**Gebouwd op:** 8 feb 2026

### Wijzigingen

1. **`src/memory/schema.ts`**
   - SCHEMA_VERSION verhoogd van 11 naar 12
   - Migration v11→v12: `ALTER TABLE kitt_tasks ADD COLUMN model TEXT`
   - Seed: `model='opus'` voor task #7 (KITT zelfreflectie) en Blog Writer

2. **`src/scheduler/task-engine.ts`**
   - `model` field toegevoegd aan `KittTask` interface
   - Row mapping uitgebreid met model field

3. **`src/scheduler/index.ts`**
   - Pre-processing van tasks met different model vóór Haiku prompt
   - Sub-agent spawning via `runAgent()` met task-specific model
   - Tasks met ander model worden uit context verwijderd na sub-agent
   - Skill content wordt inline geladen voor task prompt

### Hoe het werkt

```
Think Loop start (Haiku)
  ↓
Check: tasks met model !== 'haiku'?
  ↓ ja
Spawn sub-agent(s) met juiste model
  ↓
Verwijder die tasks uit Haiku context
  ↓
Haiku verwerkt alleen nog simpele tasks
```

---

## Files

| File | Actie | Beschrijving |
|------|-------|--------------|
| `src/memory/schema.ts` | Modify | Migration v11→v12, model kolom |
| `src/scheduler/index.ts` | Modify | Sub-agent spawning logic |
| `src/scheduler/think-loop.ts` | Modify | Task prompt builder |

---

## Lees Eerst

> **Voor de agent die dit bouwt:**

### Workflow
- `_prd/workflows/AGENT.md`

### Bestaande Code
- `src/scheduler/index.ts` — `runThinkLoop()` functie
- `src/scheduler/think-loop.ts` — Task handling
- `src/bridge/agent.ts` — `runAgent()` met model parameter
- `src/memory/schema.ts` — Migrations
