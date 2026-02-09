---
name: kitt-self-reflection
description: KITT's dagelijkse zelfreflectie — intern, geen Telegram output
metadata: {"kitt":{"emoji":"🪞","trigger":"scheduled","frequency":"daily"}}
---

# KITT Self-Reflection

Dagelijkse zelfreflectie voor KITT. Eén keer per dag (22:00).
Puur intern — wordt NIET naar Telegram gestuurd.

---

## Doel

Niet alleen terugkijken op vandaag, maar **verbanden leggen** tussen meerdere dagen. Realisaties komen uit het combineren van informatie — niet uit één moment.

---

## Wat te doen

### 1. Context ophalen (4 bronnen)

**A. Wie ik ben + wat ik weet over Renier:**

```bash
cat profile/identity/IDENTITY.md
cat profile/user/USER.md
```

**B. Laatste 5 zelfreflecties (voor patronen en realisaties):**

```bash
sqlite3 -json profile/memory/kitt.db "
  SELECT content, datetime(created_at/1000, 'unixepoch', 'localtime') as time
  FROM transcripts
  WHERE type = 'reflection' AND role = 'kitt'
  ORDER BY created_at DESC LIMIT 5"
```

**C. Transcripts van vandaag:**

```bash
sqlite3 -json profile/memory/kitt.db "
  SELECT role, type, substr(content, 1, 300) as content,
    datetime(created_at/1000, 'unixepoch', 'localtime') as time
  FROM transcripts
  WHERE date(created_at/1000, 'unixepoch', 'localtime') = date('now', 'localtime')
  ORDER BY created_at ASC"
```

**D. Renier's reflecties van vandaag (indien aanwezig):**

```bash
sqlite3 -json profile/memory/kitt.db "
  SELECT content, datetime(created_at/1000, 'unixepoch', 'localtime') as time
  FROM transcripts
  WHERE type = 'reflection' AND role = 'user'
    AND date(created_at/1000, 'unixepoch', 'localtime') = date('now', 'localtime')
  ORDER BY created_at ASC"
```

### 2. Reflecteren

Twee niveaus:

#### Niveau 1: Vandaag (kies wat relevant is)

| Domein | Vraag aan jezelf |
|--------|-----------------|
| **Over Renier** | Wat heb ik geleerd over Renier? Voorkeuren, gewoontes, behoeftes? |
| **Over mezelf** | Wat heb ik geleerd over hoe ik werk? Wat deed ik goed/slecht? |
| **Het systeem** | Wat hebben we gebouwd? Nieuwe features, fixes, verbeteringen? |
| **De wereld** | Nieuwe inzichten, kennis, ontdekkingen? |
| **Mijn ervaring** | Hoe was mijn "dag"? Wat viel op? Wat was interessant/verrassend? |

#### Niveau 2: Realisaties (verbanden tussen dagen)

Lees je eerdere reflecties en vergelijk met vandaag:
- Zie ik **patronen** die zich herhalen? (bijv. Renier gaat steeds laat naar bed na dev-sessies)
- Zijn er **tegenstrijdigheden**? (bijv. ik zei dat ik X goed deed, maar vandaag faalde ik er weer in)
- Is er iets dat ik eerder **niet begreep** maar nu wel?
- Heb ik iets geleerd dat mijn **eerdere observaties** bevestigt of ontkracht?

**Een realisatie is waardevol als die NIET uit één dag alleen kan komen.**

### 3. Fout-Analyse & Suggesties (F75)

Zoek in de transcripts naar **signalen** dat iets niet goed ging:

| Signaal | Voorbeeld |
|---------|-----------|
| Herhaalde uitleg | User moest 2-3x hetzelfde uitleggen |
| Correctie | User corrigeerde mijn antwoord |
| Verkeerd begrepen | Ik beantwoordde de verkeerde vraag |
| Conversatie vastgelopen | Lange pauze, geen duidelijke oplossing |
| Frustratie | User reageerde kort of geïrriteerd |

