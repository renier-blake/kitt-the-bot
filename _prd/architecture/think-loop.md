# Think Loop Architecture

> De kern van KITT's autonomie - minimal hardcoding, maximal intelligence

## Philosophy

**De agent is slim genoeg.** We geven alleen data, de agent beslist.

| Hardcoded | Agent Besluit |
|-----------|---------------|
| ~~Regex patterns~~ | Leest transcripts |
| ~~Time windows~~ | Begrijpt context |
| ~~Defer detection~~ | Ziet "later" in gesprek |
| ~~Completion check~~ | Ziet of iets al gedaan is |

## Overview

De **Think Loop** (ook: Heartbeat) is het mechanisme waardoor KITT autonoom gedrag vertoont. In plaats van rigide cron-jobs die op vaste tijden taken uitvoeren, "wordt KITT wakker" op regelmatige intervallen en reflecteert op wat er gebeurd is.

Dit creëert **organisch, menselijk assistent-gedrag**.

## Waarom Think Loop?

| Traditionele Automation | Think Loop |
|------------------------|------------|
| "Om 08:00: stuur workout" | "Hmm, Renier is wakker (recent bericht). Tijd voor de ochtend routine!" |
| Rigide, voorspelbaar | Contextueel, adaptief |
| Geen geheugen van gesprekken | Reflecteert op de hele dag |
| Alleen scheduled tasks | Kan proactief handelen |
| Geen awareness van wat al gedaan is | Detecteert zelf of routines al gedaan zijn |

## Hoe Het Werkt

```
┌─────────────────────────────────────────────────────────────┐
│                   INTERVAL TIMER (5 min)                     │
│                  (setInterval in bridge)                     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    THROTTLE CHECK                            │
│              (max 1x per 5 minuten)                          │
└─────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │                   │
               < 5 min              ≥ 5 min
                    │                   │
                    ▼                   ▼
               [SKIP]          ┌───────────────┐
                               │ BUILD CONTEXT │
                               └───────────────┘
                                       │
                                       ▼
                    ┌─────────────────────────────────────────┐
                    │           THINK LOOP CONTEXT (F40)       │
                    │  • Identity, Soul, User, Memory.md      │
                    │  • Alle gesprekken van vandaag          │
                    │  • Eigen thoughts (MESSAGE/MEMORY/etc)  │
                    │  • Huidige tijd & context               │
                    │  • Skills (every_time + scheduled)      │
                    │  • Memory Search CLI beschikbaar        │
                    └─────────────────────────────────────────┘
                                       │
                                       ▼
                    ┌─────────────────────────────────────────┐
                    │      DISCOVER SCHEDULED SKILLS           │
                    │  Scan .claude/skills/*/SKILL.md          │
                    │  voor skills met schedule metadata       │
                    └─────────────────────────────────────────┘
                                       │
                                       ▼
                    ┌─────────────────────────────────────────┐
                    │              THINK PROMPT                │
                    │  "Je wordt wakker. Hier is wat er       │
                    │   vandaag besproken is. Denk na:        │
                    │   - Scheduled skill te triggeren?       │
                    │   - Follow-up nodig?                    │
                    │   - Plannen te checken?                 │
                    │   - Iets geleerd te onthouden?"         │
                    └─────────────────────────────────────────┘
                                       │
                                       ▼
                    ┌─────────────────────────────────────────┐
                    │           CLAUDE AGENT                   │
                    │      (dezelfde engine als chat)          │
                    └─────────────────────────────────────────┘
                                       │
               ┌───────────────────────┼───────────────────────┐
               │                       │                       │
               ▼                       ▼                       ▼
      ┌────────────┐          ┌────────────┐          ┌────────────┐
      │HEARTBEAT_OK│          │  MEMORY:   │          │  SKILL: /  │
      │  (niets)   │          │ (onthouden)│          │  MESSAGE   │
      └────────────┘          └────────────┘          └────────────┘
```

## Scheduled Skills

Skills kunnen een schedule definiëren in hun SKILL.md metadata:

```yaml
metadata: {"kitt":{"emoji":"🌅","schedule":{"frequency":"daily","daypart":"morning"}}}
```

### Schedule Format (Simpel)

| Field | Values | Description |
|-------|--------|-------------|
| `frequency` | `daily`, `weekly`, `monthly` | Hoe vaak |
| `daypart` | `morning`, `afternoon`, `evening`, `night` | Hint, niet verplicht |

### Wat de Agent Krijgt (F40 Update)

```
1. KITT Identity (IDENTITY.md, SOUL.md)
2. User Info (USER.md)
3. Working Memory (MEMORY.md)
4. Alle transcripts van vandaag (incl. eigen thoughts)
5. Skills (every_time + scheduled) met fetch data
6. Tijd, dag, week nummer
7. Laatste user message (met "minuten geleden")
8. Memory Search CLI docs (kan verder terug zoeken)
```

### Wat de Agent Beslist

De agent leest alles en bepaalt zelf:

- **Heb ik dit vandaag al gedaan?** (leest transcripts)
- **Is het een goed moment?** (kijkt naar tijd, daypart hint)
- **Is de user beschikbaar?** (laatste bericht, context)
- **Zei hij "later"?** (leest gesprek)
- **Moet ik opnieuw proberen?** (context-aware)

### Voorbeeld Flow

