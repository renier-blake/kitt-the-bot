---
name: gmail
description: Access Gmail via Nango. Use when the user asks about emails, inbox, or wants to send/read messages.
---

# Gmail (via Nango)

Access Gmail through the Nango OAuth integration.

## Commands

Run from project root:

```bash
npx tsx .claude/skills/gmail/gmail-api.ts <command> [options]
```

| Command | Beschrijving |
|---------|-------------|
| `profile` | Email adres en totaal aantal berichten |
| `labels` | Lijst alle labels |
| `unread [n]` | Laatste n ongelezen emails (default: 5) |
| `inbox [n]` | Laatste n emails uit inbox (default: 5) |
| `read <messageId>` | Lees volledige email |
| `search <query> [n]` | Zoek emails (default: 5 resultaten) |
| `send <to> <subject>` | Stuur email (body via stdin) |

## Examples

**Check ongelezen emails:**
```bash
npx tsx .claude/skills/gmail/gmail-api.ts unread 3
```

**Zoek specifieke emails:**
```bash
npx tsx .claude/skills/gmail/gmail-api.ts search "from:github.com" 5
```

**Lees een specifieke email:**
```bash
npx tsx .claude/skills/gmail/gmail-api.ts read 18d5a7f8e9b2c3d4
```

**Stuur een email:**
```bash
echo "Dit is de body van de email" | npx tsx .claude/skills/gmail/gmail-api.ts send "someone@example.com" "Onderwerp hier"
```

## Response Format

**Inbox/Unread:**
```
📬 Inbox (3 berichten):

1. [18d5a7f8e9b2c3d4] 14:32
   Van: John Doe <john@example.com>
   Onderwerp: Meeting morgen
   Preview: Hey, kunnen we morgen om 10:00...

2. [18d5a7f8e9b2c3d5] 13:15
   Van: GitHub <noreply@github.com>
   Onderwerp: [repo] New pull request
   Preview: @user opened a new pull request...
```

**Volledige email:**
```
📧 Email Details:
Van: John Doe <john@example.com>
Aan: renier@leadit.eu
Datum: 9 feb 2026, 14:32
Onderwerp: Meeting morgen

---
Hey Renier,

Kunnen we morgen om 10:00 even bellen over het project?

Groet,
John
```

## Troubleshooting

### "No connection found"
Gmail niet gekoppeld in Nango. Ga naar Nango dashboard → Connections → Add Connection → google-mail.

### "Insufficient permission"
Scopes missen. Check Nango dashboard → Integrations → google-mail → Scopes.

Benodigde scopes:
- `https://www.googleapis.com/auth/gmail.readonly` (lezen)
- `https://www.googleapis.com/auth/gmail.send` (versturen)

## Notes

- ✅ OAuth tokens worden automatisch ververst door Nango
- ✅ Werkt met elke Gmail/Workspace account
- ⚠️ Rate limits: 250 quota units per user per second
- 📊 Quota: ~1 miljard units per dag (ruim voldoende)
