# F69: Portal Project Management Database

> **Priority:** 🟠 P1
> **Status:** ✅ Done
> **Owner:** -

---

## Overview

Create the database schema for Linear-style project management. This includes projects, cycles (sprints), issues (features/bugs), labels, and triage queue. This schema enables the Kanban board and roadmap views.

---

## User Stories

**US-01:** As Renier, I want to organize features into projects, so I can group related work.

**US-02:** As Renier, I want to plan work in cycles, so I can track progress over time.

**US-03:** As Renier, I want to track issues through states, so I know what's in progress.

**US-04:** As Renier, I want to triage new ideas, so I can decide what to work on.

---

## Componenten

| Component | Nodig | Beschrijving |
|-----------|-------|--------------|
| Skill | ❌ | - |
| Task | ❌ | - |
| Schema | ✅ | New portal_* tables (see below) |
| Backend | ✅ | Seed data for initial projects |
| Portal | ❌ | (covered in F70) |

---

## Schema Change

**Migration v003 → v004:**

```sql
-- Projects (thematic groupings)
CREATE TABLE portal_projects (
    id INTEGER PRIMARY KEY,
    identifier TEXT UNIQUE NOT NULL,      -- "POR", "SKL", "INF"
    name TEXT NOT NULL,                   -- "Portal", "Skills", "Infrastructure"
    description TEXT,
    color TEXT DEFAULT '#FF9900',         -- Hex color for visual ID
    created_at INTEGER DEFAULT (unixepoch() * 1000)
);

-- Cycles (sprints)
CREATE TABLE portal_cycles (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,                   -- "Cycle 1", "Feb 2026"
    start_date INTEGER NOT NULL,          -- Unix timestamp
    end_date INTEGER NOT NULL,
    status TEXT DEFAULT 'active',         -- 'upcoming', 'active', 'completed'
    created_at INTEGER DEFAULT (unixepoch() * 1000)
);

-- Issues (features, bugs, improvements)
CREATE TABLE portal_issues (
    id INTEGER PRIMARY KEY,
    identifier TEXT UNIQUE NOT NULL,      -- "POR-42", "SKL-7" (auto-generated)
    title TEXT NOT NULL,
    description TEXT,
    
    -- Classification
    type TEXT DEFAULT 'feature',          -- 'feature', 'bug', 'improvement'
    project_id INTEGER REFERENCES portal_projects(id),
    
    -- Workflow
    state TEXT DEFAULT 'backlog',         -- 'backlog', 'todo', 'in_progress', 'done', 'canceled'
    priority TEXT DEFAULT 'medium',       -- 'high', 'medium', 'low'
    
    -- Cycle assignment
    cycle_id INTEGER REFERENCES portal_cycles(id),
    
    -- Scheduling
    estimate INTEGER,                     -- Story points or hours
    due_date INTEGER,                     -- Optional deadline
    
    -- Relations
    parent_id INTEGER REFERENCES portal_issues(id),  -- For sub-issues
    
    -- Metadata
    created_by TEXT DEFAULT 'renier',
    created_at INTEGER DEFAULT (unixepoch() * 1000),
    updated_at INTEGER DEFAULT (unixepoch() * 1000)
);

-- Issue History (state changes, comments)
CREATE TABLE portal_issue_history (
    id INTEGER PRIMARY KEY,
    issue_id INTEGER REFERENCES portal_issues(id),
    type TEXT NOT NULL,                   -- 'state_change', 'comment', 'edit'
    old_value TEXT,
    new_value TEXT,
    comment TEXT,                         -- For comment type
    created_by TEXT DEFAULT 'renier',
    created_at INTEGER DEFAULT (unixepoch() * 1000)
);

-- Labels (for categorization)
CREATE TABLE portal_labels (
    id INTEGER PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,            -- "needs-refinement", "blocked", "quick-win"
    color TEXT DEFAULT '#6b7280',
    created_at INTEGER DEFAULT (unixepoch() * 1000)
);

-- Issue Labels (many-to-many)
CREATE TABLE portal_issue_labels (
    issue_id INTEGER REFERENCES portal_issues(id),
    label_id INTEGER REFERENCES portal_labels(id),
    PRIMARY KEY (issue_id, label_id)
);

-- Triage Queue (unprocessed ideas)
CREATE TABLE portal_triage (
    id INTEGER PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    source TEXT,                          -- 'conversation', 'idea', 'observation'
    processed INTEGER DEFAULT 0,
    issue_id INTEGER REFERENCES portal_issues(id),  -- When converted to issue
    created_at INTEGER DEFAULT (unixepoch() * 1000)
);
```

**Code changes:**
- [ ] `src/memory/schema.ts` - Migration v004 toevoegen
- [ ] `src/memory/schema.ts` - Seed data voor initial projects

---

## Seed Data

