# F01: Architecture Design

> **Priority:** 🔴 MVP
> **Status:** ✅ Done
> **Owner:** Claude Code + Renier
> **Completed:** 5 februari 2026

---

## Lees Eerst

> **Belangrijk:** Dit is de architectuur basis voor alle KITT features.

### 1. Briefings
- `_prd/briefings/typescript.md` - TypeScript/Node.js kennis
- `_prd/briefings/bridge.md` - Message bridge kennis
- `_prd/briefings/memory.md` - Memory systeem kennis
- `_prd/briefings/agents.md` - Multi-agent kennis

### 2. Architecture Docs
- `_prd/architecture/overview.md` - Systeem overzicht
- `_prd/architecture/bridge.md` - Message bridge
- `_prd/architecture/memory.md` - Memory systeem
- `_prd/architecture/multi-agent.md` - Multi-agent orchestratie
- `_prd/architecture/portal.md` - KITT Portal web UI

### 3. Reference Code
- `_repos/nanoclaw/` - Primaire architectuur referentie
- `_repos/openclaw/` - Memory & multi-agent patterns

---

## 🚦 Current Status

| Component | Status | Notes |
|-----------|--------|-------|
| Design | ✅ | Alle beslissingen gedocumenteerd |
| Implementation | N/A | Design-only feature |
| Testing | N/A | Design-only feature |

---

## Overview

F01 definieert de complete architectuur voor KITT (Knowledge Interface for Transparent Tasks).

**Doel:** Een transparante, lokaal-draaiende AI assistent waarbij:
- Alles zichtbaar is in VS Code (geen black box)
- Data lokaal blijft op de Mac Mini
- Multi-channel input (WhatsApp, Telegram, Email)
- Uitbreidbaar via sub-agents

---

## Architectuur Beslissingen

### Core Engine

| Beslissing | Keuze | Rationale |
|------------|-------|-----------|
| AI Engine | Claude Code (VS Code) | Transparantie - alles zichtbaar |
| Host | Mac Mini M4, 16GB RAM | Lokaal, geen cloud dependency |
| Runtime | Node.js 22+ | TypeScript ecosystem |

### Communication

| Beslissing | Keuze | Rationale |
|------------|-------|-----------|
| IPC | File-based (inbox/outbox JSON) | Simpel, debugbaar, zichtbaar |
| WhatsApp | Baileys library | Bewezen in NanoClaw |
| Telegram | grammy library | Bewezen in OpenClaw |
| Email | Gmail API | Native Google integration |

### Memory System

| Beslissing | Keuze | Rationale |
|------------|-------|-----------|
| Core Memory | MEMORY.md in workspace | Transparant, git-tracked |
| Extended Memory | memory/ folder | Daily logs, archives |
| Vector Store | SQLite + sqlite-vec | Single file, lokaal |
| Keyword Search | SQLite FTS5 (BM25) | Ingebouwd, geen extra DB |
| Embeddings | OpenAI text-embedding-3-large | Beste kwaliteit |
| Dimensions | 3072 | Maximale precisie |
| Hybrid Formula | 0.7 × vector + 0.3 × BM25 | Balans semantic/keyword |

### Portal & Visibility

| Beslissing | Keuze | Rationale |
|------------|-------|-----------|
| Portal Framework | Next.js 14+ | Server Components, App Router |
| Styling | Tailwind CSS | Snel, consistent |
| URL | localhost:3000 | Lokaal toegankelijk |
| Features | Docs, Memory Search, Logs, Schedulers | Centrale visibility |

### Multi-Agent

