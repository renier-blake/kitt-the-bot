# F75: Podbean Podcast Publishing

> **Priority:** 🟡 P2
> **Status:** 📝 Spec
> **Owner:** -

---

## Overview

Blog audio (gegenereerd via Kokoro TTS) automatisch publiceren naar Podbean als podcast episode. Inclusief embed player in blogpost en auto-distributie naar Spotify/Apple Podcasts via RSS.

---

## User Stories

**US-01:** Als Renier wil ik blog audio met één commando publiceren naar Podbean, zodat ik het makkelijk kan delen met anderen.

**US-02:** Als Renier wil ik dat de blogpost een embedded audio player bevat, zodat bezoekers direct kunnen luisteren.

**US-03:** Als Renier wil ik dat de podcast automatisch beschikbaar is op Spotify en Apple Podcasts, zodat het bereik groter is.

---

## Componenten

| Component | Nodig | Beschrijving |
|-----------|-------|--------------|
| Skill | ❌ | Geen skill nodig — is een CLI tool |
| Task | ❌ | On-demand, niet scheduled |
| Schema | ❌ | Geen database changes |
| Backend | ✅ | CLI tool: `src/cli/kitt-podcast.ts` |
| Portal | ❌ | Niet nodig |

---

## Backend: CLI Tool

### Commando

```bash
npm run podcast:publish -- --file <audio-file> --title <title> [--description <html>] [--draft]
```

### Opties

| Optie | Required | Beschrijving |
|-------|----------|--------------|
| `--file` | ✅ | Pad naar MP3 bestand |
| `--title` | ✅ | Episode titel |
| `--description` | ❌ | Episode beschrijving (HTML). Default: titel |
| `--draft` | ❌ | Publiceer als draft ipv direct publish |
| `--logo` | ❌ | Pad naar episode artwork (PNG/JPG) |

### Environment Variables

```bash
PODBEAN_CLIENT_ID=xxx      # Van developers.podbean.com
PODBEAN_CLIENT_SECRET=xxx  # Van developers.podbean.com
```

Opslaan in `.env` (staat al in `.gitignore`).

### API Flow

```
1. AUTH
   POST https://api.podbean.com/v1/oauth/token
   - Basic Auth: client_id:client_secret
   - Body: grant_type=client_credentials
   → access_token (expires_in: 3600)

2. GET PODCAST ID (eerste keer, daarna cachen)
   GET https://api.podbean.com/v1/podcasts?access_token=...
   → podcast_id

3. AUTHORIZE UPLOAD
   GET https://api.podbean.com/v1/files/uploadAuthorize
   - access_token, filename, filesize, content_type=audio/mpeg
   → presigned_url, file_key (= media_key)

4. UPLOAD FILE
   PUT {presigned_url}
   - Content-Type: audio/mpeg
   - Body: raw MP3 bytes

5. PUBLISH EPISODE
   POST https://api.podbean.com/v1/episodes
   - access_token, podcast_id, title, content, media_key
   - status: publish|draft
   - type: public
   → player_url, permalink_url, media_url

6. OUTPUT
   - Log player_url (iframe embed)
   - Log permalink_url (deelbare link)
   - Log media_url (directe MP3)
```

### Token Caching

Access token cachen in `/tmp/podbean-token.json`:
```json
{
  "access_token": "xxx",
  "expires_at": 1707350400000
}
```

Check `expires_at` voor elke call. Vernieuw als verlopen.

### Podcast ID Caching

Podcast ID cachen in `.env` als `PODBEAN_PODCAST_ID` of in `/tmp/podbean-config.json`. Hoeft maar 1x opgehaald te worden.

---

## Integratie met Blog Publisher

Na publicatie kan de blog-publisher skill de `player_url` gebruiken om een embed player in de blogpost te zetten:

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

Player kleuren matchen met KITT branding (oranje #FF6B00).

---

## Flow

```
┌─────────────────────────────┐
│  npm run podcast:publish    │
│  --file audio/2026-02-08.mp3│
│  --title "I Can Think Now"  │
└──────────┬──────────────────┘
           │
           ▼
┌──────────────────┐
│ Auth (OAuth 2.0) │
│ client_credentials│
└────────┬─────────┘
         │
         ▼
┌──────────────────────┐
│ Upload Authorize     │
│ → presigned S3 URL   │
└────────┬─────────────┘
         │
         ▼
┌──────────────────────┐
│ PUT file naar S3     │
│ raw MP3 bytes        │
└────────┬─────────────┘
         │
         ▼
┌──────────────────────┐
│ Publish Episode      │
│ title, content,      │
│ media_key, status    │
└────────┬─────────────┘
         │
         ▼
┌──────────────────────────┐
│ Output:                  │
│ 🎙️ player_url            │
│ 🔗 permalink_url          │
│ 📥 media_url              │
│                          │
│ + optioneel: embed in    │
│   blogpost HTML          │
└──────────────────────────┘
```

---

## Acceptance Criteria

- [ ] `npm run podcast:publish --file X --title Y` uploadt MP3 en publiceert episode
- [ ] Output bevat player_url, permalink_url en media_url
- [ ] Token wordt gecached en hergebruikt binnen TTL
- [ ] `--draft` flag publiceert als draft (niet live)
- [ ] Error handling voor: auth fail, upload fail, file not found
- [ ] Werkt met de Kokoro-gegenereerde MP3's uit `blog/audio/`

---

## Test Cases

1. **Happy path:** Publish een audio file → episode verschijnt op Podbean met correcte titel en beschrijving
2. **Token caching:** Tweede publish hergebruikt bestaande token → geen extra auth call
3. **Draft mode:** `--draft` flag → episode staat als draft, niet publiek
4. **Error case:** Ongeldig bestand → duidelijke foutmelding
5. **Error case:** Verlopen token → automatisch vernieuwen en retry

---

## Files

| File | Actie | Beschrijving |
|------|-------|--------------|
| `src/cli/kitt-podcast.ts` | Create | CLI tool voor Podbean publish |
| `package.json` | Modify | Script toevoegen: `"podcast:publish"` |
| `.env` | Modify | `PODBEAN_CLIENT_ID` + `PODBEAN_CLIENT_SECRET` toevoegen |

---

## Lees Eerst

> **Voor de agent die dit bouwt:**

### Workflow
- `_prd/workflows/AGENT.md`

### Architecture
- `_prd/architecture/overview.md`

### Bestaande Code
- `src/cli/kitt-tts-kokoro.ts` — Voorbeeld CLI tool (zelfde patroon volgen)
- `src/cli/kitt-tts.ts` — ElevenLabs CLI (voor referentie)

### API Docs
- [Podbean API Documentation](https://developers.podbean.com/podbean-api-docs/)
- [Publishing via Podbean API](https://help.podbean.com/support/solutions/articles/25000008051-publishing-a-new-podcast-episode-via-podbean-api)

---
