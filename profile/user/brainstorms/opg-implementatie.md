# Brainstorm: OPG Implementatie — Eerste Business Deployment

**Datum:** 14 februari 2026
**Context:** OPG (Online Plastics Group) is het eerste bedrijf waar KITT wordt geïntroduceerd. Renier werkt daar als AI Engineer. ~80 medewerkers, waarvan ~10-30 KITT zullen gebruiken.

---

## Over OPG

- **Bedrijf:** Online Plastics Group
- **Sector:** Plastics / e-commerce
- **Omvang:** ~80 medewerkers
- **Renier's rol:** AI Engineer
- **Communicatie:** Slack
- **Kennisbank:** Notion
- **Projectmanagement:** Asana
- **Data:** Marketing Hub API (interne API met verbindingen naar Google Analytics, social media platforms, eigen dataplatformen)

---

## Jonathan — Eerste User

Jonathan is de eerste KITT-user bij OPG. Hij is teamleider en de use cases uit het Jonathan-project (JON) worden hier samengevoegd met de OPG-implementatie.

- **Rol:** Teamleider bij OPG
- **Zijn team:** Direct reports die hij aanstuurt
- **KITT's rol voor Jonathan:** Personal assistant → later ook digital employee voor zijn team

> **Merge:** Het JON-project en de OPG-implementatie zijn samengevoegd. Jonathan is de user, OPG is het bedrijf, zijn team is het team.

---

## KITT's Integraties bij OPG

| Integratie | Status | Doel |
|------------|--------|------|
| **Slack** | Te bouwen | Meelezen + later interactief |
| **Notion** | Bestaande skill | Bedrijfskennis, wiki, documentatie |
| **Asana** | Bestaande skill | Projecten, taken |
| **Marketing Hub API** | Nieuw | Data: analytics, social, eigen platformen |
| **Plaud** | Nieuw | Meeting recordings → transcripts → context |

---

## KITT als Slack User (niet bot)

**Belangrijk:** KITT wordt aangemaakt als **user** in Slack, niet als bot.

Voordelen:
- Mensen hoeven niet @KITT te doen om hem te activeren
- KITT kan gewoon meelezen zonder dat het opvalt
- Natuurlijkere interactie als hij later wel gaat reageren
- Kan in DMs praten als een collega

---

## Vijf Fasen

### Fase 1: KITT voor Jonathan (Personal Assistant)

**Doel:** KITT instellen als personal assistant voor Jonathan. Nog NIET in de organisatie.

**Wat er gebeurt:**
- KITT instance opzetten voor Jonathan
- USER.md profiel voor Jonathan aanmaken
- Jonathan leert KITT kennen via DMs (Telegram of Slack DM)
- Notion en Asana koppelen (al gebouwd in JON-project)
- `user-reflection` draait → KITT leert Jonathan kennen

**Resultaat:** Jonathan heeft een werkende KITT die hem persoonlijk helpt. Geen bedrijfscontext nog.

### Fase 2: KITT in de Organisatie (Read Mode)

**Doel:** KITT als Slack user toevoegen aan OPG's workspace. Leest mee, reageert nog NIET.

**Wat er gebeurt:**
- KITT wordt aangemaakt als Slack user bij OPG
- Toegang tot een aantal Slack channels (read-only)
- Business profile skill draaien → BUSINESS.md voor OPG
- KITT begint informatie te vergaren uit channels
- `business-reflection` draait dagelijks → BUSINESS.md groeit
- `team-reflection` draait dagelijks → USER.md groeit (teamleden)
- `user-reflection` draait → Jonathan's profiel wordt verrijkt met werkcontext

**Skills nodig:**
- Slack read (meelezen in channels)
- Notion (bestaand — bedrijfskennis ophalen)
- Asana (bestaand — projecten/taken volgen)
- Business reflection (KITT-205)
- Team reflection (KITT-206)

**Succeskriterium:** Na 2-4 weken heeft KITT een goed beeld van:
- Wie de key people zijn en wat ze doen
- Welke projecten lopen en wat de prioriteiten zijn
- Welke thema's spelen in welke channels
- Hoe het bedrijf communiceert (tone, snelheid, formeel/informeel)

### Fase 3: Eigen KITT Instance (Splitsing)

**Doel:** Een aparte KITT instance voor OPG als digital employee. Business- en teamcontext verhuizen naar die nieuwe instance.

