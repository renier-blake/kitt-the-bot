# Orchestrator + Sub-agents Architectuur

> Brainstorm document — hoe KITT beschikbaar blijft als orchestrator terwijl sub-agents taken uitvoeren.

## Sessie — 10 februari 2026

### Het probleem

1. **KITT is weg als hij een taak oppakt** — geen updates, niet beschikbaar, black box
2. **Geen tussentijdse communicatie** — Renier weet niet of KITT crasht of werkt
3. **Onduidelijk wat er gedaan is** — heeft KITT iets gebouwd? Waar staat het? Is het volgens de workflow?
4. **Niet multi-threaded** — KITT kan maar één ding tegelijk, chat staat stil tijdens taken

### Voorbeeld (10 feb)

Renier stuurde een YouTube link om 14:34. KITT ging het transcript ophalen. 20 minuten later kwam het antwoord. In die tussentijd: geen bevestiging, geen updates, niet bereikbaar. Renier wist niet wat er aan de hand was.

### Wat we willen

- **KITT = orchestrator** die altijd beschikbaar blijft voor chat
- **Sub-agents voor afgegrensde taken:** research, skill execution, podcast generatie, etc.
- **Tussentijdse updates** naar Telegram bij langere taken
- **Geen architectuur-omgooi** — slim dispatchen binnen de huidige setup

### Wanneer sub-agents?

| Taak type | Sub-agent? | Reden |
|-----------|-----------|-------|
| YouTube transcript ophalen | ✅ Ja | Research, KITT hoeft niet te wachten |
| Podcast genereren | ✅ Ja | Afgegrensde skill, één output |
| Blog draft schrijven | ✅ Ja | Één skill, één output |
| Image genereren | ✅ Ja | Kort, gefocust |
| Brainstorm met Renier | ❌ Nee | Interactief, KITT moet aanwezig zijn |
| Feature bouwen (meerdere files) | ❌ Nee | Te complex voor sub-agent, heeft context nodig |
| Reflectie draaien | ✅ Ja | Afgegrensde skill, draait al als aparte Opus task |
| Email beantwoorden | ⚠️ Misschien | Hangt af van complexiteit |

### Hoe het zou werken

```
Renier: "Pak even het transcript van deze YouTube video"

KITT (orchestrator):
  1. Bevestigt: "Doe ik, ik laat iemand dat transcript ophalen"
  2. Spawnt sub-agent met opdracht
  3. Blijft beschikbaar voor chat
  4. Sub-agent rapporteert terug
  5. KITT stuurt resultaat naar Renier

Renier kan in de tussentijd gewoon doorpraten met KITT.
```

### Organische updates (sub-agents als updates)

Geen kunstmatige "status updates om de 5 minuten." De sub-agents die terugkomen ZIJN de updates. KITT mengt ze in het gesprek zodra ze binnenkomen.

**Voorbeeld flow:**

```
Renier: "Wil je die YouTube scrapen en uitzoeken hoe we met agents werken?"

KITT: "Oke, ik hoor twee dingen:
1. Transcript ophalen van die video
2. Uitzoeken wat relevant is voor onze architectuur

Ik zet er twee sub-agents op. Eentje pakt het transcript,
de ander zoekt uit wat Claude Code kan met sub-agents.
Even geduld, ik ben hier."

[Sub-agent 1 komt terug na 2 min]
KITT: "Transcript is binnen. Video van Cole Medin over
Agent Teams. Andere agent is nog bezig met de research."

[Sub-agent 2 komt terug na 3 min]
KITT: "Research ook klaar. Kort samengevat: [...]
Wil je de details?"
```

**Het patroon:**
1. KITT ontvangt vraag
2. KITT splitst op in taken
3. KITT bevestigt: "Ik hoor X taken, ik zet er sub-agents op"
4. Sub-agents draaien op de achtergrond
5. KITT blijft beschikbaar voor chat
6. Sub-agents rapporteren terug → KITT mengt resultaten in het gesprek
7. Gesprek gaat organisch verder

Net als een collega die twee mensen iets laat uitzoeken en je bijpraat zodra er iets binnenkomt.

### Technische aanpak

Claude Code heeft al de `Task` tool met `run_in_background` parameter. Dit spawnt een sub-agent die op de achtergrond draait. De orchestrator (KITT main session) kan ondertussen doorwerken.

**Wat er nu al kan:**
- `Task` tool met `run_in_background: true` — spawnt achtergrond-agent
- `TaskOutput` — check status van achtergrond-agent
- Sub-agent heeft toegang tot dezelfde tools (Bash, Read, Write, etc.)

