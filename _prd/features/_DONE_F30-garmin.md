# F30: Garmin Connect Integration

> **Priority:** 🟡 P2
> **Status:** ✅ Done
> **Owner:** KITT
> **Started:** 5 februari 2026
> **Completed:** 5 februari 2026

---

## Overview

Garmin Connect skill voor toegang tot health en fitness data (sleep, HRV, steps, activities, etc.).

**Use cases:**
- Dagelijkse health check ("hoe heb ik geslapen?")
- Training progress tracking
- Activity analysis
- Input voor gym-race-coach skill (F31)

---

## Implementation

### Skill Files

- `.claude/skills/garmin/garmin_api.py` - API wrapper (gemigreerd van OpenClaw)
- `.claude/skills/garmin/garmin_login.py` - Auth script (gemigreerd van OpenClaw)
- `.claude/skills/garmin/SKILL.md` - Complete skill documentation
- `.claude/skills/garmin/requirements.txt` - Python dependencies

### Setup

1. **First time auth:**
   ```bash
   python3 .claude/skills/garmin/garmin_login.py
   ```
   - Prompts for email/password
   - Handles MFA if enabled
   - Stores tokens in `~/.garminconnect/`

2. **Subsequent calls:** Tokens auto-refresh

### Commands Available

| Command | Returns |
|---------|---------|
| `today` | Daily summary (steps, HR, calories, stress) |
| `sleep [date]` | Sleep stages, quality, SpO2 |
| `steps [date]` | Steps, goal, distance |
| `hr [date]` | Heart rate data |
| `hrv [date]` | HRV status and balance |
| `body-battery [date]` | Body battery level |
| `activities [n]` | Recent n activities |
| `body` | Weight, BMI, body fat |
| `training` | Training status, readiness |
| `week` | Weekly summary |

---

## Test Results

✅ **API Test Successful:**
```json
{
  "date": "2026-02-05",
  "steps": 589,
  "sleep": {
    "duration_hours": 8.9,
    "quality": 81
  },
  "calories": 850.0,
  "heart_rate": {
    "resting": 52
  }
}
```

---

## Acceptance Criteria

- [x] Python scripts gemigreerd van OpenClaw
- [x] garmin_api.py werkt met KITT paths
- [x] garmin_login.py werkt
- [x] garminconnect package beschikbaar
- [x] SKILL.md met alle commands
- [x] Gating: check python3 binary
- [x] Test: garmin_api.py today → SUCCESS
- [ ] Test via Telegram: "hoe heb ik geslapen?" (user test)
- [ ] Test via Telegram: "hoeveel stappen vandaag?" (user test)

---

## Files Created/Migrated

| File | Source | Purpose |
|------|--------|---------|
| `.claude/skills/garmin/garmin_api.py` | OpenClaw | API wrapper |
| `.claude/skills/garmin/garmin_login.py` | OpenClaw | Auth script |
| `.claude/skills/garmin/SKILL.md` | KITT | Documentation |
| `.claude/skills/garmin/requirements.txt` | KITT | Dependencies |

---

## Dependencies

- `python3` (available)
- `garminconnect` library (installed)
- `~/.garminconnect/` auth tokens (persists for ~1 year)

---

## Integration

**Foundation for:**
- F31 Gym Race Coach (readiness, recovery, training load)
- Nutrition targets calculation (TDEE based on activities)
- Daily health summaries

---

## Notes

- ✅ Tokens valid for ~1 year
- ✅ MFA supported
- ⚠️ Rate limits: 1 req/sec max
- ⏳ Data syncs 5-10 min after workout
