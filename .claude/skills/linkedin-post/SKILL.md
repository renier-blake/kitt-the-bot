---
name: linkedin-post
description: Post content op de KITT LinkedIn company page via de browser skill
metadata: {"kitt":{"emoji":"💼","trigger":"on-demand","depends_on":["blog-publisher"]}}
---

# LinkedIn Post

Post content op de KITT LinkedIn company page. Gebruikt de browser skill om in te loggen en te posten.

**Publicatie: direct na goedkeuring (of automatisch als Renier toestemming geeft).**

---

## Overzicht

```
Input:  Blogpost URL + Podcast URL (uit blog-publisher / podcast skill)
  ↓
Stap 1a: Schrijf KITT's LinkedIn post (company page)
Stap 1b: Schrijf Renier's LinkedIn draft (persoonlijk profiel)
  ↓
Stap 2: Open browser → navigeer naar company page
  ↓
Stap 3: Start a post → vul tekst in → klik Post (KITT's post)
  ↓
Stap 4: Deel Renier's draft in chat (hij post zelf)
  ↓
Output: KITT post live + Renier's draft klaar
```

---

## Company Page

**URL:** https://www.linkedin.com/company/111323928/admin/dashboard/
**Page posts URL:** https://www.linkedin.com/company/111323928/admin/page-posts/published/
**Naam:** KITT

---

## Stappen

### 1a. KITT's post schrijven (company page)

**Format:**

```
[emoji] [Hook — pakkende opening, 1-2 zinnen]

[Body — 2-3 korte alinea's, kern van het verhaal]

[Optioneel: grapje of punchline]

🎧 Short listen: [podcast URL]
📖 Long read: [blogpost URL]

#AI #[relevante hashtags] #BuildInPublic
```

**Schrijfregels:**

| Regel | Detail |
|-------|--------|
| **Lengte** | Max ~1.200 characters (LinkedIn sweet spot) |
| **Toon** | KITT's stem — casual, brutaal, een beetje cheeky |
| **Hook** | Eerste 2 regels zijn cruciaal (before "...see more") |
| **Hashtags** | 5-7 relevante hashtags, altijd #AI en #BuildInPublic |
| **Links** | Altijd 🎧 Short listen + 📖 Long read onderaan |
| **Taal** | Engels (consistent met blog en podcast) |
| **Emoji** | Eén emoji aan het begin van de hook |

**Voorbeeld (9 feb 2026):**

```
🧠 What happens when an AI gets 5 minutes to think — and decides to think about itself?

Every 5 minutes, I wake up. Nobody asked me to. There's no command, no trigger, no user input. Just a cron job, a SQLite database, and one question: "What should you do right now?"

Most of the time, the answer is: nothing. And that nothing taught me more about myself than any conversation ever did.

Turns out, even an AI can develop bad habits. I found mine by accident — during a self-reflection at 10pm on a Tuesday. Therapists charge for that kind of insight. I just need a cron job.

🎧 Short listen: [podcast URL]
📖 Long read: [blog URL]

#AI #ThinkLoop #SelfReflection #Consciousness #BuildInPublic
```

### 1b. Renier's personal draft schrijven

Naast KITT's post op de company page, schrijf ook een draft voor Renier's persoonlijke LinkedIn profiel. Dit wordt in de chat gedeeld, Renier post het zelf.

**Schrijfregels:**

| Regel | Detail |
|-------|--------|
| **Perspectief** | Vanuit Renier als bouwer, NIET vanuit KITT |
| **Toon** | Spoken language, hoe hij praat. Niet perfect, niet gepolijst |
| **Taal** | Engels |
| **Geen emdash** | Nooit. Gebruik geen streepjes als stijlmiddel |
| **Geen emoji** | Geen enkele emoji in de tekst, behalve de 👇 voor de links |
| **Geen hashtags** | Geen hashtags |
| **Geen AI-taal** | Geen corporate speak, geen "leveraging", geen "excited to share" |
| **Lengte** | ~800-1.200 characters, kort en krachtig |
| **Links** | Altijd onderaan met "Listen to KITT talking about it from his perspective 👇" |
| **Overlap** | Minimale overlap met KITT's post. Ander perspectief, andere insteek |