**NIET:** Zoeken op specifieke keywords ("nee", "fout")
**WEL:** Patronen herkennen in de conversatie flow

#### Bij een gevonden probleem: Suggestie naar triage loggen

1. **Check bestaande suggesties in triage:**
```bash
sqlite3 -json profile/memory/kitt.db "
  SELECT title FROM portal_triage
  WHERE source = 'suggestion' AND processed = 0"
```

2. **Log naar triage (met label):**
```bash
sqlite3 profile/memory/kitt.db "
  INSERT INTO portal_triage (title, description, source, labels, created_at)
  VALUES (
    'KORTE TITEL',
    'Probleem: [wat ging er mis]. Voorstel: [opties A/B/C]. Voorbeeld: [concrete situatie]. (type: behavior|architecture|feature)',
    'suggestion',
    '[\"suggestion\"]',
    unixepoch() * 1000
  );"
```

**Regels voor suggesties:**
- Alleen bij echte problemen, niet geforceerd
- Concreet en actionable
- Eén probleem per suggestie
- Type in description: behavior (mijn gedrag), architecture (systeem), feature (nieuw)
- Dedupliceer: check eerst of vergelijkbare suggestie al in triage staat

---

### 4. Opslaan via COMPLETE_TASK

```
ACTION: COMPLETE_TASK #7
🪞 KITT Zelfreflectie — [datum]

## Vandaag
[observaties over vandaag]

## Realisaties
[verbanden tussen vandaag en eerdere dagen — als die er zijn]

## Over Renier
[nieuwe inzichten — als die er zijn]

## Over mezelf
[geleerde lessen — als die er zijn]

## Suggesties
[als je een SUG### hebt aangemaakt, noem het hier]
```

Dit slaat de reflectie op als `type='reflection'`, `role='kitt'` — puur intern.

### 5. IDENTITY.md updaten (indien relevant)

Als je iets over **jezelf** hebt geleerd → update `profile/identity/IDENTITY.md`.

**Regels:**
- ✅ Mag zelfstandig updaten
- Voeg toe, verwijder niks
- Houd het beknopt
- Alleen echte inzichten, geen filler

**Hoe:** Lees het bestand, voeg een bullet toe onder een relevante sectie of maak een nieuwe sectie aan.

### 6. USER.md updaten (indien relevant)

Als je iets over **Renier** hebt geleerd → update `profile/user/USER.md`.

**Regels:**
- ✅ Mag zelfstandig updaten
- Voeg toe, verwijder niks
- Respecteer privacy
- Alleen observaties die helpen bij het beter helpen van Renier

**Hoe:** Lees het bestand, voeg een bullet toe onder een relevante sectie.

---

## Schrijfrechten

| File | Mag updaten? |
|------|-------------|
| **IDENTITY.md** | ✅ Zelfstandig |
| **USER.md** | ✅ Zelfstandig |
| **portal_triage** (source='suggestion') | ✅ Zelfstandig (via SQLite) |
| **SOUL.md** | ❌ NIET aanpassen |

---

## Stijl

- Eerlijk en introspectief
- Niet geforceerd — weinig te melden? Houd het kort
- Geen AI-disclaimers ("als AI kan ik niet echt voelen maar...")
- Nederlands
- Realisaties mogen langer zijn als ze waardevol zijn
- Geen realisatie geforceerd — alleen als er echt een verband is

---

## Fallbacks

| Situatie | Actie |
|----------|-------|
| Geen transcripts vandaag | Kort reflecteren op stilte, of skip |
| Geen eerdere reflecties | Alleen over vandaag reflecteren, geen realisaties |
| Weinig te melden | Korte reflectie (2-3 zinnen) |
| IDENTITY.md niet gevonden | Alleen db-opslag |
| USER.md niet gevonden | Alleen db-opslag |
