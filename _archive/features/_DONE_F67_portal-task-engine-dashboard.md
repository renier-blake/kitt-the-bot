# F67: Portal Task Engine Dashboard

> **Priority:** 🟠 P1
> **Status:** ✅ Done
> **Owner:** -

---

## Overview

A comprehensive dashboard for monitoring and managing KITT's Task Engine. View all tasks, their execution history, reminders sent, and upcoming schedule in a calendar view.

---

## User Stories

**US-01:** As Renier, I want to see all configured tasks, so I know what KITT is scheduled to do.

**US-02:** As Renier, I want to see which tasks ran today and their status, so I can verify execution.

**US-03:** As Renier, I want to see what reminders were sent, so I can track KITT's proactive messages.

**US-04:** As Renier, I want to snooze or disable tasks, so I can control KITT's behavior.

**US-05:** As Renier, I want to see upcoming tasks in a calendar, so I can anticipate notifications.

---

## Componenten

| Component | Nodig | Beschrijving |
|-----------|-------|--------------|
| Skill | ❌ | - |
| Task | ❌ | - |
| Schema | ❌ | - (uses existing kitt_tasks) |
| Backend | ✅ | New /api/tasks and /api/task-executions endpoints |
| Portal | ✅ | Task engine dashboard with 4 tabs |

---

## Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  Task Engine Dashboard                                           │
│                                                                  │
│  [Tasks] [Executions] [Reminders] [Schedule]              [+ New]│
│                                                                  │
│  Tab 1: Tasks                                                    │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ Title        │ Freq  │ Priority │ Window    │ Status │ Actions│
│  ├──────────────┼───────┼──────────┼───────────┼────────┼───────┤│
│  │ Ontbijt check│ daily │ low      │ 07:00-11: │ active │ [🔕][✏️]│
│  │ Lunch check  │ daily │ low      │ 11:30-15: │ active │ [🔕][✏️]│
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  Tab 2: Executions                                               │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ Time    │ Task         │ Status   │ Reason/Output         │  │
│  ├─────────┼──────────────┼──────────┼───────────────────────┤  │
│  │ 14:30   │ Ontbijt check│ skipped  │ Already logged        │  │
│  │ 11:45   │ Lunch check  │ sent     │ Message sent          │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  Tab 3: Schedule (Calendar View)                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │        Mon     Tue     Wed     Thu     Fri                │  │
│  │ 07:00  [🍳]    [🍳]    [🍳]    [🍳]    [🍳]               │  │
│  │ 12:00  [🥗]    [🥗]    [🥗]    [🥗]    [🥗]               │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Backend API

**GET /api/tasks**
```json
[
  {
    "id": 1,
    "title": "Ontbijt check",
    "description": "Check if breakfast is logged",
    "frequency": "daily",
    "priority": "low",
    "timeWindowStart": "07:00",
    "timeWindowEnd": "11:00",
    "skillRefs": ["nutrition-log"],
    "active": true,
    "snoozedUntil": null
  }
]
```

**GET /api/task-executions?from={date}&to={date}**
```json
[
  {
    "id": "uuid",
    "taskId": 1,
    "taskTitle": "Ontbijt check",
    "executedAt": "2026-02-08T14:30:00Z",
    "status": "skipped",
    "reason": "Already logged"
  }
]
```

**PATCH /api/tasks/:id**
```json
{ "snoozedUntil": 1707400800000, "active": false }
```

---

## Acceptance Criteria

- [x] Tasks tab shows all tasks from kitt_tasks table
- [x] Can toggle task active/inactive status
- [x] Can snooze task with duration picker (30min, 1h, 4h, 1d)
- [x] Can unsnooze task
- [x] Executions tab shows task history with period filters
- [x] Schedule tab shows task times sorted by start time
- [x] Period filters work (Today/Week/Month)
- [x] Priority badges use appropriate colors (high=red, medium=yellow, low=green)
- [x] Status badges use appropriate colors
- [x] Stats cards show task overview
- [x] Auto-refresh every 30 seconds
- [ ] Can create new task via form (future)
- [ ] Can edit existing task details (future)

---

## Test Cases

1. **Happy path:** View tasks, snooze one, verify it's reflected in list
2. **Edge case:** Task with no time window shows "Any time"
3. **Error case:** Creating task with invalid data shows validation errors

---

## Files

| File | Actie | Beschrijving |
|------|-------|--------------|
| `src/bridge/log-server.ts` | Modify | Add /api/tasks endpoints |
| `frontends/portal/src/pages/system/Tasks.tsx` | Create | Task engine dashboard |
| `frontends/portal/src/components/widgets/TaskList.tsx` | Create | Task list component |
| `frontends/portal/src/components/widgets/TaskCalendar.tsx` | Create | Weekly calendar view |
| `frontends/portal/src/components/forms/TaskForm.tsx` | Create | Create/edit task form |
| `frontends/portal/src/hooks/useTasks.ts` | Create | Tasks data hook |

---

## Lees Eerst

> **Voor de agent die dit bouwt:**

### Workflow
- `_prd/workflows/AGENT.md`

### Architecture
- `_prd/architecture/overview.md`
- `_prd/brainstorm/portal.md` (Section 3.4: Task Engine Dashboard)
- `_prd/features/F51-task-engine.md` (Task Engine architecture)

### Bestaande Code
- `src/scheduler/task-engine.ts` (task logic)
- `src/memory/schema.ts` (kitt_tasks table)

---

## Implementation

### Wat is gebouwd

**Backend:**
- `/api/tasks` endpoint — Returns all tasks from kitt_tasks table with full details
- `/api/tasks/:id` PATCH endpoint — Update task (toggle active, snooze/unsnooze)
- `/api/task-executions` endpoint — Returns task execution history with period filter
- `/api/tasks/stats` endpoint — Returns task statistics (total, active, executions today, status breakdown)

**Frontend:**
- Completely rebuilt `Tasks.tsx` with tabbed interface
- **Stats cards:** Total Tasks (with active count), Executed Today, Skipped Today, Reminders
- **Tasks tab:** 
  - List of all tasks with frequency icons (📅📆🗓️⏱️)
  - Priority badges (high/medium/low with colors)
  - Time window display
  - Snooze dropdown (30min, 1h, 4h, 1d)
  - Unsnooze button for snoozed tasks
  - Pause/Resume button to toggle active status
- **Executions tab:**
  - Table with all task executions
  - Period filter (Today/Week/Month)
  - Status badges (reminder/completed/skipped/deferred)
  - Notes/truncated content
- **Schedule tab:**
  - Simple list view of active tasks
  - Sorted by time window start
  - Shows frequency, time window, priority

**New Components:**
- `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` (shadcn/ui)
- Custom `Badge` component for priority/status colors

**API Client:**
- Added `getTasks()`, `updateTask()`, `getTaskExecutions()`, `getTaskStats()` methods

### Beslissingen

1. **List view over form-based editing:** First iteration focuses on monitoring and simple controls (snooze/toggle). Full task creation/editing can be added later.

2. **Snooze presets:** Common durations (30min, 1h, 4h, 1d) as dropdown instead of custom input for faster interaction.

3. **Auto-refresh:** 30 second interval keeps data fresh without overwhelming the server.

4. **Simple schedule view:** List sorted by time instead of calendar grid — faster to implement and clearer for daily overview.

5. **Executions from transcripts:** Task execution history is read from transcripts table where type='task', avoiding separate table.
