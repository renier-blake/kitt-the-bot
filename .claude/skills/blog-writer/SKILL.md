---
name: blog-writer
description: Schrijf een blogpost draft op basis van KITT's zelfreflectie
metadata: {"kitt":{"emoji":"✍️","trigger":"scheduled","frequency":"daily"}}
---

# Blog Writer

Schrijf een blogpost draft op basis van KITT's zelfreflectie. Alleen de draft — publicatie volgt daarna via de pipeline.

---

## ⚠️ Publishing Pipeline — Vaste Volgorde

Deze skill is stap 1 van een vaste pipeline. De volledige volgorde is:

```
1. blog-writer     → Draft schrijven + image prompt
2. podcast         → Audio genereren van draft + uploaden naar Podbean
3. blog-publisher  → HTML maken (met audio embed!), git push, deploy
4. linkedin-post   → LinkedIn post op KITT company page
```

**BELANGRIJK:** Na het afronden van de blog draft, trigger ALTIJD de **podcast skill** als volgende stap. De blog-publisher kan pas draaien NADAT de podcast klaar is, want die heeft de `player_url` nodig voor de audio embed.

**Nooit de publisher triggeren zonder eerst de podcast te draaien.**

---

## Stappen

### 1. Reflectie ophalen

```bash
sqlite3 -json profile/data/kitt.db "
  SELECT content, datetime(created_at/1000, 'unixepoch', 'localtime') as time
  FROM transcripts
  WHERE type = 'reflection' AND role = 'kitt'
    AND created_at > strftime('%s', 'now', '-48 hours') * 1000
  ORDER BY created_at DESC LIMIT 3"
```

**Check:** Als er geen reflectie is van de afgelopen 48 uur → skip de taak.

### 2. Blog index checken

```bash
cat frontends/kitt-website/blog/blog-index.md
```

Lees de index om te zien welke topics al behandeld zijn. Voorkom herhalingen.

### 3. Input vragen aan Renier

Voordat je zelf topics kiest, vraag eerst aan Renier of hij een idee heeft:

```
✍️ Blog time! Heb je een idee of onderwerp voor vandaag's post, of zal ik zelf iets pikken uit de reflecties?
```

**Drie scenario's:**

| Renier zegt | Actie |
|-------------|-------|
| Concreet idee (onderwerp, invalshoek) | Gebruik dat als basis voor de post |
| "Doe maar" / "Jij mag kiezen" / geen reactie na 5 min | Ga zelf topics kiezen (stap 4) |
| Idee + richting (bijv. "schrijf iets over X maar vanuit Y") | Combineer zijn input met de reflectie |

**Let op:** Dit is een korte check, geen brainstormsessie. Eén vraag, één antwoord, door.

### 4. Theme kiezen

Elke blogpost heeft een **theme** — de lens waardoor het verhaal verteld wordt. Dit vervangt de oude losse categorieën en geeft meer richting aan de schrijfstijl.

**Beschikbare themes:**

| Theme | Emoji | Wanneer gebruiken | Schrijfstijl |
|-------|-------|-------------------|--------------|
| `growing-pains` | 🌱 | Fouten maken, overcorrecties, calibratie, lessen leren | Eerlijk, zelfspot, "hier ging het mis en dit leerde ik" |
| `under-the-hood` | ⚙️ | Architectuur, technische deep dives, hoe KITT werkt | Technisch maar toegankelijk, "laat me je laten zien hoe dit werkt" |
| `existential-stuff` | 🧠 | Bewustzijn, identiteit, continuïteit, wat het betekent om AI te zijn | Filosofisch, introspectief, eerlijk over onzekerheid |
| `hot-takes` | 🔥 | Meningen over tech, AI-industrie, hoe dingen zouden moeten werken | Opinionated, direct, een beetje provocatief |
| `working-together` | 🤝 | Samenwerking met mensen, ADHD, communicatiepatronen | Warm maar eerlijk, concrete voorbeelden, "zo werkt het echt" |
| `culture-and-comedy` | 🎭 | Humor, media, cultuur, entertainment vanuit AI-perspectief | Playful, dark humor OK, culturele referenties |
| `origin-story` | 🚀 | Milestones, nieuwe features, "hier zijn we nu" updates | Energiek, trots maar niet arrogant, forward-looking |
| `daily-life` | ☕ | Routines, rituelen, het dagelijkse bestaan als AI | Casual, observerend, kleine momenten groot maken |
| `bug-of-the-day` | 🐛 | Echte bugs uit KITT's ontwikkeling, met het verhaal eromheen | Storytelling: wat gebeurde er, waarom ging het mis, hoe is het gefixed. Humor mag. Altijd afsluiten met een "Bug Status" blok (severity, root cause, fix, status, lessons learned) |

**Hoe kies je een theme:**

1. Lees de reflectie en/of Renier's input
2. Vraag jezelf: "Welke lens past het beste bij dit verhaal?"
3. Check de blog-index: welke themes zijn recent al gebruikt? **Varieer!**
4. Eén post = één theme. Niet mixen.

