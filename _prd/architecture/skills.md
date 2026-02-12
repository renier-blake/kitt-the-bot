# Skills Architecture

> Hoe het KITT skill systeem werkt — discovery, classificatie, dispatch, en execution.

---

## Overview

Skills zijn uitbreidingen die KITT extra capabilities geven. Elke skill is een `SKILL.md` bestand met instructies die KITT leest om te weten HOE hij de skill moet uitvoeren.

**Twee lagen:**
1. **Filesystem** (`.claude/skills/*/SKILL.md`) — Source of truth voor instructies
2. **Database** (`capabilities` tabel) — Metadata, classificatie, enable/disable

---

## Skill Classificatie

### System Skills (locked)

Core KITT functionaliteit. Niet bewerkbaar via Portal. Altijd aanwezig.

| Skill | Execution | Model | Beschrijving |
|-------|-----------|-------|-------------|
| `garmin` | background | haiku | Health data (sleep, HRV, steps, activities) |
| `gmail` | background | haiku | Email via Nango OAuth |
| `calendar` | background | haiku | Google Calendar via Nango OAuth |
| `apple-reminders` | direct | — | macOS Reminders via osascript |
| `memory-search` | background | haiku | Zoek in gesprekken en herinneringen |
| `self-diagnostics` | background | haiku | KITT logs en agent history |
| `nano-banana` | background | sonnet | Image generation via fal.ai |
| `browser` | background | opus | Playwright + Chrome automation |
| `project-management` | direct | — | Issue/project DB queries |

### System Skills — KITT Internal

Niet zichtbaar voor gebruiker. Interne KITT processen.

| Skill | Execution | Model | Beschrijving |
|-------|-----------|-------|-------------|
| `kitt-self-reflection` | background | opus | Dagelijkse zelfreflectie |
| `codebase-health-audit` | background | opus | Security + code quality check |
| `issue` | background | opus | Issue workflow (Telegram) |
| `issue-kitt` | background | opus | Issue workflow (Telegram, variant) |
| `issue-claude` | background | opus | Issue workflow (Claude Code) |
| `create-issue` | direct | — | PO intake flow |

### User Skills (bewerkbaar)

Door gebruiker aangemaakt of aangepast. Kan enabled/disabled worden via Portal.

| Skill | Execution | Model | Beschrijving |
|-------|-----------|-------|-------------|
| `daily-reflection` | direct | — | 6 Minute Diary framework |
| `daily-energy-balance` | background | sonnet | Dagelijkse energie balans |
| `nutrition-log` | background | haiku | Maaltijden loggen en macro tracking |
| `gym-race-coach` | background | opus | GYMRACE/HYROX training coach |
| `workout-plan` | direct | — | Training schema's beheren |
| `blog-writer` | background | opus | Blogpost drafts schrijven |
| `blog-publisher` | background | opus | Drafts publiceren (image, HTML, git) |
| `blog-post-archived` | background | — | Legacy blog skill (disabled) |
| `podcast` | background | opus | Podcast episodes maken |
| `podbean` | background | — | Podbean publishing |
| `linkedin-post` | background | opus | LinkedIn posts via browser |
| `brainstorm` | direct | — | Ideeen verkennen en vastleggen |

---

## Architectuur

```
.claude/skills/           ← Filesystem (SKILL.md instructies)
     ↕ discovery
src/context/loaders/skills-loader.ts  ← Loader (merged filesystem + DB)
     ↕ enrichment
src/capabilities/         ← Database (metadata, classificatie)
     │
     ├── index.ts         ← CRUD, queries, types
     └── seed.ts          ← Seed data (alle skills + tools)
```

### Discovery Flow

```
1. skills-loader scant .claude/skills/ voor SKILL.md bestanden
2. Per skill: parse frontmatter metadata
3. Enrichment: query capabilities DB voor overrides (naam, icon, enabled, skillType)
4. Filter: check agent mode (secure/developer) en enabled status
5. Output: LoadedSkill[] met skillType, trigger, content
```

### Capabilities Database

```sql
CREATE TABLE capabilities (
  id TEXT PRIMARY KEY,           -- Skill ID (= directory naam)
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  category TEXT NOT NULL,        -- 'tool' | 'skill'
  skill_type TEXT,               -- 'system' | 'user' | NULL (tools)
  execution TEXT DEFAULT 'direct', -- 'direct' | 'background'
  model TEXT,                    -- 'haiku' | 'sonnet' | 'opus'
  path TEXT,                     -- '.claude/skills/skill-id'
  triggers TEXT,                 -- JSON array van trigger woorden
  modes TEXT DEFAULT '["developer"]', -- JSON array ['secure', 'developer']
  enabled INTEGER DEFAULT 1,
  sort_order INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
)
```

**DB overrides SKILL.md** voor: `name`, `description`, `icon`, `enabled`, `modes`
**SKILL.md is source of truth** voor: instructie content, frontmatter triggers

### Seed

```bash
npx tsx src/capabilities/seed.ts
```

Seed data staat in `src/capabilities/seed.ts`. Upsert — bestaande records worden geüpdatet, nieuwe aangemaakt.

---

## Execution Model

### Direct Skills

Worden inline uitgevoerd tijdens chat. Geen background task, geen model override.

Voorbeelden: `apple-reminders`, `brainstorm`, `daily-reflection`, `project-management`

### Background Skills (Dispatch)

