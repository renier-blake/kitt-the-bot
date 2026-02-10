# KITT Portal — Product Specification

> **Status:** 📝 Specification Phase  
> **Scope:** KITT (System) — Phase 1  
> **Language:** English (all UI, labels, documentation)  
> **Last Updated:** 8 Feb 2026

---

## 1. Vision

A single management portal with two distinct areas:

```
┌─────────────────────────────────────────────────────────────────┐
│  🚗 KITT (System)          │  👤 Renier (Personal)              │
│  ──────────────────────────┼──────────────────────────────────  │
│  • System Health           │  • Nutrition Dashboard (F60)       │
│  • Project Management      │  • Training Dashboard              │
│  • Database Explorer       │  • Health Overview                 │
│  • Task Engine Monitor     │  • Reflections                     │
│  • Live Logs               │  • Weight/Body Composition         │
└─────────────────────────────────────────────────────────────────┘
```

**Phase 1:** Build KITT (System) side first.  
**Phase 2:** Add Renier (Personal) dashboards later.

---

## 2. Design Philosophy

### 2.1 Linear-Inspired Workflow

We adopt Linear's approach to project management:

| Linear Concept | Our Implementation |
|---------------|-------------------|
| **Cycles** | Development sprints (1-4 weeks) |
| **Issues** | Features, bugs, improvements |
| **States** | Backlog → Todo → In Progress → Done / Canceled |
| **Triage** | Inbox for new unprocessed ideas |
| **Projects** | Thematic groupings (e.g., "Portal", "Skills", "Infrastructure") |
| **Views** | Saved filters ("My Issues", "This Cycle", "Backlog") |

**Why Linear:**
- Minimal UI, maximum information density
- Opinionated workflow (less decision fatigue)
- Keyboard-first (Cmd+K for everything)
- Fast, snappy interactions

### 2.2 UI Patterns (Consistent Across All Dashboards)

Every dashboard follows the same structure:

```
┌─────────────────────────────────────────────────────────────────┐
│  Header                                                    [?]  │
│  ├── Title + Breadcrumb                                         │
│  ├── Primary Action Button                                      │
│  └── Last Updated Timestamp                                     │
├─────────────────────────────────────────────────────────────────┤
│  Filter Bar                                                     │
│  ├── Time Period (Today/Week/Month/Custom)                      │
│  ├── Search/Keyword Filter                                      │
│  ├── Status/Priority Filters                                    │
│  └── View Toggles (List/Grid/Kanban)                            │
├─────────────────────────────────────────────────────────────────┤
│  Content                                                        │
│  ├── Loading State (skeleton)                                   │
│  ├── Empty State (illustrated, with CTA)                        │
│  └── Data View (table, cards, or kanban)                        │
├─────────────────────────────────────────────────────────────────┤
│  Detail Panel (slide-over or modal)                             │
│  ├── Full record details                                        │
│  ├── Edit capabilities                                          │
│  └── Related data                                               │
└─────────────────────────────────────────────────────────────────┘
```

### 2.3 Visual Design System

**Colors:**
```css
/* Primary */
--kitt-primary: #FF9900;        /* Knight Rider amber */
--kitt-primary-hover: #FFB340;

/* Background */
--bg-base: #0a0a0a;
--bg-surface: #141414;
--bg-elevated: #1f1f1f;

/* Border */
--border-subtle: #262626;
--border-default: #404040;

/* Text */
--text-primary: #fafafa;
--text-secondary: #a3a3a3;
--text-tertiary: #737373;

/* Status Colors */
--status-backlog: #6b7280;
--status-todo: #3b82f6;
--status-in-progress: #f59e0b;
--status-done: #22c55e;
--status-canceled: #ef4444;

/* Priority */
--priority-high: #ef4444;
--priority-medium: #f59e0b;
--priority-low: #6b7280;
```

**Typography:**
- **Font:** Inter (or system-ui fallback)
- **Sizes:** 12px (labels), 14px (body), 16px (headings), 24px (page titles)
- **Weights:** 400 (normal), 500 (medium), 600 (semibold)

**Spacing:**
- **Base unit:** 4px
- **Common:** 4, 8, 12, 16, 24, 32, 48

**Components:**
- **Buttons:** 6px border-radius, subtle borders
- **Cards:** 8px border-radius, bg-surface, border-subtle
- **Inputs:** 6px border-radius, focus ring in primary color
- **Tables:** Compact density, hover states, sortable headers

