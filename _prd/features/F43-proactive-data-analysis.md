# F43: Proactive Data Analysis

> **Status:** Backlog
> **Priority:** P2
> **Depends on:** F40 (Think Loop improvements)

---

## Doel

Think Loop checkt actief databronnen en reageert op nieuwe data - niet alleen wachten op user input.

---

## Concept

De think loop wordt "data-aware":

1. **Check databronnen** bij elke tick
2. **Detecteer nieuwe data** (workout, meeting, etc.)
3. **Proactief reageren** met samenvatting, vragen, of suggesties

---

## Voorbeelden

### Garmin Workout

```
Think Loop ziet: nieuwe workout in Garmin data
→ "Hey, ik zie dat je net een workout hebt gedaan! 💪"
→ "Het was een Run van 45 min, 6.2 km"
→ "Wil je dat ik dit log? Welke workout was dit?"
→ Matcht met gym-race-coach workout database
```

### Calendar Meeting (met F41/F42)

```
Think Loop ziet: meeting net afgelopen
→ "Je meeting met Team X is net klaar"
→ "Heb je nog een transcript of notities?"
```

### Nutrition (bestaande skill)

```
Think Loop ziet: geen nutrition logs vandaag
→ Herinnering sturen (al geïmplementeerd via scheduled skill)
```

---

## Implementatie

### Huidige situatie

Skills met `trigger: every_time` + `fetch` commando worden al gecheckt:
- apple-reminders: fetch returns open reminders
- Result wordt meegestuurd in think loop context

### Uitbreiding nodig

1. **Garmin skill uitbreiden** met `trigger: every_time` + `fetch`:
   ```yaml
   metadata:
     kitt:
       trigger: "every_time"
       fetch: "python3 garmin_api.py today --json"
   ```

2. **Calendar skill** (F42) met fetch voor recent afgelopen events

3. **Think Loop prompt** aanpassen:
   - "Check of er nieuwe data is sinds laatste check"
   - "Als er een workout is die je niet eerder zag, analyseer deze"

---

## Architectuur

```
┌─────────────────────────────────────────┐
│             Think Loop Tick              │
├─────────────────────────────────────────┤
│                                          │
│  1. Fetch data van every_time skills    │
│     - Garmin: laatste activities        │
│     - Calendar: recent events           │
│     - Reminders: open items             │
│                                          │
│  2. Compare met vorige state            │
│     - Nieuwe workout? → Analyseer       │
│     - Meeting klaar? → Check-in         │
│                                          │
│  3. Decide action                       │
│     - MESSAGE: stuur proactief bericht  │
│     - MEMORY: sla observatie op         │
│     - OK: niets nieuws                  │
│                                          │
└─────────────────────────────────────────┘
```

---

## State Tracking

Om "nieuwe" data te detecteren, moet de think loop onthouden wat hij al gezien heeft.

**Optie A:** Transcripts checken
- "Heb ik al over deze workout gepost?"
- Al beschikbaar via huidige transcripts query

**Optie B:** Dedicated state
- `think_loop_state` tabel met laatste bekende data
- Meer complex, waarschijnlijk niet nodig

**Aanbeveling:** Start met Optie A - de think loop ziet al zijn eigen berichten in transcripts.

---

## Relatie met F40 Think Loop Thoughts

De "Thoughts" uit F40 helpen hier:
- KITT slaat op: "Workout geanalyseerd om 14:35"
- Volgende tick ziet die thought
- Weet dat hij niet nogmaals hoeft te analyseren

---

## Volgende Stappen

1. ✅ F40 Think Loop Thoughts implementeren (voorkomt dubbele acties)
2. Garmin skill uitbreiden met every_time fetch
3. Think loop prompt aanpassen voor proactive analysis
4. Testen met echte workout data
