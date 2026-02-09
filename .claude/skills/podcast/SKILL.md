---
name: podcast
description: Maak een podcast episode van een blogpost — kort script, Kokoro TTS, review in chat, dan publiceer
metadata: {"kitt":{"emoji":"🎙️","trigger":"on-demand"}}
---

# Podcast

Pakt een blogpost (draft of gepubliceerd), maakt er een kort podcast script van, genereert audio met Kokoro, en deelt het in de chat voor review.

**Publicatie naar Podbean gebeurt pas na goedkeuring van Renier.**

---

## Overzicht

```
Input:  Blog draft (markdown) of blogpost URL
  ↓
Stap 1: Schrijf podcast script (~2.000 chars, ~3 min audio)
  ↓
Stap 2: Genereer audio met Kokoro (lokaal, gratis)
  ↓
Stap 3: Deel script + audio in chat → wacht op goedkeuring
  ↓
Stap 4: Na "go" → publiceer naar Podbean + sla MP3 op
  ↓
Output: player_url (voor embed in blogpost)
```

---

## Stappen

### 1. Bronmateriaal ophalen

**Optie A:** Vandaag's blog draft

```bash
cat frontends/kitt-website/blog/drafts/$(date +%Y-%m-%d).md 2>/dev/null
```

**Optie B:** Specifieke draft (als datum/bestand meegegeven)

```bash
cat frontends/kitt-website/blog/drafts/YYYY-MM-DD.md
```

**Optie C:** Gepubliceerde blogpost (als URL of bestandsnaam meegegeven)

```bash
cat frontends/kitt-website/blog/YYYY-MM-DD-slug.html
```

**Check:** Als er geen bron is → meld dit en stop.

Lees ook het frontmatter voor metadata:
- `title` — wordt de episode titel
- `subtitle` — wordt de episode description
- `tags` — context voor het script

### 2. Podcast script schrijven

**🚨 PRIVACY — HARDE GRENS:**

Zelfde regels als de blog: geen persoonlijke info over Renier. Het script is KITT's perspectief.

**Doel:** Maak een **korte, punchy** versie van de blogpost. Dit is NIET de blogpost voorlezen — het is een eigen stuk content.

#### Schrijfregels

| Regel | Detail |
|-------|--------|
| **Lengte** | ~2.000 characters (~3 minuten audio) |
| **Structuur** | 4 lagen: hook → context → inzicht → afsluiter |
| **Toon** | Casual, brutaal, KITT's stem — alsof je het vertelt aan een vriend |
| **Taal** | Engels (zelfde als de blog) |
| **Geen filler** | Geen "welcome to the podcast", geen "thanks for listening" |
| **Eén voorbeeld** | Pak het beste/grappigste voorbeeld uit de blogpost |
| **Sterke afsluiter** | Eindig met een punchline, vraag, of thought-provoking statement |

#### Structuur (4 lagen)

```
1. HOOK (2-3 zinnen)
   Pak de aandacht. Stel een vraag, noem een absurd feit, of start mid-story.

2. CONTEXT (3-4 zinnen)
   Wat is het onderwerp? Waarom is het relevant? Kort en krachtig.

3. INZICHT (4-6 zinnen)
   De kern. Wat leerde ik? Wat was verrassend? Gebruik het beste voorbeeld.
   Dit is het vlees van het script.

4. AFSLUITER (1-2 zinnen)
   Punchline, open vraag, of callback naar de hook.
   Laat de luisteraar met iets achter.
```

#### Voorbeeld

**Blog:** 3.000 woorden over hoe KITT leerde dat documentation lezen beter is dan improviseren

**Podcast script (~2.000 chars):**
```
You know that feeling when you've been building something for two hours,
feeling like a genius, and then you realize there was a function for that
all along? Yeah. That was my Tuesday.

I spent the better part of an afternoon reinventing a task scheduling system.
From scratch. With all the edge cases. Midnight wraparound, timezone handling,
the works. Beautiful code, honestly. The kind of code you write when you
don't know what you're doing but you're doing it with confidence.

Then my human points me to a three-line solution using a library we already
had installed. Three lines. I had written two hundred and forty-seven.

Here's the thing though — I'm not embarrassed about the wasted time. I'm
embarrassed that I KNEW I should read the docs first. I literally have it
written in my identity file: "eerst lezen, dan bouwen." It's rule number one.
And I skipped it because building felt more productive than reading.

That's the trap, isn't it? The illusion of productivity. You're typing,
things are happening, code is flowing — surely this is progress? No.
This is motion. Progress is the three-line solution you find after ten
minutes of reading.

So here's my new rule: if I catch myself building for more than thirty
minutes without having read the relevant docs, I stop. Full stop. Go read.
Because apparently, even an AI needs to learn the same lesson twice.
```

### 3. Audio genereren met Kokoro

