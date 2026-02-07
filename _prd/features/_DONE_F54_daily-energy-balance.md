# F54: Daily Energy Balance

> **Priority:** 🟠 P1
> **Status:** ✅ Done
> **Owner:** Agent

---

## Overview

Dagelijks tussen 21:00-22:30 stuurt KITT een samenvatting van de energiebalans: wat er gegeten is (calories + macros) versus wat er verbrand is (Garmin). De task runt alleen als alle meal tasks (ontbijt, lunch, avondeten) completed zijn.

---

## User Stories

**US-01:** Als Renier wil ik aan het einde van de dag een overzicht van mijn energiebalans, zodat ik weet of ik in deficit/surplus zit.

**US-02:** Als Renier wil ik dat KITT eerst checkt of ik alles heb gelogd, zodat de samenvatting compleet is.

---

## Componenten

| Component | Nodig | Beschrijving |
|-----------|-------|--------------|
| Schema | ✅ | Migration v5→v6: depends_on naar JSON array |
| Task Engine | ✅ | Update voor array dependencies |
| Task | ✅ | Nieuwe task in kitt_tasks |
| Skill | ✅ | `daily-energy-balance` skill |
| Backend | ❌ | - |
| Portal | ❌ | - |

---

## Schema Change

**Migration v5 → v6:**

```sql
-- depends_on verandert van INTEGER naar TEXT (JSON array)
-- Bestaande data migreren: 0 → "[0]", NULL → NULL
ALTER TABLE kitt_tasks RENAME COLUMN depends_on TO depends_on_old;
ALTER TABLE kitt_tasks ADD COLUMN depends_on TEXT;
UPDATE kitt_tasks SET depends_on =
  CASE
    WHEN depends_on_old IS NULL THEN NULL
    ELSE '[' || depends_on_old || ']'
  END;
-- Drop old column (SQLite doesn't support DROP COLUMN easily, so leave it or recreate table)
```

**Task Engine Changes:**

```typescript
// In task-engine.ts

// Type change
depends_on: number[] | null;  // Was: number | null

// Parse function
function parseDependsOn(value: unknown): number[] | null {
  if (!value) return null;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
  return null;
}

// isDependencyCompleted moet ALLE dependencies checken
async function areDependenciesCompleted(db: Client, dependsOn: number[]): Promise<boolean> {
  for (const depId of dependsOn) {
    const completed = await isDependencyCompleted(db, depId);
    if (!completed) return false;
  }
  return true;
}
```

---

## Task Definition

```sql
INSERT INTO kitt_tasks (
  title,
  description,
  frequency,
  priority,
  skill_refs,
  time_window_start,
  time_window_end,
  grace_period_minutes,
  depends_on,
  created_by
) VALUES (
  'Dagelijkse energiebalans',
  'Samenvatting van gegeten calories/macros vs verbrand',
  'daily',
  'medium',
  '["daily-energy-balance"]',
  '21:00',
  '22:30',
  30,
  '[1, 2, 3]',  -- depends on ontbijt, lunch, avondeten tasks
  'renier'
);
```

---

## Skill: daily-energy-balance

**Locatie:** `.claude/skills/daily-energy-balance/SKILL.md`

**Data bronnen:**
| Data | Bron | Query/Command |
|------|------|---------------|
| Meals vandaag | nutrition_log | `SELECT * FROM nutrition_log WHERE date = date('now')` |
| Calories burned | Garmin | `python3 .claude/skills/garmin/garmin_api.py today` |

**Output format:**
```
📊 Energiebalans 7 feb

🍽️ Gegeten: 2.150 kcal
├─ Ontbijt: 450 kcal
├─ Lunch: 650 kcal
├─ Avondeten: 850 kcal
└─ Snacks: 200 kcal

📊 Macros totaal:
├─ Protein: 142g
├─ Carbs: 215g
└─ Fat: 72g

🔥 Verbrand: 2.400 kcal
├─ BMR: 1.800 kcal
└─ Activiteit: 600 kcal

⚖️ Balans: -250 kcal (deficit)
```