```
Heartbeat @ 08:30
    ↓
Context bouwen:
    - Transcripts: "geen gesprekken vandaag"
    - Skills: daily-reflection (daily, morning)
    - Laatste user msg: geen
    ↓
Agent denkt:
    - "Het is ochtend, daily-reflection is nog niet gedaan"
    - "Maar Renier heeft nog niks gezegd - slaapt hij nog?"
    - "Ik wacht even"
    ↓
Response: HEARTBEAT_OK

---

Heartbeat @ 09:15
    ↓
Context bouwen:
    - Transcripts: "[09:10] Renier: hey"
    - Skills: daily-reflection (daily, morning)
    - Laatste user msg: "hey" (5 min geleden)
    ↓
Agent denkt:
    - "Renier is wakker! Hij stuurde net een bericht"
    - "Daily reflection is nog niet gedaan"
    - "Dit is een goed moment"
    ↓
Response: 🌅 Goedemorgen Renier! ...
```

### Huidige Scheduled Skills

| Skill | Frequency | Daypart | Beschrijving |
|-------|-----------|---------|--------------|
| **daily-reflection** | daily | morning | Ochtend/avond routine |

## Configuratie

In `profile/schedules/registry.json`:

```json
{
  "heartbeat": {
    "enabled": true,
    "throttleMinutes": 5,
    "lastRun": null,
    "model": "haiku"
  },
  "telegramChatId": 1306998969
}
```

### Model Keuze

| Model | Gebruik | Kosten |
|-------|---------|--------|
| `haiku` | Heartbeat, simpele skills | Laag |
| `sonnet` | Gemiddelde complexiteit | Midden |
| `opus` | Development, content writing | Hoog |

De heartbeat draait standaard met Haiku voor kostenefficiëntie (~2000-3500 tokens per heartbeat).

Skills kunnen hun eigen model specificeren in metadata:

```yaml
metadata: {"kitt":{"emoji":"📝","model":"opus","schedule":{"frequency":"daily"}}}
```

## Response Types (F40 Update)

De agent kan vier soorten responses geven:

### 1. `ACTION: OK`
Geen actie nodig. KITT heeft gereflecteerd en concludeert dat alles OK is.
**Niet opgeslagen** - voorkomt database noise.

### 2. `ACTION: MESSAGE`
KITT stuurt een bericht naar Telegram.
**Opgeslagen als thought** - KITT ziet later dat hij dit gestuurd heeft.

### 3. `ACTION: MEMORY`
KITT wil iets onthouden in MEMORY.md.
**Opgeslagen als thought** - KITT ziet later dat hij dit onthouden heeft.

### 4. `ACTION: REFLECT`
KITT maakt een observatie/reflectie zonder externe actie.
**Opgeslagen als thought** - Voor patronen, inzichten, self-awareness.

### Thoughts Systeem (F40)

Acties worden opgeslagen in `transcripts` met:
- `role: 'thought'`
- `channel: 'think-loop'`

Dit geeft KITT **self-awareness**: hij ziet in de volgende tick wat hij eerder gedaan heeft, wat dubbele acties voorkomt.

| Action | Opslaan? | Voorbeeld |
|--------|----------|-----------|
| OK | ❌ Nee | "Routine check, niets te doen" |
| MESSAGE | ✅ Ja | "Bericht gestuurd: Herinnering tandarts" |
| MEMORY | ✅ Ja | "Opgeslagen: Tandarts is Dr. Jansen" |
| REFLECT | ✅ Ja | "Observatie: Productieve dag voor Renier" |

## Files

| File | Doel |
|------|------|
| `src/scheduler/think-loop.ts` | Context builder, skill discovery, prompt generator, response parser |
| `src/scheduler/index.ts` | Scheduler service met `runThinkLoop()` |
| `src/cli/kitt-search.ts` | Memory Search CLI (semantic search) |
| `.claude/skills/*/SKILL.md` | Skills met trigger metadata (every_time, scheduled, on_demand) |

## Memory Search (F40)

Think Loop kan zoeken in alle gesprekken via CLI:

```bash
npm run search -- "tandarts afspraak"     # Semantic search
npm run search -- "herinnering" -l 20     # Meer resultaten
npm run search -- "KITT" --exact          # Exacte match
```

Dit geeft Think Loop toegang tot history verder dan vandaag, zonder dat we automatisch elke keer een vector search doen.

## Best Practices

1. **Stilte is OK** - KITT hoeft niet elke 5 min iets te sturen
2. **Context-aware** - Berichten passen bij het tijdstip (ochtend vs avond)
3. **Niet opdringerig** - Alleen sturen als het echt waardevol is
4. **Reflectief** - KITT denkt na, leert, onthoudt
5. **Organisch** - Voelt als een echte assistent, niet als automation
6. **Skill-driven** - Schedules komen uit SKILL.md, niet hardcoded
7. **Self-aware** - KITT ziet zijn eigen thoughts, voorkomt dubbele acties

## Toekomstige Verbeteringen

- [x] **F40:** Identity/Soul/User context in Think Loop
- [x] **F40:** Thoughts systeem (self-awareness)
- [x] **F40:** Memory Search CLI
- [ ] Garmin data als trigger (sleep ended → start ochtend routine)
- [ ] Calendar awareness (aankomende afspraken)
- [ ] Email scanning (belangrijke emails)
- [ ] Nutrition log awareness (meals gelogd?)
- [ ] Long-term learning consolidation
- [ ] Meer scheduled skills (weekly review, etc.)
