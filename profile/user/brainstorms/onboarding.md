# Brainstorm: Onboarding — Eerste Keer KITT Opzetten

**Datum:** 14 februari 2026
**Context:** Hoe ervaart een eindgebruiker het voor het eerst opzetten van KITT? Vier smaken, elk met een eigen onboarding flow. We beginnen bij de twee meest complexe.

---

## De Vier Smaken (recap)

| # | Smaak | USER.md | BUSINESS.md | Team | Voorbeeld |
|---|-------|---------|-------------|------|-----------|
| 1 | **Personal Assistant** | 1 user | — | — | Renier met KITT |
| 2 | **Solo Ondernemer** | 1 user | 1 bedrijf | — | ZZP'er, freelancer |
| 3 | **Team Member** | 1 user (primair) + team | 1 bedrijf | ja | Jonathan bij OPG |
| 4 | **Digital Employee** | team (geen primaire user) | 1 bedrijf | ja | KITT als Slack-collega |

---

## Baseline: Vertrekpunt Onboarding

Voordat de onboarding begint, is het volgende al gebeurd:

1. **Account aangemaakt** — User heeft een abonnement gekozen (smaak 1/2/3/4)
2. **KITT geïnstalleerd** — Installer gedraaid op een machine
3. **Portal opent** — Browser opent met chat interface

### Onboarding Chat

- De chat is gepowerd door een **slimme LLM** (Opus of vergelijkbaar)
- Draait op **KITT's eigen API key** — niet die van de user
- Hierdoor kan de user direct profiteren van AI-intelligentie tijdens onboarding
- Geen rigide wizard/formulier nodig — de LLM voert het gesprek

### Security: Alleen Onboarding Skill

