# Memory System Architecture

> Hoe KITT informatie onthoudt en terughaalt.
> **Status:** ✅ Geïmplementeerd (F03)

---

## Overview

KITT gebruikt een gelaagd memory systeem:
1. **MEMORY.md** - Working memory (facts, preferences) - altijd in context
2. **kitt.db** - Long-term memory (SQLite + sqlite-vec + FTS5)
3. **Hybrid search** - 0.7 × vector + 0.3 × BM25

**Geïmplementeerd in:** `src/memory/`

---

## Memory Hierarchy

```
┌─────────────────────────────────────────────────┐
│              Claude Code Session                 │
│  (conversation context, tool results)           │
├─────────────────────────────────────────────────┤
│       profile/memory/MEMORY.md                   │
│  (persistent facts, preferences, notes)         │
├─────────────────────────────────────────────────┤
│       profile/memory/kitt.db                     │
│  (transcripts + vector index for search)        │
└─────────────────────────────────────────────────┘
```

### Profile Directory Structure
```
profile/
├── memory/                  # Memory storage
│   ├── MEMORY.md            # Working memory (always in context)
│   └── kitt.db              # Long-term memory (SQLite + sqlite-vec)
├── identity/                # KITT personality
│   ├── IDENTITY.md, SOUL.md, HUMOR.md
├── user/                    # User info
│   └── USER.md
├── config/                  # Preferences
│   └── HEARTBEAT.md
└── state/                   # Runtime state
    ├── sessions.json
    └── bridge-state.json
```

---

## MEMORY.md Structure

```markdown
# KITT Memory

## User Preferences
- Taal: Nederlands voor conversatie
- Timezone: Europe/Amsterdam
- Notification times: 9:00-22:00

## Facts
- [Date] User's name is Renier
- [Date] Works on AI projects

## Projects
### KITT
- Personal AI assistant project
- Using Claude Code as engine

## Notes
- [Date] Important reminder about X
```

---

## When to Write to Memory

| Trigger | Action |
|---------|--------|
| User says "onthoud dit" | Write to profile/memory/MEMORY.md |
| Important fact learned | Write to profile/memory/MEMORY.md |
| Conversation stored | Saved to profile/memory/kitt.db |

---

## Memory Retrieval

### Automatic (via CLAUDE.md)
- `profile/memory/MEMORY.md` is loaded automatically via Claude Code's project settings
- Always available in context

### On-Demand
- User asks "wat weet je over X"
- Search through `profile/memory/MEMORY.md` and `profile/memory/kitt.db`
- Hybrid search: 0.7 × vector + 0.3 × BM25

### Memory Search CLI (F40)

KITT kan via CLI zoeken in gesprekken en memory:

```bash
npm run search -- "zoekterm" [options]

# Opties:
-l 20       # Meer resultaten (default: 10)
--exact     # Keyword search ipv semantic (voor exacte matches)
--json      # Output als JSON
```

| Type | Vindt | Gebruik |
|------|-------|---------|
| Semantic (default) | "tandarts" → ook "dokter", "kies" | Gerelateerde concepten |
| Keyword (`--exact`) | Alleen letterlijke matches | Exacte termen |

**Implementatie:** `src/cli/kitt-search.ts`

---

## Vector Search (Implemented)

Based on OpenClaw's approach, now fully implemented:

```
┌─────────────────────────────────────────┐
│           Memory Files                   │
│  (MEMORY.md, memory/*.md)               │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│         Markdown Chunker                 │
│  (400 tokens, 80 token overlap)         │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│        Embedding Provider               │
│  (OpenAI / Local / Gemini)              │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│         SQLite Vector Store             │
│  (cosine similarity search)             │
└─────────────────────────────────────────┘
```

### Hybrid Search
```
finalScore = 0.7 × vectorScore + 0.3 × BM25Score
```

---

## Implementation Status

> **Alle fases geïmplementeerd in F03 (5 feb 2026)**

| Component | Status | Location |
|-----------|--------|----------|
| MemoryService | ✅ | `src/memory/index.ts` |
| EmbeddingService | ✅ | `src/memory/embeddings.ts` |
| Hybrid Search | ✅ | `src/memory/search.ts` |
| Database Schema | ✅ | `src/memory/schema.ts` |
| Telegram Integration | ✅ | `src/bridge/telegram.ts` |

### Key Implementation Details