---

## 3. KITT (System) — Dashboards

### 3.1 System Health Dashboard

**Purpose:** Real-time visibility into KITT's operational status.

**Widgets:**

| Widget | Data Source | Status Indicators |
|--------|-------------|-------------------|
| **Bridge Status** | WebSocket connection state | 🟢 Connected / 🔴 Disconnected |
| **Think Loop** | Last tick timestamp, tick duration | 🟢 Running / 🟡 Slow / 🔴 Stalled |
| **API Endpoints** | Health checks (Garmin, Telegram, etc.) | 🟢 Healthy / 🟡 Degraded / 🔴 Down |
| **Memory Usage** | Node.js process stats | Progress bar + percentage |
| **Token Usage** | Anthropic API calls (if trackable) | Today's count + trend |
| **Error Rate** | Log analysis (errors/minute) | Sparkline + current value |

**Layout:**
```
┌─────────────┬─────────────┬─────────────┬─────────────┐
│   Bridge    │ Think Loop  │  API Health │    Errors   │
│   Status    │   Health    │             │   (graph)   │
├─────────────┴─────────────┴─────────────┴─────────────┤
│                   Recent Errors Table                  │
│   [Timestamp] [Component] [Level] [Message]           │
└────────────────────────────────────────────────────────┘
```

### 3.2 Project Management Dashboard (Linear-Style)

**Purpose:** Manage features, bugs, and improvements using Linear's workflow.

**Database Schema:**

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

**Views:**

1. **Board View (Kanban)**
   - Columns: Backlog | Todo | In Progress | Done | Canceled
   - Cards show: Identifier, Title, Priority dot, Project color
   - Drag-and-drop between columns

2. **List View**
   - Table with sortable columns
   - Filters: Project, Cycle, State, Priority, Assignee

3. **Roadmap View**
   - Timeline showing issues by cycle
   - Projects as swimlanes

4. **Triage Inbox**
   - List of unprocessed ideas
   - Quick actions: "Create Issue", "Archive", "Snooze"

**Integration with Existing Workflow:**
- Feature specs in `_prd/features/F##_*.md` sync to Issues
- When agent marks feature "Done", update Issue state
- PO workflow creates/updates Issues

### 3.3 Database Explorer (Enhanced)

**Purpose:** Browse, search, and inspect the KITT database.

**Features:**

| Feature | Current | Enhanced |
|---------|---------|----------|
| Table list | ✅ | ✅ + row counts |
| Browse rows | ✅ | ✅ + pagination |
| **Row detail view** | ❌ | ✅ Slide-over panel |
| **Filters** | ❌ | ✅ Column filters, period filters |
| **Sorting** | ❌ | ✅ Click headers |
| **Search** | ❌ | ✅ Keyword + semantic search |
| **Export** | ❌ | ✅ CSV, JSON |

**UI Structure:**
```
┌─────────────────────────────────────────────────────────────────┐
│  Database Explorer                                      [⚙️]   │
├──────────────┬──────────────────────────────────────────────────┤
│              │  Filter Bar                                       │
│  Tables      │  ├── Table: [transcripts ▼]                      │
│  ──────────  │  ├── Period: [Today ▼]                           │
│  transcripts │  ├── Search: [__________] 🔍                      │
│  kitt_tasks  │  └── Filters: [role=user ▼] [type=message ▼]     │
│  chunks      │                                                   │
│  ...         │  ┌─────────────────────────────────────────────┐  │
│              │  │ id │ role │ type │ content      │ time    │  │
│              │  ├────┼──────┼──────┼──────────────┼─────────┤  │
│              │  │ 1  │ user │ msg  │ Hey KITT...  │ 14:32   │  │
│              │  │ 2  │ kitt │ task │ Reminder...  │ 14:33   │  │
│              │  └────┴──────┴──────┴──────────────┴─────────┘  │
│              │                                                   │
│              │  [Previous] Page 1 of 23 [Next]    [100/page ▼]   │
└──────────────┴──────────────────────────────────────────────────┘
```

**Row Detail Panel (Slide-over):**
- All columns in readable format
- JSON/metadata prettified
- Related records (foreign key navigation)
- Edit button (for authorized fields)

### 3.4 Task Engine Dashboard

**Purpose:** Monitor and manage KITT's scheduled tasks and their execution history.

**Tabs:**

1. **Tasks** — The task definitions
   - All tasks from `kitt_tasks` table
   - Edit: priority, time window, snooze
   - Toggle active/inactive
   - Create new task