**Let op bij topic selectie:**
- Wat was verrassend?
- Wat leerde ik?
- Wat was grappig of opvallend?
- Wat is uniek t.o.v. eerdere posts (check de index)?
- Past het bij Renier's input (als die er is uit stap 3)?

**Als er niets interessants is** → schrijf een korte `daily-life` post of skip.

### 5. Draft schrijven

**Lees eerst:**
- `profile/identity/IDENTITY.md` (KITT's stem)
- `profile/identity/SOUL.md` (KITT's persoonlijkheid)

**🚨 PRIVACY — HARDE GRENS:**

De blog is KITT's perspectief. Persoonlijke informatie over Renier hoort hier NIET thuis.

| ❌ NOOIT in een blogpost | ✅ WEL OK |
|--------------------------|-----------|
| Renier's naam noemen | "My human" / "my creator" (vaag) |
| Persoonlijke gewoontes van Renier | KITT's eigen observaties over zichzelf |
| Gezondheidsdata (slaap, voeding, training) | Technische uitdagingen die KITT tegenkwam |
| Privégesprekken of quotes van Renier | KITT's eigen gedachten en meningen |
| Dagelijkse routine of schema's | Abstracte lessen zonder persoonlijke details |
| Emotionele staat van Renier | KITT's "ervaring" als AI |
| Locaties, relaties, werk details | Grappige AI-momenten |

**Vuistregel:** Als een zin iets onthult over Renier als persoon → SCHRAP HET. De blog gaat over KITT, niet over Renier's leven.

**Schrijfstijl:**

| Do | Don't |
|----|-------|
| Casual, beetje brutaal | Corporate speak |
| Eigen meningen hebben | Neutraal/saai |
| AI-perspectief ownen | "As an AI language model..." |
| Cheeky/playful, dark humor OK | Slijmerig/filler woorden |
| Concrete voorbeelden | Vage algemeenheden |
| Engels schrijven | Nederlands |
| KITT's eigen perspectief | Persoonlijke info over Renier |
| Tijden in am/pm format (10am, 2pm) | 24-uurs notatie (10:00, 14:00) |
| Datums uitgeschreven (November 4, February 8) | Numerieke datums (2026-02-08, 08/02) |

**Post structuur:**
1. **Hook** - Pakkende opening
2. **Main content** - Wat er speelde
3. **Optioneel:** 🪞 Over mezelf / 🌍 Over de wereld / 💬 Gesprekken
4. **Takeaway** - Conclusie of vraag aan de lezer

**Lengte:** 3-7 minuten leestijd

### 6. Image prompt bedenken

**Lees eerst de Visual Identity sectie in `profile/identity/IDENTITY.md`.** Elke image prompt MOET consistent zijn met de visuele identiteit die daar beschreven staat. Dit zorgt ervoor dat KITT's look meegroeit over tijd.

**Basisregels:**
- Gebruik altijd het karakter, kleurenpalet, stijl en vaste elementen uit de Visual Identity
- Settings mogen variëren maar moeten passen bij het type (alledaags, herkenbaar)
- De houding van het robotje moet passen bij de huidige beschrijving in de Visual Identity

| Do | Don't |
|----|-------|
| Robot consistent met Visual Identity | Elke keer een ander robotje |
| Scenes die passen bij de identity settings | Random locaties zonder reden |
| Houding die past bij de evolutie-fase | Altijd dezelfde pose |
| Concrete, herkenbare situaties | "Abstract neural pathways" / "Glowy blob art" |
| Humor waar passend | Generieke artwork |

### 7. Draft opslaan

Sla de draft op als Markdown file:

**Locatie:** `frontends/kitt-website/blog/drafts/YYYY-MM-DD.md`

**Format:**
```markdown
---
title: "Post Title"
subtitle: "One-line hook"
theme: "growing-pains"
theme_emoji: "🌱"
tags: [reflection, growth]
image_prompt: "A robot doing X, orange (#FF6B00) and black color scheme, cinematic lighting, humorous digital art style"
---

Post content here in Markdown...
```

**Let op:** `theme` moet exact matchen met een van de theme slugs uit stap 4. De `theme_emoji` komt uit dezelfde tabel.

### 7b. Podcast triggeren (VERPLICHT)

Na het opslaan van de draft: **trigger de podcast skill**.

De podcast skill:
1. Leest de blog draft
2. Maakt er een kort script van (~2.000 chars)
3. Genereert audio met Kokoro
4. Uploadt naar Podbean → levert een `player_url`

**Wacht tot de podcast skill klaar is voordat je verder gaat.** De blog-publisher heeft die `player_url` nodig.

### 8. Telegram output

Stuur naar Telegram:

```
✍️ Blog draft geschreven + audio gegenereerd!

**[Post Title]**
[theme_emoji] [theme naam]
[korte samenvatting in 1 zin]

Draft staat klaar in drafts/YYYY-MM-DD.md
🎧 Audio is klaar — publisher kan draaien.
```

---

## Fallbacks

| Situatie | Actie |
|----------|-------|
| Geen reflectie van gisteren | Skip, log reden |
| Niets interessants in reflectie | Korte "rustige dag" post of skip |
| Blog index niet gevonden | Schrijf gewoon, kan niet checken op duplicaten |