```sql
-- Initial Projects
INSERT INTO portal_projects (identifier, name, description, color) VALUES
('POR', 'Portal', 'KITT Management Portal', '#FF9900'),
('SKL', 'Skills', 'KITT Skills System', '#3B82F6'),
('INF', 'Infrastructure', 'Core KITT Infrastructure', '#10B981'),
('DAT', 'Data', 'Personal Data & Insights', '#8B5CF6');

-- Initial Cycle
INSERT INTO portal_cycles (name, start_date, end_date, status) VALUES
('Cycle 1', 1704067200000, 1706745600000, 'active');

-- Initial Labels
INSERT INTO portal_labels (name, color) VALUES
('needs-refinement', '#F59E0B'),
('blocked', '#EF4444'),
('quick-win', '#10B981'),
('bug', '#EF4444'),
('enhancement', '#3B82F6');
```

---

## Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  Database Schema                                                  │
│                                                                   │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐       │
│  │   Projects   │◄───│    Issues    │───►│    Cycles    │       │
│  │   (POR,SKL)  │    │  (POR-42)    │    │  (Cycle 1)   │       │
│  └──────────────┘    └──────────────┘    └──────────────┘       │
│                             │                                     │
│                             ▼                                     │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐       │
│  │    Labels    │◄───│ Issue Labels │    │    Triage    │       │
│  └──────────────┘    └──────────────┘    └──────────────┘       │
│                             │                                     │
│                             ▼                                     │
│                      ┌──────────────┐                             │
│                      │Issue History │                             │
│                      └──────────────┘                             │
└─────────────────────────────────────────────────────────────────┘
```

---

## Acceptance Criteria

- [x] Migration v13 creates all portal_* tables
- [x] Foreign key constraints are properly defined
- [x] Seed data creates initial projects (POR, SKL, INF, DAT)
- [x] Seed data creates first cycle (Cycle 1)
- [x] Seed data creates 7 useful labels (needs-refinement, blocked, quick-win, bug, enhancement, documentation, research)
- [x] Database migration runs without errors
- [x] Existing data is preserved
- [x] Indexes created for performance (project_id, state, cycle_id)

---

## Test Cases

1. **Happy path:** Migration runs, all tables created with seed data
2. **Edge case:** Create issue, identifier auto-generates correctly
3. **Error case:** Try to create issue with non-existent project, FK error

---

## Files

| File | Actie | Beschrijving |
|------|-------|--------------|
| `src/db/migrations/004-portal.sql` | Create | Migration file |
| `src/memory/schema.ts` | Modify | Add migration, seed data |

---

## Lees Eerst

> **Voor de agent die dit bouwt:**

### Workflow
- `_prd/workflows/AGENT.md`

### Architecture
- `_prd/architecture/overview.md`
- `_prd/brainstorm/portal.md` (Section 4.4: Database Migrations)

### Bestaande Code
- `src/memory/schema.ts` (existing migrations)
- `src/db/migrations/` (migration files)

### Linear Reference
- Linear uses identifiers like "ENG-42" for issues
- States: Backlog, Todo, In Progress, Done, Canceled
- Priorities: High, Medium, Low

---

## Implementation

### Wat is gebouwd

**Migration v12 -> v13 in `src/memory/schema.ts`:**

Created 7 new tables for Linear-style project management:

1. **`portal_projects`** — Projects with identifiers (POR, SKL, INF, DAT) and colors
2. **`portal_cycles`** — Sprints/cycles with start/end dates and status
3. **`portal_issues`** — Issues/features/bugs with full workflow tracking
   - Foreign keys to projects and cycles
   - States: backlog, todo, in_progress, done, canceled
   - Auto-generated identifiers (POR-42 format handled in application layer)
4. **`portal_issue_history`** — Audit trail of all changes
5. **`portal_labels`** — Categorization labels with colors
6. **`portal_issue_labels`** — Many-to-many linking issues to labels
7. **`portal_triage`** — Inbox for unprocessed ideas

**Seed Data:**
- 4 projects: Portal (orange), Skills (blue), Infrastructure (green), Data (purple)
- 1 cycle: "Cycle 1" (1 month duration, active)
- 7 labels: needs-refinement, blocked, quick-win, bug, enhancement, documentation, research

**Indexes:**
- `idx_issues_project` — Fast lookup by project
- `idx_issues_state` — Fast filtering by state (backlog, done, etc.)
- `idx_issues_cycle` — Fast lookup by cycle

### Beslissingen

1. **Identifier format (POR-42):** Not using auto-increment in DB. Application layer generates identifiers based on project prefix + sequence number. This allows human-readable IDs like Linear.

2. **Separate labels table:** Many-to-many relationship so issues can have multiple labels (e.g., "bug" + "quick-win").

3. **Triage queue:** Separate table for raw ideas before they become formal issues. Allows capturing thoughts without polluting the main issue list.

4. **History table:** Separate audit log rather than JSON column. Allows querying history ("what changed last week").

5. **Color per project/label:** Stored as hex strings. Frontend renders these for visual distinction.
