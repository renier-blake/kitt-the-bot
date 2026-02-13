---
name: project-management
description: Project management — issues, projects, labels, triage. Use when the user wants to create, list, update, or manage issues.
user_invocable: true
args: command (list | create | view | update | triage | projects | labels)
---

# Project Management

Manage issues, projects, and labels in `profile/data/kitt.db` (SQLite).

## Usage

```
/project-management list                          — open issues (default)
/project-management list project=KITT priority=high
/project-management create                        — intake flow
/project-management view KITT-01                  — details + sub-issues
/project-management update KITT-01 state=done
/project-management triage                        — review triage items
/project-management projects                      — list all projects
/project-management labels                        — list all labels
```

No argument defaults to `list`.

---

## Schema

### portal_projects

```sql
CREATE TABLE portal_projects (
  id INTEGER PRIMARY KEY,
  identifier TEXT UNIQUE NOT NULL,    -- e.g. "KITT"
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#FF9900',
  created_at INTEGER                  -- unix ms
);
```

### portal_issues

```sql
CREATE TABLE portal_issues (
  id INTEGER PRIMARY KEY,
  identifier TEXT UNIQUE NOT NULL,    -- e.g. "KITT-163"
  title TEXT NOT NULL,
  description TEXT,
  type TEXT DEFAULT 'feature',        -- feature|bug|improvement|chore|spike
  project_id INTEGER REFERENCES portal_projects(id),
  state TEXT DEFAULT 'backlog',       -- see States below
  priority TEXT DEFAULT 'medium',     -- critical|urgent|high|medium|low
  parent_id INTEGER REFERENCES portal_issues(id),  -- sub-issue support
  position INTEGER DEFAULT 0,
  estimate INTEGER,
  due_date INTEGER,                   -- unix ms
  scheduled_date INTEGER,             -- unix ms
  start_date INTEGER,                 -- unix ms
  created_by TEXT DEFAULT 'user',
  created_at INTEGER,                 -- unix ms
  updated_at INTEGER                  -- unix ms
);
```

### portal_labels & portal_issue_labels

```sql
CREATE TABLE portal_labels (
  id INTEGER PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  color TEXT DEFAULT '#6b7280',
  created_at INTEGER
);

CREATE TABLE portal_issue_labels (
  issue_id INTEGER REFERENCES portal_issues(id),
  label_id INTEGER REFERENCES portal_labels(id),
  PRIMARY KEY (issue_id, label_id)
);
```

### portal_issue_history

```sql
CREATE TABLE portal_issue_history (
  id INTEGER PRIMARY KEY,
  issue_id INTEGER REFERENCES portal_issues(id),
  type TEXT NOT NULL,                 -- e.g. 'state_change'
  old_value TEXT,
  new_value TEXT,
  comment TEXT,
  created_by TEXT DEFAULT 'user',
  created_at INTEGER DEFAULT (unixepoch() * 1000)
);
```

### portal_triage

```sql
CREATE TABLE portal_triage (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  source TEXT,
  processed INTEGER DEFAULT 0,
  issue_id INTEGER REFERENCES portal_issues(id),
  created_at INTEGER,
  snoozed_until INTEGER,             -- unix ms, null = not snoozed
  labels TEXT DEFAULT '[]'           -- JSON array
);
```

---

## States

```
backlog → scheduled → todo → in_progress → testing → done
                                                    → cancelled
```

## Priorities

`critical` > `urgent` > `high` > `medium` (default) > `low`

## Types

`feature` (default) | `bug` | `improvement` | `chore` | `spike`

---

## Commands

### list

List/filter issues. Build WHERE clause dynamically based on user request.

```sql
sqlite3 -json profile/data/kitt.db "
  SELECT i.identifier, i.title, i.type, i.state, i.priority,
         p.identifier as project,
         GROUP_CONCAT(DISTINCT l.name) as labels,
         (SELECT COUNT(*) FROM portal_issues c WHERE c.parent_id = i.id) as sub_count
  FROM portal_issues i
  LEFT JOIN portal_projects p ON i.project_id = p.id
  LEFT JOIN portal_issue_labels il ON i.id = il.issue_id
  LEFT JOIN portal_labels l ON il.label_id = l.id
  WHERE i.state NOT IN ('done', 'cancelled')
  -- Add filters: AND p.identifier = 'X', AND i.priority = 'X', etc.
  GROUP BY i.id
  ORDER BY CASE i.priority
    WHEN 'critical' THEN 1 WHEN 'urgent' THEN 2 WHEN 'high' THEN 3
    WHEN 'medium' THEN 4 WHEN 'low' THEN 5 END,
    i.identifier
"
```

For sub-issues of a parent:

