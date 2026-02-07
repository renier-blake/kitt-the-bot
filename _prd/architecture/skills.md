# Skills Architecture

> Hoe het KITT skill systeem werkt.

---

## Overview

Skills zijn uitbreidingen die KITT extra capabilities geven:
- API integraties (Garmin, Todoist, Apple Reminders)
- Tools (Whisper transcriptie, nutrition logging)
- Scheduled routines (daily reflection, gym coach)

Skills worden gedocumenteerd in SKILL.md files die KITT leest om te weten HOE hij de skill moet gebruiken.

---

## Skill Locatie

```
.claude/skills/
├── apple-reminders/
│   └── SKILL.md
├── nutrition-log/
│   └── SKILL.md
├── daily-reflection/
│   └── SKILL.md
├── garmin/
│   ├── SKILL.md
│   └── scripts/
│       └── garmin_api.py
├── gym-race-coach/
│   └── SKILL.md
└── nano-banana/
    └── SKILL.md
```

---

## SKILL.md Format

### Frontmatter

```yaml
---
name: skill-name
description: Wat de skill doet (voor KITT's context)
metadata: {"kitt":{"emoji":"🔧","requires":{"bins":["python3"],"env":["API_KEY"]}}}
---
```

### Metadata Schema

```typescript
interface SkillMetadata {
  kitt: {
    emoji: string;           // Voor display
    os?: string[];           // ["darwin"] = macOS only
    model?: 'haiku' | 'sonnet' | 'opus'; // Model preference (default: haiku)
    requires?: {
      bins?: string[];       // Vereiste binaries
      env?: string[];        // Vereiste environment variables
    };
    install?: InstallStep[]; // Installatie instructies
    schedule?: {             // Voor scheduled skills
      frequency: 'daily' | 'weekly' | 'monthly';
      daypart?: 'morning' | 'afternoon' | 'evening' | 'night';
    };
  };
}
```

**Model keuze:**
- `haiku` - Snel en goedkoop, voor simpele taken (heartbeat, simple skills)
- `sonnet` - Balanced, voor gemiddelde complexiteit
- `opus` - Meest capable, voor complexe taken (development, content writing)
```

**Schedule is simpel:**
- `frequency`: hoe vaak de skill moet draaien
- `daypart`: hint voor wanneer (niet verplicht)

De agent krijgt de volledige SKILL.md en beslist zelf wanneer het juiste moment is.

### Content

Na de frontmatter bevat SKILL.md:

**Voor scheduled skills - Priority sectie (optioneel):**
```markdown
## Priority

**Skill priority:** High | Medium | Low
**Flexibiliteit:** Hoog | Laag
```

De agent begrijpt zelf wat urgent is - geen uitleg nodig.

**Standaard secties:**
- **Wat doet het?** - Korte beschrijving
- **Setup** - Installatie stappen indien nodig
- **Gebruik** - Commands, voorbeelden, workflows
- **Notes** - Belangrijke opmerkingen

---

## Skill Types

### 1. Tool Skills

Skills die KITT tools geven om taken uit te voeren:

```yaml
---
name: apple-reminders
description: Manage Apple Reminders via remindctl CLI
metadata: {"kitt":{"emoji":"⏰","os":["darwin"],"requires":{"bins":["remindctl"]}}}
---
```

KITT leest de SKILL.md en weet dan:
- Welke commands beschikbaar zijn
- Hoe output te interpreteren
- Wanneer de skill te gebruiken

### 2. Data Skills

Skills voor data logging en retrieval:

```yaml
---
name: nutrition-log
description: Log meals and track nutrition
metadata: {"kitt":{"emoji":"🥗","requires":{"bins":["sqlite3"]}}}
---
```

### 3. Scheduled Skills

Skills die periodiek getriggerd moeten worden:

```yaml
---
name: daily-reflection
description: Dagelijkse check-in met ochtend en avond routine
metadata: {"kitt":{"emoji":"🌅","schedule":{"frequency":"daily","daypart":"morning"}}}
---
```

De Think Loop (heartbeat):
1. Geeft de volledige SKILL.md aan de agent
2. Agent leest transcripts en bepaalt zelf:
   - Is dit al gedaan vandaag?
   - Is het een goed moment?
   - Is de user beschikbaar?
3. Geen hardcoded time windows of detect patterns

---

## Think Loop Integration

De heartbeat (elke ~5 minuten) geeft de agent alle data:

```
Heartbeat wakes up
    ↓
Collect data (geen logic):
    - Alle transcripts van vandaag
    - Scheduled skills met volledige SKILL.md
    - Huidige tijd, dag, week
    - Laatste user message
    ↓
Agent krijgt alles en beslist zelf:
    - Lees transcripts: wat is er vandaag besproken?
    - Lees SKILL.md: wat moet deze skill doen?
    - Bepaal: is dit al gedaan? Is dit een goed moment?
    - Kijk naar context: is user beschikbaar?
    ↓
Agent antwoordt:
    - HEARTBEAT_OK (niets doen)
    - MEMORY: (iets onthouden)
    - Direct bericht (actie nemen)
```

**Geen hardcoded patterns, time windows, of detect logic.**
De agent is intelligent genoeg om context te begrijpen.

---

## Gating (Requirements Check)

Skills kunnen requirements specificeren:

```json
"requires": {
  "bins": ["remindctl", "python3"],
  "env": ["OPENAI_API_KEY"]
}
```

KITT checkt voor gebruik:
1. Zijn alle binaries beschikbaar? (`which binary`)
2. Zijn alle env vars gezet? (`process.env[VAR]`)

Als niet voldaan: skill wordt overgeslagen of KITT meldt wat ontbreekt.

---

## Nieuwe Skill Maken

### 1. Maak directory

```bash
mkdir -p .claude/skills/my-skill
```

### 2. Maak SKILL.md

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

### 3. (Optional) Scripts

Voor complexe skills met Python/andere scripts:

```
.claude/skills/my-skill/
├── SKILL.md
├── scripts/
│   └── main.py
└── .venv/          # Python virtual env
```

---

## Bestaande Skills

| Skill | Type | Model | Description |
|-------|------|-------|-------------|
| `apple-reminders` | Tool | haiku | macOS Reminders via remindctl |
| `nutrition-log` | Data | haiku | Meal logging en macro tracking |
| `daily-reflection` | Scheduled | haiku | Ochtend en avond routines |
| `garmin` | Data | haiku | Health data (sleep, HRV, steps) |
| `gym-race-coach` | Scheduled | haiku | Training coach, readiness, workouts |
| `nano-banana` | Tool | haiku | Image generation via fal.ai |

---

## Security

### Audit Checklist

Bij nieuwe skills:
- [ ] Lees volledige SKILL.md
- [ ] Check wat de skill kan lezen/schrijven
- [ ] Check network calls
- [ ] Check credential access

### Red Flags

- Onverwachte network calls
- Toegang tot credentials buiten scope
- Obfuscated code
- Geen duidelijke auteur/bron

---

## Best Practices

1. **Eén SKILL.md per skill** - Alles in één file voor KITT's context
2. **Duidelijke voorbeelden** - KITT leert door voorbeelden
3. **Minimale dependencies** - Minder kan breken
4. **Defensive coding** - Graceful fallbacks als iets niet werkt
5. **Schedule alleen indien nodig** - Niet elke skill hoeft scheduled te zijn
