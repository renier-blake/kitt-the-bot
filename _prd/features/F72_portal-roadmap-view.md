# F72: Portal Roadmap View

> **Priority:** 🟡 P2
> **Status:** 📝 Spec
> **Owner:** -

---

## Overview

A timeline/roadmap view showing issues across cycles. Visualizes the project timeline with projects as swimlanes or color-coded lanes. Helps plan work across multiple cycles.

---

## User Stories

**US-01:** As Renier, I want to see issues plotted on a timeline, so I can visualize the roadmap.

**US-02:** As Renier, I want to see multiple cycles, so I can plan future work.

**US-03:** As Renier, I want to see projects as swimlanes, so I can track progress per project.

**US-04:** As Renier, I want to drag issues between cycles, so I can reschedule work.

---

## Componenten

| Component | Nodig | Beschrijving |
|-----------|-------|--------------|
| Skill | ❌ | - |
| Task | ❌ | - |
| Schema | ❌ | (uses existing tables from F69) |
| Backend | ✅ | Extend /api/issues with date filtering |
| Portal | ✅ | Timeline/Roadmap visualization |

---

## Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  Roadmap                                               [⚙️ View] │
│                                                                  │
│  Show: [3 months ▼]  Group by: [Project ▼]  [Today]             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│           Jan 2026              Feb 2026              Mar 2026  │
│  Portal   ├─────────────────────┼─────────────────────┤         │
│           │ [POR-38]            │ [POR-42]            │         │
│           │ System Health       │ Kanban Board        │         │
│           │ ████████░░░░░░░░░░░░│░░░░░░░░░░████████░░│         │
│           │                     │                     │         │
│  Skills   ├─────────────────────┼─────────────────────┤         │
│           │         [SKL-12]    │         [SKL-15]    │         │
│           │         New Skill   │         Refactor    │         │
│           │         ░░████████░░│░░░░░░░░░░░░████████│         │
│           │                     │                     │         │
│  Infra    ├─────────────────────┼─────────────────────┤         │
│           │ [INF-5]             │                     │         │
│           │ Database Migration  │                     │         │
│           │ ████████████████████│░░░░░░░░░░░░░░░░░░░░░│         │
│           │                     │                     │         │
│           │                     │         [INF-8]     │         │
│           │                     │         Logging     │         │
│           │                     │         ░░░░░░░░░░░░│████░░   │
│                                                                  │
│  Cycles:  [Cycle 1]========[Cycle 2]========[Cycle 3]           │
│              Jan              Feb              Mar              │
└─────────────────────────────────────────────────────────────────┘
```

---

## Backend API

Extend existing endpoints:

**GET /api/issues?from=2026-01-01&to=2026-03-31**
Returns issues within date range for timeline rendering.

**GET /api/cycles**
```json
[
  {
    "id": 1,
    "name": "Cycle 1",
    "startDate": "2026-01-01",
    "endDate": "2026-01-31",
    "status": "completed"
  },
  {
    "id": 2,
    "name": "Cycle 2",
    "startDate": "2026-02-01",
    "endDate": "2026-02-28",
    "status": "active"
  }
]
```

---

## Timeline Features

| Feature | Description |
|---------|-------------|
| **Time scales** | 1 month / 3 months / 6 months / 1 year |
| **Group by** | Project / Priority / None |
| **Zoom** | Drag to scroll, zoom in/out |
| **Today marker** | Vertical line showing current date |
| **Cycle markers** | Background shading per cycle |
| **Drag to move** | Drag issue to reschedule |
| **Drag to resize** | Drag edges to change duration |

---

## Acceptance Criteria

- [ ] Timeline shows months across top
- [ ] Projects shown as horizontal swimlanes
- [ ] Issues rendered as bars on timeline
- [ ] Bar width represents estimated duration
- [ ] Clicking issue opens detail panel
- [ ] Can drag issue to different date
- [ ] Can drag issue to different cycle
- [ ] Today button scrolls to current date
- [ ] Zoom controls change time scale
- [ ] Cycle boundaries shown as background shading

---

## Test Cases

1. **Happy path:** View 3-month roadmap, drag issue to next cycle
2. **Edge case:** Many issues in same time period, proper overlap handling
3. **Error case:** Issue without dates, shown in "Unscheduled" row

---

## Files

| File | Actie | Beschrijving |
|------|-------|--------------|
| `frontends/portal/src/pages/system/Roadmap.tsx` | Create | Roadmap view page |
| `frontends/portal/src/components/widgets/Timeline.tsx` | Create | Timeline component |
| `frontends/portal/src/components/widgets/TimelineItem.tsx` | Create | Draggable timeline item |
| `frontends/portal/src/hooks/useRoadmap.ts` | Create | Roadmap data hook |

---

## Lees Eerst

> **Voor de agent die dit bouwt:**

### Workflow
- `_prd/workflows/AGENT.md`

### Architecture
- `_prd/architecture/overview.md`
- `_prd/brainstorm/portal.md` (Section 3.2: Roadmap View)

### Dependencies
- `@dnd-kit/core` for drag-and-drop
- `date-fns` for date calculations

### Similar Tools
- Linear's Roadmap view
- GitHub Projects timeline
- Jira Roadmap

---

## Implementation

### Wat is gebouwd

### Beslissingen
