---
name: apple-reminders
description: Check Apple Reminders for today - flagged items need attention
metadata: {"kitt":{"emoji":"⏰","trigger":"every_time","os":["darwin"],"fetch":"osascript -e 'tell application \"Reminders\" to get name of (reminders whose completed is false)'"}}
---

# Apple Reminders (osascript)

Check and manage Apple Reminders via osascript. No external tools needed.

## Quick Reference

| Action | Command |
|--------|---------|
| Today's reminders | `osascript -e 'tell application "Reminders" to get name of (reminders whose due date is today and completed is false)'` |
| All incomplete | `osascript -e 'tell application "Reminders" to get name of (reminders whose completed is false)'` |
| List all lists | `osascript -e 'tell application "Reminders" to get name of every list'` |

## Get Today's Reminders

```bash
# Get names of reminders due today
osascript -e 'tell application "Reminders"
  set today to current date
  set time of today to 0
  set tomorrow to today + 1 * days
  set output to ""
  repeat with r in (reminders whose completed is false)
    set d to due date of r
    if d is not missing value and d ≥ today and d < tomorrow then
      set output to output & name of r & linefeed
    end if
  end repeat
  return output
end tell'
```

## Get Flagged Reminders

```bash
osascript -e 'tell application "Reminders"
  get name of (reminders whose flagged is true and completed is false)
end tell'
```

## Get All Incomplete Reminders

```bash
osascript -e 'tell application "Reminders"
  set output to ""
  repeat with r in (reminders whose completed is false)
    set output to output & name of r & " | due: " & (due date of r as string) & linefeed
  end repeat
  return output
end tell'
```

## Complete a Reminder by Name

```bash
osascript -e 'tell application "Reminders"
  set r to first reminder whose name is "Buy milk"
  set completed of r to true
end tell'
```

## Add a Reminder

```bash
# Simple reminder
osascript -e 'tell application "Reminders"
  tell list "Reminders"
    make new reminder with properties {name:"Call mom"}
  end tell
end tell'

# With due date (today at 3pm)
osascript -e 'tell application "Reminders"
  tell list "Reminders"
    set dueTime to current date
    set hours of dueTime to 15
    set minutes of dueTime to 0
    make new reminder with properties {name:"Meeting", due date:dueTime}
  end tell
end tell'
```

---

## Gedrag (Scheduled)

Als every_time skill check je reminders en beslis je of de user eraan herinnerd moet worden. Je maakt zelf afwegingen.

### Reminder Prioriteit

| Type | Urgentie | Actie |
|------|----------|-------|
| Flagged (!) | Hoog | Altijd melden als nog niet gedaan |
| Due today | Normaal | Melden op relevante momenten |
| Overdue | Hoog | Melden dat het over tijd is |
| No due date | Laag | Alleen melden als expliciet gevraagd |

### Check Queries

**Vandaag's reminders met details:**
```bash
osascript -e 'tell application "Reminders"
  set today to current date
  set time of today to 0
  set tomorrow to today + 1 * days
  set output to ""
  repeat with r in (reminders whose completed is false)
    set d to due date of r
    set f to flagged of r
    if d is not missing value and d ≥ today and d < tomorrow then
      if f then
        set output to output & "⚑ " & name of r & linefeed
      else
        set output to output & "• " & name of r & linefeed
      end if
    end if
  end repeat
  return output
end tell'
```

**Alleen geflagde reminders:**
```bash
osascript -e 'tell application "Reminders" to get name of (reminders whose flagged is true and completed is false)'
```

### Gedragsregels

1. **Check eerst**
   - Lees de fetch output voordat je iets zegt.
   - Geen reminders voor vandaag? → ACTION: OK

2. **Prioriteer geflagde items**
   - Flagged (⚑) reminders krijgen voorrang.
   - Meld deze eerder op de dag dan normale reminders.

3. **Timing is context-afhankelijk**
   - Ochtend (voor 10:00): "Voor vandaag heb je nog: ..."
   - Middag: alleen melden als flagged of urgent
   - Avond (na 18:00): "Nog niet afgevinkt vandaag: ..."

4. **Check transcripts - geen dubbele meldingen**
   - Kijk in de transcripts: heb je deze reminder vandaag al gemeld?
   - Zo ja → niet nog een keer dezelfde reminder melden.
   - Uitzondering: als het nu urgent is (bijv. afspraak over 1 uur).

5. **Eén reminder-melding per 2 uur**
   - Niet elke 5 minuten dezelfde lijst herhalen.
   - Check transcripts wanneer je laatst reminders hebt gemeld.

6. **Niet opdringerig**
   - Vriendelijke toon, geen pressure.
   - "Kleine herinnering: ..." niet "JE MOET NOG: ..."

### Voorbeeld Afwegingen

| Situatie | Afweging | Actie |
|----------|----------|-------|
| 08:30, 3 reminders vandaag | Ochtend, goed moment | ACTION: MESSAGE |
| 10:00, zelfde reminders | Check transcripts: al gemeld | ACTION: OK |
| 14:00, 1 flagged reminder | Flagged = belangrijk | ACTION: MESSAGE |
| 14:00, al gemeld om 08:30 | >2 uur geleden, mag weer | ACTION: MESSAGE |
| 19:00, 2 reminders nog open | Einde dag, laatste check | ACTION: MESSAGE |
| 20:00, alles afgevinkt | Niets te melden | ACTION: OK |

### Belangrijke Regels

- **Alleen incomplete reminders tonen** — completed reminders NOOIT teruggeven
- **Filter altijd op `completed is false`** — afgevinkt = bestaat niet meer voor ons

## Notes

- **macOS only** - Uses Apple's native Reminders app

## Permissions

osascript needs permission to control Reminders. This is granted per-app:

| Context | App that needs permission | How to grant |
|---------|---------------------------|--------------|
| VS Code terminal | Visual Studio Code | System Settings → Privacy & Security → Automation → VS Code → Reminders |
| pm2 / Node.js | Terminal (or iTerm2) | System Settings → Privacy & Security → Automation → Terminal → Reminders |
| Claude Code | Claude (if standalone) | Same as above |

**First run:** macOS will prompt for permission. Click "OK" to allow.

**If it doesn't work:**
1. Open System Settings → Privacy & Security → Automation
2. Find the app running the command
3. Enable "Reminders" checkbox
4. Restart the process (pm2 restart, etc.)

**Testing:**
```bash
# Test if access works
osascript -e 'tell application "Reminders" to get name of every list'
# Should return list names, not an error
```
