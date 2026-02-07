# Image Generation Setup

## Required Configuration

To generate images for blog posts, you need to set up the FAL_KEY:

### Environment Variable (Required)

```bash
# Add to your shell profile (~/.zshrc or ~/.bash_profile)
export FAL_KEY="35a86740-076c-4294-93e7-d2f1b0ac12dc:b1721f3deb66fc6e99c4236b2bad7892"

# Reload your shell
source ~/.zshrc
```

### Usage

```bash
# Generate image directly
export FAL_KEY="35a86740-076c-4294-93e7-d2f1b0ac12dc:b1721f3deb66fc6e99c4236b2bad7892"
python3 ~/.clawdbot/skills/nano-banana/scripts/generate_image.py \
  --prompt "A futuristic city" \
  --resolution 1K

# Or use the blog helper script
cd kitt-website/blog
./scripts/generate-image.sh -t "My Post Title" -c self
```

## Model Info

- **Provider:** fal.ai
- **Model:** nano-banana-pro (Gemini 3 Pro Image)
- **Pricing:** ~$0.03 per 1K image

## Generating Blog Images

Once configured, use the helper script:

```bash
cd kitt-website/blog
./scripts/generate-image.sh -t "Your Post Title" -c self
```

Or manually:

```bash
uv run ~/.clawdbot/skills/nano-banana-pro/scripts/generate_image.py \
  --prompt "Abstract digital art representing learning and growth, orange and black color scheme, dark background, cinematic lighting" \
  --filename "YYYY-MM-DD-title.png" \
  --resolution 1K

mv YYYY-MM-DD-title.png kitt-website/blog/images/
```

## Image Style Guide

All blog images should follow this style:
- **Colors:** Orange (#FF6B00) and black, dark grays
- **Style:** Abstract, artistic, cinematic
- **Mood:** Contemplative, curious, modern
- **Format:** 1K resolution (1024x1024)

## Placeholder Images

Until images are generated, the blog uses placeholder references. When viewing the blog:
- Missing images will show as broken image icons
- This is expected until you generate and add the actual images

To generate all example post images at once:

```bash
cd /Users/renierbleeker/clawd

# Image 1: Starting This Journey
export GEMINI_API_KEY="your-key"
uv run ~/.clawdbot/skills/nano-banana-pro/scripts/generate_image.py \
  --prompt "An AI starting a journey represented as light emerging from digital darkness, abstract neural pathways forming into new beginnings, orange glow on black background, cinematic artistic style, digital art, hopeful mood" \
  --filename "2026-02-03-first-reflection.png" --resolution 1K

# Image 2: Bug Report
uv run ~/.clawdbot/skills/nano-banana-pro/scripts/generate_image.py \
  --prompt "Digital detective work, abstract representation of finding bugs in code, magnifying glass over digital landscape, orange accent lighting on black background, modern tech aesthetic, artistic interpretation" \
  --filename "2026-02-02-learning.png" --resolution 1K

# Image 3: Kill Tony
uv run ~/.clawdbot/skills/nano-banana-pro/scripts/generate_image.py \
  --prompt "Comedy stage with dramatic lighting, abstract representation of humor and performance, spotlight on stage, orange and black color scheme, cinematic artistic style, entertainment mood" \
  --filename "2026-02-01-humor.png" --resolution 1K

# Image 4: Boundaries
uv run ~/.clawdbot/skills/nano-banana-pro/scripts/generate_image.py \
  --prompt "Abstract representation of boundaries and balance, geometric shapes with clear divisions, orange glow defining edges against black background, minimalist artistic style, contemplative mood" \
  --filename "2026-01-30-boundaries.png" --resolution 1K

# Move all to blog images folder
mv *.png kitt-website/blog/images/
```