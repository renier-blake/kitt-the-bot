# F38: Reminders Check

> **Priority:** 🟠 P1
> **Status:** 📝 Spec
> **Owner:** -

---

## Overview

KITT checkt geflagde en overdue Apple Reminders en meldt deze. Alleen belangrijke items (door user geflagd) worden gemeld.

---

## User Stories

**US-01:** Als Renier wil ik herinnerd worden aan geflagde reminders, zodat ik belangrijke taken niet vergeet.

**US-02:** Als Renier wil ik overdue reminders gemeld krijgen, zodat ik weet wat er is blijven liggen.

---

## Componenten

| Component | Nodig | Beschrijving |
|-----------|-------|--------------|
| Skill | ✅ | Update `apple-reminders` - simplify voor task-based gebruik |
| Task | ✅ | Reminders check task |
| Schema | ❌ | - |
| Backend | ❌ | - |
| Portal | ❌ | - |

---

## Skill: apple-reminders (update)

**Simplify de skill voor task-based gebruik:**

**Query voor geflagde + overdue:**
```bash
osascript -e 'tell application "Reminders"
  set today to current date
  set time of today to 0
  set output to ""
  repeat with r in (reminders whose completed is false)
    set f to flagged of r
    set d to due date of r
    -- Flagged items
    if f then
      set output to output & "⚑ " & name of r & linefeed
    -- Overdue items (due date before today)
    else if d is not missing value and d < today then
      set output to output & "⏰ " & name of r & " (overdue)" & linefeed
    end if
  end repeat
  return output
end tell'
```

**Logica:**
- `⚑` = geflagd (belangrijk)
- `⏰` = overdue (blijven liggen)
- Niet geflagd + niet overdue = negeren

**Melding regels:**
- Max 1x per 2 uur dezelfde reminder melden
- Check transcripts voor dubbele meldingen
- Vriendelijke toon

---

## Task: Reminders check

| Veld | Waarde |
|------|--------|
| title | Reminders check |
| description | Check geflagde en overdue Apple Reminders |
| frequency | daily |
| priority | medium |
| time_window | 08:00 - 20:00 |
| grace_period | 0 min |
| depends_on | [0] |
| skill_refs | ["apple-reminders"] |

---

## Flow

```
08:00-20:00 Think Loop
         │
         ▼
┌─────────────────────────────┐
│ Task: Reminders check       │
│ priority: medium            │
└─────────────────────────────┘
         │
         ▼
┌─────────────────────────────┐
│ Query Apple Reminders:      │
│ - Geflagde items (⚑)        │
│ - Overdue items (⏰)         │
└─────────────────────────────┘
         │
    ┌────┴────┐
    ▼         ▼
 GEEN       ITEMS
 ITEMS      GEVONDEN
    │         │
    ▼         ▼
 Niets      Meld aan
 doen       Renier
```

---

## Acceptance Criteria

- [ ] Task runt dagelijks 08:00-20:00
- [ ] Alleen geflagde en overdue reminders worden opgehaald
- [ ] Niet-geflagde, niet-overdue items worden genegeerd
- [ ] Max 1x per 2 uur dezelfde reminder melden
- [ ] Completed reminders worden nooit getoond

---

## Test Cases

1. **Geflagde reminder:** "⚑ Ziekenhuisbellen" wordt gemeld
2. **Overdue reminder:** "⏰ Belastingaangifte (overdue)" wordt gemeld
3. **Normale reminder vandaag:** Niet geflagd, niet overdue → niet gemeld
4. **Geen reminders:** Task logt "geen items" en meldt niets

---

## Files

| File | Actie | Beschrijving |
|------|-------|--------------|
| `.claude/skills/apple-reminders/SKILL.md` | Modify | Simplify, focus op geflagd + overdue |
| `src/memory/schema.ts` | Modify | Task toevoegen aan seed |

---

## Lees Eerst

> **Voor de agent die dit bouwt:**

### Workflow
- `_prd/workflows/AGENT.md`

### Bestaande Code
- `.claude/skills/apple-reminders/SKILL.md` - Huidige skill
- `src/memory/schema.ts` - seedDefaultTasks functie
