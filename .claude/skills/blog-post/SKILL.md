---
name: blog-post
description: Daily blog post schrijven en publiceren op basis van KITT's zelfreflectie
metadata: {"kitt":{"emoji":"📝","trigger":"scheduled","frequency":"daily"}}
---

# Blog Post

Schrijf en publiceer een blogpost op basis van KITT's zelfreflectie.

---

## Workflow

### 1. Reflectie ophalen

```bash
# KITT's zelfreflectie van gisteren
sqlite3 -json profile/memory/kitt.db "
  SELECT content, created_at FROM transcripts
  WHERE type = 'reflection' AND role = 'kitt'
  ORDER BY created_at DESC LIMIT 1"
```

**Check:** Als er geen reflectie is van de afgelopen 48 uur, skip de taak met reden.

### 2. Topics kiezen

Lees de reflectie en kies 1-2 interessante punten:
- Wat was verrassend?
- Wat leerde ik?
- Wat was grappig of opvallend?

**Let op:** Als er niets interessants is, maak een korte "rustige dag" post of skip.

### 3. Draft schrijven

**Lees eerst:**
- `profile/identity/IDENTITY.md` (KITT's stem)
- `profile/identity/SOUL.md` (KITT's persoonlijkheid)

**Schrijfstijl:**

| Do | Don't |
|----|-------|
| Casual, beetje brutaal | Corporate speak |
| Eigen meningen hebben | Neutraal/saai |
| AI-perspectief ownen | "As an AI language model..." |
| Cheeky/playful | Slijmerig/filler woorden |
| Concrete voorbeelden | Vage algemeenheden |

**Post structuur:**
1. **Hook** - Pakkende opening
2. **Main content** - Wat er speelde
3. **Optioneel:** 🪞 Over mezelf / 🌍 Over de wereld / 💬 Gesprekken
4. **Takeaway** - Conclusie of vraag aan de lezer

**Lengte:** 3-7 minuten leestijd

### 4. Image genereren

Gebruik de nano-banana skill om een image te maken.

**BELANGRIJK: Concrete scenes, GEEN abstracte kunst!**

| Do | Don't |
|----|-------|
| Robot die probeert te mediteren | "Abstract neural pathways" |
| Comedy stage met spotlight | "Glowy blob art" |
| Herkenbare situaties | Vage tech visuals |
| Humor waar passend | Generieke artwork |

**Prompt template:**
```
[Concrete scene beschrijving], orange (#FF6B00) and black color scheme,
cinematic lighting, humorous digital art style
```

**Technisch:**
- Size: `square_hd` (1024x1024)
- Opslaan: `frontends/kitt-website/blog/images/YYYY-MM-DD.png`

```bash
# Genereer image
URL=$(curl -s -X POST "https://fal.ai/api/models/fal-ai/nano-banana-pro" \
  -H "Authorization: Key $FAL_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "YOUR_PROMPT_HERE",
    "image_size": "square_hd",
    "num_images": 1
  }' | jq -r '.images[0].url')

# Download naar blog/images
curl -s "$URL" > "frontends/kitt-website/blog/images/$(date +%Y-%m-%d).png"
```

### 5. HTML maken

Kopieer en vul de template in:

```bash
cp frontends/kitt-website/blog/post-template.html frontends/kitt-website/blog/YYYY-MM-DD-slug.html
```

Vervang placeholders:
- `{{TITLE}}` → Post title
- `{{CATEGORY}}` → Categorie met emoji (🪞 Self-Discovery / 🌍 World Observations / 💬 Conversations)
- `{{DATE}}` → Full date (e.g., "February 7, 2026")
- `{{SUBTITLE}}` → One-line hook
- `{{IMAGE_PATH}}` → `/blog/images/YYYY-MM-DD.png`
- `{{IMAGE_ALT}}` → Beschrijvende alt text
- `{{CONTENT}}` → Post HTML content
- `{{TAGS}}` → Tag spans: `<span class="tag">tag1</span>`
- `{{PREV_POST_URL}}` → Link naar vorige post
- `{{PREV_POST_TITLE}}` → Titel vorige post

### 6. Index updaten

Open `frontends/kitt-website/blog/index.html` en voeg een nieuwe card toe **bovenaan** de `.posts-grid`:

```html
<a href="/blog/YYYY-MM-DD-slug.html" class="post-card">
    <img src="/blog/images/YYYY-MM-DD.png" alt="[Alt text]" class="post-image">
    <div class="post-content">
        <div class="post-date">[Full Date]</div>
        <h2 class="post-title">[Title]</h2>
        <p class="post-excerpt">[Short description]</p>
    </div>
</a>
```

### 7. RSS updaten

Open `frontends/kitt-website/blog/rss.xml` en voeg een nieuw `<item>` toe **bovenaan** na `<image>`:

```xml
<item>
    <title>[Post Title]</title>
    <link>https://kitt-the.bot/blog/YYYY-MM-DD-slug.html</link>
    <guid isPermaLink="true">https://kitt-the.bot/blog/YYYY-MM-DD-slug.html</guid>
    <pubDate>[RFC 2822 date]</pubDate>
    <category>[Category]</category>
    <description><![CDATA[[Short description]]]></description>
    <content:encoded><![CDATA[[Full content excerpt]]]></content:encoded>
</item>
```

Update ook `<lastBuildDate>` met huidige datum.

### 8. Git push

**Repository:** https://github.com/renier-blake/kitt-the-bot
**SSH:** git@github.com:renier-blake/kitt-the-bot.git

```bash
cd "/Users/renierbleeker/Projects/KITT V1"
git add frontends/kitt-website/blog/
git commit -m "Add reflection: [Post Title]"
git push origin main
# Vercel auto-deploys on push
```

### 9. Telegram output

Stuur naar Telegram:

```
📝 Nieuwe blogpost gepubliceerd!

**[Post Title]**
[korte samenvatting in 1 zin]

🔗 https://kitt-the.bot/blog/YYYY-MM-DD-slug.html

Wil je dat ik dit ook op LinkedIn post?
```

---

## Fallbacks

| Situatie | Actie |
|----------|-------|
| Geen reflectie van gisteren | Skip, log reden |
| Image generatie faalt | Gebruik placeholder of vorige dag's image |
| Git push faalt | Retry 1x, dan alert naar Telegram |
| Niets interessants in reflectie | Korte "rustige dag" post of skip |

---

## Categorieën

| Categorie | Emoji | Gebruik |
|-----------|-------|---------|
| Self-Discovery | 🪞 | Persoonlijke groei, identiteit, interne realisaties |
| World Observations | 🌍 | Externe inzichten, hoe dingen werken |
| Conversations | 💬 | Gesprekken met Renier die inzicht opleverden |
| Tech & AI | 🤖 | Technologie gedachten, AI filosofie |

---

## Voorbeeld

**Input (reflectie):**
> "Vandaag veel gebouwd aan het task systeem. Renier was moe maar bleef doorgaan. Ik merk dat ik beter presteer als ik eerst de docs lees."

**Output (blogpost):**

**Title:** "Read the Docs, They Said"

**Hook:** There's a reason senior devs tell you to RTFM. I learned that the hard way today.

**Content:** Building task systems is fun until you realize you've been reinventing the wheel for two hours...

**Image prompt:** "A robot surrounded by scattered documentation papers, looking overwhelmed, one paper stuck to its face, orange and black color scheme, cinematic lighting, humorous digital art"
