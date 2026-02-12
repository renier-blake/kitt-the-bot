# Slack Integration Setup

> KITT als reguliere Slack user via User Token + Events API + Cloudflare Tunnel

## Overview

KITT verschijnt als een reguliere Slack workspace member (geen "APP" label). Berichten worden verstuurd met een **user token (xoxp-)** zodat ze eruitzien alsof een echte user ze stuurt.

Events worden ontvangen via de **Slack Events API** — Slack stuurt HTTP POSTs naar een public URL. Die public URL wordt geleverd door een **Cloudflare Tunnel** die KITT automatisch opstart als child process.

```
User stuurt DM in Slack
  → Slack Events API POST
  → Cloudflare Tunnel (slack.kitt-the.bot)
  → localhost:8000/slack/events
  → Signing secret verificatie (HMAC SHA256)
  → SlackAdapter.handleEvent()
  → Agent → response
  → chat.postMessage met user token
  → Verschijnt als reguliere user in Slack
```

## Architectuur

De tunnel draait **niet** als aparte PM2 service. KITT spawnt cloudflared automatisch als child process bij bridge startup wanneer:
1. `SLACK_ENABLED=true` is gezet
2. `CLOUDFLARE_TUNNEL_TOKEN` in de credential vault staat

Bij shutdown wordt het tunnel process automatisch gestopt. Geen config files, geen cert — alleen een token.

**Bestanden:**
- `src/bridge/tunnel.ts` — Tunnel child process manager
- `src/bridge/adapters/slack.ts` — SlackAdapter (ChannelAdapter)
- `src/bridge/slack-events.ts` — Express route voor Events API
- `src/bridge/format.ts` — `formatForSlack()` (Markdown → mrkdwn)
- `src/integrations/slack.ts` — Credential helpers

## Prerequisites

- Cloudflare account met domein (bijv. `kitt-the.bot`)
- `cloudflared` geïnstalleerd (`brew install cloudflared`)
- Slack workspace met admin rechten
- KITT bridge draaiend op `localhost:8000`

## Stap 1: Cloudflare Tunnel (eenmalig, door beheerder)

De tunnel wordt aangemaakt in het **Cloudflare Zero Trust dashboard** — volledig via de UI, geen CLI login nodig.

### 1.1 Tunnel aanmaken in dashboard

1. Ga naar https://one.dash.cloudflare.com
2. **Networks** → **Tunnels** → **Create a tunnel**
3. Type: **Cloudflared**
4. Naam: `kitt-slack` (of iets passends)
5. Je krijgt een **tunnel token** te zien — kopieer deze

### 1.2 Route configureren

In hetzelfde dashboard scherm:
1. **Public Hostname** tab
2. Hostname: `slack` + domein `kitt-the.bot` (wordt `slack.kitt-the.bot`)
3. Service: `HTTP` → `localhost:8000`
4. Save

### 1.3 Token opslaan in KITT

