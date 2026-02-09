---
name: issue
description: Start werken aan een issue. Gebruik als /issue PAS-01 of /issue KITT-05
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
sqlite3 -json profile/memory/kitt.db "
  SELECT
    i.identifier, i.title, i.description, i.type, i.state, i.priority,
    p.identifier as project, p.name as project_name
  FROM portal_issues i
  LEFT JOIN portal_projects p ON i.project_id = p.id
  WHERE i.identifier = 'ISSUE_ID'
"
```

## Project → Relevante Docs

| Project | Docs om te lezen |
|---------|------------------|
| PAS | `_prd/brainstorm/pas.md`, `src/integrations/` |
| KITT | `_prd/architecture/`, `CLAUDE.md` |
| POR | `frontends/kitt-portal/`, `src/bridge/log-server.ts` |
| SKL | `.claude/skills/`, bestaande skills als reference |
| INF | `src/bridge/`, `src/scheduler/`, `src/memory/` |
| DAT | `profile/`, Garmin/nutrition skills |

## Issue State Updates

Na completion, update de state:

```bash
sqlite3 profile/memory/kitt.db "
  UPDATE portal_issues
  SET state = 'done', updated_at = unixepoch() * 1000
  WHERE identifier = 'ISSUE_ID'
"
```

## States

| State | Betekenis |
|-------|-----------|
| `backlog` | Nog niet gestart |
| `todo` | Gepland voor huidige cycle |
| `in_progress` | Actief aan gewerkt |
| `review` | Klaar voor review |
| `done` | Afgerond |

## Voorbeeld Flow

```
User: /issue PAS-01

Agent:
1. Query: SELECT * FROM portal_issues WHERE identifier = 'PAS-01'
2. Leest: PAS-01 "Nango OAuth Integration" - feature - priority high
3. Leest: _prd/brainstorm/pas.md, src/integrations/
4. Gaat in Plan Mode
5. Bouwt na goedkeuring
6. Update state naar done
7. Vraagt commit toestemming
```

## Fallbacks

| Situatie | Actie |
|----------|-------|
| Issue niet gevonden | Meld aan user, vraag correct identifier |
| Geen description | Vraag user om meer context |
| State is al `done` | Vraag of user wil heropenen |
