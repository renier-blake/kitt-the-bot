# Feature: Scheduled Status + Date Fields

## Overzicht
Een nieuwe issue status "scheduled" waarbij je een datum kunt koppelen. Dit maakt het mogelijk om issues te plannen op specifieke data zonder ze direct in "todo" te zetten.

## Use Cases
- Een blog post plannen voor volgende week dinsdag
- Een taak uitstellen naar volgende maand
- Een meeting inplannen op een specifieke datum
- Taken plannen voor een sprint/cycle zonder ze direct te starten

## Database Wijzigingen

### Nieuwe Kolommen in `portal_issues`
```sql
-- Alleen voor scheduled issues
scheduled_date INTEGER,          -- De geplande datum (timestamp)
scheduled_time_start INTEGER,    -- Optioneel: start tijd
scheduled_time_end INTEGER,      -- Optioneel: eind tijd
scheduled_timezone TEXT,         -- Timezone voor de datum

-- Voor alle issues (nuttig voor planning)
due_date INTEGER,                -- Deadline (kan onafhankelijk van status)
start_date INTEGER,              -- Wanneer je er echt mee begint
```

### Schema Update
```sql
-- Migration v15
ALTER TABLE portal_issues ADD COLUMN scheduled_date INTEGER;
ALTER TABLE portal_issues ADD COLUMN scheduled_time_start INTEGER;
ALTER TABLE portal_issues ADD COLUMN scheduled_time_end INTEGER;
ALTER TABLE portal_issues ADD COLUMN scheduled_timezone TEXT DEFAULT 'Europe/Amsterdam';
ALTER TABLE portal_issues ADD COLUMN due_date INTEGER;
ALTER TABLE portal_issues ADD COLUMN start_date INTEGER;
```

## Frontend Wijzigingen

### 1. Nieuwe Status: "scheduled"
```typescript
type IssueState = 'backlog' | 'scheduled' | 'todo' | 'in_progress' | 'testing' | 'done' | 'cancelled'

const STATE_COLUMNS = [
  { id: 'backlog', label: 'Backlog' },
  { id: 'scheduled', label: 'Gepland' },      // Nieuw
  { id: 'todo', label: 'Todo' },
  { id: 'in_progress', label: 'In Progress' },
  { id: 'testing', label: 'Testing' },
  { id: 'done', label: 'Done' },
  { id: 'cancelled', label: 'Cancelled' },
]
```

### 2. Kalender/Kolom View
- "Gepland" kolom toont issues gesorteerd op datum
- Visuele indicator van hoe ver de datum is ("over 2 dagen", "volgende week")
- Kleur coding: 
  - Groen: ver in de toekomst
  - Oranje: deze week
  - Rood: vandaag

### 3. Date Picker in Issue Detail
```
Issue Detail Panel:
┌─────────────────────────────────────┐
│ Title: [Blog schrijven]             │
│                                     │
│ Status: [scheduled ▼]               │
│                                     │
│ 📅 Gepland voor:                    │
│    [📆 14 feb 2025] [🕐 09:00]      │
│                                     │
│ ⏰ Deadline (optioneel):            │
│    [📆 14 feb 2025]                 │
│                                     │
│ 🔔 Herinnering:                     │
│    [1 dag van tevoren ▼]            │
└─────────────────────────────────────┘
```

### 4. Schedule View (Nieuw)
Alternatieve view naast Board/List:
```
[Board] [List] [📅 Kalender]

Februari 2025
┌────┬────┬────┬────┬────┬────┬────┐
│ Ma │ Di │ Wo │ Do │ Vr │ Za │ Zo │
├────┼────┼────┼────┼────┼────┼────┤
│    │    │    │    │    │ 1  │ 2  │
│    │    │    │    │    │    │    │
├────┼────┼────┼────┼────┼────┼────┤
│ 3  │ 4  │ 5  │ 6  │ 7  │ 8  │ 9  │
│    │ 📝 │    │    │ 🏋️ │    │    │
│    │Blog│    │    │Gym │    │    │
├────┼────┼────┼────┼────┼────┼────┤
│ 10 │ 11 │ 12 │ 13 │ 14 │ 15 │ 16 │
│    │    │    │    │ 📝 │    │    │
│    │    │    │    │Blog│    │    │
└────┴────┴────┴────┴────┴────┴────┘
```

