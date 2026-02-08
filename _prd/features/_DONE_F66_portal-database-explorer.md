# F66: Portal Database Explorer

> **Priority:** 🟠 P1
> **Status:** ✅ Done
> **Owner:** -

---

## Overview

An enhanced database explorer for browsing, searching, and inspecting the KITT SQLite database. Replaces the current basic viewer with a full-featured interface including filters, sorting, search, and a detail panel for viewing records.

---

## User Stories

**US-01:** As Renier, I want to browse database tables, so I can inspect KITT's data.

**US-02:** As Renier, I want to filter records by date range, so I can find recent data.

**US-03:** As Renier, I want to search within table content, so I can find specific records.

**US-04:** As Renier, I want to click a record to see all its details, so I can inspect the full data.

**US-05:** As Renier, I want to sort columns, so I can organize data by time or other fields.

---

## Componenten

| Component | Nodig | Beschrijving |
|-----------|-------|--------------|
| Skill | ❌ | - |
| Task | ❌ | - |
| Schema | ❌ | - |
| Backend | ✅ | Extend existing /api/db/* endpoints |
| Portal | ✅ | Database explorer page with table browser |

---

## Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  Database Explorer                                               │
│                                                                  │
│  ┌──────────┬────────────────────────────────────────────────┐  │
│  │ Tables   │ Filter Bar: [Table ▼] [Period ▼] [Search]     │  │
│  │ ───────  ├────────────────────────────────────────────────┤  │
│  │ transcripts│                                              │  │
│  │ kitt_tasks │  Data Table (sortable, paginated)           │  │
│  │ chunks   │  ┌────┬──────┬──────┬──────────┬─────────┐    │  │
│  │ ...      │  │ id │ role │ type │ content  │ time    │    │  │
│  │          │  ├────┼──────┼──────┼──────────┼─────────┤    │  │
│  │          │  │ 1  │ user │ msg  │ ...      │ 14:32   │──┐ │  │
│  │          │  │ 2  │ kitt │ task │ ...      │ 14:33   │  │ │  │
│  │          │  └────┴──────┴──────┴──────────┴─────────┘    │ │  │
│  │          │                                              │ │  │
│  │          │  [Previous] Page 1 of 23 [Next]              │ │  │
│  │          └────────────────────────────────────────────────┘ │  │
│  │                              │                              │  │
│  │                              ▼                              │  │
│  │                   ┌───────────────────┐                     │  │
│  │                   │ Detail Panel      │                     │  │
│  │                   │ (slide-over)      │                     │  │
│  │                   │ All fields shown  │                     │  │
│  │                   │ JSON prettified   │                     │  │
│  │                   └───────────────────┘                     │  │
│  └──────────┴────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Backend API

Existing endpoints to extend:
- `GET /api/db/tables` — List tables (add row counts)
- `GET /api/db/query` — Execute queries (add pagination)

New endpoints:
- `GET /api/db/search?q={query}&table={table}` — Semantic/keyword search

---

## Acceptance Criteria

- [x] Table list shows all database tables with row counts
- [x] Clicking a table shows its records in a data table
- [x] Data table supports sorting by clicking headers
- [x] Data table supports scrollable pagination (load more)
- [x] Period filter works (Today/Week/Month/All)
- [x] Search box filters records by keyword
- [x] Type/Channel/Role filters with dropdowns
- [x] Clicking a row opens detail panel with all fields
- [x] Detail panel shows JSON/metadata in formatted view
- [x] Color-coded badges for channel, role, type
- [x] Human-readable timestamps (created_at, etc.)
- [x] Hidden columns (id, metadata)
- [x] Reordered columns (created_at first)

---

## Test Cases

1. **Happy path:** Browse transcripts, filter by today, sort by time descending
2. **Edge case:** Table with 100k rows, pagination works smoothly
3. **Error case:** Invalid SQL query, proper error message shown

---

## Files

| File | Actie | Beschrijving |
|------|-------|--------------|
| `src/bridge/log-server.ts` | Modify | Add search endpoint, pagination |
| `frontends/portal/src/pages/system/Database.tsx` | Create | Database explorer page |
| `frontends/portal/src/components/widgets/DataTable.tsx` | Create | Reusable sortable table |
| `frontends/portal/src/components/widgets/DetailPanel.tsx` | Create | Slide-over detail view |
| `frontends/portal/src/hooks/useDatabase.ts` | Create | Database query hook |
| `frontends/portal/src/hooks/useSearch.ts` | Create | Search hook |

---

## Lees Eerst

> **Voor de agent die dit bouwt:**

### Workflow
- `_prd/workflows/AGENT.md`

### Architecture
- `_prd/architecture/overview.md`
- `_prd/brainstorm/portal.md` (Section 3.3: Database Explorer)

### Bestaande Code
- `src/bridge/log-server.ts` (existing DB endpoints)
- `src/memory/index.ts` (MemoryService for search)

### Dependencies
- TanStack Table for data tables
- date-fns for date formatting

---

## Implementation

### Wat is gebouwd

**Backend:**
- New `/api/db/tables` endpoint — Returns list of tables with row counts
- Extended `/api/db/table/:table` endpoint with:
  - Search functionality (keyword search across text columns)
  - Period filtering (today/week/month/all) for timestamp tables
  - Pagination with total count reflecting filters

**Frontend:**
- Completely rebuilt `Database.tsx` page with:
  - Table selector cards showing record counts
  - Search input with debounced filtering
  - Period filter dropdown (All Time, Today, Last 7 Days, Last 30 Days)
  - Per-page selector (10/25/50/100)
  - Data table with column headers
  - Pagination controls
  - Click-to-view detail panel

**New Components:**
- `DetailPanel.tsx` — Slide-over panel showing all fields of a record
  - Pretty-prints JSON objects
  - Truncates long values
  - Click outside or X button to close

- `Table`, `Input`, `Select` shadcn/ui components

**API Client:**
- Added `getTables()` method
- Extended `getTableData()` with search and period parameters

### Port Configuration Changes
As part of this feature, the port configuration was updated:
- **Bridge (Express):** Port 8000 (was 3000)
- **Portal Dev (Vite):** Port 3000 (was 5173)
- **Proxy:** Vite dev server proxies `/api` and `/ws` to port 8000

Updated in:
- `src/bridge/log-server.ts`
- `frontends/portal/vite.config.ts`
- `frontends/portal/src/lib/api.ts`
- `_prd/architecture/portal.md`
- `CLAUDE.md`

### Post-Implementation Enhancements (User Feedback)

Based on user testing, the following improvements were made:

1. **Color-coded badges:**
   - Channel: Telegram (blue), Team Club (green), Think Loop (purple)
   - Role: User (blue), KITT (amber)
   - Type: Message (green), Thought (purple), Task (orange)

2. **Column reordering:**
   - `created_at` moved to first position
   - `id` and `metadata` columns hidden
   - `session_id` kept visible

3. **Human-readable timestamps:**
   - Unix timestamps converted to "Feb 8, 14:30:45" format
   - Detail panel shows both formatted and raw values

4. **Client-side sorting:**
   - Click any column header to sort
   - Default sort: created_at descending
   - Visual indicators for sort direction

5. **Additional filters:**
   - Type filter dropdown
   - Channel filter dropdown
   - Role filter dropdown

6. **Scrollable pagination:**
   - Replaced page-based pagination with "Load more" button
   - Accumulates records as you load more
   - Table has max height with scrollbars
   - Sticky header stays visible during scroll

### Beslissingen

1. **Table cards instead of dropdown:** Visual cards show all tables at a glance with record counts, making it easy to see database size.

2. **Client-side filtering:** Type/Channel/Role filters work on already-loaded data for instant feedback.

3. **Scrollable over paginated:** Users prefer scrolling through data over clicking through pages. "Load more" gives control over data volume.

4. **Color coding:** Visual distinction between channels, roles, and types makes scanning easier.

5. **Port 3000 for dev server:** Standardizing on port 3000 for the portal dev server makes it easier to remember and bookmark.
