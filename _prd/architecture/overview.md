# KITT - System Overview

> Architectuur overzicht van KITT (Knowledge Interface for Transparent Tasks)
> **Laatst bijgewerkt:** 6 februari 2026

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         VS Code                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │              Claude Code (Main Agent)                      │  │
│  │                                                            │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │  │
│  │  │ Task:Explore │  │ Task:Bash    │  │ Task:Plan    │     │  │
│  │  │ (research)   │  │ (execute)    │  │ (design)     │     │  │
│  │  └──────────────┘  └──────────────┘  └──────────────┘     │  │
│  │                                                            │  │
│  │  Workspace: KITT V1/                                      │  │
│  │  ├── profile/           (user-specific data)             │  │
│  │  │   ├── memory/        (MEMORY.md, kitt.db)             │  │
│  │  │   ├── identity/      (SOUL.md, IDENTITY.md, etc.)     │  │
│  │  │   └── state/         (sessions, bridge state)         │  │
│  │  ├── src/               (source code)                     │  │
│  │  └── _prd/              (documentation)                   │  │
│  └───────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
                               ↑
                               │ Claude Agent SDK
                               ↓
┌──────────────────────────────────────────────────────────────────┐
│                     Message Bridge (Node.js)                      │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  src/bridge/                                                │  │
│  │  ├── index.ts      (entry point)                           │  │
│  │  ├── agent.ts      (Agent SDK wrapper)                     │  │
│  │  ├── telegram.ts   (Telegram bot - grammy)                 │  │
│  │  └── sessions.ts   (session persistence)                   │  │
│  └────────────────────────────────────────────────────────────┘  │
│                               │                                   │
│              ┌────────────────┼────────────────┐                 │
│              ▼                ▼                ▼                 │
│        ┌──────────┐    ┌──────────┐    ┌──────────┐             │
│        │ Telegram │    │ WhatsApp │    │  Email   │             │
│        │ (active) │    │ (future) │    │ (future) │             │
│        └──────────┘    └──────────┘    └──────────┘             │
└──────────────────────────────────────────────────────────────────┘
```

---

## Folder Structure

```
KITT V1/
├── src/                        # 🔧 Source code
│   ├── bridge/                 # Message bridge
│   │   ├── index.ts            # Entry point
│   │   ├── agent.ts            # Agent SDK wrapper
│   │   ├── telegram.ts         # Telegram bot
│   │   ├── sessions.ts         # Session management
│   │   ├── state.ts            # Bridge state
│   │   ├── logger.ts           # Logging
│   │   └── types.ts            # Type definitions
│   └── memory/                 # Memory service (F03)
│
├── profile/                    # 👤 User-specific data
│   ├── identity/               # KITT's personality for this user
│   │   ├── IDENTITY.md         # Core identity
│   │   ├── SOUL.md             # Personality & values
│   │   └── HUMOR.md            # Humor style
│   ├── user/                   # User information
│   │   └── USER.md             # User profile
│   ├── memory/                 # Memory storage
│   │   ├── MEMORY.md           # Working memory (always in context)
│   │   └── kitt.db             # Long-term memory database
│   ├── config/                 # User preferences
│   │   └── HEARTBEAT.md        # Heartbeat config
│   └── state/                  # Runtime state
│       ├── sessions.json       # Chat sessions
│       └── bridge-state.json   # Bridge state
│
├── _prd/                       # 📋 Product documentation
│   ├── features/               # Feature specs (F00, F01, etc.)
│   ├── architecture/           # Architecture docs
│   ├── briefings/              # Agent briefings
│   ├── BACKLOG.md              # Feature backlog
│   ├── STATUS.md               # Project status
│   └── WORKFLOW.md             # Development workflow
│
├── _repos/                     # 📚 Reference repositories
│   ├── nanoclaw/               # NanoClaw reference
│   └── openclaw/               # OpenClaw reference
│
├── .claude/                    # Claude Code configuration
│   ├── skills/                 # KITT skills (garmin, nutrition, etc.)
│   └── settings.json
│
├── CLAUDE.md                   # 🤖 Agent instructions (must be root)
├── TOOLS.md                    # Tool definitions
├── package.json                # NPM config
├── package-lock.json           # NPM lock
├── tsconfig.json               # TypeScript config
├── .env                        # Environment variables
└── .gitignore                  # Git ignore rules
```

---

## Core Components

### 1. Claude Code (Main Agent)
- **Rol:** Central AI brain
- **Tools:** Read, Write, Edit, Bash, Task, Glob, Grep, WebSearch, WebFetch
- **Location:** VS Code extension (deze session)
- **Memory:** Reads `profile/memory/MEMORY.md` for context

### 2. Message Bridge
- **Rol:** Connects external channels to Claude Agent SDK
- **Tech:** Node.js + grammy (Telegram) + Agent SDK
- **Flow:** Message → Bridge → Agent SDK → Response → Bridge → Channel
- **State:** `profile/state/` folder

### 3. Profile Directory
- **Rol:** All user-specific data, portable between installations
- **Contents:** Identity, memory, config, state
- **Principle:** Source code is same for all users, profile differs

### 4. Sub-Agents
- **Rol:** Background tasks via Task tool
- **Types:** Explore (research), Bash (commands), Plan (design)
- **Memory:** Access same `profile/memory/` as main agent

### 5. KITT Portal (Future)
- **Rol:** Web UI voor beheer en monitoring
- **URL:** `http://localhost:3000`
- **Features:** Feature browser, memory search, logs, schedulers
- **Tech:** Next.js + Tailwind
- **Data:** Reads profile/ + _prd/

### 6. Memory Database
- **Rol:** Hybrid search over memory
- **Location:** `profile/memory/kitt.db`
- **Components:** sqlite-vec (vectors) + FTS5 (keyword search)
- **Embeddings:** OpenAI text-embedding-3-large

---

## Data Flow

### Incoming Message (Telegram)
```
1. User sends message to @kittthebot
2. Bridge receives via grammy
3. Bridge calls Agent SDK with message + session_id
4. Agent SDK runs Claude with full tool access
5. Agent processes, optionally updates profile/memory/
6. Agent returns response
7. Bridge sends response via Telegram
8. Bridge updates profile/state/sessions.json
```

### Memory Access
```
1. Agent reads profile/memory/MEMORY.md (always)
2. For deeper search: query profile/memory/kitt.db
3. Hybrid search: 0.7 × vector + 0.3 × BM25
4. Results injected into context
5. New facts written to MEMORY.md
6. Transcripts stored in kitt.db
```

---

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Claude Agent SDK | Full agent capabilities (tools, sessions) |
| Telegram first | Easier setup, better API than WhatsApp |
| Profile directory | Separates user data from code |
| SQLite + sqlite-vec | Local, transparent, single file |
| File-based state | Debugbaar, zichtbaar in VS Code |

---

## Reference Implementations

| Repo | What We Use |
|------|-------------|
| NanoClaw | Simplicity, transparency, Agent SDK patterns |
| OpenClaw | Memory search (hybrid), multi-agent patterns |

---

## Security Considerations

- Bridge runs locally (no external API exposure)
- User whitelist via `TELEGRAM_ALLOWED_USERS`
- Credentials in `.env` (gitignored)
- No automatic code execution from external messages
- Profile data stays local
