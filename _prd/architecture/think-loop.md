# Think Loop Architecture

> De kern van KITT's autonomie - minimal hardcoding, maximal intelligence
> **Laatst bijgewerkt:** 9 februari 2026

## Philosophy

**De agent is slim genoeg.** We geven alleen data, de agent beslist.

| Hardcoded | Agent Besluit |
|-----------|---------------|
| ~~Regex patterns~~ | Leest transcripts |
| ~~Time windows~~ | Begrijpt context |
| ~~Defer detection~~ | Ziet "later" in gesprek |
| ~~Completion check~~ | Ziet of iets al gedaan is |

## Overview

De **Think Loop** is het mechanisme waardoor KITT autonoom gedrag vertoont. Elke 5 minuten "wordt KITT wakker" en reflecteert op wat er gebeurd is. Het combineert identiteit, gesprekken, taken en skills om te beslissen of actie nodig is.

## Hoe Het Werkt

```
┌──────────────────────────────────────────────────────┐
│              INTERVAL TIMER (5 min)                    │
│             (setInterval in bridge/index.ts)           │
└──────────────────────┬───────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────┐
│              PRE-FLIGHT CHECKS                        │
│  1. Sleep mode?  → Skip (zzz)                        │
│  2. Wake reminder expired? → Stuur wake msg, clear   │
│  3. DND mode? → Log, maar ga door (geen berichten)   │
│  4. Processing lock? → Skip (chat agent is bezig)    │
└──────────────────────┬───────────────────────────────┘
                       │ All clear
                       ▼
┌──────────────────────────────────────────────────────┐
│         UNIFIED CONTEXT BUILDER                       │
│  buildContext({ mode: 'think', db })                 │
│  → Zie: _prd/architecture/context.md                 │
│                                                       │
│  Loads via profile/context/blocks.json:              │
│  • Identity, Soul, Humor, User, Working Memory       │
│  • Skills (every_time + scheduled) met fetch data    │
│  • Alle transcripts van vandaag                      │
│  • Conversatie status (gaps, unanswered)             │
│  • Open taken (Task Engine)                          │
│  • Instructies (core, capabilities, think-loop)      │
└──────────────────────┬───────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────┐
│        PRE-PROCESS: SUB-AGENT TASKS (F63)            │
│  Tasks met model != thinkLoop model (bijv. opus)     │
│  worden apart afgehandeld door een sub-agent          │
│  → Verwijderd uit taken lijst voor main prompt       │
└──────────────────────┬───────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────┐
│              AGENT RUN                                │
│  runAgent(systemPrompt, { model, skipMemorySearch }) │
│  → System prompt bevat alle context                  │
│  → Geen aparte memory search (al in context)         │
└──────────────────────┬───────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────┐
│              CLAUDE AGENT (Opus)                      │
│         (dezelfde engine als chat)                    │
└──────────────────────┬───────────────────────────────┘
                       │
       ┌───────────────┼───────────────┐
       │               │               │
       ▼               ▼               ▼
  ACTION: OK     ACTION: MESSAGE  ACTION: TASK #id
   (niets)       ACTION: MEMORY   ACTION: COMPLETE_TASK #id
                 ACTION: REFLECT
```

## Pre-flight Checks

Vóór de Think Loop begint met denken, worden er vier checks gedaan (in volgorde):

| Check | Wat | Actie bij trigger |
|-------|-----|-------------------|
| **Wake reminder** | Is de wake-up tijd verstreken? | Stuur wake-up bericht, clear sleep mode, ga door |
| **Sleep mode** (F73) | Is KITT in slaapstand? | Skip hele tick |
| **DND mode** (F73) | Do Not Disturb actief? | Ga door maar stuur geen berichten |
| **Processing lock** | Is de chat agent bezig met een bericht? | Skip hele tick |

### Processing Lock

De processing lock voorkomt dubbele responses. Als een user een bericht stuurt:

1. **Telegram handler** zet lock (`agent_processing_since` in meta tabel)
2. **Chat agent** verwerkt het bericht
3. **Response** wordt opgeslagen in transcripts
4. **Lock** wordt vrijgegeven

Als de Think Loop tikt terwijl stap 2-3 bezig is, ziet hij de lock en skipt. Na stap 4 kan de Think Loop veilig draaien en ziet de response al in de transcripts.

**Stale lock bescherming:** Lock ouder dan 2 minuten wordt automatisch genegeerd (crash recovery).

