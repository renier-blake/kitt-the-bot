# F37: Daily Reflection (Renier)

> **Priority:** 🟡 P2
> **Status:** ✅ Done
> **Owner:** -

---

## Overview

Context-gedreven dagelijkse reflectie voor Renier, gebaseerd op het **6 Minute Diary** framework (wetenschappelijk gevalideerd via [RCT-studie, Frontiers in Psychology 2022](https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2022.896741/full)).

KITT stelt ochtend- en avondvragen die niet random zijn, maar gevoed worden door eerdere reflecties en recente transcripts. Na Renier's antwoord maakt KITT een samenvatting die als `type: 'reflection'` wordt opgeslagen voor toekomstige context.

> **Let op:** Dit is Renier's reflectie. KITT's eigen reflectie (zelfevaluatie, identity groei) wordt een aparte feature.

---

## User Stories

**US-01:** Als Renier wil ik 's ochtends reflectievragen over intentie en dankbaarheid, zodat ik bewust aan de dag begin.

**US-02:** Als Renier wil ik 's avonds reflectievragen over wat goed ging en wat ik kan verbeteren, zodat ik bewust de dag afsluit.

**US-03:** Als Renier wil ik dat de vragen context-driven zijn (gebaseerd op eerdere reflecties en recente gesprekken), zodat het geen dood formulier is maar een levend gesprek.

**US-04:** Als Renier wil ik dat mijn reflectie-antwoorden worden samengevat en opgeslagen, zodat KITT er later op kan terugkomen.

---

## Componenten

| Component | Nodig | Beschrijving |
|-----------|-------|--------------|
| Skill | ✅ | Herschrijf `daily-reflection` met 6 Minute Diary framework + context lookup |
| Task | ✅ | 2 taken: ochtend + avond reflectie (INSERT in kitt_tasks) |
| Schema | ✅ | Nieuw transcript type `reflection` — geen nieuwe tabel, wel nieuw type |
| Backend | ❌ | - |
| Portal | ❌ | - |

---

## Skill: daily-reflection (herschrijven)

**Trigger:** Task Engine (ochtend/avond taak triggert de skill)

### Framework: 6 Minute Diary

Gebaseerd op bewezen positieve psychologie interventies:

#### 🌅 Ochtend (3 vragen)

| # | Element | Vraag (varieer formulering) | Psychologisch fundament |
|---|---------|----------------------------|------------------------|
| 1 | **Gratitude** | "Waar ben je dankbaar voor?" (3 dingen) | Dankbaarheidsinterventie — verhoogt welzijn |
| 2 | **Intentie** | "Hoe maak je vandaag goed?" / "Wat is je focus?" | Goal-setting — richting geven |
| 3 | **Affirmatie** | "Wat is een positieve waarheid over jezelf?" | Self-affirmation — versterkt kernwaarden |

#### 🌙 Avond (3 vragen)

| # | Element | Vraag (varieer formulering) | Psychologisch fundament |
|---|---------|----------------------------|------------------------|
| 1 | **Good deed** | "Wat heb je voor iemand anders gedaan vandaag?" | Pro-sociaal gedrag |
| 2 | **Verbetering** | "Wat zou je anders doen?" | Groei-mindset, zelfreflectie |
| 3 | **Three Good Things** | "Noem 3 dingen die goed gingen" | Bewezen voor self-efficacy en positief affect |

#### Stijl

- **Kort en casual** — geen therapeut-toon
- **Varieer formulering** — niet elke dag exact dezelfde woorden
- **Max 3 vragen** per moment
- **Niet opdringerig** — als Renier druk is of niet reageert, niet pushen

### Context-Driven Vragen

De vaste structuur (gratitude/intentie/affirmatie en good deed/verbetering/three good things) is het skelet. KITT maakt het persoonlijk door context op te halen:

**Data bronnen:**

| Data | Bron | Query/Command |
|------|------|---------------|
| Eerdere reflecties | transcripts (type='reflection') | `SELECT content FROM transcripts WHERE type = 'reflection' ORDER BY created_at DESC LIMIT 10` |
| Transcripts afgelopen week | transcripts | `SELECT content FROM transcripts WHERE created_at > (now - 7 dagen) AND type = 'message'` — filter op persoonlijke ontwikkeling topics |
| Geüploade documenten | transcripts | Sessies met psycholoog, gedeelde artikelen, etc. |

**Hoe context gebruiken:**

