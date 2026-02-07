# F47 - Browser Automation Skill

> **Status:** 📝 Spec
> **Priority:** 🟠 P1
> **Type:** New Skill

---

## Doel

Browser automation skill voor KITT via Playwright + Brave:
- Echte browser (niet headless) - je ziet wat er gebeurt
- Persistent profile - logins blijven bewaard
- Werkt met Gmail, Google, X/Twitter en andere "strenge" sites
- Agent kan via Telegram browser taken uitvoeren

---

## Waarom Echte Browser?

| Headless Chromium | Echte Browser (deze feature) |
|-------------------|------------------------------|
| ❌ Gmail geblokkeerd | ✅ Gmail werkt |
| ❌ Bot detection | ✅ Echt browser fingerprint |
| ❌ Nieuwe sessie elke keer | ✅ Logins persistent |
| ❌ Onzichtbaar | ✅ Je ziet wat KITT doet |

---

## Architectuur

```
.claude/skills/browser/
├── SKILL.md                    # Skill docs + agent instructies
├── scripts/
│   ├── lib/
│   │   ├── browser.ts          # Shared Playwright utilities
│   │   └── config.ts           # Configuration (paths, timeouts)
│   ├── open.ts                 # Open URL in browser
│   ├── snapshot.ts             # Get interactive elements with refs
│   ├── click.ts                # Click element by ref
│   ├── fill.ts                 # Fill form field
│   ├── type.ts                 # Type text (without clearing)
│   ├── screenshot.ts           # Take screenshot
│   ├── get.ts                  # Get text/attr/value from element
│   ├── wait.ts                 # Wait for element/text/URL
│   ├── close.ts                # Close browser
│   └── setup.ts                # Initial setup + login helper
├── data/                       # (gitignored)
│   └── browser-profile/        # Brave persistent profile
└── package.json                # Dependencies (playwright)
```

---

## Script Interface

Alle scripts volgen JSON stdin → JSON stdout pattern:

### Input (stdin)
```json
{"url": "https://gmail.com"}
{"ref": "@e1"}
{"ref": "@e2", "text": "hello@example.com"}
```

### Output (stdout)
```json
{"success": true, "message": "Page loaded", "data": {...}}
{"success": false, "message": "Element not found"}
```

---

## Commands

### Navigation

```bash
# Open URL
echo '{"url":"https://gmail.com"}' | npx tsx .claude/skills/browser/scripts/open.ts

# Close browser
npx tsx .claude/skills/browser/scripts/close.ts
```

### Snapshot (get elements)

```bash
# Get interactive elements with refs
npx tsx .claude/skills/browser/scripts/snapshot.ts

# Output:
# textbox "Email or phone" [ref=@e1]
# button "Next" [ref=@e2]
# link "Forgot email?" [ref=@e3]
```

### Interactions

```bash
# Click element
echo '{"ref":"@e2"}' | npx tsx .claude/skills/browser/scripts/click.ts

# Fill field (clears first)
echo '{"ref":"@e1","text":"user@gmail.com"}' | npx tsx .claude/skills/browser/scripts/fill.ts

# Type (without clearing)
echo '{"ref":"@e1","text":"extra text"}' | npx tsx .claude/skills/browser/scripts/type.ts
```

### Get Information

```bash
# Get element text
echo '{"ref":"@e1","prop":"text"}' | npx tsx .claude/skills/browser/scripts/get.ts

# Get attribute
echo '{"ref":"@e1","prop":"href"}' | npx tsx .claude/skills/browser/scripts/get.ts

# Get page title
echo '{"prop":"title"}' | npx tsx .claude/skills/browser/scripts/get.ts
```

### Screenshots

```bash
# Screenshot current view
npx tsx .claude/skills/browser/scripts/screenshot.ts
# Output: {"success":true,"path":"/tmp/screenshot-123.png"}

# Full page
echo '{"fullPage":true}' | npx tsx .claude/skills/browser/scripts/screenshot.ts
```

### Wait

```bash
# Wait for element
echo '{"ref":"@e1"}' | npx tsx .claude/skills/browser/scripts/wait.ts

# Wait for text
echo '{"text":"Welcome"}' | npx tsx .claude/skills/browser/scripts/wait.ts

# Wait for URL
echo '{"url":"**/inbox"}' | npx tsx .claude/skills/browser/scripts/wait.ts
```

---

## Configuration

### Environment Variables

```bash
# .env
BROWSER_PATH="/Applications/Brave Browser.app/Contents/MacOS/Brave Browser"
BROWSER_PROFILE_DIR=".claude/skills/browser/data/browser-profile"
```

### lib/config.ts

```typescript
export const config = {
  browserPath: process.env.BROWSER_PATH || '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
  profileDir: process.env.BROWSER_PROFILE_DIR || '.claude/skills/browser/data/browser-profile',
  viewport: { width: 1280, height: 800 },
  headless: false,  // Always visible
  timeouts: {
    navigation: 30000,
    element: 5000,
    action: 2000,
  },
};
```

---

## SKILL.md Content