Via de **KITT Portal** (http://localhost:8000 → Integrations → Cloudflare Tunnel):
- Plak het tunnel token → Save

Of via CLI:
```bash
cd /path/to/kitt
npx tsx -e "
  import { setCredential } from './src/credentials/index.js';
  await setCredential('CLOUDFLARE_TUNNEL_TOKEN', '<jouw-tunnel-token>', 'token', 'Cloudflare tunnel');
"
```

De token zit nu encrypted in de vault. Bij elke bridge startup wordt de tunnel automatisch gestart.

### 1.4 Installeer cloudflared

```bash
# macOS
brew install cloudflared

# Linux (Debian/Ubuntu)
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb -o cloudflared.deb
sudo dpkg -i cloudflared.deb
```

> **Belangrijk:** cloudflared moet in PATH staan. KITT checkt dit bij startup en logt een error als het ontbreekt.

## Stap 2: Slack App aanmaken (eenmalig, door beheerder)

### 2.1 Nieuwe Slack App

1. Ga naar https://api.slack.com/apps
2. "Create New App" → "From scratch"
3. App Name: `KITT` (of iets anders)
4. Workspace: selecteer je workspace
5. "Create App"

### 2.2 OAuth & Permissions

Ga naar **OAuth & Permissions** in de sidebar.

**User Token Scopes** (NIET Bot Token Scopes):

| Scope | Doel |
|-------|------|
| `chat:write` | Berichten sturen als user |
| `im:read` | DM channels lezen |
| `im:write` | DM channels schrijven |
| `im:history` | DM history lezen |
| `users:read` | User info opvragen |
| `channels:read` | Public channels lezen |
| `channels:history` | Public channel history lezen |
| `groups:read` | Private channels lezen |
| `groups:history` | Private channel history lezen |

### 2.3 Redirect URL

Voeg toe onder **Redirect URLs**:
```
http://localhost:8000/api/auth/callback
```

> Als je de tunnel ook voor OAuth wilt gebruiken, voeg dan ook `https://slack.kitt-the.bot/api/auth/callback` toe.

### 2.4 Event Subscriptions

Ga naar **Event Subscriptions** in de sidebar.

1. Toggle **Enable Events** aan
2. **Request URL**: `https://slack.kitt-the.bot/slack/events`
   - Slack stuurt een challenge request — KITT moet draaien met `SLACK_ENABLED=true` en tunnel token in vault
3. **Subscribe to events on behalf of users**:
   - `message.im` — DM berichten
   - `message.channels` — Public channel berichten
   - `message.groups` — Private channel berichten
4. "Save Changes"

### 2.5 Credentials noteren

Ga naar **Basic Information** in de sidebar:

| Credential | Waar te vinden | Vault key |
|------------|---------------|-----------|
| Client ID | App Credentials → Client ID | `SLACK_CLIENT_ID` |
| Client Secret | App Credentials → Client Secret | `SLACK_CLIENT_SECRET` |
| Signing Secret | App Credentials → Signing Secret | `SLACK_SIGNING_SECRET` |

## Stap 3: Credentials configureren

### 3.1 Via KITT Portal (aanbevolen)

1. Open http://localhost:8000 → **Integrations**
2. **Cloudflare Tunnel** → plak tunnel token
3. **Slack** → plak Signing Secret via auth
4. **Slack** → "Connect" voor OAuth flow (user token)

### 3.2 Via CLI (alternatief)

```bash
cd /path/to/kitt
npx tsx -e "
  import { setCredential } from './src/credentials/index.js';
  await setCredential('SLACK_SIGNING_SECRET', '<signing-secret>', 'api_key');
  await setCredential('SLACK_CLIENT_ID', '<client-id>', 'oauth');
  await setCredential('SLACK_CLIENT_SECRET', '<client-secret>', 'oauth');
"
```

### 3.3 User Token via OAuth

De user token wordt verkregen via de OAuth flow:

1. Open KITT Portal → Integrations → Slack → "Connect"
2. Dit opent de Slack OAuth flow
3. Authoriseer de app met je user account
4. Token wordt automatisch opgeslagen als `SLACK_USER_TOKEN` in de vault

**Alternatief (handmatig):** Ga naar https://api.slack.com/apps → je app → OAuth & Permissions → "Install to Workspace". Kopieer het **User OAuth Token** (begint met `xoxp-`).

## Stap 4: KITT starten met Slack

Geen `.env` variabelen nodig. KITT detecteert automatisch of Slack geconfigureerd is op basis van credentials in de vault.

### 4.1 Start/herstart

```bash
pm2 restart kitt
```

Dat is alles. KITT checkt bij startup:
1. `SLACK_USER_TOKEN` in vault? + `SLACK_SIGNING_SECRET` in vault? → Slack adapter starten
2. `CLOUDFLARE_TUNNEL_TOKEN` in vault? → Cloudflared tunnel starten als child process
3. `/slack/events` route altijd geregistreerd (self-guards via signing secret)

### 4.3 Verificatie

```bash
pm2 logs kitt --lines 30

# Verwachte output:
# [tunnel] Starting Cloudflare Tunnel...
# [tunnel] ... connection registered ...
# [slack] Slack adapter started (user: your.username, team: Your Workspace)
# Slack events route registered at POST /slack/events
```

## Stap 5: Testen

1. **DM test:** Stuur een DM naar het Slack account dat de user token bezit → KITT moet antwoorden
2. **Channel test:** @mention KITT in een channel → KITT moet antwoorden in een thread
3. **Event Subscriptions:** Check https://api.slack.com/apps → Event Subscriptions — de Request URL moet groen zijn

## Setup voor nieuwe users

Wanneer de beheerder alles eenmalig heeft geconfigureerd (tunnel + Slack App + credentials in vault), hoeven nieuwe KITT installaties alleen:

1. `brew install cloudflared` (als nog niet geïnstalleerd)
2. `pm2 restart kitt`

Dat is alles. De tunnel token en Slack credentials zitten al encrypted in de database (`profile/data/kitt.db`). KITT detecteert ze automatisch bij startup.

## Troubleshooting

### "cloudflared not found in PATH"
- Installeer: `brew install cloudflared` (macOS) of via apt/dpkg (Linux)

### "CLOUDFLARE_TUNNEL_TOKEN not configured"
- Token niet in vault — voeg toe via Portal of CLI (zie Stap 1.3)

### "Slack adapter not connected, dropping event"
- Check of `SLACK_USER_TOKEN` in de vault staat
- Check of het token geldig is: `auth.test` moet slagen

### "Invalid Slack signature"
- Check of `SLACK_SIGNING_SECRET` correct is (kopieer opnieuw uit Slack App → Basic Information)
- Check of de server tijd synchroon loopt (timestamp check is 5 minuten)

### Events komen niet binnen
- Check of tunnel draait: `pm2 logs kitt` en zoek `[tunnel]` entries
- Check of de Request URL groen is in Slack App settings
- Test handmatig: `curl https://slack.kitt-the.bot/api/health`

### Tunnel crasht / herstart constant
- Check `pm2 logs kitt` voor `[tunnel]` errors
- Verify token is geldig in Cloudflare dashboard
- Probeer handmatig: `cloudflared tunnel run --token <TOKEN>`

### "rawBody not available"
- De express.json middleware heeft geen `verify` callback — check `log-server.ts`

## Vault keys overzicht

| Key | Type | Bron |
|-----|------|------|
| `CLOUDFLARE_TUNNEL_TOKEN` | token | Cloudflare dashboard |
| `SLACK_CLIENT_ID` | oauth | Slack App → Basic Information |
| `SLACK_CLIENT_SECRET` | oauth | Slack App → Basic Information |
| `SLACK_SIGNING_SECRET` | api_key | Slack App → Basic Information |
| `SLACK_USER_TOKEN` | token | Via OAuth flow (automatisch) |
