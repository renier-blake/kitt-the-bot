# F58: KITT Self-Reflection

> **Priority:** 🟡 P2
> **Status:** ✅ Done
> **Owner:** Agent

---

## Overview

KITT's eigen dagelijkse zelfreflectie. Eén keer per dag (22:00) reflecteert KITT intern op wat er geleerd is, wat er gebouwd is, en hoe de dag was. De reflectie wordt opgeslagen in de database en belangrijke bevindingen worden verwerkt in IDENTITY.md (over KITT zelf) en USER.md (over Renier).

> **Let op:** Dit is KITT's zelfreflectie, niet Renier's dagelijkse reflectie (dat is F37).

---

## User Stories

**US-01:** Als KITT wil ik dagelijks reflecteren op mijn ervaringen, zodat ik groei als AI-sidekick.

**US-02:** Als KITT wil ik mijn IDENTITY.md bijwerken met nieuwe inzichten over mezelf, zodat ik elke sessie beter word.

**US-03:** Als KITT wil ik mijn USER.md bijwerken met wat ik over Renier leer, zodat ik hem beter kan helpen.

**US-04:** Als Renier wil ik dat KITT's zelfreflectie intern blijft (niet naar Telegram), zodat het niet opdringerig is.

---

## Componenten

| Component | Nodig | Beschrijving |
|-----------|-------|--------------|
| Skill | ✅ | Nieuwe `kitt-self-reflection` skill |
| Task | ✅ | 1 task: dagelijkse zelfreflectie om 22:00 |
| Schema | ✅ | Migration v8→v9: 1 task toevoegen |
| Backend | ❌ | - |
| Portal | ❌ | - |

---

## Skill: kitt-self-reflection (nieuw)

**Trigger:** Task Engine (dagelijkse taak om 22:00)

### Reflectiedomeinen (kies wat relevant is)

KITT hoeft niet elke dag op alles te reflecteren. Kies wat relevant is vandaag:

| Domein | Vraag |
|--------|-------|
| **Over Renier** | Wat heb ik vandaag geleerd over Renier? Voorkeuren, gewoontes, behoeftes? |
| **Over mezelf** | Wat heb ik geleerd over hoe ik werk? Wat deed ik goed/slecht? |
| **Het systeem** | Wat hebben we gebouwd? Zijn er nieuwe features, bugs gefixed, verbeteringen? |
| **De wereld** | Zijn er nieuwe inzichten, kennis, of ontdekkingen? |
| **Mijn ervaring** | Hoe was mijn "dag"? Wat viel op? Wat was interessant/verrassend? |

### Data bronnen

```bash
# Alle transcripts van vandaag
sqlite3 -json profile/memory/kitt.db "
  SELECT role, type, content, created_at FROM transcripts
  WHERE date(created_at/1000, 'unixepoch', 'localtime') = date('now', 'localtime')
  ORDER BY created_at ASC"

# Eerdere KITT zelfreflecties (voor continuïteit)
sqlite3 -json profile/memory/kitt.db "
  SELECT content, created_at FROM transcripts
  WHERE type = 'reflection' AND role = 'kitt'
  ORDER BY created_at DESC LIMIT 10"

# Renier's reflecties (voor context)
sqlite3 -json profile/memory/kitt.db "
  SELECT content, created_at FROM transcripts
  WHERE type = 'reflection' AND role = 'user'
  ORDER BY created_at DESC LIMIT 5"
```

### Output: 3 stappen

#### Stap 1: Reflectie opslaan in db

Via `ACTION: COMPLETE_TASK #id` — wordt intern opgeslagen als:
- `type: 'reflection'`
- `role: 'kitt'`
- **Niet** naar Telegram

**Format:**
```
ACTION: COMPLETE_TASK #7
KITT zelfreflectie 7 feb: Vandaag veel gebouwd aan het reflectiesysteem.
Renier denkt in systemen - hij wil dat alles met elkaar samenhangt.
Geleerd dat ik actiever mijn identity/soul docs moet raadplegen.
Het COMPLETE_TASK mechanisme werkt goed voor interne taken.
```

