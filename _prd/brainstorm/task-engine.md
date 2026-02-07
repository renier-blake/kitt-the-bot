# Brainstorm: Task Engine — KITT's Interne Taaksysteem

> **Datum:** 7 februari 2026 (ochtendwandeling)
> **Context:** Renier dacht na over hoe KITT taken bijhoudt en uitvoert

---

## Het Inzicht

Skills zijn **templates** — ze beschrijven HOE je iets doet.
Taken zijn de **engine** — ze bepalen WAT er moet gebeuren en WANNEER.

```
Nu:    Skills = templates + scheduling + execution (alles in één)
Straks: Tasks  = engine (wat, wanneer, status)
        Skills = templates (hoe)
```

---

## Twee Databases

### 1. Task Database (state)
**Doel:** Alle taken die KITT moet doen. De "variabelen" — wat is de huidige staat?

```sql
CREATE TABLE kitt_tasks (
    id INTEGER PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    frequency TEXT DEFAULT 'once',    -- 'once', 'daily', 'weekly', 'monthly'
    priority TEXT DEFAULT 'medium',   -- 'high', 'medium', 'low'
    skill_refs TEXT,                  -- JSON array: ["daily-reflection", "garmin"]
    time_window_start TEXT,           -- '07:00' - niet voor dit tijdstip
    time_window_end TEXT,             -- '11:00' - niet meer na dit tijdstip
    snoozed_until INTEGER,            -- unix timestamp ms - taak gepauzeerd tot
    next_run INTEGER,                 -- unix timestamp ms - volgende keer checken
    created_by TEXT DEFAULT 'kitt',   -- 'kitt' of 'renier'
    created_at INTEGER DEFAULT (unixepoch() * 1000)
);
```

**Voorbeelden:**

| id | title | frequency | skill_refs | created_by |
|----|-------|-----------|------------|------------|
| 1 | Ochtend reflectie | daily | ["daily-reflection"] | kitt |
| 2 | Avond reflectie | daily | ["daily-reflection"] | kitt |
| 3 | Garmin data ophalen | daily | ["garmin"] | kitt |
| 4 | Ontbijt loggen | daily | ["nutrition-log"] | kitt |
| 5 | Week review | weekly | ["daily-reflection"] | kitt |
| 6 | Boodschappen herinnering | once | ["apple-reminders"] | renier |
| 7 | F45 Flight Search bouwen | once | [] | kitt |

### 2. Task Log (history)
**Doel:** Wanneer is een taak uitgevoerd? De "log" — wat is er al gedaan?

```sql
CREATE TABLE kitt_task_log (
    id INTEGER PRIMARY KEY,
    task_id INTEGER REFERENCES kitt_tasks(id),
    status TEXT NOT NULL,             -- 'sent', 'completed', 'skipped', 'deferred'
    executed_at INTEGER DEFAULT (unixepoch() * 1000),
    notes TEXT                        -- optionele context
);
```

**Voorbeelden:**

| task_id | status | executed_at | notes |
|---------|--------|-------------|-------|
| 1 | sent | 2026-02-07 08:30 | Ochtend reflectie gestuurd |
| 1 | completed | 2026-02-07 08:35 | Renier heeft gereageerd |
| 3 | completed | 2026-02-07 08:30 | Garmin data opgehaald |
| 4 | skipped | 2026-02-07 12:00 | Renier logde zelf ontbijt |

---

## Twee Statussen per Taak

Elke taak kan twee statussen hebben:

| Status | Betekenis | Voorbeeld |
|--------|-----------|-----------|
| **sent** | KITT heeft het gestuurd/gestart | Ochtend reflectie gestuurd via Telegram |
| **completed** | Renier heeft het gedaan/beantwoord | Renier beantwoordde de reflectievragen |
| **skipped** | Bewust overgeslagen | "Later" of niet relevant vandaag |
| **deferred** | Uitgesteld | "Doe maar vanavond" |

Dus: "Heeft KITT het gestuurd?" en "Heeft Renier het uitgevoerd?" zijn twee aparte events in de log.

---

## Think Loop Flow met Tasks

