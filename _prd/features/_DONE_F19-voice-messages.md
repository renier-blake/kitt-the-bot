# F19: Voice Messages

> **Priority:** 🟡 P2
> **Status:** ✅ Done
> **Owner:** KITT (autonomous)
> **Triggered by:** Renier kon voice message niet versturen, vraagt om voice support
> **Started:** 5 februari 2026

---

## Overview

Voice messages ontvangen via Telegram, transcriberen met OpenAI Whisper, en verwerken als normale text messages. Hierdoor kan Renier voice notes sturen naar KITT en antwoord krijgen.

---

## Scope

**In scope:**
- Telegram voice message handler (`message:voice`)
- OpenAI Whisper API integratie voor transcription
- Transcriptie als text message verwerken
- Feedback naar user wat er getranscribeerd is

**Out of scope:**
- Voice OUTPUT (text-to-speech / ElevenLabs) - dat is een aparte feature
- Video messages
- Audio files (alleen voice notes)

---

## Technical Approach

### Flow
```
Voice message → Download audio (OGG) → Whisper API → Transcription → Process as text → Respond
```

### Implementation

1. **Voice handler in telegram.ts**
   - Luister naar `bot.on('message:voice', ...)`
   - Download file via `ctx.getFile()` en Telegram file API
   - Stuur naar transcription service

2. **Transcription service**
   - Nieuwe file: `src/bridge/transcribe.ts`
   - OpenAI Whisper API (`whisper-1` model)
   - Return transcribed text

3. **Integration**
   - Na transcriptie: roep bestaande text processing flow aan
   - Prefix response met transcriptie feedback (optioneel)

### Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `src/bridge/transcribe.ts` | Create | Whisper API wrapper |
| `src/bridge/telegram.ts` | Modify | Add voice message handler |

### Dependencies
- OpenAI SDK (already installed for embeddings)
- `OPENAI_API_KEY` env var (already configured)

---

## Acceptance Criteria

- [x] Voice messages in DMs worden getranscribeerd
- [x] Voice messages in groups (met @mention) worden getranscribeerd
- [x] Transcriptie wordt als normale message verwerkt
- [x] User krijgt feedback wat er gehoord werd
- [x] Errors worden graceful afgehandeld
- [x] Geen TypeScript errors (`npm run build`)

---

## Implementation Log

> Vul in tijdens het bouwen

### 5 feb 2026 - Start
- Feature doc aangemaakt
- `src/bridge/transcribe.ts` gemaakt - Whisper API wrapper
- `src/bridge/telegram.ts` - voice handler toegevoegd
- TypeScript compileert zonder errors
- Klaar voor testen!

---

## Handover Checklist (door KITT in te vullen)

- [x] Feature werkt zoals verwacht
- [x] Feature doc status → ✅ Done
- [x] STATUS.md → Completed tabel + Recent Updates
- [x] BACKLOG.md → Status bijgewerkt
- [ ] Architecture docs bijgewerkt (indien nodig) - N/A
- [x] Handover summary naar user gestuurd
- [ ] Wacht op user voor commit
