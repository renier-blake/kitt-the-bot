---
name: browser
description: Browser automation via Playwright + Chrome. Use for web navigation, form filling, screenshots, and interacting with websites.
metadata: {"kitt":{"emoji":"🌐","requires":{"bins":["npx"]}}}
---

# Browser Automation

Control Chrome browser voor web navigatie, form invullen, screenshots, en website interacties.

## Setup (First Time)

```bash
cd .claude/skills/browser && npm install
```

## Workflow

1. **Open** - Navigeer naar URL
2. **Accept Cookies** - Dismiss cookie dialogs (run after open)
3. **Snapshot** - Krijg lijst van interactive elements met refs (@e1, @e2, etc.)
4. **Interact** - Click/fill/type via ref
5. **Repeat** - Na page changes opnieuw snapshot voor nieuwe refs

## Commands

### 1) Open URL

```bash
echo '{"url":"https://example.com"}' | npx tsx .claude/skills/browser/scripts/open.ts
```

**Output:**
```json
{"success":true,"message":"Page loaded","url":"https://example.com","title":"Example Domain"}
```

### 2) Snapshot (get elements)

```bash
npx tsx .claude/skills/browser/scripts/snapshot.ts
```

**Output:**
```json
{
  "success": true,
  "message": "Snapshot complete",
  "url": "https://google.com",
  "elementCount": 5,
  "elements": [
    "textbox \"Search\" [ref=@e1]",
    "button \"Google Search\" [ref=@e2]",
    "button \"I'm Feeling Lucky\" [ref=@e3]"
  ]
}
```

### 3) Click Element

```bash
echo '{"ref":"@e2"}' | npx tsx .claude/skills/browser/scripts/click.ts
```

### 4) Fill Form Field

Clears field first, then fills:

```bash
echo '{"ref":"@e1","text":"search query"}' | npx tsx .claude/skills/browser/scripts/fill.ts
```

### 5) Type Text

Appends text (doesn't clear):

```bash
echo '{"ref":"@e1","text":" extra text"}' | npx tsx .claude/skills/browser/scripts/type.ts
```

### 6) Get Property

```bash
# Get element text
echo '{"ref":"@e1","prop":"text"}' | npx tsx .claude/skills/browser/scripts/get.ts

# Get element attribute
echo '{"ref":"@e1","prop":"href"}' | npx tsx .claude/skills/browser/scripts/get.ts

# Get page title
echo '{"prop":"title"}' | npx tsx .claude/skills/browser/scripts/get.ts
```

### 7) Screenshot

```bash
# Current viewport
npx tsx .claude/skills/browser/scripts/screenshot.ts

# Full page
echo '{"fullPage":true}' | npx tsx .claude/skills/browser/scripts/screenshot.ts
```

**Output:**
```json
{"success":true,"message":"Screenshot saved","path":"/tmp/screenshot-1707300000000.png"}
```

### 8) Wait

```bash
# Wait for element
echo '{"ref":"@e1"}' | npx tsx .claude/skills/browser/scripts/wait.ts

# Wait for text on page
echo '{"text":"Welcome"}' | npx tsx .claude/skills/browser/scripts/wait.ts

# Wait for URL pattern
echo '{"url":"**/inbox"}' | npx tsx .claude/skills/browser/scripts/wait.ts
```

### 9) Accept Cookies

Automatically clicks common cookie consent buttons:

```bash
npx tsx .claude/skills/browser/scripts/accept-cookies.ts
```

### 10) Press Key

Press keyboard keys (Enter, Tab, Escape, etc.):

```bash
echo '{"key":"Enter"}' | npx tsx .claude/skills/browser/scripts/press.ts
```

### 11) Close Browser

```bash
npx tsx .claude/skills/browser/scripts/close.ts
```

## Safety Rules

- **Altijd snapshot na navigatie** - refs veranderen na page changes
- **Wacht op page load** - gebruik wait na click die navigatie veroorzaakt
- **Close browser na taken** - houdt resources vrij
- **Re-snapshot bij errors** - element refs kunnen stale zijn

## Example: Google Search

```bash
# 1. Open Google
echo '{"url":"https://google.com"}' | npx tsx .claude/skills/browser/scripts/open.ts

# 2. Get elements
npx tsx .claude/skills/browser/scripts/snapshot.ts
# Output: textbox "Search" [ref=@e1], button "Google Search" [ref=@e2]

# 3. Fill search field
echo '{"ref":"@e1","text":"weer amsterdam"}' | npx tsx .claude/skills/browser/scripts/fill.ts

# 4. Click search button
echo '{"ref":"@e2"}' | npx tsx .claude/skills/browser/scripts/click.ts

# 5. Wait for results
echo '{"text":"Amsterdam"}' | npx tsx .claude/skills/browser/scripts/wait.ts

# 6. Screenshot results
npx tsx .claude/skills/browser/scripts/screenshot.ts

# 7. Close browser
npx tsx .claude/skills/browser/scripts/close.ts
```

## Notes

- Browser opent **zichtbaar** (headed mode) - je ziet wat er gebeurt
- Logins **persistent** in browser profile - geen re-login nodig
- Werkt met Gmail, Google, X/Twitter (echt browser fingerprint)
- Profile locatie: `.claude/skills/browser/data/browser-profile/`
