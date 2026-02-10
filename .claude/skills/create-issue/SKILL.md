---
name: create-issue
description: Maak een nieuw issue aan via de PO intake flow
user_invocable: true
args: korte_beschrijving (optioneel)
---

# Create Issue (PO Intake)

Maak een nieuw issue aan via het Product Owner intake proces. Geen issue wordt aangemaakt zonder de intake stappen te doorlopen.

## Gebruik

```
/create-issue unified context builder
/create-issue
```

Als er een beschrijving wordt meegegeven, gebruik die als startpunt. Anders: vraag wat de user wil.

---

## Intake Flow

**ALTIJD deze stappen volgen. Geen stappen overslaan.**

### Stap 1: Luisteren

Laat Renier beschrijven wat hij wil. Vat kort samen in 1-2 zinnen.

### Stap 2: Componenten Check

Vraag door welke componenten nodig zijn. Stel dit als vraag aan Renier — niet zelf invullen.

| Component | Vraag | Wanneer nodig |
|-----------|-------|---------------|
| **Skill** | "Moet KITT weten HOE dit te doen?" | Nieuwe capability met instructies |
| **Task** | "Moet KITT dit ZELF initiëren?" | Scheduled/triggered gedrag |
| **Schema** | "Moet de database structuur wijzigen?" | Nieuwe tabellen/kolommen |
| **Backend** | "Moet bridge/memory/scheduler code wijzigen?" | Core systeem changes |
| **Portal** | "Moet de web UI wijzigen?" | Frontend changes |

**Format:**

```
Even de componenten check:

1. **Skill** — Heeft KITT een nieuwe skill nodig? (SKILL.md met instructies)
2. **Task** — Moet dit scheduled/automatisch draaien?
3. **Schema** — Database wijzigingen nodig?
4. **Backend** — Core code (bridge/memory/scheduler) aanpassen?
5. **Portal** — UI wijzigingen nodig?

Welke zijn van toepassing?
```

### Stap 3: Component-specifieke Vragen

**Per bevestigd component, stel de relevante vragen:**

**SKILL:**
- Wat is de trigger? (user vraagt, of task initieert)
- Welke data bronnen?
- Welk output format?
- Fallbacks nodig?

**TASK:**
- Wanneer? (time window)
- Hoe vaak? (once/daily/weekly/monthly)
- Prioriteit? (high/medium/low)
- Dependencies? (depends_on andere tasks)

**SCHEMA:**
- Welke tabel(len)?
- Nieuwe kolommen of nieuwe tabel?
- Migratie nodig voor bestaande data?

**BACKEND:**
- Welke modules geraakt? (bridge, memory, scheduler, context, etc.)
- Breaking changes?
- Gerelateerde bestaande code?

**PORTAL:**
- Welke pagina's?
- Nieuwe pagina of bestaande uitbreiden?
- API endpoints nodig?

### Stap 4: Samenvatten & Bevestigen

Vat samen wat je hebt gehoord. Gebruik dit format:

```
📋 Samenvatting:

**Titel:** [korte titel]
**Type:** [feature/bug/improvement/chore/spike]
**Project:** [KITT/PAS/POR/SKL/INF/DAT]
**Prioriteit:** [critical/high/medium/low]

**Wat:**
[1-3 zinnen over wat er gebouwd moet worden]

**Componenten:**
- [x] Backend — [korte beschrijving]
- [ ] Skill
- [ ] Task
- [ ] Schema
- [ ] Portal

**Acceptatiecriteria:**
- [ ] [criterium 1]
- [ ] [criterium 2]
- [ ] ...

Klopt dit?
```

**Wacht op bevestiging van Renier voordat je verder gaat.**

### Stap 5: Issue Aanmaken

Na bevestiging, maak de issue aan in de database.

**Project keuze:**

| Als de issue gaat over... | Project |
|---------------------------|---------|
| OAuth, Nango, externe APIs, channels | PAS |
| Bridge, telegram, memory, think loop | KITT |
| Portal UI, dashboards | POR |
| Nieuwe skill of skill update | SKL |
| Task engine, logging, pm2, scheduler | INF |
| Garmin, nutrition, workouts, health data | DAT |

