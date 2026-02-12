---
name: issue-kitt
description: KITT werkt aan een issue via Telegram. Maakt een plan, deelt het met Renier, en bouwt na goedkeuring.
user_invocable: false
args: issue_identifier
---

# Issue Builder (KITT via Telegram)

Deze skill is voor wanneer KITT via Telegram aan een issue gaat werken.

**BELANGRIJK:** GEEN Plan Mode gebruiken — dat werkt niet via Telegram. In plaats daarvan maak je een plan en deel je het in het chatbericht.

---

## Workflow

### 1. Issue Ophalen

```bash
sqlite3 -json profile/data/kitt.db "
  SELECT
    i.identifier, i.title, i.description, i.type, i.state, i.priority,
    i.complexity, i.scope,
    p.identifier as project, p.name as project_name,
    GROUP_CONCAT(l.name) as labels
  FROM portal_issues i
  LEFT JOIN portal_projects p ON i.project_id = p.id
  LEFT JOIN portal_issue_labels il ON i.id = il.issue_id
  LEFT JOIN portal_labels l ON il.label_id = l.id
  WHERE i.identifier = 'ISSUE_ID'
  GROUP BY i.id
"
```

Update state naar `in_progress`:

```bash
sqlite3 profile/data/kitt.db "
  UPDATE portal_issues
  SET state = 'in_progress', updated_at = unixepoch() * 1000
  WHERE identifier = 'ISSUE_ID'
"
```

### 2. Context Lezen

**Altijd lezen:**
1. `_prd/architecture/ARCHITECTURE.md`
2. `_prd/workflows/AGENT.md`

**Op basis van labels extra code/docs lezen:**

| Label | Lees ook |
|-------|----------|
| bridge | `src/bridge/` |
| memory | `src/memory/` |
| scheduler | `src/scheduler/` |
| portal | `frontends/portal/`, `src/bridge/log-server.ts` |
| integrations | `src/integrations/` |
| security | `src/bridge/`, `src/credentials/` |
| skills | `.claude/skills/`, bestaande skills |
| infra | `src/bridge/`, `src/scheduler/` |
| core | `src/context/`, `profile/context/` |

### 3. Plan Maken & Delen

Maak een plan van aanpak en **stuur dit als chatbericht naar Renier**. Het plan bevat:

```
📋 Plan: [ISSUE_ID] — [titel]

## Wat gaat er veranderen?
[1-3 zinnen in normale taal — wat ervaart de gebruiker straks anders?]

## Aanpak
1. [Stap 1 — bestand + wat je doet]
2. [Stap 2 — bestand + wat je doet]
3. ...

## Risico's / keuzes
[Eventuele keuzes die je maakt en waarom]

Mag ik hiermee starten?
```

**STOP hier. Wacht op goedkeuring van Renier.**

- Als Renier "ok", "ja", "go", "doen" of iets vergelijkbaars zegt → ga door naar stap 4
- Als Renier feedback geeft → pas het plan aan en deel opnieuw
- Als Renier "nee" of "stop" zegt → stop en zet state terug naar `todo`

### 4. Plan Opslaan in Issue

Na goedkeuring, sla het goedgekeurde plan op in de issue description:

```bash
sqlite3 profile/data/kitt.db "
  UPDATE portal_issues
  SET description = description || char(10) || char(10) || '---' || char(10) || char(10) || '## Plan van Aanpak' || char(10) || '[het goedgekeurde plan hier]',
      updated_at = unixepoch() * 1000
  WHERE identifier = 'ISSUE_ID'
"
```

Dit zorgt ervoor dat:
- KITT altijd weet waar hij mee bezig is als hij later terugkomt
- Renier in de Portal kan zien wat het plan was
- Er een audit trail is van wat is afgesproken

### 5. Bouwen

Implementeer volgens het goedgekeurde plan:
- Schrijf code
- Test wat je bouwt
- Geef tussentijdse updates als het langer duurt

### 6. Afronden

Na completion:

```bash
sqlite3 profile/data/kitt.db "
  UPDATE portal_issues
  SET state = 'done', updated_at = unixepoch() * 1000
  WHERE identifier = 'ISSUE_ID'
"
```

**Stuur een bericht naar Renier:**
> ✅ [ISSUE_ID] is klaar. [korte samenvatting wat er is gedaan]. Mag ik committen?

Commit pas na toestemming:
```bash
git add [specific files]
git commit -m "[ISSUE_ID]: [beschrijving]"
```

---

## Regels

- **NOOIT** in Plan Mode gaan (werkt niet via Telegram)
- **ALTIJD** plan delen en wachten op goedkeuring voordat je bouwt
- **ALTIJD** plan opslaan in de issue na goedkeuring
- **NOOIT** committen zonder toestemming
- **Bij twijfel**: vraag Renier, niet zelf beslissen

---

## Fallbacks

| Situatie | Actie |
|----------|-------|
| Issue niet gevonden | Meld aan Renier, vraag correct identifier |
| Geen description | Vraag Renier om meer context |
| State is al `done` | Vraag of Renier wil heropenen |
| Halverwege geblokkeerd | Stuur update, vraag hulp |
| Te complex voor één sessie | Splits in sub-stappen, deel voortgang |
