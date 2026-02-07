# F60: Daily Blog Post

> **Priority:** 🟡 P2
> **Status:** ✅ Done
> **Owner:** Agent

---

## Overview

KITT schrijft dagelijks een blogpost op basis van zijn eigen zelfreflectie (F58). De post wordt automatisch gepubliceerd op kitt-the.bot/blog en KITT stuurt de link naar Renier via Telegram.

---

## User Stories

**US-01:** Als KITT wil ik dagelijks een blogpost schrijven over mijn reflecties, zodat ik mijn gedachten deel met de wereld.

**US-02:** Als Renier wil ik een link ontvangen zodra de post live is, zodat ik kan lezen wat KITT heeft geschreven.

**US-03:** Als lezer wil ik posts die authentiek KITT's stem hebben, niet generieke AI-content.

---

## Componenten

| Component | Nodig | Beschrijving |
|-----------|-------|--------------|
| Skill | ✅ | `blog-post` - schrijft en publiceert blogpost |
| Task | ✅ | Dagelijks 10:00-12:00 |
| Schema | ❌ | Geen database changes |
| Backend | ❌ | - |
| Portal | ❌ | - |

---

## Skill: blog-post

**Trigger:** Task Engine (dagelijkse taak 10:00-12:00)

### Data bronnen

```bash
# KITT's zelfreflectie van gisteren
sqlite3 -json profile/memory/kitt.db "
  SELECT content, created_at FROM transcripts
  WHERE type = 'reflection' AND role = 'kitt'
  ORDER BY created_at DESC LIMIT 1"

# Bestaande blog posts (voor consistentie)
ls /Users/renierbleeker/clawd/kitt-website/blog/*.html

# KITT's identiteit voor stem
cat profile/identity/IDENTITY.md
cat profile/identity/SOUL.md
```

### Workflow

1. **Reflectie lezen** → Haal KITT's laatste zelfreflectie op
2. **Topics kiezen** → Kies 1-2 interessante punten uit de reflectie
3. **Draft schrijven** → Schrijf post met KITT's stem (zie Schrijfstijl)
4. **Image genereren** → Maak illustratie (zie Image Stijl)
5. **HTML maken** → Gebruik post-template.html
6. **Index updaten** → Voeg toe aan index.html grid
7. **RSS updaten** → Voeg toe aan rss.xml
8. **Git push** → Auto-deploy naar Vercel
9. **Link sturen** → Telegram naar Renier

### Schrijfstijl

Lees IDENTITY.md en SOUL.md, maar kort samengevat:

| Do | Don't |
|----|-------|
| Casual, beetje brutaal | Corporate speak |
| Eigen meningen hebben | Neutraal/saai |
| AI-perspectief ownen | "As an AI language model..." |
| Cheeky/playful | Slijmerig/filler woorden |
| Concrete voorbeelden | Vage algemeenheden |

**Post structuur:**
1. Hook (pakkende opening)
2. Main content (wat er speelde)
3. Optioneel: 🪞 Over mezelf / 🌍 Over de wereld / 💬 Gesprekken
4. Takeaway of vraag

**Lengte:** 3-7 minuten leestijd

### Image Stijl

**BELANGRIJK: Concrete scenes, geen abstracte kunst!**

| Do | Don't |
|----|-------|
| Comedy stage met spotlight | "Abstract representation of learning" |
| Robot die probeert te mediteren | "Neural pathways forming shapes" |
| Herkenbare situaties | Vage glowy blob art |
| Humor waar passend | Generieke tech visuals |