- Na installatie is **alleen de user-onboarding skill** beschikbaar
- Geen andere skills toegankelijk (voorkomt misbruik van KITT's API key)
- Hardcoded: KITT's API key = alleen onboarding skill, niets anders
- Na afronding onboarding → switch naar user's eigen API key → alle skills beschikbaar

> **Later uitwerken:** Account/abonnement systeem, installer, API key management. Nu niet relevant — focus op de onboarding flow zelf.

---

## Smaak 2: Solo Ondernemer

**Case:** ZZP'er, freelancer, eenmanszaak. Heeft een bedrijf maar geen team. KITT is persoonlijke assistent met bedrijfscontext.

### Wie zet dit op?

De ondernemer zelf (self-service).

### Kernverschillen

| | Smaak 2 (Solo) | Smaak 3 (Team Member) |
|---|---|---|
| **Team** | Geen | Ja |
| **Team setup stap** | Vervalt | Stap 6 |
| **USER.md** | 1 user, geen team | 1 user + team |
| **Reflectie skills** | kitt + user + business | kitt + user + business + team |

### Onboarding Flow

Zelfde kernprincipe: **gesprek met controlevragen**.

#### Stap 1: Kennismaking

KITT stelt zich voor en stelt basisvragen:
- **Wie ben je?** (naam)
- **Wat doe je?** (rol/vakgebied)
- **Hoe heet je bedrijf?**
- **In welke taal wil je communiceren?** (default: Engels)

> **Draait op:** KITT's eigen onboarding API key.

**Technisch:**
- `USER.md` wordt aangemaakt met naam + rol
- Taal + bedrijfsnaam opgeslagen

---

#### Stap 2: API Keys & Activatie

Identiek aan smaak 3.

---

#### Stap 3: Communicatiekanaal kiezen

Identiek aan smaak 3. Alle opties beschikbaar (Slack, Teams, WhatsApp, Telegram).

---

#### Stap 4: Integraties koppelen

Identiek aan smaak 3. Optioneel maar recommended.

> Solo ondernemers hebben vaak minder tools. Mogelijk alleen een Google Workspace of Notion. KITT past zich aan.

---

#### Stap 5: Business Profile

Identiek aan smaak 3. Gesprek met controlevragen → BUSINESS.md.

> Bij solo ondernemers is het bedrijf vaak nauw verweven met de persoon. KITT kan hier doorvragen: *"Is [bedrijfsnaam] jij als eenmanszaak, of heb je een BV?"*

---

#### Stap 6: Persoonlijke Setup

Identiek aan smaak 3. Kort en praktisch — één kernvraag.

> **Geen team setup** — die stap slaat KITT over. Van business profile direct naar persoonlijke setup.

---

#### Stap 7: Eerste Taak & Doorverwijzing

Identiek aan smaak 3.

Na stap 7:
- Reflectie skills worden geactiveerd (kitt + user + business — NIET team)
- KITT is volledig operationeel

### Wanneer is onboarding "klaar"?

- [x] USER.md bestaat met naam, rol, taal, voorkeuren
- [x] API keys actief (Anthropic OAuth + OpenAI key)
- [x] Main communicatiekanaal gekozen en werkend
- [x] BUSINESS.md bestaat met bedrijfsprofiel (door user gevalideerd)
- [x] Reflectie skills geactiveerd (kitt + user + business)

---

## Smaak 3: Team Member

**Case:** Jonathan bij OPG. Teamleider. Wil KITT als persoonlijke assistent, maar ook in de context van zijn team en bedrijf.

### Wie zet dit op?

Jonathan zelf (self-service). Als een admin het doet, doorloopt die dezelfde flow.

### Kernprincipe: Gesprek met Controlevragen

De onboarding is geen automatisch proces dat assumpties maakt. Het is een **intuïtief gesprek** waarin KITT tussendoor checkt:
- *"Is dit de juiste website?"*
- *"Klopt dit?"*
- *"Mis ik iets?"*

Liever een vraag te veel dan een fout profiel.

### Onboarding Flow

#### Stap 1: Kennismaking

KITT stelt zich voor en stelt basisvragen:
- **Wie ben je?** (naam)
- **Wat is je rol?**
- **Voor welk bedrijf werk je?**
- **In welke taal wil je communiceren?** (default: Engels)

> **UX:** Open gesprek. KITT kan doorvragen als iets onduidelijk is. Voelt als een eerste kennismaking met een nieuwe collega.

> **Draait op:** KITT's eigen onboarding API key. Beperkt tot onboarding skill.

**Technisch:**
- `USER.md` wordt aangemaakt met naam + rol
- Taal wordt opgeslagen (TODO: waar precies? config of USER.md?)
- Bedrijfsnaam wordt opgeslagen (nodig voor latere stappen)

---

#### Stap 2: API Keys & Activatie

KITT: *"Om je goed te kunnen helpen heb ik twee dingen nodig: een Anthropic account (voor mijn denkvermogen) en een OpenAI key (voor mijn geheugen)."*

Twee keys:
- **Anthropic (Claude)** — OAuth koppeling voor de LLM (denken, redeneren, browser, skills)
- **OpenAI** — API key voor embeddings + classifier

KITT legt uit waarvoor elke key nodig is. User koppelt/vult in via de chat (OAuth link voor Anthropic, invulveld voor OpenAI key).

Na activatie:
- Switch van KITT's onboarding key → user's eigen keys
- KITT heeft nu **full capabilities** (browser, embeddings, alle skills)
- Onboarding gaat verder, maar nu op de user's keys

> **Waarom zo vroeg?** De business profile skill (stap 4) gebruikt browser scraping (Opus) en embeddings (OpenAI). Zonder keys kan KITT dat niet.

**Technisch:**
- Anthropic: OAuth flow via Nango
- OpenAI: API key invoer + validatie
- Keys opslaan in config (encrypted)
- Na validatie: switch actieve keys, unlock alle skills

---

#### Stap 3: Communicatiekanaal kiezen

KITT: *"Waar wil je dat ik met je communiceer? Dit wordt het kanaal waar ik je updates en berichten stuur."*

Drie opties:

| Kanaal | Setup |
|--------|-------|
| **Slack DM** | Slack is al gekoppeld (of wordt nu gekoppeld) → KITT stuurt DMs |
| **Teams** | Microsoft Teams koppelen → KITT stuurt DMs |
| **WhatsApp** | Nieuw nummer aanmaken voor KITT (eigen nummer, alleen user ↔ KITT) of bestaand WhatsApp koppelen |
| **Telegram** | KITT helpt user om een Telegram bot aan te maken (stap-voor-stap in de chat) |

> **Multi-channel:** KITT kan op meerdere kanalen tegelijk praten. Het is EN/EN, niet OF/OF. Maar de user kiest **één main kanaal** — daar stuurt KITT proactieve updates naartoe (think loop, dagelijkse rapporten, reminders).

KITT begeleidt de setup van het gekozen kanaal:
- **Slack:** OAuth koppeling (als nog niet gedaan) + DM testen
- **WhatsApp:** Nieuw nummer → QR code scannen, of bestaand → koppelen. Bij bestaand: privacy vragen (TODO: wat mag KITT lezen?)
- **Telegram:** KITT loopt stap-voor-stap door bot aanmaken via @BotFather

Na setup: KITT stuurt een testbericht op het gekozen kanaal. *"Kun je dit lezen? Dan werkt het!"*

**Technisch:**
- Main kanaal opslaan in config (welk kanaal voor proactieve berichten)
- Per kanaal: adapter configureren (Slack, WhatsApp, Telegram)
- Telegram: bot token opslaan na aanmaak
- WhatsApp: TODO — privacy model bij bestaand nummer (wat mag KITT lezen?)

---

#### Stap 4: Integraties koppelen

KITT: *"Ik ga zo je bedrijf leren kennen. Als je tools koppelt waar bedrijfsinformatie in staat, kan ik een veel beter beeld vormen."*

KITT toont suggesties met klikbare OAuth links inline in de chat:

| Tool | Waarom |
|------|--------|
| **Notion** | Wiki, documentatie, kennisbank |
| **Slack** | Channels, communicatie, teamdynamiek |
| **Asana** | Projecten, taken, prioriteiten |

Per tool: user klikt link → OAuth flow in nieuw tabblad → autoriseert → komt terug in chat.

Na elke koppeling bevestigt KITT: *"Notion is gekoppeld! Ik zie [X workspaces/pages]."*

Daarna: *"Zijn er nog andere tools waar handige info over je bedrijf in staat? Of zullen we beginnen?"*

> **Optioneel:** User kan stap 3 overslaan. Business profile draait dan puur op web research. Minder rijk, maar werkt.

**Technisch:**
- OAuth flows via Nango (bestaande infra)
- KITT genereert URLs die direct naar de juiste OAuth consent page linken
- Koppelingen worden opgeslagen in integratie config
- Na koppeling: snelle check (bijv. "ik zie 3 Notion workspaces")

---

#### Stap 5: Business Profile

Dit is een **gesprek**, geen background task. KITT en de user werken samen aan het bedrijfsprofiel.

**Fase A: Informatie verzamelen**

KITT vraagt: *"Wat is de website van [bedrijf]?"*

KITT checkt: *"Ik zie [website]. Is dit correct?"*

KITT vraagt: *"Waar kan ik nog meer informatie vinden? LinkedIn? Een 'Over ons' pagina? Specifieke Notion pagina's?"*

User wijst KITT de weg. KITT maakt geen assumpties over waar info staat.

**Fase B: Onderzoek (duurt even)**

KITT gaat op onderzoek met alle beschikbare tools:
- **Browser:** Website doorlopen, "Over ons", team pagina, producten, blog
- **Web search:** LinkedIn company page, nieuwsartikelen, persberichten
- **Notion** (als gekoppeld): Wiki, documentatie, kennisbank doorzoeken
- **Slack** (als gekoppeld): Channel namen en beschrijvingen ophalen
- **Asana** (als gekoppeld): Projecten en teams ophalen

> **Duurt minuten** — browser scraping kost tijd. KITT geeft tussendoor updates: *"Ik ben nu jullie website aan het doorlezen..."*, *"Ik kijk even op LinkedIn..."*

**Fase C: Controlevragen**

KITT komt terug met bevindingen en checkt:
- *"Ik zie dat jullie [X] en [Y] doen. Klopt dat?"*
- *"Jullie zitten in de [sector] sector?"*
- *"Ik heb [X] medewerkers gevonden op de website. Is dat actueel?"*

User corrigeert, bevestigt, vult aan.

**Fase D: Profiel genereren**

KITT genereert `BUSINESS.md` op basis van alle verzamelde + bevestigde informatie.

Toont samenvatting: *"Dit is het profiel dat ik heb gemaakt. Wil je het zien? Mis ik iets?"*

**Technisch:**
- Business profile skill draait (bestaande skill, uitbreiden met integratie-bronnen)
- `BUSINESS.md` wordt aangemaakt in `profile/user/`
- Iteratief proces: verzamelen → checken → aanvullen → genereren
- User feedback direct verwerken in BUSINESS.md

---

#### Stap 6: Team Setup

KITT kent nu het bedrijf. Nu het team.

KITT vraagt: *"Waar kan ik meer vinden over je team? Op de website? In Notion? Of vertel je het liever zelf?"*

Bronnen combineren:
- **Website:** "Over ons" / "Team" pagina (vaak al gevonden in stap 4)
- **Notion** (als gekoppeld): Team wiki, organogram
- **Slack** (als gekoppeld): Workspace members, channels
- **Asana** (als gekoppeld): Team members
- **User zelf:** Vertelt in de chat

KITT combineert bronnen en stelt controlevragen:
- *"Ik heb [X] teamleden gevonden. Klopt dit?"*
- *"[Naam] doet [rol] — is dat juist?"*
- *"Mis ik iemand?"*

**Technisch:**
- Team sectie in `USER.md` wordt aangevuld (naam, rol, basale info)
- Bronnen: website, Slack API, Notion, Asana, user input
- User kan corrigeren en aanvullen

---

#### Stap 7: Persoonlijke Setup

KITT kent nu het bedrijf en het team. Nu Jonathan zelf. **Kort en praktisch** — niet te veel uitvragen.

KITT vraagt één kernvraag: *"Hoe kan ik je het beste helpen? Wat zijn dingen die je kwijt wilt?"*

KITT sluit af met: *"De rest leer ik vanzelf door met je samen te werken. Hoe meer we samenwerken, hoe beter ik je leer kennen."*

> **Waarom kort?** De `user-reflection` skill draait dagelijks en bouwt het profiel organisch op. Na een week weet KITT veel meer over communicatiestijl, werkpatronen en voorkeuren dan een intake gesprek ooit kan opleveren.

**Technisch:**
- `USER.md` wordt verrijkt met initiële use cases
- Verdere verrijking via `user-reflection` skill (dagelijks, automatisch)

---

#### Stap 8: Eerste Taak & Doorverwijzing

KITT: *"Ik ben klaar! Wil je iets uitproberen?"*

KITT kan suggesties doen op basis van wat hij nu weet:
- *"Je kunt me vragen stellen over [bedrijf]"*
- *"Ik kan je helpen met [use case die user noemde in stap 6]"*
- *"Als je meer tools wilt koppelen, zeg het gewoon — ik help je er doorheen"*

> **UX:** Geeft de user direct een succesmoment. Geen "lees de handleiding" maar meteen doen.

> **Chat-first configuratie:** Na onboarding blijft de chat de primaire manier om KITT te configureren. User zegt "ik wil Gmail koppelen" → KITT begeleidt de setup, stelt slimme vragen (lezen/schrijven? hoe vaak checken? tasks aanmaken?). Portal integrations-pagina bestaat als fallback voor direct beheer.
>
> → **Aparte brainstorm:** `chat-first-configuration.md` — UX van configureren via chat, permissions model, task creation vanuit gesprek.

Na stap 8:
- Reflectie skills worden geactiveerd (kitt + user + business + team)
- KITT is volledig operationeel

### Wanneer is onboarding "klaar"?

- [x] USER.md bestaat met naam, rol, taal, voorkeuren
- [x] API keys actief (Anthropic OAuth + OpenAI key)
- [x] Main communicatiekanaal gekozen en werkend (Slack/WhatsApp/Telegram)
- [x] BUSINESS.md bestaat met bedrijfsprofiel (door user gevalideerd)
- [x] Team sectie in USER.md heeft minstens 1 teamlid
- [x] Minstens 1 integratie gekoppeld (of bewust overgeslagen)
- [x] Reflectie skills geactiveerd

---

## Smaak 4: Digital Employee

**Case:** KITT wordt toegevoegd als digitale medewerker bij een bedrijf. Geen specifieke eigenaar — meerdere mensen praten met KITT.

### Wie zet dit op?

Een **admin** (IT, manager, of consultant). Niet een eindgebruiker. De admin configureert KITT voor het hele team.

### Kernverschillen met Smaak 3

| | Smaak 3 (Team Member) | Smaak 4 (Digital Employee) |
|---|---|---|
| **Wie onboardt** | De user zelf | Een admin |
| **Primaire user** | Ja (Jonathan) | Nee — KITT is van het team |
| **USER.md** | Persoonlijk profiel + team | Alleen team (geen persoonlijk) |
| **Persoonlijke setup** | Ja (stap 7) | Vervalt |
| **Communicatiekanaal** | Persoonlijk (Telegram/WhatsApp/Slack DM) | Bedrijfsbreed (Slack/Teams) |
| **Reflectie skills** | kitt + user + business + team | kitt + business + team (geen user) |

### Onboarding Flow

Zelfde kernprincipe: **gesprek met controlevragen**. Maar de admin praat namens het bedrijf, niet namens zichzelf.

#### Stap 1: Kennismaking

KITT: *"Welkom! Ik ga straks als digitale medewerker aan de slag voor jullie bedrijf. Laten we beginnen — voor welk bedrijf ga ik werken?"*

Basisvragen:
- **Welk bedrijf?** (naam)
- **Wat is jouw rol?** (admin, IT, manager — om te weten wie KITT configureert)
- **In welke taal moet ik communiceren?** (default: Engels)

> **Verschil met smaak 3:** Niet "wie ben jij" maar "voor wie ga ik werken". De admin is niet de eindgebruiker.

> **Draait op:** KITT's eigen onboarding API key.

**Technisch:**
- Admin wordt genoteerd (naam + rol) maar niet als primaire user
- Bedrijfsnaam + taal opgeslagen

---

#### Stap 2: API Keys & Activatie

Identiek aan smaak 3. Admin vult in:
- **Anthropic (Claude)** — OAuth koppeling
- **OpenAI** — API key voor embeddings + classifier

Na activatie: KITT heeft full capabilities.

---

#### Stap 3: Communicatiekanaal

KITT: *"Hoe gaat het team met mij communiceren?"*

Bij digital employee is het kanaal typisch **bedrijfsbreed**, maar alle opties zijn beschikbaar:

| Kanaal | Typisch voor |
|--------|-------------|
| **Slack** | Bedrijf gebruikt Slack → KITT als user in workspace |
| **Teams** | Bedrijf gebruikt Teams → KITT als user in Teams |
| **WhatsApp** | Nieuw nummer voor KITT of bestaand koppelen |
| **Telegram** | KITT als Telegram bot |

> **Typisch:** Slack of Teams als main kanaal, maar WhatsApp/Telegram zijn ook mogelijk.

KITT wordt toegevoegd als user (niet bot) aan het workspace. Admin koppelt dit.

**Technisch:**
- Slack of Teams OAuth koppeling
- KITT als workspace user configureren
- Main kanaal = het bedrijfsplatform

---

#### Stap 4: Integraties koppelen

Identiek aan smaak 3. Admin koppelt tools waar bedrijfsinformatie in staat:
- Notion, Asana, en eventueel andere tools
- Slack/Teams is al gekoppeld in stap 3

---

#### Stap 5: Business Profile

Identiek aan smaak 3. Gesprek met controlevragen:
- Website vragen + checken
- Onderzoek met alle tools
- Controlevragen
- BUSINESS.md genereren

> Bij digital employee is BUSINESS.md nog belangrijker — het is de kern van KITT's context (er is geen persoonlijk profiel).

---

#### Stap 6: Team Setup

**Uitgebreider dan smaak 3** — het hele team zijn straks KITT's "users".

KITT: *"Wie zitten er allemaal in het team? Ik wil iedereen leren kennen."*

Bronnen:
- **Slack/Teams:** Alle workspace members ophalen
- **Website:** Team pagina
- **Notion** (als gekoppeld): Team wiki, organogram
- **Asana** (als gekoppeld): Team members
- **Admin:** Vertelt in de chat, corrigeert

KITT bouwt per teamlid een basisprofiel (naam, rol, team/afdeling).

Controlevragen: *"Ik zie [X] mensen in het Slack workspace. Zijn dit allemaal teamleden? Wie zijn de key people die ik moet kennen?"*

> **Verschil met smaak 3:** In smaak 3 is het team "context" voor Jonathan. In smaak 4 zijn het team de daadwerkelijke gebruikers van KITT. De profielen groeien organisch via `team-reflection`.

**Technisch:**
- `USER.md` bevat alleen team (geen persoonlijk profiel, geen primaire user)
- Per teamlid: naam, rol, afdeling
- Verdere verrijking via `team-reflection` skill

---

#### Stap 7: KITT's Rol Definiëren

In smaak 3 vraagt KITT "hoe kan ik JOU helpen?". In smaak 4 is de vraag: **"Wat is mijn rol in het bedrijf?"**

KITT vraagt de admin:
- *"Waarvoor wil je dat ik word ingezet?"*
- *"In welke channels mag ik actief zijn?"*
- *"Mag ik proactief reageren, of alleen als mensen mij aanspreken?"*

Dit bepaalt KITT's gedrag:
- **Read-only mode:** KITT leest mee, reageert niet (fase 2 uit OPG brainstorm)
- **Reactive mode:** KITT reageert als aangesproken
- **Proactive mode:** KITT mag zelf initiatief nemen

> **UX:** De admin bepaalt de "volume knop" van KITT in het bedrijf.

**Technisch:**
- KITT's modus opslaan in config (read-only / reactive / proactive)
- Channel permissions: in welke channels mag KITT actief zijn
- Opslaan in `BUSINESS.md` onder "KITT's Rol"

---

#### Stap 8: Eerste Taak & Go Live

KITT: *"Ik ben klaar! Ik ken het bedrijf, het team, en ik weet wat mijn rol is."*

Afhankelijk van de gekozen modus:
- **Read-only:** *"Ik ga nu meelezen. Over [X weken] weet ik veel meer over het bedrijf."*
- **Reactive:** *"Het team kan me nu aanspreken in [channels]. Probeer het!"*
- **Proactive:** *"Ik ga aan de slag. Ik stuur updates in [main channel]."*

Na stap 8:
- Reflectie skills worden geactiveerd (kitt + business + team — NIET user)
- KITT is operationeel in de gekozen modus

### Wanneer is onboarding "klaar"?

- [x] API keys actief (Anthropic OAuth + OpenAI key)
- [x] Communicatiekanaal gekoppeld (Slack/Teams)
- [x] BUSINESS.md bestaat met bedrijfsprofiel (door admin gevalideerd)
- [x] Team in USER.md (minstens key people)
- [x] KITT's rol en modus gedefinieerd (read-only / reactive / proactive)
- [x] Reflectie skills geactiveerd (kitt + business + team)

---

## Cross-cutting: Gedeelde Onboarding Stappen

TODO: Welke stappen zijn hetzelfde voor beide smaken? (bijv. business profile skill draaien)

---

## Requirements / Nog te bouwen

- [ ] **Main communicatiekanaal per user variabel instellen** — dit bestaat nog niet. Moet configureerbaar zijn: welk kanaal krijgt proactieve berichten? Moet runtime wijzigbaar zijn (user kan switchen).

## Open Vragen

- [ ] Hoe lang duurt een onboarding realistisch?
- [ ] Wat als integraties (Slack, Notion) niet beschikbaar zijn?
- [ ] Privacy: wie geeft toestemming dat KITT meeleest?
- [ ] WhatsApp: privacy model bij bestaand nummer koppelen — wat mag KITT lezen?

---

*Dit is een levend document — we vullen het samen aan tijdens de brainstorm.*
