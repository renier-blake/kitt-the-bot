# Integrations Architecture

> OAuth & third-party API integraties via Nango + eigen OAuth2 framework

---

## Overview

KITT gebruikt **Nango** als OAuth/API layer voor externe integraties (Gmail, Google Calendar, etc.). Nango handelt alle OAuth flows, token refresh, en API proxying af.

```
┌─────────────────────────────────────────────────────────────┐
│  KITT Skill                                                 │
│  (bijv. gmail skill)                                        │
└─────────────────┬───────────────────────────────────────────┘
                  │ proxyRequest('google-mail', { endpoint })
                  ▼
┌─────────────────────────────────────────────────────────────┐
│  src/integrations/nango.ts                                  │
│  - Vindt juiste connection (default of by label)           │
│  - Proxy request naar Nango                                 │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│  Nango (cloud)                                              │
│  - Injecteert OAuth token                                   │
│  - Refresht token indien nodig                              │
│  - Forwardt request naar API                                │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│  Google / Microsoft / etc.                                  │
└─────────────────────────────────────────────────────────────┘
```

---

## Waarom Nango?

| Probleem | Zonder Nango | Met Nango |
|----------|-------------|-----------|
| OAuth apps registreren | Per service, verificatie nodig | Al gedaan voor 600+ APIs |
| Token refresh | Zelf bouwen | Automatisch |
| Token storage | Zelf beveiligen | Nango doet dit |
| Nieuwe integratie | Weken werk | Config + skill |

**Kosten:** Free tier voor development, ~$50/maand bij 5+ klanten.

---

## Files

| File | Doel |
|------|------|
| `src/integrations/nango.ts` | Nango client, proxy requests, connection management |
| `src/integrations/config.ts` | Database config, multi-account connection storage |
| `src/integrations/oauth.ts` | Eigen OAuth2 framework — database-driven, geen code changes nodig |
| `src/integrations/slack.ts` | Slack credential helpers (user token, signing secret) |

---

## Configuratie

### Environment Variables

```bash
# .env
NANGO_SECRET_KEY=your-nango-secret-key
```

### Database Tables

```sql
-- User config (kitt_config)
CREATE TABLE kitt_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  updated_at INTEGER
);

-- Connection management (kitt_connections)
CREATE TABLE kitt_connections (
  id INTEGER PRIMARY KEY,
  integration_id TEXT NOT NULL,    -- 'google-mail', 'google-calendar'
  connection_id TEXT NOT NULL,     -- Nango connection ID
  label TEXT NOT NULL,             -- 'Persoonlijk', 'LeadIT'
  account_email TEXT,              -- 'renier@example.com'
  is_default INTEGER DEFAULT 0,
  created_at INTEGER,
  UNIQUE(integration_id, connection_id)
);
```

---

## Multi-Account Support

KITT ondersteunt meerdere accounts per integratie. Bijvoorbeeld: 3 Gmail accounts.

### Hoe het werkt

1. User verbindt account via Portal → Nango OAuth
2. Na success: `registerConnection()` slaat metadata op in `kitt_connections`
3. Skills kunnen specifiek account aanroepen via label

### Voorbeeld: Meerdere Gmail accounts

```typescript
// Default account (eerste of is_default=1)
await proxyRequest('google-mail', {
  endpoint: '/gmail/v1/users/me/messages',
});

// Specifiek account via label
await proxyRequest('google-mail', {
  endpoint: '/gmail/v1/users/me/messages',
  account: 'LeadIT',  // Label uit kitt_connections
});
```

### Connection Resolution

```
1. options.connectionId  → Expliciet opgegeven
2. options.account       → Lookup by label in kitt_connections
3. default connection    → is_default=1 in kitt_connections
4. first connection      → Fallback: eerste match in Nango
```

---

## API Reference

### Connections

```typescript
// List all connections from Nango
const connections = await listConnections();

// Check if integration is connected
const connected = await isConnected('google-mail');

// Get specific connection
const conn = await getConnection('google-mail', connectionId?);

// Register new connection (after OAuth success)
await registerConnection(
  'google-mail',
  'conn_abc123',
  'Persoonlijk',
  'renier@gmail.com',
  true  // isDefault
);

// Delete connection
await deleteConnection('google-mail', connectionId?);
```

### OAuth Flow (Portal)

```typescript
// 1. Create connect session for frontend
const session = await createConnectSession('google-mail');
// Returns: { token, expiresAt }

// 2. Frontend shows Nango Connect UI with token
// 3. User completes OAuth
// 4. Frontend calls registerConnection() with result
```

### Proxy Requests

```typescript
// Simple GET
const emails = await proxyRequest('google-mail', {
  endpoint: '/gmail/v1/users/me/messages',
  params: { maxResults: '10' },
});

// POST with data
await proxyRequest('google-mail', {
  method: 'POST',
  endpoint: '/gmail/v1/users/me/messages/send',
  data: { raw: base64EncodedEmail },
});

// With specific account
await proxyRequest('google-calendar', {
  endpoint: '/calendar/v3/calendars/primary/events',
  account: 'Work',
});
```

