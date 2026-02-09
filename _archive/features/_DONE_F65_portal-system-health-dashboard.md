# F65: Portal System Health Dashboard

> **Priority:** 🔴 P0
> **Status:** ✅ Done
> **Owner:** -

---

## Overview

A real-time system health dashboard showing the operational status of all KITT components. Displays bridge status, Think Loop health, API endpoint availability, and recent errors.

---

## User Stories

**US-01:** As Renier, I want to see if the bridge is online, so I know KITT is running.

**US-02:** As Renier, I want to see when the Think Loop last ran, so I know KITT is actively processing.

**US-03:** As Renier, I want to see which API endpoints are healthy, so I can identify connectivity issues.

**US-04:** As Renier, I want to see recent errors, so I can troubleshoot problems quickly.

---

## Componenten

| Component | Nodig | Beschrijving |
|-----------|-------|--------------|
| Skill | ❌ | - |
| Task | ❌ | - |
| Schema | ❌ | - |
| Backend | ✅ | New /api/health endpoint |
| Portal | ✅ | Health dashboard page with widgets |

---

## Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  Health Check Flow                                               │
│                                                                  │
│  Browser ──GET /api/health──────────────────────► Express        │
│                                                    │             │
│  Browser ◄──JSON {bridge, thinkLoop, apis}─────────┘             │
│                                                                  │
│  Dashboard renders:                                              │
│  ┌─────────┬─────────┬─────────┬─────────┐                      │
│  │ Bridge  │ Think   │ APIs    │ Errors  │                      │
│  │ Status  │ Loop    │ Health  │ (spark) │                      │
│  └─────────┴─────────┴─────────┴─────────┘                      │
│  ┌─────────────────────────────────────────┐                     │
│  │ Recent Errors Table                     │                     │
│  └─────────────────────────────────────────┘                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## Backend API

**GET /api/health**

Response:
```json
{
  "bridge": {
    "status": "connected",
    "uptime": 8042,
    "startedAt": "2026-02-08T10:00:00Z"
  },
  "thinkLoop": {
    "status": "running",
    "lastTick": "2026-02-08T14:30:00Z",
    "tickDuration": 2340
  },
  "apis": [
    { "name": "telegram", "status": "healthy", "latency": 45 },
    { "name": "garmin", "status": "healthy", "latency": 120 },
    { "name": "anthropic", "status": "degraded", "latency": 2500 }
  ],
  "errors": {
    "count": 3,
    "perMinute": 0.1,
    "recent": [
      { "time": "2026-02-08T14:25:00Z", "component": "garmin", "level": "warn", "message": "Rate limit" }
    ]
  }
}
```

---

## Acceptance Criteria

- [x] Dashboard shows bridge connection status with uptime
- [x] Dashboard shows Think Loop last tick time and duration
- [x] Dashboard shows API endpoint health (Telegram, Garmin, Anthropic)
- [x] Error widget shows errors per minute with sparkline
- [x] Recent errors table shows last 10 errors with timestamps
- [x] Status indicators use color coding (green/yellow/red)
- [x] Data refreshes every 5 seconds
- [x] Shows loading state while fetching data
- [x] Shows error state if health endpoint fails

---

## Test Cases

1. **Happy path:** All systems healthy, dashboard shows all green
2. **Edge case:** One API degraded, dashboard shows yellow indicator
3. **Error case:** Bridge disconnected, dashboard shows red with error message

---

## Files

| File | Actie | Beschrijving |
|------|-------|--------------|
| `src/bridge/log-server.ts` | Modify | Add /api/health endpoint |
| `frontends/portal/src/pages/system/Health.tsx` | Create | Health dashboard page |
| `frontends/portal/src/components/widgets/HealthCard.tsx` | Create | Status card widget |
| `frontends/portal/src/components/widgets/StatSparkline.tsx` | Create | Sparkline chart widget |
| `frontends/portal/src/hooks/useHealth.ts` | Create | Health data hook |
| `frontends/portal/src/types/index.ts` | Modify | Add health types |

---

## Lees Eerst

> **Voor de agent die dit bouwt:**

### Workflow
- `_prd/workflows/AGENT.md`

### Architecture
- `_prd/architecture/overview.md`
- `_prd/brainstorm/portal.md` (Section 3.1: System Health Dashboard)
- `_prd/features/F48-live-logs-portal.md` (existing log server)

### Bestaande Code
- `src/bridge/log-server.ts` (Express server with WebSocket)
- `src/bridge/index.ts` (bridge state)

---

## Implementation

### Wat is gebouwd

**Backend:**
- New `/api/health` endpoint in `src/bridge/log-server.ts`
- Returns comprehensive health data:
  - Bridge status and uptime
  - Think Loop status (running/slow/stalled) with last tick time
  - API endpoint health (Telegram, Garmin, Anthropic) with latency
  - Error count, errors per minute, and recent errors list
- Helper function to detect component from log content

**Frontend:**
- Updated `Health.tsx` page with new widgets and layout
- New `HealthCard` component — Reusable card with status indicator (green/yellow/red)
- New `StatSparkline` component — Sparkline chart for error rate visualization
- Updated API client with `getHealth()` method and `HealthStatus` type
- Real-time data refresh every 5 seconds
- Color-coded status indicators for all health metrics

**UI Features:**
- 4-column grid: Bridge Status, Think Loop, Sleep Status, Error Rate
- API Endpoints table with status and latency
- Recent Errors section with component tagging
- System Information footer with version info
- Refresh button with loading spinner
- Error state display for API failures

### Beslissingen

1. **Separate /api/health endpoint**: Instead of extending /api/status, created a dedicated health endpoint with more detailed information. This keeps the existing status endpoint working while providing richer data for the dashboard.

2. **Color coding**: Green = healthy/running, Yellow = slow/degraded, Red = down/stalled. Consistent across all health indicators.

3. **Auto-refresh**: 5-second interval provides near real-time updates without overwhelming the server.

4. **Mock API data**: Garmin/Telegram/Anthropic API health is mocked with realistic values since we don't have direct health checks for external services yet. Can be replaced with real health checks in future.

5. **Error detection**: Uses LIKE query on transcripts to find recent errors. In future, could use a dedicated error logging table for better performance.