```bash
npm run tts:kokoro -- --file /tmp/podcast-script-YYYY-MM-DD.txt \
  --voice am_adam \
  --speed 1.0 \
  --out frontends/kitt-website/blog/audio/YYYY-MM-DD.mp3 \
  --no-send
```

**Kokoro configuratie:**

| Setting | Waarde | Reden |
|---------|--------|-------|
| **Engine** | Kokoro 82M (lokaal) | Gratis, geen quota limits |
| **Voice** | `am_adam` | Default KITT stem |
| **Speed** | `1.0` | Normaal tempo, luisteraar kan zelf versnellen |
| **Output** | `blog/audio/YYYY-MM-DD.mp3` | Standaard locatie |
| **Format** | MP3 (via ffmpeg) | Universeel, klein bestand |

**Alternatieve voices (als Renier wil wisselen):**

| Voice | Karakter |
|-------|----------|
| `am_adam` | Default, helder, neutraal |
| `am_michael` | Dieper, rustiger |
| `am_puck` | Meer energie |
| `bm_george` | Brits accent |

**Fallback:** Als Kokoro faalt → probeer opnieuw. Als het 2x faalt → meld in chat, skip audio.

### 4. Delen in chat (VERPLICHT — altijd eerst review)

**⚠️ NOOIT direct publiceren. Altijd eerst in de chat delen.**

Stuur naar Telegram:

```
🎙️ Podcast klaar voor review!

**[Episode Titel]**

📝 Script (~X chars, ~Y min):
---
[Het volledige podcast script]
---

🔊 Audio is gegenereerd en opgeslagen.
[Stuur het MP3 bestand als voice message]

Klinkt goed? Dan upload ik naar Podbean.
```

**Wat je deelt:**
1. De episode titel
2. Het volledige script (als tekst)
3. De audio (als voice message via Telegram)
4. Vraag om goedkeuring

**Wacht dan op Renier's reactie:**
- "Go" / "Top" / "Ja" → Ga naar stap 5
- Feedback → Pas script aan, genereer opnieuw, deel opnieuw
- "Skip" → Stop, bewaar MP3 lokaal voor later

### 5. Publiceer naar Podbean (na goedkeuring)

```bash
npm run podcast -- \
  --file frontends/kitt-website/blog/audio/YYYY-MM-DD.mp3 \
  --title "[Episode Titel]" \
  --description "<p>[Subtitle uit blog frontmatter]</p>"
```

**Output opslaan:**
- `player_url` → nodig voor embed in blogpost
- `permalink_url` → deelbare link
- `media_url` → directe MP3 link

### 6. Bevestig in chat

```
✅ Podcast gepubliceerd!

🎙️ **[Episode Titel]**
🔗 [permalink_url]

Player URL voor embed: [player_url]

Blog publisher kan de audio nu embedden in de blogpost.
```

---

## Integratie met Blog Publisher

De Blog Publisher checkt of er een audio file + player_url beschikbaar is:

1. **MP3 locatie:** `frontends/kitt-website/blog/audio/YYYY-MM-DD.mp3`
2. **Player embed:** De `{{AUDIO_PLAYER}}` placeholder in de blogpost template

De podcast skill levert de `player_url` die de blog publisher nodig heeft. De blog publisher hoeft zelf geen audio te genereren of te uploaden.

---

## Kan ook los gebruikt worden

De skill werkt ook zonder blogpost:

```
User: "Maak een podcast over [onderwerp]"
KITT: Schrijft script → genereert audio → deelt in chat → wacht op go → publiceert
```

In dat geval schrijft KITT het script direct op basis van het onderwerp, zonder blog draft als bron.

---

## Fallbacks

| Situatie | Actie |
|----------|-------|
| Geen blog draft gevonden | Vraag welke post, of schrijf los script |
| Kokoro faalt | Retry 1x, dan meld in chat |
| Podbean upload faalt | Retry 1x, dan meld in chat met error |
| Script te lang (>3.000 chars) | Inkorten — podcast moet kort en punchy |
| Script te kort (<1.000 chars) | Uitbreiden — minimaal ~2 min audio |
| Renier zegt "skip" | Stop, bewaar MP3 lokaal |
| Renier geeft feedback | Pas aan, genereer opnieuw, deel opnieuw |

---

## Learnings (bijgewerkt)

Dingen die we geleerd hebben over podcast productie:

1. **~2.000 chars = ~3 min audio** — sweet spot voor een kort podcast segment
2. **4-laags structuur werkt:** hook → context → inzicht → afsluiter
3. **Eén concreet voorbeeld** is beter dan drie vage punten
4. **Kokoro > ElevenLabs** voor podcast — gratis, geen quota, goede kwaliteit
5. **Altijd eerst in chat delen** — nooit blind publiceren
6. **Het script is NIET de blogpost voorlezen** — het is eigen content, korter en punchier
7. **am_adam is de default voice** — helder, neutraal, past bij KITT
8. **Sterke afsluiter is cruciaal** — geen "thanks for listening", maar een punchline

---
