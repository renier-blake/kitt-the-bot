# F48 - Live Logs Portal

> **Status:** 📝 Spec
> **Priority:** 🟠 P1
> **Type:** New Feature

---

## Doel

Simpele web portal waar je live KITT logs kunt zien:
- Real-time log streaming
- Think Loop reasoning zichtbaar
- Geen terminal nodig - pm2 kan blijven draaien
- Toegankelijk via browser

---

## Waarom?

| Nu | Met Portal |
|---|---|
| Terminal open houden voor logs | pm2 draait op achtergrond |
| Handmatig `npm run bridge` | Altijd beschikbaar |
| Logs scrollen snel weg | Persistent view met filtering |
| Geen visibility als pm2 draait | Live monitoring altijd |

---

## MVP Scope

### Must Have
- [ ] Live log streaming (WebSocket)
- [ ] Think Loop output zichtbaar
- [ ] Auto-scroll met pause optie
- [ ] Basic filtering (info/warn/error)

### Nice to Have (v1.1)
- [ ] Search in logs
- [ ] Log level filtering
- [ ] Transcripts view
- [ ] Dark mode

---

## Architectuur

```
┌─────────────────────────────────────────────────────┐
│                    Browser                          │
│  ┌───────────────────────────────────────────────┐  │
│  │           KITT Live Logs Portal               │  │
│  │  ┌─────────────────────────────────────────┐  │  │
│  │  │ [think-loop] ⏰ Tick at 00:30          │  │  │
│  │  │ [think-loop] 🧠 Running think loop     │  │  │
│  │  │ [think-loop] Fetched data for apple... │  │  │
│  │  │ [agent] 🤖 Model: haiku                │  │  │
│  │  │ [think-loop] 💭 Reasoning: ...         │  │  │
│  │  │ [think-loop] ✓ Decision: No action     │  │  │
│  │  └─────────────────────────────────────────┘  │  │
│  │  [Auto-scroll: ON] [Filter: ALL] [Clear]      │  │
│  └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
          │
          │ WebSocket
          ▼
┌─────────────────────────────────────────────────────┐
│              KITT Bridge (pm2)                      │
│  ┌─────────────┐    ┌─────────────────────────┐    │
│  │ Log Stream  │───▶│ WebSocket Server        │    │
│  │ (winston)   │    │ /ws/logs                │    │
│  └─────────────┘    └─────────────────────────┘    │
└─────────────────────────────────────────────────────┘
```

---

## Implementatie

### 1. WebSocket Server in Bridge

Extend de bridge met een WebSocket endpoint:

```typescript
// src/bridge/log-server.ts
import { WebSocketServer } from 'ws';

export function startLogServer(port = 3001) {
  const wss = new WebSocketServer({ port });

  // Hook into winston logger
  logger.on('data', (log) => {
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(log));
      }
    });
  });

  return wss;
}
```

### 2. Simple HTML Portal

Single HTML file met embedded JS:

```
.claude/portal/
├── index.html          # Live logs viewer
└── README.md           # How to access
```

### 3. Serve Static Files

```typescript
// In bridge startup
import express from 'express';

const app = express();
app.use(express.static('.claude/portal'));
app.listen(3000);
```

---

## Portal UI

```html
<!DOCTYPE html>
<html>
<head>
  <title>KITT Live Logs</title>
  <style>
    body {
      background: #1a1a2e;
      color: #eee;
      font-family: monospace;
      margin: 0;
      padding: 20px;
    }
    #logs {
      height: calc(100vh - 100px);
      overflow-y: auto;
      padding: 10px;
      background: #16213e;
      border-radius: 8px;
    }
    .log-line { margin: 2px 0; }
    .think-loop { color: #00d9ff; }
    .agent { color: #ff6b6b; }
    .info { color: #69ff69; }
    .error { color: #ff4444; }
    .controls {
      padding: 10px 0;
      display: flex;
      gap: 10px;
    }
    button {
      background: #0f3460;
      color: white;
      border: none;
      padding: 8px 16px;
      border-radius: 4px;
      cursor: pointer;
    }
    button:hover { background: #1a4a7a; }
    button.active { background: #e94560; }
  </style>
</head>
<body>
  <h1>🚗 KITT Live Logs</h1>
  <div class="controls">
    <button id="autoScroll" class="active">Auto-scroll: ON</button>
    <button id="clear">Clear</button>
    <select id="filter">
      <option value="all">All</option>
      <option value="think-loop">Think Loop</option>
      <option value="agent">Agent</option>
      <option value="error">Errors</option>
    </select>
    <span id="status">Connecting...</span>
  </div>
  <div id="logs"></div>

  <script>
    const logs = document.getElementById('logs');
    const status = document.getElementById('status');
    let autoScroll = true;

    const ws = new WebSocket('ws://localhost:3001');

    ws.onopen = () => {
      status.textContent = '🟢 Connected';
    };

    ws.onmessage = (event) => {
      const log = JSON.parse(event.data);
      const line = document.createElement('div');
      line.className = 'log-line ' + getLogClass(log);
      line.textContent = formatLog(log);
      logs.appendChild(line);

      if (autoScroll) {
        logs.scrollTop = logs.scrollHeight;
      }
    };

    ws.onclose = () => {
      status.textContent = '🔴 Disconnected';
    };

    function getLogClass(log) {
      if (log.msg?.includes('[think-loop]')) return 'think-loop';
      if (log.msg?.includes('[agent]')) return 'agent';
      if (log.level === 'error') return 'error';
      return 'info';
    }

    function formatLog(log) {
      return `${log.ts} ${log.msg}`;
    }

    document.getElementById('autoScroll').onclick = function() {
      autoScroll = !autoScroll;
      this.textContent = `Auto-scroll: ${autoScroll ? 'ON' : 'OFF'}`;
      this.classList.toggle('active', autoScroll);
    };

    document.getElementById('clear').onclick = () => {
      logs.innerHTML = '';
    };
  </script>
</body>
</html>
```

---

## Kritieke Files

| File | Actie |
|------|-------|
| `src/bridge/log-server.ts` | Create - WebSocket server |
| `src/bridge/index.ts` | Update - start log server |
| `.claude/portal/index.html` | Create - Live logs UI |
| `package.json` | Update - add ws dependency |

---

## Dependencies

```bash
npm install ws express
npm install -D @types/ws @types/express
```

---

## Toegang

Na implementatie:

```
http://localhost:3000          # Portal
ws://localhost:3001            # WebSocket logs
```

---

## Verificatie

1. Bridge start met WebSocket server
2. Portal opent in browser
3. Live logs streamen naar portal
4. Think Loop reasoning zichtbaar
5. Auto-scroll werkt
6. pm2 kan draaien terwijl portal live is

---

## Toekomstig

- Memory search in portal
- Skill status overview
- Transcript viewer
- System health dashboard
- Mobile responsive
