---
name: notion
description: Access Notion workspace — pages, databases, blocks, comments, users. Use when the user asks about Notion, wiki, knowledge base, or documentation.
metadata: {"kitt":{"emoji":"📝"}}
---

# Notion

Access Notion workspace via the Notion API.

## Commands

Run from project root:

```bash
npx tsx .claude/skills/notion/notion-api.ts <command> [options]
```

| Command | Beschrijving |
|---------|-------------|
| `me` | Bot info en workspace |
| `search <query> [--type=page\|database]` | Zoek pages en databases |
| `page <id>` | Page properties |
| `create-page <parent_id> <title> [--parent-type=page\|database]` | Page aanmaken |
| `update-page <id> [--title=x] [--archived=true]` | Page updaten/archiveren |
| `database <id>` | Database schema |
| `query <database_id> [--filter=json] [--limit=n]` | Query database |
| `create-db <parent_page_id> <title>` | Database aanmaken |
| `blocks <id> [--limit=n]` | Block children ophalen |
| `append <id> <text> [--type=paragraph\|heading_2\|to_do\|bulleted_list_item]` | Block toevoegen |
| `delete-block <id>` | Block verwijderen |
| `comments <page_or_block_id>` | Comments ophalen |
| `comment <page_id> <text>` | Comment plaatsen |
| `users` | Lijst workspace users |

## Examples

**Zoek pages:**
```bash
npx tsx .claude/skills/notion/notion-api.ts search "Meeting Notes"
```

**Query een database:**
```bash
npx tsx .claude/skills/notion/notion-api.ts query abc123-def456
```

**Page aanmaken in database:**
```bash
npx tsx .claude/skills/notion/notion-api.ts create-page abc123-def456 "Nieuwe taak" --parent-type=database
```

**Blocks van een page lezen:**
```bash
npx tsx .claude/skills/notion/notion-api.ts blocks abc123-def456
```

**Tekst toevoegen aan page:**
```bash
npx tsx .claude/skills/notion/notion-api.ts append abc123-def456 "Dit is nieuwe content"
```

## Setup

Twee auth methoden:

1. **OAuth** (aanbevolen voor individuele users): Portal > Integrations > Notion > Connect
2. **Internal Integration Token** (voor team/workspace): Portal > Integrations > Notion (Internal Token) > Connect

## Notes

- Notion API versie: 2022-06-28
- OAuth tokens worden automatisch ververst
- Internal Integration Tokens verlopen niet
- Rate limit: 3 requests per seconde gemiddeld
- Pages/databases moeten gedeeld zijn met de integratie om toegankelijk te zijn
