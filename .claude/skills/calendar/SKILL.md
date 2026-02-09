---
name: calendar
description: Access Google Calendar via Nango. Use when the user asks about calendar events, meetings, or schedule.
---

# Google Calendar (via Nango)

Access Google Calendar through the Nango OAuth integration.

## Commands

Run from project root:

```bash
npx tsx .claude/skills/calendar/calendar-api.ts <command> [options]
```

| Command | Beschrijving |
|---------|-------------|
| `today` | Events van vandaag |
| `tomorrow` | Events van morgen |
| `week` | Events van deze week |
| `upcoming [n]` | Volgende n events (default: 10) |
| `event <eventId>` | Details van specifiek event |
| `search <query> [n]` | Zoek events (default: 10) |
| `calendars` | Lijst alle calendars |
| `create` | Maak nieuw event (interactive) |
| `free <date>` | Vrije slots op datum (YYYY-MM-DD) |

## Examples

**Events vandaag:**
```bash
npx tsx .claude/skills/calendar/calendar-api.ts today
```

**Events deze week:**
```bash
npx tsx .claude/skills/calendar/calendar-api.ts week
```

**Zoek meetings:**
```bash
npx tsx .claude/skills/calendar/calendar-api.ts search "standup" 5
```

**Maak event:**
```bash
npx tsx .claude/skills/calendar/calendar-api.ts create \
  --title "Meeting met Jan" \
  --start "2026-02-10T14:00:00" \
  --end "2026-02-10T15:00:00" \
  --description "Bespreken Q1 planning"
```

**Vrije slots checken:**
```bash
npx tsx .claude/skills/calendar/calendar-api.ts free 2026-02-10
```

## Response Format

**Today/Week:**
```
📅 Vandaag (3 events):

09:00 - 09:30 | Daily Standup
  📍 Google Meet
  👥 team@company.com

11:00 - 12:00 | 1:1 with Manager
  📍 Room 3.14
  📝 Weekly sync

14:00 - 15:00 | Client Call
  📍 Zoom
  👥 client@example.com, pm@company.com
```

**Event details:**
```
📅 Event Details:
Titel: Client Call
Start: 10 feb 2026, 14:00
Einde: 10 feb 2026, 15:00
Locatie: Zoom
Status: confirmed

Beschrijving:
Quarterly review meeting with client.

Deelnemers:
- client@example.com (accepted)
- pm@company.com (tentative)
- you (organizer)
```

**Free slots:**
```
🕐 Vrije slots op 10 feb 2026:

08:00 - 09:00 (1 uur)
09:30 - 11:00 (1.5 uur)
12:00 - 14:00 (2 uur)
15:00 - 18:00 (3 uur)
```

## Troubleshooting

### "No connection found"
Google Calendar niet gekoppeld in Nango. Ga naar KITT Portal → Integrations → Google Calendar → Connect.

### "Insufficient permission"
Scopes missen. Check Nango dashboard → Integrations → google-calendar → Scopes.

Benodigde scopes:
- `https://www.googleapis.com/auth/calendar` (volledige toegang)
- of `https://www.googleapis.com/auth/calendar.readonly` (alleen lezen)
- of `https://www.googleapis.com/auth/calendar.events` (alleen events)

## Notes

- OAuth tokens worden automatisch ververst door Nango
- Werkt met Google Calendar en Google Workspace
- Default calendar is de primary calendar van de user
- Tijden zijn in lokale timezone (Europe/Amsterdam)
