# PAS-11: Integrations Frontend

> **Priority:** 🔴 High
> **Status:** 📝 Spec
> **Owner:** Agent
> **Created:** 2026-02-08

---

## Overview

Frontend interface for managing OAuth integrations via Nango. Users can connect/disconnect apps like Gmail, Google Calendar, Slack, etc. Part of the "User" mode in the Portal.

---

## User Stories

**US-01:** As a user, I want to see all available integrations, so I know what apps I can connect.

**US-02:** As a user, I want to connect my Gmail with one click, so KITT can read/write emails.

**US-03:** As a user, I want to see which apps are already connected, so I know what's active.

**US-04:** As a user, I want to disconnect an app, so I can revoke access.

**US-05:** As a user, I want to toggle between System and User mode, so I can manage my AI vs configure the system.

---

## Componenten

| Component | Nodig | Beschrijving |
|-----------|-------|--------------|
| Skill | ❌ | - |
| Task | ❌ | - |
| Schema | ✅ | Add `user_integrations` table (optional, or use nango connection status) |
| Backend | ✅ | REST API endpoints for Nango sessions |
| Portal | ✅ | Integrations page + User/System toggle |

---

## Portal Structure

```
┌─────────────────────────────────────────────────────────────┐
│  🚗 KITT Portal                                  [System ▼] │  ← Toggle
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  SYSTEM MODE (admin):                                       │
│  ├── Dashboard                                              │
│  ├── Projects                                               │
│  ├── Tasks                                                  │
│  ├── Database                                               │
│  ├── Logs                                                   │
│  └── Health                                                 │
│                                                             │
│  USER MODE (personal):                                      │
│  ├── Integrations ← YOU ARE HERE                            │
│  ├── Identity                                               │
│  ├── Skills                                                 │
│  └── Settings                                               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## UI Design

### Integrations Grid

```
┌─────────────────────────────────────────────────────────────────┐
│  Integrations                                        [Refresh] │
│                                                                  │
│  Connect your apps to give KITT superpowers                     │
│                                                                  │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │  📧 Gmail       │  │  📅 Google Cal  │  │  💬 Slack       │ │
│  │                 │  │                 │  │                 │ │
│  │  Read emails,   │  │  Manage your    │  │  Send/receive   │ │
│  │  send drafts    │  │  schedule       │  │  messages       │ │
│  │                 │  │                 │  │                 │ │
│  │  [Connect]      │  │  [Connect]      │  │  [Connect]      │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
│                                                                  │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │  📝 Notion      │  │  🎯 HubSpot     │  │  📊 Sheets      │ │
│  │                 │  │                 │  │                 │ │
│  │  ✅ Connected   │  │  ⚠️ Expires     │  │  [Connect]      │ │
│  │  renier@...     │  │  in 3 days      │  │                 │ │
│  │                 │  │                 │  │                 │ │
│  │  [Disconnect]   │  │  [Reconnect]    │  │                 │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Integration Card States

| State | Visual | Actions |
|-------|--------|---------|
| **Disconnected** | Grayed out, dotted border | "Connect" button |
| **Connected** | Green border, checkmark icon | "Disconnect" button, account info |
| **Error** | Red border, warning icon | "Reconnect" button, error message |
| **Expiring** | Orange border, clock icon | "Reconnect" button, days remaining |

---

## Backend API

### GET /api/integrations
List all available integrations and their connection status.

```json
{
  "integrations": [
    {
      "id": "google-mail",
      "name": "Gmail",
      "description": "Read emails, send drafts",
      "icon": "📧",
      "category": "Email",
      "connected": false
    },
    {
      "id": "google-calendar",
      "name": "Google Calendar",
      "description": "Manage your schedule",
      "icon": "📅",
      "category": "Calendar",
      "connected": true,
      "connection": {
        "account": "renier@example.com",
        "expiresAt": 1738368000000,
        "createdAt": 1735689600000
      }
    }
  ]
}
```

### POST /api/integrations/:id/connect
Create a Nango connect session.

**Request:**
```json
{ "integrationId": "google-mail" }
```

**Response:**
```json
{ "token": "nango_session_token_xxx" }
```

Frontend then opens Nango Connect UI:
```typescript
const nango = new Nango();
await nango.openConnectUI({ sessionToken: token });
```

### DELETE /api/integrations/:id/disconnect
Remove connection.

```json
{ "success": true }
```

---