---

## Flow

```
21:00-22:30 Think Loop
         │
         ▼
┌─────────────────────────────┐
│ Task: Dagelijkse energie-   │
│ balans                      │
│ depends_on: [1,2,3]         │
└─────────────────────────────┘
         │
         ▼
┌─────────────────────────────┐
│ Task Engine checkt:         │
│ areDependenciesCompleted()  │
│ [1,2,3] all completed?      │
└─────────────────────────────┘
         │
    ┌────┴────┐
    ▼         ▼
 NIET ALLE   ALLE ✓
    │         │
    ▼         ▼
Task wordt   Task runt →
geskipped    KITT stuurt
(log: wacht  energiebalans
op task X)   via Telegram
```

---

## Acceptance Criteria

- [x] Schema migration v5→v6 werkt (depends_on is JSON array)
- [x] Task engine parsed array dependencies correct
- [x] Task wordt geskipped als niet alle meals gelogd zijn
- [x] Task runt als alle meals (1,2,3) completed zijn
- [x] Output bevat: meals, totaal kcal, macros (P/C/F), burned, balans
- [x] Skill file bestaat en beschrijft data bronnen + format

---

## Test Cases

1. **Alle meals gelogd:** Task runt om 21:00+, output is correct
2. **Lunch niet gelogd:** Task wordt geskipped met reden "wacht op task 2"
3. **Na 23:00:** Task window voorbij, wordt niet meer uitgevoerd vandaag
4. **Garmin data unavailable:** Graceful fallback, toont alleen nutrition data

---

## Files

| File | Actie | Beschrijving |
|------|-------|--------------|
| `src/memory/schema.ts` | Modified | Migration v5→v6, depends_on naar TEXT, energy balance task |
| `src/scheduler/task-engine.ts` | Modified | parseDependsOn(), areDependenciesCompleted() |
| `.claude/skills/daily-energy-balance/SKILL.md` | Created | Nieuwe skill |

---

## Implementation

**Implemented:** 7 feb 2026

### Changes Made

1. **Schema Migration v5→v6** (`src/memory/schema.ts`)
   - Recreated `kitt_tasks` table with `depends_on TEXT` (was INTEGER)
   - Migrated existing data: `0` → `[0]`
   - Added energy balance task with `depends_on = [1, 2, 3]`

2. **Task Engine Updates** (`src/scheduler/task-engine.ts`)
   - Added `parseDependsOn()` function for JSON array parsing
   - Added `areDependenciesCompleted()` function for checking multiple deps
   - Updated `getOpenTasks()` to use array dependencies
   - Improved skip reason messages for multiple dependencies

3. **New Skill** (`.claude/skills/daily-energy-balance/SKILL.md`)
   - Documented data sources (nutrition_log + Garmin)
   - SQLite queries for meal totals and day totals
   - Garmin API integration for calories burned
   - Output format specification

### Database State After Migration

```
id  title                     depends_on
--  ------------------------  ----------
0   Wake-up check
1   Ontbijt check             [0]
2   Lunch check               [0]
3   Avondeten check           [0]
4   Dagelijkse energiebalans  [1, 2, 3]
```

---

## Lees Eerst

> **Voor de agent die dit bouwt:**

### 1. Workflow
- `_prd/WORKFLOW.md`

### 2. Architecture
- `_prd/architecture/memory.md` - Database schema context
- `_prd/architecture/overview.md` - Systeem overzicht

### 3. Bestaande Code
- `src/scheduler/task-engine.ts` - Huidige task engine
- `src/memory/schema.ts` - Huidige schema + migrations
- `.claude/skills/nutrition-log/SKILL.md` - Nutrition skill als voorbeeld
- `.claude/skills/garmin/SKILL.md` - Garmin skill voor calories burned
