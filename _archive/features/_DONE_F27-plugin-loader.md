# F27: Plugin Loader

> **Priority:** 🟠 P1
> **Status:** ✅ Done
> **Owner:** KITT
> **Triggered by:** User request "start f27"
> **Started:** 5 februari 2026
> **Completed:** 5 februari 2026

---

## Overview

Bouw een plugin/skill loader die:
1. Skills uit `skills/` folder scant
2. SKILL.md frontmatter parsed
3. Requirements checkt (bins, env, os)
4. Eligible skills in agent context laadt

---

## Scope

**In scope:**
- Skill discovery (`skills/` folder scannen)
- YAML frontmatter parsing (single-line JSON)
- Requirements gating (bins, env, os)
- Skills in systemPrompt injecteren

**Out of scope:**
- ClawHub/remote skill install
- Custom script execution
- Skill-specific UI
- Hot reload (future enhancement)

---

## Technical Approach

### Files Created/Modified

| File | Action | Purpose |
|------|--------|---------|
| `src/bridge/skills.ts` | Created | Skill loader service |
| `src/bridge/context.ts` | Modified | Skills in prompt injecteren |
| `skills/apple-reminders/SKILL.md` | Modified | Single-line JSON metadata |
| `skills/todoist/SKILL.md` | Modified | Single-line JSON metadata |
| `skills/_TEMPLATE.md` | Modified | Updated format docs |
| `_prd/architecture/plugins.md` | Modified | Updated format docs |

### Skill Loading Flow

```
1. Startup: loadSkills()
   └── fs.readdir(skills/)
   └── Filter directories (skip _*)

2. Parse: loadSkill(path)
   └── Read SKILL.md
   └── Parse YAML frontmatter
   └── Extract single-line JSON metadata

3. Gate: isSkillEligible(skill)
   └── Check os (process.platform)
   └── Check bins (which binary)
   └── Check env (process.env)

4. Format: formatSkillsForPrompt(skills)
   └── Markdown format with emoji
   └── Full skill content included

5. Inject: buildSystemPrompt()
   └── Add skills section to context
```

---

## Acceptance Criteria

- [x] Skills worden gescand bij startup
- [x] YAML frontmatter wordt correct geparsed
- [x] Skills met missing bins worden gefilterd
- [x] Skills met missing env worden gefilterd
- [x] Skills met wrong OS worden gefilterd
- [x] Eligible skills verschijnen in agent context
- [x] Agent kan skill instructies gebruiken
- [x] TypeScript compileert zonder errors

---

## Implementation Log

### 5 feb 2026
- Created `src/bridge/skills.ts` with:
  - `loadSkills()` - scans skills folder
  - `isSkillEligible()` - checks requirements
  - `formatSkillsForPrompt()` - formats for system prompt
  - `parseFrontmatter()` - parses YAML with single-line JSON
- Updated `src/bridge/context.ts`:
  - Added `skills` to KITTContext interface
  - Integrated `getSkillsPrompt()` in `loadContext()`
  - Added skills section in `buildSystemPrompt()`
- Tested skill loading:
  - apple-reminders: ✅ loaded (remindctl present)
  - todoist: ✅ correctly skipped (TODOIST_API_TOKEN not set)
- Updated skill files to use single-line JSON metadata format
- Updated docs and template

---

## Handover Checklist

- [x] Feature werkt zoals verwacht
- [x] Feature doc status → ✅ Done
- [x] STATUS.md → Completed tabel + Recent Updates
- [x] BACKLOG.md → Status bijgewerkt
- [x] Handover summary naar user gestuurd
- [x] Wacht op user voor commit
