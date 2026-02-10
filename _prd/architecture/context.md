# Unified Context System

> Eén context builder voor zowel chat als think loop
> **Laatst bijgewerkt:** 9 februari 2026

---

## Waarom Unified Context?

Voorheen had KITT twee aparte context-bouw systemen:
- **Chat mode** (`src/bridge/context.ts`) - voor gesprekken via Telegram/WhatsApp
- **Think loop** (`src/scheduler/think-loop.ts`) - voor autonome reflectie

Dit leidde tot:
- Duplicate code (skills discovery, transcript loading, file reading)
- Features die 2x gebouwd moesten worden
- Divergentie tussen systemen (bijv. `HUMOR.md` werd nooit geladen)
- Hardcoded instructies in TypeScript

De nieuwe **Unified Context System** lost dit op met één configureerbare builder.

---

## Architectuur

```
┌─────────────────────────────────────────────────────────────────┐
│                    TRIGGER                                       │
│  • Chat: Telegram/WhatsApp bericht komt binnen                  │
│  • Think: Interval timer (elke 5 min)                           │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│              buildContext({ mode, userQuery?, db? })             │
│                    src/context/builder.ts                        │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                  profile/context/blocks.json                     │
│                                                                  │
│  Bepaalt welke context blocks geladen worden:                   │
│  • Welke files (.md)                                            │
│  • Welke dynamic loaders (skills, transcripts, tasks)           │
│  • Voor welke mode (chat, think, of beide)                      │
│  • In welke volgorde (priority)                                 │
└──────────────────────────┬──────────────────────────────────────┘
                           │
          ┌────────────────┼────────────────┐
          ▼                ▼                ▼
   ┌────────────┐   ┌────────────┐   ┌────────────┐
   │  file      │   │  dynamic   │   │instruction │
   │  loader    │   │  loaders   │   │  loader    │
   └────────────┘   └────────────┘   └────────────┘
          │                │                │
          ▼                ▼                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SYSTEM PROMPT                                 │
│                                                                  │
│  ## Who You Are                                                 │
│  [IDENTITY.md content]                                          │
│                                                                  │
│  ## Your Soul & Values                                          │
│  [SOUL.md content]                                              │
│                                                                  │
│  ## Skills                                                      │
│  [skills-loader output]                                         │
│  ...                                                            │
└─────────────────────────────────────────────────────────────────┘
```

---

## Block Types

De context builder ondersteunt drie types blocks:

### 1. `file` - Statische Markdown Files

Laadt een `.md` file en voegt een header toe.

```json
{
  "id": "identity",
  "type": "file",
  "path": "profile/identity/IDENTITY.md",
  "header": "Who You Are",
  "modes": ["chat", "think"],
  "priority": 1
}
```

**Bestanden in `profile/identity/`:**
| File | Doel |
|------|------|
| `IDENTITY.md` | Wie KITT is, persoonlijkheid |
| `SOUL.md` | Ethiek, gedrag, kernwaarden |
| `HUMOR.md` | Humor stijl en voorkeuren |
| `MEMORY.md` | Working memory, user facts |

### 2. `dynamic` - Runtime Loaders

Voert code uit om context te genereren. Elke loader heeft eigen configuratie.

```json
{
  "id": "skills",
  "type": "dynamic",
  "source": "skills-loader",
  "config": {
    "chat": { "filter": "all" },
    "think": { "filter": "automated" }
  }
}
```

**Beschikbare loaders:**

| Loader | Source | Modes | Functie |
|--------|--------|-------|---------|
| Skills | `skills-loader` | chat, think | Laadt skills uit `.claude/skills/`. Chat: alle skills. Think: alleen `every_time` en `scheduled`. |
| Transcripts | `transcript-loader` | chat, think | Recente gesprekken. Chat: 15 min window. Think: hele dag. |
| Memory Search | `memory-search` | chat | Vector search op basis van user query. |
| Conversation State | `conversation-state` | think | Unanswered messages, conversation gaps. |
| Task Engine | `task-engine` | think | Open taken uit `kitt_tasks` tabel. |

### 3. `instruction` - Editeerbare Instructies

Markdown files met instructies voor de agent. Vergelijkbaar met `file` maar semantisch anders.

