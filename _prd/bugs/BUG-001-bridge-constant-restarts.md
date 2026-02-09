# BUG-001: KITT Bridge Constant Restarts

**Status:** OPEN - Critical
**Reported:** 2026-02-09
**Component:** src/bridge/
**PM2 Process:** kitt

---

## Symptom

De KITT bridge herstart continu en ongecontroleerd. PM2 toont 59+ restarts.

```
pm2 list
│ kitt │ 59   │ (restarts)
```

## Impact

1. **WhatsApp verliest connectie** - Elke restart triggert een reconnect, en voorheen werd de sessie gewist (nu gefixed met `end()` i.p.v. `logout()`)
2. **KITT stopt met reageren** - Tijdens restart worden geen berichten verwerkt
3. **Onbetrouwbare service** - Gebruiker kan niet vertrouwen op KITT beschikbaarheid
4. **Context verlies** - Lopende requests worden afgebroken

## Observaties

### Logs
- Alleen startup berichten zichtbaar, geen crash errors
- Geen stack traces of exceptions gelogd
- Bridge start, lijkt te werken, dan plotseling restart

### Patroon
- Restarts lijken niet aan specifieke actie gekoppeld
- Gebeurt ook zonder user interactie
- Uptime is kort (minuten) voor volgende restart

## Root Cause Analyse (uit logs)

### Primaire Oorzaak: SIGINT van Development
```
{"ts":"09-02-2026, 21:53:22","level":"info","msg":"Shutting down...","signal":"SIGINT"}
```
De bridge ontvangt externe SIGINT signalen - waarschijnlijk tijdens Claude Code edits/rebuilds. Dit is **geen crash** maar een expliciete stop.

### Secundaire Oorzaak: WhatsApp Baileys Reconnect Loop
De error logs tonen een patroon van WhatsApp connection issues:

1. **Status 515 - Stream Errored**
   ```
   {"statusCode":515,"shouldReconnect":true,"error":"Stream Errored (restart required)"}
   ```
   - Baileys vraagt om reconnect
   - Dit is normaal gedrag, maar triggert meerdere reconnects

2. **Status 401 - Connection Failure**
   ```
   {"statusCode":401,"shouldReconnect":false,"error":"Connection Failure"}
   ```
   - Auth failure na meerdere reconnects
   - Sessie mogelijk corrupt of expired

### Tertiaire Issues
- `TypeError: fetch failed` bij voice transcription
- Apple Reminders permission error in think loop

## Fix Strategie

### Fix 1: Stop development restarts
- Tijdens development: **niet** automatisch pm2 restart
- Gebruik `npm run bridge` direct voor testing
- Of: `pm2 stop kitt` tijdens actieve development

### Fix 2: Baileys reconnect stabiliteit
In `src/bridge/adapters/whatsapp.ts`:
- ✅ DONE: `logout()` → `end()` - Sessie blijft intact bij stop
- TODO: Exponential backoff bij reconnects
- TODO: Max reconnects per uur limiet

### Fix 3: Auth recovery
- Clear auth state ALLEEN bij persistent 401 errors
- Niet bij enkele stream errors (515)

## Aanbevolen Workflow

```bash
# Development (geen PM2)
npm run bridge

# Production (PM2)
pm2 start kitt
pm2 logs kitt --follow
```

## Log Excerpts

### SIGINT shutdown (development)
```
21:53:22 Shutting down... signal=SIGINT
21:53:22 Stopping router
21:53:22 Agent completed hasResult=false
21:53:22 WhatsApp adapter stopped
```

### WhatsApp stream errors
```
19:17:15 statusCode=515 shouldReconnect=true error="Stream Errored"
19:18:22 statusCode=401 shouldReconnect=false error="Connection Failure"
19:22:33 statusCode=515 shouldReconnect=true error="Stream Errored"
```

## Tijdelijke Workaround

De `logout()` → `end()` fix in whatsapp.ts voorkomt dat WhatsApp sessie verloren gaat bij restart. Maar dit lost de root cause niet op.

## Prioriteit

**CRITICAL** - Dit maakt KITT onbetrouwbaar als persoonlijke assistent.

---

## Conclusie

**De 60 restarts zijn GEEN crashes**, maar een combinatie van:
1. Development SIGINT signalen (Claude Code edits)
2. Baileys internal reconnect loop (Stream Errored → reconnect → auth failure)

De bridge zelf is stabiel. Het probleem is:
- Tijdens development wordt de bridge constant herstart
- Baileys reconnect logic is agressief

## Updates

- **2026-02-09 21:53**: Bug report aangemaakt
- **2026-02-09 21:53**: Root cause geïdentificeerd uit logs
- **2026-02-09**: WhatsApp sessie fix (`logout()` → `end()`) voorkomt auth loss bij restart
- **2026-02-09**: Portal error display fix - toont geen error als QR visible is