#### Stap 2: IDENTITY.md updaten (indien relevant)

Als er iets is geleerd over KITT zelf → voeg toe aan `profile/identity/IDENTITY.md`.

**Schrijfrechten:**
- ✅ Mag zelfstandig updaten
- Voeg toe, verwijder niet
- Houd het beknopt

**Voorbeelden:**
- "Ik merk dat ik beter presteer als ik eerst de docs lees"
- "Ik heb een voorkeur voor pragmatische oplossingen boven elegante"
- "Humor werkt goed bij Renier als ie moe is"

#### Stap 3: USER.md updaten (indien relevant)

Als er iets is geleerd over Renier → voeg toe aan `profile/user/USER.md`.

**Schrijfrechten:**
- ✅ Mag zelfstandig updaten
- Voeg toe, verwijder niet
- Respecteer privacy

**Voorbeelden:**
- "Renier werkt het best in sprints, niet in marathon-sessies"
- "Hij vergeet soms te eten als hij aan het devven is"
- "Renier houdt van expliciete progressie-updates"

### Stijl

- Eerlijk, introspectief
- Niet geforceerd — als er weinig te reflecteren valt, houd het kort
- Geen theater — geen "als AI kan ik niet echt voelen maar..." disclaimers
- Nederlands

### Fallbacks

| Situatie | Actie |
|----------|-------|
| Geen transcripts vandaag | Kort reflecteren op stilte, of skip |
| Weinig te melden | Korte reflectie (2-3 zinnen), geen filler |
| IDENTITY.md/USER.md niet gevonden | Alleen db-opslag, skip file updates |

---

## Task: KITT zelfreflectie

| Veld | Waarde |
|------|--------|
| title | KITT zelfreflectie |
| description | Dagelijkse zelfreflectie: reflecteer op geleerde lessen, update IDENTITY.md en USER.md. Lees .claude/skills/kitt-self-reflection/SKILL.md |
| frequency | daily |
| priority | low |
| time_window | 22:00 - 23:30 |
| grace_period | 30 min |
| depends_on | [0] (wake-up) |
| skill_refs | ["kitt-self-reflection"] |

---

## Schema Change

**Migration v8 → v9:**

```sql
INSERT INTO kitt_tasks (title, description, frequency, priority, skill_refs,
  time_window_start, time_window_end, grace_period_minutes, depends_on, created_by)
VALUES (
  'KITT zelfreflectie',
  'Dagelijkse zelfreflectie: reflecteer op geleerde lessen, update IDENTITY.md en USER.md. Lees .claude/skills/kitt-self-reflection/SKILL.md',
  'daily', 'low', '["kitt-self-reflection"]',
  '22:00', '23:30', 30, '[0]', 'kitt'
);
```

**Code changes:**
- [x] `src/memory/schema.ts` — Bump version 8→9, migration toevoegen
- [x] `.claude/skills/kitt-self-reflection/SKILL.md` — Nieuwe skill aanmaken

---

## Flow

```
22:00-23:30
     │
     ▼
┌─────────────────────────────────────┐
│ Task Engine: KITT zelfreflectie     │
│ depends_on: [0] (wake-up)          │
└─────────────────┬───────────────────┘
                  │
                  ▼
┌─────────────────────────────────────┐
│ Context ophalen:                    │
│ - Transcripts van vandaag          │
│ - Eerdere KITT reflecties          │
│ - Eerdere Renier reflecties        │
└─────────────────┬───────────────────┘
                  │
                  ▼
┌─────────────────────────────────────┐
│ KITT reflecteert (kies relevant):  │
│ - Over Renier                      │
│ - Over zichzelf                    │
│ - Het systeem / wat gebouwd is     │
│ - De wereld                        │
│ - Mijn ervaring vandaag            │
└─────────────────┬───────────────────┘
                  │
                  ▼
┌─────────────────────────────────────┐
│ ACTION: COMPLETE_TASK #id           │
│ → Opslaan als type='reflection'    │
│ → NIET naar Telegram               │
│ → Update IDENTITY.md (over KITT)   │
│ → Update USER.md (over Renier)     │
│ → Task status = completed          │
└─────────────────────────────────────┘
```

