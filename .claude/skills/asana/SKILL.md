---
name: asana
description: Manage Asana projects and tasks. Use when the user asks about project tasks, work items, Asana projects, or task management.
metadata: {"kitt":{"emoji":"📋"}}
---

# Asana

Manage Asana projects and tasks via the Asana REST API.

## Commands

Run from project root:

```bash
npx tsx .claude/skills/asana/asana-api.ts <command> [options]
```

| Command | Beschrijving |
|---------|-------------|
| `me` | Huidige user en workspace info |
| `projects` | Lijst alle projecten |
| `project <gid>` | Project details |
| `sections <project_gid>` | Secties in een project |
| `tasks <project_gid> [--section=gid]` | Taken in een project (optioneel filter op sectie) |
| `task <gid>` | Taak details |
| `create <project_gid> <name> [--assignee=email] [--due=YYYY-MM-DD]` | Taak aanmaken |
| `update <gid> [--name=x] [--due=x] [--notes=x]` | Taak updaten |
| `complete <gid>` | Taak afronden |
| `assign <gid> <email>` | Taak toewijzen |
| `comments <gid>` | Comments op een taak |
| `comment <gid> <text>` | Comment plaatsen |
| `tags` | Lijst alle tags |
| `tag <task_gid> <tag_gid>` | Tag toevoegen aan taak |
| `search <query>` | Zoek taken in workspace |

## Examples

**Bekijk projecten:**
```bash
npx tsx .claude/skills/asana/asana-api.ts projects
```

**Taken in een project:**
```bash
npx tsx .claude/skills/asana/asana-api.ts tasks 1234567890
```

**Taak aanmaken:**
```bash
npx tsx .claude/skills/asana/asana-api.ts create 1234567890 "Bug fixen" --assignee=renier@example.com --due=2026-03-01
```

**Taak details:**
```bash
npx tsx .claude/skills/asana/asana-api.ts task 9876543210
```

**Zoek taken:**
```bash
npx tsx .claude/skills/asana/asana-api.ts search "homepage redesign"
```

## Setup

Twee auth methoden:

1. **OAuth** (aanbevolen voor individuele users): Portal > Integrations > Asana > Connect
2. **Personal Access Token** (voor team/service): Portal > Integrations > Asana (API Token) > Connect

## Notes

- OAuth tokens verlopen na 1 uur en worden automatisch ververst
- PAT tokens verlopen niet
- Asana API rate limit: 1500 requests per minuut
