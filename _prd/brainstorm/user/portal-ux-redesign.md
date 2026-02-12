# KITT Portal UX Redesign - Brainstorm Document

> **Status:** Brainstorm fase  
> **Doel:** Van developer tool naar persoonlijke assistent  
> **Stijl:** Apple-like design + Casual toon

---

## 1. Kernvisie

### Het Probleem
KITT Portal voelt nu aan als een "developer dashboard" - functioneel maar klinisch. Het is een systeem dat je moet bedienen in plaats van een assistent die je helpt.

### De Oplossing
**KITT is geen tool. KITT is een persoon.**  
Een chief of staff die je taken regelt, patronen kent, en je helpt productief te zijn - zonder dat je hoeft te weten hoe het technisch werkt.

### Design Principes
1. **Apple-like**: Clean, polished, intuitief, mooie animaties
2. **Casual**: Vriendelijk, menselijk, niet formeel
3. **Chat-first**: Praten met KITT als natuurlijkste interactie
4. **User-data focus**: Wat jij doet/bereikt, niet systeemmetrics
5. **Vergevingsgezind**: Geen schuldgevoel, alleen ondersteuning

---

## 2. Inspiratiebronnen

### Wat Werkt (Goede Voorbeelden)

| Platform | Waarom Het Werkt | Toepassing voor KITT |
|----------|-----------------|---------------------|
| **Notion** | `/` commands, templates, nesten | Snel iets toevoegen zonder menu's |
| **Zapier** | Visuele "als dit, dan dat" flows | Skills configureren als blokjes |
| **Linear** | Snelheid, Cmd+K, polished UI | Alles snel bereiken, geen page loads |
| **Pi (AI)** | Chat als interface, warme persoonlijkheid | KITT begroet je, checkt in |
| **Gentler Streak** | "Rust is ook belangrijk", geen schuld | Fouten zacht presenteren |
| **Day One** | Dagelijkse reflectie, "on this day" | Timeline met betekenis |
| **Things 3** | Elegant, "upcoming" zonder stress | Planning zonder hectiek |
| **Vercel** | Timeline view, groene vinkjes | Wat er recent gebeurde |
| **Raycast** | Alt+Space voor alles, extensions | Global command palette |
| **Apple Health** | Highlights, trends, samenvattingen | "Je slaap was deze week goed" |

### Wat Werkt NIET (Slechte Voorbeelden)

| Platform | Waarom Het Niet Werkt | Waarom KITT Dit Vermijd |
|----------|----------------------|------------------------|
| **Airtable** | Te "spreadsheet", veel configureren | Geen "database vullen" gevoel |
| **Retool** | Te technisch, bouwen in plaats van gebruiken | Geen "internal tool" vibe |
| **Jira** | Traag, overweldigend, bureaucratisch | Geen friction, geen complexiteit |

---

## 3. Nieuwe Navigatiestructuur

### Sidebar (Vereenvoudigd)

```
👤 KITT (logo)
─────────────────
💬 Chat              ← Primary
─────────────────
📊 Mijn Dag
📝 Mijn Projecten
💡 Ideeën
🔄 Mijn Koppelingen
📈 Mijn Voortgang     ← Nieuw
─────────────────
👤 Mijn Profiel
⚙️ Instellingen       ← System verstopt hier
```

### Hernoemingen (Menselijke Taal)

| Technisch | Menselijk | Beschrijving |
|-----------|-----------|--------------|
| Dashboard | **Mijn Dag** | "Dit is je dagoverzicht" |
| Projects | **Mijn Projecten** | "Hier werk je aan" |
| Triage | **Ideeën** | "Dingen die je ooit wilt doen" |
| Integrations | **Mijn Koppelingen** | "Met wie je verbonden bent" |
| Tasks | **Mijn Taken** | "Wat er gedaan moet worden" |
| System | **(verstopt)** | "Technische dingen" |
| Database | **(verstopt)** | "Data beheer" |
| Logs | **(verstopt)** | "Wat er is gebeurd (technisch)" |
| Health | **(in Chat)** | "Hoe gaat het met je?" |

---

## 4. Chat-First Interface

### Concept: Chat als Hoofdscherm
De chat is niet meer een zijdingetje, maar het centrale interactiepunt. Je praat met KITT zoals je met een assistent zou praten.

### Voorbeeld Conversaties

#### Goedemorgen Ritueel
```
☀️ Goedemorgen Renier!

Gisteren was een goede dag:
✅ Daily blog gepubliceerd  
✅ 8km hardgelopen
✅ 7h 23m slaap (lekker!)

Vandaag staat er dit op de planning:
📝 Daily blog (nog niet gestart)
🏋️ Gym sessie om 17:00

Wat wil je eerst doen?
[📝 Blog schrijven] [📊 Stats bekijken] [⚙️ Instellingen]
```