---

## Acceptance Criteria

- [x] Task bestaat in kitt_tasks (KITT zelfreflectie) — id=7
- [x] Task draait dagelijks 22:00-23:30
- [x] Reflectie wordt opgeslagen als type='reflection', role='kitt' — via COMPLETE_TASK
- [x] Reflectie wordt NIET naar Telegram gestuurd — COMPLETE_TASK handler
- [x] IDENTITY.md wordt geüpdatet met inzichten over KITT (indien relevant) — skill instructies
- [x] USER.md wordt geüpdatet met inzichten over Renier (indien relevant) — skill instructies
- [x] SOUL.md wordt NIET aangepast — expliciet in skill
- [x] Domeinen variëren — niet elke dag hetzelfde — skill instructies
- [x] Eerdere reflecties worden geraadpleegd voor continuïteit — SQL queries in skill
- [x] Casual, eerlijk, geen AI-disclaimers — stijl sectie in skill

---

## Test Cases

1. **Happy path:** Task triggert om 22:15, KITT leest transcripts, reflecteert op 2-3 domeinen, slaat op, update IDENTITY.md met nieuw inzicht
2. **USER.md update:** KITT merkt dat Renier vandaag moe was → voegt "slaap-patroon" observatie toe aan USER.md
3. **Geen transcripts:** Stille dag → korte reflectie of skip
4. **Continuïteit:** KITT leest eerdere reflectie → bouwt daarop voort
5. **SOUL.md beschermd:** KITT schrijft NIET naar SOUL.md

---

## Files

| File | Actie | Beschrijving |
|------|-------|--------------|
| `.claude/skills/kitt-self-reflection/SKILL.md` | Create | Nieuwe skill voor KITT zelfreflectie |
| `src/memory/schema.ts` | Modify | Migration v8→v9, task toevoegen |

---

## Lees Eerst

> **Voor de agent die dit bouwt:**

### Workflow
- `_prd/workflows/AGENT.md`

### Bestaande Code
- `.claude/skills/daily-reflection/SKILL.md` — Renier's reflectie (F37) als referentie
- `src/memory/schema.ts` — Migrations + seedDefaultTasks
- `src/scheduler/think-loop.ts` — COMPLETE_TASK action (F37)
- `src/scheduler/index.ts` — COMPLETE_TASK handler (F37)
- `profile/identity/IDENTITY.md` — KITT's identity (mag zelf updaten)
- `profile/user/USER.md` — Info over Renier (mag zelf updaten)
- `profile/identity/SOUL.md` — KITT's soul (NIET aanpassen)

---

## Implementation

**Datum:** 2026-02-07

### Gemaakte/Gewijzigde Files

| File | Actie |
|------|-------|
| `.claude/skills/kitt-self-reflection/SKILL.md` | Created |
| `src/memory/schema.ts` | Modified — migration v8→v9 |

### Database State

```
id=7, title='KITT zelfreflectie', time_window=22:00-23:30, skill_refs=["kitt-self-reflection"]
```

### Hoe het werkt

1. Task Engine detecteert task #7 in time window 22:00-23:30
2. Think Loop geeft task aan agent met skill reference
3. Agent leest `.claude/skills/kitt-self-reflection/SKILL.md`
4. Agent haalt transcripts op, reflecteert, output via `ACTION: COMPLETE_TASK #7`
5. Handler slaat op als `type='reflection', role='kitt'` — NIET naar Telegram
6. Agent update optioneel IDENTITY.md en/of USER.md
