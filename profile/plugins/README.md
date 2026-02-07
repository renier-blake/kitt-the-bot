# KITT Plugins Configuration

Dit is de locatie voor user-specifieke plugin configuratie.

## Environment Variables (Recommended)

De beste manier om API keys te configureren is via environment variables in `.env`:

```bash
# .env (in project root)
TODOIST_API_TOKEN=xxx
NOTION_API_KEY=xxx
TRELLO_API_KEY=xxx
TRELLO_TOKEN=xxx
```

Of in je shell profile (`~/.zshrc`):

```bash
export TODOIST_API_TOKEN="xxx"
```

## Welke Skills zijn Actief?

KITT laadt automatisch alle skills uit `skills/` waarvan de requirements voldaan zijn:

| Skill | Requirements | Status |
|-------|--------------|--------|
| apple-reminders | `remindctl` binary | Check: `which remindctl` |
| todoist | `TODOIST_API_TOKEN` env | Check: `echo $TODOIST_API_TOKEN` |

## API Keys Verkrijgen

### Todoist
1. Ga naar https://app.todoist.com/app/settings/integrations/developer
2. Kopieer "API token"

### Notion
1. Ga naar https://notion.so/my-integrations
2. Maak nieuwe integration
3. Kopieer "Internal Integration Secret"
4. **Belangrijk:** Share je pages/databases met de integration!

### Trello
1. Ga naar https://trello.com/app-key
2. Kopieer "API Key"
3. Klik "Token" link en autoriseer
4. Kopieer token

## Troubleshooting

### Skill wordt niet geladen

1. Check requirements:
   ```bash
   # Voor CLI tools
   which remindctl

   # Voor env vars
   echo $TODOIST_API_TOKEN
   ```

2. Check skill metadata in `skills/<name>/SKILL.md`

3. Restart bridge: `npm run pm2:restart`

### API geeft errors

1. Check of token/key correct is
2. Check rate limits (zie skill docs)
3. Check permissions (vooral Notion - moet je pages sharen)