1. **Singleton Pattern** - `getMemoryService()` returns shared instance
2. **Non-blocking Storage** - Fire-and-forget `.catch()` pattern
3. **Background Indexing** - Debounced queue (1s idle) for batch embedding
4. **Node 22 sqlite** - Built-in `node:sqlite`, no external dependency

---

## Memory Approaches Comparison

Dit document vergelijkt drie verschillende memory-implementaties die als inspiratie dienen voor KITT.

### 1. NanoClaw (Simple File-Based)

**Filosofie:** Minimalistisch, alles zichtbaar in workspace.

```
groups/
├── personal/
│   └── CLAUDE.md    # Memory per group
└── work/
    └── CLAUDE.md
```

| Aspect | Implementatie |
|--------|---------------|
| Storage | Markdown files in workspace |
| Retrieval | Direct file read, altijd in context |
| Persistence | Git-tracked, versioned |
| Search | Geen (handmatig lezen) |
| Complexity | Zeer laag |

**Voordelen:**
- Volledig transparant en editeerbaar
- Geen externe dependencies
- Works offline
- Git history = memory history

**Nadelen:**
- Schaalt niet bij veel data
- Geen semantic search
- Handmatig onderhoud nodig

---

### 2. OpenClaw (Hybrid Search)

**Filosofie:** Enterprise-grade memory met slim retrieval.

```
memory/
├── MEMORY.md           # Core facts
├── daily/
│   └── 2025-02-05.md   # Daily logs
├── archives/
│   └── session-*.md    # Conversation transcripts
└── index/
    └── vectors.db      # SQLite vector store
```

| Aspect | Implementatie |
|--------|---------------|
| Storage | Markdown + SQLite vector DB |
| Retrieval | Hybrid BM25 + Vector search |
| Persistence | Local files + database |
| Embedding | OpenAI / Local models |
| Complexity | Medium-hoog |

**Hybrid Search Formula:**
```
finalScore = 0.7 × vectorScore + 0.3 × BM25Score
```

**Chunking Strategy:**
- 400 tokens per chunk
- 80 token overlap
- Header preservation

**Voordelen:**
- Semantic search ("vind informatie over X")
- Schaalt naar duizenden entries
- BM25 fallback voor exacte matches

**Nadelen:**
- Externe API nodig voor embeddings
- Meer setup complexity
- Vector DB onderhoud

---

### 3. Goda Goo's System (Supabase + pgvector)

**Filosofie:** Cloud-native, real-time, goal-aware.

