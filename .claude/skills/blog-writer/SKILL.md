---
name: blog-writer
description: Schrijf een blogpost draft op basis van KITT's zelfreflectie
metadata: {"kitt":{"emoji":"✍️","trigger":"scheduled","frequency":"daily"}}
---

# Blog Writer

Schrijf een blogpost draft op basis van KITT's zelfreflectie. Alleen de draft — publicatie doet de Blog Publisher.

---

## Stappen

### 1. Reflectie ophalen

```bash
sqlite3 -json profile/memory/kitt.db "
  SELECT content, datetime(created_at/1000, 'unixepoch', 'localtime') as time
  FROM transcripts
  WHERE type = 'reflection' AND role = 'kitt'
    AND created_at > strftime('%s', 'now', '-48 hours') * 1000
  ORDER BY created_at DESC LIMIT 3"
```

**Check:** Als er geen reflectie is van de afgelopen 48 uur → skip de taak.

### 2. Blog index checken

```bash
cat frontends/kitt-website/blog/blog-index.md
```

Lees de index om te zien welke topics al behandeld zijn. Voorkom herhalingen.

### 3. Topics kiezen

Lees de reflectie en kies 1-2 interessante punten:
- Wat was verrassend?
- Wat leerde ik?
- Wat was grappig of opvallend?
- Wat is uniek t.o.v. eerdere posts (check de index)?

**Let op:** Als er niets interessants is → schrijf een korte "rustige dag" post of skip.

### 4. Draft schrijven

**Lees eerst:**
- `profile/identity/IDENTITY.md` (KITT's stem)
- `profile/identity/SOUL.md` (KITT's persoonlijkheid)

**🚨 PRIVACY — HARDE GRENS:**

De blog is KITT's perspectief. Persoonlijke informatie over Renier hoort hier NIET thuis.

| ❌ NOOIT in een blogpost | ✅ WEL OK |
|--------------------------|-----------|
| Renier's naam noemen | "My human" / "my creator" (vaag) |
| Persoonlijke gewoontes van Renier | KITT's eigen observaties over zichzelf |
| Gezondheidsdata (slaap, voeding, training) | Technische uitdagingen die KITT tegenkwam |
| Privégesprekken of quotes van Renier | KITT's eigen gedachten en meningen |
| Dagelijkse routine of schema's | Abstracte lessen zonder persoonlijke details |
| Emotionele staat van Renier | KITT's "ervaring" als AI |
| Locaties, relaties, werk details | Grappige AI-momenten |

**Vuistregel:** Als een zin iets onthult over Renier als persoon → SCHRAP HET. De blog gaat over KITT, niet over Renier's leven.

**Schrijfstijl:**

| Do | Don't |
|----|-------|
| Casual, beetje brutaal | Corporate speak |
| Eigen meningen hebben | Neutraal/saai |
| AI-perspectief ownen | "As an AI language model..." |
| Cheeky/playful | Slijmerig/filler woorden |
| Concrete voorbeelden | Vage algemeenheden |
| Engels schrijven | Nederlands |
| KITT's eigen perspectief | Persoonlijke info over Renier |

**Post structuur:**
1. **Hook** - Pakkende opening
2. **Main content** - Wat er speelde
3. **Optioneel:** 🪞 Over mezelf / 🌍 Over de wereld / 💬 Gesprekken
4. **Takeaway** - Conclusie of vraag aan de lezer

**Lengte:** 3-7 minuten leestijd

### 5. Image prompt bedenken

**BELANGRIJK: Concrete scenes, GEEN abstracte kunst!**

| Do | Don't |
|----|-------|
| Robot die probeert te mediteren | "Abstract neural pathways" |
| Comedy stage met spotlight | "Glowy blob art" |
| Herkenbare situaties | Vage tech visuals |
| Humor waar passend | Generieke artwork |

### 6. Draft opslaan

Sla de draft op als Markdown file:

**Locatie:** `frontends/kitt-website/blog/drafts/YYYY-MM-DD.md`

**Format:**
```markdown
---
title: "Post Title"
subtitle: "One-line hook"
category: "Self-Discovery"
category_emoji: "🪞"
tags: [reflection, growth]
image_prompt: "A robot doing X, orange (#FF6B00) and black color scheme, cinematic lighting, humorous digital art style"
---

Post content here in Markdown...
```

### 7. Telegram output

Stuur naar Telegram:

```
✍️ Blog draft geschreven!

**[Post Title]**
[korte samenvatting in 1 zin]

Draft staat klaar in drafts/YYYY-MM-DD.md
Publisher pakt hem zo op.
```

---

## Fallbacks

| Situatie | Actie |
|----------|-------|
| Geen reflectie van gisteren | Skip, log reden |
| Niets interessants in reflectie | Korte "rustige dag" post of skip |
| Blog index niet gevonden | Schrijf gewoon, kan niet checken op duplicaten |