**Files:**
- `src/scheduler/processing-lock.ts` — acquire, release, isAgentProcessing
- `src/bridge/telegram.ts` — acquireProcessingLock/releaseProcessingLock rond runAgent()
- `src/scheduler/index.ts` — isAgentProcessing check in runThinkLoop()

## Context

De Think Loop krijgt uitgebreide context mee:

| Context | Bron | Doel |
|---------|------|------|
| Identity (IDENTITY.md) | File | KITT's persoonlijkheid |
| Soul (SOUL.md) | File | Waarden en richtlijnen |
| User (USER.md) | File | Info over Renier |
| Working Memory (MEMORY.md) | File | Langetermijn herinneringen |
| Transcripts vandaag | SQLite | Alle gesprekken van vandaag |
| Conversatie status | Berekend | Recente exchanges, gap, onbeantwoorde berichten |
| Open taken | Task Engine | Taken die uitgevoerd moeten worden |
| Skills | SKILL.md files | Every-time en scheduled skill instructies |
| Skill fetch data | Bash commands | Live data per skill (bijv. Apple Reminders) |
| Tijd/dag/week | System | Temporal context |

### Conversatie Status

De Think Loop krijgt een samenvatting van de recente conversatie:
- **Recente uitwisselingen** — laatste 10 berichten (preview, tijd, wie)
- **Laatste interactie** — hoeveel minuten geleden
- **Onbeantwoorde berichten** — user berichten waar geen KITT response op volgde

Dit helpt de Think Loop beslissen of er berichten zijn blijven liggen.

## Skill Discovery

Skills worden automatisch ontdekt door SKILL.md files te scannen in `.claude/skills/*/SKILL.md`.

### Trigger Types

| Trigger | Wanneer | Voorbeeld |
|---------|---------|-----------|
| `every_time` | Elke Think Loop tick | Apple Reminders check |
| `scheduled` | Volgens frequency/daypart | Daily reflection, blog writer |
| `on_demand` | Alleen als user vraagt | Garmin, nutrition log |

Alleen `every_time` en `scheduled` skills worden in de Think Loop geladen. `on_demand` skills worden alleen via de chat agent getriggerd.

### Skill Metadata

```yaml
---
name: apple-reminders
description: Check reminders
metadata: {"kitt":{"emoji":"🔔","trigger":"every_time","fetch":"osascript -e '...'"}}
---
```

| Field | Beschrijving |
|-------|-------------|
| `trigger` | `every_time`, `scheduled`, `on_demand` |
| `fetch` | Bash command dat data ophaalt (output in prompt) |
| `frequency` | `daily`, `weekly`, `monthly` (voor scheduled) |
| `timesPerDay` | Hoeveel keer per dag (bijv. 3 voor nutrition reminder) |
| `daypart` | `morning`, `afternoon`, `evening`, `night` (hint) |
| `model` | Override model voor sub-agent taken |

### Skill Data Fetching

Skills met een `fetch` command krijgen live data mee in de prompt. Het fetch command wordt uitgevoerd vóór de prompt gebouwd wordt. Output (of "geen items gevonden") wordt meegestuurd.

## Task Engine Integratie

De Think Loop werkt samen met de Task Engine:

1. **Open taken** worden geladen uit de database
2. **Filtering** — Task Engine filtert op: time windows, snooze, frequentie, dependencies
3. **Overgeslagen taken** worden met reden getoond (voor debugging)
4. **Skill instructies** worden per taak ingeladen (als de taak een skill_ref heeft)
5. **Sub-agent routing** (F63) — taken met een ander model dan de Think Loop worden apart afgehandeld

### Sub-Agent Routing (F63)

Taken die een specifiek model vereisen (bijv. `opus` voor blog schrijven, terwijl Think Loop op `haiku` draait) worden:
1. Vóór de main think prompt verwerkt
2. Door een aparte `runAgent()` call met het juiste model
3. Als completed gelogd
4. Uit de context voor de main Think Loop verwijderd

**Let op:** Momenteel draait de Think Loop zelf op Opus, dus sub-agent routing wordt alleen actief als er taken zijn met een ander model.

## Response Types

De agent kan deze responses geven:

### `ACTION: OK`
Geen actie nodig. Niet opgeslagen — voorkomt database noise.

### `ACTION: MESSAGE`
Stuurt bericht naar Telegram. Opgeslagen als `type='thought'` (KITT ziet later dat hij dit stuurde) EN als `type='message'` (zodat conversatie status correct is).

### `ACTION: MEMORY`
Slaat feit op in MEMORY.md. Opgeslagen als `type='thought'`.