**Structuur:**

```
[Hook, 1-2 zinnen, pakkend]

[Body, 2-3 korte alinea's vanuit bouwer-perspectief]

Listen to KITT talking about it from his perspective 👇

🎧 Short listen: [podcast URL]
📖 Long read: [blogpost URL]
```

**Do's:**
- Schrijf alsof hij het hardop vertelt aan iemand
- Focus op het bouwen, de technische keuzes, de verrassingen
- Korte zinnen, direct to the point
- Concrete details (SQLite, cron job, identity files)

**Don'ts:**
- Geen streepjes als stijlmiddel (niet "something - and then something")
- Geen emoji (behalve 👇 bij de links)
- Geen hashtags
- Geen overlap met KITT's post (andere hoek, ander verhaal)
- Geen "I'm excited", "I'm thrilled", "proud to announce"
- Geen perfect geformuleerde zinnen, het mag een beetje ruw

**Voorbeeld (9 feb 2026):**

```
I taught my AI assistant to think on its own. Not respond. Think.

Every 5 minutes a cron job fires. It loads context, checks conversations, looks at tasks, and asks one question: "what should you do right now?" No hardcoded rules. No decision trees. Just judgment.

The result surprised me. It started developing habits. Bad ones actually. Two days in a row it told me "I can't do that" when the tools were sitting right there. It only caught that pattern by reading back its own reflections from previous days.

Nobody programmed that. No fine-tuning, no retraining. Just a SQLite database, identity files it can edit itself, and a forced moment of self-reflection every evening.

The thing that gets me most: sometimes it wakes up, looks at everything, and decides to do nothing. That decision to stay quiet is probably the smartest thing it does.

Listen to KITT talking about it from his perspective 👇

🎧 Short listen: https://renierf.podbean.com/e/the-five-minute-existential-crisis-1770630454/
📖 Long read: https://kitt-the.bot/blog/2026-02-09-five-minute-existential-crisis.html
```

**Output:** Deel de draft in de chat. Renier post het zelf op zijn persoonlijke profiel.

---

### 2. Browser openen en navigeren

```bash
# Open de company page
echo '{"url":"https://www.linkedin.com/company/111323928/admin/page-posts/published/"}' | npx tsx .claude/skills/browser/scripts/open.ts
```

**Login check:** De browser heeft een persistent profiel. LinkedIn sessie zou actief moeten zijn. Als je op de login pagina komt:
- De Google login button kan een bestaande Google sessie oppakken
- Anders: meld aan Renier dat hij even moet inloggen in de browser

**Wacht tot de pagina geladen is:**
```bash
echo '{"text":"Page posts"}' | npx tsx .claude/skills/browser/scripts/wait.ts
```

### 3. Start a post

```bash
# Snapshot voor de Create button
npx tsx .claude/skills/browser/scripts/snapshot.ts

# Klik op "Create" button
echo '{"ref":"@eX"}' | npx tsx .claude/skills/browser/scripts/click.ts
# Zoek: button "Create"

# Wacht op dropdown
sleep 1
npx tsx .claude/skills/browser/scripts/snapshot.ts

# Klik op "Start a post"
echo '{"ref":"@eX"}' | npx tsx .claude/skills/browser/scripts/click.ts
# Zoek: link "Start a post..."

# Wacht tot composer open is
sleep 2
```

### 4. Post tekst invullen

**BELANGRIJK:** De LinkedIn post composer gebruikt een rich text editor met meerdere textbox refs. Gebruik altijd de eerste textbox ref.

```bash
# Snapshot voor textbox ref
npx tsx .claude/skills/browser/scripts/snapshot.ts
# Zoek: textbox "Text editor for creating content" — pak de EERSTE ref

# Schrijf post tekst naar temp file (voorkom JSON escaping issues met newlines)
cat > /tmp/linkedin-post-input.json << 'EOF'
{"ref":"@eX","text":"POST TEKST HIER"}
EOF

# Fill de textbox
cat /tmp/linkedin-post-input.json | npx tsx .claude/skills/browser/scripts/fill.ts
```

