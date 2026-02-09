# Agent Briefings

Kennisbronnen voor agents die aan KITT werken.

---

## Beschikbare Briefings

| Briefing | Inhoud | Wanneer lezen |
|----------|--------|---------------|
| [product-owner.md](./product-owner.md) | PO rol, multi-chat workflow, handovers | **PO-agent altijd** |
| [bridge.md](./bridge.md) | Message bridge, channels, WhatsApp | Issue raakt channel routing |
| [memory.md](./memory.md) | Memory systeem, MEMORY.md, retrieval | Issue raakt memory |
| [agents.md](./agents.md) | Sub-agents, Task tool, orchestratie | Issue raakt multi-agent |
| [typescript.md](./typescript.md) | TypeScript, Node.js, algemene code | Alle issues |

---

## Hoe te Gebruiken

1. Start met `/issue PAS-01` om aan een issue te werken
2. De `/issue` skill leest automatisch relevante docs op basis van project
3. Raadpleeg architecture docs voor technische details

---

## Project → Docs Mapping

| Project | Relevante Docs |
|---------|----------------|
| PAS | `_prd/brainstorm/pas.md`, `src/integrations/` |
| KITT | `_prd/architecture/`, `CLAUDE.md` |
| POR | `frontends/kitt-portal/`, `src/bridge/log-server.ts` |
| SKL | `.claude/skills/`, bestaande skills als reference |
| INF | `src/bridge/`, `src/scheduler/`, `src/memory/` |
| DAT | `profile/`, Garmin/nutrition skills |

---

## Architecture Docs

Voor diepere technische details:

| Component | Document |
|-----------|----------|
| System Overview | `_prd/architecture/overview.md` |
| Message Bridge | `_prd/architecture/bridge.md` |
| Memory System | `_prd/architecture/memory.md` |
| Multi-Agent | `_prd/architecture/multi-agent.md` |