Worden gedispatcht als background task via het `BACKGROUND_TASK` signaal:

```
BACKGROUND_TASK:{"skill":"garmin","prompt":"Haal mijn slaapdata van gisteren op"}
```

**Flow:**
1. Chat agent genereert kort antwoord + `BACKGROUND_TASK` signaal op laatste regel
2. Router parsed het signaal en dispatcht naar task engine
3. Task engine spawnt sub-agent met SKILL.md als context
4. Sub-agent voert skill uit met opgegeven model (haiku/sonnet/opus)
5. Resultaat wordt teruggestuurd naar gebruiker

### Think Loop Skills

Skills met `trigger: every_time` of `trigger: scheduled` worden geladen in de Think Loop:

- **every_time**: Elke tick gecheckt (bijv. `apple-reminders` fetch)
- **scheduled**: Agent beslist zelf of het moment juist is (bijv. `daily-reflection`)

Think Loop krijgt **alleen** skill beschrijvingen + fetch data. Volledige SKILL.md wordt pas geladen bij execution (Phase 3 van scheduler).

---

## SKILL.md Format

### Frontmatter

```yaml
---
name: skill-name
description: Wat de skill doet (voor context en dispatch catalog)
metadata: {"kitt":{"emoji":"🔧","trigger":"on_demand","model":"haiku","requires":{"bins":["python3"]}}}
---
```

### Metadata Schema

```typescript
interface SkillMetadata {
  kitt?: {
    emoji?: string;
    trigger?: 'every_time' | 'on_demand' | 'scheduled';
    model?: 'haiku' | 'sonnet' | 'opus';
    frequency?: 'daily' | 'weekly' | 'monthly';
    timesPerDay?: number;
    daypart?: 'morning' | 'afternoon' | 'evening' | 'night';
    fetch?: string;           // Shell command voor data ophalen (every_time skills)
    os?: string[];            // ["darwin"] = macOS only
    requires?: {
      bins?: string[];        // Vereiste binaries (python3, curl, etc.)
      skills?: string[];      // Depends on andere skills
    };
  };
}
```

### Content

Na de frontmatter: vrij markdown met instructies voor KITT.

Standaard secties:
- **Wat doet het?** — Korte beschrijving
- **Setup** — Installatie/configuratie
- **Gebruik** — Commands, voorbeelden, workflows
- **Notes** — Belangrijke opmerkingen

---

## Skill Locatie

```
.claude/skills/
├── garmin/                 # System: health data
│   ├── SKILL.md
│   └── scripts/
│       └── garmin_api.py
├── gmail/                  # System: email
│   └── SKILL.md
├── calendar/               # System: agenda
│   └── SKILL.md
├── memory-search/          # System: memory query
│   └── SKILL.md
├── self-diagnostics/       # System: logs/debug
│   └── SKILL.md
├── nano-banana/            # System: image gen
│   └── SKILL.md
├── browser/                # System: automation
│   └── SKILL.md
├── daily-reflection/       # User: routine
│   └── SKILL.md
├── nutrition-log/          # User: tracking
│   └── SKILL.md
├── blog-writer/            # User: content
│   └── SKILL.md
└── ...                     # 27 skills totaal
```

---

## Nieuwe Skill Maken

### 1. Maak directory + SKILL.md

```bash
mkdir -p .claude/skills/my-skill
```

```markdown
---
name: my-skill
description: Wat de skill doet
metadata: {"kitt":{"emoji":"🔧"}}
---

# My Skill

## Wat doet het?
[beschrijving]

## Gebruik
[voorbeelden en commands]
```

### 2. Registreer in capabilities DB

Voeg toe aan `src/capabilities/seed.ts`:

```typescript
{
  id: 'my-skill',
  name: 'My Skill',
  description: 'Wat de skill doet',
  icon: '🔧',
  category: 'skill',
  skillType: 'user',        // of 'system'
  execution: 'background',  // of 'direct'
  model: 'haiku',           // of 'sonnet' / 'opus'
  path: '.claude/skills/my-skill',
  triggers: ['trigger-woord-1', 'trigger-woord-2'],
  modes: ['secure', 'developer'],
  sortOrder: 100,
},
```

### 3. Run seed

```bash
npx tsx src/capabilities/seed.ts
```

### 4. (Optional) Scripts

Voor skills met Python/andere scripts:

```
.claude/skills/my-skill/
├── SKILL.md
├── scripts/
│   └── main.py
└── .venv/          # Python virtual env
```

---

## Key Files

| File | Doel |
|------|------|
| `.claude/skills/*/SKILL.md` | Skill instructies (source of truth) |
| `src/capabilities/index.ts` | Capabilities DB schema + CRUD |
| `src/capabilities/seed.ts` | Seed data (alle tools + skills) |
| `src/context/loaders/skills-loader.ts` | Discovery, enrichment, formatting |
| `src/context/types.ts` | `LoadedSkill`, `SkillMetadata` types |
| `profile/context/blocks.json` | Context config (skills block) |

---

## Security

### Audit Checklist

Bij nieuwe skills:
- [ ] Lees volledige SKILL.md
- [ ] Check wat de skill kan lezen/schrijven
- [ ] Check network calls
- [ ] Check credential access
- [ ] Verify `modes` — moet deze skill in `secure` mode?

### Red Flags

- Onverwachte network calls
- Toegang tot credentials buiten scope
- Obfuscated code
- Geen duidelijke auteur/bron
