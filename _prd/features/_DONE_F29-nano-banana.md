# F29: Nano Banana (Image Generation)

> **Priority:** 🟡 P2
> **Status:** ✅ Done
> **Owner:** KITT
> **Started:** 5 februari 2026
> **Completed:** 5 februari 2026

---

## Overview

Port de nano-banana skill voor image generation via fal.ai (Google Gemini 3 Pro Image).

**Use cases:**
- Afbeeldingen genereren voor blog posts
- Social media visuals
- Creative brainstorming
- Visualisaties maken

---

## Implementation

### Skill File

`/.claude/skills/nano-banana/SKILL.md` bevat:
- Image generation via curl + jq
- Multiple image sizes (512x512 tot 1024x576)
- Batch generation support
- Local saving options
- Pricing info

### Technical Details

- **CLI-First:** Pure curl + jq (geen Python/SDK nodig)
- **Requirements:** `curl`, `jq`, `FAL_KEY` env var
- **Image Sizes:** 6 templates (square, portrait, landscape)
- **Output:** fal.ai URLs (24h valid) of lokaal opslaan

---

## Acceptance Criteria

- [x] SKILL.md met curl commands
- [x] FAL_KEY requirement in metadata
- [x] Image size templates gedocumenteerd
- [x] Batch generation voorbeelden
- [x] Pricing informatie
- [x] Local saving instructies
- [ ] Live test (manual - vereist FAL_KEY in .env)

---

## Files Created

| File | Purpose |
|------|---------|
| `.claude/skills/nano-banana/SKILL.md` | Complete skill documentation with curl commands |

---

## Integration Notes

**To use:**
1. Add `FAL_KEY` to `.env` (or use from OpenClaw .env)
2. Use command: "Genereer een afbeelding van..."
3. KITT voert curl command uit
4. Returns image URL

**Example Response:**
```
🍌 Image generated!

Prompt: "A serene robot in a zen garden, peaceful atmosphere"
Size: 1024x1024 (square_hd)

URL: https://fal.ai/files/xyz/image.png

(URL valid for 24 hours - save locally for permanent storage)
```

---

## Next Steps

- [ ] Add FAL_KEY to KITT .env (when ready to use)
- [ ] Test generation via Telegram
- [ ] Consider local image storage in `data/images/`

---

## Notes

- fal.ai URLs are temporary (~24h)
- Costs are low (~$0.03-0.12 per image)
- Gemini 3 Pro has good text rendering
- Consider batch generation for cost savings