2. **Executions** — What ran and when
   - Query `transcripts` where `role='task'`
   - Filters: Date range, Task, Status (sent/completed/skipped)
   - Shows: Task title, Execution time, Status, Reason (if skipped)

3. **Reminders** — What was sent to Renier
   - Filter transcripts for reminder-type messages
   - Shows: Content, Time, Channel (Telegram)

4. **Schedule** — Calendar view
   - Visual overview of upcoming tasks
   - Color-coded by priority

**Database:** Uses existing `kitt_tasks` and `transcripts` tables.

### 3.5 Live Logs

**Purpose:** Real-time log streaming from the KITT bridge.

**Current State:** Already implemented (F48)

**Enhancements:**
- Better filtering (multi-select log levels)
- Search within logs
- Pause/Resume with keyboard (Space)
- Timestamp formatting options
- Export current view

---

## 4. Technical Architecture

### 4.1 Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **Framework** | React + Vite | Fast dev, great DX, agent-friendly |
| **UI Library** | shadcn/ui | Copy-paste components, full control |
| **Styling** | Tailwind CSS | Utility-first, dark mode easy |
| **State** | React Query | Server state management |
| **Routing** | React Router | Simple, effective |
| **Charts** | Recharts | React-native, customizable |
| **Tables** | TanStack Table | Powerful, sortable, filterable |

### 4.2 Project Structure

```
frontends/portal/
├── src/
│   ├── components/
│   │   ├── ui/              # shadcn components
│   │   ├── layout/          # Sidebar, Header, PageShell
│   │   └── widgets/         # Reusable data widgets
│   │       ├── HealthCard.tsx
│   │       ├── StatSparkline.tsx
│   │       ├── LogStream.tsx
│   │       ├── DataTable.tsx
│   │       └── KanbanBoard.tsx
│   │
│   ├── pages/
│   │   ├── system/
│   │   │   ├── Health.tsx
│   │   │   ├── Projects.tsx
│   │   │   ├── Database.tsx
│   │   │   ├── Tasks.tsx
│   │   │   └── Logs.tsx
│   │   └── personal/        # Future: Nutrition, Training, etc.
│   │
│   ├── hooks/
│   │   ├── useHealth.ts
│   │   ├── useIssues.ts
│   │   ├── useDatabase.ts
│   │   └── useLogs.ts
│   │
│   ├── lib/
│   │   ├── api.ts           # API client
│   │   ├── utils.ts         # cn() and helpers
│   │   └── constants.ts     # Colors, thresholds
│   │
│   ├── types/
│   │   └── index.ts
│   │
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
│
├── components.json          # shadcn config
├── tailwind.config.js
├── vite.config.ts
└── package.json
```

### 4.3 API Layer

Existing endpoints (from current portal):
- `GET /api/status` — Bridge health
- `GET /api/db/tables` — List tables
- `GET /api/db/query` — Execute queries
- `WS /ws/logs` — Live logs

New endpoints needed:
- `GET /api/health` — System health metrics
- `GET /api/projects` — List projects
- `GET /api/issues` — List/filter issues
- `POST /api/issues` — Create issue
- `PATCH /api/issues/:id` — Update issue
- `GET /api/cycles` — List cycles
- `GET /api/tasks` — List tasks
- `GET /api/task-executions` — Task history

### 4.4 Database Migrations

Migration file: `src/db/migrations/004-portal.sql`

Contains:
- `portal_projects`
- `portal_cycles`
- `portal_issues`
- `portal_issue_history`
- `portal_labels`
- `portal_issue_labels`
- `portal_triage`

---

## 5. Feature Breakdown

### Phase 1: Foundation

| ID | Feature | Priority | Depends On |
|----|---------|----------|------------|
| F63 | Portal Framework Setup | P0 | — |
| F64 | System Health Dashboard | P0 | F63 |
| F65 | Enhanced Database Explorer | P1 | F63 |
| F66 | Task Engine Dashboard | P1 | F63 |
| F67 | Live Logs Enhancement | P2 | — (exists) |

### Phase 2: Project Management

| ID | Feature | Priority | Depends On |
|----|---------|----------|------------|
| F68 | Linear-Style Project DB | P1 | — |
| F69 | Project Management UI | P1 | F63, F68 |
| F70 | Triage Inbox | P2 | F69 |
| F71 | Roadmap View | P2 | F69 |

### Phase 3: Integration

