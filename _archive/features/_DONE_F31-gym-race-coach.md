# F31: Gym Race Coach

> **Priority:** 🟡 P2
> **Status:** ✅ Done
> **Owner:** KITT
> **Started:** 5 februari 2026
> **Completed:** 5 februari 2026
> **Depends on:** F30 (Garmin) ✅, F28 (Nutrition) ✅

---

## Overview

Training coach skill voor race preparation (GYMRACE Amsterdam - 1 maart 2026). Integreert Garmin health data + nutrition tracking + 4-week training plan.

**Key Features:**
- ✅ Daily workout delivery met readiness context
- ✅ Garmin integration (sleep, HRV, body battery, resting HR)
- ✅ Readiness calculation (weighted formula)
- ✅ 28 workouts (week 1-4) gemigreerd
- ✅ Progress tracking (wall balls, completion rates)
- ✅ Nutrition integration reminders

---

## Implementation

### Database Schema

Created 2 tables in `kitt.db`:
- **training_state** - Current race info, progress, targets
- **workout_log** - Completed workouts + RPE + metrics

### Skill Files

- `.claude/skills/gym-race-coach/SKILL.md` - Complete documentation
- `.claude/skills/gym-race-coach/workouts/week{1-4}/` - 28 workout JSONs
- Database initialized with current race state

### Readiness Calculation

**Formula:**
```
Readiness = (Sleep × 0.40) + (HRV × 0.25) + (Body Battery × 0.20) + (Resting HR × 0.15)
```

**Test Result (Today):**
```
Sleep Score:      81 × 0.40 = 32.4
HRV Score:        80 × 0.25 = 20.0
Body Battery:     87 × 0.20 = 17.4
Resting HR Score: 96 × 0.15 = 14.4
─────────────────────────────
READINESS SCORE: 84 / 100 ✅
Status: Excellent 🟢 - Push hard!
```

---

## Current Race Status

| Info | Status |
|------|--------|
| Race | GYMRACE Amsterdam |
| Date | 1 maart 2026 |
| Countdown | ~24 dagen |
| Target Time | 1:20:00 |
| Current Week | 1 van 4 |

### Skill Progress

- **Wall balls:** 18 reps (target: 30) 🔥 Primary focus
- **Slam ball carry:** Untested
- **KB swings:** Untested (16-24kg)
- **Sled push:** High confidence
- **Farmers lunges:** High (32kg)

---

## Features Implemented

✅ **Database Tables**
- training_state (race config, progress tracking)
- workout_log (completed workouts + performance)

✅ **Readiness Formula**
- Sleep component (0-100)
- HRV component (Balanced/Unbalanced/Low)
- Body Battery (0-100)
- Resting HR adjustment vs baseline

✅ **28 Workouts Migrated**
- Week 1: 7 workouts
- Week 2: 7 workouts
- Week 3: 7 workouts
- Week 4: 7 workouts
- Each includes warmup, main sets, cooldown

✅ **Garmin Integration**
- Pulls sleep score, HRV, body battery, resting HR
- Auto-calculates readiness daily
- Shows context in workout delivery

✅ **Nutrition Integration**
- Pre/post-workout fuel guidance
- Calorie targets per workout type
- Protein targets

---

## Workflow

1. **Daily morning:**
   - Query Garmin (sleep, HRV, body battery, resting HR)
   - Calculate readiness score
   - Load day's workout
   - Deliver with context

2. **Post-workout:**
   - User logs RPE + reps (if wall balls)
   - Updates workout_log table
   - Calculates weekly completion

3. **Weekly:**
   - Shows week overview
   - Calculates completion %
   - Shows skill progress

---

## Test Results

✅ **Readiness Calculation:** Working with real Garmin data
✅ **Database:** training_state initialized, ready for logs
✅ **Workouts:** 28 JSONs migrated and available
✅ **Skills Dependency:** F30 (Garmin) + F28 (Nutrition) integrated

---

## Acceptance Criteria

- [x] Database schema (training_state, workout_log)
- [x] Workouts migrated (28 files)
- [x] SKILL.md documentation
- [x] Readiness calculation formula
- [x] Garmin integration tested
- [x] Nutrition integration documented
- [x] User state initialized
- [x] Wall ball tracking prepared
- [ ] Live test via Telegram (user test)

---

## Next Steps

**User can now:**
- Ask "Wat is mijn workout vandaag?" → Gets workout + readiness
- Ask "Hoe sta ik ervoor?" → Gets progress + wall ball status
- Post-workout: "RPE 8, 22 wall ball reps" → Logs automatically

---

## Files Created/Migrated

| File | Purpose |
|------|---------|
| `src/db/migrations/003-gym-race-coach.sql` | Database schema |
| `.claude/skills/gym-race-coach/SKILL.md` | Skill documentation |
| `.claude/skills/gym-race-coach/workouts/` | 28 workout JSONs |

---

## Notes

- Readiness scores guide intensity, not skip workouts
- Wall balls are primary focus (weakest skill)
- Garmin data is foundation (auto-pulls daily)
- Nutrition integrated for recovery optimization
- 4-week taper strategy (last 2 weeks lighter)
