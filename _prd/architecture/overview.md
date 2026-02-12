# KITT - System Overview

> Architectuur overzicht van KITT (Knowledge Interface for Transparent Tasks)
> **Laatst bijgewerkt:** 12 februari 2026

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
│  │  │   ├── identity/      (IDENTITY, SOUL, HUMOR, MEMORY)  │  │
│  │  │   ├── user/          (USER.md)                        │  │
│  │  │   ├── context/       (blocks.json, instructions/)     │  │
│  │  │   └── data/          (kitt.db, sessions, state)       │  │
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
│              ┌──────────┼──────────┼──────────┐                 │
│              ▼          ▼          ▼          ▼                 │
│        ┌──────────┐ ┌──────────┐ ┌────────┐ ┌───────────┐      │
│        │ Telegram │ │ WhatsApp │ │ Slack  │ │ Slack Bot │      │
│        │ (active) │ │ (active) │ │ (user) │ │  (socket) │      │
│        └──────────┘ └──────────┘ └────────┘ └───────────┘      │
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
│   │   ├── context.ts          # Context wrapper (thin, calls unified builder)
│   │   ├── adapters/            # Channel adapters
│   │   │   ├── types.ts         # ChannelAdapter interface
│   │   │   ├── telegram.ts      # Telegram (grammy)
│   │   │   ├── whatsapp.ts      # WhatsApp (Baileys)
│   │   │   ├── slack.ts         # Slack User (@slack/web-api)
│   │   │   └── slack-bot.ts     # Slack Bot (@slack/bolt, Socket Mode)
│   │   ├── router.ts           # Multi-channel message router
│   │   ├── sessions.ts         # Session management
│   │   ├── state.ts            # Bridge state
│   │   └── logger.ts           # Logging
│   ├── context/                # Unified context builder (zie context.md)
│   │   ├── index.ts            # Main export: buildContext()
│   │   ├── builder.ts          # Core builder logic
│   │   ├── types.ts            # TypeScript interfaces
│   │   └── loaders/            # Dynamic loaders
│   │       ├── skills-loader.ts
│   │       ├── transcript-loader.ts
│   │       ├── memory-search.ts
│   │       ├── task-engine.ts
│   │       └── conversation-state.ts
│   ├── scheduler/              # Think loop & task engine
│   │   ├── index.ts            # Scheduler service
│   │   ├── think-loop.ts       # Response parser
│   │   ├── task-engine.ts      # Task management
│   │   └── sleep-mode.ts       # Sleep/DND mode
│   └── memory/                 # Memory service
│
├── profile/                    # 👤 User-specific data
│   ├── identity/               # KITT's personality
│   │   ├── IDENTITY.md         # Core identity
│   │   ├── SOUL.md             # Personality & values
│   │   ├── HUMOR.md            # Humor style
│   │   └── MEMORY.md           # Working memory (always in context)
│   ├── user/                   # User information
│   │   └── USER.md             # User profile
│   ├── context/                # Context builder config (zie context.md)
│   │   ├── blocks.json         # Welke context blocks laden
│   │   └── instructions/       # Editeerbare agent instructies
│   │       ├── core.md         # Basis gedragsregels
│   │       ├── capabilities.md # Interne tools
│   │       └── think-loop.md   # Think loop response format
│   └── data/                   # Runtime data & database
│       ├── kitt.db             # SQLite database (memory, transcripts)
│       ├── sessions.json       # Chat sessions
│       ├── bridge-state.json   # Bridge state
│       └── runtime.json        # Scheduler registry
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
- **Tech:** Node.js + grammy (Telegram) + Baileys (WhatsApp) + @slack/web-api (Slack User) + @slack/bolt (Slack Bot) + Agent SDK
- **Channels:** Telegram (bot), WhatsApp (QR), Slack User (xoxp- token + Events API + Cloudflare Tunnel), Slack Bot (xoxb- token + Socket Mode)
- **Flow:** Message → Bridge → Agent SDK → Response → Bridge → Channel
- **State:** `profile/data/` folder
- **Docs:** `_prd/architecture/bridge.md`

### 3. Unified Context System
- **Rol:** Bouwt de system prompt voor zowel chat als think loop
- **Config:** `profile/context/blocks.json` definieert welke blocks laden
- **Loaders:** Skills, transcripts, memory search, tasks, conversation state
- **Instructies:** Editeerbare `.md` files in `profile/context/instructions/`
- **Docs:** `_prd/architecture/context.md`

### 4. Profile Directory
- **Rol:** All user-specific data, portable between installations
- **Contents:** Identity, user, context config, runtime data
- **Principle:** Source code is same for all users, profile differs

### 5. Sub-Agents
- **Rol:** Background tasks via Task tool
- **Types:** Explore (research), Bash (commands), Plan (design)
- **Memory:** Access same database as main agent

### 6. KITT Portal
- **Rol:** Web UI voor beheer en monitoring
- **URL:** `http://localhost:3000` (dev) / `http://localhost:8000` (bridge)
- **Features:** System health, database explorer, task engine, live logs
- **Tech:** React + Vite + shadcn/ui
- **Status:** ✅ Geïmplementeerd (F64)
- **Docs:** `_prd/architecture/portal.md`

### 7. Memory Database
- **Rol:** Hybrid search over memory
- **Location:** `profile/data/kitt.db`
- **Components:** sqlite-vec (vectors) + FTS5 (keyword search)
- **Embeddings:** OpenAI text-embedding-3-large
- **Docs:** `_prd/architecture/memory.md`

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

- Bridge runs locally (no external API exposure, behalve via Cloudflare Tunnel voor Slack events)
- User whitelist via `TELEGRAM_ALLOWED_USERS`, `WHATSAPP_ALLOWED_NUMBERS`, database-backed Slack permissions
- Credentials via encrypted credential vault (`profile/data/kitt.db`)
- Slack Events API beschermd met HMAC SHA256 signing secret verificatie
- No automatic code execution from external messages
- Profile data stays local
