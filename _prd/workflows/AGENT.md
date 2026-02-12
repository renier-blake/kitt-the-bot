# Agent Workflow

> Workflow voor agents die issues bouwen.

---

## Jouw Rol

Als **Agent** bouw je issues:
- Code schrijven
- Skills/tasks implementeren
- Testen
- Documenteren
- Committen (na goedkeuring)

**Wat je NIET doet:**
- Issues maken (dat doet de PO via Portal)
- Priorities bepalen
- Zonder toestemming committen

---

## Issue Starten

```
/issue PAS-01
/issue KITT-05
/issue POR-3
```

Dit doet automatisch:
1. Haalt issue op uit database (`portal_issues`)
2. Leest relevante docs op basis van project
3. Gaat in Plan Mode
4. Bouwt na goedkeuring

---

## Workflow Stappen

### 1. LEZEN

De `/issue` skill leest automatisch relevante docs op basis van project:

| Project | Docs |
|---------|------|
| PAS | `_prd/brainstorm/pas.md`, `src/integrations/` |
| KITT | `_prd/architecture/`, `CLAUDE.md` |
| POR | `frontends/kitt-portal/`, `src/bridge/log-server.ts` |
| SKL | `.claude/skills/`, bestaande skills als reference |
| INF | `src/bridge/`, `src/scheduler/`, `src/memory/` |
| DAT | `profile/`, Garmin/nutrition skills |

**Doel:** Begrijp de context voordat je bouwt.

### 2. PLAN MODE

Na het lezen ga je in Plan Mode. **BELANGRIJK:** Het plan moet in twee delen:

#### A. Functionele Beschrijving (voor de PO/user)

Beschrijf in normale mensentaal:
- **Wat gaat er veranderen?** — Wat ziet/ervaart de gebruiker straks anders?
- **Hoe werkt het?** — Leg de flow uit alsof je het aan iemand uitlegt die niet kan programmeren
- **Wat zijn de keuzes?** — Als je keuzes maakt, leg uit waarom

**Voorbeeld:**
> Na deze change kan je in de Portal filteren op "complexity" en "scope".
> Issues met lage complexity en isolated scope zijn veilig om parallel te runnen.
> Je ziet kleine badges naast elke issue die dit aangeven.

#### B. Technische Implementatie

Daarna de technische details:
- Welke bestanden wijzigen
- Database changes
- API endpoints
- Component structuur

**Format van het plan:**

```markdown
## Wat gaat er veranderen?

[Functionele beschrijving in 2-3 zinnen]

## Hoe werkt het?

[User flow in normale taal]

## Technische aanpak

1. [Stap 1 - bestand + wat]
2. [Stap 2 - bestand + wat]
...
```

**Waarom beide?** De PO moet het plan kunnen goedkeuren zonder de code te lezen. Als je alleen technische stappen schrijft, kan hij niet beoordelen of het de juiste oplossing is.

### 3. BOUWEN

Implementeer volgens het plan:
- Schrijf code
- Maak skills/tasks aan
- Voer migrations uit

**Per component:**
- Schema → `src/memory/schema.ts`
- Task Engine → `src/scheduler/task-engine.ts`
- Skill → `.claude/skills/[naam]/SKILL.md`
- Integrations → `src/integrations/`

### 4. TESTEN

Test alle acceptance criteria:
- Happy path
- Edge cases
- Error cases

**Als tests falen:** Fix en test opnieuw.

### 5. UPDATE STATE

Na completion, update de issue state:

```bash
sqlite3 profile/data/kitt.db "
  UPDATE portal_issues
  SET state = 'done', updated_at = unixepoch() * 1000
  WHERE identifier = 'PAS-01'
"
```

### 6. COMMITTEN

**Vraag toestemming** aan Renier:
> "Issue PAS-01 is klaar. Mag ik committen?"

Na goedkeuring:
```bash
git add [specific files]
git commit -m "PAS-01: [beschrijving]"
```

---

## Code Conventies

- **Taal:** Nederlands (docs), Engels (code)
- **Logging:** `[component]` prefix (bijv. `[task-engine]`, `[schema]`)
- **Comments:** Alleen waar nodig, code moet zelf-documenterend zijn

---

## Skill Maken

Locatie: `.claude/skills/[naam]/SKILL.md`

Structuur:
```markdown
---
name: skill-naam
description: Korte beschrijving voor skill discovery
requirements:
  bins:
    - python3  # indien nodig
---

# Skill Naam

Uitleg wat de skill doet.

## Commands / Queries

Hoe data ophalen of acties uitvoeren.

## Output Format

Hoe de output eruit moet zien.

## Examples

Concrete voorbeelden.

## Fallbacks

Wat te doen bij errors.
```

---

## Task Toevoegen

In `src/memory/schema.ts` (seedDefaultTasks) of via SQL:

```sql
INSERT INTO kitt_tasks (
  title,
  description,
  frequency,        -- 'once', 'daily', 'weekly', 'monthly'
  priority,         -- 'high', 'medium', 'low'
  skill_refs,       -- '["skill-name"]'
  time_window_start,-- 'HH:MM'
  time_window_end,  -- 'HH:MM'
  grace_period_minutes,
  depends_on,       -- '[1, 2, 3]' of NULL
  created_by        -- 'kitt' of 'renier'
) VALUES (...);
```

---

## Troubleshooting

| Probleem | Oplossing |
|----------|-----------|
| Issue niet gevonden | Check identifier, vraag PO |
| Issue description onduidelijk | Vraag PO om verduidelijking |
| Blocked door dependency | Check of dependency klaar is, anders wacht |
| Tests falen | Fix code, niet de test (tenzij test fout is) |
| Merge conflicts | Los op, commit niet met `--no-verify` |

## Issue States

| State | Betekenis |
|-------|-----------|
| `backlog` | Nog niet gestart |
| `todo` | Gepland voor huidige cycle |
| `in_progress` | Actief aan gewerkt |
| `review` | Klaar voor review |
| `done` | Afgerond |
