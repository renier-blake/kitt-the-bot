# F03: Memory System

> **Priority:** 🔴 MVP
> **Status:** ✅ Done
> **Owner:** -

---

## Lees Eerst

> **Belangrijk:** Eén agent werkt aan de complete feature. Lees ALLE documenten hieronder voordat je begint.

### 1. Workflow
- `_prd/WORKFLOW.md` - De 7-stappen workflow

### 2. Briefings
- `_prd/briefings/memory.md` - Memory systeem kennis
- `_prd/briefings/typescript.md` - TypeScript/Node.js kennis

### 3. Architecture
- `_prd/architecture/memory.md` - Memory systeem design
- `_prd/architecture/overview.md` - Systeem context

### 4. Reference Code
- `_repos/openclaw/src/memory/manager.ts` - Complete memory manager
- `_repos/openclaw/src/memory/hybrid.ts` - Hybrid search (vector + BM25)
- `_repos/openclaw/src/memory/sqlite-vec.ts` - Vector storage
- `_repos/nanoclaw/container/agent-runner/src/index.ts` - Pre-compact hook

---

## 🚦 Current Status

| Component | Status | Notes |
|-----------|--------|-------|
| Spec | ✅ | Dit document |
| Memory Database | ✅ | SQLite + sqlite-vec + FTS5 |
| Embedding Service | ✅ | OpenAI text-embedding-3-large |
| Transcript Storage | ✅ | Full conversation archiving |
| Working Memory | ✅ | MEMORY.md + daily summaries |
| Hybrid Search | ✅ | Vector + BM25 |
| Agent Integration | ✅ | Telegram bridge integration |

---

## Overview

F03 bouwt het **Memory System** - het hart van KITT. Dit is geen simpele "onthoud dit" feature, maar een volledig twee-lagen memory systeem met vector search.

**Doel:** KITT moet:
1. Alles automatisch opslaan (full transcripts)
2. Snel relevante context kunnen vinden (hybrid search)
3. Werken across alle sessies (Telegram, Claude UI, sub-agents)
4. Transparant zijn (files zichtbaar in workspace)

### Waarom Nu Goed Bouwen?

Memory is de kern van een goede assistant. Zonder goed memory:
- Herhaalt KITT dezelfde vragen
- Vergeet context van eerdere gesprekken
- Kan niet leren van interacties
- Sub-agents hebben geen gedeelde kennis

---

## User Stories

**US-01:** Als Renier wil ik dat KITT alles automatisch onthoudt, zodat ik later details uit eerdere gesprekken kan terugvinden.

**US-02:** Als Renier wil ik dat KITT belangrijke feiten snel kan vinden via semantic search, zodat relevante context altijd beschikbaar is.

**US-03:** Als Renier wil ik dat memory werkt across alle kanalen (Telegram, Claude UI, sub-agents), zodat er één gedeelde kennisbasis is.

**US-04:** Als Renier wil ik "onthoud dit" kunnen zeggen voor expliciete opslag in MEMORY.md.

---

## Architecture

### Two-Layer Memory System

```
┌─────────────────────────────────────────────────────────────────┐
│  LAYER 1: Working Memory (altijd in context)                    │
│  ───────────────────────────────────────────                    │
│  • MEMORY.md          - Facts, preferences, active projects     │
│  • Daily summaries    - Wat er vandaag besproken is             │
│  • Klein, gefocust    - Max ~2000 tokens                        │
│  • Auto-loaded        - Via CLAUDE.md instructies               │
└─────────────────────────────────────────────────────────────────┘
                         ▲
                         │ extracted from / searchable
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  LAYER 2: Long-term Memory (searchable database)                │
│  ───────────────────────────────────────────────                │
│  • Full transcripts   - Elke conversatie, volledig opgeslagen   │
│  • Vector embeddings  - OpenAI text-embedding-3-large (3072d)   │
│  • Hybrid search      - 0.7 × vector + 0.3 × BM25               │
│  • SQLite storage     - Single file, transparant, backupbaar    │
│  • Automatic          - Alles wordt automatisch opgeslagen      │
└─────────────────────────────────────────────────────────────────┘
```

### Cross-Session Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Shared Memory Store                           │
│          profile/memory/kitt.db (SQLite + sqlite-vec)           │
│                                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │transcripts│ │ chunks   │  │embeddings│  │ FTS5     │        │
│  │ table    │  │ table    │  │ (vec)    │  │ index    │        │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘        │
└─────────────────────────────────────────────────────────────────┘
         ▲              ▲              ▲              ▲
         │              │              │              │
    ┌────┴────┐   ┌────┴────┐   ┌────┴────┐   ┌────┴────┐
    │ Claude  │   │Telegram │   │ Sub-    │   │ Future  │
    │   UI    │   │  Bot    │   │ agents  │   │ Channels│
    │(VS Code)│   │(Bridge) │   │(Task)   │   │         │
    └─────────┘   └─────────┘   └─────────┘   └─────────┘
