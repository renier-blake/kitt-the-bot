# Hosted KITT — Architectuur Brainstorm

> Aangemaakt: 11 feb 2026
> Status: Brainstorm / Verkenning

---

## Uitgangspunten

- Self-hosted blijft de primaire optie
- Hosted is een aanvullend model voor niet-technische users
- Security is non-negotiable: data-isolatie per user
- Lokale LLMs (Whisper, Kokoro) vervangen door cloud APIs in hosted variant
- Claude API calls betaalt de user zelf (eigen Anthropic account)

---

## Platform Keuze

### Render vs Railway vs Fly.io

| | Render | Railway | Fly.io |
|---|--------|---------|--------|
| **Pricing model** | Per service, vaste plans | Usage-based, per resource | Per machine, pay-as-you-go |
| **Persistent disk** | ✅ Ja (tot 1TB) | ✅ Ja (volumes) | ✅ Ja (volumes) |
| **SQLite support** | ✅ Op persistent disk | ✅ Op volume | ✅ Op volume |
| **Private networking** | ✅ | ✅ | ✅ |
| **Auto-sleep** | ✅ (free tier) | ✅ | ✅ Machines auto-stop |
| **Deploy model** | Docker / Git push | Docker / Git push | Docker / flyctl |
| **Regio's EU** | Frankfurt | ❌ Beperkt | Amsterdam ✅ |
| **DX** | Simpel, clean UI | Simpel, snel | Meer config, maar flexibeler |
| **Min. prijs/service** | ~$7/mo (Starter) | ~$5/mo | ~$3/mo (maar opschalen duurder) |

**Renier's voorkeur:** Geen Fly.io.

**Render voordelen:**
- Persistent disk = SQLite kan gewoon op disk leven
- Frankfurt regio = GDPR-friendly
- Simpele DX, clean dashboard
- Background workers mogelijk

**Railway voordelen:**
- Usage-based = goedkoper bij weinig gebruik
- Snelle deploys
- Maar: EU regio's beperkt

---

## Database Architectuur

### Optie A: SQLite op persistent disk (per user)

```
User A → Render service A → /data/kitt-a.db
User B → Render service B → /data/kitt-b.db
```

- Elke user krijgt een eigen service/container met eigen SQLite
- DB leeft op persistent disk, niet extern
- Voordeel: zelfde architectuur als self-hosted, geen code changes
- Nadeel: 1 service per user = duurder bij schaal

### Optie B: Gedeelde service, SQLite per user

```
Shared service → /data/users/user-a/kitt.db
                → /data/users/user-b/kitt.db
```

- Eén service, meerdere SQLite databases (1 per user)
- Router bepaalt welke DB te gebruiken op basis van auth
- Voordeel: goedkoper (1 service)
- Nadeel: isolatie is minder sterk, één crash raakt iedereen

### Optie C: Externe DB (Turso/PlanetScale)

```
User A → Shared service → Turso DB (user-a namespace)
User B → Shared service → Turso DB (user-b namespace)
```

- Turso = SQLite-compatible, edge-hosted
- Voordeel: geen persistent disk nodig, schaalbaar
- Nadeel: latency, niet 100% SQLite compatible, extra dependency
- Bonus: Turso heeft per-database pricing, past bij multi-tenant

### Voorstel

**Fase 1: Optie A** (1 service per user op Render)
- Minste code changes
- Beste isolatie
- Duurder, maar voor early adopters prima
- ~$7-15/mo per user op Render