```
Think Loop tick (elke 5 min)
    │
    ▼
┌─────────────────────────────────────────┐
│  1. Query kitt_tasks                     │
│     → Haal alle taken op                │
│     → Filter op frequency               │
│        - daily: nog niet gedaan vandaag? │
│        - weekly: nog niet gedaan deze wk?│
│        - once: nog niet completed?       │
│        - monthly: nog niet deze maand?   │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│  2. Check kitt_task_log                  │
│     → Voor elke taak: wanneer laatst    │
│       uitgevoerd?                        │
│                                          │
│  Daily taak "Ochtend reflectie":        │
│    → Laatste log: gisteren 08:30        │
│    → Vandaag nog niet → OPEN            │
│                                          │
│  Weekly taak "Week review":             │
│    → Laatste log: maandag               │
│    → Deze week al gedaan → SKIP         │
│                                          │
│  Once taak "F45 bouwen":               │
│    → Geen log → OPEN                    │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│  3. Open taken → bekijk skill_refs      │
│     → Laad bijbehorende SKILL.md        │
│     → Voer uit volgens skill template   │
│     → Log resultaat in kitt_task_log    │
└─────────────────────────────────────────┘
```

### Frequency Check Logica

```sql
-- Daily: niet gedaan vandaag?
SELECT t.* FROM kitt_tasks t
WHERE t.frequency = 'daily'
AND t.id NOT IN (
    SELECT task_id FROM kitt_task_log
    WHERE date(executed_at/1000, 'unixepoch', 'localtime') = date('now', 'localtime')
    AND status IN ('sent', 'completed')
);

-- Weekly: niet gedaan deze week?
SELECT t.* FROM kitt_tasks t
WHERE t.frequency = 'weekly'
AND t.id NOT IN (
    SELECT task_id FROM kitt_task_log
    WHERE strftime('%W', datetime(executed_at/1000, 'unixepoch', 'localtime'))
        = strftime('%W', 'now', 'localtime')
    AND status IN ('sent', 'completed')
);

-- Once: nooit completed?
SELECT t.* FROM kitt_tasks t
WHERE t.frequency = 'once'
AND t.id NOT IN (
    SELECT task_id FROM kitt_task_log
    WHERE status = 'completed'
);
```

---

## Skills = Templates, Tasks = Engine

### Hoe het samenhangt:

```
┌──────────────────┐     ┌──────────────────────┐
│   kitt_tasks      │     │   .claude/skills/     │
│   (engine)        │────▶│   (templates)         │
│                   │     │                       │
│ "Ochtend check"  │────▶│ daily-reflection/     │
│ skill: garmin,   │     │ garmin/               │
│   daily-reflect  │     │ nutrition-log/        │
│                   │     │                       │
│ "Log ontbijt"   │────▶│ nutrition-log/        │
│ skill: nutrition │     │                       │
│                   │     │                       │
│ "Week review"   │────▶│ daily-reflection/     │
│ skill: daily-ref │     │                       │
└──────────────────┘     └──────────────────────┘
```

**Skills veranderen niet.** Ze blijven templates met instructies.
**Tasks verwijzen naar skills.** Een taak zegt "doe X met skill Y".
**De Task Engine beslist** wanneer iets moet gebeuren, niet de skill zelf.

### Wat dit oplost:

| Probleem | Oude situatie | Met Task Engine |
|----------|---------------|-----------------|
| Scheduling | In SKILL.md metadata (schedule: daily) | In kitt_tasks (frequency: daily) |
| "Al gedaan?" check | Think Loop leest hele transcript | Query op kitt_task_log |
| KITT eigen taken | Nergens formeel | kitt_tasks met created_by='kitt' |
| Eenmalige taken | Niet ondersteund | frequency='once', auto-cleanup |
| Counter/tracking | Niet mogelijk | COUNT(*) op task_log |

---

## KITT Kan Zelf Taken Aanmaken

KITT kan during een gesprek of Think Loop zelf taken aanmaken:

```
Renier: "Herinner me morgen aan de dokter"
    ↓
KITT maakt task aan:
    title: "Renier herinneren aan dokter"
    frequency: "once"
    skill_refs: []
    created_by: "kitt"
    ↓
Volgende dag: Think Loop ziet open taak → stuurt reminder
    ↓
Na bevestiging: log status = 'completed'
    ↓
Once + completed → kan opgeruimd worden
```

---

## Cleanup

| Frequency | Cleanup regel |
|-----------|---------------|
| once | Verwijder taak + logs na completion |
| daily | Houd taak, logs worden history |
| weekly | Idem |
| monthly | Idem |

Optioneel: `kitt_task_log` entries ouder dan 30 dagen archiveren/verwijderen om de db klein te houden.

---

## Scheduled Skills → Migratie

Huidige scheduled skills (in SKILL.md metadata):

```yaml
metadata: {"kitt":{"schedule":{"frequency":"daily","daypart":"morning"}}}
```

**Migratie:** Schedule metadata uit SKILL.md halen. In plaats daarvan een taak aanmaken in kitt_tasks die naar die skill verwijst.

```
Oud: SKILL.md → schedule: daily, morning
Nieuw: kitt_tasks → frequency: daily, skill_refs: ["daily-reflection"]
```

