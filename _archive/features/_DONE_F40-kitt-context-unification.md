# F40: KITT Context Unificatie

> **Status:** Done
> **Doel:** Eén uniforme context voor alle KITT ingangen

---

## Architectuur Overzicht

### Drie Ingangen, Eén KITT

| Ingang | Route | Context Status |
|--------|-------|----------------|
| **Telegram Chat** | bridge/telegram.ts → agent.ts | ✅ Volledig |
| **Claude Code Chat** | Claude Code CLI → CLAUDE.md | Separaat (by design) |
| **Think Loop** | scheduler → runThinkLoop | ✅ Volledig |

### Data Bronnen

| Bron | Locatie | Telegram | Think Loop |
|------|---------|----------|------------|
| Identity | `profile/identity/IDENTITY.md` | ✅ | ✅ |
| Soul | `profile/identity/SOUL.md` | ✅ | ✅ |
| User Info | `profile/user/USER.md` | ✅ | ✅ |
| Working Memory | `profile/memory/MEMORY.md` | ✅ | ✅ |
| Skills | `.claude/skills/*/SKILL.md` | ✅ | ✅ (filtered) |
| Vector Search | `kitt.db` (chunks) | ✅ Auto | ❌ (CLI only) |
| History Search | `kitt.db` (transcripts) | ✅ CLI | ✅ CLI (today in context) |

---

## Geïmplementeerd

### 1. Memory Search CLI - ✅ DONE

KITT kan zoeken in gesprekken en memory via CLI met **semantic search** (vector).

**Nieuwe bestanden:**
- `src/memory/types.ts` - TranscriptSearchOptions, TranscriptSearchResult types
- `src/memory/index.ts` - `searchTranscripts()` methode (keyword fallback)
- `src/cli/kitt-search.ts` - CLI tool (semantic search default)
- `src/bridge/context.ts` - "Internal Capabilities" sectie in system prompt

**CLI: `npm run search`**
```bash
npm run search -- "zoekterm" [options]

# Opties:
-l 20       # Meer resultaten (default: 10)
--exact     # Keyword search ipv semantic (voor exacte matches)
--json      # Output als JSON
```

**Semantic vs Keyword:**
| Type | Vindt | Gebruik |
|------|-------|---------|
| Semantic (default) | "tandarts" → ook "dokter", "kies" | Gerelateerde concepten |
| Keyword (`--exact`) | Alleen letterlijke matches | Exacte termen |

**System Prompt (context.ts):**
```
## Memory Search (Semantic)
Zoek in gesprekken en memory met semantic/vector search.

npm run search -- "zoekterm" [options]

Voorbeelden:
- npm run search -- "tandarts afspraak" → vindt ook "dokter", "kies"
- npm run search -- "herinnering training" -l 5
- npm run search -- "KITT" --exact → alleen letterlijke matches
```

---

### 2. Think Loop Thoughts - ✅ DONE

Think Loop slaat acties op in transcripts voor self-awareness.

**Action Types:**

| Action | Betekenis | Opslaan? | Format |
|--------|-----------|----------|--------|
| `OK` | Routine check | ❌ Nee | - |
| `MESSAGE` | Stuur bericht | ✅ Ja | `Bericht gestuurd: "{preview}"` |
| `MEMORY` | Sla op in memory | ✅ Ja | `Opgeslagen: "{preview}"` |
| `REFLECT` | Observatie/inzicht | ✅ Ja | `Observatie: {reasoning}` |

**Regel:** Sla ACTIES op, niet BESLISSINGEN (voorkomt self-reinforcing loops)

**Implementatie:**
- [x] `'reflect'` action type toegevoegd
- [x] `parseThinkResponse()` uitgebreid voor REFLECT
- [x] Thoughts opgeslagen met `role: 'thought'`, `channel: 'think-loop'`

---

### 3. Memory Search Altijd Verplicht - ✅ DONE

- [x] `query.length > 10` check verwijderd uit context.ts
- [x] Memory vector search draait nu altijd bij elke user query