**Fase 2: Optie C** (Turso) als er schaal komt
- Dan migreren naar gedeelde infra
- We gebruiken al libsql (Turso's client library!)

---

## Architectuur per User (Optie A)

```
┌─────────────────────────────────────────┐
│ Render Service (per user)               │
│                                         │
│  ┌─────────┐  ┌──────────┐  ┌────────┐ │
│  │ Bridge  │──│ Portal   │──│ SQLite │ │
│  │ (Node)  │  │ (Next.js)│  │ (disk) │ │
│  └────┬────┘  └──────────┘  └────────┘ │
│       │                                 │
│  ┌────┴────┐                            │
│  │ Claude  │ ← User's own API key       │
│  │ SDK     │                            │
│  └─────────┘                            │
│                                         │
│  Voice: Google Cloud STT/TTS (API)      │
│  Channels: Telegram, WhatsApp (webhook) │
└─────────────────────────────────────────┘
```

**Wat verandert t.o.v. self-hosted:**
- Whisper → Google Cloud STT
- Kokoro → Google Cloud TTS (of ElevenLabs)
- Localhost → publieke URL (https://user-abc.kitt.app)
- PM2 → container lifecycle (Render managed)
- File paths → relatief aan container volume

**Wat NIET verandert:**
- Bridge architectuur
- Skills systeem
- Task engine
- Context blocks
- SQLite schema

---

## Kosten per User (Hosted)

| Component | Kosten/maand |
|-----------|-------------|
| Render service (Starter) | $7-15 |
| Persistent disk (10GB) | $0 (incl.) |
| Google Cloud STT | $1-7 |
| Google Cloud TTS | $1-5 |
| Claude API (user betaalt zelf) | $0 voor ons |
| **Totaal (onze kosten)** | **$9-27/mo** |
| **Subscription prijs** | **$29-49/mo** |
| **Marge** | **~$2-40/mo** |

---

## Security Architectuur (Hosted)

Bij self-hosted draait alles achter de voordeur van de user. Bij hosted staat die voordeur open op het internet. Dat vereist meerdere lagen security.

### Laag 1: Authenticatie (Frontend)

| Maatregel | Beschrijving |
|-----------|-------------|
| **Password + 2FA** | Wachtwoord + TOTP (Google Authenticator / Authy) |
| **Session management** | HttpOnly, Secure, SameSite=Strict cookies |
| **Session expiry** | Auto-logout na inactiviteit (configurable, default 30 min) |
| **Brute force protection** | Max 5 login attempts, daarna lockout + email alert |
| **Password hashing** | bcrypt/argon2, nooit plaintext |
| **Magic link optie** | Email-based login als alternatief voor password |

### Laag 2: API Security (Backend)

| Maatregel | Beschrijving |
|-----------|-------------|
| **CORS** | Alleen requests van eigen frontend domain (`user.kitt.app`) |
| **API auth** | Elke request moet geldige session token bevatten |
| **No public endpoints** | Geen enkele API endpoint zonder auth, behalve `/login` en `/health` |
| **Rate limiting** | Per user: max requests/min op alle endpoints |
| **Input validation** | Alle input sanitizen — SQL injection, XSS, command injection |
| **Request signing** | HMAC signature op gevoelige endpoints (key management, settings) |
| **CSRF tokens** | Anti-CSRF token op alle muterende requests |

### Laag 3: Container & Data Isolatie

| Maatregel | Beschrijving |
|-----------|-------------|
| **1 container per user** | Geen gedeeld filesystem, geen gedeelde DB |
| **Network isolation** | Containers kunnen niet met elkaar communiceren |
| **Read-only filesystem** | Container filesystem read-only, alleen /data volume schrijfbaar |
| **No shell access** | Secure mode default — geen bash, geen willekeurige commands |
| **Resource limits** | CPU/memory caps per container (voorkom resource abuse) |
| **Secrets management** | API keys encrypted in user's DB (AES-256), master key in Render env vars |

### Laag 4: Encryption

| Wat | Hoe |
|-----|-----|
| **In transit** | TLS 1.3 everywhere (Render managed) |
| **At rest** | SQLite encryption (sqlcipher of AES-256 wrapper) |
| **API keys** | Encrypted kolom in DB, niet plaintext |
| **Backups** | Encrypted snapshots |
| **Logs** | Geen PII in logs, of encrypted logging |

### Laag 5: Monitoring & Audit

| Maatregel | Beschrijving |
|-----------|-------------|
| **Audit log** | Wie deed wat wanneer — logins, settings changes, key access |
| **Anomaly detection** | Ongebruikelijke patronen: login van nieuw IP, bulk data access |
| **Alert pipeline** | Email/webhook alerts bij security events |
| **Log retention** | 90 dagen, daarna purge |
| **Penetration testing** | Periodieke security audit (handmatig of via tools als OWASP ZAP) |

### Laag 6: Channel Security (Telegram/WhatsApp)

| Maatregel | Beschrijving |
|-----------|-------------|
| **Webhook validation** | Verify dat incoming webhooks echt van Telegram/WhatsApp komen |
| **Bot token isolation** | Elke user een eigen Telegram bot token |
| **Message encryption** | Berichten encrypted opslaan in DB (niet alleen in transit) |
| **Whitelist** | Alleen gewhiteliste nummers/chat IDs mogen interacten |

### Laag 7: GDPR & Compliance

| Maatregel | Beschrijving |
|-----------|-------------|
| **Data locatie** | EU regio (Frankfurt) — geen data buiten EU |
| **Data deletion** | "Delete my account" → volledige wipe van container + DB + backups |
| **Data export** | User kan eigen data exporteren (GDPR recht) |
| **Privacy policy** | Transparant over wat we opslaan en waarom |
| **DPA** | Data Processing Agreement met Render, Google Cloud, etc. |
| **Consent** | Explicit consent voor data collection bij onboarding |

### Aanvalsvectoren & Mitigatie

| Aanval | Risico | Mitigatie |
|--------|--------|----------|
| **SQL injection** | Data theft, DB corruption | Parameterized queries (we doen dit al), input validation |
| **XSS** | Session hijacking | CSP headers, output encoding, HttpOnly cookies |
| **CSRF** | Ongewenste acties namens user | CSRF tokens, SameSite cookies |
| **Prompt injection** | AI doen wat aanvaller wil | Input sanitization, system prompt hardening |
| **Container escape** | Toegang tot andere users | Render managed isolation, geen root in container |
| **API key theft** | Misbruik van user's Claude/Google keys | Encryption at rest, audit log op key access |
| **Brute force** | Account takeover | Rate limiting, 2FA, lockout |
| **DDoS** | Platform downtime | Render's built-in DDoS protection, rate limiting |
| **Man-in-the-middle** | Data intercept | TLS 1.3, HSTS headers |
| **Insider threat** | Wij zien user data | Encryption at rest, principle of least privilege |

---

## Open Vragen

- [ ] Render persistent disk: hoe werkt backup/restore bij crashes?
- [ ] Telegram/WhatsApp webhooks: elke user een eigen bot, of een shared gateway?
- [ ] Claude API key: user brengt eigen key mee, of wij proxyen met onze key (en factureren)?
- [ ] Custom domains: user-abc.kitt.app of kitt.app/user-abc?
- [ ] Container sleep: kan de container slapen als de user niet actief is? (kostenbesparing)
- [ ] Migratie pad: hoe gaat een self-hosted user naar hosted (of andersom)?
- [ ] Think loop: draait die 24/7 in de container? Dat voorkomt container sleep...

---

*Dit document groeit mee met de brainstorm.*