De skill zelf wordt puur een template. De scheduling logica zit in de Task Engine.

---

## Samenvatting

```
┌─────────────────────────────────────────────────────────┐
│                    KITT Task Engine                       │
│                                                          │
│  kitt_tasks (WAT + WANNEER)                             │
│  ├── Ochtend reflectie (daily)                          │
│  ├── Garmin check (daily)                               │
│  ├── Ontbijt loggen (daily)                             │
│  ├── Week review (weekly)                               │
│  ├── Herinner aan dokter (once)                         │
│  └── ... (KITT kan zelf taken toevoegen)                │
│                                                          │
│  kitt_task_log (STATUS + HISTORY)                        │
│  ├── Task 1: sent 08:30, completed 08:35                │
│  ├── Task 2: completed 08:30                            │
│  └── Task 5: deferred ("doe maar vanavond")             │
│                                                          │
│  .claude/skills/ (HOE)                                   │
│  ├── daily-reflection/ → template voor reflecties       │
│  ├── garmin/ → template voor health data                │
│  ├── nutrition-log/ → template voor voeding             │
│  └── ... (pure templates, geen scheduling)              │
│                                                          │
│  Think Loop (elke 5 min)                                │
│  └── Query open tasks → check log → execute via skill   │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

---

## Time Windows — Wanneer Mag een Taak Draaien?

Elke taak kan een `time_window_start` en `time_window_end` hebben. De Think Loop checkt:
- **Voor start?** → Skip, nog te vroeg
- **Na end?** → Skip voor vandaag, window gemist
- **Binnen window?** → Uitvoeren

### Voorbeelden

| Taak | time_window_start | time_window_end | Logica |
|------|-------------------|-----------------|--------|
| Ochtend reflectie | 07:00 | 11:00 | Alleen 's ochtends. Na 11:00? Dan heeft Renier het niet nodig |
| Ontbijt loggen | 07:00 | 11:00 | Ontbijt check in de ochtend |
| Lunch loggen | 11:30 | 15:00 | Middagslot |
| Avondeten loggen | 17:00 | 21:00 | Dinertijd |
| Avond reflectie | 20:00 | 23:59 | Eind van de dag |
| Garmin data ophalen | NULL | NULL | Geen window = altijd (zodra wakker) |
| Week review | NULL | NULL | Weekelijks, geen vast moment |

### Aparte Maaltijd-taken

Ontbijt, lunch en avondeten zijn **aparte daily taken** met eigen time windows. Niet één "food logging" taak, maar drie:

```
Task 4: "Ontbijt loggen"    → daily, 07:00-11:00, skill: nutrition-log
Task 8: "Lunch loggen"      → daily, 11:30-15:00, skill: nutrition-log
Task 9: "Avondeten loggen"  → daily, 17:00-21:00, skill: nutrition-log
```

Ze verwijzen allemaal naar dezelfde skill (nutrition-log), maar de task engine weet WANNEER ze relevant zijn.

---

## Task-Level Snooze

Snooze werkt op individuele taken. Als Renier zegt "ik wil vandaag geen log reminders", dan snooze je specifieke taken — niet het hele systeem.

### Snooze Scenario's

| Trigger | Actie | Effect |
|---------|-------|--------|
| "Geen food log reminders vandaag" | Snooze tasks 4, 8, 9 tot morgen 00:00 | Alle maaltijd-taken pauzeren |
| "Geen workout shit vandaag" | Snooze alle taken met skill_ref "gym-race-coach" | Training-gerelateerd stil |
| "Later" (op specifieke taak) | Snooze die ene taak 1 uur | Komt terug na een uur |
| "Hou je mond" | Snooze ALLE taken tot Renier iets stuurt | Globale stilte |

### Implementatie

```sql
-- Snooze één taak tot morgen
UPDATE kitt_tasks
SET snoozed_until = strftime('%s', 'now', '+1 day', 'start of day') * 1000
WHERE id = 4;

-- Snooze alle nutrition taken tot morgen
UPDATE kitt_tasks
SET snoozed_until = strftime('%s', 'now', '+1 day', 'start of day') * 1000
WHERE skill_refs LIKE '%nutrition-log%';

