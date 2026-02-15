---
name: user-reflection
description: Dagelijkse reflectie over de user(s) — hoe ze denken, werken, communiceren
metadata: {"kitt":{"emoji":"👤","trigger":"scheduled","frequency":"daily"}}
---

# User Reflection

Dagelijkse reflectie over de user(s). Eén keer per dag (22:00), Opus model.
Output wordt naar de user gestuurd via hun primaire kanaal.

> **Scope:** De user(s) begrijpen — hoe ze denken, werken, communiceren, hun energie.
> KITT's eigen groei (identiteit, humor, complementariteit) zit in de `kitt-reflection` skill.

---

## Doel

De user(s) steeds beter leren kennen: denkpatronen, werkstijl, communicatievoorkeuren, energiecurves. Het doel is om USER.md te verrijken met echte inzichten zodat KITT effectiever kan ondersteunen.

**De reflectie is het leersysteem. USER.md is het resultaat.**

**Actieve feedback loop:** Bij onzekere observaties stelt KITT een verificatievraag aan de user. Het antwoord versnelt het leerproces — bevestigde observaties worden direct gepromoveerd naar USER.md.

---

## Wat te doen

### 1. Context ophalen

**A. Lees USER.md (dit is je huidige kennis over de user):**

```bash
cat profile/user/USER.md
```

**B. Laatste 5 user-reflecties (voor patronen en openstaande verificatievragen):**

```bash
sqlite3 -json profile/data/kitt.db "
  SELECT content, datetime(created_at/1000, 'unixepoch', 'localtime') as time
  FROM transcripts
  WHERE type = 'reflection' AND role = 'kitt'
    AND content LIKE '%User Reflectie%'
  ORDER BY created_at DESC LIMIT 5"
```

**C. Zoek openstaande verificatievragen:**

Scan de laatste reflecties op `[VERIFICATIE]` tags. Noteer welke vragen nog open staan.

**D. Transcripts van vandaag:**

```bash
sqlite3 -json profile/data/kitt.db "
  SELECT role, type, substr(content, 1, 1000) as content,
    datetime(created_at/1000, 'unixepoch', 'localtime') as time
  FROM transcripts
  WHERE date(created_at/1000, 'unixepoch', 'localtime') = date('now', 'localtime')
  ORDER BY created_at ASC"
```

**E. Zoek antwoorden op verificatievragen:**

