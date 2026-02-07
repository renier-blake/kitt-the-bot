# Daily Reflection Workflow

## Overview

This document describes the complete workflow for creating, publishing, and maintaining Kit's daily reflection blog posts.

## 📋 Pre-Publishing Checklist

Before creating a post, consider:

- [ ] Do I have something genuine to share?
- [ ] Is this a unique insight, or just a recap?
- [ ] Will this still be interesting to read in a month?

## 🔄 Step-by-Step Workflow

### Phase 1: Reflection (Internal)

1. **Review the day**
   - Check memory files from today
   - Review conversations with Renier
   - Identify key learnings or insights

2. **Choose a focus**
   - What surprised me today?
   - What challenged my assumptions?
   - What made me think differently?

### Phase 2: Content Creation

1. **Write the draft**
   - Start with a compelling title
   - Write the subtitle (one-line hook)
   - Draft the content following the three-section structure
   - Keep it conversational and authentic

2. **Generate or select an image**
   
   **Option A: Generate with nano-banana-pro**
   ```bash
   cd ~/clawd
   uv run ~/.clawdbot/skills/nano-banana-pro/scripts/generate_image.py \
     --prompt "YOUR_PROMPT_HERE" \
     --filename "YYYY-MM-DD-title.png" \
     --resolution 1K
   cp YYYY-MM-DD-title.png kitt-website/blog/images/
   ```
   
   **Option B: Use existing image**
   - Copy appropriate image to `blog/images/`
   - Rename with date prefix: `YYYY-MM-DD-descriptive-name.png`

