# F76: Project Management Skill

> **Priority:** 🟡 P2
> **Status:** 📝 Spec
> **Owner:** -

---

## Overview

A skill that allows KITT to manage projects, issues, and the triage queue autonomously. This skill enables KITT to create projects, move features between states, add labels, and process the triage inbox.

---

## User Stories

**US-01:** As Renier, I want KITT to create new projects when I describe them, so I don't have to do it manually.

**US-02:** As Renier, I want KITT to move features between states (backlog → in_progress → done), so I can track progress via conversation.

**US-03:** As Renier, I want KITT to label features appropriately, so I can categorize work.

**US-04:** As Renier, I want KITT to process the triage queue, so raw ideas become proper issues.

**US-05:** As Renier, I want KITT to assign features to cycles, so I can plan work over time.

---

## Componenten

| Component | Nodig | Beschrijving |
|-----------|-------|--------------|
| Skill | ✅ | `.claude/skills/project-management/SKILL.md` |
| Task | ❌ | - |
| Schema | ❌ | (uses F69 portal_* tables) |
| Backend | ✅ | API endpoints for CRUD operations |
| Portal | ❌ | (covered in F70) |

---

## Skill: Project Management

**Location:** `.claude/skills/project-management/SKILL.md`

**Trigger:** User asks about projects, issues, triage, or says things like:
- "Maak een nieuw project aan voor..."
- "Verplaats F64 naar in progress"
- "Label dit als bug"
- "Wat staat er in de triage queue?"
- "Plan dit voor Cycle 2"

**Capabilities:**

### 1. Project Management
```
- Create new project
- List all projects  
- Update project (name, description, color)
- Archive project
```

### 2. Issue Management
```
- Create issue (with auto-generated identifier like POR-42)
- Update issue (title, description, priority, estimate)
- Move issue to different state
- Assign issue to cycle
- Add/remove labels
- Set parent issue (for sub-issues)
- Close/cancel issue
```

### 3. Triage Processing
```
- View triage queue
- Convert triage item to issue
- Archive triage item
- Snooze triage item
```

### 4. Cycle Management
```
- Create new cycle
- List cycles
- Assign issues to cycle
- Close/completed cycle
```

### 5. Reporting
```
- Show project overview (issues by state)
- Show cycle progress (% complete)
- Show backlog
- Show what's in progress
```

---

## Backend API

Extend `src/bridge/log-server.ts` with:

**Projects:**
```
GET    /api/projects
POST   /api/projects
PATCH  /api/projects/:id
```

**Issues:**
```
GET    /api/issues
POST   /api/issues
PATCH  /api/issues/:id
POST   /api/issues/:id/labels
DELETE /api/issues/:id/labels/:labelId
```

**Cycles:**
```
GET    /api/cycles
POST   /api/cycles
PATCH  /api/cycles/:id
```

**Triage:**
```
GET    /api/triage
POST   /api/triage/:id/convert  # Convert to issue
PATCH  /api/triage/:id           # Mark as processed/snooze
```

**Labels:**
```
GET    /api/labels
POST   /api/labels
```

---

## Database Operations

The skill uses the F69 portal_* tables:

**Create Issue:**
```sql
-- Generate identifier: Find max number for project, add 1
INSERT INTO portal_issues (identifier, title, description, type, project_id, state, priority, created_by)
VALUES ('POR-42', 'Title', 'Desc', 'feature', 1, 'backlog', 'medium', 'renier');
```

**Update State:**
```sql
-- Update issue state + log history
UPDATE portal_issues SET state = 'in_progress', updated_at = ? WHERE id = ?;
INSERT INTO portal_issue_history (issue_id, type, old_value, new_value, created_by) 
VALUES (?, 'state_change', 'backlog', 'in_progress', 'renier');
```

**Add Label:**
```sql
INSERT INTO portal_issue_labels (issue_id, label_id) VALUES (?, ?);
```

---

## Acceptance Criteria

- [ ] Skill file exists at `.claude/skills/project-management/SKILL.md`
- [ ] KITT can create new projects
- [ ] KITT can create issues with auto-generated identifiers
- [ ] KITT can move issues between states
- [ ] KITT can add/remove labels from issues
- [ ] KITT can assign issues to cycles
- [ ] KITT can view and process triage queue
- [ ] KITT can report on project status
- [ ] All actions are logged in portal_issue_history
- [ ] Natural language commands work ("Maak project X aan", "Verplaats Y naar done")

---

## Test Cases

1. **Happy path:** "Maak een project 'Blog' aan" → Project created with identifier BLOG
2. **Happy path:** "Zet F64 naar in progress" → Issue state updated, history logged
3. **Happy path:** "Label F65 als bug" → Label added, visible in portal
4. **Edge case:** Issue creation without project specified → Ask which project
5. **Error case:** Invalid state transition → Explain valid states

---

## Files

| File | Actie | Beschrijving |
|------|-------|--------------|
| `.claude/skills/project-management/SKILL.md` | Create | Skill definition |
| `src/bridge/log-server.ts` | Modify | Add project/issue/cycle/triage API endpoints |
| `frontends/portal/src/lib/api.ts` | Modify | Add API client methods |

---

## Lees Eerst

> **Voor de agent die dit bouwt:**

### Workflow
- `_prd/workflows/AGENT.md`

### Architecture
- `_prd/architecture/overview.md`
- `_prd/brainstorm/portal.md`

### Dependencies
- `_prd/features/F69_portal-project-management-database.md` — Database schema
- `_prd/features/F70_portal-project-management-ui.md` — Portal UI (if exists)

### Similar Skills
- `.claude/skills/nutrition-log/SKILL.md` — Example of data management skill
- `.claude/skills/garmin/SKILL.md` — Example of API integration

---

## Implementation

### Wat is gebouwd

### Beslissingen
