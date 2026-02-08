# F71: Portal Triage Inbox

> **Priority:** 🟡 P2
> **Status:** 📝 Spec
> **Owner:** -

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

- [ ] Inbox shows unprocessed triage items
- [ ] Items sorted by creation date (newest first)
- [ ] Each item shows title, description preview, source
- [ ] "New" button opens quick-add form
- [ ] Convert opens issue creation form with pre-filled data
- [ ] Snooze shows duration options
- [ ] Archive moves item out of inbox
- [ ] Empty state shows friendly message + CTA
- [ ] Processed items view shows archived/snoozed items

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

### Beslissingen