---

## Beschikbare Integraties

### Via Nango (cloud OAuth)

| Integration ID | Provider | Skill |
|---------------|----------|-------|
| `google-mail` | Gmail | `.claude/skills/gmail/` |
| `google-calendar` | Google Calendar | `.claude/skills/calendar/` |

### Via Direct OAuth (eigen framework)

| Integration ID | Provider | Doel |
|---------------|----------|------|
| `slack` | Slack | User token (xoxp-) voor Slack User adapter |
| `slack-bot` | Slack | Bot token (xoxb-) voor Slack Bot adapter (Socket Mode) |

### Nieuwe integratie toevoegen

**Nango (voor standaard OAuth providers):**
1. Nango Dashboard → Add integration (provider + scopes)
2. Skill in `.claude/skills/[name]/SKILL.md`
3. Portal "Connect" button (optional)

**Direct OAuth (voor providers die Nango niet ondersteunen of custom flow nodig):**
1. DB insert in `integrations` tabel met `auth_config` JSON
2. Credentials in vault (`SLACK_CLIENT_ID`, etc.)
3. Geen code changes nodig — framework leest config uit DB

---

## Direct OAuth Framework

Voor integraties die niet via Nango lopen (bijv. Slack met user token), heeft KITT een eigen database-driven OAuth2 framework.

### Hoe het werkt

```
┌─────────────────────────────────────────────────────────────┐
│  KITT Portal → "Connect" button                             │
└─────────────────┬───────────────────────────────────────────┘
                  │ GET /api/integrations/:id/authorize
                  ▼
┌─────────────────────────────────────────────────────────────┐
│  src/integrations/oauth.ts                                  │
│  - Leest auth_config JSON uit `integrations` tabel         │
│  - Bouwt authorize URL met client_id, scopes, redirect_uri │
│  - State parameter = integrationId                          │
└─────────────────┬───────────────────────────────────────────┘
                  │ Redirect naar provider
                  ▼
┌─────────────────────────────────────────────────────────────┐
│  Provider (Slack, Google, etc.)                             │
│  - User authorizeert                                        │
│  - Redirect naar callback met code                          │
└─────────────────┬───────────────────────────────────────────┘
                  │ GET /api/auth/callback?code=xxx&state=slack
                  ▼
┌─────────────────────────────────────────────────────────────┐
│  oauth.ts → exchangeCodeForTokens()                        │
│  - Code → token exchange via POST                           │
│  - Dot notation support (bijv. authed_user.access_token)   │
│  - Token opgeslagen in credential vault                     │
│  - Redirect URI override voor HTTPS-only providers          │
└─────────────────────────────────────────────────────────────┘
```

### Database Config (integrations tabel)

```json
{
  "client_id_key": "SLACK_CLIENT_ID",
  "client_secret_key": "SLACK_CLIENT_SECRET",
  "token_key": "SLACK_USER_TOKEN",
  "refresh_token_key": null,
  "authorize_url": "https://slack.com/oauth/v2/authorize",
  "token_url": "https://slack.com/api/oauth.v2.access",
  "scopes": "",
  "token_response_field": "authed_user.access_token",
  "redirect_uri": "https://slack.kitt-the.bot/api/auth/callback",
  "extra_authorize_params": {
    "user_scope": "chat:write,im:read,im:write,im:history,users:read,channels:read,channels:history,groups:read,groups:history"
  }
}
```

### Features

- **Database-driven:** Nieuwe provider = DB insert, geen code changes
- **Dot notation:** `authed_user.access_token` voor geneste token responses
- **Redirect URI override:** Voor HTTPS-only providers (via Cloudflare Tunnel)
- **Token refresh:** Optioneel, via `refresh_token_key`
- **Credential vault:** Tokens worden encrypted opgeslagen

---

## Error Handling

```typescript
try {
  const result = await proxyRequest('google-mail', { ... });
} catch (error) {
  // Mogelijke errors:
  // - "No connection found for integration: google-mail"
  // - Nango API errors (token invalid, rate limit, etc.)
  // - Downstream API errors (Gmail 403, etc.)
}
```

### Token Refresh

Nango handelt token refresh automatisch af. Als een token expired is:
1. Nango detecteert 401 response
2. Nango refresht token met refresh_token
3. Nango retry't de request
4. KITT krijgt gewoon het resultaat

---

## Config Service

De config service (`config.ts`) leest user settings uit de database:

```typescript
// Get single value (fallback to env var KITT_USER_ID)
const userId = await getConfigValue('user_id', 'default');

// Set value
await setConfigValue('timezone', 'Europe/Amsterdam');

// Get all config
const config = await getAllConfig();
// { userId, userEmail, userName, timezone }
```

### Config Keys

| Key | Beschrijving | Env Fallback |
|-----|-------------|--------------|
| `user_id` | Nango user identifier | `KITT_USER_ID` |
| `user_email` | User email | `KITT_USER_EMAIL` |
| `user_name` | Display name | `KITT_USER_NAME` |
| `timezone` | Timezone | `KITT_TIMEZONE` |
