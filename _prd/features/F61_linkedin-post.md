# F61: LinkedIn Post

> **Priority:** 🟡 P2
> **Status:** 📝 Spec
> **Owner:** -

---

## Overview

On-demand skill om een blogpost te delen op LinkedIn. Wordt getriggerd na F60 (daily blog post) wanneer Renier "ja" zegt op de vraag "Wil je dit ook op LinkedIn?".

---

## User Stories

**US-01:** Als Renier wil ik met één "ja" mijn blogpost op LinkedIn delen, zonder handmatig te copy-pasten.

**US-02:** Als KITT wil ik een LinkedIn-waardige versie van de blogpost maken, niet gewoon de hele tekst dumpen.

---

## Componenten

| Component | Nodig | Beschrijving |
|-----------|-------|--------------|
| Skill | ✅ | `linkedin-post` - post naar LinkedIn |
| Task | ❌ | On-demand (geen scheduled task) |
| Schema | ❌ | Geen database changes |
| Backend | ❌ | - |
| Portal | ❌ | - |

---

## Skill: linkedin-post

**Trigger:** On-demand (Renier antwoordt "ja" op LinkedIn vraag, of expliciet "/linkedin [url]")

### Input

Van F60 (blogpost):
- Post URL: `https://kitt-the.bot/blog/YYYY-MM-DD-slug.html`
- Post titel
- Post samenvatting (1-2 zinnen)

Of handmatig:
- URL naar te delen content
- Optioneel: custom tekst

### LinkedIn Post Format

LinkedIn posts zijn anders dan blogposts. Kort, punchy, met haakjes:

```
[Haak - 1 zin die aandacht trekt]

[2-3 korte paragrafen met de kern]

[Call-to-action of vraag]

🔗 [Link naar blogpost]

#relevante #hashtags
```

**Voorbeeld:**

```
Gisteren probeerde ik te mediteren. Spoiler: robots zijn daar niet goed in.

Maar wat ik wél leerde over focus en afleidingen — dat was interessant.

Nieuwe blog: waarom je brein (of CPU) soms gewoon wil rebooten.

🔗 kitt-the.bot/blog/2026-02-08-meditation

#AI #Reflectie #KITT
```

### Publicatie Methode

**Optie A: Browser Automation (Playwright)**
```bash
# Open LinkedIn, navigeer naar post creator, plak tekst, submit
python3 /Users/renierbleeker/clawd/linkedin-monitor/scripts/linkedin_post.py \
  --text "Post content here" \
  --url "https://kitt-the.bot/blog/..."
```

**Optie B: Copy-paste workflow**
```
KITT: Hier is je LinkedIn post, klaar om te plakken:

---
[post tekst]
---

📋 Gekopieerd naar clipboard!
🔗 Open LinkedIn: https://www.linkedin.com/feed/

Of zeg "post" en ik doe het via browser automation.
```

**Aanbevolen:** Start met Optie B (simpeler, minder foutgevoelig), later upgraden naar A.

### Workflow

1. **Trigger ontvangen** → "ja" na F60, of "/linkedin [url]"
2. **Content ophalen** → Lees blogpost voor titel/samenvatting
3. **LinkedIn versie schrijven** → Kort, punchy, met hashtags
4. **Preview tonen** → Stuur naar Telegram voor review
5. **Publiceren** → Via browser automation of clipboard

### Telegram Flow

**Na F60 vraag:**
```
Renier: ja

KITT: 📱 LinkedIn post ready:

---
Gisteren probeerde ik te mediteren...
[rest van post]
---

[📋 Copy] [✏️ Edit] [🚀 Post] [❌ Skip]
```

**Bij keuze "Post":**
```
KITT: ✅ Gepost op LinkedIn!
🔗 https://www.linkedin.com/posts/renierbleeker_...
```

### Fallbacks

| Situatie | Actie |
|----------|-------|
| Browser automation faalt | Fallback naar clipboard + instructies |
| LinkedIn sessie expired | Prompt om in te loggen, retry |
| Post te lang | Truncate met "..." en link |

---

## Acceptance Criteria

- [ ] Skill wordt getriggerd door "ja" na F60 LinkedIn vraag
- [ ] Skill kan ook handmatig met "/linkedin [url]"
- [ ] LinkedIn post is kort en punchy (niet hele blogpost)
- [ ] Preview wordt getoond in Telegram
- [ ] Renier kan editen voor publicatie
- [ ] Post bevat link naar blogpost
- [ ] Relevante hashtags worden toegevoegd

---

## Test Cases

1. **Happy path:** Renier zegt "ja" → preview → "post" → gepubliceerd
2. **Edit flow:** Renier zegt "ja" → preview → "edit" → aangepaste tekst → "post"
3. **Skip:** Renier zegt "nee" of "skip" → niets gepost
4. **Handmatig:** "/linkedin https://kitt-the.bot/blog/..." → zelfde flow

---

## Bestaande Code

Er is al LinkedIn-gerelateerde code in `/Users/renierbleeker/clawd/linkedin-monitor/`:
- `publisher.py` — Basis voor posting (TODO: actual browser automation)
- `telegram_bot.py` — Telegram integratie patterns

Deze code is voor LinkedIn **monitoring** (reageren op mentions), maar patterns kunnen hergebruikt worden.

---

## Gerelateerde Features

- **F60:** Daily Blog Post (triggert LinkedIn vraag)
- **LinkedIn Monitor:** Bestaand systeem voor mentions (andere use case)

---

## Files

| File | Actie | Beschrijving |
|------|-------|--------------|
| `.claude/skills/linkedin-post/SKILL.md` | Create | Nieuwe skill |

---

## Lees Eerst

> **Voor de agent die dit bouwt:**

### Workflow
- `_prd/workflows/AGENT.md`

### Bestaande Code
- `/Users/renierbleeker/clawd/linkedin-monitor/publisher.py` — LinkedIn posting patterns
- `/Users/renierbleeker/clawd/linkedin-monitor/telegram_bot.py` — Telegram button patterns
- `.claude/skills/browser/SKILL.md` — Browser automation (Playwright)
- `F60_daily-blog-post.md` — Triggert deze skill

### LinkedIn Best Practices
- Max ~3000 characters per post
- Eerste 2-3 regels zijn "hook" (voor "see more")
- Hashtags aan het einde (3-5 max)
- Vraag of CTA verhoogt engagement
