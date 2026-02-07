# Skill Template

Kopieer dit bestand naar `profile/skills/<skill-name>/SKILL.md` en vul in.

**BELANGRIJK:** De `metadata` moet een single-line JSON object zijn (OpenClaw/AgentSkills compatible).

---

```markdown
---
name: skill-name
description: Korte beschrijving (1 zin)
homepage: https://developer.example.com
metadata: {"kitt":{"emoji":"🔧","requires":{"bins":["jq","curl"],"env":["API_KEY"]},"primaryEnv":"API_KEY","os":["darwin"]}}
---

# Skill Name

Beschrijving van wat deze skill doet en wanneer te gebruiken.

## Setup

1. **Verkrijg API key:** https://example.com/settings
2. **Zet environment variable:**
   ```bash
   export EXAMPLE_API_KEY="your-key-here"
   ```
3. **Optioneel:** Installeer CLI tool
   ```bash
   brew install example-cli
   ```

## Quick Reference

| Action | Command |
|--------|---------|
| List items | `example list` |
| Add item | `example add "name"` |
| Complete item | `example complete <id>` |

## Commands

### List Items

```bash
curl -s "https://api.example.com/items" \
  -H "Authorization: Bearer $EXAMPLE_API_KEY" | \
  jq '.[] | {id, name}'
```

### Create Item

```bash
curl -s -X POST "https://api.example.com/items" \
  -H "Authorization: Bearer $EXAMPLE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name": "New item"}'
```

### Update Item

```bash
curl -s -X PUT "https://api.example.com/items/{id}" \
  -H "Authorization: Bearer $EXAMPLE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name": "Updated name"}'
```

### Delete Item

```bash
curl -s -X DELETE "https://api.example.com/items/{id}" \
  -H "Authorization: Bearer $EXAMPLE_API_KEY"
```

## Examples

```bash
# Voorbeeld 1: Dagelijkse workflow
example list --filter today

# Voorbeeld 2: Quick add
example add "Buy groceries" --due tomorrow
```

## Notes

- **Rate limits:** X requests per minute
- **Gotchas:** Let op bij Y
- **Tips:** Gebruik --json voor scripting output
```

---

## Checklist voor nieuwe skill

- [ ] `name` is uniek en lowercase-with-dashes
- [ ] `description` is 1 zin, beschrijft wat het doet
- [ ] `homepage` linkt naar API docs
- [ ] `requires.bins` lijst alle benodigde CLI tools
- [ ] `requires.env` lijst alle benodigde env vars
- [ ] Setup sectie heeft duidelijke stappen
- [ ] Commands zijn copy-paste ready
- [ ] Examples tonen echte use cases
