# Chat UX Flow

> Hoe een gebruikersbericht van Telegram/WhatsApp tot antwoord wordt verwerkt.
> **Status:** Current (11 feb 2026, na KITT-115 Cycle 1)

---

## End-to-End Flow

```
User stuurt bericht via Telegram/WhatsApp
     │
     ▼
┌─────────────────────────────────────────────────────────────┐
│ 1. CHANNEL ADAPTER (telegram.ts / whatsapp.ts)              │
│    • Ontvangt bericht, extraheert text/voice/media           │
│    • Voice → Whisper transcriptie (transcribe.ts)            │
│    • Stuurt IncomingMessage naar MessageRouter               │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. MESSAGE ROUTER (router.ts)                                │
│    • Slaat user bericht op in transcripts (memory service)    │
│    • Message queue: als Opus al bezig → wacht                │
│    • Acquires processing lock (blokkeert think loop)         │
│    • Wakes KITT als sleep/DND mode actief                    │
│    • Stuurt naar processMessage()                            │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. CONTEXT BUILDER (context/builder.ts)                      │
│    • Leest blocks.json configuratie                          │
│    • Laadt identity (IDENTITY.md, SOUL.md, HUMOR.md)         │
│    • Laadt USER.md + MEMORY.md                               │
│    • Genereert time context (dag, datum, week)               │
│    • Laadt skills overzicht (alle skills)                    │
│    • Laadt recente transcripts (15 min window, max 10 msgs) │
│    • Semantic memory search op user query (embeddings)       │
│    • Laadt instructies (core.md, capabilities.md)            │
│    → Output: system prompt (~8-12k tokens)                   │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. OPUS AGENT (agent.ts → Claude Agent SDK)                  │
│    • Model: Opus 4.5                                         │
│    • Tools: GEEN (allowedTools: [])                          │
│    • Verse sessie per bericht (geen session resume)          │
│    • Beslist zelf over routing:                              │
│      → Direct antwoord (meeste berichten)                    │
│      → BACKGROUND_TASK signal (skills die tools nodig hebben)│
│    • Typische response time: 5-8 seconden                    │
└──────────────────────────┬──────────────────────────────────┘
                           │
                    ┌──────┴──────┐
                    │             │
              Direct path    Background path
                    │             │
                    ▼             ▼
┌──────────────────────┐  ┌──────────────────────────────────┐
│ 5a. DIRECT RESPONSE  │  │ 5b. BACKGROUND_TASK              │
│ • Format voor        │  │ • Router parseert JSON signal    │
│   Telegram MarkdownV2│  │ • Ack gestuurd naar user         │
│   (format.ts)        │  │ • dispatchBackgroundTask()       │
│ • Split >4000 chars  │  │   → background-runner.ts         │
│ • Stuur via adapter  │  │                                  │
└──────────────────────┘  └──────────────┬───────────────────┘
                                         │
                                         ▼
                          ┌──────────────────────────────────┐
                          │ 6. BACKGROUND RUNNER              │
                          │ • Model: per capability           │
                          │   (Haiku voor API skills,         │
                          │    Opus voor complex skills)      │
                          │ • Heeft WEL tools (Bash, Read,    │
                          │   Write, etc.)                    │
                          │ • Laadt SKILL.md als context      │
                          │ • Geen memory search (skip)       │
                          │ • Wacht op processing lock        │
                          │ • Stuurt resultaat via adapter    │
                          │ • Slaat op in transcripts         │
                          └──────────────────────────────────┘
```

---

## Key Design Decisions

### Opus zonder tools

De chat agent draait met `allowedTools: []`. Dit is bewust:
- **Snelheid:** Tools laden kost context tokens → langzamere response
- **Veiligheid:** Opus kan niet per ongeluk files wijzigen tijdens chat
- **Routing:** Opus kiest zelf wanneer een skill nodig is via BACKGROUND_TASK signal
- **Simpelheid:** Geen tool approval flow nodig

### Verse sessie per bericht

Elke message start een nieuwe Agent SDK sessie (geen session resume):
- **Voorkomt:** Context bloat door tool call history
- **Voorkomt:** Plan mode deadlocks (KITT-26, opgelost)
- **Context:** Recente conversatie komt via transcript loader (15 min window)

### BACKGROUND_TASK signal (niet classifier)

Opus beslist zelf of een skill nodig is — geen aparte classifier:

```
User: "check mijn inbox"
Opus: "Ik check je inbox!
BACKGROUND_TASK:{"skill":"gmail","prompt":"Haal de laatste 5 ongelezen emails op"}"
```

**Waarom geen classifier (onderzocht, verworpen):**
- +300ms op ELKE message (ook simpele chat)
- False positives ("gisteren was leuk" → onterecht naar skill)
- Opus maakt betere prompts (specifieke data/tijden in prompt)
- Temporal queries zijn zeldzaam (~2x/week)
- OpenAI dependency als single point of failure

Zie KITT-115 voor de volledige tradeoff analyse.

### Model per skill

API-only skills draaien op Haiku (snel, goedkoop). Complexe skills op Opus:

| Model | Skills |
|-------|--------|
| **Haiku** | gmail, garmin, nutrition-log, apple-reminders, calendar |
| **Opus** | gym-race-coach, blog-writer, browser, linkedin-post, podcast |

---

## Message Queue & Concurrency

```
User stuurt msg 1  →  processMessage() start
User stuurt msg 2  →  queue (Opus bezig)
User stuurt msg 3  →  queue
                       processMessage() klaar
                       drain queue → batch msg 2+3
                       processMessage(batch) start
```

