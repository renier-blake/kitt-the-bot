# KITT - PRD

> **Product:** KITT (Knowledge Interface for Transparent Tasks)
> **Huidige versie:** v0.1.0
> **Laatst bijgewerkt:** 5 februari 2026

---

## Quick Start voor Agents

### Feature-Based Workflow

**Belangrijk:** Eén agent werkt aan één complete feature.

```
/start F## → Lees feature spec → Lees alle "Lees Eerst" docs → Plan Mode → Build
```

### 1. Start met een Feature

```
/start F01
```

Dit leest de feature spec die bepaalt welke kennis je nodig hebt.

### 2. Lees de "Lees Eerst" Sectie

De feature spec bevat een "Lees Eerst" sectie met:
- **Briefings** - Domein-specifieke kennis
- **Architecture docs** - Technische context per component

**Lees ALLE genoemde documenten.**

### 3. Volg de 7-Stappen Workflow

**`WORKFLOW.md`** - Context → Plan → Build → Test → Review → Document → Commit → Handover

---

## Beschikbare Briefings (Kennisbronnen)

| Briefing | Inhoud | Wanneer lezen |
|----------|--------|---------------|
| [briefings/bridge.md](./briefings/bridge.md) | Message bridge, WhatsApp, channels | Feature raakt channel routing |
| [briefings/memory.md](./briefings/memory.md) | Memory systeem, MEMORY.md, vector search | Feature raakt memory |
| [briefings/agents.md](./briefings/agents.md) | Sub-agents, Task tool, orchestratie | Feature raakt multi-agent |
| [briefings/typescript.md](./briefings/typescript.md) | TypeScript, Node.js, algemene code | Alle features |

---

## Architecture Docs

| Component | Document |
|-----------|----------|
| Overview | [architecture/overview.md](./architecture/overview.md) |
| Message Bridge | [architecture/bridge.md](./architecture/bridge.md) |
| Memory System | [architecture/memory.md](./architecture/memory.md) |
| Multi-Agent | [architecture/multi-agent.md](./architecture/multi-agent.md) |

---

## Folder Structuur

```
_prd/
├── README.md              # Dit bestand
├── BACKLOG.md             # Geprioriteerde feature lijst
├── STATUS.md              # SINGLE SOURCE OF TRUTH - taakstatus
├── WORKFLOW.md            # 7-stappen agent workflow
│
├── architecture/          # Technische documentatie
│   ├── overview.md        # Systeem overzicht
│   ├── bridge.md          # Message bridge
│   ├── memory.md          # Memory systeem
│   └── multi-agent.md     # Multi-agent architectuur
│
├── briefings/             # Agent briefings (kennisbronnen)
│   ├── README.md
│   ├── bridge.md
│   ├── memory.md
│   ├── agents.md
│   └── typescript.md
│
└── features/              # Feature specificaties
    ├── _TEMPLATE.md
    └── F##_*.md
```

---

## Key Documents

| Document | Doel |
|----------|------|
| `STATUS.md` | Single source of truth - wat is de status van alle taken |
| `BACKLOG.md` | Geprioriteerde lijst van features |
| `WORKFLOW.md` | De 7-stappen workflow die elke agent volgt |
| `features/_TEMPLATE.md` | Template voor nieuwe feature specs |

---

## Workflow Samenvatting

```
1. CONTEXT   → /start F## → Lees ALLE docs in "Lees Eerst"
2. PLAN      → Plan Mode, maak implementatieplan
3. BUILD     → Implementeer (revert bij 3+ failed attempts)
4. TEST      → Verificatie dat het werkt
5. REVIEW    → /review - Code review rapport
6. DOCUMENT  → Update feature doc met "Implementation" sectie
7. COMMIT    → Git commit (vraag toestemming!)
8. HANDOVER  → /handover - Architecture docs, STATUS.md
```

**Eén agent, complete feature.** Geen handovers tussen agents tijdens een feature.

---

## Reference Implementations

| Repo | Locatie | Focus |
|------|---------|-------|
| NanoClaw | `_repos/nanoclaw/` | Simpel, transparant, WhatsApp-first |
| OpenClaw | `_repos/openclaw/` | Multi-platform, advanced memory |

Zie `CLAUDE.md` in de root voor de volledige vergelijking.
