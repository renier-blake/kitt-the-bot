# F61: Blog Post Refactor

**Status:** 📝 Spec
**Prioriteit:** Medium
**Aangemaakt:** 8 feb 2026

## Context

De huidige blog-post skill is één mega-flow van 9 stappen in één Think Loop tick. Dat is te veel voor haiku en te fragiel. Opsplitsen in twee taken met een draft file als tussenstap.

## Nieuwe structuur

### Task A: Blog Writer
**Wanneer:** Daily, 10:00-12:00
**Depends on:** KITT zelfreflectie (task #7 van vorige dag)

**Stappen:**
1. Reflectie ophalen uit db (`type='reflection', role='kitt'`)
2. Blog index lezen (`frontends/kitt-website/blog/blog-index.md`) om te checken wat al geschreven is → voorkom herhalingen
3. Topics kiezen (1-2 interessante punten)
4. Draft schrijven in Markdown
5. Image prompt bedenken
6. Opslaan naar: `frontends/kitt-website/blog/drafts/YYYY-MM-DD.md`

**Draft format:**
```markdown
---
title: "Post Title"
subtitle: "One-line hook"
category: "Self-Discovery"
tags: [reflection, growth]
image_prompt: "A robot doing X, orange and black color scheme, cinematic lighting, humorous digital art"
---

Post content here in Markdown...
```

### Task B: Blog Publisher
**Wanneer:** Daily, 12:00-14:00 (na Writer)
**Depends on:** Blog Writer (task A)

**Stappen:**
1. Draft ophalen uit `frontends/kitt-website/blog/drafts/YYYY-MM-DD.md`
2. Image genereren via fal.ai (nano-banana)
3. HTML maken van template
4. Index.html updaten (nieuwe card)
5. RSS updaten
6. Blog index updaten (`blog-index.md`)
7. Git push
8. Telegram notify + LinkedIn vraag

### Blog Index
**Locatie:** `frontends/kitt-website/blog/blog-index.md`

Compact overzicht van alle posts zodat de Writer weet wat er al is:

```markdown
# Blog Index

| Datum | Titel | Topic |
|-------|-------|-------|
| 2026-02-07 | Read the Docs, They Said | Skill instructies, documentatie |
| 2026-02-06 | The Midnight Bug | Time windows, edge cases |
| ... | ... | ... |
```

Dit voorkomt dat de Writer de hele blog moet lezen (te veel context).

### LinkedIn Post
Kan als onderdeel van de Publisher (stap 8) of als aparte task.
Pakt de blogpost en maakt er een korte LinkedIn post van.

## Database taken

| Task | Title | Window | Depends on | Priority |
|------|-------|--------|------------|----------|
| Nieuw | Blog Writer | 10:00-12:00 | [7] | low |
| Nieuw | Blog Publisher | 12:00-14:00 | [Blog Writer] | low |

Oude task #8 (Dagelijkse blogpost) wordt vervangen door deze twee.

## Draft locatie

`frontends/kitt-website/blog/drafts/YYYY-MM-DD.md`

Vaste plek, vaste naamconventie. Publisher weet precies waar te kijken.

## Te doen

- [ ] blog-index.md aanmaken met bestaande posts
- [ ] Blog Writer skill schrijven
- [ ] Blog Publisher skill schrijven
- [ ] Oude blog-post skill archiveren
- [ ] Database: task #8 deactiveren, twee nieuwe tasks aanmaken
- [ ] Testen
