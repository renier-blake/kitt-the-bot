# Google Cloud TTS Setup

> KITT voice responses via Google Cloud Text-to-Speech (WaveNet)

## Overview

KITT kan antwoorden als spraakberichten via Google Cloud TTS. De voice mode wordt organisch getriggerd door de gebruiker ("ik zit in de auto") en blijft actief tot de gebruiker het uitschakelt ("mag weer tekst").

```
User stuurt "ik zit in de auto"
  → Agent herkent voice trigger
  → VOICE_MODE:on signal in response
  → Router zet voice_mode = true voor deze chat
  → Volgende responses:
    → tekst → Google Cloud TTS → OGG Opus audio
    → Telegram/WhatsApp sendVoice()
    → User hoort spraakbericht
```

## Architectuur

Voice mode draait volledig in de bridge. Geen aparte services nodig.

**Bestanden:**
- `src/bridge/tts.ts` — TTS service (Google Cloud API call + text cleaning)
- `src/bridge/router.ts` — VOICE_MODE signal parsing + voice routing
- `profile/context/instructions/core.md` — Agent instructies voor VOICE_MODE signals

**Flow:**
1. Agent stuurt `VOICE_MODE:on` of `VOICE_MODE:off` signal
2. Router parsed het signal en slaat voice_mode op in chat meta tabel
3. Bij voice_mode = true: response → `analyzeContentForVoice()` → `textToSpeech()` → `sendVoice()`
4. Content analysis splitst: prose → voice, tabellen/code → tekst

## Prerequisites

- Google Cloud account
- Google Cloud project met billing enabled
- Cloud Text-to-Speech API enabled

## Stap 1: Google Cloud Project

### 1.1 Project aanmaken (als je er nog geen hebt)

1. Ga naar https://console.cloud.google.com
2. Selecteer of maak een project (bijv. "KITT")
3. Zorg dat billing is ingeschakeld

### 1.2 Text-to-Speech API enablen

1. Ga naar **APIs & Services** → **Library**
2. Zoek "Cloud Text-to-Speech API"
3. Klik **Enable**

> **Let op:** Er zijn twee TTS APIs in Google Cloud. Enable "Cloud Text-to-Speech API" (de standaard, niet "Cloud Text-to-Speech API v1beta1").

## Stap 2: API Key aanmaken

### 2.1 Org Policy check (Google Workspace users)

Nieuwe Google Workspace accounts hebben een managed policy die API key creatie blokkeert. Als je deze fout ziet:

> "API key permission issue — You currently do not have permission to create API keys"

Dan moet je de policy overriden:

```bash
# Installeer gcloud CLI (eenmalig)
brew install --cask google-cloud-sdk

# Login
gcloud auth login

# Geef jezelf Organization Policy Administrator rechten
gcloud organizations add-iam-policy-binding $(gcloud organizations list --format='value(ID)') \
  --member="user:jouw@email.com" \
  --role="roles/orgpolicy.policyAdmin"

# Reset de API key policy
gcloud org-policies reset iam.managed.disableServiceAccountApiKeyCreation \
  --organization=$(gcloud organizations list --format='value(ID)')
```

### 2.2 API Key aanmaken

**Via gcloud (aanbevolen):**

```bash
gcloud services api-keys create \
  --project=JOUW_PROJECT_ID \
  --display-name="KITT TTS" \
  --api-target=service=texttospeech.googleapis.com
```

Dit maakt een API key aan die **alleen** de TTS API kan aanroepen (security best practice).

**Via Console:**

1. Ga naar **APIs & Services** → **Credentials**
2. **Create Credentials** → **API Key**
3. Klik op de nieuwe key → **Edit API Key**
4. Onder **API restrictions**: selecteer "Restrict key" → "Cloud Text-to-Speech API"
5. Save

## Stap 3: Key configureren in KITT

### 3.1 Via KITT Portal (aanbevolen)

1. Open http://localhost:8000 → **Integrations**
2. **Google Cloud TTS** → plak je API key → Save
3. Optioneel: selecteer een stem (default: Dutch Male WaveNet)

