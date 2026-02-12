# Portal UX Focus: Wat Werkt (en wat niet)

## Feedback Samenvatting
- ✅ **Notion** - Goede inspiratiebron
- ✅ **Zapier** - Goede inspiratiebron  
- ❌ **Airtable** - Te "spreadsheet", niet passend bij KITT visie
- ❓ **Linear** - Onbekend, uitleg nodig

---

## Linear Uitgelegd

Linear is een issue tracker (zoals Jira) maar dan:
- **Snel** - Cmd+K om alles te doen, geen page loads
- **Polished** - Animaties, dark mode, mooie typography
- **Minimal** - Alleen wat je nodig hebt, nu
- **Keyboard-first** - maar niet intimiderend

**Waarom relevant voor KITT:**
- Linear bewijst dat developer tools elegant kunnen zijn
- Hun "frictionless" aanpak past bij "KITT helpt je zonder in de weg te zitten"

---

## Betere Vergelijkingen voor KITT

### 1. **Vercel** - Deployment Platform
**Wat ze goed doen:**
- Je ziet direct wat er live staat (groene vinkjes = succes)
- Deployments als "timeline" - visueel duidelijk
- Preview links voor elke change
- Error states zijn duidelijk maar niet eng

**Vergelijking met KITT:**
- "Deployments" = KITT Tasks/Skills die lopen
- "Preview links" = KITT logs/output bekijken
- "Project dashboard" = zoals KITT Dashboard zou kunnen zijn

### 2. **Raycast** - Mac Launcher voor Developers
**Wat ze goed doen:**
- Eén shortcut (Alt+Space) voor alles
- Extensions voelen als "native" maar zijn door community gemaakt
- Mooie UI terwijl het een "power user" tool is
- Store met extensions die je in 1 klik installeert

**Vergelijking met KITT:**
- "Extensions" = KITT Skills
- "Store" = zoals een Skill marketplace zou kunnen zijn
- "Command palette" = Global search/actie patroon

### 3. **GitHub (nieuwe UI)** - Code Platform
**Wat ze goed doen:**
- Projects tab is nu een echte Kanban (niet alleen issues)
- "Actions" workflows visueel (YAML wordt UI)
- Copilot Chat zit IN de interface (niet apart)
- Dark mode is standaard, mooi, niet grijs

**Vergelijking met KITT:**
- "Projects" = zoals KITT Projects zou kunnen zijn
- "Actions" = KITT Task automation
- "Copilot" = KITT AI assistentie

### 4. **Figma** - Design Tool
**Wat ze goed doen:**
- Multiplayer - je ziet wie wat doet (cursors)
- Componenten die je kunt hergebruiken
- Plugins die de tool uitbreiden
- Design en Prototype in één tool

**Vergelijking met KITT:**
- "Multiplayer" = Activity feed van wat KITT doet
- "Plugins" = Skills systeem
- "Componenten" = Templates/herbruikbare workflows

### 5. **Supabase** - Database/Backend Tool
**Wat ze goed doen:**
- "Firebase alternatief" maar met SQL (technisch)
- Table Editor die aanvoelt als spreadsheet maar SQL is
- Real-time werkt out-of-the-box
- Auth met 1 klik (GitHub, Google, etc.)

**Vergelijking met KITT:**
- "Table Editor" = KITT Database zou dit kunnen zijn
- "Auth integrations" = zoals KITT Integraties nu zijn
- "Real-time" = KITT live logs/notifications

---

## De "Golden Mix" voor KITT

Gebaseerd op wat WEL werkt:

### Van Notion:
- **Slash commands** - typ `/` om iets toe te voegen
- **Templates** - start vanaf een voorbeeld
- **Nesten** - alles kan in alles (pagina in pagina)

### Van Zapier:
- **Visuele flow** - "als dit, dan dat" als blokjes
- **Status indicators** - duidelijk wat actief is
- **Test knop** - voer iets 1x uit om te controleren

### Van Vercel:
- **Timeline view** - wat is er recent gebeurd
- **Success/failure states** - visueel duidelijk
- **1-click actions** - deploy, rollback, etc.

### Van Raycast:
- **Command palette** - Alt+Space voor alles
- **Extensions** - community skills/plugins
- **Shortcuts** - power users kunnen vliegen

### Van Linear:
- **Speed** - alles snel, geen wachttijden
- **Empty states** - helpen je op weg
- **Keyboard shortcuts** - maar optioneel

---

## Wat We NIET Willen (Airtable les)

Airtable voelt als:
- "Je bent een spreadsheet aan het vullen"
- Veel velden, veel configuratie
- "Database" is te zichtbaar

KITT moet voorkomen als:
- "Je bent aan het "configureren""
- Te veel velden/forms
- De "techniek" te zichtbaar

---

## Concreet: Voorbeelden voor KITT

### Voorbeeld 1: Nieuwe Skill Maken
**Nu:** Formulier invullen (name, description, config...)

**Zapier-stijl:**
```
[Trigger: Wanneer...] → [Actie: Doe dit...]
     (dropdown)          (dropdown)
```

**Notion-stijl:**
```
Typ `/skill` → kies template → edit inline
```

### Voorbeeld 2: Task Status Zien
**Nu:** Tabel met status kolom

**Vercel-stijl:**
```
[🟢] Task naam - 2 min geleden - View log
[🔴] Task naam - Failed - Retry
[🟡] Task naam - Running... (cancel)
```

### Voorbeeld 3: Dashboard
**Nu:** Health metrics cards

**Linear-stijl:**
```
Recente activiteit:
• KITT heeft daily blog gepubliceerd (2u geleden)
• Garmin sync voltooid (4u geleden)
• 3 nieuwe items in Triage

Quick Actions:
[📝 New Blog] [📊 View Stats] [⚙️ Settings]
```

---

## Volgende Stap

Welke van deze voorbeelden spreekt je het meest aan om als eerste te verkennen?

1. **Command Palette** (Raycast/Linear stijl) - Alt+Space voor alles
2. **Visuele Skill Builder** (Zapier stijl) - Blokjes die je verbindt  
3. **Dashboard 2.0** (Vercel/Linear stijl) - Timeline + Quick Actions
4. **Templates** (Notion stijl) - Start vanaf voorbeelden
