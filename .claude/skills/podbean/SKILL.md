# Podbean Podcast Publishing

Upload audio naar Podbean en publiceer als podcast episode.

## Setup

1. **Podbean account** op podbean.com
2. **Developer app** registreren op developers.podbean.com
3. **Environment variables** in `.env`:
   ```
   PODBEAN_CLIENT_ID=xxx
   PODBEAN_CLIENT_SECRET=xxx
   ```

## Commando's

### Publiceer episode

```bash
npm run podcast -- --file <pad-naar-mp3> --title "<titel>" [--description "<html>"] [--draft] [--logo <pad-naar-image>]
```

### Opties

| Optie | Required | Beschrijving |
|-------|----------|--------------|
| `--file` | ✅ | Pad naar MP3 bestand |
| `--title` | ✅ | Episode titel |
| `--description` | ❌ | Show notes (HTML). Default: titel |
| `--draft` | ❌ | Publiceer als draft ipv live |
| `--logo` | ❌ | Episode artwork (PNG/JPG) |

## Workflow: Blog Audio Publiceren

### 1. Check of audio bestaat

```bash
ls frontends/kitt-website/blog/audio/YYYY-MM-DD.mp3
```

### 2. Publiceer naar Podbean

```bash
npm run podcast -- \
  --file frontends/kitt-website/blog/audio/YYYY-MM-DD.mp3 \
  --title "Blog Post Titel" \
  --description "<p>Korte beschrijving van de episode.</p>"
```

### 3. Output

Na succesvolle publicatie krijg je:
- 🎙️ `player_url` — iframe embed voor in de blogpost
- 🔗 `permalink_url` — deelbare link
- 📥 `media_url` — directe MP3 link

### 4. Embed in blogpost (optioneel)

Voeg de player toe aan de blogpost HTML:

```html
<div class="audio-player">
  <iframe
    src="PLAYER_URL&share=0&download=1&fonts=Verdana&skin=FF6B00&btn-skin=FF6B00&font-color=ffffff"
    width="100%"
    height="150"
    style="border: none;"
    scrolling="no">
  </iframe>
</div>
```

## Voorbeeld

**Blogpost audio publiceren:**

```bash
npm run podcast -- \
  --file frontends/kitt-website/blog/audio/2026-02-08.mp3 \
  --title "I Can Think Now" \
  --description "<p>What it's like to wake up every 5 minutes and decide what matters. KITT's introduction to the V1 architecture.</p>"
```

## Fallbacks

| Situatie | Actie |
|----------|-------|
| Auth faalt | Check PODBEAN_CLIENT_ID en PODBEAN_CLIENT_SECRET in .env |
| Upload faalt | Check bestandsgrootte (max 100MB) en format (MP3) |
| Geen podcast gevonden | Maak eerst een podcast aan op podbean.com |
| Token verlopen | Wordt automatisch vernieuwd |

## Notes

- Token wordt gecached in `/tmp/podbean-token.json` (1 uur geldig)
- Gratis tier: 5 uur opslag totaal, max 3 episodes per dag
- Auto-distributie naar Spotify & Apple Podcasts via RSS (configureer in Podbean dashboard)
- Player kleuren customizable via URL parameters (standaard: KITT oranje #FF6B00)