| Beslissing | Keuze | Rationale |
|------------|-------|-----------|
| Sub-agents | Task tool (built-in) | Geen custom infra nodig |
| Agent Types | Explore, Bash, Plan, general-purpose | Claude Code standaard |
| Execution | Parallel mogelijk | Via multiple Task calls |

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         VS Code                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │              Claude Code (Main Agent)                      │  │
│  │                                                            │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │  │
│  │  │ Task:Explore │  │ Task:Bash    │  │ Task:Plan    │     │  │
│  │  └──────────────┘  └──────────────┘  └──────────────┘     │  │
│  │                                                            │  │
│  │  Workspace:                                                │  │
│  │  ├── MEMORY.md (persistent memory)                        │  │
│  │  ├── memory/ (vectors, goals, archives)                   │  │
│  │  ├── inbox/ (incoming messages)                           │  │
│  │  └── outbox/ (outgoing responses)                         │  │
│  └───────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
          │                    │                    │
          ▼                    ▼                    ▼
   ┌─────────────┐    ┌──────────────┐    ┌──────────────┐
   │ KITT Portal │    │Message Bridge│    │   SQLite     │
   │ (Next.js)   │    │  (Node.js)   │    │ (vectors.db) │
   │ :3000       │    └──────┬───────┘    └──────────────┘
   └─────────────┘           │
                    ┌────────┼────────┐
                    ▼        ▼        ▼
               WhatsApp  Telegram   Email
```

---

## Workspace Structure

```
KITT V1/
├── CLAUDE.md              # Project rules
├── MEMORY.md              # Persistent memory (core facts)
├── .env                   # API keys (gitignored)
├── inbox/                 # Incoming messages (JSON)
├── outbox/                # Outgoing responses (JSON)
├── memory/
│   ├── daily/             # Daily conversation logs
│   ├── archives/          # Session transcripts
│   ├── goals.json         # Goal tracking
│   └── index/
│       └── vectors.db     # SQLite with vectors + FTS5
├── src/
│   └── bridge/            # Message bridge code
├── portal/                # Next.js portal app
├── _prd/                  # Project documentation
└── _repos/                # Reference implementations
```

---

## Design Principles

1. **Transparency First** - Alles zichtbaar in workspace
2. **Local First** - Data blijft op Mac Mini
3. **Progressive Enhancement** - Start simpel, voeg features toe
4. **No Black Boxes** - User kan alles inspecteren/editen
5. **File-Based IPC** - Communicatie via JSON files

---

## Acceptance Criteria

- [x] Architecture overview gedocumenteerd
- [x] Memory system design compleet
- [x] Message bridge design compleet
- [x] Multi-agent pattern gedefinieerd
- [x] Portal architecture beschreven
- [x] Tech stack beslissingen vastgelegd
- [x] Workspace structure gedefinieerd

---

## Dependencies

| Depends On | Status |
|------------|--------|
| F00 - Project Setup | ✅ Done |

---

## Next Steps

Met F01 compleet kan het team verder met:

1. **F02 - Message Bridge** - WhatsApp → inbox → Claude Code
2. **F03 - Memory System** - MEMORY.md + vector search
3. **F04 - Basic Response Flow** - Complete message cycle

---

## Implementation

### Wat is gebouwd

Design-only feature. Alle architectuur beslissingen zijn vastgelegd in:
- Deze feature spec
- Architecture docs in `_prd/architecture/`
- Decisions log in `_prd/STATUS.md`

### Files gewijzigd/aangemaakt

| File | Actie | Beschrijving |
|------|-------|--------------|
| `_prd/architecture/overview.md` | Updated | System diagram + components |
| `_prd/architecture/memory.md` | Updated | Complete memory architecture |
| `_prd/architecture/bridge.md` | Exists | Message bridge design |
| `_prd/architecture/multi-agent.md` | Exists | Sub-agent patterns |
| `_prd/architecture/portal.md` | Created | Portal architecture |
| `_prd/briefings/*.md` | Exists | Agent briefings |

### Configuraties

- **Env vars needed:** `OPENAI_API_KEY` (voor embeddings)
- **Dependencies:** Nog geen (design fase)

### Learnings/Beslissingen

- NanoClaw's simpliciteit + OpenClaw's memory features = beste combinatie
- File-based IPC is debugbaar en transparent
- sqlite-vec is voldoende voor personal scale
- Goal tracking (Goda-inspired) komt in Phase 3