## API Wijzigingen

### GET /api/issues
```json
{
  "issues": [
    {
      "id": 1,
      "identifier": "PAS-50",
      "title": "Blog schrijven",
      "state": "scheduled",
      "scheduled_date": 1707830400000,
      "scheduled_time_start": 1707830400000,
      "scheduled_time_end": null,
      "due_date": null,
      "start_date": null
    }
  ]
}
```

### POST /api/issues
```json
{
  "title": "Blog schrijven",
  "state": "scheduled",
  "scheduled_date": "2025-02-14",
  "scheduled_time_start": "09:00",
  "projectId": 1
}
```

### PATCH /api/issues/:id
```json
{
  "state": "scheduled",
  "scheduled_date": "2025-02-14",
  "due_date": "2025-02-15"
}
```

### Query Parameters
```
GET /api/issues?scheduled_from=2025-02-01&scheduled_to=2025-02-28
GET /api/issues?overdue=true  # due_date < now en state != done
GET /api/issues?due_this_week=true
```

## Automatiseringen

### Auto-move naar Todo
Wanneer een scheduled issue op de geplande datum komt:
- Automatisch verplaatsen naar "todo"?
- Of notificatie: "Dit staat vandaag gepland"
- Configurabel per project/user

### Herinneringen
- Notificatie X tijd voor scheduled_date
- "Je blog staat gepland voor morgen 9:00"
- Configurabel: 1 dag, 1 uur, etc.

### Integratie met Calendar
- Export naar Google Calendar / Apple Calendar
- Two-way sync (als je in calendar verplaatst, update issue)
- ICS feed per project

## UI/UX Details

### Visuele Indicatoren in Kaarten
```
┌────────────────────────┐
│ Blog schrijven         │
│                        │
│ 📅 Za 15 feb, 09:00   │
│ ⏰ Nog 3 dagen         │
│                        │
│ [High] [PAS]           │
└────────────────────────┘
```

### Kleurcodering
- 🟢 Scheduled > 7 dagen: relaxed groen
- 🟡 Scheduled deze week: geel/oranje
- 🔴 Scheduled vandaag: rood/urgent
- ⚫ Scheduled verleden: grijs ("vergeten?")

### Snelle Acties
- "Verplaats naar morgen"
- "Verplaats naar volgende week"
- "Maak todo" (verwijdert scheduled_date)

## Implementatie Stappen

### Fase 1: Database + API
1. Migration maken voor nieuwe kolommen
2. API endpoints updaten
3. Validatie: scheduled vereist scheduled_date

### Fase 2: Frontend - Basis
1. Nieuwe status toevoegen
2. Date picker component
3. Issue detail panel uitbreiden

### Fase 3: Frontend - Kalender View
1. Kalender component (bestaande lib of custom)
2. Month/week/day views
3. Drag-and-drop om te reschedule

### Fase 4: Automatisering
1. Daily check: wat staat er vandaag gepland?
2. Notificaties
3. Auto-move naar todo (optioneel)

## Technische Overwegingen

### Date Library
- `date-fns` voor formatting/manipulatie
- Timezone handling belangrijk!
- ISO 8601 format in API

### Performance
- Index op `scheduled_date` voor snelle queries
- Kalender view: paginering per maand
- Caching van date formatting

### Edge Cases
- Tijdzone wijzigingen (DST)
- Recurring issues (elke week)?
- Overlapping scheduled items

## Vragen

1. Moeten we tijd ook opslaan of alleen datum?
2. Recurring issues (herhaal elke week)?
3. Integratie met externe calendar (nu of later)?
4. Auto-move naar todo op de dag zelf?
5. Notificaties via welke kanalen (portal, telegram, etc)?