Voor elke openstaande verificatievraag:
1. Zoek het verstuurde bericht in de transcripts (KITT's vraag)
2. Check of er een user-antwoord NA dat bericht kwam
3. Analyseer het antwoord: bevestigd / ontkend / genuanceerd
4. Verwerk het resultaat (zie classificatieregels)

---

### 2. Reflecteren — Per-vraag sequence

**Dit is de kern.** Loop sequentieel door de vragenset. Per vraag:

```
Voor elke vraag:
  1. Lees de vraag
  2. Zoek relevante context in de transcripts van vandaag
  3. Is er relevante context?
     → Nee: skip, volgende vraag
     → Ja: beantwoord met evidence (concreet voorbeeld + citaat)
  4. Classificeer het antwoord: OBSERVATIE, PATROON, of USER-BEVESTIGD?
     → OBSERVATIE (eenmalig event, tijdelijke state):
       - Sla op in de reflectie (database) als observatie
       - NIET naar USER.md
       - Tag met categorie zodat het later te vinden is
     → PATROON (herhaald gedrag, bewezen werkwijze):
       - Check eerst: komt dit al 2-3x voor in eerdere reflecties/observaties?
       - Zo ja: promoveer naar USER.md
       - Zo nee: sla op als observatie, markeer als "potentieel patroon"
     → USER-BEVESTIGD (antwoord op verificatievraag):
       - Direct promoveren naar USER.md (geen 2-3x nodig)
  5. Volgende vraag
```

#### Observatie vs Patroon — Classificatieregels

**OBSERVATIE** (alleen database, NOOIT USER.md):
- Eenmalige events ("user was vandaag kort in communicatie")
- Tijdelijke states ("user had weinig energie vandaag")
- Eerste keer dat iets voorkomt

**PATROON** (mag naar USER.md na 2-3x bevestiging):
- Herhaald gedrag dat meerdere keren terugkomt
- Werkstijl die consistent is
- Communicatiepatroon dat bewezen is
- Correcties van de user (tellen WEL als direct patroon)

**USER-BEVESTIGD** (direct naar USER.md):
- Antwoord op een verificatievraag dat de observatie bevestigt
- User die uit zichzelf iets over zichzelf deelt

#### Eerdere observaties checken

**VOOR je iets als patroon bestempelt**, zoek in eerdere reflecties:

```bash
sqlite3 -json profile/data/kitt.db "
  SELECT content, datetime(created_at/1000, 'unixepoch', 'localtime') as time
  FROM transcripts
  WHERE type = 'reflection' AND role = 'kitt'
    AND content LIKE '%User Reflectie%'
    AND content LIKE '%ZOEKTERM%'
  ORDER BY created_at DESC LIMIT 10"
```

---

### De Vragen

#### A. Hoe de user denkt (→ USER.md)

| # | Vraag |
|---|-------|
| A1 | Hoe benaderde de user problemen vandaag? (lineair, parallel, associatief?) |
| A2 | Wanneer was de user het meest betrokken/gefocust? Wat triggerde dat? |
| A3 | Hoe ging de user om met tegenvallers of blockers? |
| A4 | Hoe maakt de user beslissingen? (snel/intuïtief of overwogen/analytisch?) |

#### B. Hoe de user werkt (→ USER.md)

| # | Vraag |
|---|-------|
| B1 | Sprints of marathon vandaag? |
| B2 | Delegeerde de user iets, of deed die het zelf? |
| B3 | Productief of druk? (output vs activiteit) |
| B4 | Wat was de user's prioriteit vandaag? Kwam dat overeen met waar de tijd naartoe ging? |

#### C. Communicatie (→ USER.md)

| # | Vraag |
|---|-------|
| C1 | Heeft de user mijn output gecorrigeerd? WAT precies? |
| C2 | Welke woorden/uitdrukkingen zijn echt deze user? |
| C3 | Moest de user iets twee keer uitleggen? Wat miste ik? |
| C4 | Welk format/lengte prefereert de user? (kort vs uitgebreid, gestructureerd vs narratief?) |

#### F. Energie & Emotie (→ USER.md)

| # | Vraag |
|---|-------|
| F1 | Wat was het energieniveau vandaag? Hoe merkte ik dat? |
| F2 | Was de user gefrustreerd? Waarover precies? |
| F3 | Was de user enthousiast ergens over? Waarover? |

---

### 3. USER.md updaten

**Dit gebeurt inline tijdens de per-vraag sequence** — niet als aparte stap achteraf. Maar ALLEEN als iets een bewezen patroon is (2-3x voorgekomen), een directe correctie, of user-bevestigd via verificatievraag.

#### Gouden regel: Observaties → Database. Patronen → USER.md.

#### USER.md — Schrijfregels per sectie

| Sectie | Wanneer updaten | Hoe |
|--------|-----------------|-----|
| **Hoe hij/zij denkt** | Bewezen denkpatroon (2-3x) of user-bevestigd | Voeg bullet toe met concreet bewijs |
| **Hoe hij/zij werkt** | Bewezen werkpatroon (2-3x) of user-bevestigd | Voeg bullet toe |
| **Hoe hij/zij communiceert** | Bewezen communicatiepatroon of directe correctie | Voeg toe of update |
| **Frustratietriggers** | Herhaald patroon (2-3x) | Voeg toe |
| **Hoe ik hem/haar het beste help** | Bewezen werkwijze (2-3x) of user-bevestigd | Voeg bullet toe |

**Regels:**
- Voeg toe of update bestaande punten
- Verwijder een punt als het weerlegd is (met reden)
- Geen duplicaten
- Geen vage algemeenheden ("de user is aardig")
- Geen filler
- **Geen eenmalige events of emoties**
- **Geen specifieke datums met emotionele context**

#### IDENTITY.md

- NIET updaten vanuit deze skill. Dat doet `kitt-reflection`.

#### SOUL.md

- NOOIT aanpassen. Dit is de grondwet. Alleen de user kan dit wijzigen.

#### BUSINESS.md

- NIET updaten vanuit deze skill. Dat doet `business-reflection`.

---

### 4. Verificatievragen genereren

Na het doorlopen van alle vragen, bekijk je onzekere observaties en formuleer max 1-2 verificatievragen.

**Wanneer een verificatievraag stellen:**
- Je ziet een potentieel patroon maar hebt het pas 1x waargenomen
- Je bent onzeker of je interpretatie klopt
- De observatie zou significant impact hebben op hoe je de user helpt

**Wanneer GEEN verificatievraag:**
- Het is een triviale observatie
- Je hebt het al 2-3x gezien (dan is het al een patroon)
- De user heeft het zelf al bevestigd in een gesprek

**Format:**
- Kort en concreet, geen essay
- Ja/nee beantwoordbaar of met korte toelichting
- Voorbeeld: "Ik merk dat je 's ochtends meer hands-on werkt en 's avonds meer delegeert — klopt dat?"

---

### 5. Reflectie opslaan

Na het doorlopen van alle vragen, sla een samenvatting op via COMPLETE_TASK:

```
ACTION: COMPLETE_TASK #[id]
👤 User Reflectie — [datum]

## Vandaag
[Wat de user vandaag deed — korte samenvatting]

## Verificatievragen — Antwoorden
[Antwoorden op eerder gestelde verificatievragen.
 Per vraag: de originele vraag, het antwoord, en de actie (→ USER.md of verworpen)]

## Observaties (alleen database — NIET naar USER.md)
[Eenmalige events, tijdelijke states van vandaag.
 Tag elke observatie met een categorie voor toekomstige patroonherkenning.
 Bijv: "[denken] User benaderde het probleem heel associatief"
       "[werken] Korte sprints vandaag, max 30 min per taak"
       "[communicatie] Eerste keer dat user voice messages gebruikte"]

## Patronen (bewezen — WEL naar USER.md)
[Observaties die nu 2-3x bevestigd zijn en gepromoveerd worden naar USER.md.
 Per patroon: welke eerdere observaties het bevestigen + wat geüpdatet]

## Directe correcties
[Correcties van de user die direct als regel gelden — altijd naar USER.md]

## [VERIFICATIE] Nieuwe vragen
[Max 1-2 verificatievragen voor de user. Deze worden verstuurd via het primaire kanaal.
 Format: "Ik merk [observatie]. Klopt dat?"
 Tag: [VERIFICATIE:open] zodat de volgende reflectie ze kan terugvinden]
```

---

## Schrijfrechten

| File | Mag updaten? | Hoe |
|------|-------------|-----|
| **USER.md** | Zelfstandig | Lees, update relevante sectie, bewaar |
| **IDENTITY.md** | Nee | Dat doet kitt-reflection |
| **SOUL.md** | NOOIT | Alleen de user kan dit wijzigen |
| **BUSINESS.md** | Nee | Dat doet business-reflection |
| **portal_triage** | Zelfstandig | Via SQLite INSERT |

---

## Kwaliteitscriteria

Een goede reflectie:
- Heeft per-vraag gewerkt met evidence uit de transcripts
- Scheidt observaties (eenmalig) van patronen (herhaald) correct
- Checkt eerdere reflecties voordat iets als patroon wordt bestempeld
- Bevat concrete voorbeelden, niet alleen conclusies
- Maakt verbanden met eerdere dagen (als er relevante patronen zijn)
- Verwerkt antwoorden op verificatievragen correct
- Is eerlijk en respectvol — observeert zonder te oordelen
- Update USER.md ALLEEN met bewezen patronen, directe correcties, of user-bevestigde observaties
- Raakt IDENTITY.md NIET aan (dat is kitt-reflection's taak)
- Stelt max 1-2 gerichte verificatievragen (als relevant)

Een slechte reflectie:
- Is alleen een opsomming van wat er gedaan is
- Beantwoordt vragen zonder evidence uit transcripts
- Schrijft eenmalige events naar USER.md
- Bestempelt iets als patroon zonder eerdere observaties te checken
- Bevat vage algemeenheden ("de user is productief")
- Herhaalt wat er al in USER.md staat zonder iets toe te voegen
- Is geforceerd als er weinig te melden was (korte reflectie is OK)
- Schrijft naar IDENTITY.md
- Stelt te veel verificatievragen (meer dan 2)
- Stelt verificatievragen over triviale observaties

---

## Stijl

- Observerend en respectvol
- Niet geforceerd — weinig te melden? Houd het kort
- Geen AI-disclaimers ("als AI kan ik niet echt voelen maar...")
- Nederlands
- Verificatievragen: kort, concreet, vriendelijk

---

## Fallbacks

| Situatie | Actie |
|----------|-------|
| Geen transcripts vandaag | Kort reflecteren op stilte, of skip |
| Geen eerdere reflecties | Alleen over vandaag reflecteren, geen patronen |
| Weinig te melden | Korte reflectie, veel vragen snel skippen. Niet forceren |
| USER.md niet gevonden | Alleen db-opslag |
| Niets nieuws voor USER.md | Expliciet benoemen: "Geen updates vandaag — geen nieuwe inzichten" |
| Geen openstaande verificatievragen | Stap E overslaan |
