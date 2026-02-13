# Logging & Observability

## Overview

KITT gebruikt structured JSON logging met source-tagged child loggers. Alle log output gaat via `console.log`/`warn`/`error` en wordt automatisch onderschept door de log interceptor in `log-server.ts`, die het doorstuurt naar de Portal via WebSocket.

## Hoe te loggen

### Stap 1: Importeer `createLogger`

```typescript
import { createLogger } from '../bridge/logger.js';

const log = createLogger('mijn-module');
```

### Stap 2: Log met structured data

```typescript
log.info('Actie beschrijving', { key: 'value', duration_ms: 42 });
log.warn('Iets opvallends', { reason: 'timeout' });
log.error('Fout opgetreden', { error: String(err) });
log.debug('Debug info', { detail: 'alleen bij LOG_LEVEL=debug' });
```

### Output format

```json
{
  "ts": "13-02-2026 14:30:15",
  "level": "info",
  "source": "think-loop",
  "msg": "Running check",
  "phase": "planner",
  "duration_ms": 42
}
```

## Logger API

```typescript
// Uit src/bridge/types.ts
interface Logger {
  info:  (msg: string, data?: Record<string, unknown>) => void;
  error: (msg: string, data?: Record<string, unknown>) => void;
  warn:  (msg: string, data?: Record<string, unknown>) => void;
  debug: (msg: string, data?: Record<string, unknown>) => void;
}
```

**Twee varianten:**

| Import | Gebruik |
|--------|---------|
| `import { log } from './logger.js'` | Globale logger (geen source tag) |
| `import { createLogger } from './logger.js'` | Child logger met vaste source tag |

Gebruik altijd `createLogger('source')` in modules — zo is elke log entry traceerbaar in de Portal.

## Actieve source tags

| Source | Module | Beschrijving |
|--------|--------|-------------|
| `think-loop` | `src/scheduler/index.ts` | Think loop reasoning en acties |
| `scheduler` | `src/scheduler/index.ts` | Scheduler lifecycle en cron |
| `background-runner` | `src/scheduler/background-runner.ts` | Background task execution |
| `agent-pool` | `src/bridge/agent-pool.ts` | Agent registry, timeouts, lifecycle |
| `capabilities` | `src/capabilities/index.ts` | Capability tool calls (memory, sleep, etc.) |
| `api` | `src/bridge/middleware/request-logger.ts` | HTTP request/response logging |
| `system` | Log server zelf | WebSocket connect messages |

### Nieuwe source tag toevoegen

Kies een beschrijvende, lowercase, kebab-case naam. Voeg de tag toe aan bovenstaande tabel wanneer je een nieuwe module maakt.

## Log levels

| Level | Wanneer |
|-------|---------|
| `error` | Fouten die actie vereisen (crashes, API failures) |
| `warn` | Opvallend maar niet broken (slow requests, retries, timeouts) |
| `info` | Normale operaties (startup, task completion, state changes) |
| `debug` | Verbose detail (alleen zichtbaar met `LOG_LEVEL=debug`) |

Configureer via environment variable: `LOG_LEVEL=debug` (default: `info`).

## Architectuur

```
┌─────────────────┐     console.log()     ┌──────────────────┐
│  createLogger() │ ──────────────────────>│  Log Interceptor │
│  (logger.ts)    │  structured JSON       │  (log-server.ts) │
└─────────────────┘                        └────────┬─────────┘
                                                    │
                                           ┌────────┴─────────┐
                                           │                   │
                                     ┌─────▼─────┐    ┌───────▼──────┐
                                     │  Terminal  │    │  WebSocket   │
                                     │  (pm2 log) │    │  → Portal UI │
                                     └───────────┘    └──────────────┘
```

1. `createLogger(source)` maakt een Logger die structured JSON schrijft naar `console.log/warn/error`
2. De log interceptor in `log-server.ts` vangt alle console output op
3. `detectSource()` parsed de `source` field uit de JSON
4. Het bericht wordt gebroadcast naar alle WebSocket clients (Portal Live Logs)
5. De originele console output blijft behouden (zichtbaar in `pm2 logs kitt`)

## HTTP Observability (Middleware)

Twee middleware modules in `src/bridge/middleware/`:

### Request ID (`request-id.ts`)

Elke API request krijgt een uniek `x-request-id` header. Beschikbaar als `req.id` in route handlers.

- Hergebruikt bestaande `x-request-id` header als die meegegeven wordt
- Anders: genereert random 16-char hex ID

### Request Logger (`request-logger.ts`)

Logt automatisch elke `/api/*` request met:

```json
{
  "source": "api",
  "method": "GET",
  "path": "/api/issues",
  "status": 200,
  "duration_ms": 12,
  "requestId": "a1b2c3d4e5f6g7h8"
}
```

**Level regels:**
- `error` bij status >= 500
- `warn` bij status >= 400 of duration > 1000ms
- `info` bij normale requests

Statische files en WebSocket upgrades worden niet gelogd.

## Bestanden

| File | Doel |
|------|------|
| `src/bridge/logger.ts` | Logger implementatie (`log`, `createLogger`) |
| `src/bridge/types.ts` | `Logger` interface definitie |
| `src/bridge/log-server.ts` | Console interceptor, WebSocket broadcast, `detectSource()` |
| `src/bridge/middleware/request-id.ts` | Request ID middleware |
| `src/bridge/middleware/request-logger.ts` | Request logging middleware |

## NIET doen

- **Geen `console.log('[tag] message')` meer** — gebruik `createLogger('tag')` in plaats daarvan
- **Geen gevoelige data loggen** — geen tokens, wachtwoorden, of volledige request bodies
- **Geen emoji's in source tags** — houd tags lowercase kebab-case
- **Geen `console.log` direct in route handlers** — de request-logger middleware dekt HTTP logging