### `ACTION: REFLECT`
Maakt interne observatie. Opgeslagen als `type='thought'`.

### `ACTION: TASK #id`
Voert een open taak uit — stuurt bericht naar Telegram en logt de taak als uitgevoerd. Voorkomt dat dezelfde taak herhaaldelijk getriggerd wordt.

### `ACTION: COMPLETE_TASK #id`
Rondt een twee-fase taak af (bijv. reflectie samenvatting na user antwoord). Slaat intern op, stuurt NIET naar Telegram.

### Thought Storage

Acties worden opgeslagen in `transcripts` met:
- `role: 'kitt'`, `type: 'thought'` — interne observaties
- `channel: 'think-loop'`

Dit geeft KITT **self-awareness**: hij ziet in de volgende tick wat hij eerder gedaan heeft.

| Action | Opslaan als thought? | Telegram? | Voorbeeld |
|--------|---------------------|-----------|-----------|
| OK | Nee | Nee | "Routine check, niets te doen" |
| MESSAGE | Ja | Ja | "Bericht gestuurd: Herinnering tandarts" |
| MEMORY | Ja | Nee | "Opgeslagen: Tandarts is Dr. Jansen" |
| REFLECT | Ja | Nee | "Observatie: Productieve dag" |
| TASK #id | Ja | Ja | "Task #5 uitgevoerd: Ochtendreflectie" |
| COMPLETE_TASK #id | Ja (als reflection) | Nee | "Reflectie samenvatting opgeslagen" |

## DND Mode Interactie

Bij DND mode:
- Think Loop draait normaal (taken worden uitgevoerd)
- Messages worden **niet** naar Telegram gestuurd
- Alles wordt wel gelogd in de database
- Bij TASK acties: taak wordt als uitgevoerd gelogd, maar bericht onderdrukt

## Configuratie

In `profile/schedules/registry.json`:

```json
{
  "version": 1,
  "timezone": "Europe/Amsterdam",
  "tasks": [],
  "thinkLoop": {
    "model": "opus",
    "lastRun": "2026-02-09T13:17:49.420Z"
  },
  "telegramChatId": 1306998969
}
```

### Model

| Model | Gebruik |
|-------|---------|
| `haiku` | Goedkoop, snel, voor simpele checks |
| `opus` | Beter redeneren, huidige default |

De Think Loop draait momenteel op **Opus** voor betere nuance in conversatie-context en taakbeslissingen.

## Files

| File | Doel |
|------|------|
| `src/scheduler/think-loop.ts` | Context builder, skill discovery, prompt generator, response parser |
| `src/scheduler/index.ts` | SchedulerService met `runThinkLoop()`, sub-agent routing |
| `src/scheduler/processing-lock.ts` | Processing lock (anti-duplicate responses) |
| `src/scheduler/sleep-mode.ts` | Sleep/DND/Wake mode checks |
| `src/scheduler/task-engine.ts` | Task Engine: open taken, filtering, logging |
| `src/bridge/index.ts` | Start de 5-min interval timer |
| `src/bridge/context.ts` | Chat agent context (F74b: recent transcripts) |
| `src/bridge/telegram.ts` | Telegram handler met processing lock |
| `.claude/skills/*/SKILL.md` | Skills met trigger metadata |
| `profile/schedules/registry.json` | Model config, telegramChatId |

## Best Practices

1. **Stilte is OK** — KITT hoeft niet elke 5 min iets te sturen
2. **Context-aware** — berichten passen bij het tijdstip
3. **Niet opdringerig** — alleen sturen als het echt waardevol is
4. **Reflectief** — KITT denkt na, leert, onthoudt
5. **Skill-driven** — schedules komen uit SKILL.md, niet hardcoded
6. **Self-aware** — KITT ziet zijn eigen thoughts, voorkomt dubbele acties
7. **Lock-protected** — processing lock voorkomt race conditions met chat agent

## Geschiedenis

| Feature | Beschrijving |
|---------|-------------|
| F34 | Think Loop debug tooling |
| F35 | Eerste Think Loop documentatie |
| F37 | Daily reflection (twee-fase tasks) |
| F40 | Identity/Soul context, thoughts systeem, memory search |
| F51 | Task Engine integratie |
| F53 | Transcript schema (role/type distinction) |
| F63 | Sub-agent routing (model per task) |
| F73 | Sleep/DND modes |
| F74 | Conversatie awareness (conversation state) |
| — | Processing lock (anti-duplicate responses) |