```

**Elke sessie:**
- LEEST uit dezelfde memory store
- SCHRIJFT naar dezelfde memory store
- Heeft eigen session_id voor tracking
- Kan zoeken in alle historische data

### File Structure

```
KITT V1/
├── profile/                     # User-specific data
│   ├── memory/                  # Memory storage
│   │   ├── MEMORY.md            # Working memory (always in context)
│   │   ├── kitt.db              # SQLite database (transcripts + vectors)
│   │   └── daily/               # Daily summaries
│   │       ├── 2026-02-05.md
│   │       └── 2026-02-04.md
│   ├── identity/                # KITT personality
│   │   ├── IDENTITY.md
│   │   ├── SOUL.md
│   │   └── HUMOR.md
│   ├── user/                    # User info
│   │   └── USER.md
│   ├── config/                  # Preferences
│   │   └── HEARTBEAT.md
│   └── state/                   # Runtime state
│       ├── sessions.json
│       └── bridge-state.json
├── src/                         # Source code
│   ├── bridge/                  # Message bridge
│   └── memory/                  # Memory service (this feature)
└── .env                         # OPENAI_API_KEY
```

---

## Database Schema

### SQLite Tables

```sql
-- Conversation transcripts (raw storage)
CREATE TABLE transcripts (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  channel TEXT NOT NULL,           -- 'telegram', 'claude_ui', 'sub_agent'
  role TEXT NOT NULL,              -- 'user', 'assistant', 'system'
  content TEXT NOT NULL,
  metadata JSON,                   -- Extra info (user_id, chat_id, etc.)
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_transcripts_session ON transcripts(session_id);
CREATE INDEX idx_transcripts_channel ON transcripts(channel);
CREATE INDEX idx_transcripts_created ON transcripts(created_at);

-- Chunked content for search
CREATE TABLE chunks (
  id TEXT PRIMARY KEY,
  transcript_id TEXT,              -- NULL for memory files
  source TEXT NOT NULL,            -- 'transcript', 'memory', 'daily'
  path TEXT,                       -- File path if from file
  content TEXT NOT NULL,
  hash TEXT NOT NULL,
  start_line INTEGER,
  end_line INTEGER,
  embedding TEXT,                  -- JSON array of floats
  model TEXT NOT NULL,             -- Embedding model used
  created_at INTEGER NOT NULL,
  FOREIGN KEY (transcript_id) REFERENCES transcripts(id)
);

-- FTS5 virtual table for keyword search
CREATE VIRTUAL TABLE chunks_fts USING fts5(
  content,
  id UNINDEXED,
  source UNINDEXED,
  path UNINDEXED
);

-- Vector table (sqlite-vec)
CREATE VIRTUAL TABLE chunks_vec USING vec0(
  id TEXT PRIMARY KEY,
  embedding FLOAT[3072]            -- OpenAI text-embedding-3-large dimensions
);

-- Extracted facts (promoted to MEMORY.md)
CREATE TABLE facts (
  id TEXT PRIMARY KEY,
  content TEXT NOT NULL,
  category TEXT NOT NULL,          -- 'preference', 'fact', 'project', 'reminder'
  source_transcript_id TEXT,
  confidence REAL DEFAULT 1.0,
  created_at INTEGER NOT NULL,
  promoted_at INTEGER,             -- When added to MEMORY.md
  FOREIGN KEY (source_transcript_id) REFERENCES transcripts(id)
);

-- Metadata
CREATE TABLE meta (
  key TEXT PRIMARY KEY,
  value TEXT
);
```

---

## Core Components

### 1. Memory Service (`src/memory/index.ts`)

```typescript
export class MemoryService {
  private db: Database;
  private embedder: EmbeddingService;

  constructor(config: MemoryConfig) {}

  // === Transcript Storage ===

  // Store a conversation message (called after each exchange)
  async storeMessage(params: {
    sessionId: string;
    channel: 'telegram' | 'claude_ui' | 'sub_agent';
    role: 'user' | 'assistant';
    content: string;
    metadata?: Record<string, unknown>;
  }): Promise<string>;

  // === Search ===

  // Hybrid search across all memory
  async search(query: string, options?: {
    maxResults?: number;
    minScore?: number;
    sources?: ('transcript' | 'memory' | 'daily')[];
    timeRange?: { from?: Date; to?: Date };
  }): Promise<SearchResult[]>;

  // === Working Memory ===

  // Read current MEMORY.md
  async getWorkingMemory(): Promise<string>;

  // Add fact to MEMORY.md
  async addFact(fact: string, category: string): Promise<void>;

  // Generate daily summary from today's transcripts
  async generateDailySummary(): Promise<string>;

  // === Sync ===

  // Sync memory files to database (called on startup, periodically)
  async sync(): Promise<void>;

  // Index a transcript for search
  async indexTranscript(transcriptId: string): Promise<void>;
}
```

### 2. Embedding Service (`src/memory/embeddings.ts`)

```typescript
export class EmbeddingService {
  private client: OpenAI;
  private cache: Map<string, number[]>;

  constructor(apiKey: string) {}

  // Embed single text
  async embed(text: string): Promise<number[]>;

  // Embed batch (more efficient)
  async embedBatch(texts: string[]): Promise<number[][]>;

  // Chunk text for embedding
  chunk(text: string, options?: {
    maxTokens?: number;      // Default: 400
    overlap?: number;        // Default: 80
  }): Chunk[];
}
```

### 3. Hybrid Search (`src/memory/search.ts`)

```typescript
export async function hybridSearch(params: {
  db: Database;
  query: string;
  queryEmbedding: number[];
  maxResults: number;
  vectorWeight?: number;     // Default: 0.7
  textWeight?: number;       // Default: 0.3
}): Promise<SearchResult[]> {
  // 1. Vector search (cosine similarity)
  const vectorResults = await searchVector(db, queryEmbedding);

  // 2. Keyword search (BM25 via FTS5)
  const keywordResults = await searchKeyword(db, query);

  // 3. Merge results
  return mergeResults(vectorResults, keywordResults, {
    vectorWeight: params.vectorWeight ?? 0.7,
    textWeight: params.textWeight ?? 0.3,
  });
}
```

---

## Integration Points

### 1. Telegram Bridge Integration

```typescript
// In src/bridge/telegram.ts
import { memoryService } from '../memory/index.js';

bot.on('message:text', async (ctx) => {
  const userMessage = ctx.message.text;

  // Store user message
  await memoryService.storeMessage({
    sessionId: ctx.chat.id.toString(),
    channel: 'telegram',
    role: 'user',
    content: userMessage,
    metadata: { userId: ctx.from.id, username: ctx.from.username }
  });

  // Run agent...
  const response = await runAgent(userMessage, sessionId);

  // Store assistant response
  await memoryService.storeMessage({
    sessionId: ctx.chat.id.toString(),
    channel: 'telegram',
    role: 'assistant',
    content: response.result,
  });

  // Send response
  await ctx.reply(response.result);
});
```

### 2. Agent Memory Instructions (CLAUDE.md)

```markdown
## Memory System

KITT heeft een twee-lagen memory systeem:

### Layer 1: Working Memory
- **MEMORY.md** bevat belangrijke facts en preferences
- Dit bestand is ALTIJD beschikbaar in je context
- Update het met de Edit tool wanneer je nieuwe belangrijke info leert

### Layer 2: Long-term Memory
- Alle gesprekken worden automatisch opgeslagen
- Gebruik `memory search <query>` om te zoeken in historische data
- Dit werkt via hybrid search (vector + keyword)

### Wanneer Facts Opslaan
Sla op in MEMORY.md wanneer:
- User zegt "onthoud dit" of "remember"
- Belangrijke preferences worden gedeeld
- Project-specifieke kennis wordt geleerd
- Deadlines of afspraken worden gemaakt

Format voor facts:
- [2026-02-05] <fact content>

### Zoeken in Memory
Als je context nodig hebt die niet in MEMORY.md staat:
1. Gebruik de memory search tool
2. Query: beschrijf wat je zoekt in natuurlijke taal
3. Resultaten bevatten relevante snippets uit eerdere gesprekken
```

### 3. Sub-agent Memory Access

Sub-agents (via Task tool) hebben toegang tot dezelfde memory:

```typescript
// Sub-agent kan zoeken in memory
const context = await memoryService.search('user preferences for notifications');

// Sub-agent kan ook schrijven
await memoryService.storeMessage({
  sessionId: parentSessionId,
  channel: 'sub_agent',
  role: 'assistant',
  content: 'Completed research task: found 5 relevant articles',
  metadata: { taskId: 'research-123', parentAgent: 'main' }
});
```

---

## MEMORY.md Structure

```markdown
# KITT Memory

> Last updated: 2026-02-05 14:30

## User Preferences
- Taal: Nederlands voor conversatie
- Timezone: Europe/Amsterdam
- Notification times: 9:00-22:00
- Communication style: Direct, geen fluff

## Facts
- [2026-02-05] User's name is Renier
- [2026-02-05] Works on AI projects, specifically personal assistants
- [2026-02-05] Has ADHD - ideas need places to land quickly
- [2026-02-05] Uses Mac Mini M4 as main dev machine

## Projects
### KITT
- Personal AI assistant project
- Using Claude Code + Agent SDK as engine
- Telegram as primary channel
- Goal: Always-on assistant with full memory

### Other
- [List other active projects]

## Reminders
- [2026-02-06] Check in about gym schedule

## Notes
- [2026-02-05] Discussed memory architecture, decided on two-layer approach
```

---

## Daily Summary Structure

```markdown
# 2026-02-05 - KITT Daily Summary

## Highlights
- Completed F02 Message Bridge feature
- Started F03 Memory System design
- Discussed two-layer memory architecture

## Decisions Made
- Memory: SQLite + sqlite-vec + FTS5 for hybrid search
- Embeddings: OpenAI text-embedding-3-large
- Architecture: Full transcript storage + working memory

## Facts Learned
- User prefers comprehensive solutions over quick hacks
- Memory system is considered "the heart" of KITT

## Open Items
- [ ] Implement memory service
- [ ] Set up daily summary generation
- [ ] Integrate memory with bridge

## Sessions
- Claude UI: 3 conversations (~2 hours)
- Telegram: 2 messages (testing)
```

---

## Implementation Tasks

### Phase 1: Database Setup
- [ ] Install sqlite-vec extension
- [ ] Create database schema
- [ ] Set up FTS5 virtual table
- [ ] Create migration system

### Phase 2: Embedding Service
- [ ] Create OpenAI embedding wrapper
- [ ] Implement chunking algorithm
- [ ] Add embedding cache
- [ ] Handle rate limiting

### Phase 3: Memory Service
- [ ] Implement transcript storage
- [ ] Implement chunk indexing
- [ ] Implement hybrid search
- [ ] Implement MEMORY.md read/write

### Phase 4: Integration
- [ ] Integrate with Telegram bridge
- [ ] Add memory tools to CLAUDE.md
- [ ] Implement daily summary generation
- [ ] Add sub-agent memory access

### Phase 5: Testing
- [ ] Test transcript storage
- [ ] Test hybrid search accuracy
- [ ] Test cross-session memory
- [ ] Test sub-agent integration

---

## Acceptance Criteria

- [ ] Full transcripts worden automatisch opgeslagen
- [ ] Hybrid search vindt relevante context (>0.7 precision)
- [ ] MEMORY.md is leesbaar en editeerbaar door agent
- [ ] "Onthoud dit" trigger werkt correct
- [ ] Daily summaries worden automatisch gegenereerd
- [ ] Memory werkt across Telegram en Claude UI sessies
- [ ] Sub-agents kunnen memory lezen en schrijven
- [ ] Search is snel (<500ms voor normale queries)

---

## Dependencies

| Depends On | Status |
|------------|--------|
| F02 - Message Bridge | ✅ Done |
| OpenAI API key | ⏳ Required |
| sqlite-vec extension | ⏳ Required |

---

## Technical Decisions

### Waarom SQLite + sqlite-vec?
- Single file, makkelijk te backuppen
- Geen server nodig
- sqlite-vec is production-ready
- FTS5 built-in voor keyword search
- Voldoende performance voor personal use

### Waarom OpenAI Embeddings?
- Beste kwaliteit beschikbaar
- Kosten verwaarloosbaar (~€5/jaar bij personal use)
- text-embedding-3-large: 3072 dimensions, beste recall
- Consistent, reliable API

### Waarom Full Transcripts + MEMORY.md?
- Transcripts: Nothing is lost, everything searchable
- MEMORY.md: Quick access to important facts
- Best of both worlds: depth + speed

### Hybrid Search Formula
```
finalScore = 0.7 × vectorScore + 0.3 × bm25Score
```
- Vector: Semantic similarity ("wat bedoelt de user")
- BM25: Exact keyword matches ("zoek naar 'KITT'")
- 70/30 split: Geoptimaliseerd door OpenClaw team

---

## Reference Implementation

### OpenClaw Memory Manager
Het OpenClaw project heeft een uitgebreide memory implementatie:
- `_repos/openclaw/src/memory/manager.ts` - Main manager class (~2300 lines)
- `_repos/openclaw/src/memory/hybrid.ts` - Hybrid search merge
- `_repos/openclaw/src/memory/embeddings.ts` - Embedding providers
- `_repos/openclaw/src/memory/sqlite-vec.ts` - Vector storage

Key learnings:
1. Batch embeddings voor efficiency
2. Embedding cache om API calls te minimaliseren
3. Atomic reindexing voor data safety
4. File watching voor auto-sync
5. Chunking: 400 tokens, 80 overlap

### GoDA's Approach (Inspiration)
- Full transcript storage in database
- Vector search over all historical data
- Time-weighted retrieval (recent = higher priority)
- Goal extraction from conversations (future feature)

---

## Test Cases

1. **Happy path - Transcript storage**
   - User sends message via Telegram
   - Expected: Message stored in transcripts table with session_id

2. **Happy path - Hybrid search**
   - Query: "wat zei ik over memory?"
   - Expected: Returns relevant snippets from conversations about memory

3. **Happy path - Onthoud dit**
   - User: "Onthoud dat ik volgende week op vakantie ga"
   - Expected: Fact added to MEMORY.md with date

4. **Cross-session memory**
   - User discusses topic in Claude UI
   - Later asks about it via Telegram
   - Expected: Search finds relevant context from Claude UI session

5. **Sub-agent memory**
   - Main agent spawns research sub-agent
   - Sub-agent stores findings
   - Expected: Findings searchable from main agent

---

## Implementation Notes (na completion)

> **Completed:** 2026-02-05

### Wat is gebouwd

Volledig twee-lagen memory systeem:

1. **MemoryService** - Singleton service met:
   - `storeMessage()` - Non-blocking transcript opslag
   - `search()` - Hybrid search (0.7 vector + 0.3 BM25)
   - `getWorkingMemory()` / `addFact()` - MEMORY.md access
   - `generateDailySummary()` - Daily summary generatie
   - `sync()` - Memory file synchronisatie

2. **EmbeddingService** - OpenAI wrapper met:
   - Batch embedding voor efficiency
   - Retry logic met exponential backoff
   - Rate limit handling
   - Token budget management (8000 tokens/batch)

3. **Database Schema** - SQLite met:
   - `transcripts` - Raw conversation storage
   - `chunks` - Indexed text segments
   - `chunks_fts` - FTS5 voor BM25 keyword search
   - `chunks_vec` - sqlite-vec voor vector search (3072d)

4. **Hybrid Search** - Merge algoritme:
   - Vector search via `vec_distance_cosine()`
   - Keyword search via FTS5 BM25
   - Gewogen scoring: `0.7 × vector + 0.3 × text`

5. **Telegram Integration** - Non-blocking storage:
   - User messages opgeslagen voor agent call
   - Assistant responses opgeslagen na agent return
   - Fire-and-forget pattern (blokkeert niet)

### Files gewijzigd/aangemaakt

| File | Actie | Beschrijving |
|------|-------|--------------|
| `src/memory/index.ts` | Create | MemoryService class + singleton |
| `src/memory/types.ts` | Create | TypeScript interfaces |
| `src/memory/schema.ts` | Create | Database init + sqlite-vec setup |
| `src/memory/embeddings.ts` | Create | OpenAI embedding wrapper |
| `src/memory/search.ts` | Create | Hybrid search implementation |
| `src/memory/chunking.ts` | Create | Token-aware text chunking |
| `src/memory/utils.ts` | Create | Hash, date, buffer helpers |
| `src/bridge/telegram.ts` | Modify | Added storeMessage calls |
| `package.json` | Modify | Added sqlite-vec dependency |
| `CLAUDE.md` | Modify | Uitgebreide memory docs |

### Learnings/Beslissingen

1. **Node 22 sqlite** - Geen externe sqlite dependency nodig, `node:sqlite` werkt out of the box

2. **sqlite-vec loading** - Extension moet geladen worden met `db.loadExtension()` voordat de `vec0` virtual table gemaakt kan worden

3. **Type casting** - SQLite rows vereisen `as unknown as T[]` casting voor type safety

4. **Non-blocking storage** - Critical voor UX: `.catch()` pattern zodat message flow niet geblokkeerd wordt

5. **Background indexing** - Debounced queue (1s idle) voor batch embedding calls

6. **FTS5 query** - Tokens moeten quoted en ge-AND'd worden voor exacte matching

### Verificatie

Database bevat werkende transcripts:
```sql
sqlite3 profile/memory/kitt.db "SELECT * FROM transcripts ORDER BY created_at DESC LIMIT 5"
```

Output bevestigt storage van Telegram berichten (user + assistant).
