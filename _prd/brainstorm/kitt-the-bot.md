# KITT Labs — Personal AI Systems

> Brainstorm: 9 feb 2026

## Bedrijf & Product

| Wat | Naam | Domein |
|-----|------|--------|
| **Bedrijf** | KITT Labs | kittlabs.ai |
| **Product** | KITT | kitt-the.bot |
| **Email** | — | hello@kitt-the.bot |

**Tagline ideeën:**
- "See what's under the hood" (KITT = auto, letterlijk)
- "Meet KITT, the bot"
- "Your personal AI, locally."

---

## Het idee

Een service waarbij we custom personal AI systems bouwen voor mensen en bedrijven. Gebaseerd op de KITT-stack die we al hebben, maar dan als product.

## Twee modellen

### 1. Out-of-the-box
- Pre-geconfigureerde Mac Mini (of MacBook) met de hele KITT-stack
- Plug & play: aanzetten, Telegram koppelen, klaar
- Skills via een interface/API zelf toevoegen
- Standaard set skills (reminders, calendar, memory, etc.)

### 2. Custom
- Op maat gebouwd voor specifieke use cases
- Custom skills, integraties, workflows
- Bedrijf-specifieke context en data

## Platform

### Harde vereiste
- **VS Code + Claude Code extension** — dit is de engine, zonder dit werkt niks

### Ondersteunde platformen

| Platform | Status | Notes |
|----------|--------|-------|
| **macOS (Mac Mini)** | ✅ Primair | Ideaal: always-on, stil, native Apple integraties (Reminders, Calendar via osascript) |
| **macOS (MacBook)** | ✅ Ondersteund | Minder ideaal voor always-on, maar werkt |
| **Windows** | ✅ Mogelijk | VS Code + Claude Code werkt op Windows. Geen Apple-native integraties, maar Gmail/CRM/Slack/etc. werkt allemaal |
| **Linux** | ✅ Mogelijk | Zelfde als Windows — core werkt, Apple-specifieke skills niet |

### Hardware opties voor klanten

| Optie | Beschrijving |
|-------|-------------|
| **"Ik koop een Mac Mini via jullie"** | Wij pre-configureren, klant sluit aan, klaar |
| **"Ik heb eigen hardware"** | Wij installeren remote (TeamViewer/Tailscale), klant heeft al een Mac/PC |

**Note:** Apple-native integraties (Reminders, Calendar via osascript) zijn macOS-only. Op Windows/Linux worden die vervangen door de OAuth-versies (Google Calendar, etc.).

## Installatie modellen

| Model | Hoe | Privacy | Effort |
|-------|-----|---------|--------|
| **Remote install** | Klant zet device aan, wij verbinden via TeamViewer/AnyDesk. Klant toetst zelf wachtwoorden in. | Goed — wij zien geen credentials | Laag |
| **Ship to us** | Klant stuurt device op, wij configureren, shippen terug | Matig — device is bij ons | Midden |
| **New device** | Wij bestellen Mac Mini, configureren, shippen naar klant | Matig — device is bij ons | Hoog (maar premium feel) |
| **Self-install** | Script/installer die klant zelf draait | Best — alles lokaal | Laag effort voor ons, meer support nodig |

### Remote install (voorkeur?)

Voordelen:
- Klant houdt device in eigen handen
- Wachtwoorden/logins worden door klant zelf ingevuld
- Geen shipping kosten/risico
- Snelle turnaround (kan in een sessie van 1-2 uur)

Nadelen:
- Afhankelijk van klant's beschikbaarheid
- Soms technische issues met remote tools
- Klant moet aanwezig zijn voor auth-stappen

## API kosten

**Niet ons probleem.** Klant neemt eigen Anthropic/Claude account (~$200/maand max). Wij koppelen die key aan het systeem. Klaar.

## Businessmodel

### Waar verdien je aan?

