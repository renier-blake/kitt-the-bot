# KITT Portal Redesign: Apple + Casual

## Kernprincipe
**KITT is je persoonlijke assistent, niet een systeem dat je beheert.**

- Apple-like design: clean, polished, intuitief
- Casual toon: vriendelijk, menselijk, niet formeel
- Chat-first: praten met KITT als natuurlijkste interactie
- User-data focus: wat jij doet/bereikt, niet hoe het technisch werkt

---

## Nieuwe Navigatiestructuur

### Sidebar (Vereenvoudigd)

```
┌─────────────────────┐
│ 👤 KITT             │  ← Logo/wordmark
├─────────────────────┤
│                     │
│ 💬 Chat             │  ← Primary (nieuw prominent)
│                     │
│ 📊 Mijn Dag         │  ← Dashboard hernoemd
│ 📝 Mijn Projecten   │  ← Projects hernoemd
│ 💡 Ideeën           │  ← Triage hernoemd
│ 🔄 Mijn Koppelingen │  ← Integrations hernoemd
│ 📈 Mijn Voortgang   │  ← Nieuw (stats/trends)
│                     │
├─────────────────────┤
│                     │
│ 👤 Mijn Profiel     │  ← Identity
│ ⚙️ Instellingen     │  ← System verstopt hier
│                     │
└─────────────────────┘
```

### Wat er verdwijnt uit hoofdnavigatie
- "System" → verstopt onder Instellingen
- "Task Engine" → wordt deel van Chat/Mijn Dag
- "Database" → wordt deel van Instellingen (admin)
- "Logs" → wordt deel van Instellingen (admin)
- "Health" → wordt deel van Chat ("Hoe gaat het met je?")

---

## De Chat-First Interface

### Centrale Chat View
```
┌─────────────────────────────────────────────────────────────┐
│  💬 KITT                                          👤 Renier │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ☀️ Goedemorgen!                                          │
│                                                             │
│  Gisteren heb je je daily blog geschreven en 8km           │
│  gelopen. Je slaap was goed (7h 23m).                      │
│                                                             │
│  Vandaag op de planning:                                    │
│  📝 Blog schrijven (nog niet gestart)                      │
│  🏋️ Gym sessie om 17:00                                    │
│                                                             │
│  Wat wil je doen?                                          │
│                                                             │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐                    │
│  │ 📝 Blog  │ │ 📊 Stats │ │ ⚙️ Config│                    │
│  └──────────┘ └──────────┘ └──────────┘                    │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  [💬 Typ een bericht...                      ] [📎] [🎤]   │
└─────────────────────────────────────────────────────────────┘
```

### Chat als Configuratie
Je configureert KITT door te praten:

```
Jij: "Ik wil dat je me om 8u 's ochtends wakker maakt"
KITT: "Ik zal je dagelijkse reminder op 8:00 zetten. 
        Wil je dat ik dat op werkdagen doe of elke dag?"
        
Jij: "Alleen werkdagen"
KITT: "Gedaan! 🎉 Ik zal je om 8:00 op maandag t/m vrijdag 
        een goedemorgen sturen."
        
Jij: "Verbind mijn Garmin"
KITT: [toont koppeling widget] "Klik hier om je Garmin te koppelen. 
        Daarna kan ik je helpen met je health tracking."
```

### Chat toont Kaarten als Antwoord
```
Jij: "Wat staat er deze week op de planning?"

KITT: "Deze week heb je 3 dingen gepland:"
      
      ┌─────────────────────┐
      │ 📝 Daily Blog       │
      │ Elke dag om 9:00   │
      │ Status: 2/7 deze week│
      └─────────────────────┘
      
      ┌─────────────────────┐
      │ 🏋️ GYMRACE Training │
      │ Dinsdag & Donderdag │
      │ Volgende: morgen   │
      └─────────────────────┘
      
      "Wil je iets aanpassen?"
```

---

## Hernoemde Pagina's (Menselijke Taal)

| Oude Naam | Nieuwe Naam | Omschrijving in Chat |
|-----------|-------------|---------------------|
| Dashboard | Mijn Dag | "Dit is je dagoverzicht" |
| Projects | Mijn Projecten | "Hier werk je aan" |
| Triage | Ideeën | "Dingen die je ooit wilt doen" |
| Integrations | Mijn Koppelingen | "Met wie je verbonden bent" |
| Tasks | Mijn Taken | "Wat er gedaan moet worden" |
| System | (verstopt) | "Technische dingen" |
| Database | (verstopt) | "Data beheer" |
| Logs | (verstopt) | "Wat er is gebeurd (technisch)" |

---

## De "Instellingen" View (System verstopt)

Wanneer je op ⚙️ Instellingen klikt:

```
┌─────────────────────────────────────────┐
│  ⚙️ Instellingen              [Sluiten] │
├─────────────────────────────────────────┤
│                                         │
│  🔧 Systeem                             │
│  ├─ Bridge Status                       │
│  ├─ Database                            │
│  ├─ Live Logs                           │
│  └─ Health Monitor                      │
│                                         │
│  🤖 KITT Gedrag                         │
│  ├─ Persoonlijkheid (casual/professioneel)│
│  ├─ Notificatie voorkeuren              │
│  ├─ Active hours                        │
│  └─ Privacy instellingen                │
│                                         │
│  👤 Profiel                             │
│  ├─ Naam                                │
│  ├─ Email                               │
│  ├─ Voorkeuren                          │
│  └─ Integraties beheren                 │
│                                         │
└─────────────────────────────────────────┘
```

