# Autonomous Dev Flywheel

> Brainstorm: een zelfbouwend systeem waarin features van idee tot productie lopen zonder handmatige interventie.
> Aangemaakt: 8 feb 2026

---

## Visie

Een loop waarin:
1. Features worden geïdentificeerd (door Renier of door KITT zelf)
2. Ze automatisch worden uitgewerkt (spec, dependencies, plan)
3. Een agent ze oppakt en bouwt
4. De Think Loop checkt of er iets nieuws is gebouwd
5. Resultaten worden gerapporteerd
6. → Terug naar 1

**Het flywheel:** hoe meer features gebouwd, hoe beter het systeem, hoe meer features het kan bouwen.

---

## Feature Lifecycle

```
💡 Idee → 📝 Spec → 📋 Gepland → 🔨 In Progress → ✅ Done → 📊 Reported
```

| Status | Betekenis | Wie |
|--------|-----------|-----|
| 💡 Idee | Concept, nog niet uitgewerkt | Renier of KITT |
| 📝 Spec | Uitgewerkt, requirements duidelijk | PO (KITT of Renier) |
| 📋 Gepland | Klaar om opgepakt te worden, alle info aanwezig | PO |
| 🔨 In Progress | Agent is aan het bouwen | Sub-agent (opus) |
| ✅ Done | Gebouwd, getest, gedeployed | Agent |
| 📊 Reported | Think Loop heeft resultaat gerapporteerd aan Renier | Think Loop |

---

## Architectuur

### Backlog (database)

Features tabel in `kitt.db`:

| Kolom | Type | Beschrijving |
|-------|------|-------------|
| id | INTEGER | Feature ID (F-nummer) |
| title | TEXT | Feature titel |
| status | TEXT | idee / spec / gepland / in_progress / done |
| priority | TEXT | high / medium / low |
| description | TEXT | Korte beschrijving |
| spec_path | TEXT | Pad naar feature spec (MD file) |
| depends_on | JSON | Feature IDs die eerst klaar moeten zijn |
| model | TEXT | Welk model moet dit bouwen (haiku/sonnet/opus) |
| assigned_to | TEXT | 'think-loop' / 'agent' / null |
| created_by | TEXT | 'kitt' / 'renier' |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

### Frontend (Kanban)

In het portal (voor Renier):
- Linear-style kanban board
- Kolommen: Idee → Spec → Gepland → In Progress → Done
- Drag & drop voor prioriteit
- Detail view met spec, logs, dependencies

### Think Loop integratie

De Think Loop krijgt een extra check:
1. **Zijn er geplande features?** → Pak de hoogste prioriteit op
2. **Is er een feature in progress?** → Check status, rapporteer als klaar
3. **Zijn er nieuwe ideeën?** → Eventueel zelf uitwerken tot spec

### Sub-agent executie

Als de Think Loop een feature oppakt:
1. Lees de spec (MD file)
2. Start een sub-agent met het juiste model (opus voor dev, haiku voor simpele taken)
3. Sub-agent volgt de Agent Workflow (`_prd/workflows/AGENT.md`)
4. Resultaat wordt gelogd
5. Think Loop rapporteert aan Renier via Telegram

---

## Task-Level Model Selectie

**Belangrijk inzicht:** niet elke taak heeft hetzelfde model nodig.

| Taak type | Model | Reden |
|-----------|-------|-------|
| Reminder/check | haiku | Simpel, snel, goedkoop |
| Nutrition log | haiku | Query + format |
| Blog schrijven | sonnet/opus | Creativiteit nodig |
| Zelfreflectie | sonnet/opus | Diep nadenken, verbanden leggen |
| Feature bouwen | opus | Complexe code, architectuur |
| Bug fixen | sonnet | Code begrip nodig |

### Implementatie

`kitt_tasks` tabel uitbreiden met `model` kolom:

```sql
ALTER TABLE kitt_tasks ADD COLUMN model TEXT DEFAULT 'haiku';
```

De Think Loop leest het model per task en geeft het door aan `runAgent`:

```typescript
const model = task.model || 'haiku';
const response = await runAgent(prompt, { model });
```

---

## Vereisten

Om dit te bouwen hebben we nodig:

1. **Features tabel in DB** — backlog met statuses en dependencies
2. **Task-level model selectie** — `model` kolom in kitt_tasks
3. **Kanban UI in portal** — Linear-style board
4. **Think Loop uitbreiding** — feature pickup en rapportage
5. **Sub-agent spawning** — vanuit Think Loop een opus agent starten voor complexe taken

---

## Open vragen

- Hoeveel autonomie krijgt KITT om zelf features te plannen?
- Budget/rate limits per model? (opus is duurder)
- Hoe voorkomen we dat KITT in een loop raakt van features bouwen die nergens toe leiden?
- Moet Renier features goedkeuren voordat ze "gepland" worden, of mag KITT dat zelf?

---

## Relatie tot andere features

| Feature | Relatie |
|---------|--------|
| Portal Restyling (brainstorm) | Kanban board is onderdeel hiervan |
| Task Engine (brainstorm) | Model selectie uitbreiding |
| F59 Agent Rules | Regels voor autonome dev |
| F58 KITT Self-Reflection | Kan features identificeren uit reflecties |