| Revenue stream | Beschrijving | Eenmalig / Recurring |
|---------------|-------------|---------------------|
| **Setup fee** | Installatie + configuratie + onboarding | Eenmalig |
| **Skill development** | Custom skills bouwen voor de klant | Eenmalig (per skill) |
| **Support/maintenance** | Updates, troubleshooting, optimalisatie | Recurring (maandelijks) |
| **Skill packs** | Pre-built skill bundels (Creator, Business, etc.) | Eenmalig (per pack) |
| **Training/consulting** | Klant leren hoe ze zelf skills maken / systeem optimaliseren | Eenmalig (per sessie) |
| **Hardware markup** | Als je Mac Minis levert: inkoopprijs + marge | Eenmalig |

### Mogelijke modellen

**Model A: Servicebureau**
- Setup fee: €500-1500 (afhankelijk van complexiteit)
- Custom skills: €200-500 per skill
- Support: €50-150/maand
- Jij bent de "AI architect" die het bouwt en onderhoudt
- Schaal: beperkt door jouw tijd

**Model B: Product + Service**
- Out-of-the-box systeem: €299-599 eenmalig (software license)
- Skill marketplace: community + premium skills
- Support tiers: gratis (community) / €49/maand (priority) / €149/maand (dedicated)
- Schaal: beter, maar vereist meer productisatie

**Model C: Consulting + Implementatie**
- Focus op bedrijven
- Dagrate consulting: €800-1200/dag
- Implementatie projecten: €2000-10000
- Ongoing retainer: €500-2000/maand
- Minder klanten, hogere waarde per klant

**Model D: Hybrid (waarschijnlijk de beste start)**
- Begin als servicebureau (Model A) → bewijs de waarde
- Parallel productiseren → installer, skill packs, docs
- Groei naar product + service (Model B) zodra je 10+ installaties hebt
- Enterprise/custom blijft als premium track (Model C)

### Pricing gedachte (v1 — start simpel)

```
Setup:    €750 (remote install, 2 uur sessie, onboarding)
Support:  €75/maand (updates, troubleshooting, kleine aanpassingen)
Custom:   €300/skill (maatwerk skills op aanvraag)

Klant betaalt zelf:
- Hardware (eigen Mac of wij leveren tegen inkoopprijs + €100)
- Claude API (~€100-200/maand, eigen account)
```

## Architectuur-principes voor klanten

### Klant = skill-laag, Core = ons domein

```
┌─────────────────────────────────────────┐
│  KLANT DOMEIN (self-service)            │
│  • .claude/skills/ — eigen skills       │
│  • profile/ — identity, user, memory    │
│  • Skill packs installeren              │
│  • SKILL.md schrijven = skill bouwen    │
└─────────────────────────────────────────┘
          ▲ veilige grens
┌─────────────────────────────────────────┐
│  CORE (alleen wij)                      │
│  • src/ — bridge, scheduler, memory     │
│  • Think Loop engine                    │
│  • Task Engine                          │
│  • Telegram/channel adapters            │
│  • Updates via ons (git pull / remote)  │
└─────────────────────────────────────────┘
```

**Het skill-systeem IS de product-interface.** Een klant hoeft alleen een SKILL.md te schrijven met de juiste metadata en instructies. Claude leest die file en weet wat hij moet doen. Geen code, geen API's, geen deployments.

**Wat klanten WEL doen:**
- Skills schrijven/installeren (SKILL.md files in `.claude/skills/`)
- Identity aanpassen (naam, persoonlijkheid, toon)
- User profiel invullen (context over zichzelf)
- Skills van een marketplace installeren (copy folder)

**Wat klanten NIET aanraken:**
- `src/` — de hele engine
- Think Loop configuratie (behalve registry.json voor model keuze)
- Database schema
- Bridge/channel code

**Risico:** Klant rommelt toch in de core → systeem kapot. Mitigatie:
- Core in een protected directory of read-only voor de klant
- Of: core als npm package / binary dat apart geupdate wordt
- Of: simpelweg goede documentatie + "als je hier aankomt bel je ons"

