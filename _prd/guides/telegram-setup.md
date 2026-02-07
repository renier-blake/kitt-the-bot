# Telegram Bot Setup Guide

> Hoe je een nieuwe Telegram bot maakt voor KITT.

---

## Stap 1: Bot Aanmaken via @BotFather

1. Open Telegram en zoek naar `@BotFather`
2. Start een chat en stuur `/newbot`
3. Volg de prompts:
   - **Bot name:** `KITT Assistant` (of wat je wilt)
   - **Username:** `kitt_renier_bot` (moet eindigen op `bot`)
4. Je krijgt een **Bot Token** - bewaar deze veilig!

```
Done! Congratulations on your new bot. You will find it at t.me/kitt_renier_bot.

Use this token to access the HTTP API:
123456789:ABCdefGHIjklMNOpqrsTUVwxyz

Keep your token secure and store it safely.
```

---

## Stap 2: Bot Configureren

### Privacy Mode Uitschakelen (voor groepen)

Als je KITT in groepen wilt gebruiken:

1. Chat met @BotFather
2. Stuur `/mybots`
3. Selecteer je bot
4. **Bot Settings** → **Group Privacy** → **Turn off**

### Commands Instellen (optioneel)

1. Chat met @BotFather
2. Stuur `/setcommands`
3. Selecteer je bot
4. Stuur je commands:

```
start - Start KITT
help - Hulp
status - Check status
remember - Onthoud iets
```

---

## Stap 3: Token Opslaan

### Optie A: Environment Variable

```bash
# In je shell profile (~/.zshrc of ~/.bashrc)
export TELEGRAM_BOT_TOKEN="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
```

### Optie B: .env File

```bash
# In KITT V1/.env (voeg toe aan .gitignore!)
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz
```

### Optie C: TOOLS.md

Update `TOOLS.md` met je chat_id (na eerste bericht):

```markdown
## Telegram
- Bot: @kitt_renier_bot
- Token: in .env
- Chat ID: [krijg je na eerste bericht]
```

---

## Stap 4: Chat ID Krijgen

Na je eerste bericht aan de bot, kun je je chat_id vinden:

```bash
curl "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getUpdates"
```

Of via de bridge (wanneer die draait) in de logs.

---

## Stap 5: Test de Bot

```bash
# Test bericht sturen
curl -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
  -H "Content-Type: application/json" \
  -d '{"chat_id": "YOUR_CHAT_ID", "text": "Hello from KITT!"}'
```

---

## Verificatie Checklist

- [ ] Bot aangemaakt via @BotFather
- [ ] Token veilig opgeslagen (niet in git!)
- [ ] Privacy mode uitgeschakeld (indien nodig)
- [ ] Test bericht succesvol verzonden
- [ ] Chat ID bekend

---

## Volgende Stappen

1. Token toevoegen aan `.env`
2. TOOLS.md updaten met bot info
3. F02 Message Bridge implementeren

---

## Troubleshooting

### "Unauthorized" Error
- Check of token correct is
- Token mag geen spaties hebben

### Geen Updates
- Stuur eerst een bericht naar je bot
- Wacht even en probeer getUpdates opnieuw

### Bot Reageert Niet in Groep
- Check Group Privacy setting
- Bot moet admin zijn OF privacy uit

---

## Security Notes

- **NOOIT** token committen naar git
- Gebruik .env of environment variables
- Token kan gereset worden via @BotFather `/revoke`
- Maak regelmatig nieuwe tokens aan
