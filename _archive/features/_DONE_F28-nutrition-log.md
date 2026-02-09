# F28: Nutrition Log Skill

> **Priority:** 🟡 P2
> **Status:** ✅ Done
> **Owner:** KITT
> **Started:** 5 februari 2026
> **Completed:** 5 februari 2026

---

## Overview

Port de nutrition-log skill van OpenClaw naar KITT met lokale SQLite database (geen Supabase).

**Origineel:** Supabase/PostgreSQL via psql
**Nieuw:** Tables in `profile/memory/kitt.db` (unified database)

---

## Scope

**In scope:**
- SQLite database voor foods + food_log
- Maaltijden loggen (breakfast, lunch, dinner, snack, shake, supplement, etc.)
- Food catalog beheren (lookup, add, update)
- Dag/week totalen berekenen
- SKILL.md met CLI-first approach (direct SQL via sqlite3)

**Out of scope:**
- Web UI voor nutrition
- Sync met externe services
- Barcode scanning
- Meal planning/suggestions

---

## Implementation

### Database Schema

Zie `src/db/migrations/002-nutrition.sql` voor het volledige schema.

**Tables:**
- `foods` - Food catalog met per-100g macro waarden (50 items gemigreerd)
- `food_log` - Gelogde maaltijden met berekende macros (129 entries gemigreerd)

### Skill File

`/.claude/skills/nutrition-log/SKILL.md` bevat:
- Food lookup queries
- Meal logging commands
- Day/week totals queries
- Macro calculation formulas

---

## Migration Completed

Data succesvol gemigreerd van Supabase naar SQLite:
- **50 foods** uit `renier_foods`
- **129 food_log entries** uit `renier_food_log`

---

## Acceptance Criteria

- [x] SQLite database schema created (migration 002)
- [x] Bestaande data gemigreerd van Supabase
- [x] Alle foods uit renier_foods aanwezig (50)
- [x] Alle food_log entries uit renier_food_log aanwezig (129)
- [x] SKILL.md met alle commands
- [x] Food lookup werkt
- [x] Dag totalen berekenen werkt
- [ ] Test via Telegram: "log 150g skyr als ontbijt" (wacht op user test)

---

## Files Created/Modified

| File | Action | Purpose |
|------|--------|---------|
| `src/db/migrations/002-nutrition.sql` | Created | Database schema |
| `.claude/skills/nutrition-log/SKILL.md` | Created | Skill documentation |
| `profile/memory/kitt.db` | Modified | Added foods + food_log tables with data |

---

## Handover Checklist

- [x] Feature werkt zoals verwacht
- [x] Feature doc status → ✅ Done
- [ ] STATUS.md → Completed tabel + Recent Updates
- [ ] BACKLOG.md → Status bijgewerkt
- [x] Handover summary naar user gestuurd