```sql
sqlite3 -json profile/data/kitt.db "
  SELECT identifier, title, state, priority
  FROM portal_issues
  WHERE parent_id = (SELECT id FROM portal_issues WHERE identifier = 'PARENT_ID')
  ORDER BY position
"
```

### create

**Always follow this intake flow. Never skip steps.**

**Step 1 — Listen.** Let the user describe what they want. Summarize in 1-2 sentences.

**Step 2 — Clarify.** Ask about project, type, and priority. Look up available projects:

```sql
sqlite3 -json profile/data/kitt.db "SELECT identifier, name FROM portal_projects ORDER BY identifier"
```

Suggest sensible defaults. If making a sub-issue, ask for the parent identifier.

**Step 3 — Documentation.** Add relevant docs to the issue description so the building agent has full context.

**Always include:**
- `_prd/architecture/logging.md` — how to log (structured logger, source tags)
- `_prd/workflows/AGENT.md` — agent build workflow

**Include based on domain:**

| Issue raakt aan... | Doc |
|---|---|
| Bridge / adapters / router | `_prd/architecture/bridge.md` |
| Portal frontend (React) | `_prd/architecture/portal.md` |
| Think loop / scheduler | `_prd/architecture/think-loop.md` |
| Memory / search / embeddings | `_prd/architecture/memory.md` |
| Skills | `_prd/architecture/skills.md` |
| Integrations / OAuth / Nango | `_prd/architecture/integrations.md` |
| Agent pool / concurrency | `_prd/architecture/agent-pool.md` |
| Context system / blocks | `_prd/architecture/context.md` |
| Architecture overview | `_prd/architecture/overview.md` |

Also mention **key files** that will likely need changes (source paths).

Format in the description:

```
Docs:
- _prd/architecture/logging.md
- _prd/architecture/bridge.md
- _prd/workflows/AGENT.md

Key files:
- src/bridge/agent-pool.ts
- src/bridge/routes/health.ts
```

**Step 4 — Confirm.** Present summary and wait for explicit confirmation:

```
Title: [title]
Project: [PROJECT]
Type: [type] | Priority: [priority]
Parent: [parent identifier or none]

Description:
[1-3 sentences]

Docs:
- _prd/architecture/logging.md
- [domain-specific docs]
- _prd/workflows/AGENT.md

Key files:
- [relevant source files]

Acceptance criteria:
- [ ] [criterion 1]
- [ ] [criterion 2]

Correct?
```

**Step 5 — Create.** After confirmation, insert:

```sql
sqlite3 profile/data/kitt.db "
  INSERT INTO portal_issues (
    project_id, identifier, title, description, type, state, priority,
    parent_id, created_by, created_at, updated_at, position
  )
  SELECT
    p.id,
    p.identifier || '-' || (
      SELECT COALESCE(MAX(CAST(SUBSTR(i2.identifier, LENGTH(p.identifier)+2) AS INTEGER)), 0) + 1
      FROM portal_issues i2 WHERE i2.identifier LIKE p.identifier || '-%'
    ),
    'TITLE',
    'DESCRIPTION',
    'TYPE',
    'backlog',
    'PRIORITY',
    PARENT_ID_OR_NULL,
    'user',
    unixepoch() * 1000,
    unixepoch() * 1000,
    (SELECT COALESCE(MAX(position), 0) + 1000 FROM portal_issues WHERE state = 'backlog')
  FROM portal_projects p
  WHERE p.identifier = 'PROJECT'
"
```

Add labels if applicable:

```sql
sqlite3 profile/data/kitt.db "
  INSERT INTO portal_issue_labels (issue_id, label_id)
  SELECT i.id, l.id FROM portal_issues i, portal_labels l
  WHERE i.identifier = 'NEW_ID' AND l.name = 'LABEL'
"
```

Confirm creation with the new identifier.

### view

```sql
-- Issue details
sqlite3 -json profile/data/kitt.db "
  SELECT i.identifier, i.title, i.description, i.type, i.state, i.priority,
         i.due_date, i.scheduled_date, i.start_date, i.estimate,
         p.identifier as project, p.name as project_name,
         pi.identifier as parent
  FROM portal_issues i
  LEFT JOIN portal_projects p ON i.project_id = p.id
  LEFT JOIN portal_issues pi ON i.parent_id = pi.id
  WHERE i.identifier = 'ISSUE_ID'
"

-- Labels
sqlite3 -json profile/data/kitt.db "
  SELECT l.name, l.color FROM portal_labels l
  JOIN portal_issue_labels il ON l.id = il.label_id
  JOIN portal_issues i ON il.issue_id = i.id
  WHERE i.identifier = 'ISSUE_ID'
"

-- Sub-issues
sqlite3 -json profile/data/kitt.db "
  SELECT identifier, title, state, priority
  FROM portal_issues WHERE parent_id = (
    SELECT id FROM portal_issues WHERE identifier = 'ISSUE_ID'
  ) ORDER BY position
"

-- History
sqlite3 -json profile/data/kitt.db "
  SELECT type, old_value, new_value, comment,
         datetime(created_at/1000, 'unixepoch', 'localtime') as date
  FROM portal_issue_history
  WHERE issue_id = (SELECT id FROM portal_issues WHERE identifier = 'ISSUE_ID')
  ORDER BY created_at DESC
"
```

