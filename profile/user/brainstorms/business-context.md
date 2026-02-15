# Brainstorm: Business Context & Business Skill

**Datum:** 14 februari 2026
**Context:** KITT wordt ingezet bij bedrijven (white-label / digital employee). Naast USER.md (persoonlijk) is er business context nodig zodat KITT het bedrijf begrijpt.

---

## Beslissingen

### Locatie
`profile/user/BUSINESS.md` — naast USER.md in de user folder.

### Context loading
Laden als block in `blocks.json` (type: file). Altijd beschikbaar in chat en think modes.

### Reflectie: 4 aparte skills
Huidige kitt-reflection bevat alles door elkaar (KITT + user + samenwerking). Opsplitsen in 4 losse skills die de task engine onafhankelijk kan schedulen:

| Skill | Focus | Schrijft naar | Draait in |
|-------|-------|---------------|-----------|
| `kitt-reflection` | KITT's eigen groei, identiteit, valkuilen | IDENTITY.md | altijd |
| `user-reflection` | De user(s), hoe ze denken/werken/communiceren | USER.md | altijd |
| `business-reflection` | Bedrijf, prioriteiten, markt, cultuur | BUSINESS.md | digital employee |
| `team-reflection` | Team dynamiek, channels, samenwerking | USER.md (team) + BUSINESS.md (channels) | digital employee |

**Mapping op scenario's:**
- Personal assistant → `kitt-reflection` + `user-reflection`
- Solo ondernemer → `kitt-reflection` + `user-reflection` + `business-reflection`
- Team member → alle vier
- Digital employee → `kitt-reflection` + `business-reflection` + `team-reflection`

### Multi-user
**Eén USER.md file voor alle users** (niet per persoon een apart bestand). Bevat per persoon:
- Naam, email, Slack/Teams ID
- Team, rol
- Waar houden ze zich mee bezig
- Hoe gebruiken ze KITT
- Hoe kan KITT ze helpen
- Uitdagingen/struggles (groeit organisch)

### Schrijfrechten
Zelfde observatie→patroon logica als huidige USER.md. Business skill maakt het initiële profiel, reflectie skill verrijkt het over tijd.

---

## Vier Scenario's

| # | Scenario | USER.md | BUSINESS.md | Team | Reflectie skills |
|---|----------|---------|-------------|------|-----------------|
| 1 | **Personal Assistant** | 1 user | — | — | kitt + user |
| 2 | **Solo Ondernemer** | 1 user | 1 bedrijf | — | kitt + user + business |
| 3 | **Team Member** | 1 user (primair) + team | 1 bedrijf | ja | alle vier |
| 4 | **Digital Employee** | team (geen primaire user) | 1 bedrijf | ja | kitt + business + team |

### Scenario 1: Personal Assistant
- Iemand die KITT als persoonlijke assistent gebruikt
- Geen bedrijfscontext, geen team
- Tools: nutrition, health, agenda, reminders, bouwen
- Voorbeeld: Renier met KITT

### Scenario 2: Solo Ondernemer
- Zelfstandige / eigen bedrijf zonder personeel
- Heeft USER.md (persoonlijk) + BUSINESS.md (zijn bedrijf)
- Geen team, maar wel bedrijfscontext (klanten, markt, prioriteiten)
- `business-reflection` draait, maar geen `team-reflection`
- Voorbeeld: freelancer, ZZP'er, eenmanszaak

### Scenario 3: Team Member
- Iemand die bij een bedrijf werkt, met een team
- Heeft een persoonlijke relatie met KITT (USER.md als primaire user)
- KITT kent ook het team (USER.md bevat teamleden)
- KITT kent het bedrijf (BUSINESS.md)
- Alle vier reflectie skills draaien
- Voorbeeld: Jonathan bij OPG (teamleider)

### Scenario 4: Digital Employee
- KITT is zelf de "medewerker" — geen specifieke primaire user
- Meerdere mensen praten met KITT, niemand is "de eigenaar"
- USER.md bevat alleen teamleden (geen persoonlijk profiel)
- BUSINESS.md is de kern van de context
- `user-reflection` draait NIET (geen primaire user om te leren kennen)
- Voorbeeld: KITT als Slack-collega bij een bedrijf, white-label bij Leon

**Mode detectie:**

| Conditie | Scenario |
|----------|----------|
| Geen BUSINESS.md | 1 — Personal Assistant |
| BUSINESS.md + geen team in USER.md | 2 — Solo Ondernemer |
| BUSINESS.md + team + primaire user | 3 — Team Member |
| BUSINESS.md + team + geen primaire user | 4 — Digital Employee |

Technisch: scenario 1 vs 2/3/4 = BUSINESS.md bestaat. Scenario 2 vs 3/4 = team sectie in USER.md. Scenario 3 vs 4 = primaire user vlag (bijv. `owner: true` in USER.md of config).

---

## BUSINESS.md als Referentie-Document

**Cruciaal inzicht:** BUSINESS.md bevat NIET alle bedrijfsinformatie. Het bevat **referenties** naar waar KITT dingen kan vinden.

