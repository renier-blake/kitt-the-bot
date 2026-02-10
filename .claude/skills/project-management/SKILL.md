---
name: project-management
description: KITT project management systeem - projecten, issues, workflow
user_invocable: false
---

# Project Management Systeem

KITT gebruikt een database-driven project management systeem in `profile/memory/kitt.db`.

---

## Projecten

| Identifier | Naam | Focus | Kleur |
|------------|------|-------|-------|
| **PAS** | Personal AI Service | OAuth integraties, channels, marketplace, distributie | Oranje |
| **KITT** | KITT Core | Bridge, agent, memory, think loop | Rood |
| **POR** | Portal | KITT Management Portal UI | Oranje |
| **SKL** | Skills | Nieuwe skills en skill verbeteringen | Blauw |
| **INF** | Infrastructure | Task engine, scheduler, logging, devops | Groen |
| **DAT** | Data | Garmin, nutrition, workout tracking, personal insights | Paars |

### Project Keuze

| Als de issue gaat over... | Project |
|---------------------------|---------|
| OAuth, Nango, externe APIs, channels | PAS |
| Bridge, telegram, memory, think loop | KITT |
| Portal UI, dashboards | POR |
| Nieuwe skill of skill update | SKL |
| Task engine, logging, pm2, scheduler | INF |
| Garmin, nutrition, workouts, health data | DAT |

---

## Issue Types

| Type | Beschrijving | Voorbeelden |
|------|--------------|-------------|
| `feature` | Nieuwe functionaliteit | "Gmail integratie", "Workout dashboard" |
| `bug` | Defect dat gefixt moet worden | "Session corruption", "Dubbele responses" |
| `improvement` | Verbetering van bestaande feature | "Snellere queries", "Betere error handling" |
| `chore` | Technische schuld, refactoring | "Migrate to TypeScript", "Update dependencies" |
| `spike` | Onderzoek/exploratie | "Evaluate auth options", "Research TTS providers" |

---

## Issue States

```
backlog → todo → in_progress → testing → done
```

| State | Betekenis | Actie |
|-------|-----------|-------|
| `backlog` | Nog niet gepland | Wacht op prioritering |
| `todo` | Gepland voor huidige cycle | Klaar om op te pakken |
| `in_progress` | Actief aan gewerkt | Agent werkt eraan |
| `testing` | Gebouwd, moet getest worden | Wacht op test door Renier |
| `done` | Afgerond | Geen actie nodig |

---

## Priority Levels

| Priority | Betekenis | SLA |
|----------|-----------|-----|
| `critical` | Blocker, systeem down | Binnen uren |
| `high` | Belangrijk voor huidige sprint | Deze week |
| `medium` | Normaal werk | Wanneer tijd is |
| `low` | Nice to have | Backlog |

---

## Issue Identifier Format

```
{PROJECT}-{NUMBER}
```

Voorbeelden:
- `PAS-01` - Eerste issue in Personal AI Service
- `KITT-105` - Issue #105 in KITT Core
- `POR-4` - Issue #4 in Portal

---

## Database Schema

### portal_projects

```sql
CREATE TABLE portal_projects (
  id INTEGER PRIMARY KEY,
  identifier TEXT UNIQUE NOT NULL,  -- 'PAS', 'KITT', etc.
  name TEXT NOT NULL,
  description TEXT,
  color TEXT,                        -- Hex color voor UI
  created_at INTEGER
);
```

### portal_issues

```sql
CREATE TABLE portal_issues (
  id INTEGER PRIMARY KEY,
  project_id INTEGER REFERENCES portal_projects(id),
  identifier TEXT UNIQUE NOT NULL,  -- 'PAS-01', 'KITT-105'
  title TEXT NOT NULL,
  description TEXT,
  type TEXT DEFAULT 'feature',      -- feature, bug, improvement, chore, spike
  state TEXT DEFAULT 'backlog',     -- backlog, todo, in_progress, review, done
  priority TEXT DEFAULT 'medium',   -- critical, high, medium, low
  created_at INTEGER,
  updated_at INTEGER
);
```

### portal_triage

```sql
CREATE TABLE portal_triage (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  source TEXT,                       -- 'codebase-health-audit', 'manual'
  suggested_project TEXT,
  suggested_type TEXT,
  status TEXT DEFAULT 'new',         -- new, accepted, rejected
  created_at INTEGER
);
```

