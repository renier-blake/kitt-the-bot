---
name: blog-publisher
description: Publiceer een blog draft — image genereren, HTML maken, git push, Telegram notify
metadata: {"kitt":{"emoji":"🚀","trigger":"scheduled","frequency":"daily"}}
---

# Blog Publisher

Pakt een draft op uit `frontends/kitt-website/blog/drafts/`, publiceert als HTML, en pusht naar GitHub.

---

## Stappen

### 1. Draft ophalen

```bash
# Vandaag's draft
cat frontends/kitt-website/blog/drafts/$(date +%Y-%m-%d).md 2>/dev/null
```

**Check:** Als er geen draft is voor vandaag → skip de taak.

**🚨 PRIVACY CHECK:** Scan de draft op persoonlijke informatie over Renier (naam, gewoontes, gezondheid, locaties, relaties). Als gevonden → NIET publiceren, alert naar Telegram.

Lees het frontmatter:
- `title` — post titel
- `subtitle` — one-line hook
- `category` — categorie naam
- `category_emoji` — emoji voor categorie
- `tags` — array van tags
- `image_prompt` — prompt voor image generatie
- Content na het frontmatter is de post body in Markdown

### 2. Image genereren

Gebruik de fal.ai API (nano-banana) om een image te genereren.

```bash
# Genereer image
RESPONSE=$(curl -s -X POST "https://fal.run/fal-ai/fast-sdxl" \
  -H "Authorization: Key $FAL_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "IMAGE_PROMPT_HERE",
    "image_size": "square_hd",
    "num_images": 1
  }')

URL=$(echo "$RESPONSE" | jq -r '.images[0].url')

# Download naar blog/images
curl -s "$URL" > "frontends/kitt-website/blog/images/$(date +%Y-%m-%d).png"
```

**Fallback:** Als image generatie faalt → gebruik een placeholder of vorige dag's image.

### 3. HTML maken

```bash
cp frontends/kitt-website/blog/post-template.html "frontends/kitt-website/blog/$(date +%Y-%m-%d)-SLUG.html"
```

Vervang de SLUG met een kebab-case versie van de titel (max 4-5 woorden).

Vervang placeholders in het HTML bestand:
- `{{TITLE}}` → Post title
- `{{CATEGORY}}` → Categorie met emoji (bijv. "🪞 Self-Discovery")
- `{{DATE}}` → Full date in Engels (e.g., "February 8, 2026")
- `{{SUBTITLE}}` → One-line hook
- `{{IMAGE_PATH}}` → `/blog/images/YYYY-MM-DD.png`
- `{{IMAGE_ALT}}` → Beschrijvende alt text
- `{{CONTENT}}` → Post content als HTML (converteer Markdown naar HTML)
- `{{TAGS}}` → Tag spans: `<span class="tag">tag1</span><span class="tag">tag2</span>`
- `{{PREV_POST_URL}}` → Link naar vorige post (check blog-index.md voor de meest recente)
- `{{PREV_POST_TITLE}}` → Titel vorige post

**Markdown → HTML conversie:**
- `# Heading` → `<h2>Heading</h2>`
- `**bold**` → `<strong>bold</strong>`
- `*italic*` → `<em>italic</em>`
- Paragrafen → `<p>...</p>`
- `- item` → `<ul><li>item</li></ul>`
- `> quote` → `<blockquote>quote</blockquote>`

### 4. Index.html updaten

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

### 5. RSS updaten

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

### 6. Blog index updaten

Voeg een nieuwe rij toe **bovenaan** de tabel in `frontends/kitt-website/blog/blog-index.md`:

```
| YYYY-MM-DD | [Title] | [Category] | [Korte topic beschrijving] |
```

### 7. Git push

**Repository:** https://github.com/renier-blake/kitt-the-bot
**SSH:** git@github.com:renier-blake/kitt-the-bot.git

```bash
cd "/Users/renierbleeker/Projects/KITT V1"
git add frontends/kitt-website/blog/
git commit -m "blog: [Post Title]"
git push origin main
# Vercel auto-deploys on push
```

### 8. Telegram output

Stuur naar Telegram:

```
🚀 Nieuwe blogpost gepubliceerd!

**[Post Title]**
[korte samenvatting in 1 zin]

🔗 https://kitt-the.bot/blog/YYYY-MM-DD-slug.html
```

---

## Fallbacks

| Situatie | Actie |
|----------|-------|
| Geen draft voor vandaag | Skip, log reden |
| Image generatie faalt | Gebruik placeholder of skip image |
| Git push faalt | Retry 1x, dan alert naar Telegram |
| fal.ai API key niet gevonden | Alert naar Telegram, skip image |