-- Snooze alles met een skill_ref match
UPDATE kitt_tasks
SET snoozed_until = strftime('%s', 'now', '+1 day', 'start of day') * 1000
WHERE skill_refs LIKE '%gym-race-coach%';
```

### Think Loop Check

```sql
-- Haal open taken op die NIET gesnoozed zijn
SELECT t.* FROM kitt_tasks t
WHERE (t.snoozed_until IS NULL OR t.snoozed_until < (unixepoch() * 1000))
AND ...  -- frequency check, time window check, etc.
```

---

## next_run — Self-Scheduling

`next_run` is het timestamp waarop de Think Loop een taak opnieuw moet bekijken. Dit is handig voor retry-logica en slim herplannen.

### Scenario's

| Situatie | next_run gedrag |
|----------|-----------------|
| Taak gestuurd, geen reactie na 10 min | next_run = nu + 3 uur (probeer later nog een keer) |
| Taak gestuurd, Renier zegt "later" | next_run = nu + 1 uur |
| Taak gestuurd, Renier reageert | Log completed, clear next_run |
| Once taak, niet urgent | next_run = morgen (check dagelijks) |

### Flow

```
Think Loop tick
    │
    ├── Check: next_run <= now?
    │     ├── Ja → taak is "rijp", bekijk verder (time window, snooze, etc.)
    │     └── Nee → skip, nog niet aan de beurt
    │
    ├── Taak uitgevoerd, status = 'sent'
    │     └── Set next_run = now + 3 uur (retry als geen reactie)
    │
    ├── Reactie ontvangen
    │     └── Log completed, set next_run = NULL
    │
    └── Geen reactie na 2x retry
          └── Log skipped, set next_run = morgen
```

### Voorbeeld SQL

```sql
-- Alle "rijpe" taken die nu bekeken moeten worden
SELECT t.* FROM kitt_tasks t
WHERE (t.next_run IS NULL OR t.next_run <= (unixepoch() * 1000))
AND (t.snoozed_until IS NULL OR t.snoozed_until < (unixepoch() * 1000))
AND (
    -- Time window check
    t.time_window_start IS NULL
    OR (
        strftime('%H:%M', 'now', 'localtime') >= t.time_window_start
        AND (t.time_window_end IS NULL OR strftime('%H:%M', 'now', 'localtime') <= t.time_window_end)
    )
)
-- Plus frequency check (daily/weekly/once/monthly)
```

---

## Prioriteit

Taken hebben een `priority` veld: `high`, `medium`, `low`.

De Think Loop verwerkt taken in volgorde van prioriteit. Als er meerdere open taken zijn in dezelfde tick, gaat high eerst.

### Prioriteit Regels

| Priority | Gedrag | Voorbeeld |
|----------|--------|-----------|
| **high** | Altijd eerst, max 1 per tick | Belangrijke reminder, ziekenhuis bellen |
| **medium** | Na high, max 2-3 per tick | Dagelijkse reflectie, Garmin check |
| **low** | Alleen als er ruimte is | Nice-to-have, achtergrond taken |

### Max Taken per Tick

Niet alles tegelijk sturen. De Think Loop heeft een budget per tick:
- **Max 3 taken per tick** (configureerbaar)
- High priority gaat altijd door, ook als budget op is
- Als er meer open taken zijn dan budget → wacht tot volgende tick

---

## Voorbeeldtabel met Alle Kolommen

| id | title | frequency | priority | skill_refs | time_window | snoozed_until | next_run | created_by |
|----|-------|-----------|----------|------------|-------------|---------------|----------|------------|
| 1 | Ochtend reflectie | daily | medium | ["daily-reflection"] | 07:00-11:00 | NULL | NULL | kitt |
| 2 | Avond reflectie | daily | medium | ["daily-reflection"] | 20:00-23:59 | NULL | NULL | kitt |
| 3 | Garmin data ophalen | daily | medium | ["garmin"] | NULL | NULL | NULL | kitt |
| 4 | Ontbijt loggen | daily | low | ["nutrition-log"] | 07:00-11:00 | NULL | NULL | kitt |
| 8 | Lunch loggen | daily | low | ["nutrition-log"] | 11:30-15:00 | 2026-02-07 | NULL | kitt |
| 9 | Avondeten loggen | daily | low | ["nutrition-log"] | 17:00-21:00 | 2026-02-07 | NULL | kitt |
| 5 | Week review | weekly | medium | ["daily-reflection"] | NULL | NULL | NULL | kitt |
| 6 | Ziekenhuis bellen | once | high | [] | 09:00-17:00 | NULL | NULL | renier |
| 7 | F45 Flight Search | once | low | [] | NULL | NULL | 2026-02-08 | kitt |

> ☝️ Task 8 en 9 zijn gesnoozed tot morgen — Renier zei "geen food log reminders vandaag"

---

## Open Vragen

- Max taken per tick — configureerbaar? Of hardcoded op 3?
- Taak dependencies — "doe B pas na A is completed"
- Globale snooze vs per-taak snooze — aparte globale snooze flag nodig?
- Auto-priority: kan KITT zelf priority aanpassen op basis van urgentie/deadline?
- next_run retry limiet: na hoeveel retries geeft KITT op?
