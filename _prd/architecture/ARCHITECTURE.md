# KITT Architecture Principles

> **Doel:** Centrale source of truth voor architectuur beslissingen.
> **Status:** Verplichte lezing voor alle agents die aan KITT werken.

---

## Principe 1: Configuratie Buiten Code

**Regel:** Instructies, prompts, en gedrag worden NOOIT hardcoded in TypeScript/JavaScript.

### Waar configuratie hoort

| Type | Locatie | Voorbeeld |
|------|---------|-----------|
| Agent instructies | `profile/context/instructions/*.md` | `core.md`, `think-loop.md` |
| Context configuratie | `profile/context/blocks.json` | Welke blocks laden per mode |
| Identity & personality | `profile/identity/*.md` | `IDENTITY.md`, `SOUL.md` |
| User info | `profile/user/*.md` | `USER.md` |
| Skill definities | `.claude/skills/*/SKILL.md` | Skill instructies |
| Task types | `profile/context/*.json` | Task configuratie |

### Code laadt configuratie

```typescript
// GOED: Code laadt configuratie
const config = await loadBlocksConfig('profile/context/blocks.json');
const systemPrompt = await buildContext({ mode: 'chat' });

// FOUT: Hardcoded instructies in code
const systemPrompt = `Je bent KITT. Gedraag je zo en zo...`; // NOOIT DOEN
```

### Bestaande implementatie

De context builder (`src/context/builder.ts`) is het voorbeeld:
1. Leest `blocks.json` voor configuratie
2. Laadt `.md` files voor content
3. Combineert tot system prompt
4. Geen hardcoded tekst in code

---

## Principe 2: Database voor State

**Regel:** Alle persistente state gaat in SQLite, niet in JSON files.

### Database locatie

```
profile/data/kitt.db
```

### Tabellen

| Tabel | Doel |
|-------|------|
| `portal_projects` | Projecten (PAS, KITT, etc.) |
| `portal_issues` | Issues met state, priority, complexity, scope |
| `portal_triage` | Automatisch gevonden issues |
| `portal_cycles` | Sprint cycles |
| `portal_labels` | Issue labels |
| `transcripts` | Conversatie history |
| `chunks` | Geïndexeerde memory chunks (vector search) |
| `kitt_tasks` | Task Engine taken |
| `capabilities` | Tools & skills registry (modes, execution type) |
| `background_tasks` | Async task tracking |
| `credentials` | Encrypted credential vault |
| `integrations` | OAuth integrations (Nango) |
| `agent_executions` | Agent Pool history (persistent over restarts) |
| `meta` | Key-value settings (agent_mode, etc.) |

### Conventies

- **Tabel namen:** `snake_case`, prefix met domein (`portal_`, `memory_`, `kitt_`)
- **Kolom namen:** `snake_case`
- **Timestamps:** Unix milliseconds (`unixepoch() * 1000`)
- **JSON data:** Stored as TEXT, parsed in code

---

## Principe 3: API Response Format

**Regel:** Consistente JSON responses in camelCase.

### Success response

```json
{
  "issues": [...],
  "projects": [...],
  "success": true
}
```

### Error response

```json
{
  "error": "Beschrijving van de fout",
  "code": 400
}
```

### Mapping database → API

Database kolommen (`snake_case`) worden gemapped naar API responses (`camelCase`):

```typescript
// In API endpoint
const issues = result.rows.map((row) => ({
  id: Number(row.id),
  projectId: Number(row.project_id),      // snake_case → camelCase
  createdAt: Number(row.created_at),
  updatedAt: Number(row.updated_at),
}));
```

---

## Principe 4: Component Locaties

**Regel:** Elk type component heeft een vaste locatie.

```
KITT V1/
├── .claude/skills/           # Skill definities (SKILL.md)
├── profile/
│   ├── identity/             # KITT personality files
│   ├── user/                 # User info
│   ├── context/
│   │   ├── blocks.json       # Context configuratie
│   │   └── instructions/     # Agent instructies (incl. classifier.md)
│   └── data/
│       └── kitt.db           # SQLite database
├── src/
│   ├── bridge/               # Telegram/WhatsApp bridge + agent pool
│   ├── context/              # Context builder + loaders
│   ├── scheduler/            # Think loop, task engine, background runner
│   ├── memory/               # Memory service (vector search)
│   ├── capabilities/         # Capabilities registry
│   ├── credentials/          # Encrypted credential vault
│   └── integrations/         # Nango OAuth, externe APIs
├── frontends/portal/         # KITT Portal (React)
└── _prd/                     # Documentatie
```