**Issue aanmaken:**

```bash
sqlite3 profile/memory/kitt.db "
  INSERT INTO portal_issues (project_id, identifier, title, description, type, state, priority, created_by, created_at, updated_at, position)
  SELECT
    p.id,
    p.identifier || '-' || (COALESCE(MAX(CAST(SUBSTR(i.identifier, LENGTH(p.identifier)+2) AS INTEGER)), 0) + 1),
    'TITEL',
    'BESCHRIJVING',
    'TYPE',
    'backlog',
    'PRIORITY',
    'renier',
    unixepoch() * 1000,
    unixepoch() * 1000,
    (COALESCE(MAX(i.position), 0) + 1000)
  FROM portal_projects p
  LEFT JOIN portal_issues i ON i.project_id = p.id
  WHERE p.identifier = 'PROJECT'
  GROUP BY p.id
"
```

**Description format in de database:**

```markdown
[1-3 zinnen over wat er gebouwd moet worden]

## Componenten

- [x] Backend — [beschrijving]
- [ ] Skill
- [ ] Task
- [ ] Schema
- [ ] Portal

## Backend Details (voorbeeld)

- Modules: [welke modules geraakt]
- Breaking changes: [ja/nee]
- Gerelateerde code: [bestanden/directories]

## Acceptatiecriteria

- [ ] [criterium 1]
- [ ] [criterium 2]
```

### Stap 6: Bevestig

```
✅ [IDENTIFIER]: [TITEL] aangemaakt

Project: [PROJECT]
Type: [TYPE] | Prioriteit: [PRIORITY] | State: backlog

Wil je er direct aan werken? Dan: /issue [IDENTIFIER]
```

---

## Regels

1. **NOOIT een issue aanmaken zonder de intake stappen** — ook niet als je denkt dat je genoeg weet
2. **Altijd componenten check** — ook voor simpele issues
3. **Altijd bevestiging vragen** — stap 4 is verplicht
4. **Renier beslist** over prioriteit, type, en project. Suggereer, maar vraag
5. **Kort en to the point** — geen lange verhalen, PO-stijl

---

## Fallbacks

| Situatie | Actie |
|----------|-------|
| Renier weet het project niet | Suggereer op basis van de componenten |
| Renier zegt "doe maar" bij prioriteit | Default: medium |
| Renier wil meerdere issues tegelijk | Eén intake per issue, maar mag snel achter elkaar |
| Issue lijkt op een bestaande | Check eerst of er al een vergelijkbare issue is en meld dit |

---

## Voorbeeld

```
Renier: "Ik wil dat de context builder gedeeld wordt tussen chat en think loop"

KITT: Oké, je wilt één shared context builder. Even de componenten check:

1. **Skill** — nee
2. **Task** — nee
3. **Schema** — nee
4. **Backend** — ja, refactor van context building
5. **Portal** — nee

Welke kloppen?

Renier: "Ja, alleen backend"

KITT: Backend specifiek:
- Welke modules? bridge/context.ts + scheduler/think-loop.ts
- Breaking changes? Nee, zelfde output, andere structuur
- Gerelateerde code? src/bridge/context.ts, src/scheduler/index.ts, think-loop.ts

📋 Samenvatting:

**Titel:** Unified Context Builder
**Type:** improvement
**Project:** KITT
**Prioriteit:** high

**Wat:**
Eén shared context builder die bridge (chat) en Think Loop gebruiken.
Voorkomt dat features dubbel gebouwd moeten worden.

**Componenten:**
- [x] Backend — Refactor context building naar src/context/
- [ ] Skill
- [ ] Task
- [ ] Schema
- [ ] Portal

**Acceptatiecriteria:**
- [ ] src/context/builder.ts met buildBaseContext()
- [ ] Chat en Think Loop gebruiken dezelfde basis
- [ ] src/bridge/context.ts verwijderd
- [ ] Build clean, geen regressies

Klopt dit?

Renier: "Ja top"

KITT: ✅ KITT-106: Unified Context Builder aangemaakt
Project: KITT | improvement | high | backlog

Wil je er direct aan werken? Dan: /issue KITT-106
```
