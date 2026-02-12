---
name: project-management
description: KITT project management systeem - projecten, issues, labels, workflow
user_invocable: false
---

# Project Management Systeem

KITT gebruikt een database-driven project management systeem in `profile/data/kitt.db`.

---

## Projecten

| Identifier | Naam | Focus |
|------------|------|-------|
| **KITT** | KITT MVP | Alles — bridge, agent, memory, portal, skills, infra, data, product |

Alle issues vallen onder het KITT MVP project. Labels worden gebruikt om domeinen te onderscheiden.

---

## Labels (domein)

Elke issue krijgt een domein-label voor filtering in de Portal.

| Label | Kleur | Domein |
|-------|-------|--------|
| `bridge` | #3B82F6 | Message routing, channel adapters (Telegram, WhatsApp, Slack) |
| `memory` | #8B5CF6 | Memory search, embeddings, transcript archivering |
| `scheduler` | #F97316 | Think loop, task engine, background tasks, orchestrator |
| `portal` | #10B981 | Portal frontend, UI pages en componenten |
| `integrations` | #6366F1 | Externe services, OAuth, APIs (Nango, Gmail, etc.) |
| `security` | #DC2626 | Auth, encryption, sanitization, secure mode |
| `skills` | #0891B2 | Skill system, marketplace, skill management |
| `infra` | #6B7280 | Install, deploy, distribution, DB, monitoring |
| `data` | #EC4899 | Health data, nutrition, workouts (Garmin, etc.) |
| `core` | #F59E0B | Agent behavior, language, context, rules |
| `billing` | #059669 | Payment, licensing, tiers (Stripe) |

### Label toekennen

```bash
# Label ID opzoeken
sqlite3 profile/data/kitt.db "SELECT id, name FROM portal_labels"

# Label aan issue koppelen
sqlite3 profile/data/kitt.db "
  INSERT INTO portal_issue_labels (issue_id, label_id)
  SELECT i.id, l.id
  FROM portal_issues i, portal_labels l
  WHERE i.identifier = 'PAS-01' AND l.name = 'integrations'
"
```

---

## Issue Types

| Type | Beschrijving | Voorbeelden |
|------|--------------|-------------|
| `feature` | Nieuwe functionaliteit | "Gmail integratie", "Workout dashboard" |
| `bug` | Defect dat gefixt moet worden | "Session corruption", "Dubbele responses" |
| `improvement` | Verbetering van bestaande feature | "Snellere queries", "Betere error handling" |
| `chore` | Technische schuld, refactoring | "Git history cleanen", "Update dependencies" |
| `spike` | Onderzoek/exploratie | "Evaluate auth options", "Research TTS providers" |

---

## Issue States

```
backlog → scheduled → todo → in_progress → testing → done
                                                    → cancelled
```

| State | Betekenis | Actie |
|-------|-----------|-------|
| `backlog` | Nog niet gepland | Wacht op prioritering |
| `scheduled` | Gepland op specifieke datum | Heeft `scheduled_date` |
| `todo` | Gepland voor huidige cycle | Klaar om op te pakken |
| `in_progress` | Actief aan gewerkt | Agent werkt eraan |
| `testing` | Gebouwd, moet getest worden | Wacht op test door Renier |
| `done` | Afgerond | Geen actie nodig |
| `cancelled` | Geannuleerd | Niet meer relevant |

---

## Priority Levels

| Priority | Betekenis | SLA |
|----------|-----------|-----|
| `critical` | Blocker, systeem down | Binnen uren |
| `urgent` | Dringend, blokkeert andere zaken | Vandaag |
| `high` | Belangrijk voor huidige sprint | Deze week |
| `medium` | Normaal werk | Wanneer tijd is |
| `low` | Nice to have | Backlog |

---

## Complexity & Scope

| Complexity | Betekenis |
|------------|-----------|
| `low` | Kleine change, < 1 uur |
| `medium` | Meerdere files, paar uur |
| `high` | Architecturele impact, dag+ |

| Scope | Betekenis |
|-------|-----------|
| `isolated` | Alleen eigen domein raakt |
| `cross-cutting` | Raakt meerdere domeinen |

---

## Issue Identifier Format

```
{PROJECT}-{NUMBER}
```

Voorbeelden: `PAS-01`, `KITT-105`, `POR-4`

---

## Database Schema

### portal_issues