## Implementation

### Files

| File | Actie | Beschrijving |
|------|-------|--------------|
| `src/bridge/log-server.ts` | Modify | Add `/api/integrations/*` endpoints |
| `frontends/portal/src/components/layout/Sidebar.tsx` | Modify | Add System/User toggle |
| `frontends/portal/src/pages/user/Integrations.tsx` | Create | Integrations grid page |
| `frontends/portal/src/pages/user/Identity.tsx` | Create | Placeholder (optional) |
| `frontends/portal/src/pages/user/Settings.tsx` | Create | Placeholder (optional) |
| `frontends/portal/src/hooks/useIntegrations.ts` | Create | Data fetching hook |

### Dependencies

```bash
npm install @nangohq/frontend
```

---

## Nango Frontend Setup

```typescript
import Nango from '@nangohq/frontend';

// Initialize
const nango = new Nango({
  publicKey: 'optional-public-key' // If using public key auth
});

// Open Connect UI
const connect = async (integrationId: string) => {
  // Get session token from backend
  const { token } = await fetch(`/api/integrations/${integrationId}/connect`, {
    method: 'POST'
  }).then(r => r.json());

  // Open Nango UI
  await nango.openConnectUI({
    sessionToken: token,
    onEvent: (event) => {
      if (event.type === 'connect') {
        console.log('Connected!', event);
        // Refresh list
      }
      if (event.type === 'close') {
        console.log('Modal closed');
      }
    }
  });
};
```

---

## Acceptance Criteria

- [x] Sidebar has System/User mode toggle
- [x] User mode shows: Integrations, Identity, Skills, Settings
- [x] Integrations page shows grid of available apps
- [x] Each card shows: icon, name, description, connection status
- [x] "Connect" opens Nango Connect UI
- [x] After connect, card shows "Connected"
- [x] "Disconnect" removes connection
- [x] Connection status updates on refresh
- [ ] Expiring tokens show warning with days remaining (not implemented)

---

## Test Cases

1. **Happy path:** Click Connect → Nango UI opens → OAuth → Connected ✅
2. **Disconnect:** Click Disconnect → Confirm → Disconnected ✅
3. **Error:** Nango error → Show error message → Retry button ✅
4. **Toggle:** Switch System/User → Sidebar updates → Content updates ✅

---

## Related

- `PAS-01_nango-integration.md` - Backend Nango service
- Uses: `@nangohq/node` (backend), `@nangohq/frontend` (portal)

---

## Implementation

### Wat is gebouwd

**Backend API (src/bridge/log-server.ts):**
- `GET /api/integrations` - List all integrations with connection status from Nango
- `POST /api/integrations/:id/connect` - Create Nango connect session token
- `DELETE /api/integrations/:id/disconnect` - Remove Nango connection
- `GET /api/integrations/:id/status` - Get connection status

**Frontend Pages (frontends/portal/src/pages/user/):**
- `Integrations.tsx` - Main integrations grid with connect/disconnect buttons
- `Identity.tsx` - User profile and preferences (placeholder)
- `Skills.tsx` - Manage installed skills (placeholder)
- `Settings.tsx` - User settings (placeholder)

**Components:**
- `Sidebar.tsx` - Added System/User mode toggle
- `Badge.tsx` - UI badge component
- `Switch.tsx` - UI toggle switch component

**API Integration:**
- `@nangohq/frontend` - Nango Connect UI SDK
- Dynamic import for Nango client
- Session-based OAuth flow

**Routes:**
- `/user/integrations` - Integration management
- `/user/identity` - User profile
- `/user/skills` - Skills management
- `/user/settings` - User settings

### Beslissingen

1. **Dynamic Nango loading**: The Nango SDK is loaded dynamically via `import()` to avoid SSR issues and reduce initial bundle size.

2. **System/User toggle**: A toggle in the sidebar switches between system administration (Dashboard, Health, Logs) and user personal settings (Integrations, Identity, Skills).

3. **8 pre-configured integrations**: Gmail, Google Calendar, Slack, Notion, HubSpot, Google Drive, GitHub, and Linear are pre-configured. Adding more only requires updating the `AVAILABLE_INTEGRATIONS` array in the backend.

4. **Grouped by category**: Integrations are grouped by category (Email, Calendar, Communication, etc.) with a counter showing connected/total.

5. **Real-time status**: Connection status is fetched from Nango on page load and after connect/disconnect actions.
