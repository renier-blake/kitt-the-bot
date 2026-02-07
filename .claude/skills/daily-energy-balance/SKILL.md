---
name: daily-energy-balance
description: Daily energy balance summary (eaten vs burned). Use when sending the evening energy balance report.
---

# Daily Energy Balance

Dagelijkse samenvatting van energiebalans: gegeten vs verbrand.

## Data Sources

| Data | Source | Query/Command |
|------|--------|---------------|
| Meals today | food_log | SQLite query |
| Calories burned | Garmin | garmin_api.py today |

## Queries

### Get Today's Nutrition by Meal

```bash
sqlite3 -header -column profile/memory/kitt.db "
SELECT
    meal_type,
    ROUND(SUM(calories), 0) as kcal,
    ROUND(SUM(protein_g), 0) as protein,
    ROUND(SUM(carbs_g), 0) as carbs,
    ROUND(SUM(fat_g), 0) as fat
FROM food_log
WHERE logged_date = date('now', 'localtime')
GROUP BY meal_type
ORDER BY CASE meal_type
    WHEN 'breakfast' THEN 1
    WHEN 'lunch' THEN 2
    WHEN 'dinner' THEN 3
    WHEN 'snack' THEN 4
    ELSE 5
END;"
```

### Get Day Totals

```bash
sqlite3 -json profile/memory/kitt.db "
SELECT
    ROUND(COALESCE(SUM(calories), 0), 0) as calories,
    ROUND(COALESCE(SUM(protein_g), 0), 0) as protein,
    ROUND(COALESCE(SUM(carbs_g), 0), 0) as carbs,
    ROUND(COALESCE(SUM(fat_g), 0), 0) as fat
FROM food_log
WHERE logged_date = date('now', 'localtime');"
```

### Get Calories Burned (Garmin)

```bash
python3 .claude/skills/garmin/garmin_api.py today
```

Extract from JSON:
- `totalKilocalories` - totaal verbrand (BMR + activiteit)
- `activeKilocalories` - alleen activiteit
- `bmrKilocalories` - BMR (Basal Metabolic Rate)

## Output Format

```
📊 Energiebalans [datum]

🍽️ Gegeten: X.XXX kcal
├─ Ontbijt: XXX kcal
├─ Lunch: XXX kcal
├─ Avondeten: XXX kcal
└─ Snacks: XXX kcal

📊 Macros totaal:
├─ Protein: XXXg
├─ Carbs: XXXg
└─ Fat: XXXg

🔥 Verbrand: X.XXX kcal
├─ BMR: X.XXX kcal
└─ Activiteit: XXX kcal

⚖️ Balans: ±XXX kcal (deficit/surplus)
```

## Calculation

```
balans = gegeten_kcal - verbrand_kcal

Als balans < 0: deficit (gewichtsverlies)
Als balans > 0: surplus (gewichtstoename)
```

## Meal Type Mapping

| Database | Display |
|----------|---------|
| breakfast | Ontbijt |
| lunch | Lunch |
| dinner | Avondeten |
| snack | Snacks |
| shake | Shake |
| supplement | Supplement |

## Fallbacks

- **Garmin unavailable:** Show only nutrition data with note "⚠️ Garmin data niet beschikbaar"
- **No meals logged:** Should not happen (depends_on handles this via task engine)
- **Partial data:** Show what's available with appropriate notes

## Example Response

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