### 3.2 Via CLI (alternatief)

```bash
cd /path/to/kitt
npx tsx -e "
  import { setCredential } from './src/credentials/index.js';
  await setCredential('GOOGLE_CLOUD_TTS_API_KEY', '<jouw-api-key>', 'api_key', 'Google Cloud TTS');
"
```

## Stap 4: Testen

### 4.1 Quick test

```bash
cd /path/to/kitt
node -e "
  require('dotenv/config');
  const { textToSpeech } = require('./dist/bridge/tts.js');
  textToSpeech('Hallo, dit is een test.').then(r => {
    console.log('Success:', r.success, '| Audio:', r.audio?.length, 'bytes');
    if (r.error) console.log('Error:', r.error);
  });
"
```

### 4.2 Telegram voice test

```bash
npm run tts -- "Dit is een test van KITT voice mode"
```

### 4.3 Live test via chat

Stuur KITT een bericht in Telegram of WhatsApp:
> "Ik zit in de auto, praat maar tegen me"

KITT schakelt over naar voice mode en stuurt spraakberichten terug.

## Voice Selectie

De stem kan gekozen worden via de KITT Portal (Integrations → Google Cloud TTS → Voice dropdown) of via `kitt_config`:

| Voice | Beschrijving | Prijs |
|-------|-------------|-------|
| `nl-NL-Wavenet-G` | Dutch Male (WaveNet) — default | $16/1M chars |
| `nl-NL-Wavenet-F` | Dutch Female (WaveNet) | $16/1M chars |
| `nl-NL-Standard-G` | Dutch Male (Standard) | $4/1M chars |
| `nl-NL-Standard-F` | Dutch Female (Standard) | $4/1M chars |

WaveNet stemmen klinken aanzienlijk natuurlijker dan Standard. Het prijsverschil is minimaal bij normaal gebruik (~100 berichten/dag = ~$0.05/dag voor WaveNet).

## Content Analysis

Niet alle responses zijn geschikt voor voice. KITT analyseert automatisch:

| Content type | Actie |
|-------------|-------|
| Pure tekst | Voice |
| Tekst + tabellen/code | Mixed: tekst als voice, data als tekstbericht |
| Alleen tabellen/code | Tekst (geen voice) |

Dit wordt afgehandeld door `analyzeContentForVoice()` in `tts.ts`.

## Kosten

Google Cloud TTS biedt **gratis tier**:
- WaveNet: 1 miljoen characters/maand gratis
- Standard: 4 miljoen characters/maand gratis

Daarboven:
- WaveNet: $16 per 1 miljoen characters
- Standard: $4 per 1 miljoen characters

Bij gemiddeld gebruik (100 voice responses/dag, ~200 chars elk) = ~600K chars/maand → **gratis**.

## Troubleshooting

### "Google Cloud TTS API key not configured"
- Key niet in vault — voeg toe via Portal of CLI (zie Stap 3)

### "Google TTS API error: 403"
- API key is ongeldig of verlopen
- Cloud Text-to-Speech API niet enabled in je project
- API key restriction blokkeert de TTS service

### "Google TTS API error: 400"
- Ongeldige voice naam of language code
- Tekst is leeg na cleaning

### Voice mode schakelt niet in
- Check of `profile/context/instructions/core.md` de VOICE_MODE instructies bevat
- Check router logs: `pm2 logs kitt` en zoek `VOICE_MODE`

### Audio klinkt raar/afgekapt
- Check of de tekst niet te lang is (Google max: 5000 chars per request)
- Probeer een andere voice (WaveNet vs Standard)

## Vault keys overzicht

| Key | Type | Bron |
|-----|------|------|
| `GOOGLE_CLOUD_TTS_API_KEY` | api_key | Google Cloud Console → Credentials |

## Config values

| Key | Tabel | Beschrijving |
|-----|-------|-------------|
| `google_cloud_tts_voice` | `kitt_config` | Geselecteerde stem (via Portal dropdown) |