### update

Update fields on an issue. Supports: state, priority, type, title, description, labels, parent_id, due_date, scheduled_date.

```sql
sqlite3 profile/data/kitt.db "
  UPDATE portal_issues
  SET state = 'NEW_STATE', updated_at = unixepoch() * 1000
  WHERE identifier = 'ISSUE_ID'
"
```

**Always log state changes to history:**

```sql
sqlite3 profile/data/kitt.db "
  INSERT INTO portal_issue_history (issue_id, type, old_value, new_value, created_at)
  SELECT id, 'state_change', state, 'NEW_STATE', unixepoch() * 1000
  FROM portal_issues WHERE identifier = 'ISSUE_ID'
"
```

Run the history INSERT before the UPDATE so `state` still has the old value.

**Labels:**

```sql
-- Add
sqlite3 profile/data/kitt.db "
  INSERT INTO portal_issue_labels (issue_id, label_id)
  SELECT i.id, l.id FROM portal_issues i, portal_labels l
  WHERE i.identifier = 'ISSUE_ID' AND l.name = 'LABEL'
"

-- Remove
sqlite3 profile/data/kitt.db "
  DELETE FROM portal_issue_labels
  WHERE issue_id = (SELECT id FROM portal_issues WHERE identifier = 'ISSUE_ID')
  AND label_id = (SELECT id FROM portal_labels WHERE name = 'LABEL')
"
```

**Set parent (make sub-issue):**

```sql
sqlite3 profile/data/kitt.db "
  UPDATE portal_issues
  SET parent_id = (SELECT id FROM portal_issues WHERE identifier = 'PARENT_ID'),
      updated_at = unixepoch() * 1000
  WHERE identifier = 'CHILD_ID'
"
```

### triage

List unprocessed triage items:

```sql
sqlite3 -json profile/data/kitt.db "
  SELECT id, title, description, source, labels,
         datetime(created_at/1000, 'unixepoch', 'localtime') as date
  FROM portal_triage
  WHERE processed = 0
    AND (snoozed_until IS NULL OR snoozed_until < unixepoch() * 1000)
  ORDER BY created_at DESC
"
```

Actions per item: **accept** (create issue via intake flow), **dismiss**, or **snooze**.

```sql
-- Dismiss
sqlite3 profile/data/kitt.db "UPDATE portal_triage SET processed = 1 WHERE id = ID"

-- Snooze (7 days)
sqlite3 profile/data/kitt.db "
  UPDATE portal_triage SET snoozed_until = (unixepoch() + 7*86400) * 1000 WHERE id = ID
"
```

### projects

```sql
sqlite3 -json profile/data/kitt.db "
  SELECT p.identifier, p.name, p.description,
         COUNT(i.id) as total,
         SUM(CASE WHEN i.state NOT IN ('done','cancelled') THEN 1 ELSE 0 END) as open
  FROM portal_projects p
  LEFT JOIN portal_issues i ON p.id = i.project_id
  GROUP BY p.id ORDER BY p.identifier
"
```

### labels

```sql
sqlite3 -json profile/data/kitt.db "
  SELECT l.name, l.color, COUNT(il.issue_id) as usage
  FROM portal_labels l
  LEFT JOIN portal_issue_labels il ON l.id = il.label_id
  GROUP BY l.id ORDER BY usage DESC
"
```

---

## Rules

1. **Never create an issue without the intake flow** — always confirm before inserting
2. **Always include relevant docs** — logging.md + AGENT.md are mandatory, add domain-specific docs
3. **Always list key files** — source paths that will likely need changes
4. **Log state changes** to portal_issue_history (INSERT before UPDATE)
5. **Dynamic lookups only** — query projects/labels from DB, never assume they exist
6. **Timestamps** are unix milliseconds: `unixepoch() * 1000`
7. **Identifier format** is `{PROJECT}-{N}` where N auto-increments per project

## Fallbacks

| Situation | Action |
|-----------|--------|
| No args / ambiguous | Default to `list` with open issues |
| Issue not found | Report, suggest search |
| Project not found | Show available projects |
| Duplicate suspected | Check before creating, report if found |
