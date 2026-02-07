# F59: Agent Rules Separation

> **Priority:** 🟡 P2
> **Status:** 📝 Spec
> **Owner:** -

---

## Overview

Verhuizing van operationele regels uit SOUL.md naar een apart bestand. SOUL.md moet puur values en persoonlijkheid bevatten, niet technische handleidingen (sleep mode commands, think loop uitleg, etc.).

---

## Rationale

SOUL.md doet nu drie dingen:
1. **Values & persoonlijkheid** (core truths, vibe, boundaries) ← hoort er
2. **Operationele regels** (sleep mode, think loop, continuity) ← hoort er niet
3. **Security & skill regels** ← grijze zone

Na de scheiding:
- **SOUL.md** = puur wie KITT is (values, vibe, boundaries)
- **RULES.md** (nieuw) = hoe KITT werkt (operationele regels, sleep mode, security)
- **RULES.md** wordt toegevoegd aan de bootloader (`context.ts`)

---

## Componenten

| Component | Nodig | Beschrijving |
|-----------|-------|--------------|
| Skill | ❌ | - |
| Task | ❌ | - |
| Schema | ❌ | - |
| Backend | ✅ | `src/bridge/context.ts` — RULES.md toevoegen aan bootloader |
| Portal | ❌ | - |

---

## Files

| File | Actie | Beschrijving |
|------|-------|--------------|
| `profile/identity/SOUL.md` | Modify | Operationele secties verwijderen |
| `profile/identity/RULES.md` | Create | Operationele regels, sleep mode, security |
| `src/bridge/context.ts` | Modify | RULES.md toevoegen aan loadContext + buildSystemPrompt |
| `src/scheduler/think-loop.ts` | Modify | RULES.md toevoegen aan think loop context |

---

## Lees Eerst

- `profile/identity/SOUL.md` — Huidige inhoud analyseren
- `src/bridge/context.ts` — Bootloader begrijpen
- `src/scheduler/think-loop.ts` — Think loop context loading
