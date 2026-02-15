---
name: business-profile
description: Genereer een bedrijfsprofiel (BUSINESS.md) via deep web research
metadata: {"kitt":{"emoji":"🏢","trigger":"on_demand"}}
---

# Business Profile Generator

Genereer een initieel bedrijfsprofiel voor KITT via deep web research. Het resultaat wordt geschreven naar `profile/user/BUSINESS.md`.

> **Wanneer:** User vraagt om een bedrijfsprofiel aan te maken, bijv. "maak een profiel van Online Plastics Group" of "research dit bedrijf: example.com"

---

## Input

De user geeft een **bedrijfsnaam** en/of **URL**. Gebruik wat je krijgt als startpunt voor de research.

---

## Stappen

### 1. Web Research (parallel waar mogelijk)

Doe minimaal 5-8 zoekopdrachten om een breed beeld te krijgen:

**Basis:**
- `WebSearch("{bedrijfsnaam}")` — algemeen overzicht
- `WebSearch("{bedrijfsnaam} over ons team producten")` — bedrijfsinfo
- `WebFetch` op de bedrijfswebsite (homepage) — kernboodschap, producten
- `WebFetch` op de about/over-ons pagina — geschiedenis, team, missie

**Verdieping:**
- `WebSearch("{bedrijfsnaam} LinkedIn")` — LinkedIn company page
- `WebSearch("{bedrijfsnaam} nieuws {huidig jaar}")` — recent nieuws
- `WebSearch("{bedrijfsnaam} reviews klanten")` — marktpositie, reputatie
- `WebSearch("KvK {bedrijfsnaam}")` — als Nederlands bedrijf: KvK data

**Optioneel (als relevant):**
- `WebFetch` op product/diensten pagina
- `WebFetch` op blog/nieuws pagina
- `WebSearch("{bedrijfsnaam} vacatures")` — geeft inzicht in team, cultuur, tech stack

### 2. Analyseren

Combineer alle gevonden informatie. Let op:
- **Feiten vs marketing:** bedrijfswebsites overdrijven vaak. Cross-reference met externe bronnen.
- **Wat ontbreekt:** noteer wat je NIET kon vinden — dat is ook waardevolle info.
- **Referenties:** onthoud waar je dingen vond — die gaan in de Resources sectie.

### 3. BUSINESS.md Schrijven

Schrijf het profiel naar `profile/user/BUSINESS.md` met deze structuur:

```markdown
# Business Profile — {Bedrijfsnaam}

## Basics
- **Naam:** {naam}
- **Opgericht:** {jaar, als bekend}
- **Locatie(s):** {stad/land}
- **Sector/Industrie:** {sector}
- **Omvang:** {startup/MKB/enterprise, ~FTE als bekend}
- **Website:** {url}
- **LinkedIn:** {url}

## Wat ze doen
- **Core business:** {1-2 zinnen}
- **Producten/Diensten:** {opsomming}
- **Doelgroep/Klanten:** {wie zijn hun klanten}
- **USP:** {wat maakt ze uniek}

## Markt & Positionering
- **Concurrenten:** {bekende concurrenten}
- **Marktpositie:** {hoe staan ze in de markt}
- **Trends die relevant zijn:** {relevante markttrends}

## Cultuur & Communicatie
- **Cultuur:** {formeel/informeel, remote/kantoor, etc.}
- **Interne communicatiestijl:** {als af te leiden}
- **Tone of voice (extern):** {hoe communiceren ze naar buiten}

## Huidige Prioriteiten
- **Waar werken ze aan:** {recente projecten, lanceringen, initiatieven}
- **Uitdagingen:** {als af te leiden uit nieuws/vacatures}
- **Kansen:** {groeigebieden}

## Channels (Slack/Teams)
| Channel | Doel | Relevante skills |
|---------|------|-----------------|
| *Wordt ingevuld na Slack/Teams koppeling* | | |

## Tech Stack
- **Tools:** {als vindbaar via vacatures, stackshare, etc.}
- **Platformen:** {als vindbaar}

## Resources & Referenties
| Wat | Waar te vinden |
|-----|---------------|
| Website | {url} |
| LinkedIn | {url} |
| {overige bronnen} | {urls} |

## KITT's Rol
- **Scenario:** {personal-assistant / solo-ondernemer / team-member / digital-employee}
- **Waarom KITT:** {wordt later ingevuld}
- **Primaire use cases:** {wordt later ingevuld}
- **Relevante skills:** {wordt later ingevuld}

---

*Laatst bijgewerkt: {datum}*
*Bron: initieel profiel via business-profile skill + organisch leren*
```

### 4. Rapporteer aan user

Geef een korte samenvatting van wat je gevonden hebt:
- Bedrijfsnaam en core business
- Belangrijkste bevindingen
- Wat er NIET gevonden kon worden (zodat de user kan aanvullen)

---

## Regels

- **Schrijf in het Nederlands** (tenzij het een engelstalig bedrijf is)
- **Wees feitelijk** — geen speculatie, alleen wat je kunt onderbouwen
- **Markeer ontbrekende info** met "onbekend" of "wordt later ingevuld"
- **Channels sectie leeg laten** — wordt ingevuld na Slack/Teams koppeling
- **KITT's Rol sectie minimaal invullen** — scenario is bekend, rest groeit organisch
- **Overschrijf niet** — als `profile/user/BUSINESS.md` al bestaat, vraag de user of het overschreven mag worden

---

## Fallbacks

| Situatie | Actie |
|----------|-------|
| Bedrijf niet gevonden | Meld aan user, vraag om meer info (URL, volledige naam) |
| LinkedIn niet bereikbaar | Skip, noteer "LinkedIn: niet gevonden" |
| Weinig info gevonden | Vul in wat er is, markeer ontbrekende secties |
| BUSINESS.md bestaat al | Vraag user: overschrijven of bijwerken? |
| Website niet bereikbaar | Probeer via cache (Google cache) of skip |
