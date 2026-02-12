# KITT - Personal AI Assistant

> **Project:** KITT (Knowledge Interface for Transparent Tasks)
> **Doel:** Transparante, multi-channel AI assistent met Claude Code als engine

---

## Quick Reference

| Wat | Waar |
|-----|------|
| **Database** | `profile/data/kitt.db` |
| **Issues & Projecten** | `portal_issues`, `portal_projects` tabellen |
| **Issue Workflow** | `/issue PAS-01` of `/issue KITT-05` |
| **Skills** | `.claude/skills/` |
| **Context Config** | `profile/context/blocks.json` |
| **Architecture** | `_prd/architecture/` |

---

## Development Regels

### NIET DOEN

- **NOOIT committen zonder toestemming**
- **NOOIT secrets hardcoden** - alleen in `.env`

### Bridge Beheer (PM2)

De bridge draait via **pm2** zodat logs beschikbaar zijn via de KITT Portal.

**BELANGRIJK:** Gebruik altijd `bridge:start` (niet `bridge`). Het `bridge` script gebruikt `tsx watch` dat constant herstart bij file changes en het proces verstoort.

```bash
# Starten (ZONDER watch mode)
pm2 start npm --name kitt -- run bridge:start

# Herstarten
pm2 restart kitt

# Stoppen
pm2 stop kitt

# Logs bekijken
pm2 logs kitt
# OF open http://localhost:8000 (KITT Portal via Bridge)
```

---

## Project Management (Database)

Issues en projecten worden beheerd in SQLite: `profile/data/kitt.db`

### Issue Starten

```bash
/issue PAS-01
```

Dit:
1. Haalt issue op uit `portal_issues` tabel
2. Leest relevante docs op basis van project
3. Gaat in Plan Mode
4. Bouwt na goedkeuring
5. Update state naar `done`
6. Vraagt commit toestemming

### Database Tabellen

| Tabel | Doel |
|-------|------|
| `portal_projects` | Projecten (PAS, KITT, POR, SKL, etc.) |
| `portal_issues` | Issues per project |
| `portal_triage` | Triage items (automatisch gevonden issues) |

### Issue Query

```bash
sqlite3 -json profile/data/kitt.db "
  SELECT i.identifier, i.title, i.description, i.type, i.state, i.priority,
         p.identifier as project
  FROM portal_issues i
  LEFT JOIN portal_projects p ON i.project_id = p.id
  WHERE i.identifier = 'PAS-01'
"
```

---

## Context System

KITT's context wordt gebouwd via `profile/context/blocks.json`. Dit bepaalt welke bestanden en loaders worden geladen voor chat en think loop modes. Zie `_prd/architecture/context.md` voor details.

### blocks.json

```json
{
  "version": 1,
  "blocks": [
    { "id": "identity", "type": "file", "path": "profile/identity/IDENTITY.md", ... },
    { "id": "skills", "type": "dynamic", "source": "skills-loader", ... }
  ]
}
```

### Block Types

| Type | Beschrijving |
|------|-------------|
| `file` | Laad .md bestand |
| `dynamic` | Run loader (skills, transcripts, tasks, etc.) |
| `instruction` | Laad instructie bestand |

### Instructions

Hardcoded instructies staan nu in `profile/context/instructions/`:
- `core.md` - Basis gedragsinstructies
- `capabilities.md` - Memory search, sleep/DND mode
- `think-loop.md` - Think loop taak + response format

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
| gmail | Email via Nango OAuth |
| issue | Start werken aan een issue |

### Hoe Skills Werken

1. User vraagt iets ("check mijn stappen")
2. Agent zoekt matching skill in `.claude/skills/`
3. Agent leest `SKILL.md` voor instructies
4. Agent voert instructies uit

---

## Think Loop

De Think Loop draait elke 5 minuten autonoom. Zie `_prd/architecture/think-loop.md` voor details.

**Logging:** Alle reasoning wordt gelogd in `[think-loop]` prefix.

---

## Model

**Opus 4.5** - altijd (geen Haiku routing meer)

---

## Kritieke Files

| File | Doel |
|------|------|
| `profile/identity/MEMORY.md` | Working memory, user facts |
| `profile/identity/IDENTITY.md` | Wie KITT is |
| `profile/identity/SOUL.md` | Ethiek, gedrag |
| `profile/identity/HUMOR.md` | Humor stijl |
| `profile/context/blocks.json` | Context configuratie |

---

## Folder Structuur

```
KITT V1/
├── .claude/skills/           # Skills (garmin, nutrition, gmail, issue, etc.)
├── profile/                  # User data & KITT personality
│   ├── identity/             # IDENTITY.md, SOUL.md, HUMOR.md, MEMORY.md
│   ├── user/                 # USER.md
│   ├── context/              # blocks.json, instructions/
│   └── data/                 # kitt.db, sessions, state, runtime
├── src/
│   ├── bridge/               # Telegram → Agent SDK
│   ├── context/              # Unified context builder
│   ├── scheduler/            # Think Loop, Task Engine
│   ├── memory/               # Memory service, hybrid search
│   └── integrations/         # Nango OAuth, externe APIs
├── frontends/portal/         # KITT Portal (issues, logs, integraties)
└── _prd/                     # Architecture & briefings
```

---

## Conventies

- **Taal:** Nederlands (docs), Engels (code)
- **Logging:** `[think-loop]` voor think loop, `[scheduler]` voor cron tasks
