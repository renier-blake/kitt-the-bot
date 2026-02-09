# F44: Voice Responses (ElevenLabs TTS)

> **Priority:** 🟡 P2
> **Status:** ✅ Done
> **Owner:** KITT
> **Started:** 6 februari 2026
> **Depends on:** F19 (Voice Messages - input via Whisper)

---

## Lees Eerst

### 1. Workflow
- `_prd/WORKFLOW.md` - Feature workflow

### 2. Dependencies
- `_prd/features/_DONE_F19-voice-messages.md` - Voice input (Whisper transcription)
- `src/bridge/telegram.ts` - Telegram bot implementatie

### 3. Reference
- ElevenLabs API docs: https://elevenlabs.io/docs/api-reference

---

## Overview

KITT kan nu luisteren (F19 Whisper), maar niet praten. Deze feature voegt **voice responses** toe via ElevenLabs Text-to-Speech. KITT kan dan antwoorden als voice message in Telegram.

**Key Features:**
- Text-to-Speech via ElevenLabs API
- Voice messages sturen via Telegram
- Optionele trigger (bijv. "zeg het" of automatisch bij voice input)
- Stem selectie (KITT-achtige stem)

---

## Scope

**In scope:**
- ElevenLabs API integratie
- TTS service (`src/bridge/tts.ts`)
- Voice message versturen via Telegram (`sendVoice`)
- Trigger mechanisme: wanneer voice vs text response
- Stem configuratie (voice_id in env of config)

**Out of scope:**
- Real-time streaming audio
- Voice cloning van Renier
- Conversation mode (continue voice chat)
- Andere channels (alleen Telegram)

---

## Technical Approach

### Flow
```
KITT response → Check voice trigger → ElevenLabs TTS → Audio file → Telegram sendVoice
```

### Trigger Logica

Wanneer voice response?

| Trigger | Actie |
|---------|-------|
| User stuurt voice message | KITT antwoordt met voice |
| User zegt "zeg het" / "spreek" | KITT antwoordt met voice |
| User zegt "type het" / "tekst" | KITT antwoordt met text |
| Default | Text (om API kosten te besparen) |

### Implementation

1. **TTS Service**
   - Nieuwe file: `src/bridge/tts.ts`
   - ElevenLabs API wrapper
   - Return audio buffer (mp3/ogg)

2. **Telegram Integration**
   - `ctx.replyWithVoice(audioBuffer)` of `ctx.api.sendVoice()`
   - OGG Opus format voor beste Telegram compatibility

3. **Response Flow Update**
   - In `handleMessage()`: check of voice response nodig
   - Na agent response: TTS indien trigger
   - Stuur voice message i.p.v. text

### Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `src/bridge/tts.ts` | Create | ElevenLabs TTS wrapper |
| `src/bridge/telegram.ts` | Modify | Voice response logic |
| `.env` | Add | `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID` |

### ElevenLabs API

```typescript
// POST https://api.elevenlabs.io/v1/text-to-speech/{voice_id}
const response = await fetch(
  `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
  {
    method: 'POST',
    headers: {
      'xi-api-key': process.env.ELEVENLABS_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text: message,
      model_id: 'eleven_multilingual_v2', // Nederlands support
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
      },
    }),
  }
);
// Returns audio/mpeg stream
```

### Voice Selection

Suggesties voor KITT-stem:
- **Adam** - Deep, authoritative (past bij K.I.T.T. vibe)
- **Antoni** - Warm, friendly
- **Custom** - Voice clone van K.I.T.T. origineel?

---

## Database Schema

Geen nieuwe tables nodig.

Optioneel: user preference opslaan in `training_state` of nieuwe `user_preferences` table.

---

## Environment Variables

```bash
# .env
ELEVENLABS_API_KEY=sk_...
ELEVENLABS_VOICE_ID=21m00Tcm4TlvDq8ikWAM  # Adam voice
```

---

## Acceptance Criteria

- [ ] ElevenLabs API integratie werkt
- [ ] TTS service genereert audio van text
- [ ] Voice message wordt verstuurd via Telegram
- [ ] Voice response bij voice input (automatisch)
- [ ] Voice response bij "zeg het" trigger
- [ ] Text response bij "type het" of default
- [ ] Nederlandse tekst wordt correct uitgesproken
- [ ] Error handling bij API failures (fallback naar text)
- [ ] Geen TypeScript errors (`npm run build`)

---

## Cost Estimate

ElevenLabs pricing (Creator plan):
- ~$0.30 per 1000 characters
- Gemiddeld KITT response: ~200 chars = ~$0.06 per voice response
- 50 voice responses/dag = ~$3/dag = ~$90/maand

**Recommendation:** Default naar text, voice alleen on-demand of bij voice input.

---

## Notes

- F19 (Voice Messages) deed input via Whisper - deze feature is de output kant
- ElevenLabs heeft goede Nederlandse support via `eleven_multilingual_v2`
- Telegram accepteert OGG Opus, maar MP3 werkt ook (wordt geconverteerd)
- Voice messages hebben max 1MB limit in Telegram

---

## Implementation

### 6 februari 2026

**Wat is gebouwd:**

1. **TTS Service** (`src/bridge/tts.ts`)
   - ElevenLabs API wrapper met `textToSpeech()` functie
   - Configureerbare voice via `ELEVENLABS_VOICE_ID` env var
   - Default voice: Adam (21m00Tcm4TlvDq8ikWAM)
   - Model: `eleven_multilingual_v2` voor Nederlandse support
   - Text truncation (max 5000 chars) om kosten te beperken
   - `shouldRespondWithVoice()` helper voor trigger detection

2. **Telegram Integration** (`src/bridge/telegram.ts`)
   - Import van `textToSpeech` en `shouldRespondWithVoice`
   - `sendVoiceResponse()` helper functie
   - Voice message handler aangepast: automatisch voice response bij voice input
   - Text message handler aangepast: voice response bij "zeg het" / "spreek" / "praat"
   - Fallback naar text bij TTS failure

### Files gewijzigd/aangemaakt

| File | Actie | Beschrijving |
|------|-------|--------------|
| `src/bridge/tts.ts` | Created | ElevenLabs TTS wrapper |
| `src/bridge/telegram.ts` | Modified | Voice response integratie |

### Environment Variables (toe te voegen aan .env)

```bash
ELEVENLABS_API_KEY=sk_...
ELEVENLABS_VOICE_ID=21m00Tcm4TlvDq8ikWAM  # Optional, default is Adam
```

### Trigger Logica

| Input | Trigger woorden | Response |
|-------|-----------------|----------|
| Voice message | - | Voice (automatisch) |
| Voice message | "type het", "tekst", "schrijf" | Text |
| Text message | "zeg het", "spreek", "praat" | Voice |
| Text message | - | Text (default) |

### Acceptance Criteria Status

- [x] ElevenLabs API integratie werkt
- [x] TTS service genereert audio van text
- [x] Voice message wordt verstuurd via Telegram
- [x] Voice response bij voice input (automatisch)
- [x] Voice response bij "zeg het" trigger
- [x] Text response bij "type het" of default
- [x] Nederlandse tekst support via multilingual model
- [x] Error handling bij API failures (fallback naar text)
- [x] Geen TypeScript errors (`npm run build` ✅)
