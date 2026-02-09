# F64: Portal Framework Setup

> **Priority:** 🔴 P0
> **Status:** ✅ Done
> **Owner:** -

---

## Overview

Set up the foundational framework for the KITT Portal. This is the base upon which all other portal dashboards will be built. Uses React + Vite + shadcn/ui for a modern, maintainable frontend.

---

## User Stories

**US-01:** As Renier, I want the portal to load in my browser, so I can access KITT's system dashboards.

**US-02:** As a developer, I want a component library in place, so I can build dashboards quickly and consistently.

**US-03:** As Renier, I want the portal to have a dark theme, so it matches KITT's aesthetic and is easy on the eyes.

---

## Componenten

| Component | Nodig | Beschrijving |
|-----------|-------|--------------|
| Skill | ❌ | - |
| Task | ❌ | - |
| Schema | ❌ | - |
| Backend | ✅ | Extend Express server to serve static portal files |
| Portal | ✅ | Complete React + Vite + shadcn setup |

---

## Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  Setup Flow                                                      │
│                                                                  │
│  1. Create frontend/portal/ directory structure                  │
│  2. Initialize Vite + React + TypeScript                         │
│  3. Configure Tailwind CSS with dark theme colors                │
│  4. Initialize shadcn/ui                                         │
│  5. Install base components (button, card, table, input, etc.)   │
│  6. Create layout shell (sidebar, header, main content area)     │
│  7. Setup routing with React Router                              │
│  8. Configure API client for backend communication               │
│  9. Update Express server to serve static portal files           │
│  10. Build and verify portal loads at localhost:8000 (bridge)    │
└─────────────────────────────────────────────────────────────────┘
```

---

## Acceptance Criteria

- [x] Portal loads at `http://localhost:3000` (dev) or `http://localhost:8000` (bridge)
- [x] Dark theme is applied by default
- [x] Sidebar navigation is visible with placeholder items
- [x] shadcn/ui components render correctly
- [x] React Router handles navigation without page reload
- [x] API client can communicate with backend
- [x] Build process works (`npm run build`)
- [x] Development mode works (`npm run dev`)

---

## Test Cases

1. **Happy path:** Open browser to localhost:3000 (dev) or localhost:8000 (bridge), portal loads with dark theme
2. **Edge case:** Navigate between routes, state persists correctly
3. **Error case:** Backend is down, portal shows appropriate error state

---

## Files

| File | Actie | Beschrijving |
|------|-------|--------------|
| `frontends/portal/package.json` | Create | NPM dependencies |
| `frontends/portal/vite.config.ts` | Create | Vite configuration |
| `frontends/portal/tailwind.config.js` | Create | Tailwind with custom colors |
| `frontends/portal/components.json` | Create | shadcn configuration |
| `frontends/portal/src/main.tsx` | Create | React entry point |
| `frontends/portal/src/App.tsx` | Create | Main app with routing |
| `frontends/portal/src/index.css` | Create | Global styles + CSS variables |
| `frontends/portal/src/components/layout/Sidebar.tsx` | Create | Navigation sidebar |
| `frontends/portal/src/components/layout/Header.tsx` | Create | Page header |
| `frontends/portal/src/components/layout/PageShell.tsx` | Create | Layout wrapper |
| `frontends/portal/src/components/ui/*` | Create | shadcn components |
| `frontends/portal/src/lib/api.ts` | Create | API client |
| `frontends/portal/src/lib/utils.ts` | Create | Utility functions (cn helper) |
| `package.json` (root) | Modify | Add portal scripts |
| `src/bridge/index.ts` | Modify | Serve static portal files |

---

## Lees Eerst

> **Voor de agent die dit bouwt:**

### Workflow
- `_prd/workflows/AGENT.md`

### Architecture
- `_prd/architecture/overview.md`
- `_prd/brainstorm/portal.md` (Section 4: Technical Architecture)

### Reference Docs
- shadcn/ui documentation: https://ui.shadcn.com
- Tailwind CSS: https://tailwindcss.com
- React Router: https://reactrouter.com

### Design Specs
- Colors: See portal.md Section 2.3 (Design System)
- Layout pattern: Header → Filter Bar → Content → Detail Panel

---

## Implementation

### Wat is gebouwd

Complete React + Vite + shadcn/ui portal framework:

**Project Structure:**
```
frontends/portal/
├── src/
│   ├── components/
│   │   ├── layout/        # Sidebar, Header, PageShell
│   │   └── ui/            # shadcn components (button, card, separator, tooltip)
│   ├── pages/
│   │   └── system/        # Dashboard, Health, Database, Tasks, Logs
│   ├── lib/
│   │   ├── api.ts         # API client with WebSocket support
│   │   └── utils.ts       # cn() helper, date formatting
│   ├── types/
│   │   └── index.ts       # Shared TypeScript types
│   ├── App.tsx            # Main app with React Router
│   ├── main.tsx           # React entry point
│   └── index.css          # Tailwind + dark theme CSS variables
├── package.json           # NPM dependencies
├── vite.config.ts         # Vite config with API proxy
├── tailwind.config.js     # Tailwind with KITT colors
├── tsconfig.json          # TypeScript config
└── components.json        # shadcn configuration
```

**Features Implemented:**
- Dark theme by default (CSS variables in HSL format)
- KITT amber primary color (#FF9900)
- Sidebar navigation with 5 pages
- React Router for SPA navigation
- API client with auto-proxy to backend
- WebSocket connection for live logs
- 5 initial pages (Dashboard, Health, Database, Tasks, Logs)
- shadcn/ui base components (Button, Card, Separator, Tooltip)

**Pages Created:**
- `/` - Dashboard with quick links
- `/health` - System health with real-time status
- `/database` - Database stats overview
- `/tasks` - Task engine dashboard
- `/logs` - Live log viewer with WebSocket

**Scripts Added to Root package.json:**
- `portal:dev` - Start dev server
- `portal:build` - Build for production
- `portal:install` - Install dependencies

### Beslissingen

1. **shadcn/ui over custom components**: Provides accessible, well-designed components that can be customized. The "copy-paste" model gives full control.

2. **Vite over Next.js**: Next.js is overkill for a local portal. Vite is faster to develop with and simpler to configure.

3. **CSS Variables in HSL**: shadcn/ui uses HSL format for theming. The dark theme is the default.

4. **Proxy in Vite config**: Development server proxies `/api` and `/ws` to the Express backend running on port 3000. This avoids CORS issues.

5. **File-based routing**: Simple React Router setup with routes defined in App.tsx. Can be extended to code-splitting later if needed.