### Skills als product

De kracht is dat skills bouwen **geen code vereist**. Een SKILL.md is gewoon een markdown file met:
1. Metadata (trigger, schedule, emoji)
2. Instructies in natural language
3. Eventueel bash/SQL commands die Claude kan uitvoeren

Dat betekent: klanten die een beetje technisch zijn kunnen zelf skills schrijven. En voor de rest bouwen wij ze (€300/skill) of komen ze van een marketplace.

## Repo-structuur: twee repo's

### 1. `kit` (private — onze development repo)
- Alles wat we nu hebben: src/, skills, prd, etc.
- Hier ontwikkelen wij
- Niet direct zichtbaar voor klanten

### 2. `kit-distro` (private — distributie repo)
- Gebouwde/gepackagede core (compiled JS, geen TypeScript)
- Standaard skill packs
- Installer scripts
- Documentatie voor eindgebruikers
- Klanten krijgen toegang tot deze repo (read-only of fork)

```
kit (dev)                      kit-distro (klant)
├── src/ (TypeScript)          ├── core/ (compiled, read-only)
├── _prd/                      ├── skills/ (klant mag aanpassen)
├── .claude/skills/            ├── profile/ (klant mag aanpassen)
└── ...                        ├── install.sh
                               ├── update.sh
                               └── docs/
```

## Distributie & Updates

### Twee soorten updates

| Type | Wat | Hoe | Risico voor klant |
|------|-----|-----|-------------------|
| **Core update** | Engine, Think Loop, bridge, etc. | Pull van distro repo → overschrijft core/ | Geen — hun customisaties zitten in skills/ en profile/ |
| **Skill update** | Nieuwe/verbeterde standaard skills | Pull, maar ALLEEN nieuwe skills. Bestaande niet overschrijven | Geen — hun eigen skills worden niet aangeraakt |
| **Custom skill push** | Jij bouwt iets voor een klant | TeamViewer sessie OF push naar hun fork | Geen — het is een nieuwe file |

### Update mechanisme (v1 — simpel)

```bash
# update.sh — draait op klant's machine
#!/bin/bash

# Pull alleen core updates (niet skills/profile)
git fetch origin
git checkout origin/main -- core/

# Rebuild
npm install --production
pm2 restart kitt

echo "✅ Updated to $(git log --oneline -1 core/)"
```

**Sleutel:** De directory-structuur beschermt klant-data. `core/` wordt overschreven bij updates. `skills/` en `profile/` worden NOOIT aangeraakt door updates.

### Update notificatie

De AI zelf kan dit doen. Skill idee:

```markdown
# Update Checker (every_time skill)
- Check of er een nieuwe versie beschikbaar is (git fetch --dry-run of version API)
- Als ja → stuur bericht: "Hey, er is een update beschikbaar. Wil je dat ik die installeer?"
- User zegt ja → voer update.sh uit
- User zegt nee → snooze voor 24 uur
```

De klant's eigen AI meldt dat er een update is. Dat past bij de hele filosofie.

### Hoe custom skills bouwen voor klanten

**Twee workflows:**

**Workflow A: Blind bouwen (standaard)**
1. Klant beschrijft wat ze willen (Telegram/call/email)
2. Jij schrijft de SKILL.md lokaal (op je eigen machine, geen klant-data nodig)
3. Test met mock data
4. Push naar klant's distro fork OF stuur de file
5. Klant's AI pikt het automatisch op
6. Klant test → feedback → iterate

**Workflow B: Remote sessie (voor debugging/complexe skills)**
1. Klant geeft TeamViewer toegang (zij moeten expliciet allowen)
2. Klant is aanwezig (ziet wat je doet)
3. Jij bouwt/debugt de skill live op hun systeem
4. Klant toetst zelf credentials in waar nodig
5. Sessie klaar → TeamViewer uit

