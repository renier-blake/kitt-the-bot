---
name: gym-race-coach
description: Training coach voor GYMRACE/HYROX met Garmin en nutrition integratie. Use when user asks about workouts, training readiness, or race progress.
requires:
  skills:
    - garmin
    - nutrition-log
---

# Gym Race Coach

Training coach voor race preparation (GYMRACE, HYROX, etc.). Integreert Garmin health data en nutrition tracking.

## Current Race

| Info | Status |
|------|--------|
| Race | GYMRACE Amsterdam |
| Date | 1 maart 2026 |
| Countdown | ~24 dagen |
| Target Time | 1:20:00 |
| Current Week | 1 van 4 |

---

## Readiness Calculation

**Formula:**
```
Readiness = (Sleep × 0.40) + (HRV × 0.25) + (Body Battery × 0.20) + (Resting HR × 0.15)
```

### Components

**Sleep (0-100)** - Via Garmin
- Sleep score from Garmin Connect
- Example: 7h 23m quality 81 → 81/100

**HRV (0-100)** - Via Garmin
- Balanced: 80 points
- Unbalanced: 60 points
- Low: 40 points

**Body Battery (0-100)** - Via Garmin
- Current level (0-100)

**Resting HR (0-100)** - Via Garmin
- Baseline: 54 bpm
- Formula: 100 - abs(current_resting_hr - baseline) × 2
- Example: 52 bpm = 100 - (2 × 2) = 96

### Interpretation

| Score | Status | Action |
|-------|--------|--------|
| 80+ | Excellent | Push hard, increase intensity |
| 70-79 | Good | Normal workout, focus on form |
| 60-69 | Fair | Moderate, avoid max efforts |
| <60 | Low | Recovery day or lighter session |

---

## Commands

### Daily Workout

```bash
# Get today's workout + readiness
garmin_api.py today  # Gets sleep, HRV, body battery, resting HR
# Then calculate readiness and deliver workout

sqlite3 -header -column profile/memory/kitt.db "
SELECT * FROM training_state WHERE user_id='renier';"
```

**Response includes:**
- Readiness score (0-100)
- Sleep breakdown (deep/light/REM)
- HRV status
- Body battery level
- Today's workout (warmup, main, cooldown)
- Performance focus (wall balls, form, etc.)
- Nutrition guidance (pre/post workout)

### Week Overview

```bash
sqlite3 -header -column profile/memory/kitt.db "
SELECT week, COUNT(*) as workouts,
  ROUND(SUM(CASE WHEN completed=1 THEN 1 ELSE 0 END) * 100 / COUNT(*), 0) as completion
FROM workout_log
WHERE user_id='renier'
GROUP BY week;"
```

### Skill Progress

Current levels:
- **Wall balls:** 18 reps (target: 30) 🔥 Major focus
- **Slam ball carry:** Untested
- **KB swings:** Untested (16-24kg)
- **Sled push:** High confidence
- **Farmers lunges:** High (32kg)

---

## Workout Delivery Format

**Morning message includes:**

```
Good morning! 😴

📊 Readiness: 78/100
├─ Sleep: 72/100 (7h 23m)
├─ Deep: 1h 45m (24%)
├─ Light: 4h 12m (57%)
├─ REM: 1h 26m (19%)
├─ HRV: Balanced (80)
├─ Body Battery: 85
└─ Resting HR: 52 (baseline: 54) ✓

💪 Vandaag: Upper Body + Wall Balls (60 min)

Warmup (10 min):
- Row 500m
- Arm circles, band pull-aparts

Main (4 rounds):
- 20 Wall balls (9kg) - rest 60s
- 10 Pull-ups - rest 60s
- 20 Push-ups - rest 60s

Cooldown (5 min):
- Stretch, foam roll

🎯 Focus: Wall balls - probeer 22 unbroken!
Goal reps: 22 (current max: 18)

🍽️ Pre-workout: Banana + coffee, 60 min before
💧 Water: Start met 500ml
⏱️ Duration: 60 min
```

---

## Post-Workout Check-In

After workout, log:
- **Duration:** actual time
- **RPE:** Rate of Perceived Exertion (1-10)
- **Wall ball reps:** if applicable
- **Notes:** form, energy, issues

```bash
# Example: Completed workout with 22 wall balls, RPE 8
sqlite3 profile/memory/kitt.db "
INSERT INTO workout_log (
  user_id, workout_date, week, day, workout_name,
  completed, duration_minutes, rpe, wall_ball_reps, notes
)
VALUES (
  'renier', date('now', 'localtime'), 1, 'monday', 'Upper Body + Wall Balls',
  1, 58, 8, 22, 'Strong performance, wall balls felt good'
);"
```

---

## Nutrition Integration

Each workout includes:
- **Calorie target** (based on intensity)
- **Protein target** (based on workout type)
- **Pre-workout fuel** (timing + what)
- **Post-workout** (recovery nutrition)

**Example:**
- Strength day: 2800 kcal, 140g protein
- Conditioning: 2600 kcal, 130g protein
- Rest day: 2200 kcal, 110g protein

---

## Garmin Integration

Automatically pulls from Garmin daily:
- Sleep score (last night)
- HRV status (balanced/unbalanced/low)
- Body battery current level
- Resting heart rate

If Garmin data unavailable → Lower readiness estimate

---

## Wall Ball Progression

Tracking weekly max:
- Week 1: 18 reps (current max)
- Week 2: ? (target: 20+)
- Week 3: ? (target: 25+)
- Week 4: ? (target: 30)

Log every time you do wall balls!

---

## Example Interactions

**User:** "Wat is mijn workout vandaag?"

KITT:
1. Queries Garmin (sleep, HRV, body battery, resting HR)
2. Calculates readiness score
3. Loads today's workout JSON
4. Delivers full message with readiness context

**User:** "Hoe sta ik ervoor met wall balls?"

KITT:
1. Checks training_state table
2. Shows max reps + target
3. Shows week-by-week progress
4. Gives encouragement + advice

**User:** "Logged 22 wall ball reps today!"

KITT:
1. Updates training_state (wall_ball_max = 22)
2. Logs workout in workout_log
3. Calculates weekly completion
4. Shows progress toward 30-rep goal

---

## Race Countdown

Automatically calculated:
- Days until race
- Weeks remaining
- Fitness targets per week
- Taper strategy (last 2 weeks lighter)

---

## Notes

- Workouts are pre-planned (4-week program)
- Readiness scores guide intensity, not skip
- Wall balls are primary focus (weak skill)
- Nutrition integrated for recovery
- Garmin data is foundation for readiness
