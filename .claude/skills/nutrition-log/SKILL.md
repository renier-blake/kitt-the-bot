---
name: nutrition-log
description: Log meals and track nutrition. Use when the user wants to log food, look up foods, or get nutrition summaries.
metadata: {"kitt":{"emoji":"🥗","requires":{"bins":["sqlite3"]}}}
---

# Nutrition Log

Log maaltijden en track macros in de lokale SQLite database.

## Database

**Locatie:** `profile/memory/kitt.db`

**Tables:**
- `foods` - Food catalog met per-100g/ml macro waarden
- `food_log` - Gelogde maaltijden met berekende macros per portie

## Workflow

### 1) Log a Meal

1. Parse: food name, brand (optional), serving size + unit, meal_type, date/time
2. **Defaults:** breakfast → 09:00, lunch → 12:00, dinner → 18:00
3. Zoek het food in `foods` table (case-insensitive, fuzzy match)
4. Als gevonden: bereken macros voor de serving size
5. Als niet gevonden:
   - Zoek nutrition info via web search
   - Vraag bevestiging
   - Insert in `foods` table
6. Insert in `food_log` met berekende macros
7. Toon meal totals + day totals

### 2) Food Lookup

Zoek in de foods catalog:

```bash
sqlite3 -header -column profile/memory/kitt.db "
SELECT id, name, brand, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g
FROM foods
WHERE name LIKE '%ZOEKTERM%' COLLATE NOCASE
   OR brand LIKE '%ZOEKTERM%' COLLATE NOCASE
ORDER BY usage_count DESC
LIMIT 10;"
```

### 3) Add New Food

```bash
sqlite3 profile/memory/kitt.db "
INSERT INTO foods (name, brand, category, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, fiber_per_100g, default_serving_size, default_serving_unit)
VALUES ('Naam', 'Merk', 'categorie', 100, 10, 20, 5, 2, 100, 'g');"
```

### 4) Log Food Entry

```bash
sqlite3 profile/memory/kitt.db "
INSERT INTO food_log (logged_date, logged_time, meal_type, food_name, brand, serving_size, serving_unit, calories, protein_g, carbs_g, fat_g, fiber_g, source)
VALUES (
    date('now', 'localtime'),
    time('now', 'localtime'),
    'breakfast',  -- breakfast|lunch|dinner|snack|shake|supplement
    'Food Name',
    'Brand',
    150,          -- serving size
    'g',          -- serving unit
    95.0,         -- calculated calories
    16.5,         -- calculated protein
    6.0,          -- calculated carbs
    0.3,          -- calculated fat
    0.0,          -- calculated fiber
    'manual'
);"
```

### 5) Day Totals

```bash
sqlite3 -header -column profile/memory/kitt.db "
SELECT
    COALESCE(SUM(calories), 0) as calories,
    COALESCE(SUM(protein_g), 0) as protein,
    COALESCE(SUM(carbs_g), 0) as carbs,
    COALESCE(SUM(fat_g), 0) as fat,
    COALESCE(SUM(fiber_g), 0) as fiber
FROM food_log
WHERE logged_date = date('now', 'localtime');"
```

### 6) Meal Totals

```bash
sqlite3 -header -column profile/memory/kitt.db "
SELECT
    meal_type,
    COALESCE(SUM(calories), 0) as calories,
    COALESCE(SUM(protein_g), 0) as protein,
    COALESCE(SUM(carbs_g), 0) as carbs,
    COALESCE(SUM(fat_g), 0) as fat
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

### 7) Today's Log (Detail)

```bash
sqlite3 -header -column profile/memory/kitt.db "
SELECT meal_type, food_name, serving_size || serving_unit as portion, calories, protein_g as protein
FROM food_log
WHERE logged_date = date('now', 'localtime')
ORDER BY logged_time;"
```

### 8) Week Summary

```bash
sqlite3 -header -column profile/memory/kitt.db "
SELECT
    logged_date,
    COALESCE(SUM(calories), 0) as calories,
    COALESCE(SUM(protein_g), 0) as protein
FROM food_log
WHERE logged_date >= date('now', '-7 days', 'localtime')
GROUP BY logged_date
ORDER BY logged_date DESC;"
```

## Macro Calculation

Bereken macros op basis van serving size:

```
macro_voor_portie = (macro_per_100g * serving_size) / 100
```

Voorbeeld: 150g Skyr met 11g protein per 100g:
```
protein = (11 * 150) / 100 = 16.5g
```

## Safety Rules

- **ALTIJD eerst de `foods` table checken** — gebruik de waarden uit de database, niet zelf schatten of een ander product pakken. Als "kipdijfilet" gevraagd wordt, zoek "kipdij" in de db, niet "kipfilet"
- **Nooit macros raden** - bij twijfel, vraag de user of zoek online
- **Altijd bevestigen** bij nieuwe foods uit web search
- **Serving size rule:** Als portie niet expliciet is, vraag: "Hoeveel gram/ml was dat?"

## Example Response

**User:** "Log 150g skyr als ontbijt"

**KITT:**
1. Zoekt "skyr" in foods → vindt "Skyr Classic Naturel"
2. Berekent macros voor 150g
3. Insert in food_log
4. Response:

```
Gelogd: 150g Skyr Classic Naturel

Ontbijt totaal:
- Calories: 93 kcal
- Protein: 16.5g
- Carbs: 6g
- Fat: 0.3g

Dag totaal:
- Calories: 93 kcal
- Protein: 16.5g
```

