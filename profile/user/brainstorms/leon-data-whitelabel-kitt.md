# Brainstorm: KITT White-Label voor Leon's Databedrijf

**Datum:** 12 februari 2026
**Context:** Leon heeft een databedrijf dat dashboards bouwt voor de transportsector. Ze integreren met een TMS (naam nog onbekend) en bouwen dashboards voor transportbedrijven. Ze zoeken meer producten om te verkopen.
**Meeting:** Volgende week vrijdag (21 feb) gesprek met Leon's team.

---

## Het Idee

KITT white-labelen voor Leon's bedrijf, zodat zij het kunnen doorverkopen aan hun klanten in de transportsector.

**Value prop voor Leon's bedrijf:**
- Geen grote tech-investering nodig — ze gebruiken KITT als platform
- Hun klanten kunnen *praten* met hun TMS-data in plaats van alleen dashboards bekijken
- Extra product in hun portfolio zonder zelf te bouwen

**Wat wij moeten bouwen:**
- Custom integratie met hun dataplatform/TMS
- Skills om met die TMS-data te werken (queries, rapportages, alerts, etc.)
- Dan is het basically al running

---

## Open Vragen: Interfaces

### 1. WhatsApp
- Al bestaande integratie bij KITT
- Laagdrempelig, iedereen heeft het
- Geschikt voor mobiel gebruik

### 2. Microsoft Teams ✅ Onderzocht
- Veel transportbedrijven gebruiken waarschijnlijk Teams
- Enterprise-friendly

**4 opties om een bot in Teams te krijgen:**

#### Optie A: Outgoing Webhook (Simpelst)
- Teams stuurt een HTTP POST naar jouw endpoint
- Minimale setup, geen Azure nodig
- Beperkt: alleen in channels, geen DMs, geen rich UI

#### Optie B: Power Virtual Agents (Low-code)
- Microsoft's eigen bot-builder
- Drag-and-drop, kan met custom APIs praten
- Nadeel: minder flexibel, vendor lock-in

#### Optie C: Azure Bot Framework (Full bot) ⭐ Aanbevolen
- Volledige bot met DMs, adaptive cards, rich UI
- Kan in Teams Marketplace gepubliceerd worden
- **Multi-platform:** dezelfde backend werkt ook voor Slack (via dunne adapters)
- Vereist Azure Bot Service registratie

#### Optie D: Teams Toolkit + Custom App
- Custom Teams app met embedded chat
- Meeste controle, maar ook meeste werk
- Geschikt als je meer wilt dan alleen chat (tabs, dashboards, etc.)

**OAuth voor Teams:**
- Leon's bedrijf maakt een eigen Azure AD app registratie
- Klanten autoriseren via standaard Microsoft OAuth consent flow
- Bot wordt geïnstalleerd in hun Teams workspace
- Leon's team beheert de app, KITT levert de engine

**Architectuur conclusie:**
- Teams + Slack = niet dezelfde bot, wél dezelfde backend
- Twee dunne "adapters" (Teams Bot Framework + Slack App), één KITT engine erachter
- Intelligentie, skills, memory — allemaal één keer gebouwd

### 3. Custom Chat Interface
- Een eigen chat-omgeving in hun veilige omgeving
- **Onderzoeksvraag:** Kunnen we dit via de bestaande Cloudflare tunnel doen? Is dat veilig genoeg?
- Voordeel: volledig onder eigen controle
- Moet heel veilig zijn (enterprise/transport data)

### 4. Claude / Claude Code (MCP)
- Via MCP zou het kunnen
- Maar: is het niet overkill om KITT ertussen te zetten als ze toch al Claude gebruiken?
- Nadeel: alleen desktop, niet uitbreidbaar naar andere devices
- Nadeel: moeilijker om extra databronnen aan te koppelen

---

## Te Onderzoeken

- [x] Teams bot/integratie mogelijkheden uitzoeken
- [ ] Cloudflare tunnel security voor custom chat interface evalueren
- [ ] TMS naam achterhalen (bij Leon navragen)
- [ ] White-label pricing model bedenken

## Voor te Bereiden (voor meeting 21 feb)

- [ ] Presentatie: wat is KITT, hoe werkt het, wat kan het voor hun klanten betekenen
- [ ] Demo-scenario: hoe een transportbedrijf met hun data zou praten via KITT
- [ ] Interface-opties overzicht met voor/nadelen
- [ ] Technische vereisten voor de TMS-integratie
- [ ] Pricing/business model voorstel

---

## Notities

- Leon is een vriend van Renier, woont in Nijmegen
- De integratie hoeft niet complex te zijn: data uit TMS halen + skills maken = running
- Veiligheid is key (enterprise transport data)
