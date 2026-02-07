# F05b: Process Manager (pm2)

> **Priority:** 🔴 MVP Infrastructure
> **Status:** 🔜 Ready
> **Owner:** Agent
> **Effort:** Klein (30 min)

---

## Overview

pm2 als process manager voor de KITT bridge zodat:
1. KITT zichzelf kan restarten na code wijzigingen
2. Processen auto-starten bij Mac reboot
3. Meerdere processen tegelijk kunnen draaien
4. Logs en monitoring beschikbaar zijn

---

## Implementatie

### 1. pm2 Installatie

```bash
npm install -g pm2
```

### 2. Ecosystem Config

**Bestand:** `ecosystem.config.cjs`

```javascript
module.exports = {
  apps: [
    {
      name: 'kitt-bridge',
      script: 'npm',
      args: 'run bridge:start',
      cwd: '/Users/renierbleeker/Projects/KITT V1',
      env: {
        NODE_ENV: 'production',
      },
      // Auto-restart
      watch: false,
      autorestart: true,
      max_restarts: 10,
      // Logging
      log_file: 'logs/bridge-combined.log',
      out_file: 'logs/bridge-out.log',
      error_file: 'logs/bridge-error.log',
      merge_logs: true,
      time: true,
    },
  ],
};
```

### 3. NPM Scripts

Toevoegen aan `package.json`:

```json
{
  "scripts": {
    "pm2:start": "pm2 start ecosystem.config.cjs",
    "pm2:stop": "pm2 stop kitt-bridge",
    "pm2:restart": "pm2 restart kitt-bridge",
    "pm2:logs": "pm2 logs kitt-bridge",
    "pm2:status": "pm2 status"
  }
}
```

### 4. Auto-Start bij Boot

```bash
pm2 startup  # Genereert launchd config voor macOS
pm2 save     # Slaat huidige processen op
```

---

## KITT Self-Restart

Met pm2 kan KITT zichzelf restarten:

```bash
# KITT voert dit uit na code wijzigingen:
pm2 restart kitt-bridge
```

De bridge restart en KITT blijft beschikbaar (kleine downtime van ~2 sec).

---

## Commands Reference

| Command | Doel |
|---------|------|
| `npm run pm2:start` | Start bridge via pm2 |
| `npm run pm2:stop` | Stop bridge |
| `npm run pm2:restart` | Restart bridge |
| `npm run pm2:logs` | Bekijk live logs |
| `npm run pm2:status` | Status overzicht |
| `pm2 monit` | Real-time monitoring dashboard |

---

## Acceptance Criteria

- [ ] pm2 geïnstalleerd globaal
- [ ] ecosystem.config.cjs aangemaakt
- [ ] npm scripts toegevoegd
- [ ] Bridge start via `npm run pm2:start`
- [ ] KITT kan `pm2 restart kitt-bridge` uitvoeren
- [ ] Auto-start bij Mac reboot werkt

---

## Notes

- pm2 is de standaard voor Node.js process management
- Logs in `logs/` folder voor debugging
- Kan later uitgebreid worden met meer processen (portal, schedulers)