```json
{
  "id": "core-instructions",
  "type": "instruction",
  "path": "profile/context/instructions/core.md",
  "modes": ["chat", "think"]
}
```

**Instructie files in `profile/context/instructions/`:**
| File | Modes | Inhoud |
|------|-------|--------|
| `core.md` | chat, think | Basis gedragsregels (Nederlands, direct, etc.) |
| `capabilities.md` | chat, think | Interne tools (memory search, sleep mode) |
| `think-loop.md` | think | Response format voor think loop (ACTION: OK, MESSAGE, TASK, etc.) |

---

## Modes

De builder ondersteunt twee modes:

### Chat Mode
- Getriggerd door: Telegram/WhatsApp bericht
- Doel: Gesprek met gebruiker
- Specifieke blocks: `memory-search` (vector search op user query)
- Skills: Alle skills geladen

### Think Mode
- Getriggerd door: Interval timer (5 min)
- Doel: Autonome reflectie en taak-uitvoering
- Specifieke blocks: `task-engine`, `conversation-state`
- Skills: Alleen `every_time` en `scheduled` skills

---

## Priority Ordering

Blocks worden gesorteerd op `priority` (laag = eerst):

| Priority | Blocks | Rationale |
|----------|--------|-----------|
| 1-10 | Identity, Soul, Humor, User | Kernidentiteit eerst |
| 11-20 | Working Memory, Skills | Context over wie je bent |
| 30-40 | Transcripts, Memory Search, Tasks | Runtime data |
| 100+ | Instructions | Instructies aan het eind |
| 200 | Think Loop Task | Allerlaatste (alleen think mode) |

---

## Configuratie Aanpassen

### Block toevoegen

Voeg toe aan `profile/context/blocks.json`:

```json
{
  "id": "new-context",
  "type": "file",
  "path": "profile/custom/NEW-FILE.md",
  "header": "Custom Section",
  "modes": ["chat"],
  "priority": 15,
  "enabled": true
}
```

### Block uitschakelen

Zet `"enabled": false` in blocks.json.

### Loader configuratie wijzigen

Pas de `config` aan per mode:

```json
{
  "id": "recent-transcripts",
  "config": {
    "chat": { "windowMinutes": 30, "maxMessages": 20 },
    "think": { "windowMinutes": 1440, "maxMessages": 50 }
  }
}
```

---

## Gerelateerde Documentatie

| Document | Onderwerp |
|----------|-----------|
| [Think Loop](_prd/architecture/think-loop.md) | Hoe de think loop werkt |
| [Skills](_prd/architecture/skills.md) | Skill systeem en triggers |
| [Bridge](_prd/architecture/bridge.md) | Message bridge architectuur |
| [Memory](_prd/architecture/memory.md) | SQLite database en vector search |

---

## Codebase Referenties

| Pad | Functie |
|-----|---------|
| `src/context/index.ts` | Hoofdexport: `buildContext()` |
| `src/context/builder.ts` | Core builder logica |
| `src/context/types.ts` | TypeScript interfaces |
| `src/context/loaders/` | Dynamic loaders |
| `profile/context/blocks.json` | Configuratie |
| `profile/context/instructions/` | Editeerbare instructies |
| `profile/identity/` | Identity markdown files |

---

## Migratie Historie

**KITT-106 (9 feb 2026)**: Unified Context Builder

Veranderingen:
1. Nieuw `src/context/` module met configureerbare builder
2. `blocks.json` voor declaratieve context definitie
3. Instructies verplaatst van hardcoded TypeScript naar `profile/context/instructions/`
4. `think-loop.ts` verkleind van ~800 naar ~143 regels (alleen `parseThinkResponse` behouden)
5. `bridge/context.ts` verkleind naar thin wrapper

Profile folder herstructurering:
- `profile/memory/` → `profile/data/` (kitt.db, backups)
- `profile/memory/MEMORY.md` → `profile/identity/MEMORY.md`
- `profile/state/` → `profile/data/` (sessions.json, bridge-state.json)
- `profile/schedules/` → `profile/data/runtime.json`
- Nieuw: `profile/context/` (blocks.json, instructions/)