---

## Queries

### Alle open issues

```bash
sqlite3 -json profile/memory/kitt.db "
  SELECT i.identifier, i.title, i.type, i.state, i.priority, p.identifier as project
  FROM portal_issues i
  LEFT JOIN portal_projects p ON i.project_id = p.id
  WHERE i.state NOT IN ('done')
  ORDER BY
    CASE i.priority
      WHEN 'critical' THEN 1
      WHEN 'high' THEN 2
      WHEN 'medium' THEN 3
      WHEN 'low' THEN 4
    END,
    i.identifier
"
```

### Issues per project

```bash
sqlite3 -json profile/memory/kitt.db "
  SELECT i.identifier, i.title, i.state, i.priority
  FROM portal_issues i
  LEFT JOIN portal_projects p ON i.project_id = p.id
  WHERE p.identifier = 'PAS' AND i.state != 'done'
  ORDER BY i.identifier
"
```

### Issue aanmaken

```bash
sqlite3 profile/memory/kitt.db "
  INSERT INTO portal_issues (project_id, identifier, title, description, type, state, priority, created_at, updated_at)
  SELECT
    p.id,
    'PAS-' || (COALESCE(MAX(CAST(SUBSTR(i.identifier, 5) AS INTEGER)), 0) + 1),
    'Issue titel hier',
    'Beschrijving hier',
    'feature',
    'backlog',
    'medium',
    unixepoch() * 1000,
    unixepoch() * 1000
  FROM portal_projects p
  LEFT JOIN portal_issues i ON i.project_id = p.id AND i.identifier LIKE 'PAS-%'
  WHERE p.identifier = 'PAS'
  GROUP BY p.id
"
```

### Issue state updaten

```bash
sqlite3 profile/memory/kitt.db "
  UPDATE portal_issues
  SET state = 'done', updated_at = unixepoch() * 1000
  WHERE identifier = 'PAS-01'
"
```

### Issue verplaatsen naar ander project

```bash
sqlite3 profile/memory/kitt.db "
  UPDATE portal_issues
  SET project_id = (SELECT id FROM portal_projects WHERE identifier = 'SKL'),
      identifier = 'SKL-' || (SELECT COALESCE(MAX(CAST(SUBSTR(identifier, 5) AS INTEGER)), 0) + 1 FROM portal_issues WHERE identifier LIKE 'SKL-%'),
      updated_at = unixepoch() * 1000
  WHERE identifier = 'KITT-28'
"
```

---

## Workflow

### Voor PO (Product Owner)

1. **Intake** - Luister naar user, vraag door op componenten
2. **Issue aanmaken** - Via Portal UI of SQL
3. **Prioriteren** - Zet priority en state
4. **Handover** - Na completion, check state en update docs

### Voor Agent

1. **Start** - `/issue PAS-01`
2. **Lezen** - Automatisch relevante docs op basis van project
3. **Plan** - Ga in Plan Mode
4. **Bouwen** - Implementeer na goedkeuring
5. **Testen** - Verificatie
6. **State update** - Zet naar `done`
7. **Commit** - Vraag toestemming aan Renier

---

## KITT Portal

De KITT Portal (`http://localhost:8000`) biedt een UI voor:

- **Projects** - Overzicht van alle projecten
- **Issues** - Kanban board per project
- **Triage** - Review automatisch gevonden issues
- **Logs** - Real-time KITT logs

Start: `pm2 start npm --name kitt -- run bridge`

---

## Triage Flow

De `codebase-health-audit` skill vindt automatisch issues en zet ze in `portal_triage`.

1. **Review** - Check triage items in Portal
2. **Accept** - Converteer naar echte issue in juiste project
3. **Reject** - Markeer als niet relevant

```bash
# Triage item accepteren
sqlite3 profile/memory/kitt.db "
  -- Insert as issue
  INSERT INTO portal_issues (project_id, identifier, title, description, type, state, priority, created_at, updated_at)
  SELECT
    (SELECT id FROM portal_projects WHERE identifier = 'suggested_project'),
    'PROJECT-##',
    title,
    description,
    suggested_type,
    'backlog',
    'medium',
    unixepoch() * 1000,
    unixepoch() * 1000
  FROM portal_triage WHERE id = 123;

  -- Mark as accepted
  UPDATE portal_triage SET status = 'accepted' WHERE id = 123;
"
```