- Per-chat queue (niet globaal)
- Batched messages worden samengevoegd
- Geen duplicaten: elk bericht wordt exact 1x verwerkt
- Processing lock voorkomt think loop interferentie

---

## Think Loop Yielding

De think loop (elke 5 min) checked voor actieve conversaties:

```typescript
// meta tabel: last_user_message_at
const lastActivity = await getLastUserMessageTime(db);
if (Date.now() - lastActivity < 5 * 60 * 1000) {
  console.log('[think-loop] Active conversation window, skipping tick');
  return;
}
```

Aanvullend: processing lock blokkeert think loop terwijl Opus bezig is.

---

## Response Formatting

### Telegram MarkdownV2 (format.ts)

LLM output is GitHub-flavored markdown. Telegram ondersteunt beperkt:

| GFM | Telegram | Conversie |
|-----|----------|-----------|
| `## Header` | `*Header*` | Headers → bold |
| `**bold**` | `*bold*` | Dubbel → enkel |
| `---` | _(verwijderd)_ | Horizontal rules weg |
| `> quote` | `_quote_` | Blockquotes → italic |
| `- item` | `• item` | Bullets → bullet char |
| `\| table \|` | `Header: value · ...` | Tables → key-value pairs |
| `` `code` `` | `` `code` `` | Behouden |
| ` ```code``` ` | ` ```code``` ` | Behouden |

**Tables:** Kleine tabellen (≤4 kolommen) worden `Header: value` pairs. Brede tabellen worden plain text met `·` separator.

### Message Splitting

Berichten >4000 chars worden gesplit op:
1. Dubbele newline (paragraaf)
2. Enkele newline
3. Spatie
4. Harde split (als alles >50% van max is)

---

## Semantic Memory Search

Bij elk chat bericht doet de context builder een semantic search:

```
User query → embeddings (OpenAI) → vector search op chunks tabel
           → top 5 resultaten (score > 0.4)
           → toegevoegd aan system prompt
```

Dit werkt voor **inhoudelijke** vragen ("wat zei ik over Johanna?") maar NIET voor **tijdgebonden** vragen ("wat bespraken we gisteren?"). Embeddings bevatten geen timestamp info.

**Temporal queries** gaan via BACKGROUND_TASK → memory-search skill → sqlite3 queries op transcripts tabel.

---

## Error Handling

| Scenario | Gedrag |
|----------|--------|
| Agent SDK fout | "Sorry, er ging iets mis. Probeer het opnieuw." |
| Lege response | "Ik heb je bericht verwerkt." |
| Background task error | Error bericht naar user via adapter |
| Skill niet gevonden | Background runner logged warning, geen crash |
| Telegram API fout | Retry met plain text (zonder MarkdownV2) |
| Voice transcriptie fout | Logged, bericht wordt overgeslagen |

**Known issue:** Background tasks zonder timeout kunnen hangen. Zie KITT-116.

---

## Performance

| Stap | Tijd |
|------|------|
| Context build | ~500ms |
| Opus response (direct) | 5-8s |
| Opus response (met BACKGROUND_TASK) | 7s ack |
| Background task (Haiku) | 10-20s |
| Background task (Opus) | 20-40s |
| Telegram send | <100ms |
| **Totaal direct** | **~6-9s** |
| **Totaal background** | **~25-45s** |

---

## Bestanden

| File | Functie |
|------|---------|
| `src/bridge/router.ts` | MessageRouter, queue, BACKGROUND_TASK parsing |
| `src/bridge/agent.ts` | Agent SDK wrapper, runAgent() |
| `src/bridge/format.ts` | GFM → Telegram MarkdownV2 |
| `src/bridge/transcribe.ts` | Whisper voice transcriptie |
| `src/bridge/message-queue.ts` | Per-chat message queue |
| `src/bridge/adapters/telegram.ts` | Telegram adapter (grammy) |
| `src/bridge/adapters/whatsapp.ts` | WhatsApp adapter (baileys) |
| `src/context/builder.ts` | Unified context builder |
| `src/context/loaders/` | Dynamic loaders (skills, transcripts, memory) |
| `src/scheduler/background-runner.ts` | Background task execution |
| `src/scheduler/task-registry.ts` | Task state management |
| `src/scheduler/processing-lock.ts` | Processing lock (vs think loop) |
| `src/scheduler/sleep-mode.ts` | Sleep/DND mode |
| `profile/context/blocks.json` | Context configuratie |
| `profile/context/instructions/core.md` | Chat gedragsinstructies |

---

## Gerelateerde Docs

| Doc | Onderwerp |
|-----|-----------|
| `context.md` | Unified context builder details |
| `bridge.md` | Channel adapter pattern |
| `orchestrator.md` | Background task architecture |
| `think-loop.md` | Think loop & yielding |
| `memory.md` | Memory service & vector search |
| `skills.md` | Skill systeem |

---

## Changelog

### KITT-115 Cycle 1 (11 feb 2026)

**Fixes:**
- Table formatting: pipe separators → middot (`·`) + key-value pairs
- Meta-commentary leak: core.md instructie versterkt
- API skills (gmail, garmin, etc.) van Opus → Haiku voor snelheid
- Time context toegevoegd aan chat mode (dag, datum, week)
- Memory search honesty instructie (geen vage analyse)

**Bevindingen:**
- 19/20 tests PASS
- Think loop yielding werkt correct (KITT-25, KITT-26 opgelost)
- Background task timeout ontbreekt → KITT-116
- Voice pipeline werkt (Whisper transcriptie)
- Identity boundaries werken (E3: "Hey babe" → redirect)
- Rapid fire (3 msgs <2s) correct afgehandeld via queue