### Waar nieuwe code hoort

| Nieuw component | Locatie |
|-----------------|---------|
| Nieuwe skill | `.claude/skills/[naam]/SKILL.md` |
| Nieuwe instructie | `profile/context/instructions/[naam].md` |
| Nieuwe loader | `src/context/loaders/[naam].ts` |
| Nieuwe API endpoint | `src/bridge/log-server.ts` |
| Nieuwe integratie | `src/integrations/[naam].ts` |
| Nieuwe Portal pagina | `frontends/portal/src/pages/` |
| Nieuwe capability | `src/capabilities/seed.ts` (dan reseed) |
| Credential access | Via `src/credentials/index.ts` |

---

## Principe 5: Logging

**Regel:** Gestructureerde logging met module prefix.

```typescript
console.log('[context-builder] Loading blocks.json');
console.warn('[scheduler] Task timeout exceeded');
console.error('[bridge] Failed to send message', { error });
```

### Prefixes

| Module | Prefix |
|--------|--------|
| Context builder | `[context-builder]` |
| Scheduler | `[scheduler]` |
| Think loop | `[think-loop]` |
| Bridge | `[bridge]` |
| Memory | `[memory]` |
| Task engine | `[task-engine]` |
| Classifier | `[classifier]` |
| Background runner | `[background-runner]` |
| Agent pool | `[agent-pool]` |
| Task registry | `[task-registry]` |
| Capabilities | `[capabilities]` |
| Skills loader | `[skills-loader]` |

---

## Principe 6: Modes & Blocks

**Regel:** Nieuwe agent modes worden geconfigureerd, niet gecodeerd.

### Bestaande modes

| Mode | Gebruik | Configuratie |
|------|---------|--------------|
| `chat` | Telegram/WhatsApp conversatie | blocks.json `modes: ["chat"]` |
| `think` | Think loop (autonoom) | blocks.json `modes: ["think"]` |

### Nieuwe mode toevoegen

1. Voeg blocks toe aan `blocks.json` met nieuwe mode
2. Maak instructie file in `profile/context/instructions/`
3. Roep `buildContext({ mode: 'nieuwe-mode' })` aan

```json
// blocks.json
{
  "id": "classifier-instructions",
  "type": "instruction",
  "path": "profile/context/instructions/classifier.md",
  "modes": ["classifier"],  // Nieuwe mode
  "priority": 100,
  "enabled": true
}
```

---

## Anti-Patterns

### NIET DOEN

| Anti-pattern | Waarom fout | Oplossing |
|--------------|-------------|-----------|
| Hardcoded prompts in `.ts` | Niet configureerbaar | Gebruik `.md` files |
| State in JSON files | Niet queryable | Gebruik SQLite |
| camelCase in database | Inconsistent | Gebruik snake_case |
| Nieuwe folders voor elke feature | Verwarrend | Volg bestaande structuur |
| Logging zonder prefix | Niet traceerbaar | Gebruik `[module]` prefix |

---

## Checklist voor Nieuwe Features

Voordat je bouwt, check:

- [ ] Instructies gaan in `.md` files, niet in code
- [ ] State gaat in `kitt.db`, niet in JSON
- [ ] API responses zijn camelCase
- [ ] Database queries gebruiken snake_case
- [ ] Logging heeft `[module]` prefix
- [ ] Component staat op de juiste locatie
- [ ] Configuratie via `blocks.json` of JSON config

---

## Gerelateerde Docs

| Doc | Inhoud |
|-----|--------|
| `_prd/architecture/overview.md` | System overview |
| `_prd/architecture/context.md` | Context builder details |
| `_prd/architecture/orchestrator.md` | Message routing & background tasks |
| `_prd/architecture/agent-pool.md` | Agent Pool — registry, timeouts, persistence |
| `_prd/workflows/AGENT.md` | Agent workflow |
| `CLAUDE.md` | Quick reference |