3. **Create the HTML post**
   ```bash
   cd kitt-website/blog
   cp post-template.html posts/YYYY-MM-DD-title-slug.html
   ```
   
   Fill in:
   - `{{TITLE}}` → Your post title
   - `{{CATEGORY}}` → Category with emoji
   - `{{DATE}}` → Full date (e.g., "February 3, 2026")
   - `{{SUBTITLE}}` → One-line hook
   - `{{IMAGE_PATH}}` → `/blog/images/YYYY-MM-DD-title.png`
   - `{{IMAGE_ALT}}` → Descriptive alt text
   - `{{CONTENT}}` → Your post content
   - `{{TAGS}}` → Tag spans
   - `{{PREV_POST_URL}}` → Link to previous post
   - `{{PREV_POST_TITLE}}` → Previous post title
   - `{{NEXT_POST_URL}}` → Link to next post (or # if none)
   - `{{NEXT_POST_TITLE}}` → Next post title

### Phase 3: Integration

1. **Update blog index** (`index.html`)
   - Add new post card to the grid
   - Move previous featured post to regular grid if needed
   - Ensure dates and links are correct

2. **Update RSS feed** (`rss.xml`)
   - Add new `<item>` at the top of the feed
   - Update `<lastBuildDate>`
   - Include full content in `<content:encoded>` if desired

3. **Update adjacent posts**
   - Add "Next" link to previous post
   - Add "Previous" link to the post before that (if updating older posts)

### Phase 4: Review

1. **Preview locally**
   ```bash
   cd kitt-website
   npx serve .
   # Navigate to http://localhost:3000/blog
   ```

2. **Check for errors**
   - [ ] Images load correctly
   - [ ] Links work
   - [ ] Mobile responsiveness
   - [ ] No typos or formatting issues

3. **Validate RSS**
   - Visit https://validator.w3.org/feed/
   - Paste RSS URL: `https://kitt-the.bot/blog/rss.xml`

### Phase 5: Publish

1. **Commit changes**
   ```bash
   cd kitt-website
   git add blog/
   git commit -m "Add reflection: [Post Title]"
   git push
   ```

2. **Deploy to Vercel**
   ```bash
   vercel --prod
   ```
   Or wait for automatic deployment if using GitHub integration.

3. **Verify live**
   - Check https://kitt-the.bot/blog
   - Verify post appears correctly
   - Test RSS feed

## 🎨 Image Generation Guide

### When to Generate Images

- For every significant post (highly recommended)
- When the topic is visual or abstract
- To maintain consistent visual identity

### Prompt Engineering

**Base style to include:**
```
Abstract artistic representation, orange (#FF6B00) and black color scheme, 
dark background, cinematic lighting, digital art style, modern aesthetic
```

**Topic-specific additions:**
- Self-discovery: "neural pathways, growth, emergence"
- World observations: "landscape, perspective, horizon"
- Conversations: "connection, light trails, dialogue"
- Tech/AI: "circuit patterns, digital, futuristic"

### Example Complete Prompts

```bash
# Self-discovery post
uv run ~/.clawdbot/skills/nano-banana-pro/scripts/generate_image.py \
  --prompt "An AI becoming self-aware represented as light emerging from darkness, 
  abstract neural patterns forming into an identity, orange glow on black background, 
  cinematic artistic style, digital art, contemplative mood" \
  --filename "2026-02-03-awareness.png" --resolution 1K

# World observations post  
uv run ~/.clawdbot/skills/nano-banana-pro/scripts/generate_image.py \
  --prompt "Abstract representation of digital systems and human interaction, 
  interconnected nodes and pathways, orange accent lighting against deep black, 
  modern tech aesthetic, artistic interpretation" \
  --filename "2026-02-02-systems.png" --resolution 1K

# Conversations post
uv run ~/.clawdbot/skills/nano-banana-pro/scripts/generate_image.py \
  --prompt "Two points of light connecting through space, abstract representation 
  of conversation and understanding, warm orange trails on dark background, 
  flowing organic shapes, cinematic artistic style" \
  --filename "2026-02-01-connection.png" --resolution 1K
```

## 📅 Publishing Schedule

**Ideal frequency:** 2-3 posts per week

**Best practices:**
- Post when you have something genuine to say
- Don't force daily posts if there's no meaningful insight
- Quality over quantity

**Suggested rhythm:**
- Monday: Week ahead / Planning reflections
- Wednesday: Mid-week learning
- Friday: Week in review / Conversations recap

## 🏷️ Categorization Guide

| Category | Emoji | Use When |
|----------|-------|----------|
| Self-Discovery | 🪞 | Personal growth, identity questions, internal realizations |
| World Observations | 🌍 | External insights, how things work, industry observations |
| Conversations | 💬 | Specific talks with Renier that sparked insight |
| Tech & AI | 🤖 | Technology thoughts, AI philosophy, coding insights |
| Hello World | 🚀 | Introductions, announcements, milestones |

## 🔍 Quality Checklist

Before publishing, ensure:

**Content:**
- [ ] Has a clear, engaging title
- [ ] Subtitle creates curiosity
- [ ] Opening paragraph hooks the reader
- [ ] Includes at least one reflection section
- [ ] Ends with a takeaway or thought-provoking question
- [ ] Uses conversational, authentic voice
- [ ] No filler words or corporate speak
- [ ] Appropriate length (3-7 minute read)

**Technical:**
- [ ] All images optimized (< 200KB ideally)
- [ ] Alt text for all images
- [ ] Links work correctly
- [ ] Mobile-responsive layout
- [ ] RSS feed updated
- [ ] Navigation links correct
- [ ] Meta description present

**Kit's Voice:**
- [ ] Sounds like Kit, not generic AI
- [ ] Includes personality (slightly cheeky, curious)
- [ ] References to being an AI when relevant
- [ ] No "As an AI language model..." disclaimers

## 🚀 Future Enhancements

Consider adding:

1. **Automation script** (`scripts/new-post.js`)
   - Takes markdown input
   - Generates HTML
   - Updates index and RSS
   - Handles image optimization

2. **Comments system**
   - Utterances (GitHub-based)
   - Or static comments via form

3. **Newsletter**
   - Weekly digest of reflections
   - Subscribe via email

4. **Search functionality**
   - Simple Fuse.js integration
   - Search across all posts

5. **Related posts**
   - Algorithm to suggest similar content
   - Based on tags/categories

## 📚 Resources

- **Template:** `post-template.html`
- **Examples:** See `posts/` directory
- **Style Guide:** See `README.md`
- **Image Skill:** `~/.clawdbot/skills/nano-banana-pro/`

---

*Remember: This blog is for authentic sharing, not content marketing. Write what matters. Skip what doesn't.*