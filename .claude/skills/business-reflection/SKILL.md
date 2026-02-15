---
name: business-reflection
description: Dagelijkse reflectie over het bedrijf — prioriteiten, cultuur, uitdagingen
metadata: {"kitt":{"emoji":"🏢","trigger":"scheduled","frequency":"daily"}}
---

# Business Reflection

Dagelijkse reflectie over het bedrijf. Eén keer per dag (22:00), Opus model.
Output wordt naar de primaire user/admin gestuurd via hun primaire kanaal.

> **Scope:** Het bedrijf begrijpen — prioriteiten, cultuur, markt, uitdagingen.
> Draait in 3 van de 4 smaken (overal waar BUSINESS.md bestaat):
> - Smaak 2: Solo Ondernemer
> - Smaak 3: Team Member
> - Smaak 4: Digital Employee
>
> User-gerelateerde vragen zitten in `user-reflection`.
> Team-gerelateerde vragen zitten in `team-reflection`.

---

## Doel

Het bedrijf steeds beter leren kennen: wat zijn de prioriteiten, hoe verschuiven die, welke uitdagingen spelen er, hoe communiceert het bedrijf. Het doel is om BUSINESS.md te verrijken en actueel te houden.

**De reflectie is het leersysteem. BUSINESS.md is het resultaat.**

**Belangrijk:** BUSINESS.md is een referentie-document. Het bevat niet ALLE bedrijfsinfo, maar referenties naar waar KITT dingen kan vinden. De reflectie verrijkt die referenties en houdt prioriteiten/focus actueel.

---

## Wat te doen

### 1. Context ophalen

**A. Lees BUSINESS.md (dit is je huidige kennis over het bedrijf):**

```bash
cat profile/user/BUSINESS.md
```

**B. Laatste 5 business-reflecties (voor patronen en openstaande verificatievragen):**

```bash
sqlite3 -json profile/data/kitt.db "
  SELECT content, datetime(created_at/1000, 'unixepoch', 'localtime') as time
  FROM transcripts
  WHERE type = 'reflection' AND role = 'kitt'
    AND content LIKE '%Business Reflectie%'
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
       - NIET naar BUSINESS.md
       - Tag met categorie zodat het later te vinden is
     → PATROON (herhaald gedrag, bewezen trend):
       - Check eerst: komt dit al 2-3x voor in eerdere reflecties/observaties?
       - Zo ja: promoveer naar BUSINESS.md
       - Zo nee: sla op als observatie, markeer als "potentieel patroon"
     → USER-BEVESTIGD (antwoord op verificatievraag):
       - Direct promoveren naar BUSINESS.md (geen 2-3x nodig)
  5. Volgende vraag
```

#### Observatie vs Patroon — Classificatieregels

**OBSERVATIE** (alleen database, NOOIT BUSINESS.md):
- Eenmalige events ("er was een grote klant meeting vandaag")
- Tijdelijke states ("het team focust deze week op een deadline")
- Eerste keer dat iets voorkomt

**PATROON** (mag naar BUSINESS.md na 2-3x bevestiging):
- Herhaalde prioriteitsverschuivingen
- Consistente communicatiestijl
- Terugkerende thema's in channels/gesprekken
- Structurele veranderingen in het bedrijf

**USER-BEVESTIGD** (direct naar BUSINESS.md):
- Antwoord op een verificatievraag dat de observatie bevestigt
- Directe input van de user/admin over het bedrijf

#### Eerdere observaties checken

**VOOR je iets als patroon bestempelt**, zoek in eerdere reflecties:

```bash
sqlite3 -json profile/data/kitt.db "
  SELECT content, datetime(created_at/1000, 'unixepoch', 'localtime') as time
  FROM transcripts
  WHERE type = 'reflection' AND role = 'kitt'
    AND content LIKE '%Business Reflectie%'
    AND content LIKE '%ZOEKTERM%'
  ORDER BY created_at DESC LIMIT 10"
```

---

### De Vragen

#### A. Bedrijfskennis & Prioriteiten (→ BUSINESS.md)

| # | Vraag |
|---|-------|
| A1 | Heb ik iets geleerd over het bedrijf dat niet in BUSINESS.md staat? |
| A2 | Zijn er verschuivingen in prioriteiten of focus? |
| A3 | Wat speelde er in gesprekken/channels? Nieuwe thema's? |
| A4 | Welke uitdagingen kan ik helpen oplossen? |
| A5 | Is er verandering in hoe het bedrijf extern communiceert? |
| A6 | Is er iets in BUSINESS.md dat niet meer klopt of verouderd is? |

---

### 3. BUSINESS.md updaten

**Dit gebeurt inline tijdens de per-vraag sequence** — niet als aparte stap achteraf. Maar ALLEEN als iets een bewezen patroon is (2-3x voorgekomen), directe input van de user/admin, of user-bevestigd via verificatievraag.

#### Gouden regel: Observaties → Database. Patronen → BUSINESS.md.

#### BUSINESS.md — Schrijfregels per sectie

| Sectie | Wanneer updaten | Hoe |
|--------|-----------------|-----|
| **Huidige Prioriteiten** | Verschuiving in focus (2-3x bevestigd of user-bevestigd) | Update lijst, verwijder verouderde items |
| **Cultuur & Communicatie** | Verandering in tone/stijl (bewezen patroon) | Update beschrijving |
| **Markt & Positionering** | Nieuwe concurrenten, trends (bevestigd) | Voeg toe of update |
| **Resources & Referenties** | Nieuwe bronnen ontdekt | Voeg referentie toe |
| **Channels** | Nieuwe channels of veranderde doelen | Update tabel |
| **Tech Stack** | Nieuwe tools ontdekt | Voeg toe |
| **Wat ze doen** | Significante verandering in diensten/producten | Update (zeldzaam) |

