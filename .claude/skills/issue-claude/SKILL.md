---
name: issue-claude
description: Start werken aan een issue via Claude Code (met Plan Mode). Gebruik als /issue-claude PAS-01
user_invocable: true
args: issue_identifier
---

# Issue Builder

Start het bouwen van een issue uit het project management systeem.

## Gebruik

```
/issue PAS-01
/issue KITT-05
/issue POR-3
```

## Stappen

1. **Haal issue op uit database**
2. **Lees relevante architecture docs** (op basis van project)
3. **Ga in Plan Mode** en maak een implementatieplan
4. **Wacht op goedkeuring** van het plan
5. **Bouw, test, documenteer**
6. **Update issue state** naar `done` na completion
7. **Vraag commit toestemming** aan Renier

## Issue Ophalen

Query de database voor issue details:

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

## Verplichte Docs (ALTIJD lezen)

**Ongeacht het project, lees EERST:**

1. `_prd/architecture/ARCHITECTURE.md` — Architectuur principes
2. `_prd/workflows/AGENT.md` — Agent workflow (inclusief Plan Mode format)

## Project → Aanvullende Docs

| Project | Extra docs om te lezen |
|---------|------------------------|
| PAS | `src/integrations/` |
| KITT | `_prd/architecture/overview.md`, `CLAUDE.md` |
| POR | `frontends/portal/`, `src/bridge/log-server.ts` |
| SKL | `.claude/skills/`, bestaande skills als reference |
| INF | `src/bridge/`, `src/scheduler/`, `src/memory/` |
| DAT | `profile/`, Garmin/nutrition skills |

## Issue State Updates

Na completion, update de state:

```bash
sqlite3 profile/data/kitt.db "
  UPDATE portal_issues
  SET state = 'done', updated_at = unixepoch() * 1000
  WHERE identifier = 'ISSUE_ID'
"
```

## States

| State | Betekenis |
|-------|-----------|
| `backlog` | Nog niet gestart |
| `scheduled` | Gepland op specifieke datum |
| `todo` | Gepland voor huidige cycle |
| `in_progress` | Actief aan gewerkt |
| `testing` | Klaar voor review/test |
| `done` | Afgerond |
| `cancelled` | Geannuleerd |

## Labels (domein)

Issues hebben een domein-label voor filtering:

| Label | Domein |
|-------|--------|
| bridge | Message routing, channel adapters |
| memory | Memory search, embeddings, transcripts |
| scheduler | Think loop, task engine, background tasks |
| portal | Portal frontend UI |
| integrations | Externe services, OAuth, APIs |
| security | Auth, encryption, sanitization |
| skills | Skill system, marketplace |
| infra | Install, deploy, distribution, DB |
| data | Health data, nutrition, workouts |
| core | Agent behavior, language, context |
| billing | Payment, licensing, tiers |

## Voorbeeld Flow

```
User: /issue PAS-01

Agent:
1. Query: SELECT * FROM portal_issues WHERE identifier = 'PAS-01'
2. Leest issue: PAS-01 "Nango OAuth Integration" - feature - priority high - label: integrations
3. Leest ALTIJD: _prd/architecture/ARCHITECTURE.md, _prd/workflows/AGENT.md
4. Leest project-specifiek: src/integrations/
5. Gaat in Plan Mode (functioneel + technisch)
6. Bouwt na goedkeuring
7. Update state naar done
8. Vraagt commit toestemming
```

## Fallbacks

| Situatie | Actie |
|----------|-------|
| Issue niet gevonden | Meld aan user, vraag correct identifier |
| Geen description | Vraag user om meer context |
| State is al `done` | Vraag of user wil heropenen |