Waarom:
- Bedrijven hebben Notion, Confluence, SharePoint met duizenden pagina's
- Dat past niet in context
- KITT hoeft niet alles te weten, maar moet weten WAAR hij dingen kan vinden

---

## BUSINESS.md — Structuur

```markdown
# Business Profile — [Bedrijfsnaam]

## Basics
- **Naam:**
- **Opgericht:**
- **Locatie(s):**
- **Sector/Industrie:**
- **Omvang:** (startup/MKB/enterprise, ~FTE)
- **Website:**
- **LinkedIn:**

## Wat ze doen
- **Core business:** (1-2 zinnen)
- **Producten/Diensten:**
- **Doelgroep/Klanten:**
- **USP:** (wat maakt ze uniek)

## Markt & Positionering
- **Concurrenten:**
- **Marktpositie:**
- **Trends die relevant zijn:**

## Cultuur & Communicatie
- **Cultuur:** (formeel/informeel, remote/kantoor, etc.)
- **Interne communicatiestijl:**
- **Tone of voice (extern):**

## Huidige Prioriteiten
- **Waar werken ze aan:**
- **Uitdagingen:**
- **Kansen:**

## Channels (Slack/Teams)
| Channel | Doel | Relevante skills |
|---------|------|-----------------|
| #general | Algemeen | — |
| #engineering | Tech discussies | issue, codebase-health |
| #sales | Sales pipeline | — |

## Tech Stack
- **Tools:**
- **Platformen:**

## Resources & Referenties
| Wat | Waar te vinden |
|-----|---------------|
| Medewerkers & rollen | Notion: /wiki/team |
| Producten & pricing | Notion: /wiki/products |
| Klanten & accounts | Notion: /wiki/clients |
| Processen & workflows | Notion: /wiki/processes |
| Brand guidelines | Google Drive: /marketing/brand |
| Vergadernotulen | Notion: /wiki/meetings |

## KITT's Rol
- **Modus:** personal-assistant / digital-employee
- **Waarom KITT:** (welk probleem lost KITT op)
- **Primaire use cases:**
- **Relevante skills:**

---

*Laatst bijgewerkt: [datum]*
*Bron: initieel profiel via business skill + organisch leren*
```

---

## USER.md in Team Mode — Structuur

In digital employee mode bevat USER.md meerdere personen:

```markdown
# Team — [Bedrijfsnaam]

## [Naam]
- **Email:** ...
- **Slack ID:** @...
- **Rol:** Product Manager
- **Team:** Product
- **Waar bezig mee:** Feature X lancering, klant Y onboarding
- **Hoe gebruikt KITT:** Vraagt om meeting samenvattingen, data lookups
- **Communicatiestijl:** Direct, kort, technisch
- **Uitdagingen:** Veel context switches, deadline druk

## [Naam 2]
...
```

**Groeit organisch:** KITT begint met naam + rol (uit onboarding/Notion), en leert de rest door interactie en reflectie.

---

## Vijf Skills (1 onboarding + 4 reflectie)

### 1. Business Profile Skill (eenmalig onboarding)

**Trigger:** User activeert met bedrijfsnaam/URL
**Wat het doet:**
- Deep search: website, LinkedIn, artikelen, blogposts, social media
- Alles ophalen en analyseren
- BUSINESS.md genereren

**Bronnen:**
- Company website (over ons, team, producten, diensten)
- LinkedIn company page
- Recente nieuwsartikelen / persberichten
- Blog posts van het bedrijf
- Social media (als relevant)
- KvK / handelsregister data

**Execution:** Background task (2-5 min)

---

### 2. Kitt Self-Reflection (bestaand, refactoren)

**Focus:** Alleen KITT's eigen groei, identiteit, valkuilen, humor
**Schrijft naar:** IDENTITY.md
**Draait:** Altijd (beide modes)

Huidige secties die HIER blijven:
- D. Humor
- E5. Eigen perspectief vs echo
- H. Groei & Patronen (KITT-specifiek)
- I. Doorslaggevendheid Check (alleen I2: hoe ik ondersteun)

Huidige secties die VERHUIZEN naar user-reflection:
- A. Hoe Renier denkt
- B. Hoe Renier werkt
- C. Communicatie
- E. Samenwerking (user-gerelateerde delen)
- F. Emotie & Energie
- G. Product & Visie

### 3. User Reflection (nieuw)

**Focus:** De user(s) begrijpen — hoe ze denken, werken, communiceren
**Schrijft naar:** USER.md
**Draait:** Altijd (beide modes)

**Vragen (overgenomen + uitgebreid uit huidige kitt-reflection):**

