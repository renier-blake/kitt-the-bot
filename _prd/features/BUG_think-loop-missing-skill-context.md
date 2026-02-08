# BUG: Think Loop laadt skill content niet meer

**Status:** ✅ Fixed
**Prioriteit:** High
**Ontdekt:** 7 feb 2026

## Probleem

De Think Loop agent krijgt de inhoud van SKILL.md files niet meer mee in z'n context. Dit was eerder wél het geval, maar is verwijderd om tokens te besparen.

Gevolg: bij het uitvoeren van taken (ACTION: TASK) improviseert het model in plaats van de skill instructies te volgen. De agent heeft wél tools (bash, file read via Agent SDK), maar weet niet DAT hij de SKILL.md moet lezen omdat de instructies ontbreken in z'n prompt.

### Voorbeelden

1. **Dagelijkse energiebalans (task #4):** Agent stuurt verkeerde cijfers (522 kcal ipv 546 kcal) omdat hij de food_log niet queried — hij hallucineert data ipv de SQL uit de skill te gebruiken.
2. **KITT zelfreflectie (task #7):** Agent reflecteert op verouderde/verzonnen data ipv de transcripts van vandaag op te halen zoals de SKILL.md beschrijft.

## Oorzaak

In `src/scheduler/think-loop.ts` staat een bewuste comment:

```
// NOTE: skillContent removed - too large for think prompt, agent can read SKILL.md if needed via tools
```

De Think Loop agent draait via `runAgent` (Agent SDK) en heeft dezelfde tools als de chat agent. Maar haiku kiest niet zelf om de SKILL.md te lezen — hij improviseert op basis van de skill naam/beschrijving.

## Fix (8 feb 2026)

### Wat

In `buildThinkLoopContext()` in `src/scheduler/think-loop.ts`:
- De `discoverThinkLoopSkills()` functie laadt al de skill metadata (naam, beschrijving, trigger)
- **Toevoeging:** ook de volledige SKILL.md content laden per skill
- Het `ThinkLoopSkill` interface krijgt een `skillContent` field terug
- In `buildThinkPrompt()` wordt de skill content meegestuurd bij elke skill

### Waar

| File | Wijziging |
|------|-----------|
| `src/scheduler/think-loop.ts` | `ThinkLoopSkill.skillContent` field toevoegen |
| `src/scheduler/think-loop.ts` | `discoverThinkLoopSkills()` — SKILL.md content inlezen |
| `src/scheduler/think-loop.ts` | `buildThinkPrompt()` — skill content tonen in prompt |

### Impact

- Meer tokens per Think Loop tick (alle skill files worden meegeladen)
- Betere taakuitvoering: agent volgt skill instructies ipv improviseren

## Gerelateerde files

- `src/scheduler/think-loop.ts` — `buildThinkPrompt()` en `discoverThinkLoopSkills()`
- `.claude/skills/*/SKILL.md` — skill instructies
