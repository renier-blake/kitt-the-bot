# F56: Workout Log

> **Priority:** 🟠 P1
> **Status:** 📝 Spec
> **Owner:** -

---

## Overview

On-demand skill om workouts te loggen. Nieuwe tabel voor workout logs met exercises, sets, reps, gewichten, etc.

---

## User Stories

**US-01:** Als Renier wil ik mijn strength workouts kunnen loggen, zodat ik mijn progressie kan bijhouden.

**US-02:** Als Renier wil ik running workouts kunnen linken aan Garmin, zodat ik alle data op één plek heb.

---

## Componenten

| Component | Nodig | Beschrijving |
|-----------|-------|--------------|
| Skill | ✅ | `workout-log` - on-demand logging |
| Task | ❌ | On-demand, geen scheduled task |
| Schema | ✅ | `workout_logs` tabel |
| Backend | ❌ | - |
| Portal | ❌ | - |

---

## Schema: workout_logs

```sql
CREATE TABLE workout_logs (
  id INTEGER PRIMARY KEY,
  date TEXT NOT NULL,                    -- '2026-02-07'
  workout_type TEXT NOT NULL,            -- 'strength', 'running', 'hyrox', 'cardio'
  workout_name TEXT,                     -- 'Upper Body Push', 'Easy Run'
  garmin_activity_id TEXT,               -- Link naar Garmin activity (geen import)
  exercises TEXT,                        -- JSON array van exercises
  duration_minutes INTEGER,
  calories INTEGER,
  notes TEXT,
  created_at INTEGER DEFAULT (unixepoch() * 1000)
);

CREATE INDEX idx_workout_logs_date ON workout_logs(date);
CREATE INDEX idx_workout_logs_type ON workout_logs(workout_type);
```

**Exercises JSON format:**

```json
[
  {
    "name": "Bench Press",
    "sets": 3,
    "reps": 10,
    "weight": 80,
    "unit": "kg"
  },
  {
    "name": "Incline Dumbbell Press",
    "sets": 3,
    "reps": 12,
    "weight": 24,
    "unit": "kg"
  },
  {
    "name": "Running",
    "distance": 5.2,
    "distance_unit": "km",
    "time": "25:30",
    "pace": "4:54"
  }
]
```

---

## Skill: workout-log

**Trigger:** On-demand ("log mijn workout", "workout loggen")

**Capabilities:**
1. Log strength workout met exercises
2. Log cardio/running met link naar Garmin
3. Bekijk recente logs
4. Bekijk logs per type

**Voorbeeld interacties:**

**Strength:**
```
User: Log mijn workout van vandaag
KITT: Wat voor workout was het?
User: Upper body push
KITT: Welke exercises heb je gedaan?
User: Bench press 3x10 80kg, incline db press 3x12 24kg
KITT: ✅ Gelogd: Upper Body Push
      - Bench Press: 3x10 @ 80kg
      - Incline DB Press: 3x12 @ 24kg
```

**Running (link naar Garmin):**
```
User: Log mijn run van vandaag
KITT: Ik zie een activity in Garmin: Easy Run, 5.2km, 25:30
      Zal ik deze linken?
User: Ja
KITT: ✅ Gelogd: Easy Run (gelinkt aan Garmin)
```

**Exercise aliassen (in skill beschreven):**
- "bench", "bench press", "bankdrukken" → Bench Press
- "db press", "dumbbell press" → Dumbbell Press
- "squat", "squats", "back squat" → Squat

---

## Queries

**Log toevoegen:**
```sql
INSERT INTO workout_logs (date, workout_type, workout_name, garmin_activity_id, exercises, duration_minutes, calories, notes)
VALUES ('2026-02-07', 'strength', 'Upper Body Push', NULL, '[...]', 45, 320, NULL);
```

**Recente logs:**
```sql
SELECT * FROM workout_logs
ORDER BY date DESC, created_at DESC
LIMIT 10;
```

**Logs per type:**
```sql
SELECT * FROM workout_logs
WHERE workout_type = 'strength'
ORDER BY date DESC;
```

---

## Acceptance Criteria

- [ ] Schema migration voor workout_logs tabel
- [ ] Skill kan strength workouts loggen met exercises
- [ ] Skill kan running linken aan Garmin activity ID
- [ ] Exercises worden als JSON opgeslagen
- [ ] Recente logs kunnen worden opgevraagd

---

## Test Cases

1. **Log strength:** "Log bench press 3x10 80kg" → opgeslagen
2. **Log running:** Link naar Garmin activity
3. **Bekijk logs:** "Wat heb ik deze week gedaan?" → overzicht
4. **Exercise alias:** "bankdrukken" wordt herkend als Bench Press

---

## Files

| File | Actie | Beschrijving |
|------|-------|--------------|
| `.claude/skills/workout-log/SKILL.md` | Create | Nieuwe skill |
| `src/memory/schema.ts` | Modify | workout_logs tabel + migration |

---

## Lees Eerst

> **Voor de agent die dit bouwt:**

### Workflow
- `_prd/workflows/AGENT.md`

### Bestaande Code
- `src/memory/schema.ts` - Schema + migrations
- `.claude/skills/garmin/SKILL.md` - Voor activity linking
