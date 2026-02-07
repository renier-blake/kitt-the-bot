---
name: garmin
description: Access Garmin Connect health data (sleep, HRV, steps, activities, calories). Use when the user asks about sleep, steps, training, or health metrics.
requirements:
  bins:
    - python3
---

# Garmin Connect

Access health and fitness data from Garmin Connect.

## Setup (First Time Only)

1. **Run login script** (handles email/password + MFA):
   ```bash
   python3 .claude/skills/garmin/garmin_login.py
   ```

2. **Tokens stored in:** `~/.garminconnect/` (persists for ~1 year)

3. **Test connection:**
   ```bash
   python3 .claude/skills/garmin/garmin_api.py today
   ```

## Commands

| Command | Returns |
|---------|---------|
| `python3 .claude/skills/garmin/garmin_api.py today` | Daily summary: steps, HR, calories, stress |
| `python3 .claude/skills/garmin/garmin_api.py sleep [date]` | Sleep stages, quality, SpO2 (format: YYYY-MM-DD) |
| `python3 .claude/skills/garmin/garmin_api.py steps [date]` | Steps, goal, distance |
| `python3 .claude/skills/garmin/garmin_api.py hr [date]` | Heart rate data, zones |
| `python3 .claude/skills/garmin/garmin_api.py hrv [date]` | HRV status, balance, stress |
| `python3 .claude/skills/garmin/garmin_api.py body-battery [date]` | Body battery level, status |
| `python3 .claude/skills/garmin/garmin_api.py activities [n]` | Recent n activities (default: 5) |
| `python3 .claude/skills/garmin/garmin_api.py body` | Weight, BMI, body fat % |
| `python3 .claude/skills/garmin/garmin_api.py training` | Training status, load, readiness |
| `python3 .claude/skills/garmin/garmin_api.py week` | Weekly summary |
| `python3 .claude/skills/garmin/garmin_api.py vo2` | VO2 Max estimate |

## Response Format

Always extract key metrics from JSON output and present in readable format:

**Sleep:**
```
😴 Slaap: 7u 23m
Score: 72/100
├─ Deep: 1h 45m (24%)
├─ Light: 4h 12m (57%)
├─ REM: 1h 26m (19%)
└─ Awake: 18m
SpO2: 95% avg
```

**Today:**
```
📊 Vandaag:
├─ Steps: 8,450 / 10,000 (85%)
├─ Calories: 2,450 kcal
├─ Active Time: 45m
├─ HR avg: 72 bpm
└─ Body Battery: 78 / 100
```

**HRV:**
```
💓 HRV Status: Balanced
├─ Last Night: 52 ms
├─ 7-Day Avg: 48 ms
├─ Status: Good
└─ Stress Level: Low
```

## Examples

**User:** "Hoe heb ik geslapen vannacht?"

```bash
python3 .claude/skills/garmin/garmin_api.py sleep | jq '.'
```

**User:** "Hoeveel stappen vandaag?"

```bash
python3 .claude/skills/garmin/garmin_api.py steps | jq '.steps, .goal'
```

**User:** "Wat is mijn training readiness?"

```bash
python3 .claude/skills/garmin/garmin_api.py training | jq '.status, .readiness'
```

## Troubleshooting

### "Not logged in"
```bash
python3 .claude/skills/garmin/garmin_login.py
```

### "Session expired"
Tokens refresh automatically, but if issues persist:
```bash
rm ~/.garminconnect/*.json
python3 .claude/skills/garmin/garmin_login.py
```

### "Module not found: garminconnect"
```bash
pip3 install garminconnect
```

## Notes

- ✅ Tokens valid for ~1 year
- ✅ MFA supported during login
- ⚠️ Respect rate limits (1 request/sec max)
- ⏳ Data syncs 5-10 min after workout
- 📱 Works with all Garmin devices/apps

## Integration

This skill is **foundation** for:
- F31 Gym Race Coach (readiness, recovery, training load)
- Nutrition targets calculation (TDEE based on activities)
- Daily health summaries