```markdown
---
name: browser
description: Browser automation via Playwright + Brave. Use for web searches, form filling, screenshots, and interacting with websites.
metadata: {"kitt":{"emoji":"🌐","requires":{"bins":["npx"]}}}
---

# Browser Automation

Control Brave browser to navigate websites, fill forms, click elements, and extract information.

## Workflow

1. **Open** - Navigate to URL
2. **Snapshot** - Get list of interactive elements with refs
3. **Interact** - Click/fill/type using refs from snapshot
4. **Repeat** - Re-snapshot after navigation changes

## Commands

### Open URL
\`\`\`bash
echo '{"url":"https://example.com"}' | npx tsx .claude/skills/browser/scripts/open.ts
\`\`\`

### Get Elements (snapshot)
\`\`\`bash
npx tsx .claude/skills/browser/scripts/snapshot.ts
\`\`\`

### Click Element
\`\`\`bash
echo '{"ref":"@e1"}' | npx tsx .claude/skills/browser/scripts/click.ts
\`\`\`

### Fill Form Field
\`\`\`bash
echo '{"ref":"@e1","text":"value"}' | npx tsx .claude/skills/browser/scripts/fill.ts
\`\`\`

### Screenshot
\`\`\`bash
npx tsx .claude/skills/browser/scripts/screenshot.ts
\`\`\`

### Close Browser
\`\`\`bash
npx tsx .claude/skills/browser/scripts/close.ts
\`\`\`

## Example: Google Search

\`\`\`bash
# 1. Open Google
echo '{"url":"https://google.com"}' | npx tsx .claude/skills/browser/scripts/open.ts

# 2. Get elements
npx tsx .claude/skills/browser/scripts/snapshot.ts
# Output: textbox "Search" [ref=@e1], button "Google Search" [ref=@e2]

# 3. Fill search field
echo '{"ref":"@e1","text":"weather amsterdam"}' | npx tsx .claude/skills/browser/scripts/fill.ts

# 4. Click search
echo '{"ref":"@e2"}' | npx tsx .claude/skills/browser/scripts/click.ts

# 5. Wait for results
echo '{"text":"Amsterdam"}' | npx tsx .claude/skills/browser/scripts/wait.ts

# 6. Screenshot results
npx tsx .claude/skills/browser/scripts/screenshot.ts
\`\`\`

## Notes

- Browser opens **visible** (headed mode) - you can see what happens
- Logins persist in browser profile - no need to re-login
- Works with Gmail, Google, X/Twitter (real browser fingerprint)
- Re-run snapshot after page changes to get fresh element refs
```

---

## Kritieke Files

| File | Actie |
|------|-------|
| `.claude/skills/browser/SKILL.md` | Create |
| `.claude/skills/browser/scripts/lib/browser.ts` | Create |
| `.claude/skills/browser/scripts/lib/config.ts` | Create |
| `.claude/skills/browser/scripts/open.ts` | Create |
| `.claude/skills/browser/scripts/snapshot.ts` | Create |
| `.claude/skills/browser/scripts/click.ts` | Create |
| `.claude/skills/browser/scripts/fill.ts` | Create |
| `.claude/skills/browser/scripts/type.ts` | Create |
| `.claude/skills/browser/scripts/get.ts` | Create |
| `.claude/skills/browser/scripts/screenshot.ts` | Create |
| `.claude/skills/browser/scripts/wait.ts` | Create |
| `.claude/skills/browser/scripts/close.ts` | Create |
| `.claude/skills/browser/scripts/setup.ts` | Create |
| `.claude/skills/browser/package.json` | Create |
| `.claude/skills/browser/tsconfig.json` | Create |
| `.gitignore` | Update - add browser profile dir |

---

## Dependencies

```json
{
  "name": "kitt-browser-skill",
  "type": "module",
  "dependencies": {
    "playwright": "^1.50.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "tsx": "^4.0.0",
    "@types/node": "^20.0.0"
  }
}
```

---

## Referenties

Lees deze KITT files voor context:

| File | Waarom |
|------|--------|
| `.claude/skills/garmin/` | Voorbeeld skill met Python scripts |
| `_prd/architecture/skills.md` | Skill metadata en structuur |

**Key Playwright patterns:**
- `chromium.launchPersistentContext()` voor persistent logins
- `headless: false` voor zichtbare browser
- JSON stdin/stdout voor script communicatie
- Ref-based element selection (@e1, @e2)

**Playwright docs:** https://playwright.dev/docs/api/class-browsercontext

---

## Setup (eenmalig)

```bash
# 1. Install dependencies
cd .claude/skills/browser && npm install

# 2. Install Playwright browsers (uses system Brave)
# Niet nodig - we gebruiken je eigen Brave

# 3. Test
echo '{"url":"https://google.com"}' | npx tsx scripts/open.ts
npx tsx scripts/snapshot.ts
npx tsx scripts/close.ts
```

---

## Verificatie

1. Browser opent zichtbaar (Brave)
2. Snapshot geeft element refs
3. Click/fill werkt met refs
4. Screenshot wordt opgeslagen
5. Profile persists (logins blijven)

---

## Acceptatiecriteria

- [ ] Skill folder aangemaakt met alle scripts
- [ ] `open` opent Brave met URL
- [ ] `snapshot` geeft lijst van interactive elements met refs
- [ ] `click` klikt element via ref
- [ ] `fill` vult form field via ref
- [ ] `screenshot` maakt screenshot
- [ ] `close` sluit browser netjes af
- [ ] Browser profile persistent (logins bewaard)
- [ ] Agent kan via Telegram browser taken uitvoeren
- [ ] Gmail login werkt (test case)

---

## Toekomstig

- Auth state export/import voor backup
- Multiple tabs support
- Cookie management
- Network request interception
- PDF generation
