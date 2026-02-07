# F##: [Feature Name]

> **Priority:** 🟠 P1 | 🟡 P2
> **Status:** 📝 Spec | 🔄 In Progress | ✅ Done
> **Owner:** -

---

## Overview

[Korte beschrijving: wat en waarom]

---

## User Stories

**US-01:** Als Renier wil ik [actie], zodat [reden].

---

## Componenten

| Component | Nodig | Beschrijving |
|-----------|-------|--------------|
| Skill | ❌/✅ | [naam + wat het doet] |
| Task | ❌/✅ | [wanneer, frequency, depends_on] |
| Schema | ❌/✅ | [welke changes] |
| Backend | ❌/✅ | [welke module] |
| Portal | ❌/✅ | [welke pagina/component] |

---

<!-- ALLEEN INVULLEN ALS SKILL NODIG -->
## Skill: [naam]

**Trigger:** [user vraagt / task initieert]

**Data bronnen:**
| Data | Bron | Query/Command |
|------|------|---------------|
| ... | ... | ... |

**Output format:**
```
[voorbeeld output]
```

**Fallbacks:**
| Situatie | Actie |
|----------|-------|
| ... | ... |

---

<!-- ALLEEN INVULLEN ALS TASK NODIG -->
## Task: [titel]

| Veld | Waarde |
|------|--------|
| title | [titel] |
| frequency | once / daily / weekly / monthly |
| priority | high / medium / low |
| time_window | HH:MM - HH:MM |
| grace_period | [x] min |
| depends_on | [task IDs] of NULL |
| skill_refs | ["skill-naam"] |

---

<!-- ALLEEN INVULLEN ALS SCHEMA NODIG -->
## Schema Change

**Migration v[X] → v[Y]:**

```sql
-- Beschrijf de SQL changes
```

**Code changes:**
- [ ] `src/memory/schema.ts` - Migration toevoegen
- [ ] `src/scheduler/task-engine.ts` - Types/logic updaten (indien nodig)

---

## Flow

```
[ASCII diagram van de flow]
```

---

## Acceptance Criteria

- [ ] Criteria 1
- [ ] Criteria 2
- [ ] Criteria 3

---

## Test Cases

1. **Happy path:** [beschrijving]
2. **Edge case:** [beschrijving]
3. **Error case:** [beschrijving]

---

## Files

| File | Actie | Beschrijving |
|------|-------|--------------|
| `path/to/file` | Create/Modify | Beschrijving |

---

## Lees Eerst

> **Voor de agent die dit bouwt:**

### Workflow
- `_prd/workflows/AGENT.md`

### Architecture
- `_prd/architecture/overview.md`
- [andere relevante docs]

### Bestaande Code
- [relevante files]

---

<!-- NA COMPLETION INVULLEN -->
## Implementation

### Wat is gebouwd

[Korte beschrijving]

### Beslissingen

- [Belangrijke keuze en waarom]