---

### 4. Daily Summary Verwijderd - ✅ DONE

- [x] Cron job verwijderd
- [x] `generateDailySummary()` functie verwijderd
- [x] `profile/memory/daily/` folder verwijderd
- [x] `'daily'` uit ChunkSource type verwijderd

---

### 5. Think Loop History Access - ✅ DONE

Think Loop kan history search gebruiken via CLI (net als Telegram chat).

**Aanpak:** CLI-only (geen automatische vector search)
- Think Loop krijgt documentatie voor `npm run search` in de prompt
- KITT kan zelf beslissen wanneer hij verder terug wil kijken
- Geen automatische search = geen onnodige API calls

**Waarom geen automatische vector search?**
- Think Loop heeft al transcripts van vandaag in context
- Als KITT verder terug wil kijken, kan hij CLI gebruiken
- Voorkomt onnodige beperkingen ("ik wil m niet belemmeren")

**Gewijzigd:**
- `src/scheduler/think-loop.ts`
  - `buildThinkPrompt()`: +History Search sectie met CLI docs

---

## Data Flow Diagrammen

### Telegram Chat Flow
```
User Message via Telegram
    ↓
bridge/telegram.ts
    ↓
agent.ts → runAgent()
    ↓
context.ts → loadContext(userQuery)
    ├─ IDENTITY.md
    ├─ SOUL.md
    ├─ USER.md
    ├─ MEMORY.md
    ├─ Skills summaries
    ├─ Memory vector search (altijd)
    └─ Internal Capabilities (History Search CLI docs)
    ↓
buildSystemPrompt() → Claude Agent SDK
    ↓
KITT kan:
    ├─ Skills gebruiken (Read SKILL.md → Bash commands)
    ├─ History Search (npm run search -- ...)
    └─ Normale tools (Read, Write, Bash, etc.)
    ↓
Response → storeMessage() → DB
```

### Think Loop Flow
```
Every 5 min → scheduler.tick()
    ↓
runThinkLoop()
    ↓
buildThinkLoopContext()
    ├─ DB: transcripts WHERE date = today (in context)
    ├─ Skills: every_time + scheduled only
    ├─ Execute skill fetch commands
    └─ Identity/Soul/User/Memory files
    ↓
buildThinkPrompt() → runAgent(model: haiku)
    │
    │  Think Loop tools:
    │  └─ npm run search (CLI) voor history verder dan today
    ↓
parseThinkResponse()
    ├─ OK → nothing
    ├─ MESSAGE → Telegram + store thought
    ├─ MEMORY → MEMORY.md + store thought
    └─ REFLECT → store thought only
```

---

## Open Vragen (Geparkeerd)

1. **Claude Code integratie:** Blijft separaat (CLAUDE.md). Geen bridge.
2. **MEMORY.md toekomst:** Behouden als working memory, apart van DB.
3. **CLAUDE.md:** Alleen voor Claude Code CLI, niet door bridge.

---

## SDK & Model

**Claude Agent SDK:** `@anthropic-ai/claude-agent-sdk@0.2.34`

Model selectie via `AgentModel` type:
- `'haiku'` - Think Loop (snel, goedkoop)
- `'sonnet'` - Standaard taken
- `'opus'` - Complex/creatief werk

SDK pakt automatisch de nieuwste versie van elk model family (bijv. Opus 4.6).

---

## Bestanden Gewijzigd

| File | Wijziging |
|------|-----------|
| `src/memory/types.ts` | +TranscriptSearchOptions, +TranscriptSearchResult |
| `src/memory/index.ts` | +searchTranscripts(), +getTimeframeStart() |
| `src/cli/kitt-search.ts` | Nieuw - CLI tool (semantic search default, --exact voor keyword) |
| `src/bridge/context.ts` | +Internal Capabilities sectie (Memory Search docs) |
| `src/scheduler/think-loop.ts` | +Memory Search sectie in prompt |
| `package.json` | +search script, SDK update |