### "Systeem" wordt een uitklapbaar gedeelte
- Standaard ingeklapt
- Alleen zichtbaar als je erom vraagt of als er iets mis is
- In menselijke taal: "Hoe gaat het met KITT?" ipv "System Health"

---

## Design Richtlijnen: Apple + Casual

### Kleuren
```css
/* Apple-like neutrals */
--bg-primary: #000000;        /* Zuiver zwart */
--bg-secondary: #1C1C1E;      /* iOS dark gray */
--bg-tertiary: #2C2C2E;       /* iOS separator */

/* Warm accent (niet koud blauw) */
--accent-primary: #FF9500;    /* Warm orange (nu al goed!) */
--accent-secondary: #FF6B35;  /* Warm coral */
--accent-soft: #FFF4E6;       /* Very light orange */

/* Status colors - zacht */
--success: #30D158;           /* iOS green */
--warning: #FFD60A;           /* iOS yellow */
--error: #FF453A;             /* iOS red (zachter) */
```

### Typografie
```css
/* Apple system fonts */
font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", sans-serif;

/* Weights */
--font-regular: 400;
--font-medium: 500;
--font-semibold: 600;

/* Casual copy gebruikt geen ALL CAPS */
/* Geen tech-jargon */
```

### Componenten

#### Chat Bubbles
```
KITT (left):
┌──────────────────────────┐
│ ☀️ Goedemorgen!          │
│                          │
│ Gisteren heb je...       │
└──────────────────────────┘
Background: --bg-secondary
Text: white
Border-radius: 18px (iOS style)

User (right):
┌──────────────────┐
│ Plan mijn dag    │
└──────────────────┘
Background: --accent-primary
Text: black
Border-radius: 18px
```

#### Kaarten (Widgets)
```
┌────────────────────────────┐
│ 📝 Daily Blog               │
│                             │
│ Elke dag om 9:00           │
│                     [Edit] │
└────────────────────────────┘

- Soft shadows (niet harde borders)
- Rounded corners (12px)
- Icon + titel duidelijk
- Actie rechtsboven
```

#### Sidebar Items
```
💬 Chat              ← Active: accent color + pill background
📊 Mijn Dag
📝 Mijn Projecten    ← Hover: subtle highlight

- Icons gebruik SF Symbols (Apple style)
- Genoeg whitespace
- Active state: rounded pill met accent
```

---

## Conversatie Voorbeelden (Casual Tone)

### Goedemorgen
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
```

### Error (menselijk)
```
Oeps! 🙈

Ik kon je Garmin niet bereiken. 
Dat gebeurt soms als de servers even slapen.

Ik probeer het zo meteen opnieuw, oké?

[Probeer nu] [Negeer maar]
```

### Achievement
```
🎉 Hoera!

Je hebt 7 dagen op rij je blog geschreven!
Dat is je langste streak ooit.

Lekker bezig! 🔥
```

### Configuratie via Chat
```
Jij: "Ik wil een nieuw project maken"

KITT: "Natuurlijk! Wat voor project is het?"

Jij: "Een nieuwe feature voor de website"

KITT: "Leuk! Ik maak 'Een nieuwe feature voor de website' aan.
        Wil je er meteen een taak voor maken?"
        
Jij: "Ja, 'Design maken'"

KITT: "Gedaan! 🎨 'Design maken' staat nu in je project.
        Wil je dat ik je eraan herinner?"
```

---

## Technische Implementatie

### Fase 1: Chat Interface (Snel)
1. Chat component prominent maken
2. Chat geschiedenis opslaan
3. Quick reply buttons
4. Kaarten als chat responses

### Fase 2: Conversatie Commands (Midden)
1. Natural language parsing voor commands
2. Configuration via chat ("/reminder 8am daily")
3. Context behouden in gesprekken
4. Proactieve berichten (goedemorgen)

### Fase 3: Sidebar Restructurering (Midden)
1. System verplaatsen naar Instellingen
2. Page hernoemingen
3. Nieuwe "Mijn Dag" view
4. Instellingen panel ontwerp

### Fase 4: Polish (Lang)
1. Animaties (iOS-style)
2. Micro-interacties
3. Dark mode perfectioneren
4. Responsive tweaks

---

## Open Vragen

1. **Chat locatie:**
   - Sidebar chat vervangen door full-page chat?
   - Of chat als overlay die je kan openen?
   - Of hybride: chat in sidebar maar prominenter?

2. **Proactieve berichten:**
   - Wanneer mag KITT initiëren?
   - Alleen ochtend/avond?
   - Of ook bij bepaalde triggers?

3. **Voice input?**
   - Later misschien?
   - Nu alleen tekst?

4. **Chat geschiedenis:**
   - Hoe lang bewaren?
   - Doorzoekbaar?
   - Per dag gegroepeerd?
