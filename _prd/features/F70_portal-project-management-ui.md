# F70: Portal Project Management UI

> **Priority:** 🟠 P1
> **Status:** ✅ Done
> **Owner:** Agent
> **Completed:** 2026-02-08

---

## Overview

Build the Linear-style project management interface for the KITT Portal. Includes Board view (Kanban), List view, and the ability to create/edit issues. This is the main interface for tracking features and bugs.

---

## User Stories

**US-01:** As Renier, I want to see issues in a Kanban board, so I can visualize workflow states.

**US-02:** As Renier, I want to drag issues between columns, so I can update their status.

**US-03:** As Renier, I want to filter issues by project/cycle/priority, so I can focus on specific work.

**US-04:** As Renier, I want to create new issues, so I can track new features and bugs.

**US-05:** As Renier, I want to see issue details in a panel, so I can view full descriptions.

---

## Componenten

| Component | Nodig | Beschrijving |
|-----------|-------|--------------|
| Skill | ❌ | - |
| Task | ❌ | - |
| Schema | ❌ | (covered in F69) |
| Backend | ✅ | REST API for CRUD operations |
| Portal | ✅ | Board view, List view, Issue forms |

---

## Backend API

**GET /api/projects**
```json
[
  { "id": 1, "identifier": "POR", "name": "Portal", "color": "#FF9900" }
]
```

**GET /api/cycles**
```json
[
  { "id": 1, "name": "Cycle 1", "status": "active", "startDate": "...", "endDate": "..." }
]
```

**GET /api/issues?project=&cycle=&state=&priority=**
```json
[
  {
    "id": 42,
    "identifier": "POR-7",
    "title": "System Health Dashboard",
    "state": "in_progress",
    "priority": "high",
    "project": { "identifier": "POR", "color": "#FF9900" },
    "cycle": { "name": "Cycle 1" },
    "labels": [{ "name": "quick-win", "color": "#10B981" }]
  }
]
```

**POST /api/issues**
```json
{ "title": "...", "projectId": 1, "priority": "medium", "type": "feature" }
```

**PATCH /api/issues/:id**
```json
{ "state": "done", "priority": "high" }
```

---

## UI Views

### Board View (Kanban)

```
┌─────────────────────────────────────────────────────────────────┐
│  Projects                                          [+ New Issue] │
│                                                                  │
│  Cycle: [Cycle 1 ▼]  Project: [All ▼]  Search: [________] [⚙️]  │
├──────────────┬──────────────┬──────────────┬──────────────┬─────┤
│   Backlog    │    Todo      │ In Progress  │    Done      │ Can │
│     12       │     5        │     3        │    18        │  2  │
├──────────────┼──────────────┼──────────────┼──────────────┼─────┤
│ ┌──────────┐ │ ┌──────────┐ │ ┌──────────┐ │ ┌──────────┐ │     │
│ │POR-43    │ │ │POR-38    │ │ │POR-42    │ │ │POR-30    │ │     │
│ │Database  │ │ │System    │ │ │Kanban    │ │ │Framework │ │     │
│ │filters   │ │ │Health    │ │ │Board     │ │ │Setup     │ │     │
│ │          │ │ │Dashboard │ │ │          │ │ │          │ │     │
│ │🔴 High   │ │ │🟡 Medium │ │ │🟢 Low    │ │ │          │ │     │
│ │[Portal]  │ │ │[Portal]  │ │ │[Portal]  │ │ │          │ │     │
│ └──────────┘ │ └──────────┘ │ └──────────┘ │ └──────────┘ │     │
│ ┌──────────┐ │ ┌──────────┐ │ └──────────┘ │              │     │
│ │POR-44    │ │ │POR-39    │ │              │              │     │
│ │Search    │ │ │Token     │ │              │              │     │
│ │Function  │ │ │Usage     │ │              │              │     │
│ └──────────┘ │ └──────────┘ │              │              │     │
└──────────────┴──────────────┴──────────────┴──────────────┴─────┘
```

### List View

