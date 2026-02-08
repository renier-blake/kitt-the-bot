# Portal Architecture

> Web UI for KITT management and monitoring.
> **Status:** ✅ Geïmplementeerd (F64)

---

## Overview

The KITT Portal is a React-based web interface for monitoring and managing the KITT system. It provides real-time visibility into system health, database exploration, task management, and live logs.

**URL:** `http://localhost:3000` (dev) / `http://localhost:8000` (bridge)

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Browser                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                  KITT Portal                               │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │  │
│  │  │  Dashboard   │  │System Health │  │  Database    │    │  │
│  │  │              │  │              │  │  Explorer    │    │  │
│  │  └──────────────┘  └──────────────┘  └──────────────┘    │  │
│  │  ┌──────────────┐  ┌──────────────┐                      │  │
│  │  │Task Engine   │  │  Live Logs   │                      │  │
│  │  │              │  │  (WebSocket) │                      │  │
│  │  └──────────────┘  └──────────────┘                      │  │
│  │                                                            │  │
│  │  Tech: React + Vite + TypeScript + shadcn/ui              │  │
│  └──────────────────────┬────────────────────────────────────┘  │
└─────────────────────────┼───────────────────────────────────────┘
                          │ HTTP / WebSocket
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Express Server (Node.js)                       │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  src/bridge/log-server.ts                                  │  │
│  │                                                            │  │
│  │  ├── Port: 8000 (default)                                 │  │
│  │  ├── Static file serving (frontends/portal/dist/)         │  │
│  │  ├── REST API (/api/*)                                     │  │
│  │  └── WebSocket (/ws) for live logs                        │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **Framework** | React 18 | Component-based UI, large ecosystem |
| **Build Tool** | Vite | Fast HMR, optimized builds |
| **Language** | TypeScript | Type safety, better DX |
| **Styling** | Tailwind CSS | Utility-first, dark mode support |
| **Components** | shadcn/ui | Accessible, customizable primitives |
| **Routing** | React Router | SPA navigation |
| **Icons** | Lucide React | Consistent icon set |
| **State** | React Query (future) | Server state management |

---

## Project Structure

```
frontends/portal/
├── src/
│   ├── components/
│   │   ├── layout/           # Page layout components
│   │   │   ├── Sidebar.tsx   # Navigation sidebar
│   │   │   ├── Header.tsx    # Page header
│   │   │   └── PageShell.tsx # Layout wrapper
│   │   └── ui/               # shadcn/ui components
│   │       ├── button.tsx
│   │       ├── card.tsx
│   │       ├── separator.tsx
│   │       └── tooltip.tsx
│   ├── pages/
│   │   └── system/           # System dashboards
│   │       ├── Dashboard.tsx    # Overview page
│   │       ├── Health.tsx       # System health
│   │       ├── Database.tsx     # DB explorer
│   │       ├── Tasks.tsx        # Task engine
│   │       └── Logs.tsx         # Live logs
│   ├── lib/
│   │   ├── api.ts            # API client + WebSocket
│   │   └── utils.ts          # Utility functions
│   ├── types/
│   │   └── index.ts          # Shared TypeScript types
│   ├── App.tsx               # Main app with routing
│   ├── main.tsx              # React entry point
│   └── index.css             # Global styles + CSS variables
├── package.json              # NPM dependencies
├── vite.config.ts            # Vite configuration
├── tailwind.config.js        # Tailwind with KITT colors
├── tsconfig.json             # TypeScript config
└── components.json           # shadcn configuration
```

---

## Design System

### Colors (Dark Theme)

```css
/* CSS Variables */
--background: 0 0% 4%;           /* #0a0a0a */
--foreground: 0 0% 98%;          /* #fafafa */
--card: 0 0% 8%;                 /* #141414 */
--primary: 36 100% 50%;          /* #FF9900 (KITT amber) */
--border: 0 0% 15%;              /* #262626 */
--muted-foreground: 0 0% 64%;    /* #a3a3a3 */
```

### Layout Pattern

All dashboards follow a consistent structure:

```
┌─────────────────────────────────────────────────────────────────┐
│  Header                                                    [?]  │
│  ├── Title + Breadcrumb                                         │
│  ├── Primary Action Button                                      │
│  └── Last Updated Timestamp                                     │
├─────────────────────────────────────────────────────────────────┤
│  Content Area                                                   │
│  ├── Cards (metrics/status)                                     │
│  ├── Tables (data)                                              │
│  └── Charts (visualization)                                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## API Integration

### REST API

Base URL: `/api`

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/status` | GET | KITT status (sleep, think loop) |
| `/api/db/stats` | GET | Database statistics |
| `/api/db/table/:table` | GET | Table data with pagination |
| `/api/db/query` | GET | Execute SQL query (read-only) |

### WebSocket

URL: `ws://localhost:8000/ws` (bridge) or `ws://localhost:3000/ws` (dev)

Real-time log streaming from the KITT bridge.

```typescript
// Connection example
const ws = new WebSocket('ws://localhost:8000/ws');

ws.onmessage = (event) => {
  const log = JSON.parse(event.data);
  // { ts: number, level: 'info'|'warn'|'error', content: string, source?: string }
};
```

### Development Proxy

Vite dev server (port 3000) proxies API calls to the Express backend (port 8000):

```typescript
// vite.config.ts
server: {
  port: 3000,
  proxy: {
    '/api': 'http://localhost:8000',
    '/ws': { target: 'ws://localhost:8000', ws: true }
  }
}
```

---

## Configuration

### Environment Variables

Portal uses the same `.env` as the main KITT project:

```bash
# .env (root)
KITT_DB_PATH=./profile/memory/kitt.db
```

### NPM Scripts

```bash
# Development
npm run portal:dev          # Start Vite dev server (port 5173)

# Production
npm run portal:build        # Build for production
npm run portal:install      # Install dependencies
```

---

## Security

| Measure | Implementation |
|---------|---------------|
| **Local only** | Express binds to `127.0.0.1` |
| **No auth** | Assumes local/secured network |
| **Read-only queries** | SQL write operations blocked |
| **Table whitelist** | Only specific tables accessible |

---

## Key Decisions

| Decision | Rationale |
|----------|-----------|
| **Vite over Next.js** | Simpler setup, no SSR needed for local portal |
| **shadcn/ui** | Copy-paste components, full customization control |
| **Tailwind CSS** | Utility-first, easy dark mode, fast iteration |
| **No state library (yet)** | React state sufficient for current scope |
| **Proxy in dev** | Avoids CORS issues during development |
| **Static file serving** | Express serves built files in production |

---

## Build & Deployment

### Port Configuration

| Service | Port | Environment Variable |
|---------|------|---------------------|
| **Bridge (Express)** | 8000 | `KITT_PORT` |
| **Portal Dev** | 3000 | Vite default |

### Development Workflow

```bash
# Terminal 1: Start KITT bridge (port 8000)
npm run bridge

# Terminal 2: Start portal dev server (port 3000, proxies to 8000)
npm run portal:dev
# → http://localhost:8000 (bridge) or http://localhost:3000 (dev)
```

### Production Build

```bash
# Build portal (outputs to frontends/portal/dist/)
npm run portal:build

# Start bridge (serves built portal from dist/ on port 8000)
npm run bridge:start
# → http://localhost:8000
```

The Express server in `src/bridge/log-server.ts` serves static files from `frontends/portal/dist/`:

```typescript
const portalPath = path.join(process.cwd(), 'frontends', 'portal');
app.use(express.static(portalPath));
```

---

## Pages

### Dashboard (`/`)
Overview with quick links to all sections.

### System Health (`/health`)
- Bridge connection status
- Think Loop last run
- Sleep mode status
- Error rates

### Database Explorer (`/database`)
- Table statistics
- Row counts
- (Future: browse records, run queries)

### Task Engine (`/tasks`)
- Task configuration
- Execution history
- (Future: manage tasks, view schedule)

### Live Logs (`/logs`)
- Real-time log stream
- Filter by level/source
- Pause/resume
- Clear history

---

## Future Enhancements

| Feature | Status | Issue |
|---------|--------|-------|
| Project Management (Linear-style) | 📝 Spec | F70 |
| Triage Inbox | 📝 Spec | F71 |
| Roadmap View | 📝 Spec | F72 |
| Personal Dashboards (Renier) | 📝 Spec | Future |
| React Query integration | 🔜 Planned | - |
| Data visualization (Recharts) | 🔜 Planned | - |
