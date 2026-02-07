# F41: Meeting Skill

> **Status:** Backlog
> **Priority:** P2
> **Depends on:** F42 (Calendar Integration)

---

## Doel

KITT checkt proactief in na meetings en helpt met transcripts/notities.

---

## Gewenst Gedrag

1. **Na een meeting** (detected via kalender):
   - KITT vraagt: "Hey, heb je nog een transcript van die meeting?"
   - Of checkt zelf of er een transcript ergens staat

2. **Transcript ophalen**:
   - Check AI meeting notetaker (bijv. Fireflies, Otter, etc.)
   - Als niks gevonden: vraag gebruiker om transcript

3. **Alleen bij echte meetings**:
   - Niet bij "focus time" of solo events
   - Alleen bij events met andere deelnemers

---

## Trigger Types

- **scheduled**: Na afloop van calendar events met deelnemers
- **on_demand**: `/meeting transcript` of `/meeting summary`

---

## Dependencies

- F42: Calendar Integration (om te weten wanneer meetings zijn)
- AI meeting notetaker API (optioneel, voor auto-fetch)

---

## Open Vragen

1. Welke meeting notetaker gebruiken? (Fireflies, Otter, Fathom, etc.)
2. Hoe detecteren we "echte meetings" vs solo events?
3. Waar opslaan? Notion? Database? Memory?

---

## Think Loop Integratie

De think loop zou:
1. Calendar checken voor recent afgelopen meetings
2. Na X minuten na meeting einde: check-in bericht sturen
3. Transcript zoeken of vragen

---

## Skill Metadata (concept)

```yaml
name: meeting
description: Check in after meetings, help with transcripts
metadata:
  kitt:
    emoji: "📅"
    trigger: "scheduled"
    frequency: "event-based"
    depends_on: ["calendar"]
```
