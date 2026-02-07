# F39: Docs Consolidatie

> **Priority:** P3
> **Status:** 📝 Spec
> **Owner:** -

---

## Overview

Documentatie opschonen: verouderde docs weg, duplicatie fixen.

---

## Huidige Situatie

| File | Status |
|------|--------|
| `_prd/MVP.md` | Verouderd (5 feb), niet meer relevant |
| `_prd/BASELINE.md` | Goed, maar naam is verwarrend |
| `_prd/FEATURE-STATUS.md` | Overlap met STATUS.md |
| `_prd/STATUS.md` | Single source of truth |
| `_prd/THINK-LOOP.md` | Goed (na F35 update) |

---

## Wijzigingen

### 1. Verwijderen
- `_prd/MVP.md` - Verouderd

### 2. Hernoemen
- `_prd/BASELINE.md` → `_prd/ARCHITECTURE.md`

### 3. Mergen
- `_prd/FEATURE-STATUS.md` → in `_prd/STATUS.md`
- Dan FEATURE-STATUS.md verwijderen

### 4. Updaten
- `CLAUDE.md` - References updaten
- `profile/identity/SOUL.md` - Technische think loop sectie verwijderen (staat in THINK-LOOP.md)

---

## Na Cleanup

```
_prd/
├── STATUS.md          # Single source (+ feature status)
├── BACKLOG.md         # Feature backlog
├── ARCHITECTURE.md    # (was BASELINE.md)
├── THINK-LOOP.md      # Think loop docs
├── WORKFLOW.md        # PO workflow
└── features/          # Feature specs
```

---

## Acceptance Criteria

- [ ] MVP.md verwijderd
- [ ] BASELINE.md hernoemd naar ARCHITECTURE.md
- [ ] FEATURE-STATUS.md gemerged in STATUS.md
- [ ] CLAUDE.md references werken
- [ ] SOUL.md bevat geen technische think loop uitleg