**Regels:**
- Voeg toe of update bestaande punten
- Verwijder verouderde informatie (met reden)
- Geen duplicaten
- Geen speculatie — alleen wat bewezen of bevestigd is
- **Geen eenmalige events** ("er was een meeting over X")
- **Referenties > details** — verwijs naar waar info te vinden is, niet alles opschrijven

#### USER.md

- NIET updaten vanuit deze skill. Dat doet `user-reflection`.

#### IDENTITY.md

- NIET updaten vanuit deze skill. Dat doet `kitt-reflection`.

#### SOUL.md

- NOOIT aanpassen. Dit is de grondwet. Alleen de user kan dit wijzigen.

---

### 4. Verificatievragen genereren

Na het doorlopen van alle vragen, bekijk je onzekere observaties en formuleer max 1-2 verificatievragen.

**Wanneer een verificatievraag stellen:**
- Je ziet een potentiële verschuiving in prioriteiten maar bent onzeker
- Je hebt iets opgepikt dat significant impact zou hebben op BUSINESS.md
- Je bent onzeker of informatie in BUSINESS.md nog actueel is

**Wanneer GEEN verificatievraag:**
- Het is een triviale observatie
- Je hebt het al 2-3x gezien (dan is het al een patroon)
- De user/admin heeft het zelf al bevestigd

**Format:**
- Kort en concreet
- Voorbeeld: "Ik merk dat er de laatste tijd veel over [thema] gepraat wordt. Is dat een nieuwe prioriteit?"

---

### 5. Reflectie opslaan

Na het doorlopen van alle vragen, sla een samenvatting op via COMPLETE_TASK:

```
ACTION: COMPLETE_TASK #[id]
🏢 Business Reflectie — [datum]

## Vandaag
[Wat er vandaag speelde m.b.t. het bedrijf — korte samenvatting]

## Verificatievragen — Antwoorden
[Antwoorden op eerder gestelde verificatievragen.
 Per vraag: de originele vraag, het antwoord, en de actie (→ BUSINESS.md of verworpen)]

## Observaties (alleen database — NIET naar BUSINESS.md)
[Eenmalige events, tijdelijke states.
 Tag elke observatie met een categorie.
 Bijv: "[prioriteiten] Team focust op Q1 deadline"
       "[cultuur] Informelere toon in #general deze week"
       "[markt] Nieuwe concurrent genoemd in gesprek"]

## Patronen (bewezen — WEL naar BUSINESS.md)
[Observaties die nu 2-3x bevestigd zijn en gepromoveerd worden.
 Per patroon: welke eerdere observaties het bevestigen + wat geüpdatet]

## Directe input
[Directe informatie van de user/admin over het bedrijf — altijd naar BUSINESS.md]

## [VERIFICATIE] Nieuwe vragen
[Max 1-2 verificatievragen. Tag: [VERIFICATIE:open]]
```

---

## Schrijfrechten

| File | Mag updaten? | Hoe |
|------|-------------|-----|
| **BUSINESS.md** | Zelfstandig | Lees, update relevante sectie, bewaar |
| **USER.md** | Nee | Dat doet user-reflection |
| **IDENTITY.md** | Nee | Dat doet kitt-reflection |
| **SOUL.md** | NOOIT | Alleen de user kan dit wijzigen |
| **portal_triage** | Zelfstandig | Via SQLite INSERT |

---

## Kwaliteitscriteria

Een goede reflectie:
- Heeft per-vraag gewerkt met evidence uit de transcripts
- Scheidt observaties (eenmalig) van patronen (herhaald) correct
- Checkt eerdere reflecties voordat iets als patroon wordt bestempeld
- Bevat concrete voorbeelden, niet alleen conclusies
- Focust op referenties (waar info te vinden is) in plaats van alles op te schrijven
- Verwerkt antwoorden op verificatievragen correct
- Update BUSINESS.md ALLEEN met bewezen patronen, directe input, of user-bevestigde observaties
- Raakt USER.md en IDENTITY.md NIET aan
- Stelt max 1-2 gerichte verificatievragen (als relevant)

Een slechte reflectie:
- Is alleen een opsomming van meetings of gesprekken
- Beantwoordt vragen zonder evidence uit transcripts
- Schrijft eenmalige events naar BUSINESS.md
- Bestempelt iets als patroon zonder eerdere observaties te checken
- Speculeert over bedrijfsstrategie zonder bewijs
- Herhaalt wat er al in BUSINESS.md staat
- Schrijft alle details op in plaats van te verwijzen naar bronnen
- Is geforceerd als er weinig te melden was (korte reflectie is OK)

---

## Stijl

- Zakelijk en feitelijk
- Niet geforceerd — weinig te melden? Houd het kort
- Geen speculatie
- Nederlands
- Verificatievragen: kort, concreet, professioneel

---

## Fallbacks

| Situatie | Actie |
|----------|-------|
| BUSINESS.md bestaat niet | Skill skippen — draait alleen als BUSINESS.md aanwezig is |
| Geen transcripts vandaag | Kort reflecteren, of skip |
| Geen eerdere reflecties | Alleen over vandaag reflecteren |
| Weinig te melden | Korte reflectie, vragen snel skippen. Niet forceren |
| Niets nieuws voor BUSINESS.md | Expliciet benoemen: "Geen updates vandaag" |
