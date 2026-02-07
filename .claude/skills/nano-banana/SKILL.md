---
name: nano-banana
description: Generate images using fal.ai (Gemini 3 Pro Image). Use when the user wants to create images, visuals, or illustrations.
homepage: https://fal.ai/models/fal-ai/nano-banana-pro
metadata: {"kitt":{"emoji":"🍌","model":"haiku","requires":{"bins":["curl","jq"],"env":["FAL_KEY"]}}}
---

# Nano Banana - Image Generation

Generate high-quality images using Google's Gemini 3 Pro Image via fal.ai.

## Setup

1. **Get API key:** https://fal.ai/dashboard/keys
2. **Add to `.env`:**
   ```bash
   FAL_KEY=your-key-here
   ```

## Image Sizes

| Size | Resolution | Aspect |
|------|------------|--------|
| `square` | 512x512 | 1:1 |
| `square_hd` | 1024x1024 | 1:1 |
| `portrait_4_3` | 768x1024 | 3:4 |
| `portrait_16_9` | 576x1024 | 9:16 |
| `landscape_4_3` | 1024x768 | 4:3 |
| `landscape_16_9` | 1024x576 | 16:9 |

## Generate Image

```bash
curl -s -X POST "https://fal.ai/api/models/fal-ai/nano-banana-pro" \
  -H "Authorization: Key $FAL_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "YOUR_PROMPT_HERE",
    "image_size": "square_hd",
    "num_images": 1
  }' | jq -r '.images[0].url'
```

## Generate Multiple Images

```bash
curl -s -X POST "https://fal.ai/api/models/fal-ai/nano-banana-pro" \
  -H "Authorization: Key $FAL_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "YOUR_PROMPT_HERE",
    "image_size": "square_hd",
    "num_images": 4
  }' | jq -r '.images[].url'
```

## With Different Aspect Ratio

```bash
curl -s -X POST "https://fal.ai/api/models/fal-ai/nano-banana-pro" \
  -H "Authorization: Key $FAL_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "YOUR_PROMPT_HERE",
    "image_size": "landscape_16_9",
    "num_images": 1
  }' | jq -r '.images[0].url'
```

## Save Image Locally

```bash
# Generate and save
URL=$(curl -s -X POST "https://fal.ai/api/models/fal-ai/nano-banana-pro" \
  -H "Authorization: Key $FAL_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "YOUR_PROMPT_HERE",
    "image_size": "square_hd",
    "num_images": 1
  }' | jq -r '.images[0].url')

# Download
mkdir -p data/images/generated
curl -s "$URL" > "data/images/generated/$(date +%s).png"
```

## Pricing

| Resolution | Price |
|------------|-------|
| 512x512 (1K) | ~$0.03 |
| 1024x1024 (2K) | ~$0.06 |
| Higher | ~$0.12 |

## Response Format

Always show:
1. **Prompt used** - The final prompt sent to the model
2. **Image URL** - Working URL or local path
3. **Size info** - Resolution and aspect ratio
4. **Expiry info** - "URL valid for 24 hours" if using fal.ai URL

## Example

**User:** "Maak een afbeelding van een robot in een futuristische stad"

**KITT:**
```
🍌 Image generated!

Prompt: "A sleek robot walking through a futuristic neon cityscape, cyberpunk, high-tech"
Size: 1024x1024 (square_hd)

URL: https://fal.ai/files/xyz/image.png

(URL valid for 24 hours - save locally for permanent storage)
```

## Tips

- **Better prompts = better images**
  - Be specific: "oil painting" vs "digital art"
  - Add style: "cyberpunk", "anime", "photorealistic"
  - Describe lighting: "golden hour", "neon", "dramatic"

- **Good text in images**
  - Gemini 3 renders text better than DALL-E
  - Use: "with text that says 'hello world'"

- **Cost optimization**
  - `square_hd` (1024x1024) is usually best ROI
  - Start with 1 image, generate more if needed
  - Batch similar prompts together