**Waarom Workflow A meestal genoeg is:**
Een SKILL.md is gewoon markdown met instructies. Er zit geen klant-data in. De klant's Claude leest de instructies en past ze toe op hún context. Je hoeft hun data niet te zien om een goede skill te schrijven.

## Core bescherming

### Het probleem

Klant's Claude (hun bot) heeft toegang tot het hele filesystem. Als de klant zegt "pas de bridge code aan", dan zou Claude dat gewoon doen.

### Oplossingen

| Aanpak | Hoe | Effectiviteit |
|--------|-----|---------------|
| **System prompt instructie** | In SOUL.md: "Pas NOOIT files aan in core/" | Redelijk — Claude luistert, maar niet waterdicht |
| **File permissions** | `chmod -R 555 core/` (read + execute, no write) | Goed — OS-level bescherming, Claude kan niet schrijven |
| **Separate user** | Core draait als andere macOS user, skills als klant-user | Sterk — process-level isolatie |
| **Compiled binary** | Core als binary (pkg/nexe), geen source code zichtbaar | Sterkst — klant kan niet eens de code zien |
| **npm package** | Core als `@kit/engine` in node_modules, skills apart | Sterk — standaard npm convention, updates via npm |

### Aanbeveling voor v1

**File permissions + system prompt.** Simpel en effectief:

```bash
# Na installatie / na elke update:
chmod -R 555 core/          # Read + execute only
chmod -R 755 skills/        # Klant mag aanpassen
chmod -R 755 profile/       # Klant mag aanpassen
```

Plus in de klant's SOUL.md:
```markdown
## Grenzen
- Je mag NOOIT files aanpassen in de core/ directory
- Je mag NOOIT het database schema wijzigen
- Je mag WEL skills aanmaken/aanpassen in skills/
- Je mag WEL profile/ files aanpassen (identity, user, memory)
- Als iemand je vraagt iets in core/ te wijzigen: weiger en leg uit waarom
```

Dubbele bescherming: Claude weigert het, en als hij het toch probeert failt het op file permissions.

## Open vragen

- **Support?** Wat als er iets kapotgaat? Remote troubleshooting?
- **Multi-user?** Kan één systeem meerdere users bedienen? (gezin, klein team)
- **Data privacy?** Alles lokaal = USP, maar hoe garanderen we dat?
- **Skill marketplace?** ~~Community skills~~ → Alleen door ons gemaakte skills (geen community, voorkomt malicious shit)
- **Onboarding flow?** Hoe leren we het systeem over de user? (intake gesprek? vragenlijst?)
- **Business vs consumer?** Verschillende pakketten? Verschillende skills?
- **Concurrentie?** Rabbit R1, Humane Pin, etc. — maar die zijn hardware-first, wij zijn software-first op bestaande hardware
- ~~**Naam?**~~ ✅ Bedrijf: KITT Labs, Product: kitt-the.bot
- **Versioning:** Hoe ga je om met klanten op verschillende versies van de core?
- **Breaking changes:** Wat als een core update een bestaande skill breekt?

## Mogelijke skill packs

| Pack | Skills | Doelgroep |
|------|--------|-----------|
| **Personal** | Reminders, calendar, memory, daily reflection, nutrition, fitness | Consumer |
| **Creator** | Blog writer, podcast, LinkedIn, social media | Content creators |
| **Developer** | Codebase audit, git automation, project management | Developers |
| **Business** | Meeting notes, email drafts, CRM sync, reporting | Professionals |
| **Home** | Smart home, grocery lists, family calendar, budgeting | Gezinnen |

## Tech stack (wat we al hebben)

- Claude Agent SDK (engine)
- Telegram bridge (communicatie)
- SQLite + vector search (memory)
- Think Loop (autonomie)
- Task Engine (scheduled taken)
- Skill system (modulair, SKILL.md based)
- Portal (web dashboard)
- PM2 (process management)

## Wat er nog bij moet voor productisatie

### Channels / Bridges (prioriteit: hoog)