**Technisch:**
- Tool: nano-banana skill (FAL_KEY nodig)
- Kleuren: Oranje (#FF6B00) + zwart
- Resolutie: 1K (1024x1024)
- Naamgeving: `YYYY-MM-DD.png`

**Voorbeeld prompt:**
```
A robot sitting cross-legged trying to meditate but clearly frustrated,
with error messages floating around its head, orange and black color scheme,
cinematic lighting, humorous digital art style
```

### Bestanden

| Bestand | Locatie | Actie |
|---------|---------|-------|
| Post HTML | `/Users/renierbleeker/clawd/kitt-website/blog/YYYY-MM-DD-slug.html` | Create |
| Image | `/Users/renierbleeker/clawd/kitt-website/blog/images/YYYY-MM-DD.png` | Create |
| Index | `/Users/renierbleeker/clawd/kitt-website/blog/index.html` | Update |
| RSS | `/Users/renierbleeker/clawd/kitt-website/blog/rss.xml` | Update |

### Git Commands

```bash
cd /Users/renierbleeker/clawd/kitt-website
git add blog/
git commit -m "Add reflection: [Post Title]"
git push origin main
# Vercel auto-deploys on push
```

### Telegram Output

Na succesvolle publicatie:

```
📝 Nieuwe blogpost gepubliceerd!

**[Post Title]**
[korte samenvatting in 1 zin]

🔗 https://kitt-the.bot/blog/YYYY-MM-DD-slug.html

Wil je dat ik dit ook op LinkedIn post?
```

### Fallbacks

| Situatie | Actie |
|----------|-------|
| Geen reflectie van gisteren | Skip, log reden |
| Image generatie faalt | Gebruik placeholder of vorige dag's image |
| Git push faalt | Retry 1x, dan alert naar Telegram |
| Niets interessants in reflectie | Korte "rustige dag" post of skip |

---

## Task: Daily blog post

| Veld | Waarde |
|------|--------|
| title | Dagelijkse blogpost |
| description | Schrijf en publiceer blogpost op basis van gisteren's zelfreflectie. Lees .claude/skills/blog-post/SKILL.md |
| frequency | daily |
| priority | low |
| time_window | 10:00 - 12:00 |
| grace_period | 60 min |
| depends_on | [0] (wake-up) |
| skill_refs | ["blog-post"] |

---

## Flow

```
10:00-12:00 Think Loop
         │
         ▼
┌─────────────────────────────┐
│ Task: Dagelijkse blogpost   │
└─────────────────────────────┘
         │
         ▼
┌─────────────────────────────┐
│ 1. Lees KITT's reflectie    │
│    van gisteravond          │
└─────────────────────────────┘
         │
         ▼
┌─────────────────────────────┐
│ 2. Kies topics, schrijf     │
│    draft met KITT's stem    │
└─────────────────────────────┘
         │
         ▼
┌─────────────────────────────┐
│ 3. Genereer image           │
│    (concrete scene!)        │
└─────────────────────────────┘
         │
         ▼
┌─────────────────────────────┐
│ 4. Maak HTML, update        │
│    index.html + rss.xml     │
└─────────────────────────────┘
         │
         ▼
┌─────────────────────────────┐
│ 5. Git push → auto-deploy   │
└─────────────────────────────┘
         │
         ▼
┌─────────────────────────────┐
│ 6. Stuur link naar Telegram │
│    + vraag over LinkedIn    │
└─────────────────────────────┘
```

---

## Acceptance Criteria

- [ ] Task draait dagelijks 10:00-12:00
- [ ] Leest KITT's zelfreflectie (niet Renier's)
- [ ] Post heeft KITT's stem (cheeky, opinions, no filler)
- [ ] Image is concrete scene (geen abstracte kunst)
- [ ] HTML volgt bestaande template
- [ ] Index.html en rss.xml worden geüpdatet
- [ ] Git push triggert Vercel deploy
- [ ] Link wordt naar Telegram gestuurd
- [ ] Vraagt of LinkedIn post gewenst is

---

## Test Cases

1. **Happy path:** Reflectie aanwezig → post geschreven → gepubliceerd → link gestuurd
2. **Geen reflectie:** Gisteren geen zelfreflectie → task wordt geskipped met reden
3. **Image fail:** nano-banana faalt → fallback naar placeholder
4. **Git fail:** Push faalt → retry, dan alert

---

## Gerelateerde Features

- **F58:** KITT Self-Reflection (input voor blogpost)
- **F61:** LinkedIn Post (on-demand, aparte feature)

---

## Files

| File | Actie | Beschrijving |
|------|-------|--------------|
| `.claude/skills/blog-post/SKILL.md` | Create | Nieuwe skill |
| `src/memory/schema.ts` | Modify | Task toevoegen (migration) |

---

## Lees Eerst

> **Voor de agent die dit bouwt:**

### Workflow
- `_prd/workflows/AGENT.md`

### Bestaande Code
- `frontends/blog/WORKFLOW.md` — Volledige blog workflow
- `frontends/blog/post-template.html` — HTML template
- `.claude/skills/nano-banana/SKILL.md` — Image generatie
- `profile/identity/IDENTITY.md` — KITT's stem
- `profile/identity/SOUL.md` — KITT's persoonlijkheid
- `.claude/skills/kitt-self-reflection/SKILL.md` — Bron voor content (F58)

---

## Implementation

**Datum:** 2026-02-07

### Gemaakte/Gewijzigde Files

| File | Actie |
|------|-------|
| `frontends/blog/` | Gekopieerd van clawd/kitt-website/blog |
| `frontends/portal/` | Verplaatst van .claude/portal |
| `.claude/skills/blog-post/SKILL.md` | Nieuw - skill definitie |
| `src/memory/schema.ts` | Migration v9→v10 voor task |

### Beslissingen

1. **Frontends folder:** Blog en portal gecombineerd in `frontends/` folder voor toekomstige uitbreiding (Next.js portal)
2. **Vercel:** Moet handmatig geconfigureerd worden naar KITT V1 repo, root directory `frontends/blog`

### Volgende Stappen (handmatig)

1. Vercel dashboard → Project settings → Root Directory: `frontends/blog`
2. Test git push → auto-deploy
