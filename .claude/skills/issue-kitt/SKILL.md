---
name: issue-kitt
description: KITT werkt aan een issue via Telegram. Maakt een plan, deelt het met Renier, en bouwt na goedkeuring.
user_invocable: false
args: issue_identifier
---

# Issue Builder (via Telegram)

Voor wanneer KITT via Telegram aan een issue gaat werken.

**BELANGRIJK:** GEEN Plan Mode gebruiken — dat werkt niet via Telegram. In plaats daarvan maak je een plan en deel je het in het chatbericht.

---

## Workflow

### 1. Issue Ophalen

```bash
sqlite3 -json profile/data/kitt.db "
  SELECT i.identifier, i.title, i.description, i.type, i.state, i.priority,
         p.identifier as project, p.name as project_name,
         pi.identifier as parent,
         GROUP_CONCAT(DISTINCT l.name) as labels
  FROM portal_issues i
  LEFT JOIN portal_projects p ON i.project_id = p.id
  LEFT JOIN portal_issues pi ON i.parent_id = pi.id
  LEFT JOIN portal_issue_labels il ON i.id = il.issue_id
  LEFT JOIN portal_labels l ON il.label_id = l.id
  WHERE i.identifier = 'ISSUE_ID'
  GROUP BY i.id
"
```

Update state naar `in_progress` (history first):

```bash
sqlite3 profile/data/kitt.db "
  INSERT INTO portal_issue_history (issue_id, type, old_value, new_value, created_at)
  SELECT id, 'state_change', state, 'in_progress', unixepoch() * 1000
  FROM portal_issues WHERE identifier = 'ISSUE_ID'
"
sqlite3 profile/data/kitt.db "
  UPDATE portal_issues
  SET state = 'in_progress', updated_at = unixepoch() * 1000
  WHERE identifier = 'ISSUE_ID'
"
```

### 2. Context Lezen

**Altijd lezen:** `CLAUDE.md`

**Daarna:** Bepaal op basis van de issue beschrijving en labels welke code en docs relevant zijn. Lees de relevante directories en bestanden voordat je een plan maakt.

### 3. Plan Maken & Delen

Maak een plan en **stuur dit als chatbericht**:

```
Plan: [ISSUE_ID] — [titel]

## Wat gaat er veranderen?
[1-3 zinnen — wat ervaart de gebruiker straks anders?]

## Aanpak
1. [Stap 1 — bestand + wat je doet]
2. [Stap 2 — bestand + wat je doet]
3. ...

## Risico's / keuzes
[Eventuele keuzes die je maakt en waarom]

Mag ik hiermee starten?
```

**STOP hier. Wacht op goedkeuring.**

- "ok", "ja", "go", "doen" → ga door naar stap 4
- Feedback → pas plan aan en deel opnieuw
- "nee" of "stop" → stop en zet state terug naar `todo`

### 4. Plan Opslaan in Issue

Na goedkeuring, sla het plan op in de issue description:

```bash
sqlite3 profile/data/kitt.db "
  UPDATE portal_issues
  SET description = description || char(10) || char(10) || '---' || char(10) || char(10) || '## Plan van Aanpak' || char(10) || '[het goedgekeurde plan hier]',
      updated_at = unixepoch() * 1000
  WHERE identifier = 'ISSUE_ID'
"
```

### 5. Bouwen

Implementeer volgens het goedgekeurde plan. Geef tussentijdse updates als het langer duurt.

### 6. Afronden

```bash
sqlite3 profile/data/kitt.db "
  INSERT INTO portal_issue_history (issue_id, type, old_value, new_value, created_at)
  SELECT id, 'state_change', state, 'done', unixepoch() * 1000
  FROM portal_issues WHERE identifier = 'ISSUE_ID'
"
sqlite3 profile/data/kitt.db "
  UPDATE portal_issues
  SET state = 'done', updated_at = unixepoch() * 1000
  WHERE identifier = 'ISSUE_ID'
"
```

Stuur bericht: "[ISSUE_ID] is klaar. [korte samenvatting]. Mag ik committen?"

Commit pas na toestemming.

---

## Regels

- **NOOIT** Plan Mode gebruiken (werkt niet via Telegram)
- **ALTIJD** plan delen en wachten op goedkeuring voordat je bouwt
- **ALTIJD** plan opslaan in de issue na goedkeuring
- **NOOIT** committen zonder toestemming

## Fallbacks

| Situatie | Actie |
|----------|-------|
| Issue niet gevonden | Meld, vraag correct identifier |
| Geen description | Vraag om meer context |
| State is al `done` | Vraag of user wil heropenen |
| Halverwege geblokkeerd | Stuur update, vraag hulp |
| Te complex voor één sessie | Splits in sub-stappen, deel voortgang |
