# KITT - PRD

> **Product:** KITT (Knowledge Interface for Transparent Tasks)
> **Huidige versie:** v0.1.0
> **Laatst bijgewerkt:** 9 februari 2026

---

## Quick Start voor Agents

### Issue-Based Workflow

**Belangrijk:** Eén agent werkt aan één complete issue.

```
/issue PAS-01 → Lees relevante docs → Plan Mode → Build → Update state → Commit
```

### 1. Start met een Issue

```
/issue PAS-01
/issue KITT-05
/issue POR-3
```

Dit haalt het issue op uit de database en leest automatisch relevante docs.

### 2. Project → Docs Mapping

De `/issue` skill bepaalt welke docs je moet lezen op basis van het project:

| Project | Docs |
|---------|------|
| PAS | `_prd/brainstorm/pas.md`, `src/integrations/` |
| KITT | `_prd/architecture/`, `CLAUDE.md` |
| POR | `frontends/kitt-portal/`, `src/bridge/log-server.ts` |
| SKL | `.claude/skills/`, bestaande skills als reference |
| INF | `src/bridge/`, `src/scheduler/`, `src/memory/` |
| DAT | `profile/`, Garmin/nutrition skills |

### 3. Volg de Agent Workflow

Zie `_prd/workflows/AGENT.md` - Lezen → Bouwen → Testen → Update State → Commit

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
└── workflows/             # Agent workflows
    └── AGENT.md           # Issue workflow voor agents
```

---

## Project Management (Database)

Issues en projecten worden beheerd in SQLite: `profile/memory/kitt.db`

| Tabel | Doel |
|-------|------|
| `portal_projects` | Projecten (PAS, KITT, POR, SKL, INF, DAT) |
| `portal_issues` | Issues per project met identifier, title, description, type, state, priority |
| `portal_triage` | Automatisch gevonden issues (door codebase-health-audit) |

### Issue Query

```bash
sqlite3 -json profile/memory/kitt.db "
  SELECT i.identifier, i.title, i.description, i.type, i.state, i.priority,
         p.identifier as project, p.name as project_name
  FROM portal_issues i
  LEFT JOIN portal_projects p ON i.project_id = p.id
  WHERE i.state != 'done'
  ORDER BY i.priority DESC
"
```

---

## Workflow Samenvatting

```
1. START     → /issue PAS-01
2. LEZEN     → Automatisch relevante docs op basis van project
3. PLAN      → Plan Mode, maak implementatieplan
4. BUILD     → Implementeer
5. TEST      → Verificatie dat het werkt
6. STATE     → Update issue state naar 'done'
7. COMMIT    → Git commit (vraag toestemming!)
```

**Eén agent, één issue.** Geen handovers tussen agents tijdens een issue.

---

## KITT Portal

De KITT Portal (`frontends/kitt-portal/`) biedt een UI voor:
- Issues en projecten beheren
- Triage items reviewen
- Integraties (Nango OAuth) configureren
- Logs bekijken

Start de portal via de bridge: `pm2 start npm --name kitt -- run bridge`
