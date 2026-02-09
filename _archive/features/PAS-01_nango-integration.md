# PAS-01: Nango OAuth Integration

**Status:** 🔧 In Progress
**Prioriteit:** High
**Datum:** 9 feb 2026

---

## Wat is Nango?

[Nango](https://nango.dev) is een OAuth/API layer die:
- OAuth flows afhandelt (token acquisition, automatic refresh)
- API proxying doet met automatische token injection
- 600+ pre-built integraties ondersteunt (Gmail, Google Calendar, Slack, etc.)

## Setup Stappen

### 1. Nango Account Aanmaken

1. Ga naar [app.nango.dev](https://app.nango.dev)
2. Maak een account aan (gratis tier beschikbaar)
3. Je komt in de Nango dashboard

### 2. Secret Key Ophalen

1. Ga naar **Environment Settings** (tandwiel icoon, linker sidebar)
2. Klik op **Backend** tab
3. Kopieer de **Secret Key** (begint met een UUID of `nango_secret_...`)

### 3. Environment Variables

Voeg toe aan `.env`:

```bash
NANGO_SECRET_KEY=jouw-secret-key-hier
NANGO_CALLBACK_URL=https://api.nango.dev/oauth/callback
```

### 4. SDK Installeren

```bash
npm install @nangohq/node
```

### 5. Service File

De Nango service staat in `src/integrations/nango.ts` en biedt:

| Functie | Doel |
|---------|------|
| `getNango()` | Get/create Nango client |
| `createConnectSession(integrationId)` | Maak session voor Connect UI |
| `listConnections()` | Lijst alle actieve connecties |
| `getConnection(integrationId)` | Haal specifieke connectie op |
| `deleteConnection(integrationId)` | Verwijder connectie |
| `proxyRequest(integrationId, options)` | API call via Nango (auto token) |
| `isConnected(integrationId)` | Check of integratie connected is |
| `listIntegrations()` | Lijst beschikbare integraties |

### 6. Integratie Toevoegen in Nango Dashboard

Om een nieuwe service (bijv. Gmail) te koppelen:

1. Ga naar **Integrations** in Nango dashboard
2. Klik **Add Integration**
3. Zoek de provider (bijv. "Google Mail")
4. Configureer OAuth credentials:
   - Maak een project in [Google Cloud Console](https://console.cloud.google.com)
   - Maak OAuth 2.0 credentials
   - Voeg `https://api.nango.dev/oauth/callback` als redirect URI toe
   - Kopieer Client ID en Client Secret naar Nango
5. Sla op

---

## Gebruik in Code

### Connect Session maken (voor frontend)

```typescript
import { createConnectSession } from '../integrations/nango.js';

// Maak session voor Gmail integratie
const session = await createConnectSession('google-mail');
// session.token wordt gebruikt door frontend Connect UI
```

### API Call maken

```typescript
import { proxyRequest } from '../integrations/nango.js';

// Gmail: Haal labels op
const labels = await proxyRequest<{ labels: Array<{ id: string; name: string }> }>(
  'google-mail',
  { endpoint: '/gmail/v1/users/me/labels' }
);
```

### Check of connected

```typescript
import { isConnected } from '../integrations/nango.js';

if (await isConnected('google-mail')) {
  // Gmail is gekoppeld
}
```

---

## Frontend Connect UI

Nango biedt een white-label Connect UI. Integratie in de portal:

```typescript
// In portal API endpoint
app.get('/api/nango/connect/:integration', async (req, res) => {
  const session = await createConnectSession(req.params.integration);
  res.json({ token: session.token });
});
```

```typescript
// In frontend
import Nango from '@nangohq/frontend';

const nango = new Nango();
await nango.openConnectUI({ sessionToken: token });
```

---

## Volgende Stappen

- [ ] Integraties configureren in Nango dashboard (Gmail, Google Calendar)
- [ ] Portal Connect UI pagina bouwen
- [ ] API endpoints voor connection management
- [ ] Skills maken die Nango integraties gebruiken

---

## Files

| File | Doel |
|------|------|
| `src/integrations/nango.ts` | Nango service (backend) |
| `.env` | `NANGO_SECRET_KEY` |
