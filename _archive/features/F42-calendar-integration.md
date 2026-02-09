# F42: Calendar Integration

> **Status:** Backlog
> **Priority:** P2
> **Depends on:** -

---

## Doel

KITT heeft toegang tot je kalender om proactief te kunnen helpen met meetings en tijdmanagement.

---

## Capabilities

1. **Lezen van events**:
   - Vandaag's events
   - Aankomende events (next X uur/dagen)
   - Recent afgelopen events

2. **Event details**:
   - Titel, tijd, duur
   - Deelnemers
   - Locatie (fysiek/online)
   - Meeting link (Zoom, Meet, etc.)

3. **Think Loop integratie**:
   - "Je hebt over 15 min een meeting"
   - "Je meeting met X is net afgelopen"
   - "Je hebt vandaag 3 meetings"

---

## Implementatie Opties

### Optie A: Apple Calendar (osascript)

```bash
# Vandaag's events
osascript -e 'tell application "Calendar"
  set today to current date
  set tomorrow to today + 1 * days
  set allEvents to {}
  repeat with c in calendars
    set calEvents to (every event of c whose start date >= today and start date < tomorrow)
    set allEvents to allEvents & calEvents
  end repeat
  return summary of allEvents
end tell'
```

**Pros:**
- Lokaal, geen API keys nodig
- Werkt met iCloud, Google (via sync)
- Consistent met apple-reminders skill

**Cons:**
- Alleen macOS
- Permissie nodig

### Optie B: Google Calendar API

**Pros:**
- Cross-platform
- Rijke API

**Cons:**
- OAuth setup nodig
- API key management

---

## Aanbeveling

Start met **Optie A (Apple Calendar)** - consistent met bestaande aanpak.

---

## Skill Metadata (concept)

```yaml
name: calendar
description: Access calendar events for meeting awareness
metadata:
  kitt:
    emoji: "📆"
    trigger: "every_time"
    os: ["darwin"]
    fetch: "osascript calendar-today.scpt"
```

---

## Enables

- F41: Meeting Skill (check-in na meetings)
- Proactive reminders ("je meeting begint over 10 min")
- Context awareness ("Renier zit waarschijnlijk in een meeting")