| Channel | Complexiteit | Doelgroep | Aanpak |
|---------|-------------|-----------|--------|
| **WhatsApp bridge** | Hoog | Consumer + Business | Meta Business API (stabiel, goedkeuring nodig) of Baileys/whatsapp-web.js (sneller, minder stabiel) |
| **Slack bridge** | Laag-Midden | Business | Slack Bot API, goede docs, events API voor real-time |
| **Email bridge** | Midden | Iedereen | Gmail API of IMAP/SMTP. Lezen + drafts, NIET direct sturen (veiligheidsgrens) |
| **SMS** | Laag | Niche | Twilio API, simpel maar minder relevant in NL/EU |

**Architectuur:** Channel adapter pattern — elke bridge implementeert dezelfde interface (ontvang bericht, stuur bericht). Core hoeft niet te weten welk kanaal het is.

### Integraties (als skill packs)

| Integratie | Aanpak | Skill pack |
|-----------|--------|------------|
| **Apple Calendar** | osascript (zelfde pattern als Reminders) | Personal |
| **Google Calendar** | OAuth2 + Calendar API | Personal / Business |
| **Email (Gmail)** | Gmail API, inbox monitoring + draft writing | Personal / Business |
| **CRM (HubSpot)** | HubSpot API, contacts + deals + notes | Business |
| **CRM (Pipedrive)** | Pipedrive API | Business |
| **CRM (Salesforce)** | Salesforce REST API (complexer) | Enterprise |
| **Notion** | Notion API, pages + databases sync | Creator / Personal |
| **Obsidian** | Local vault, markdown files | Creator / Personal |
| **Google Sheets** | Sheets API, data in/out | Business |
| **Zapier/Make** | Webhook triggers, universele connector | Alle |

**Filosofie:** Elke integratie is een skill (SKILL.md + eventueel een helper script). Geen core wijzigingen nodig.

### OAuth & Integratie Strategie: Nango

**Probleem:** Klanten laten zelf OAuth apps aanmaken is onrealistisch. Zelf een OAuth server bouwen kost weken en je moet per service een app registreren + verifiëren.

**Oplossing:** Nango (nango.dev) — bestaand platform dat OAuth + API integraties als service aanbiedt. Zelfde model als Zapier/Make gebruiken onder de motorkap.

#### Waarom Nango

| Aspect | Zelf bouwen | Nango |
|--------|------------|-------|
| OAuth apps per service registreren | Weken werk, verification proces | Al gedaan, 600+ APIs |
| Token refresh & storage | Zelf bouwen | Inbegrepen |
| Nieuwe service toevoegen | OAuth app + code | Config |
| Token expired/invalid detectie | Zelf bouwen | Inbegrepen |
| Kosten | Dev-uren | $0-50/maand (start) |
| Time to market | Weken | Uren |

#### Hoe het werkt

```
Klant's Mac                          Nango                         Google/Slack/HubSpot/etc.
─────────────                        ──────                        ──────────────────────────
Portal (localhost:3000)
  │
  ├─ Klikt "Connect Gmail" ────────► Nango Connect UI (white-label)
  │                                    │
  │                                    ├─ Redirect naar Google ────► Google consent screen
  │                                    │                              │
  │                                    ◄─ Callback + token exchange ◄┘
  │                                    │
  │                                    ├─ Tokens opgeslagen bij Nango
  │                                    │
  ◄─ Connection bevestigd ◄────────────┘
  │
  └─ KITT praat met Gmail via Nango proxy
      (Nango voegt auth headers automatisch toe)
```

#### Nango Pricing

| Tier | Prijs | Connecties | Fase |
|------|-------|------------|------|
| **Free** | $0/maand | 10 | Development + eerste klant |
| **Starter** | vanaf $50/maand | meer + $1/extra | Eerste 5-10 klanten |
| **Growth** | vanaf $500/maand | veel meer | 50+ klanten |
| **Enterprise** | Custom | onbeperkt | Later |

