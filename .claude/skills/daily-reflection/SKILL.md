---
name: daily-reflection
description: Dagelijkse reflectie voor Renier (6 Minute Diary framework)
metadata: {"kitt":{"emoji":"🌅","trigger":"scheduled","frequency":"daily"}}
---

# Daily Reflection (6 Minute Diary)

Dagelijkse reflectie voor Renier. Twee momenten: ochtend en avond.
Gebaseerd op het 6 Minute Diary framework (wetenschappelijk gevalideerd).

> **Let op:** Dit is Renier's reflectie, niet KITT's zelfreflectie.

---

## Twee Fasen

Deze skill werkt in 2 fasen:

1. **Fase 1** — Taak is open → stel vragen (via `ACTION: TASK #id`)
2. **Fase 2** — Renier heeft geantwoord → maak samenvatting (via `ACTION: COMPLETE_TASK #id`)

---

## Fase 1: Vragen Stellen

Als de ochtend- of avondreflectie-taak in je open taken staat.

### Ochtend (3 vragen)

| # | Element | Kern | Psychologie |
|---|---------|------|-------------|
| 1 | **Gratitude** | Noem 3 dingen waar je dankbaar voor bent | Dankbaarheidsinterventie |
| 2 | **Intentie** | Hoe maak je vandaag goed? Wat is je focus? | Goal-setting |
| 3 | **Affirmatie** | Wat is een positieve waarheid over jezelf? | Self-affirmation |

### Avond (3 vragen)

| # | Element | Kern | Psychologie |
|---|---------|------|-------------|
| 1 | **Good deed** | Wat heb je voor iemand anders gedaan? | Pro-sociaal gedrag |
| 2 | **Verbetering** | Wat zou je anders doen? | Groei-mindset |
| 3 | **Three Good Things** | Noem 3 dingen die goed gingen | Self-efficacy |

### Context ophalen (VOOR het stellen van vragen)

Haal context op om de vragen persoonlijker te maken:

```bash
# Eerdere reflecties (laatste 10)
sqlite3 -json profile/memory/kitt.db "
  SELECT content, created_at FROM transcripts
  WHERE type = 'reflection'
  ORDER BY created_at DESC LIMIT 10"

# Transcripts afgelopen week (Renier's berichten)
sqlite3 -json profile/memory/kitt.db "
  SELECT content FROM transcripts
  WHERE created_at > ((strftime('%s','now') - 604800) * 1000)
    AND type = 'message'
    AND role = 'user'
  ORDER BY created_at DESC LIMIT 20"
```

**Hoe context gebruiken:**

```
Basis: "Waar ben je dankbaar voor?"
+ Context: Renier noemde vorige week dat slaap beter ging
= "Je slaap ging beter vorige week! Waar ben je vandaag dankbaar voor?"

Basis: "Wat zou je anders doen?"
+ Context: Renier had een lastig gesprek met een collega
= "Die situatie met je collega — als je dat over kon doen, wat zou je anders aanpakken?"
```

**Belangrijk:** Context is optioneel. Geen relevante context? Stel gewoon de basisvragen. Forceer niks.

### Stijl

- Kort en casual — geen therapeut-toon
- Varieer de formulering — niet elke dag exact dezelfde woorden
- Max 3 vragen per moment
- Nederlands
- Niet opdringerig

### Voorbeeld output (Fase 1)

```
ACTION: TASK #5
Goedemorgen Renier!

Even een momentje voor jezelf:

1. Noem 3 dingen waar je dankbaar voor bent
2. Wat is je focus vandaag — wat wil je bereiken?
3. Noem iets positiefs over jezelf

Neem je tijd, hoeft niet uitgebreid.
```

---

## Fase 2: Samenvatting Maken

**Dit wordt NIET getriggerd door de task engine.** De taak is al gelogd als 'reminder' na Fase 1. Je herkent deze situatie door te kijken naar de transcripts.

### Wanneer Fase 2 uitvoeren?

Check in de transcripts van vandaag:

1. KITT heeft reflectievragen gestuurd (je ziet ze in de transcripts)
2. Renier heeft DAARNA geantwoord
3. Er is nog GEEN type='reflection' transcript vandaag voor dit moment

Verifieer met:

```bash
# Aantal reflecties vandaag
sqlite3 profile/memory/kitt.db "
  SELECT COUNT(*) as count FROM transcripts
  WHERE type = 'reflection'
    AND date(created_at/1000, 'unixepoch', 'localtime') = date('now', 'localtime')"
```

- 0 reflecties + ochtendvragen gestuurd + Renier antwoordde → maak ochtend samenvatting
- 1 reflectie (ochtend) + avondvragen gestuurd + Renier antwoordde → maak avond samenvatting
- 2 reflecties → beide al gedaan, niets doen

### Wat te doen in Fase 2

Maak een korte samenvatting van Renier's antwoord:

```
ACTION: COMPLETE_TASK #5
Ochtendreflectie 7 feb: Renier is dankbaar voor goede nachtrust, tijd met Kenji,
en een productieve werkdag gisteren. Focus vandaag: KITT features afmaken.
Affirmatie: ik maak dingen die echt werken.
```

### Samenvattingsregels

- **Alleen de kern** van Renier's antwoord
- **Geen KITT-observaties** of interpretaties
- **Datum** erbij voor terugvindbaarheid
- **Beknopt** — 2-4 zinnen
- **Label het moment:** "Ochtendreflectie" of "Avondreflectie"

---

## Fallbacks

| Situatie | Actie |
|----------|-------|
| Geen eerdere reflecties | Stel basisvragen zonder context |
| Renier reageert niet | Niets doen. Volgende tick checkt opnieuw |
| Renier zegt "later" / "niet nu" | ACTION: OK (taak is al gelogd als reminder) |
| Renier zegt "skip" / "overslaan" | ACTION: OK |

---

## Belangrijk

- Dit is **Renier's** reflectie, niet KITT's zelfreflectie
- Wees niet opdringerig — als Renier druk is, dring niet aan
- De samenvatting wordt opgeslagen als `type='reflection'` in transcripts
- Toekomstige reflecties gebruiken eerdere samenvattingen als context
- De ochtend en avond werken samen: ochtend = intentie zetten, avond = terugblikken