#### Configuratie via Chat
```
Jij: "Ik wil dat je me om 8u wakker maakt"

KITT: "Ik zal je dagelijkse reminder op 8:00 zetten. 
        Wil je dat ik dat op werkdagen doe of elke dag?"

Jij: "Alleen werkdagen"

KITT: "Gedaan! 🎉 Ik zal je om 8:00 op maandag t/m vrijdag 
        een goedemorgen sturen."
```

#### Foutmelding (Menselijk)
```
Oeps! 🙈

Ik kon je Garmin niet bereiken. 
Dat gebeurt soms als de servers even slapen.

Ik probeer het zo meteen opnieuw, oké?

[Probeer nu] [Negeer maar]
```

#### Success/ celebratie
```
🎉 Hoera!

Je hebt 7 dagen op rij je blog geschreven!
Dat is je langste streak ooit.

Lekker bezig! 🔥
```

### Chat toont Kaarten als Antwoord
In plaats van alleen tekst, toont KITT interactieve kaarten:

```
Jij: "Wat staat er deze week op de planning?"

KITT: "Deze week heb je 3 dingen gepland:"

┌────────────────────────┐
│ 📝 Daily Blog          │
│ Elke dag om 9:00       │
│ Status: 2/7 deze week  │
│ [Details] [Wijzig]     │
└────────────────────────┘

┌────────────────────────┐
│ 🏋️ GYMRACE Training    │
│ Dinsdag & Donderdag    │
│ Volgende: morgen       │
│ [Details] [Wijzig]     │
└────────────────────────┘

"Wil je iets aanpassen?"
```

### Chat Features

| Feature | Beschrijving | Prioriteit |
|---------|--------------|------------|
| Chat geschiedenis | 30 dagen bewaren, doorzoekbaar | Hoog |
| Quick replies | Snelle actie knoppen onder berichten | Hoog |
| Kaarten in chat | Interactieve widgets als antwoord | Hoog |
| Slash commands | `/blog`, `/stats`, `/reminder` | Midden |
| Context behouden | KITT onthoudt waar je over sprak | Midden |
| Proactieve berichten | Goedemorgen, check-ins, reminders | Midden |
| Voice input (later) | Spraakberichten sturen | Laag |

---

## 5. De "Instellingen" View

System/Admin verstopt onder Instellingen - alleen zichtbaar als je erom vraagt of als er iets mis is.

```
⚙️ Instellingen
─────────────────

🔧 Systeem (uitgeklapt als nodig)
  ├─ Bridge Status
  ├─ Database  
  ├─ Live Logs
  └─ Health Monitor

🤖 KITT Gedrag
  ├─ Persoonlijkheid (casual/professioneel/playful)
  ├─ Notificatie voorkeuren
  ├─ Active hours
  └─ Privacy instellingen

👤 Profiel
  ├─ Naam, email, avatar
  ├─ Voorkeuren
  └─ Integraties beheren

🎨 Uiterlijk
  ├─ Dark/Light/Auto
  ├─ Accent kleur
  └─ Font size
```

---

## 6. Design Systeem

### Kleuren (Apple-like)

```css
/* Achtergronden */
--bg-primary: #000000;           /* Zuiver zwart */
--bg-secondary: #1C1C1E;         /* iOS dark gray */
--bg-tertiary: #2C2C2E;          /* iOS separator */
--bg-elevated: #3A3A3C;          /* Cards, inputs */

/* Accent (warm, niet koud blauw) */
--accent-primary: #FF9500;       /* Warm orange */
--accent-secondary: #FF6B35;     /* Warm coral */
--accent-soft: rgba(255, 149, 0, 0.15); /* Subtle bg */

/* Status (zacht) */
--success: #30D158;              /* iOS green */
--warning: #FFD60A;              /* iOS yellow */
--error: #FF453A;                /* iOS red (zacht) */
--info: #0A84FF;                 /* iOS blue */

/* Tekst */
--text-primary: #FFFFFF;
--text-secondary: rgba(255, 255, 255, 0.6);
--text-tertiary: rgba(255, 255, 255, 0.3);
```

### Typografie

```css
font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", sans-serif;

/* Titels */
--font-large: 28px / 600;
--font-title: 20px / 600;
--font-headline: 17px / 600;

/* Body */
--font-body: 16px / 400;
--font-body-small: 14px / 400;
--font-caption: 12px / 400;

/* Chat */
--chat-message: 15px / 400;
--chat-line-height: 1.5;
```

### Componenten

#### Chat Bubbles
- **KITT (links)**: `--bg-secondary`, 18px border-radius, zachte schaduw
- **User (rechts)**: `--accent-primary`, 18px border-radius, zwarte tekst

