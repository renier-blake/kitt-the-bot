# F57: Workout Plans & Programs

> **Priority:** 🟡 P2
> **Status:** 📝 Spec (Future)
> **Owner:** -

---

## Overview

Structuur voor geprogrammeerde workout plannen (bijv. 12 weken HYROX prep). Bevat programs, workout templates, en exercise definities.

**Note:** Dit is een future feature. F55 en F56 moeten eerst klaar zijn.

---

## User Stories

**US-01:** Als Renier wil ik een workout programma kunnen volgen, zodat ik gestructureerd train.

**US-02:** Als Renier wil ik zien welke workout vandaag gepland staat, zodat ik weet wat ik moet doen.

**US-03:** Als Renier wil ik exercises met aliassen hebben, zodat KITT "bench" en "bankdrukken" herkent.

---

## Componenten

| Component | Nodig | Beschrijving |
|-----------|-------|--------------|
| Skill | ✅ | `workout-plan` - bekijk/beheer plannen |
| Task | ❌ | F55 doet de check al |
| Schema | ✅ | 3 tabellen: workout_programs, workout_templates, workout_exercises |
| Backend | ❌ | - |
| Portal | ❌ | - |

---

## Schema

### workout_programs

```sql
CREATE TABLE workout_programs (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,                    -- 'HYROX 12 Week Prep'
  description TEXT,
  duration_weeks INTEGER,                -- 12
  start_date TEXT,                       -- '2026-02-10'
  active INTEGER DEFAULT 1,
  created_at INTEGER DEFAULT (unixepoch() * 1000)
);
```

### workout_templates

```sql
CREATE TABLE workout_templates (
  id INTEGER PRIMARY KEY,
  program_id INTEGER,                    -- FK naar workout_programs
  name TEXT NOT NULL,                    -- 'Upper Body Push'
  description TEXT,
  week_number INTEGER,                   -- 1-12
  day_of_week INTEGER,                   -- 1=ma, 7=zo
  workout_type TEXT NOT NULL,            -- 'strength', 'running', 'hyrox'
  exercises TEXT,                        -- JSON array van geplande exercises
  duration_minutes INTEGER,
  notes TEXT,
  created_at INTEGER DEFAULT (unixepoch() * 1000),
  FOREIGN KEY (program_id) REFERENCES workout_programs(id)
);

CREATE INDEX idx_workout_templates_program ON workout_templates(program_id);
CREATE INDEX idx_workout_templates_week ON workout_templates(week_number);
```

### workout_exercises

```sql
CREATE TABLE workout_exercises (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,             -- 'Bench Press' (canonical name)
  category TEXT,                         -- 'chest', 'back', 'legs', 'cardio'
  equipment TEXT,                        -- 'barbell', 'dumbbell', 'machine', 'bodyweight'
  aliases TEXT,                          -- JSON: ["bench", "bankdrukken", "flat bench"]
  created_at INTEGER DEFAULT (unixepoch() * 1000)
);

CREATE INDEX idx_workout_exercises_category ON workout_exercises(category);
```

**Tabel overzicht:**

| Tabel | Doel |
|-------|------|
| `workout_programs` | Programma's (12 weken HYROX, etc.) |
| `workout_templates` | Geplande workouts per week/dag |
| `workout_exercises` | Exercise definities met aliassen |
| `workout_logs` | Wat je daadwerkelijk deed (F56) |

---

## Skill: workout-plan

**Trigger:** On-demand ("wat staat er vandaag?", "toon mijn programma")

**Capabilities:**
1. Bekijk actief programma
2. Bekijk workout van vandaag
3. Bekijk week overzicht
4. Start nieuw programma
5. Exercise lookup (met aliassen)

**Voorbeeld:**
```
User: Wat staat er vandaag gepland?
KITT: 📋 Vandaag (Week 3, Dinsdag):
      Upper Body Push
      - Bench Press: 4x8
      - Incline DB Press: 3x12
      - Shoulder Press: 3x10
      - Tricep Dips: 3x12
```

---

## Queries

**Vandaag's workout:**
```sql
SELECT wt.* FROM workout_templates wt
JOIN workout_programs wp ON wt.program_id = wp.id
WHERE wp.active = 1
  AND wt.week_number = ?  -- bereken uit start_date
  AND wt.day_of_week = ?  -- dag van de week (1-7)
```

**Week overzicht:**
```sql
SELECT * FROM workout_templates
WHERE program_id = ? AND week_number = ?
ORDER BY day_of_week;
```

**Exercise lookup met alias:**
```sql
SELECT * FROM workout_exercises
WHERE name = ? OR aliases LIKE ?;
```

---

## Acceptance Criteria

- [ ] Schema voor workout_programs, workout_templates, workout_exercises
- [ ] Skill kan actief programma tonen
- [ ] Skill kan vandaag's workout tonen
- [ ] Exercise aliassen werken

---

## Dependencies

- F56: Workout Log (voor workout_logs tabel)

---

## Future Ideas

- Portal: Visueel overzicht van 12 weken plan
- Progressie tracking: vergelijk gepland vs actual
- Auto-generate workout log vanuit template
- Import programs van externe bronnen
- Migreer 28 workouts uit gym-race-coach

---

## Files

| File | Actie | Beschrijving |
|------|-------|--------------|
| `.claude/skills/workout-plan/SKILL.md` | Create | Nieuwe skill |
| `src/memory/schema.ts` | Modify | 3 tabellen + migration |

---

## Lees Eerst

> **Voor de agent die dit bouwt:**

### Workflow
- `_prd/workflows/AGENT.md`

### Bestaande Code
- `src/memory/schema.ts` - Schema + migrations
- `.claude/skills/gym-race-coach/SKILL.md` - Bestaande workout data
- F56 spec voor workout_logs