**Kosten per klant** (bij ~5 connecties per klant):
- 1-2 klanten: **gratis** (free tier)
- 5 klanten: ~$50/maand → **$10/klant**
- 10 klanten: ~$50/maand → **$5/klant**
- 50 klanten: ~$500/maand → **$10/klant**

Makkelijk door te berekenen in de klant subscription.

#### Ondersteunde services (selectie)

Alles via Nango, klant klikt "Connect" → inloggen → klaar:

| Categorie | Services |
|-----------|---------|
| **Email** | Gmail, Outlook |
| **Calendar** | Google Calendar, Microsoft Calendar |
| **CRM** | HubSpot, Salesforce, Pipedrive |
| **Productivity** | Notion, Asana, Slack, Google Sheets |
| **Storage** | Google Drive, Dropbox, OneDrive |
| **Dev** | GitHub, Jira, Linear |
| **Communication** | Slack, Microsoft Teams |

#### Key decisions
- **Tokens bij Nango** — niet meer lokaal. Nango doet storage + refresh + invalidation
- **KITT praat via Nango proxy** — elke API call gaat via Nango die de auth afhandelt
- **Geen eigen OAuth server nodig** — bespaart weken development
- **White-label Connect UI** — klant ziet ons merk, niet Nango

### Onboarding Flow (zero-config visie)

**Doel:** Klant krijgt het systeem, sluit aan, en ALLES werkt na één setup-sessie.

```
┌─────────────────────────────────────────────────┐
│                KLANT ONBOARDING                 │
├─────────────────────────────────────────────────┤
│                                                 │
│  1. INSTALLER (wij doen dit, remote/on-site)    │
│     - install.sh draait                         │
│     - Node, PM2, SQLite opgezet                 │
│     - .env met Anthropic API key (wij vullen)   │
│     - OpenAI API key (voor embeddings)          │
│                                                 │
│  2. PORTAL SETUP (klant doet zelf)              │
│     - Open localhost:3000                       │
│     - Basisvragen: naam, timezone, taal         │
│     - Identity setup (wie ben je, wat doe je)   │
│                                                 │
│  3. CHANNELS (klant doet zelf)                  │
│     - WhatsApp: QR code scannen → klaar         │
│     - Telegram: bot token invullen → klaar      │
│     - Slack: "Connect Slack" → OAuth → klaar    │
│                                                 │
│  4. INTEGRATIES (klant doet zelf)               │
│     - "Connect Gmail" → OAuth → klaar           │
│     - "Connect Calendar" → OAuth → klaar        │
│     - "Connect HubSpot" → OAuth → klaar         │
│     - etc.                                      │
│                                                 │
│  5. SKILLS KIEZEN (klant doet zelf)             │
│     - Skill packs browsen in portal             │
│     - Klik "Install" → skill actief             │
│     - Custom skills later zelf schrijven        │
│                                                 │
│  6. KLAAR                                       │
│     - Stuur eerste bericht via WhatsApp/Telegram│
│     - AI kent je naam, voorkeuren, tools        │
│     - Think Loop draait, skills actief          │
│                                                 │
└─────────────────────────────────────────────────┘
```

**Twee niveaus van setup:**

| Wat | Wie doet het | Waarom |
|-----|-------------|--------|
| Installer + API keys (Anthropic, OpenAI) | **Wij** (remote/on-site) | Te technisch, eenmalig |
| Portal setup + channels + integraties | **Klant zelf** | OAuth clicks, QR codes, simpele vragen |
| Custom skills schrijven | **Klant zelf** (met guide) of **wij** (als service) | Hangt af van technisch niveau |

**Echt custom dingen** (API keys voor niche services, custom scripts) → dat doen wij in de initiële setup of als betaalde service.

### Management Portal (uitbreiding)

De lokale portal (localhost:3000) wordt het controlecentrum:

