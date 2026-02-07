# F55: Workout Check

> **Priority:** 🟠 P1
> **Status:** 📝 Spec
> **Owner:** -

---

## Overview

Avond check of er vandaag een workout is gedaan (via Garmin). Geeft samenvatting en vraagt of je wilt loggen als er nog geen log is.

---

## User Stories

**US-01:** Als Renier wil ik 's avonds een samenvatting van mijn workout, zodat ik weet wat ik heb gedaan.

**US-02:** Als Renier wil ik gevraagd worden of ik mijn workout wil loggen, zodat ik details kan vastleggen.

---

## Componenten

| Component | Nodig | Beschrijving |
|-----------|-------|--------------|
| Skill | ✅ | `workout-check` - checkt Garmin, geeft samenvatting |
| Task | ✅ | Avond check 09:00-21:00 |
| Schema | ❌ | Gebruikt workout_logs uit F56 |
| Backend | ❌ | - |
| Portal | ❌ | - |

---

## Skill: workout-check

**Data bronnen:**

| Data | Bron | Query/Command |
|------|------|---------------|
| Workouts vandaag | Garmin | `python3 .claude/skills/garmin/garmin_api.py activities 5` |
| Bestaande logs | workout_logs | `SELECT * FROM workout_logs WHERE date = date('now')` |

**Logica:**
1. Haal recente Garmin activities op
2. Filter op vandaag
3. Check of er al een workout_log is voor deze activity (garmin_activity_id)
4. Geef samenvatting
5. Vraag of user wil loggen als nog niet gelogd

**Output format:**
```
💪 Workout vandaag: Upper Body Push
├─ Duur: 45 min
├─ Calories: 320 kcal
└─ Type: Strength

Wil je hier nog details van loggen? (exercises, gewichten, etc.)
```

---

## Task: Workout check

| Veld | Waarde |
|------|--------|
| title | Workout check |
| description | Check Garmin voor workouts, vraag om logging |
| frequency | daily |
| priority | low |
| time_window | 09:00 - 21:00 |
| grace_period | 30 min |
| depends_on | [0] |
| skill_refs | ["workout-check"] |

---

## Flow

```
09:00-21:00 Think Loop
         │
         ▼
┌─────────────────────────────┐
│ Task: Workout check         │
└─────────────────────────────┘
         │
         ▼
┌─────────────────────────────┐
│ Query Garmin activities     │
│ Filter op vandaag           │
└─────────────────────────────┘
         │
    ┌────┴────┐
    ▼         ▼
 GEEN       WORKOUT
 WORKOUT    GEVONDEN
    │         │
    ▼         ▼
 Niets      Samenvatting
 doen       + vraag logging
```

---

## Acceptance Criteria

- [ ] Task runt 09:00-21:00
- [ ] Haalt Garmin activities van vandaag op
- [ ] Geeft samenvatting (type, duur, calories)
- [ ] Checkt of er al een log is
- [ ] Vraagt om logging als nog niet gelogd

---

## Test Cases

1. **Strength workout gedaan:** Samenvatting + vraag logging
2. **Running workout gedaan:** Samenvatting + link naar Garmin data
3. **Geen workout:** Niets melden
4. **Al gelogd:** Samenvatting zonder vraag

---

## Dependencies

- F56: Workout Log (voor workout_logs tabel)

---

## Files

| File | Actie | Beschrijving |
|------|-------|--------------|
| `.claude/skills/workout-check/SKILL.md` | Create | Nieuwe skill |
| `src/memory/schema.ts` | Modify | Task toevoegen aan seed |

---

## Lees Eerst

> **Voor de agent die dit bouwt:**

### Workflow
- `_prd/workflows/AGENT.md`

### Bestaande Code
- `.claude/skills/garmin/SKILL.md` - Garmin API
- `src/memory/schema.ts` - seedDefaultTasks
- F56 spec voor workout_logs schema