```
Vast skelet: "Waar ben je dankbaar voor vandaag?"

+ Context: Renier noemde vorige week dat ie slecht sliep
= "Je noemde vorige week dat je slaap beter wilde. Hoe gaat het daarmee? En waar ben je vandaag dankbaar voor?"

Vast skelet: "Wat zou je anders doen?"

+ Context: Renier had een lastig gesprek met een collega
= "Je deelde die situatie met je collega. Als je dat over kon doen, wat zou je anders aanpakken?"
```

**Belangrijk:** Context is optioneel. Als er geen relevante context is, stel gewoon de basis-vraag. Geen context forceren.

**Fallbacks:**

| Situatie | Actie |
|----------|-------|
| Geen eerdere reflecties | Stel basisvragen zonder context |
| Renier reageert niet | Log als 'reminder', retry via next_run (1x) |
| Renier zegt "later" / "niet nu" | Snooze taak 2 uur |
| Renier zegt "skip" | Log als 'skipped', niet herhalen vandaag |

### Na Renier's antwoord: Samenvatting

Na het antwoord maakt KITT een korte samenvatting:

```
KITT slaat op als transcript:
  - role: 'kitt'
  - type: 'reflection'
  - content: "Ochtendreflectie 7 feb: Renier is dankbaar voor goede nachtrust en tijd met Kenji. Focus vandaag: KITT features afmaken. Affirmatie: ik maak dingen die echt werken."
```