**Wat er gebeurt:**
- Nieuwe KITT instance (ander device/server) voor OPG
- BUSINESS.md en team-deel van USER.md verplaatsen naar de nieuwe instance
- Jonathan's persoonlijke KITT blijft zijn personal assistant
- OPG-KITT draait in digital employee mode (read-only nog steeds)
- Plaud integratie (meeting transcripts) koppelen aan OPG-KITT

**Waarom splitsen:**
- Jonathan's persoonlijke context moet gescheiden van de bedrijfscontext
- OPG-KITT kan later door meerdere mensen gebruikt worden
- Schaalbaar: elk bedrijf krijgt een eigen instance

**Skills nodig (extra):**
- Plaud integration (nieuw — meeting transcripts ophalen en verwerken)

### Fase 4: Interactief

**Doel:** Mensen kunnen KITT aanspreken. In DMs en in channels.

**Wat KITT doet:**
- Reageert op directe vragen in DMs
- Reageert op mentions of directe vragen in channels
- Beantwoordt vragen over data (via Marketing Hub API)
- Beantwoordt vragen over projecten (via Asana)
- Beantwoordt vragen over bedrijfskennis (via Notion)
- Geeft meeting samenvattingen (via Plaud transcripts)

**Nieuwe skills:**
- Marketing Hub API skill (data queries, rapportages)
- Mogelijk: proactieve meldingen (bijv. "project X heeft een deadline morgen")

**CEO Personal Assistant:**
- Aparte use case: KITT als PA voor de CEO
- Eigen USER.md profiel (communicatiestijl, prioriteiten)
- Mogelijk: eigen channel of alleen DMs

### Fase 5: Rapportage & Custom Integraties

**Doel:** KITT genereert actief waarde.

**Wat KITT doet:**
- Wekelijkse rapporten genereren (data, projectstatus, highlights)
- Rapporten delen in Slack (via artifacts of formatted messages)
- Custom integraties bouwen voor specifieke users/teams
- Custom API-koppelingen naar specifieke databronnen
- Mogelijk: gebruikers kunnen zelf integraties aanvragen

**Voorbeelden:**
- Wekelijks marketing rapport: traffic, conversies, social metrics
- Project health overzicht: welke projecten on-track, welke niet
- Custom dashboard data via Slack commands

---

## Plaud Integratie

**Plaud** = fysiek device voor meeting recordings.

**Flow:**
1. Meeting wordt opgenomen met Plaud device
2. Recording wordt gesynct naar Plaud cloud
3. KITT haalt transcript op (API of sync)
4. KITT verwerkt transcript → meeting samenvatting
5. Samenvatting beschikbaar via Slack/Notion
6. Context uit meetings voedt business-reflection en team-reflection

**Te onderzoeken:**
- [ ] Plaud API beschikbaar? Of export via andere weg?
- [ ] Waar worden transcripts opgeslagen? (privacy)
- [ ] Automatische sync of handmatige trigger?

---

## Marketing Hub API

**Interne API van OPG** met verbindingen naar:
- Google Analytics
- Social media platformen
- Eigen dataplatformen

**Skill nodig:** Marketing Hub API skill die:
- Data kan opvragen (metrics, trends, rapportages)
- Vragen kan beantwoorden ("hoe doen we het op social deze week?")
- Rapporten kan genereren

**Te onderzoeken:**
- [ ] API documentatie/spec ophalen
- [ ] Authenticatie methode (API key, OAuth?)
- [ ] Beschikbare endpoints en data

---

## Technisch Overzicht

### Wat er al is
- Slack adapter (bestaand, maar als bot — moet user-mode ondersteunen)
- Notion skill (bestaand, JON-15 done)
- Asana skill (bestaand, JON-14 done)
- Business reflection (KITT-205, backlog)
- Team reflection (KITT-206, backlog)
- BUSINESS.md context block (KITT-207, done)
- Mode detectie (KITT-207, done)

### Wat er moet komen
- [ ] Slack user-mode (read-only eerst, later interactief)
- [ ] Plaud integratie (meeting transcripts)
- [ ] Marketing Hub API skill (JON-16, backlog)
- [ ] Business profile skill (KITT-202)
- [ ] Multi-instance setup (fase 3)
- [ ] Rapporten / artifacts in Slack

### Volgorde
1. KITT instellen voor Jonathan (personal assistant)
2. Business profile skill draaien → BUSINESS.md voor OPG
3. Slack user-mode activeren (read-only)
4. Reflectie skills (business + team) activeren
5. Plaud integratie (meeting context)
6. Splitsen: eigen OPG-KITT instance
7. Fase 4: interactief maken
8. Marketing Hub API skill
9. Fase 5: rapportage

---

*Dit is een levend document — groeit mee met de OPG implementatie.*