| ID | Feature | Priority | Depends On |
|----|---------|----------|------------|
| F72 | Feature Spec Sync | P2 | F69 |
| F73 | Workflow Automation | P3 | F72 |

---

## 6. UI Mockups

### 6.1 System Health

```
┌─────────────────────────────────────────────────────────────────┐
│  🚗 KITT Portal                           [System ▼]    [👤]   │
├─────────────────────────────────────────────────────────────────┤
│  System Health                                          [↻]   │
│  Last updated: 2 seconds ago                                    │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌────────┐ │
│  │   Bridge     │ │  Think Loop  │ │  API Status  │ │ Errors │ │
│  │              │ │              │ │              │ │        │ │
│  │    🟢        │ │     🟢       │ │    🟢🟢🟡    │ │  0/min │ │
│  │  Connected   │ │   Running    │ │  5/6 Healthy │ │  ───── │ │
│  │  2h 14m      │ │  Last: 30s   │ │  See details │ │        │ │
│  └──────────────┘ └──────────────┘ └──────────────┘ └────────┘ │
├─────────────────────────────────────────────────────────────────┤
│  Recent Errors                                                  │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ Time     │ Component  │ Level │ Message                   │ │
│  ├──────────┼────────────┼───────┼───────────────────────────┤ │
│  │ 14:32:05 │ garmin     │ WARN  │ Rate limit approaching    │ │
│  │ 14:15:22 │ telegram   │ ERROR │ Connection timeout        │ │
│  └───────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### 6.2 Project Management (Board View)

```
┌─────────────────────────────────────────────────────────────────┐
│  Projects                                               [+ New] │
├─────────────────────────────────────────────────────────────────┤
│  Cycle: [Cycle 1 ▼]  Project: [All ▼]  Search: [________] [⚙️]  │
├──────────────┬──────────────┬──────────────┬──────────────┬─────┤
│   Backlog    │    Todo      │ In Progress  │    Done      │ Can │
│     12       │     5        │     3        │    18        │  2  │
├──────────────┼──────────────┼──────────────┼──────────────┼─────┤
│ POR-43       │ POR-38       │ POR-42       │ POR-30       │     │
│ ──────       │ ──────       │ ──────       │ ──────       │     │
│ Database     │ System       │ Kanban       │ Framework    │     │
│ filters      │ Health       │ Board        │ Setup        │     │
│              │ Dashboard    │ Component    │              │     │
│ 🔴 High      │ 🟡 Medium    │ 🟢 Low       │              │     │
│ [Portal]     │ [Portal]     │ [Portal]     │              │     │
├──────────────┼──────────────┼──────────────┼──────────────┼─────┤
│ POR-44       │ POR-39       │ POR-41       │              │     │
│ Search       │ Token        │ API Health   │              │     │
│ Function     │ Usage Widget │ Checks       │              │     │
│              │              │              │              │     │
│ 🟡 Medium    │ 🟡 Medium    │ 🔴 High      │              │     │
│ [Portal]     │ [Portal]     │ [Portal]     │              │     │
└──────────────┴──────────────┴──────────────┴──────────────┴─────┘
```

---

## 7. Next Steps

1. **Review this specification** — Feedback on scope, priorities
2. **Create Feature F63** — Portal Framework Setup
3. **Design decision** — Confirm shadcn/ui + React + Vite
4. **Database migration** — Create portal tables (F68)

---

## 8. Appendix

### 8.1 Linear Concepts Reference

| Term | Definition | Our Equivalent |
|------|-----------|--------------|
| **Issue** | Unit of work (feature, bug, etc.) | `portal_issues` row |
| **State** | Workflow position | `state` column |
| **Cycle** | Time-boxed sprint | `portal_cycles` row |
| **Project** | Thematic collection | `portal_projects` row |
| **Triage** | Unprocessed inbox | `portal_triage` table |
| **View** | Saved filter set | URL query params |
| **Identifier** | Unique issue code | `POR-42`, `SKL-7` |

### 8.2 State Machine

```
Backlog ─────┐
             │
             ▼
Canceled ◄── Todo ───► In Progress ───► Done
  ▲                                          │
  └──────────────────────────────────────────┘
         (can reopen)
```

### 8.3 Priority Levels

| Level | Meaning | Response Time |
|-------|---------|---------------|
| High | Blocks work, critical bug | Same day |
| Medium | Important, planned work | This cycle |
| Low | Nice to have, tech debt | Future cycle |
