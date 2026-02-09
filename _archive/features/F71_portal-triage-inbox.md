# F71: Portal Triage Inbox

> **Priority:** 🟡 P2
> **Status:** ✅ Done
> **Owner:** Agent
> **Completed:** 2026-02-08

---

## Overview

A dedicated inbox for unprocessed ideas, feature requests, and observations. Inspired by Linear's Triage feature, this provides a workflow for reviewing and converting raw ideas into properly scoped issues.

---

## User Stories

**US-01:** As Renier, I want to quickly jot down ideas, so I don't forget them.

**US-02:** As Renier, I want to review ideas in an inbox, so I can decide what to work on.

**US-03:** As Renier, I want to convert an idea to an issue, so it enters the workflow.

**US-04:** As Renier, I want to archive ideas I'm not pursuing, so the inbox stays clean.

**US-05:** As Renier, I want to snooze ideas, so they reappear later.

---

## Componenten

| Component | Nodig | Beschrijving |
|-----------|-------|--------------|
| Skill | ❌ | - |
| Task | ❌ | - |
| Schema | ❌ | (uses portal_triage from F69) |
| Backend | ✅ | REST API for triage operations |
| Portal | ✅ | Triage inbox UI |

---

## Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  Triage Inbox                                          [+ New] │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ Title                              Source      Actions    │  │
│  ├───────────────────────────────────────────────────────────┤  │
│  │ Add workout tracking dashboard     conversation [✓][⏸][✕]│  │
│  │                                                                  │
│  │ "Would be cool to see my training  │                         │  │
│  │  progress over time..."            │                         │  │
│  ├───────────────────────────────────────────────────────────┤  │
│  │ Improve error messages in logs     observation [✓][⏸][✕]│  │
│  │                                                                  │
│  │ When Garmin API fails, show        │                         │  │
│  │ better context...                  │                         │  │
│  ├───────────────────────────────────────────────────────────┤  │
│  │ Export to PDF feature              idea        [✓][⏸][✕]│  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  [Convert to Issue] → opens project/issue form                   │
│  [Snooze] → pick duration (1 day, 1 week, 1 month)               │
│  [Archive] → mark as processed without creating issue            │
└─────────────────────────────────────────────────────────────────┘
```

---

## Backend API

**GET /api/triage?processed=false**
```json
[
  {
    "id": 1,
    "title": "Add workout tracking dashboard",
    "description": "Would be cool to see my training progress over time...",
    "source": "conversation",
    "createdAt": "2026-02-08T10:00:00Z"
  }
]
```

**POST /api/triage**
```json
{ "title": "...", "description": "...", "source": "idea" }
```

**POST /api/triage/:id/convert**
```json
{ "projectId": 1, "priority": "medium", "type": "feature" }
```
Response: `{ "issueId": 42, "identifier": "POR-12" }`

**PATCH /api/triage/:id**
```json
{ "processed": true, "snoozedUntil": 1708000800000 }
```

---

## Quick Actions

Each triage item has three quick action buttons:

| Button | Action | Result |
|--------|--------|--------|
| ✓ | Convert | Opens dialog to create issue from this idea |
| ⏸ | Snooze | Dropdown: 1 day / 1 week / 1 month / custom |
| ✕ | Archive | Marks as processed, no issue created |

---

## Acceptance Criteria

- [x] Inbox shows unprocessed triage items
- [x] Items sorted by creation date (newest first)
- [x] Each item shows title, description preview, source
- [x] "New" button opens quick-add form
- [x] Convert opens issue creation form with pre-filled data
- [x] Snooze shows duration options (1 day, 1 week, 1 month)
- [x] Archive moves item out of inbox
- [x] Empty state shows friendly message + CTA
- [x] Processed items view shows archived/snoozed items

---

## Test Cases

1. **Happy path:** Add idea → Convert to issue → Verify issue created
2. **Edge case:** Snooze item, verify it reappears after duration
3. **Error case:** Try to convert with missing required fields, validation shown

---

## Files

| File | Actie | Beschrijving |
|------|-------|--------------|
| `src/bridge/log-server.ts` | Modify | Add /api/triage endpoints |
| `frontends/portal/src/pages/system/Triage.tsx` | Create | Triage inbox page |
| `frontends/portal/src/components/forms/TriageForm.tsx` | Create | Quick-add form |
| `frontends/portal/src/components/forms/ConvertToIssue.tsx` | Create | Convert dialog |
| `frontends/portal/src/hooks/useTriage.ts` | Create | Triage data hook |

---

## Lees Eerst

> **Voor de agent die dit bouwt:**

### Workflow
- `_prd/workflows/AGENT.md`

### Architecture
- `_prd/architecture/overview.md`
- `_prd/brainstorm/portal.md` (Section 3.2: Triage Inbox)

### Bestaande Code
- `frontends/portal/src/components/forms/IssueForm.tsx` (from F70)

---

## Implementation

### Wat is gebouwd

**Backend API (src/bridge/log-server.ts):**
- `GET /api/triage?processed=false` - List unprocessed triage items (snoozed items excluded until snooze expires)
- `POST /api/triage` - Create new triage item from idea/conversation/observation
- `POST /api/triage/:id/convert` - Convert triage item to issue with project/priority/type selection
- `PATCH /api/triage/:id` - Update item (archive by setting processed=true, snooze by setting snoozedUntil)

**Database Schema (v15):**
- Added `snoozed_until` column to `portal_triage` table for snooze functionality

**Frontend (frontends/portal/src/pages/system/Triage.tsx):**
- Triage inbox page with two views: Inbox (unprocessed) and Processed (archived/snoozed)
- Triage item cards showing title, description preview, source badge, creation date
- Quick action buttons: Convert (✓), Snooze (⏸), Archive (✕)
- Create dialog for quickly adding new ideas
- Convert dialog with project, type, priority, and cycle selection
- Snooze dropdown with 1 day / 1 week / 1 month options
- Empty state with friendly message and CTA button

**Navigation:**
- Added Triage link to Sidebar with Inbox icon

### Beslissingen

1. **Snooze mechanism**: Items can be snoozed for 1 day, 1 week, or 1 month. Snoozed items are hidden from inbox until the snooze period expires, at which point they reappear automatically.

2. **Source tracking**: Triage items track their source (conversation, observation, idea, manual) with appropriate icons for quick visual identification.

3. **Two-view system**: Instead of a single list, we use two tabs - "Inbox" for items needing attention and "Processed" for archived/converted/snoozed items.

4. **Convert pre-fill**: When converting a triage item to an issue, the title and description are pre-filled from the triage item, making the workflow seamless.