De samenvatting bevat:
- **Alleen de kern** van Renier's antwoord
- **Geen KITT-observaties** (dat is voor KITT's eigen reflectie feature)
- **Datum** voor makkelijk terugvinden

---

## Task 1: Ochtend reflectie

| Veld | Waarde |
|------|--------|
| title | Ochtend reflectie |
| description | 6 Minute Diary ochtend: gratitude, intentie, affirmatie — context-driven |
| frequency | daily |
| priority | low |
| time_window | 08:00 - 10:00 |
| grace_period | 30 min |
| depends_on | [0] (wake-up) |
| skill_refs | ["daily-reflection"] |

## Task 2: Avond reflectie

| Veld | Waarde |
|------|--------|
| title | Avond reflectie |
| description | 6 Minute Diary avond: good deed, verbetering, three good things — context-driven |
| frequency | daily |
| priority | low |
| time_window | 21:00 - 23:00 |
| grace_period | 30 min |
| depends_on | [0] (wake-up) |
| skill_refs | ["daily-reflection"] |

---

## Schema Change

**Geen nieuwe tabel nodig.** Het `type` veld in `transcripts` ondersteunt al custom waarden.

Nieuw type: `'reflection'`

Bestaande types: `'message'`, `'thought'`, `'task'`
Nieuw: `'reflection'`

**Hoe opslaan:**

```sql
INSERT INTO transcripts (id, session_id, channel, role, type, content, metadata, created_at)
VALUES (
    'refl_<timestamp>_<random>',
    '<current_session>',
    'telegram',
    'kitt',
    'reflection',
    'Ochtendreflectie 7 feb: Renier is dankbaar voor...',
    '{"moment": "morning", "framework": "6min-diary"}',
    <timestamp>
);
```

**Code changes:**
- [ ] `src/memory/schema.ts` — 2 taken toevoegen aan seed (of via migration)
- [ ] `.claude/skills/daily-reflection/SKILL.md` — Herschrijven met framework + context lookup

---

## Flow

```
08:00-10:00 / 21:00-23:00
         │
         ▼
┌─────────────────────────────────────┐
│ Task Engine: ochtend/avond reflectie│
│ depends_on: [0] (wake-up)          │
└─────────────────┬───────────────────┘
                  │
                  ▼
┌─────────────────────────────────────┐
│ Context ophalen:                    │
│ - Eerdere reflecties (type=refl.)  │
│ - Transcripts afgelopen week       │
│ - Relevante events/uploads         │
└─────────────────┬───────────────────┘
                  │
                  ▼
┌─────────────────────────────────────┐
│ KITT stelt 3 vragen (6min diary)   │
│ Ochtend: gratitude, intentie, aff. │
│ Avond: good deed, verbeter, 3good  │
│ → Context-driven formulering       │
└─────────────────┬───────────────────┘
                  │
                  ▼
           Renier antwoordt
           (normaal transcript)
                  │
                  ▼
┌─────────────────────────────────────┐
│ KITT maakt samenvatting             │
│ → Opslaan als type='reflection'    │
│ → Task status = completed          │
└─────────────────────────────────────┘
```

---

## Acceptance Criteria

- [ ] 2 taken bestaan in kitt_tasks (ochtend + avond)
- [ ] Ochtend taak draait 08:00-10:00, avond 21:00-23:00
- [ ] Vragen volgen 6 Minute Diary framework
- [ ] Ochtend: gratitude (3x), intentie, affirmatie
- [ ] Avond: good deed, verbetering, three good things (3x)
- [ ] Vragen zijn context-driven (eerdere reflecties + transcripts)
- [ ] Na antwoord: KITT maakt samenvatting als type='reflection' transcript
- [ ] Samenvatting bevat alleen kern, geen KITT-observaties
- [ ] Task wordt als 'completed' gelogd na samenvatting
- [ ] Fallbacks werken (geen context, geen reactie, "later", "skip")
- [ ] Casual, niet opdringerige toon
- [ ] Vragen variëren (niet elke dag exact dezelfde woorden)

---

## Test Cases

1. **Ochtend happy path:** Task triggert om 08:30, KITT haalt context op, stelt 3 ochtendvragen, Renier antwoordt, KITT maakt samenvatting → opgeslagen als reflection, task completed
2. **Avond happy path:** Zelfde flow maar met avondvragen (good deed, verbetering, 3 good things)
3. **Context-driven:** KITT vindt eerdere reflectie over slaap → verweeft dit in gratitude-vraag
4. **Geen context:** Geen eerdere reflecties → KITT stelt standaard basisvragen
5. **Geen reactie:** KITT stuurt vragen, geen antwoord → log als 'reminder', retry 1x via next_run
6. **"Later":** Renier zegt "later" → snooze taak 2 uur
7. **"Skip":** Renier zegt "skip" → log als 'skipped'
8. **Niet herhalen:** Ochtend al gedaan → niet opnieuw in window
9. **Wake-up dependency:** Geen user message vandaag → taak wacht

---

## Files

| File | Actie | Beschrijving |
|------|-------|--------------|
| `.claude/skills/daily-reflection/SKILL.md` | Modify | Herschrijven met 6 Minute Diary framework + context lookup |
| `src/memory/schema.ts` | Modify | 2 reflectie-taken toevoegen aan seed of migration |

---

## Lees Eerst

> **Voor de agent die dit bouwt:**

### Workflow
- `_prd/workflows/AGENT.md`

### Research
- [6 Minute Diary RCT Study](https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2022.896741/full)
- [6-Minute Diary Overview](https://greator.com/en/6-minute-diary/)

### Bestaande Code
- `.claude/skills/daily-reflection/SKILL.md` — Huidige skill (wordt herschreven)
- `src/memory/schema.ts` — seedDefaultTasks functie + migrations
- `src/scheduler/task-engine.ts` — Task types, logTaskExecution
- `src/scheduler/think-loop.ts` — Think Loop die taken triggert

---

## Implementation

### Wat is gebouwd

5 files gewijzigd:

| File | Wat |
|------|-----|
| `src/memory/types.ts` | `'reflection'` toegevoegd aan `TranscriptType` union |
| `src/scheduler/think-loop.ts` | `COMPLETE_TASK` action format + parsing + `taskComplete` flag op interface |
| `src/scheduler/index.ts` | Handler voor `taskComplete`: slaat reflection op als `type='reflection'`, logt task als `completed` |
| `src/memory/schema.ts` | Migration v7→v8: 2 taken (Ochtend reflectie #5, Avond reflectie #6) |
| `.claude/skills/daily-reflection/SKILL.md` | Volledig herschreven met 6 Minute Diary framework + twee-fase instructies |

### Beslissingen

- **Two-phase execution via COMPLETE_TASK** — Fase 1 (vragen stellen) gebruikt bestaande `ACTION: TASK` flow. Fase 2 (samenvatting) gebruikt nieuw `ACTION: COMPLETE_TASK` dat intern opslaat zonder naar Telegram te sturen.
- **Geen nieuwe tabel** — Reflecties worden opgeslagen als `type='reflection'` in bestaande transcripts tabel.
- **Task descriptions bevatten "Lees SKILL.md"** — Zodat de Think Loop agent weet dat ie de skill moet raadplegen voor context queries en fase 2 logica.
- **Schema version 8** — Migration is idempotent (checkt of taken al bestaan).
