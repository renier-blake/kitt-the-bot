# Agent Workflow

> Workflow voor agents die features bouwen.

---

## Jouw Rol

Als **Agent** bouw je features:
- Code schrijven
- Skills/tasks implementeren
- Testen
- Documenteren
- Committen (na goedkeuring)

**Wat je NIET doet:**
- Feature specs maken (dat doet de PO)
- Priorities bepalen
- Zonder toestemming committen

---

## Feature Starten

```
/start F##
```

Of handmatig:
1. Lees de feature spec: `_prd/features/F##_[naam].md`
2. Lees ALLE docs in de "Lees Eerst" sectie
3. Bouw de feature

---

## Workflow Stappen

### 1. LEZEN

Lees alle documenten uit de "Lees Eerst" sectie van de feature spec:
- Workflow docs
- Architecture docs
- Bestaande code references

**Doel:** Begrijp de context voordat je bouwt.

### 2. BOUWEN

Implementeer volgens het plan:
- Schrijf code
- Maak skills/tasks aan
- Voer migrations uit

**Per component:**
- Schema → `src/memory/schema.ts`
- Task Engine → `src/scheduler/task-engine.ts`
- Skill → `.claude/skills/[naam]/SKILL.md`
- Task data → SQL INSERT in schema.ts of handmatig

### 3. TESTEN

Test alle acceptance criteria uit de feature spec:
- Happy path
- Edge cases
- Error cases

**Als tests falen:** Fix en test opnieuw.

### 4. DOCUMENTEREN

Update de feature spec:
- Vul "Implementation" sectie in
- Lijst gewijzigde/gemaakte files
- Noteer belangrijke beslissingen

### 5. COMMITTEN

**Vraag toestemming** aan Renier:
> "Feature F## is klaar. Mag ik committen?"

Na goedkeuring:
```bash
git add [specific files]
git commit -m "F##: [beschrijving]"
```

### 6. HANDOVER

Meld aan PO:
> "Feature F## is gecommit. Klaar voor handover."

---

## Code Conventies

- **Taal:** Nederlands (docs), Engels (code)
- **Logging:** `[component]` prefix (bijv. `[task-engine]`, `[schema]`)
- **Comments:** Alleen waar nodig, code moet zelf-documenterend zijn

---

## Skill Maken

Locatie: `.claude/skills/[naam]/SKILL.md`

Structuur:
```markdown
---
name: skill-naam
description: Korte beschrijving voor skill discovery
requirements:
  bins:
    - python3  # indien nodig
---

# Skill Naam

Uitleg wat de skill doet.

## Commands / Queries

Hoe data ophalen of acties uitvoeren.

## Output Format

Hoe de output eruit moet zien.

## Examples

Concrete voorbeelden.

## Fallbacks

Wat te doen bij errors.
```

---

## Task Toevoegen

In `src/memory/schema.ts` (seedDefaultTasks) of via SQL:

```sql
INSERT INTO kitt_tasks (
  title,
  description,
  frequency,        -- 'once', 'daily', 'weekly', 'monthly'
  priority,         -- 'high', 'medium', 'low'
  skill_refs,       -- '["skill-name"]'
  time_window_start,-- 'HH:MM'
  time_window_end,  -- 'HH:MM'
  grace_period_minutes,
  depends_on,       -- '[1, 2, 3]' of NULL
  created_by        -- 'kitt' of 'renier'
) VALUES (...);
```

---

## Troubleshooting

| Probleem | Oplossing |
|----------|-----------|
| Feature spec onduidelijk | Vraag PO om verduidelijking |
| Blocked door dependency | Check of dependency klaar is, anders wacht |
| Tests falen | Fix code, niet de test (tenzij test fout is) |
| Merge conflicts | Los op, commit niet met `--no-verify` |