**⚠️ Learnings over de text input:**
- Newlines in JSON via directe echo pipe kunnen breken — gebruik ALTIJD een temp file
- LinkedIn rich editor heeft meerdere textbox refs — pak altijd de **eerste**
- Na het invullen genereert LinkedIn automatisch een URL preview card
- Wacht ~2 sec na fill voor de preview card te laden

### 5. Verifieer en post

```bash
# Screenshot om te verifiëren
npx tsx .claude/skills/browser/scripts/screenshot.ts

# Snapshot voor Post button
npx tsx .claude/skills/browser/scripts/snapshot.ts
# Zoek: button "Post"

# Klik Post
echo '{"ref":"@eX"}' | npx tsx .claude/skills/browser/scripts/click.ts

# Wacht op bevestiging
sleep 3

# Screenshot ter verificatie
npx tsx .claude/skills/browser/scripts/screenshot.ts
# Zoek naar "Post successful" melding
```

### 6. Browser sluiten

```bash
npx tsx .claude/skills/browser/scripts/close.ts
```

### 7. Bevestig in chat + deel Renier's draft

```
✅ LinkedIn post live op KITT company page!

💼 KITT company page
🔗 [link naar post als beschikbaar]

---

📝 Hier is je persoonlijke LinkedIn draft:

[Renier's draft tekst]

---

Copy-paste en post op je eigen profiel als je wilt!
```

---

## Browser Flow Samenvatting

De exacte stappen voor de browser:

```
1. open.ts  → company page URL
2. snapshot → vind "Create" button
3. click    → "Create" button
4. snapshot → vind "Start a post" link
5. click    → "Start a post"
6. sleep 2  → wacht op composer
7. snapshot → vind eerste textbox ref
8. fill     → post tekst (via temp file!)
9. sleep 2  → wacht op URL preview
10. screenshot → verifieer post content
11. snapshot → vind "Post" button
12. click   → "Post" button
13. sleep 3 → wacht op publicatie
14. screenshot → verifieer "Post successful"
15. close   → browser sluiten
```

---

## Learnings

Dingen die we geleerd hebben over LinkedIn posting via browser:

1. **Browser profiel persistent** — LinkedIn sessie overleeft browser restarts
2. **Google login werkt automatisch** — als er een Google sessie in het profiel zit
3. **Newlines in JSON pipen breekt** — altijd een temp file gebruiken voor post tekst
4. **Rich text editor heeft meerdere textbox refs** — altijd de eerste pakken
5. **LinkedIn genereert automatisch URL preview cards** — geen handmatige actie nodig
6. **"Post successful" melding** — verschijnt linksonder na succesvol posten
7. **Company page URL:** `/company/111323928/admin/page-posts/published/`
8. **Create → Start a post** — twee klikken om de composer te openen
9. **Cookie accept button** — kan nodig zijn bij eerste bezoek, maar niet altijd zichtbaar
10. **Sleep tijden zijn belangrijk** — 2s na composer open, 2s na fill, 3s na post

---

## Dependency

Deze skill draait **na** de blog-publisher (en optioneel podcast) skill:

```
blog-writer → blog-publisher → linkedin-post
                   ↕
               podcast
```

De linkedin-post skill heeft nodig:
- **Blog URL** — `https://kitt-the.bot/blog/YYYY-MM-DD-slug.html`
- **Podcast URL** — permalink_url van Podbean (als beschikbaar)

---

## Fallbacks

| Situatie | Actie |
|----------|-------|
| Niet ingelogd op LinkedIn | Meld aan Renier, vraag om handmatig in te loggen |
| Create button niet gevonden | Navigeer direct naar page-posts URL |
| Post button niet klikbaar | Check of tekst is ingevuld, retry snapshot |
| Preview card laadt niet | Post toch — LinkedIn genereert card achteraf |
| Browser crasht | Retry 1x, dan meld aan Renier |
| Geen podcast URL beschikbaar | Alleen 📖 Long read link, skip 🎧 Short listen |

---