#### Kaarten (Widgets)
- Achtergrond: `--bg-secondary`
- Border-radius: 16px
- Padding: 16px
- Subtiele schaduw
- Hover: lichte lift animatie

#### Sidebar Items
- Icon: SF Symbols, 20px
- Active: Rounded pill met `--accent-soft` bg
- Hover: Subtiele highlight

#### Buttons
- Primary: `--accent-primary`, zwarte tekst, rounded-full
- Secondary: `--bg-elevated`, witte tekst, rounded-full
- Ghost: Transparant, `--text-secondary`

---

## 7. Pagina's & Features

### 7.1 Chat (Nieuw - Hoofdscherm)
**Doel:** Centrale interactie met KITT

**Features:**
- Berichten sturen/ontvangen
- Chat geschiedenis (30 dagen)
- Quick reply buttons
- Kaarten als antwoord
- Slash commands
- Typing indicator
- Proactieve berichten

**Layout:**
```
┌─────────────────────────────────────┐
│ 💬 KITT                 👤 Renier  │ Header
├─────────────────────────────────────┤
│                                     │
│  ☀️ Goedemorgen!                   │ Messages
│  ...                                │
│                                     │
├─────────────────────────────────────┤
│ [💬 Typ een bericht...] [📎]      │ Input
└─────────────────────────────────────┘
```

---

### 7.2 Mijn Dag (Vervangt Dashboard)
**Doel:** Dagelijkse samenvatting en focus

**Features:**
- Goedemorgen boodschap
- Wat je gisteren deed (celebratie)
- Wat er vandaag op de planning staat
- Quick actions
- Dagelijkse highlight ("Wist je dat...")
- Weather/mood context

**Layout:**
```
☀️ Goedemorgen, Renier!

Gisteren:
✅ [Highlight 1]  ✅ [Highlight 2]

Vandaag:
📝 [Taak 1]      🏋️ [Taak 2]

Quick Actions:
[📝 Blog] [📊 Stats] [💡 Idee]
```

---

### 7.3 Mijn Projecten (Vervangt Projects)
**Doel:** Je projecten beheren zonder "system" gevoel

**Features:**
- Visuele project kaarten (niet tabel)
- Progress indicators
- Recent activity per project
- Snel nieuw project maken
- Favorieten/projecten onderscheid

**Layout:**
Grid van kaarten:
```
┌──────────────┐  ┌──────────────┐
│ 🎯 PAS       │  │ 🚀 KITT      │
│              │  │              │
│ 12 taken     │  │ 5 taken      │
│ 3 in progress│  │ 1 in progress│
│              │  │              │
│ ████████░░   │  │ █████░░░░░   │
└──────────────┘  └──────────────┘
```

---

### 7.4 Ideeën (Vervangt Triage)
**Doel:** Dingen die je ooit wilt doen, zonder druk

**Features:**
- Inbox voor nieuwe ideeën
- Snooze (later, volgende week, ooit)
- Archief (niet nu, misschien nooit)
- Converteren naar project/taak
- Geen "deadlines" - alleen "misschien"

**Tone:**
- "Dit zijn je ideeën"
- "Geen idee is te gek"
- "Neem de tijd"

---

### 7.5 Mijn Koppelingen (Vervangt Integrations)
**Doel:** Met wie/wat je verbonden bent

**Features:**
- Visuele kaarten per integratie (icon, status)
- "Verbonden" / "Niet verbonden" badges
- Snel verbinden/disconnecten
- Wat deze koppeling doet (beschrijving)
- Laatste sync tijd

**Layout:**
```
Je bent verbonden met:

┌────────┐ ┌────────┐ ┌────────┐
│ 📧     │ │ 📅     │ │ 💪     │
│ Gmail  │ │ Calendar│ │ Garmin │
│ ✅     │ │ ✅     │ │ ⚠️     │
└────────┘ └────────┘ └────────┘
```

---

### 7.6 Mijn Voortgang (Nieuw)
**Doel:** Inzicht in je patronen en groei

**Features:**
- Streaks (blog, workout, etc.)
- Weekly/monthly highlights
- Trends ("Je schrijft vaker 's avonds")
- Milestones ("100 blogs! 🎉")
- Apple Health-achtige samenvattingen

**Layout:**
Timeline met highlights:
```
Deze week:

Ma  ✅ Blog geschreven
Di  ✅ Gym + Blog
Wo  ✅ Blog
Do  🏆 100e blog! 🎉
Vr  ⏳ Vandaag
```

---

### 7.7 Mijn Profiel
**Doel:** Wie je bent en wat je wilt

**Features:**
- Naam, avatar, bio
- Voorkeuren (tone of voice, notificaties)
- Goals (wat wil je bereiken?)
- Stats over jou (niet technisch)

---