```
┌─────────────────────────────────────────────────────────────────┐
│  Issues                                              [+ New] [⚙️]│
├─────────────────────────────────────────────────────────────────┤
│  □  Identifier  Title                    State    Priority  Cycle │
│  ───────────────────────────────────────────────────────────────│
│  □  POR-43      Database filters         Backlog  High      C1   │
│  □  POR-38      System Health Dashboard  Todo     Medium    C1   │
│  □  POR-42      Kanban Board Component   In Prog  Low       C1   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Acceptance Criteria

- [x] Board view shows 5 columns (Backlog, Todo, In Progress, Done, Canceled)
- [x] Cards show identifier, title, priority badge, project label
- [x] Drag-and-drop to move issues between columns
- [x] List view shows table with all issues
- [x] Filters work: Cycle, Project, State, Priority
- [x] Search filters issues by title/content
- [x] Clicking card opens detail panel (slide-over)
- [x] "New Issue" button opens creation form (Dialog)
- [x] Form validation shows errors inline
- [x] Issue identifier auto-generates on create (e.g., POR-1, SKL-2)

---

## Test Cases

1. **Happy path:** Create issue, drag to In Progress, mark as Done
2. **Edge case:** Filter returns no results, show empty state
3. **Error case:** Network error saving issue, show retry option

---

## Files

| File | Actie | Beschrijving |
|------|-------|--------------|
| `src/bridge/log-server.ts` | Modify | Add /api/issues endpoints |
| `frontends/portal/src/pages/system/Projects.tsx` | Create | Project management page |
| `frontends/portal/src/components/widgets/KanbanBoard.tsx` | Create | Drag-drop board |
| `frontends/portal/src/components/widgets/IssueCard.tsx` | Create | Issue card component |
| `frontends/portal/src/components/forms/IssueForm.tsx` | Create | Create/edit form |
| `frontends/portal/src/components/panels/IssueDetail.tsx` | Create | Detail slide-over |
| `frontends/portal/src/hooks/useIssues.ts` | Create | Issues data hook |
| `frontends/portal/src/hooks/useProjects.ts` | Create | Projects data hook |

---

## Lees Eerst

> **Voor de agent die dit bouwt:**

### Workflow
- `_prd/workflows/AGENT.md`

### Architecture
- `_prd/architecture/overview.md`
- `_prd/brainstorm/portal.md` (Section 3.2: Project Management)

### Dependencies
- `@dnd-kit/core` for drag-and-drop
- TanStack Table for list view

### Linear Reference
- https://linear.app/features
- Focus on: minimal UI, information density, keyboard shortcuts

---

## Implementation

### Wat is gebouwd

**Backend API (src/bridge/log-server.ts):**
- `GET /api/projects` - List all projects with identifier, name, color
- `GET /api/cycles` - List all cycles with status, dates
- `GET /api/labels` - List all labels
- `GET /api/issues` - List issues with filters (project, cycle, state, priority, search)
- `POST /api/issues` - Create new issue with auto-generated identifier (e.g., POR-1)
- `PATCH /api/issues/:id` - Update issue fields (state, priority, title, description, cycleId)

**Frontend (frontends/portal/src/pages/system/Projects.tsx):**
- Board view: 5-column Kanban layout with horizontal scroll
- List view: Table view with all issue details
- Filters: Cycle, Project, State, Priority dropdowns
- Search: Real-time title/description filtering
- Issue Card: Shows identifier, title, priority badge, project badge, labels
- Detail Panel: Slide-over panel for editing issue details
- Create Dialog: Modal form for creating new issues
- Priority badges: Urgent/High/Medium/Low with color coding
- Project badges: Color-coded by project
- Drag-and-drop: Move issues between columns with @dnd-kit

**UI Components Added:**
- `Dialog` - Modal dialog component
- `Label` - Form label component  
- `Textarea` - Multi-line text input

**Navigation:**
- Added Projects link to Sidebar with FolderKanban icon

**Dependencies Added:**
- `@dnd-kit/core` - Drag and drop primitives
- `@dnd-kit/sortable` - Sortable list support
- `@dnd-kit/utilities` - DnD utilities

### Beslissingen

1. **Drag-and-drop with @dnd-kit**: Full drag-and-drop using @dnd-kit. Cards are draggable from anywhere (cursor changes to grab). Drop zones highlight on hover with amber ring. Supports:
   - Moving between columns (changes state)
   - Reordering within a column (changes position)
   - Dropping on another issue places the dragged issue before that issue
   - Dropping on the "Drop here" zone at the bottom places the issue at the end
   - Optimistic UI updates with server sync

2. **Position system**: Each issue has a `position` field for manual ordering. Positions are calculated as fractional values between existing issues (similar to Linear's approach), avoiding the need to update multiple rows on reorder. A dedicated bottom drop zone ensures issues can always be moved to the end of a column.

3. **Auto-generated identifiers**: Issues get identifiers like POR-1, POR-2 based on project prefix and sequential count.

4. **In-memory filtering**: All issues loaded once, filtering done client-side for responsiveness.

4. **Unified hooks**: Single `useIssues()` hook handles fetching, updating, and creating with automatic refetch.

5. **Schema alignment**: Removed `assigned_to` from queries since it's not in the database schema.
