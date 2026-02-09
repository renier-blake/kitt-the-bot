# F34: Think Loop Debug

> **Priority:** P0 - Kritiek
> **Status:** 📝 Spec
> **Owner:** -

---

## Overview

De Think Loop interval timer draait niet correct. Bridge gestart om 10:00, maar 10:10 tick kwam niet.

---

## Probleem

- Bridge draait (`npm run bridge`)
- `setInterval` zou elke 5 minuten moeten triggeren
- Maar er komt geen `[think-loop] ⏰ Tick` log

Mogelijke oorzaken:
1. Timer start niet
2. Timer crasht silently
3. Throttle blokkeert alles

---

## Relevante Files

| File | Rol |
|------|-----|
| `src/bridge/index.ts:64-86` | setInterval timer definitie |
| `src/scheduler/index.ts:233-266` | checkHeartbeat() met throttle |
| `profile/schedules/registry.json` | throttleMinutes: 5, lastRun |

---

## Debug Stappen

1. Check bridge logs voor errors
2. Check of timer daadwerkelijk gestart wordt
3. Check throttle logic in checkHeartbeat()
4. Check registry.json lastRun timestamp

---

## Acceptance Criteria

- [ ] `[think-loop] ⏰ Tick` log verschijnt elke 5 minuten
- [ ] Heartbeat draait OF is throttled (beide gelogd)
- [ ] Geen silent crashes

---

## Test Cases

1. **Start bridge** → Verwacht: "Think loop started" log
2. **Wacht 5 min** → Verwacht: "Tick at HH:MM" log
3. **Check throttle** → Als lastRun < 5 min geleden: "Throttled" log
