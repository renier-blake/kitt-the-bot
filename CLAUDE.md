# KITT - Personal AI Assistant

> **Project:** KITT (Knowledge Interface for Transparent Tasks)
> **Doel:** Transparante, multi-channel AI assistent met Claude Code als engine

---

## Quick Reference

| Wat | Waar |
|-----|------|
| **PO Workflow** | `_prd/workflows/PO.md` |
| **Agent Workflow** | `_prd/workflows/AGENT.md` |
| **Feature Template** | `_prd/templates/FEATURE.md` |
| **Features** | `_prd/features/` |
| **Skills** | `.claude/skills/` |
| **Think Loop** | `_prd/THINK-LOOP.md` |

---

## Development Regels

### NIET DOEN

- **NOOIT committen zonder toestemming**
- **NOOIT secrets hardcoden** - alleen in `.env`

### Bridge Beheer (PM2)

De bridge draait via **pm2** zodat logs beschikbaar zijn via de KITT Portal.

```bash
# Starten
pm2 start npm --name kitt -- run bridge

# Herstarten
pm2 restart kitt

# Stoppen
pm2 stop kitt

# Logs bekijken
pm2 logs kitt
# OF open http://localhost:3000 (KITT Portal)
```

---

## Skills Systeem

Skills staan in `.claude/skills/`. Elke skill heeft een `SKILL.md`.

### Beschikbare Skills

| Skill | Doel |
|-------|------|
| garmin | Health data (slaap, HRV, stappen) |
| nutrition-log | Voeding tracken |
| apple-reminders | Apple Reminders |
| daily-reflection | Dagelijkse reflectie |
| gym-race-coach | Training coaching |

### Hoe Skills Werken

1. User vraagt iets ("check mijn stappen")
2. Agent zoekt matching skill in `.claude/skills/`
3. Agent leest `SKILL.md` voor instructies
4. Agent voert instructies uit

---

## Think Loop

De Think Loop draait elke 5 minuten autonoom. Zie `_prd/THINK-LOOP.md`.

**Logging:** Alle reasoning wordt gelogd in `[think-loop]` prefix.

---

## Model

**Opus 4.5** - altijd (geen Haiku routing meer)

---

## Kritieke Files

| File | Doel |
|------|------|
| `profile/memory/MEMORY.md` | Working memory, user facts |
| `profile/identity/IDENTITY.md` | Wie KITT is |
| `profile/identity/SOUL.md` | Ethiek, gedrag, think loop |

---

## Folder Structuur

```
KITT V1/
├── .claude/skills/           # Skills (garmin, nutrition, etc.)
├── profile/                  # User data & KITT personality
│   ├── identity/             # IDENTITY.md, SOUL.md
│   └── memory/               # MEMORY.md, kitt.db
├── src/bridge/               # Telegram → Agent SDK
└── _prd/                     # Documentatie
```

---

## Conventies

- **Taal:** Nederlands (docs), Engels (code)
- **Logging:** `[think-loop]` voor think loop, `[scheduler]` voor cron tasks