Gebaseerd op: [Claude Code Always-On Presentation](https://godagoo.github.io/claude-code-always-on/)

```
┌─────────────────────────────────────────────────────────┐
│                    Supabase                              │
├─────────────────────────────────────────────────────────┤
│  PostgreSQL + pgvector                                   │
│  ├── messages (4000+ met embeddings)                    │
│  ├── goals (extracted via NL detection)                 │
│  └── facts (learned information)                        │
├─────────────────────────────────────────────────────────┤
│  Edge Functions                                          │
│  ├── search (hybrid keyword + semantic)                 │
│  └── embed (API key protection)                         │
└─────────────────────────────────────────────────────────┘
```

| Aspect | Implementatie |
|--------|---------------|
| Storage | Supabase PostgreSQL + pgvector |
| Embedding | OpenAI text-embedding-3-large (1536 dim) |
| Retrieval | Hybrid: keyword + cosine similarity |
| Goal Tracking | NL detection ("I want to...", "My goal is...") |
| Context Injection | Last 15 messages auto-loaded |
| Complexity | Medium (managed infrastructure) |

**Key Features:**

1. **Goal Tracking**
   - Detecteert goals uit natuurlijke taal
   - Tracks progress over tijd
   - Aparte goals tabel in database

2. **Time-Aware Retrieval**
   - Recente berichten krijgen hogere priority
   - Context window bevat altijd laatste 15 messages
   - Temporal weighting in search

3. **Edge Functions voor Security**
   - API keys nooit exposed naar client
   - Embedding calls via server-side function
   - Row Level Security op database

4. **Voice Integration**
   - Gemini API voor transcription
   - Context injection bij voice calls
   - Post-call summaries terug naar Telegram

**Voordelen:**
- Managed infrastructure (geen self-hosting)
- Real-time sync across devices
- Built-in security (RLS, Edge Functions)
- Gratis tier beschikbaar

**Nadelen:**
- Cloud dependency
- Data niet lokaal (privacy consideration)
- Vendor lock-in potentieel

---

## Comparison Matrix

| Feature | NanoClaw | OpenClaw | Goda's System |
|---------|----------|----------|---------------|
| **Storage** | Files | Files + SQLite | PostgreSQL |
| **Hosting** | Local | Local | Cloud (Supabase) |
| **Embedding Model** | - | OpenAI/Local | OpenAI |
| **Search Type** | Manual | Hybrid (BM25+Vector) | Hybrid (Keyword+Vector) |
| **Goal Tracking** | ❌ | ❌ | ✅ |
| **Time Awareness** | ❌ | Partial | ✅ |
| **Context Injection** | Manual | On-demand | Automatic (15 msgs) |
| **Offline Support** | ✅ | ✅ | ❌ |
| **Transparency** | ✅ High | Medium | Lower |
| **Scalability** | Low | Medium | High |
| **Setup Complexity** | Minimal | Medium | Medium |

---

## KITT Memory Strategy

Voor KITT combineren we elementen van alle drie:

### Phase 1: Transparent Foundation (NanoClaw-inspired)
- MEMORY.md in workspace (altijd zichtbaar)
- Git-tracked voor history
- Manual read/write

### Phase 2: Smart Retrieval (OpenClaw-inspired) ✅
- Hybrid search (BM25 + vector)
- Lokale SQLite voor vectors
- CLI tool voor memory search

### Phase 3: Goal-Aware (Goda-inspired)
- Goal detection uit conversaties
- Time-weighted retrieval
- Automatic context injection

### Design Principles
1. **Transparency First** - Alles zichtbaar in workspace
2. **Local First** - Data blijft lokaal (optioneel cloud sync)
3. **Progressive Enhancement** - Simple → Advanced als nodig
4. **No Black Boxes** - User kan memory altijd inspecteren/editen

---

## KITT Technical Stack (Besloten)

### Hardware
- **Machine:** Mac Mini M4, 16GB RAM
- **Hosting:** Volledig lokaal

### Embedding
```
Provider:    OpenAI API
Model:       text-embedding-3-large
Dimensions:  3072 (of 1536 voor snelheid)
Cost:        ~$0.13 per 1M tokens
```

**Waarom OpenAI:**
- Beste kwaliteit embeddings beschikbaar
- Kosten verwaarloosbaar voor personal use (~€5/jaar)
- Snelle API response (~100ms)
- Consistente resultaten

### Vector Storage
```
Database:    SQLite + sqlite-vec extension
Location:    memory/index/vectors.db
Search:      Approximate Nearest Neighbor (ANN)
```

**Waarom sqlite-vec:**
- Single file, transparant
- Geen server nodig
- Makkelijk te backuppen
- Voldoende performance voor personal scale

### Keyword Search
```
Engine:      SQLite FTS5 (ingebouwd)
Algorithm:   BM25 ranking
Location:    Zelfde SQLite database
```

### Hybrid Search
```typescript
interface SearchResult {
  content: string;
  vectorScore: number;    // 0-1, cosine similarity
  bm25Score: number;      // 0-1, normalized
  finalScore: number;     // Combined score
  timestamp: Date;
  source: string;         // File path or message ID
}

// Hybrid formula
const finalScore = 0.7 * vectorScore + 0.3 * bm25Score;

// With time decay (optional, Goda-inspired)
const timeWeight = Math.exp(-daysSinceCreation / 30);
const timeAwareScore = finalScore * (0.8 + 0.2 * timeWeight);
```

### Complete Stack Diagram
```
┌─────────────────────────────────────────────────────────────┐
│                     KITT Memory System                       │
├─────────────────────────────────────────────────────────────┤
│  Transparent Layer (profile/)                                │
│  ├── profile/memory/MEMORY.md  → Core facts, always visible │
│  ├── profile/identity/         → KITT personality files     │
│  └── profile/user/             → User information           │
├─────────────────────────────────────────────────────────────┤
│  Search Layer (SQLite)                                       │
│  ├── profile/memory/kitt.db                                  │
│  │   ├── transcripts table (full conversations)             │
│  │   ├── chunks table (for search)                          │
│  │   ├── chunks_vec (sqlite-vec embeddings)                 │
│  │   └── chunks_fts (FTS5 for BM25)                         │
│  └── Hybrid query: 0.7 × vector + 0.3 × BM25                │
├─────────────────────────────────────────────────────────────┤
│  Embedding Layer (OpenAI API)                                │
│  ├── Model: text-embedding-3-large                          │
│  ├── Dimensions: 3072                                        │
│  └── Batched for efficiency                                  │
└─────────────────────────────────────────────────────────────┘
```

### Environment Variables
```bash
# .env (niet in git)
OPENAI_API_KEY=sk-...

# Of via Claude Code settings
# ~/.claude/settings.json
```

---

## KITT Implementation

### Source Code
```
src/memory/
├── index.ts        # MemoryService class + singleton
├── types.ts        # TypeScript interfaces
├── schema.ts       # Database init + sqlite-vec setup
├── embeddings.ts   # OpenAI embedding wrapper
├── search.ts       # Hybrid search implementation
├── chunking.ts     # Token-aware text chunking
└── utils.ts        # Hash, date, buffer helpers
```

### Usage Example
```typescript
import { getMemoryService } from '../memory/index.js';

const memory = getMemoryService();

// Store message (non-blocking)
memory.storeMessage({
  sessionId: chatId,
  channel: 'telegram',
  role: 'kitt',  // F53: 'kitt' or 'user' (not 'assistant')
  content: userMessage,
}).catch(console.error);

// Search
const results = await memory.search('wat weet je over KITT?');
```

---

## Transcript Schema (F53)

> **Added:** 7 feb 2026

### Role vs Type

De transcripts tabel scheidt nu **wie** (role) van **wat** (type):

| Column | Values | Description |
|--------|--------|-------------|
| `role` | `kitt`, `user` | Wie zegt/doet dit |
| `type` | `message`, `thought`, `task` | Wat voor log is dit |

### Task Tracking Columns

Voor task execution tracking:

| Column | Type | Description |
|--------|------|-------------|
| `task_id` | INTEGER | FK naar `kitt_tasks.id` |
| `task_status` | TEXT | `reminder`, `completed`, `skipped`, `deferred` |

### Transcript Types

| Type | Role | Description | Example |
|------|------|-------------|---------|
| `message` | `user` | User bericht | "Goedemorgen!" |
| `message` | `kitt` | KITT antwoord | "Hey Renier!" |
| `thought` | `kitt` | Interne reflectie | Think Loop observatie |
| `task` | `kitt` | Task execution | Reminder gestuurd |

### Task Execution Flow

```
┌───────────────────────────────────────────────────────────────┐
│  1. KITT stuurt reminder voor ontbijt                          │
│     role=kitt, type=message, content="Heb je al ontbijt gehad?"│
│                                                                │
│  2. Task tracking log                                          │
│     role=kitt, type=task, task_id=1, task_status=reminder      │
│                                                                │
│  3. User reageert                                              │
│     role=user, type=message, content="Ja, 2 broodjes"          │
│                                                                │
│  4. KITT bevestigt                                             │
│     role=kitt, type=message, content="Top, gelogd!"            │
│                                                                │
│  5. Task completed                                             │
│     role=kitt, type=task, task_id=1, task_status=completed     │
└───────────────────────────────────────────────────────────────┘
```

### Query: Is task vandaag uitgevoerd?

```sql
SELECT task_status FROM transcripts
WHERE type = 'task'
  AND task_id = ?
  AND date(created_at/1000, 'unixepoch', 'localtime') = date('now', 'localtime')
ORDER BY created_at DESC
LIMIT 1
```

### TypeScript Helper

```typescript
import { wasTaskExecutedToday } from '../scheduler/task-engine.js';

// Check of ontbijt task al is uitgevoerd
const done = await wasTaskExecutedToday(db, 1, ['reminder', 'completed']);
```

---

## Reference Implementations (Inspiration)

### NanoClaw
```
_repos/nanoclaw/groups/*/CLAUDE.md
_repos/nanoclaw/container/agent-runner/src/index.ts  # Pre-compact hook
```

### OpenClaw
```
_repos/openclaw/src/memory/manager.ts    # Memory management
_repos/openclaw/src/memory/hybrid.ts     # Hybrid search
_repos/openclaw/src/memory/embeddings/   # Embedding providers
```

### Goda's System
- [GitHub Repo](https://github.com/godagoo/claude-code-always-on) (referenced)
- [Presentation Slides](https://godagoo.github.io/claude-code-always-on/)
