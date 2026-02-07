# F49 - Centralized Logging

> **Status:** 📝 Spec
> **Priority:** 🟠 P1
> **Created:** 7 februari 2026

---

## Doel

Centrale logging voor **alle** backend processen en scripts, met labels per bron. Dit geeft visibility in:
- Python scripts (Garmin sync, etc.)
- PM2 process manager
- Externe scripts en tools
- Toekomstige backend services

**Samen met F48 (Live Logs Portal) krijg je twee streams:**
1. **KITT Logs** - Think Loop, Agent, Skills (F48)
2. **System Logs** - Backend processen met labels (F49)

---

## Architectuur

### Log Flow

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Python Script  │────▶│                 │     │                 │
└─────────────────┘     │                 │     │                 │
                        │   Log Collector │────▶│  Portal (F48)   │
┌─────────────────┐     │   (UDP/File)    │     │  + System Tab   │
│  Garmin Sync    │────▶│                 │     │                 │
└─────────────────┘     │                 │     │                 │
                        └─────────────────┘     └─────────────────┘
┌─────────────────┐            ▲
│  Future Script  │────────────┘
└─────────────────┘
```

### Log Entry Format

```typescript
interface SystemLogEntry {
  ts: number;           // Unix timestamp ms
  level: 'debug' | 'info' | 'warn' | 'error';
  source: string;       // [garmin], [python], [pm2], etc.
  content: string;      // Log message
  metadata?: {
    pid?: number;       // Process ID
    script?: string;    // Script filename
    duration?: number;  // For timed operations
  };
}
```

---

## Implementatie Opties

### Optie A: UDP Logger (Aanbevolen)

Simpelste aanpak - scripts sturen logs via UDP naar collector.

**Voordelen:**
- Fire-and-forget (geen blocking)
- Werkt cross-language (Python, Node, Bash)
- Geen file locking issues

**Python helper:**
```python
# scripts/lib/kitt_logger.py
import socket
import json
import time

class KITTLogger:
    def __init__(self, source: str, port: int = 3001):
        self.source = source
        self.sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        self.addr = ('127.0.0.1', port)

    def log(self, level: str, message: str, **metadata):
        entry = {
            'ts': int(time.time() * 1000),
            'level': level,
            'source': f'[{self.source}]',
            'content': message,
            'metadata': metadata
        }
        self.sock.sendto(json.dumps(entry).encode(), self.addr)

    def info(self, msg, **kw): self.log('info', msg, **kw)
    def warn(self, msg, **kw): self.log('warn', msg, **kw)
    def error(self, msg, **kw): self.log('error', msg, **kw)
```

**Gebruik:**
```python
from lib.kitt_logger import KITTLogger

log = KITTLogger('garmin')
log.info('Starting Garmin sync')
log.info('Fetched 7 days of data', days=7)
log.error('API rate limited', retry_after=60)
```

### Optie B: Named Pipe / File Watcher

Scripts schrijven naar een shared log file, collector watched.

**Minder geschikt** - file locking, rotation complexity.

---

## Nieuwe Files

| File | Doel |
|------|------|
| `src/bridge/system-log-collector.ts` | UDP server die system logs ontvangt |
| `scripts/lib/kitt_logger.py` | Python logging helper |
| `scripts/lib/kitt_logger.sh` | Bash logging helper (optional) |

---

## Portal Uitbreiding

Extend F48 portal met:

1. **Tab Toggle**: "KITT" / "System" / "All"
2. **Source Filter**: Dropdown met alle bekende sources
3. **Combined View**: Optioneel alles in 1 stream met kleurcodes

### UI Mockup

```
┌─────────────────────────────────────────────────────┐
│ KITT Live Logs          [KITT] [System] [All]       │
├─────────────────────────────────────────────────────┤
│ Filter: [All Sources ▼]  [Auto-scroll] [Pause]      │
├─────────────────────────────────────────────────────┤
│ 14:32:05 [garmin] Starting daily sync               │
│ 14:32:06 [garmin] Fetched sleep data: 7h 23m        │
│ 14:32:07 [garmin] Fetched HRV: 45ms avg             │
│ 14:32:08 [garmin] Sync complete (3.2s)              │
│ 14:35:00 [python] Running nutrition aggregator      │
│ 14:35:01 [python] Processed 12 entries              │
└─────────────────────────────────────────────────────┘
```

---

## Implementatie Stappen

### Stap 1: UDP Collector

```typescript
// src/bridge/system-log-collector.ts
import dgram from 'dgram';

const SYSTEM_LOG_PORT = 3001;

export function startSystemLogCollector(broadcast: (entry: SystemLogEntry) => void) {
  const server = dgram.createSocket('udp4');

  server.on('message', (msg) => {
    try {
      const entry = JSON.parse(msg.toString());
      broadcast(entry);
    } catch (e) {
      // Invalid JSON, ignore
    }
  });

  server.bind(SYSTEM_LOG_PORT);
  return server;
}
```

### Stap 2: Integratie in Log Server

Update `src/bridge/log-server.ts`:
- Start UDP collector naast WebSocket server
- Beide streams broadcasten naar portal
- Tag entries met `stream: 'kitt' | 'system'`

### Stap 3: Python Logger Library

Maak `scripts/lib/kitt_logger.py` met helper class.

### Stap 4: Migreer Bestaande Scripts

Update scripts om KITTLogger te gebruiken:
- `scripts/garmin/*.py`
- Toekomstige Python scripts

### Stap 5: Portal UI Update

- Voeg tab toggle toe
- Voeg source filter toe
- Kleurcode per source

---

## Verificatie

1. Start bridge: `npm run bridge`
2. Run Garmin sync: `python scripts/garmin/sync.py`
3. Zie in portal:
   - Tab "System" toont `[garmin]` logs
   - Tab "KITT" toont Think Loop logs
   - Tab "All" toont beide

---

## Bekende Sources (initieel)

| Source | Beschrijving |
|--------|--------------|
| `[garmin]` | Garmin Connect sync scripts |
| `[python]` | Generieke Python scripts |
| `[cron]` | Cron/scheduled jobs |
| `[pm2]` | PM2 process events |

Nieuwe sources worden automatisch herkend door portal.

---

## Toekomstig (niet in scope)

- Log persistence (database)
- Log search
- Alerts bij errors
- Remote logging (non-localhost)
- Log rotation/cleanup

---

## Dependencies

- Node.js `dgram` (built-in)
- Geen nieuwe npm packages nodig

---

## Relatie met F48

F48 (Live Logs Portal) blijft de **UI laag**.
F49 voegt **System log collection** toe als extra data source.

```
F48: Console interception → WebSocket → Portal UI
F49: UDP collector → Same WebSocket → Same Portal UI (new tab)
```
