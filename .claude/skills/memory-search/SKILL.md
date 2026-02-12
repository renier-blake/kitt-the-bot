---
name: memory-search
description: Zoek in gesprekken en herinneringen op basis van tijd of onderwerp. Gebruik bij vragen over eerdere gesprekken, wat er besproken is, of tijdgebonden herinneringen.
---

# Memory Search

Zoek in Renier's gesprekken en herinneringen. Gebruik deze skill wanneer de user vraagt over eerdere gesprekken, specifieke tijdsperiodes, of dingen die besproken zijn.

## Database

Pad: `profile/data/kitt.db`

## Transcripts tabel

De `transcripts` tabel bevat alle gesprekken:

| Kolom | Type | Beschrijving |
|-------|------|-------------|
| id | TEXT | UUID |
| session_id | TEXT | Chat ID (bijv. telegram:1306998969) |
| channel | TEXT | telegram, whatsapp, slack, etc. |
| role | TEXT | 'user' of 'kitt' |
| type | TEXT | 'message', 'thought', 'task', 'reflection' |
| content | TEXT | De tekst |
| created_at | INTEGER | Unix timestamp in milliseconds |

## Hoe te zoeken

### Tijdgebonden vragen

Bij vragen als "waar hadden we het gisteren over?", "wat bespraken we vorige week?", "2 dagen geleden":

```bash
# Bereken de juiste timestamps (Unix ms)
# Voorbeeld: gisteren van 00:00 tot 23:59
sqlite3 profile/data/kitt.db "
  SELECT role, content, datetime(created_at/1000, 'unixepoch', 'localtime') as tijd
  FROM transcripts
  WHERE created_at >= (strftime('%s', 'now', '-1 day', 'start of day') * 1000)
    AND created_at < (strftime('%s', 'now', 'start of day') * 1000)
    AND type = 'message'
  ORDER BY created_at ASC
"
```

**Tijdberekeningen in SQLite:**

| Vraag | WHERE clause |
|-------|-------------|
| Gisteren | `created_at >= strftime('%s','now','-1 day','start of day')*1000 AND created_at < strftime('%s','now','start of day')*1000` |
| X dagen geleden | `created_at >= strftime('%s','now','-X day','start of day')*1000 AND created_at < strftime('%s','now','-X day','start of day','+1 day')*1000` |
| Vorige week | `created_at >= strftime('%s','now','-7 day','start of day')*1000` |
| Deze week (vanaf maandag) | `created_at >= strftime('%s','now','weekday 1','-7 day')*1000` |
| Vanochtend | `created_at >= strftime('%s','now','start of day')*1000 AND created_at < strftime('%s','now','start of day','+12 hours')*1000` |

### Onderwerp zoeken

Bij vragen als "wat heb ik over X gezegd?", "wanneer bespraken we Y?":

```bash
sqlite3 profile/data/kitt.db "
  SELECT role, content, datetime(created_at/1000, 'unixepoch', 'localtime') as tijd
  FROM transcripts
  WHERE content LIKE '%zoekterm%'
    AND type = 'message'
  ORDER BY created_at DESC
  LIMIT 20
"
```

## Response format

- Vat de gevonden gesprekken **kort** samen
- Groepeer per onderwerp als er meerdere topics waren
- Noem de tijd/datum erbij
- Antwoord in het Nederlands
- Geen meta-commentaar, gewoon het antwoord
- **Eerlijk zijn over wat je vindt.** Als de transcripts geen duidelijk antwoord bevatten op de vraag, zeg dat. "We hebben het hier niet echt over gehad in onze gesprekken" is een goed antwoord. Verzin geen vage analyse op basis van losse fragmenten. Alleen concrete quotes en feiten rapporteren.