| # | Vraag | Uit |
|---|-------|-----|
| A1 | Hoe sprong de user vandaag tussen onderwerpen? Patroon? | was A1 |
| A2 | Wanneer was de user in hyperfocus? Wat triggerde dat? | was A2 |
| A3 | Hoe ging de user om met tegenvallers? | was A4 |
| B1 | Werkte de user in sprints of marathon? | was B1 |
| B2 | Delegeerde de user iets aan mij, of deed die het zelf? | was B3 |
| B3 | Was de user productief of druk? | was B5 |
| C1 | Heeft de user mijn output gecorrigeerd? WAT precies? | was C1 |
| C2 | Welke woorden/uitdrukkingen zijn "echt deze user"? | was C2 |
| C3 | Moest de user iets twee keer uitleggen? | was C6 |
| F1 | Wat was het energieniveau? Hoe merkte ik dat? | was F1 |
| F2 | Was de user gefrustreerd? Waarover precies? | was F2 |

### 4. Business Reflection (nieuw)

**Focus:** Het bedrijf begrijpen — prioriteiten, markt, cultuur, uitdagingen
**Schrijft naar:** BUSINESS.md
**Draait:** Alleen in digital employee mode

**Vragen:**

| # | Vraag |
|---|-------|
| A1 | Heb ik vandaag iets geleerd over het bedrijf dat niet in BUSINESS.md staat? |
| A2 | Zijn er verschuivingen in prioriteiten of focus? |
| A3 | Wat speelde er in de meetings/channels? Nieuwe thema's? |
| A4 | Zijn er uitdagingen of problemen die ik kan helpen oplossen? |
| A5 | Is er iets veranderd in hoe het bedrijf naar buiten communiceert? |
| A6 | Is er iets in BUSINESS.md dat niet meer klopt? |

### 5. Team Reflection (nieuw)

**Focus:** Team dynamiek, channels, wie doet wat, samenwerking
**Schrijft naar:** USER.md (team secties) + BUSINESS.md (channels)
**Draait:** Alleen in digital employee mode

**Vragen:**

| # | Vraag |
|---|-------|
| B1 | Heb ik nieuwe teamleden leren kennen? Naam, rol, stijl? |
| B2 | Hoe gebruikten specifieke users mij vandaag? Patronen? |
| B3 | Waar strugglede iemand mee? Kan ik daar morgen op inspelen? |
| B4 | Was er een communicatiepatroon dat ik moet onthouden? |
| B5 | Heb ik iemand goed geholpen? Wat werkte? |
| C1 | In welke channels was ik actief? Paste mijn bijdrage? |
| C2 | Zijn er nieuwe tools, processen, of resources ontdekt? |
| C3 | Welke skills werden het meest gevraagd? Past de configuratie? |

**Alle reflectie skills gebruiken dezelfde observatie→patroon logica:** eenmalige dingen → reflectie database. Bewezen patronen (2-3x) → target doc.

---

## Laag 2: Organisch Leren

Na het initiële profiel leert KITT bij via:
- **Slack/Teams conversaties** — taal, prioriteiten, dynamiek
- **Taken die KITT uitvoert** — elk project/taak verrijkt het beeld
- **Directe input** — users vertellen KITT dingen
- **Business reflection** — dagelijkse reflectie met business vragen
- **Notion/Confluence** — navigeren via referenties in BUSINESS.md
- **Meetings** — als KITT toegang heeft tot notulen of samenvattingen

---

## Open Vragen

1. **Onboarding flow:** Als KITT bij een bedrijf start, wat is stap 1?
   - Business profile skill draaien → BUSINESS.md
   - Notion/Confluence connectie opzetten → Resources vullen
   - Slack/Teams channels joinen → Channel tabel vullen
   - Eerste users leren kennen → USER.md beginnen
   - Of is dit een handmatige setup door de admin?

2. **Privacy/security:** Team USER.md bevat info over meerdere mensen
   - Wie mag wat zien?
   - KITT praat met Jan over KITT's observaties van Piet?

3. **Business skill bronnen:** Welke tools voor deep research?
   - WebSearch + WebFetch (al beschikbaar)
   - Browser skill (al gebouwd) voor dynamische pagina's
   - LinkedIn is lastig (rate limits)

4. **Scaling:** Hoeveel users past in één USER.md?
   - 5-10 people → prima
   - 50+ people → wordt te groot voor context
   - Eventueel: alleen actieve users laden (laatst gesproken)?

---

## Wat moet er technisch gebeuren?

### Nieuwe componenten
- [ ] `profile/user/BUSINESS.md` template
- [ ] Business profile skill (`.claude/skills/business-profile/SKILL.md`)
- [ ] User reflection skill (`.claude/skills/user-reflection/SKILL.md`)
- [ ] Business reflection skill (`.claude/skills/business-reflection/SKILL.md`)
- [ ] Team reflection skill (`.claude/skills/team-reflection/SKILL.md`)
- [ ] Context block in `blocks.json` voor BUSINESS.md

### Aanpassingen bestaand
- [ ] `kitt-reflection`: refactoren — user-vragen eruit, alleen KITT-specifiek
- [ ] USER.md: team mode structuur definiëren
- [ ] Context builder: BUSINESS.md laden als block (conditioneel: alleen als file bestaat)
- [ ] Capabilities: 3 nieuwe reflectie skills registreren als scheduled tasks
- [ ] Mode detectie: BUSINESS.md bestaat → digital employee features activeren

---

*Dit is een levend document — we vullen het samen aan tijdens de brainstorm.*