**Wat we moeten bouwen/regelen:**
- [ ] Orchestrator logica: wanneer dispatch je naar sub-agent vs doe je het zelf?
- [ ] Terugrapportage: hoe komt het resultaat van sub-agent terug in de chat?
- [ ] Updates: hoe stuurt de orchestrator tussentijdse updates naar Telegram?
- [ ] Workflow compliance: hoe zorgen we dat sub-agents onze skills/workflow volgen?

### Relatie met Agent Teams (toekomst)

Cole Medin's video (Claude Code Agent Teams) laat zien dat voor complexere taken (feature development) Agent Teams beter werken dan sub-agents — gedeelde taaklijst, peer-to-peer communicatie, coördinatie.

**Nu:** Sub-agents voor research en skill execution
**Later:** Agent Teams onderzoeken voor feature development

### Referentie

- Video: https://www.youtube.com/watch?v=-1K_ZWDKpU0 (Cole Medin — Claude Code Agent Teams)
- Bestaande brainstorm: `autonomous-dev-flywheel.md` (gerelateerd)
- Claude Code docs: https://code.claude.com/docs/en/sub-agents

### Technische Analyse (10 feb)

#### Huidige situatie

De bridge (`src/bridge/router.ts`) heeft een **blocking call** op regel 174:

```typescript
let response = await runAgent(message.content, { sessionId, model: DEFAULT_MODEL });
```

Zolang de agent bezig is, verwerkt de bridge niks. Dat is waarom Renier 20 minuten niks hoort.

#### Wat er al is

- **Router is kanaal-agnostisch** — `MessageRouter` met adapters (Telegram, WhatsApp, Slack). `sendMessage(chatId, content)` routeert naar het juiste kanaal via `extractChannel(chatId)`.
- **Think Loop draait op Opus** (bevestigd in `runtime.json`)
- **Taken kunnen per stuk een ander model krijgen** via `model` kolom in `kitt_tasks`
- **Processing lock** bestaat al — voorkomt dat Think Loop en bridge tegelijk draaien

#### Wat we moeten bouwen

**1. Background task tabel in de database:**

```sql
CREATE TABLE pending_agents (
  id INTEGER PRIMARY KEY,
  description TEXT NOT NULL,       -- "YouTube transcript ophalen"
  context TEXT,                     -- originele vraag/context
  chat_id TEXT NOT NULL,           -- waar het resultaat heen moet (kanaal-agnostisch)
  output_file TEXT,                -- pad naar output file van sub-agent
  status TEXT DEFAULT 'running',   -- running | done | failed
  result TEXT,                     -- samenvatting van het resultaat
  created_at INTEGER DEFAULT (unixepoch() * 1000),
  completed_at INTEGER
);
```

**2. Bridge: dispatch naar achtergrond + snel antwoorden**

In de router, wanneer KITT besluit een sub-agent te spawnen:
1. Stuur bevestiging naar het kanaal ("Ik ga X doen, moment")
2. Spawn sub-agent via `Task` tool met `run_in_background: true`
3. Sla record op in `pending_agents` met chat_id
4. Release processing lock — bridge is weer beschikbaar

**3. Bridge: poll voor afgeronde taken**

Interval check (elke 10-30 sec) in de bridge:
```
"Zijn er pending_agents met status 'running' waarvan output klaar is?"
→ Ja: lees output, stuur naar chat_id via router.sendMessage(), update status naar 'done'
→ Nee: niets doen
```

**4. Think Loop als fallback**

Als de bridge het niet oppikt (crash, restart):
- Think Loop ziet bij volgende tick: "er is een pending_agent met status 'done' die nog niet naar Telegram is gestuurd"
- Stuurt alsnog

#### Wat past bij de architectuur

- ✅ Router is al kanaal-agnostisch — sub-agent resultaten gaan via dezelfde `sendMessage(chatId, content)`
- ✅ Processing lock bestaat al — hoeven we niet opnieuw uit te vinden
- ✅ Adapters pattern — geen hardcoded Telegram logica
- ❌ Geen hardcoded instructies in de bridge — KITT beslist zelf wanneer een sub-agent zinvol is

### Open vragen

- Hoe detecteert KITT automatisch wanneer een sub-agent beter is dan zelf doen? (waarschijnlijk via prompt instructie, niet hardcoded)
- Moeten sub-agents een skill.md als instructie meekrijgen?
- Max hoeveel sub-agents tegelijk? (token budget, machine resources)
- Hoe gaat de verse sessie (stap 5) weten wat de context was? (via transcripts + pending_agents tabel)

### Volgende stappen

- [ ] `pending_agents` tabel aanmaken in kitt.db
- [ ] Bridge poll mechanisme bouwen (check elke 10-30 sec)
- [ ] Test met browser skill als sub-agent (YouTube transcript use case)
- [ ] Documenteer welke taken geschikt zijn voor sub-agent dispatch
- [ ] Think Loop fallback toevoegen
- [ ] Test met podcast skill als sub-agent
