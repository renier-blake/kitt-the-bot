# F35: Think Loop Docs Update

> **Priority:** P1
> **Status:** 📝 Spec
> **Owner:** -

---

## Overview

`_prd/THINK-LOOP.md` beschrijft verouderde "incoming message" trigger. De Think Loop draait nu via autonome interval timer.

---

## Probleem

Huidige doc zegt:
- "Na elk Telegram bericht wordt checkHeartbeat() aangeroepen"

Maar realiteit is:
- `setInterval` in `bridge/index.ts` triggert elke 5 min
- Onafhankelijk van berichten

---

## Relevante Files

| File | Actie |
|------|-------|
| `_prd/THINK-LOOP.md` | Update nodig |
| `src/bridge/index.ts:64-86` | Huidige implementatie |

---

## Wijzigingen

1. Update "Hoe het werkt" sectie
2. Verwijder "incoming message" referenties
3. Update diagram met interval timer
4. Update config sectie (throttleMinutes uitleg)

---

## Acceptance Criteria

- [ ] THINK-LOOP.md beschrijft interval-based trigger
- [ ] Diagram toont setInterval → checkHeartbeat flow
- [ ] Geen referenties naar "incoming message" trigger