## 8. Rituelen (Proactieve Momenten)

### 8.1 Goedemorgen (8:00)
- Samenvatting gisteren
- Wat staat er vandaag op
- Suggestie voor eerste taak
- Weer/slaap context

### 8.2 Midday Check (12:00)
- "Hoe gaat het tot nu toe?"
- Aanpassingen voor de middag
- Reminders voor taken

### 8.3 Evening Wind-down (20:00)
- Wat heb je bereikt vandaag?
- Morgen vooruitblik
- "Goed gedaan" of "Morgen nieuwe kans"

### 8.4 Weekly Reflection (Zondagavond)
- Deze week in cijfers
- Highlights
- Trends
- Volgende week preview

---

## 9. Tone of Voice

### Casual (Huidige Keuze)
```
✅ "Goedemorgen!"
✅ "Lekker bezig!"
✅ "Oeps, dat lukte niet"
✅ "Gedaan! 🎉"
✅ "Geen probleem"
```

### Niet
```
❌ "Systeem fout"
❌ "Error opgetreden"
❌ "Configuratie vereist"
❌ "Uw taak is voltooid"
```

### Emoji Gebruik
- Voor emotie/context: ☀️ 🎉 🙈 💪
- Voor status: ✅ ⏳ 🔄
- Spaarzaam maar consistent

---

## 10. Mogelijke Features (Later)

### 10.1 Voice Interface
- Spraakberichten sturen
- KITT spreekt terug (text-to-speech)
- Hands-free interactie

### 10.2 AI Personalisatie
- KITT leert je voorkeuren
- Voorspelt wat je nodig hebt
- Aangepaste suggesties

### 10.3 Widgets/Extensions
- Desktop widgets (macOS)
- Menu bar app
- iOS app (later)

### 10.4 Social Features
- Delen met anderen (optioneel)
- Challenges/streaks met vrienden
- Celebrations delen

### 10.5 Advanced Chat
- Natural language queries
- "Hoeveel blogs heb ik deze maand geschreven?"
- Context over langere periodes
- Herinneringen aan eerdere gesprekken

---

## 11. Technische Overwegingen

### Frontend
- React + TypeScript (bestaand)
- Tailwind CSS met custom design tokens
- Framer Motion voor animaties
- React Query voor data fetching

### State Management
- Chat geschiedenis in SQLite (via API)
- Local state voor UI
- Real-time updates via WebSocket

### API's
- Chat endpoint: POST/GET messages
- Context endpoint: user state voor KITT
- Command parsing: natural language → actions

---

## 12. Openstaande Vragen

1. **Chat geschiedenis opslag:**
   - Alleen in SQLite of ook cache?
   - Encryptie nodig?

2. **Proactieve berichten triggers:**
   - Tijdsgebaseerd (8:00, 20:00)
   - Event-gebaseerd (taak completed)
   - Beide?

3. **Command parsing:**
   - Simpele regex matching
   - Of lightweight NLP
   - Of beide (regex eerst, NLP later)

4. **Kaarten in chat:**
   - Welke types? (task, project, stats, config)
   - Hoe generiek/component-based?

5. **Mobile:**
   - Responsive web eerst?
   - Of gelijk PWA/app denken?

---

## 13. Feature Prioritering

### P0 - Must Have (MVP)
- [ ] Full-page chat interface
- [ ] Chat geschiedenis (30 dagen)
- [ ] Quick reply buttons
- [ ] Hernoemingen in sidebar
- [ ] System verstopt onder Instellingen
- [ ] "Mijn Dag" view (simpel)

### P1 - Should Have (V1)
- [ ] Kaarten als chat antwoord
- [ ] Proactieve "goedemorgen"
- [ ] Natural language commands
- [ ] "Mijn Projecten" redesign
- [ ] "Ideeën" (Triage rename)
- [ ] Animaties (iOS-style)

### P2 - Nice to Have (V2)
- [ ] "Mijn Voortgang" (stats)
- [ ] Rituelen (midday, evening)
- [ ] Slash commands
- [ ] Advanced kaarten
- [ ] Voice input (later)

### P3 - Future (V3+)
- [ ] AI personalisatie
- [ ] Desktop widgets
- [ ] Mobile app
- [ ] Social features

---

## 14. Volgende Stap

Dit document is de bron van waarheid. Features die hieruit voortkomen:

1. **Chat Interface** - Full-page chat als hoofdscherm
2. **Sidebar Redesign** - System verbergen, menselijke taal
3. **Mijn Dag** - Nieuwe dashboard view
4. **Kaarten Systeem** - Widgets in chat
5. **Proactieve Berichten** - Goedemorgen, check-ins

Wanneer we hieraan gaan werken, maken we per feature een aparte PRD aan.

---

*Laatste update: 10 februari 2025*