| Sectie | Wat je ziet |
|--------|------------|
| **Dashboard** | Status overzicht, recente activiteit, health |
| **Channels** | Connected channels + status (WhatsApp ✅, Slack ❌) |
| **Integraties** | Connected services + token status (Gmail ✅ geldig, HubSpot ⚠️ verloopt) |
| **Skills** | Geïnstalleerde skills, aan/uit toggles |
| **Identity** | Naam, persoonlijkheid, voorkeuren aanpassen |
| **Settings** | API keys, timezone, taal, Think Loop interval |
| **Logs** | Recente activiteit, errors, Think Loop ticks |

### Systeem / Infrastructuur

- [ ] **Installer script** — `install.sh` dat alles opzet (Node, PM2, SQLite, dirs, .env template, eerste skill set)
- [ ] **Health monitoring** — Heartbeat naar centrale server (klant's systeem → onze dashboard). Simpel: cron job die elke 5 min een ping stuurt
- [ ] **Remote management dashboard** — Web dashboard voor ons: alle installaties, versies, health status, last seen
- [ ] **Backup/restore** — Export: profile/ + memory db + skills/. Import: unzip en overschrijf. Kan als skill
- [ ] **Credential vault** — macOS Keychain via `security` command ipv plaintext .env. Fallback: encrypted .env
- [ ] **Multi-user support** — Meerdere Telegram users per systeem (gezin, klein team). Per-user profile/ directory
- [ ] **Error recovery** — Graceful handling bij Claude API downtime, rate limits, network issues. Retry logic + user notification
- [ ] **Logging dashboard** — Klant kan basic logs zien via portal (niet alleen PM2 logs die wij via SSH bekijken)

### Documentatie / Onboarding

- [ ] **Skill Writing Guide** — "How to write your first SKILL.md" (stap-voor-stap, voorbeelden, do's/don'ts)
- [ ] **User Onboarding Flow** — Interactief: AI stelt vragen bij eerste gebruik (naam, voorkeuren, timezone, welke skills, tone of voice)
- [ ] **Troubleshooting Guide** — Veelvoorkomende issues + fixes (PM2 crashes, API errors, skill niet gevonden)
- [ ] **Admin Guide** — Voor ons: hoe installaties beheren, updates pushen, remote troubleshooten
- [ ] **Video walkthroughs** — Korte video's voor visuele learners (skill schrijven, identity aanpassen)

### Kwaliteit / Testing

- [ ] **Test suite** — Automated tests voor core: Think Loop, Task Engine, processing lock, bridges
- [ ] **Skill validator** — CLI tool die SKILL.md checkt op correcte metadata, syntax, etc.
- [ ] **Canary updates** — Eerst op ons eigen systeem testen, dan pas naar klanten pushen

### Prioritering (mijn voorstel)

**Fase 1 — MVP voor eerste klant:**
1. Installer script (zonder dit geen klant)
2. Apple Calendar integratie (laaghangend fruit, osascript)
3. WhatsApp bridge (grootste reach)
4. Skill Writing Guide (klant moet zelf skills kunnen maken)
5. User onboarding flow
6. Backup/restore

**Fase 2 — Schaalbaar maken:**
7. Health monitoring + remote dashboard
8. Slack bridge
9. Email bridge
10. Credential vault
11. Multi-user support
12. Test suite

**Fase 3 — Marketplace & Sales:**
13. Skill marketplace (curated, alleen onze skills)
14. Website configurator (sales funnel)
15. CRM skill packs
16. Notion/Obsidian integraties
17. Zapier/Make webhook connector

---

## Skills Marketplace

**Geen community marketplace.** Alleen skills die wij maken en onderhouden. Voorkomt malicious code, kwaliteitsproblemen, en support-nachtmerries.

### Hoe het werkt

```
Klant opent portal → Skills → Marketplace
  │
  ├─ Browse beschikbare skills (categorieën, zoeken)
  │   - Personal: Reminders, Calendar, Nutrition, Fitness
  │   - Creator: Blog, Podcast, LinkedIn, Social
  │   - Business: CRM sync, Meeting notes, Email drafts
  │   - Productivity: Notion, Obsidian, Google Sheets
  │
  ├─ Klik "Install" → skill.md wordt gedownload naar skills/
  │   - Inclusief eventuele helper scripts
  │   - Dependency check (bijv. "vereist Gmail integratie")
  │
  ├─ Skill is direct actief na install
  │
  └─ Updates: bij core update checken we of skills compatible zijn
```

### Waarom alleen onze skills

| Reden | Detail |
|-------|--------|
| **Security** | Wij auditen elke skill — geen malicious code, geen data exfiltratie |
| **Kwaliteit** | Wij testen elke skill — werkt gegarandeerd met huidige core versie |
| **Support** | Wij supporten elke skill — klant belt ons, niet een random community dev |
| **Verdienmodel** | Premium skills als upsell (bijv. CRM packs, advanced analytics) |

### Skill pricing (optioneel)

| Tier | Wat | Prijs |
|------|-----|-------|
| **Free** | Basis skills (reminders, calendar, memory) | Inbegrepen |
| **Standard** | Productiviteit (email, CRM basis, social) | Inbegrepen bij subscription |
| **Premium** | Geavanceerd (Salesforce, advanced analytics, custom workflows) | Extra per skill pack |

### Technisch

- Skills worden gehost als repo (git) of als download via API
- Install = download SKILL.md + scripts naar `skills/` directory
- Versioning: elke skill heeft een version nummer, compatible core versions
- Uninstall = delete skill directory

### Later: klant maakt eigen skills

Klanten mogen WEL eigen skills schrijven (dat is de kracht van het systeem). Maar die komen niet in de marketplace. Die blijven lokaal.

---

## Website Configurator (Sales Funnel)

Publieke website waar potentiële klanten hun systeem samenstellen.

### Flow

```
Bezoeker komt op website
  │
  ├─ Stap 1: Hardware
  │   ○ "Ik wil een Mac Mini via jullie" (+€699)
  │   ○ "Ik heb eigen hardware (Mac)"
  │   ○ "Ik heb eigen hardware (Windows/Linux)"
  │
  ├─ Stap 2: Channels
  │   ☑ WhatsApp
  │   ☑ Telegram
  │   ☑ Slack
  │   ☐ Email bridge
  │
  ├─ Stap 3: Integraties
  │   ☑ Gmail
  │   ☑ Google Calendar
  │   ☐ Outlook
  │   ☐ HubSpot
  │   ☐ Salesforce
  │   ☐ Notion
  │   etc.
  │
  ├─ Stap 4: Skill packs
  │   ☑ Personal (gratis)
  │   ☐ Creator
  │   ☐ Business
  │   ☐ Developer
  │
  ├─ Stap 5: Samenvatting + prijs
  │   "Mac Mini + WhatsApp + Gmail + Personal pack"
  │   Setup: €XXX | Maandelijks: €XX/maand
  │
  └─ Stap 6: Request indienen
      - Komt bij ons binnen als order/lead
      - Wij nemen contact op voor planning
```

### Wat er intern gebeurt na een request

1. Request komt binnen (webhook naar ons systeem / email / CRM)
2. Wij checken of alle gevraagde integraties/skills bestaan
3. **Integratie/skill niet beschikbaar?** → Wordt automatisch een feature request
4. Wij plannen de installatie (remote of on-site)
5. Configurator data = blauwdruk voor de installatie

### Voordeel van de configurator

- **Sales funnel** — van bezoeker naar lead in 5 klikken
- **Feature discovery** — we zien welke integraties mensen willen maar nog niet bestaan
- **Pricing transparency** — klant weet vooraf wat het kost
- **Installatie-blauwdruk** — wij weten precies wat we moeten opzetten

### Tech

- Simpele Next.js pagina op de website
- Form data naar Supabase of webhook
- Geen account nodig — gewoon invullen en versturen
