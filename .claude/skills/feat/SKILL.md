---
name: feat
description: Start een feature bouwen. Gebruik als /feat F## (bijv. /feat F54)
user_invocable: true
args: feature_id
---

# Feature Builder

Start het bouwen van een feature.

## Stappen

1. **Lees de workflow:** `_prd/workflows/AGENT.md`
2. **Lees de feature spec:** `_prd/features/F##_*.md` (zoek op het nummer)
3. **Lees alle docs** uit de "Lees Eerst" sectie van de feature spec
4. **Ga in Plan Mode** en maak een implementatieplan
5. **Wacht op goedkeuring** van het plan
6. **Bouw, test, documenteer** volgens de workflow
7. **Vraag commit toestemming** aan Renier

## Voorbeeld

```
/feat F54
```

Zoekt naar `_prd/features/F54_*.md` en start de workflow.
