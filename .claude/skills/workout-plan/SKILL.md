# Workout Plan Skill

Bekijk en beheer workout programma's en geplande workouts.

## Trigger

On-demand: "wat staat er vandaag?", "toon mijn programma", "welke workout", "training plan"

## Database

```bash
DB_PATH="profile/memory/kitt.db"
```

### Tabellen

| Tabel | Doel |
|-------|------|
| `workout_programs` | Programma's (bijv. 12 weken HYROX) |
| `workout_templates` | Geplande workouts per week/dag |
| `workout_exercises` | Exercise definities + aliassen |

## Queries

### Actief programma

```bash
sqlite3 -json "$DB_PATH" "
  SELECT id, name, description, duration_weeks, start_date
  FROM workout_programs
  WHERE active = 1
"
```

### Vandaag's workout

```bash
# Bereken week number en day of week
TODAY=$(date +%Y-%m-%d)
DOW=$(date +%u)  # 1=maandag, 7=zondag

sqlite3 -json "$DB_PATH" "
  SELECT wt.name, wt.workout_type, wt.exercises, wt.duration_minutes, wt.notes
  FROM workout_templates wt
  JOIN workout_programs wp ON wt.program_id = wp.id
  WHERE wp.active = 1
    AND wt.day_of_week = $DOW
    AND wt.week_number = (
      SELECT CAST((julianday('$TODAY') - julianday(start_date)) / 7 + 1 AS INTEGER)
      FROM workout_programs WHERE active = 1
    )
"
```

### Week overzicht

```bash
sqlite3 -json "$DB_PATH" "
  SELECT wt.day_of_week, wt.name, wt.workout_type
  FROM workout_templates wt
  JOIN workout_programs wp ON wt.program_id = wp.id
  WHERE wp.active = 1
    AND wt.week_number = ?
  ORDER BY wt.day_of_week
"
```

### Exercise lookup (met aliassen)

```bash
sqlite3 -json "$DB_PATH" "
  SELECT name, category, equipment, aliases
  FROM workout_exercises
  WHERE name LIKE '%bench%' OR aliases LIKE '%bench%'
"
```

## Output Format

### Vandaag's workout
```
📋 Vandaag (Week 3, Dinsdag):
**Upper Body Push**
- Bench Press: 4x8
- Incline DB Press: 3x12
- Shoulder Press: 3x10
- Tricep Dips: 3x12

⏱️ ~45 min
```

### Geen workout gepland
```
📋 Vandaag geen workout gepland (rustdag)
```

### Geen actief programma
```
❌ Geen actief workout programma.
Wil je er een starten?
```

## Capabilities

1. **Bekijk actief programma** - naam, duur, voortgang
2. **Bekijk vandaag's workout** - exercises, sets, reps
3. **Bekijk week overzicht** - alle workouts deze week
4. **Exercise lookup** - zoek op naam of alias

## Exercises JSON Format

In `workout_templates.exercises`:

```json
[
  {"name": "Bench Press", "sets": 4, "reps": 8, "weight": "80kg"},
  {"name": "Incline DB Press", "sets": 3, "reps": 12, "weight": "24kg"},
  {"name": "Shoulder Press", "sets": 3, "reps": 10}
]
```

## Stijl

- Kort en overzichtelijk
- Nederlands