```sql
CREATE TABLE portal_issues (
  id INTEGER PRIMARY KEY,
  project_id INTEGER REFERENCES portal_projects(id),
  identifier TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  type TEXT DEFAULT 'feature',
  state TEXT DEFAULT 'backlog',
  priority TEXT DEFAULT 'medium',
  complexity TEXT DEFAULT 'medium',
  scope TEXT DEFAULT 'isolated',
  cycle_id INTEGER REFERENCES portal_cycles(id),
  parent_id INTEGER REFERENCES portal_issues(id),
  position INTEGER DEFAULT 0,
  due_date INTEGER,
  scheduled_date INTEGER,
  scheduled_time_start INTEGER,
  scheduled_time_end INTEGER,
  scheduled_timezone TEXT,
  start_date INTEGER,
  created_by TEXT DEFAULT 'renier',
  created_at INTEGER,
  updated_at INTEGER
);
```

### portal_labels & portal_issue_labels

```sql
CREATE TABLE portal_labels (
  id INTEGER PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  color TEXT DEFAULT '#6B7280',
  created_at INTEGER
);

CREATE TABLE portal_issue_labels (
  issue_id INTEGER REFERENCES portal_issues(id),
  label_id INTEGER REFERENCES portal_labels(id),
  PRIMARY KEY (issue_id, label_id)
);
```

### portal_cycles

```sql
CREATE TABLE portal_cycles (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  start_date INTEGER,
  end_date INTEGER,
  created_at INTEGER
);
```

### portal_triage

```sql
CREATE TABLE portal_triage (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  source TEXT,
  suggested_project TEXT,
  suggested_type TEXT,
  status TEXT DEFAULT 'new',
  created_at INTEGER
);
```

---

## Queries

### Alle open issues

```bash
sqlite3 -json profile/data/kitt.db "
  SELECT i.identifier, i.title, i.type, i.state, i.priority,
         i.complexity, i.scope,
         p.identifier as project,
         GROUP_CONCAT(l.name) as labels
  FROM portal_issues i
  LEFT JOIN portal_projects p ON i.project_id = p.id
  LEFT JOIN portal_issue_labels il ON i.id = il.issue_id
  LEFT JOIN portal_labels l ON il.label_id = l.id
  WHERE i.state NOT IN ('done', 'cancelled')
  GROUP BY i.id
  ORDER BY
    CASE i.priority
      WHEN 'critical' THEN 1
      WHEN 'urgent' THEN 2
      WHEN 'high' THEN 3
      WHEN 'medium' THEN 4
      WHEN 'low' THEN 5
    END,
    i.identifier
"
```

### Issues per label

```bash
sqlite3 -json profile/data/kitt.db "
  SELECT i.identifier, i.title, i.state, i.priority
  FROM portal_issues i
  JOIN portal_issue_labels il ON i.id = il.issue_id
  JOIN portal_labels l ON il.label_id = l.id
  WHERE l.name = 'security' AND i.state NOT IN ('done', 'cancelled')
  ORDER BY i.identifier
"
```

### Issue aanmaken

```bash
sqlite3 profile/data/kitt.db "
  INSERT INTO portal_issues (project_id, identifier, title, description, type, state, priority, complexity, scope, created_at, updated_at)
  SELECT
    p.id,
    'PAS-' || (COALESCE(MAX(CAST(SUBSTR(i.identifier, 5) AS INTEGER)), 0) + 1),
    'Issue titel hier',
    'Beschrijving hier',
    'feature',
    'backlog',
    'medium',
    'medium',
    'isolated',
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
sqlite3 profile/data/kitt.db "
  UPDATE portal_issues
  SET state = 'done', updated_at = unixepoch() * 1000
  WHERE identifier = 'PAS-01'
"
```

---

## Workflow

### Voor Agent

1. **Start** — `/issue PAS-01`
2. **Lezen** — Automatisch relevante docs op basis van project
3. **Plan** — Ga in Plan Mode (functioneel + technisch)
4. **Bouwen** — Implementeer na goedkeuring
5. **Testen** — Verificatie
6. **State update** — Zet naar `done`
7. **Commit** — Vraag toestemming aan Renier

---

## KITT Portal

De KITT Portal (`http://localhost:8000`) biedt een UI voor:

- **Projects** — Kanban board, list view, drag & drop
- **Filters** — Project, priority, complexity, scope, labels, search
- **Group By** — State, priority, project, labels
- **Scheduling** — Datum/tijd toekennen aan issues
- **Triage** — Review automatisch gevonden issues
- **Logs** — Real-time KITT logs
