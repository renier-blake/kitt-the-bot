# KITT - Personal AI Assistant

> **Project:** KITT (Knowledge Interface for Transparent Tasks)
> **Doel:** Transparante, multi-channel AI assistent met Claude Code als engine

---

## Quick Reference

| Wat | Waar |
|-----|------|
| **Issues & Projecten** | `profile/memory/kitt.db` (portal_issues, portal_projects) |
| **Issue Workflow** | `/issue PAS-01` of `/issue KITT-05` |
| **Skills** | `.claude/skills/` |
| **Think Loop** | `_prd/THINK-LOOP.md` |
| **Architecture** | `_prd/architecture/` |

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
# OF open http://localhost:8000 (KITT Portal via Bridge)
```

---

## Project Management (Database)

Issues en projecten worden beheerd in SQLite: `profile/memory/kitt.db`

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
sqlite3 -json profile/memory/kitt.db "
  SELECT i.identifier, i.title, i.description, i.type, i.state, i.priority,
         p.identifier as project
  FROM portal_issues i
  LEFT JOIN portal_projects p ON i.project_id = p.id
  WHERE i.identifier = 'PAS-01'
"
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
| gmail | Email via Nango OAuth |
| issue | Start werken aan een issue |

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
├── .claude/skills/           # Skills (garmin, nutrition, gmail, issue, etc.)
├── profile/                  # User data & KITT personality
│   ├── identity/             # IDENTITY.md, SOUL.md
│   └── memory/               # MEMORY.md, kitt.db (project management)
├── src/
│   ├── bridge/               # Telegram → Agent SDK
│   └── integrations/         # Nango OAuth, externe APIs
├── frontends/kitt-portal/    # KITT Portal (issues, logs, integraties)
└── _prd/                     # Architecture & briefings
```

---

## Conventies

- **Taal:** Nederlands (docs), Engels (code)
- **Logging:** `[think-loop]` voor think loop, `[scheduler]` voor cron tasks
