# Product MVP Roadmap

> Aangemaakt: 9 feb 2026
> Project: PAS (Product MVP)
> Doel: KITT-stack → schaalbaar freemium product

---

## Overzicht

De KITT-stack omzetten van een persoonlijk project naar een distribueerbaar freemium product.

**Model:** Gratis self-install, betalen voor integraties.
**Twee positioneringen:** Consumer ("Personal Assistant") + Business ("Digital Employee")

Zie ook: `_prd/brainstorm/kitt-the-bot.md` voor het volledige brainstorm document.

---

## Fase 0: Security & Fundament

> Moet EERST. Zonder dit geen distributie.

| # | Item | Probleem | Oplossing | Prioriteit | Issue |
|---|------|----------|-----------|------------|-------|
| 1 | API keys uit .env | Keys hardcoded, zichtbaar in plaintext | Portal UI om keys in te voeren → opslaan in encrypted DB | Critical | PAS-19 |
| 2 | .env uit git history | Security risk | .env.example als template, git history cleanen | Critical | PAS-20 |
| 3 | Credential Vault | Klanten moeten keys veilig kunnen opslaan | Encrypted SQLite kolom (AES-256) | Critical | PAS-15 |
| 4 | Portal API Key Management | Geen plek om keys in te voeren | Nieuwe portal pagina voor key invoer/beheer | High | PAS-21 |
| 5 | Portal API authenticatie | Geen auth op localhost endpoints | Session-based auth met lokaal wachtwoord | Critical | PAS-38 |
| 6 | Input sanitization | User berichten ongesanitized naar Claude | Filter/escape user input, anti-prompt injection | High | PAS-39 |
| 7 | Secure/Developer Mode toggle | Alles staat open (bash, files, browser) | Twee modi: Secure (beperkt) vs Developer (alles) | High | PAS-40 |
| 8 | Security warnings per integratie | Users niet geïnformeerd over risico's | Waarschuwingen bij publieke email, Slack, browser | Medium | PAS-41 |
| 9 | npm audit fix | 3 high severity vulns (axios) | Upgrade @nangohq/node | High | PAS-42 |

### Beslissing: waar keys opslaan?

| Optie | Voordeel | Nadeel |
|-------|----------|--------|
| **Encrypted DB kolom** (v1) | Cross-platform, simpel | Moet zelf encryptie implementeren |
| **macOS Keychain** | OS-level encryptie, native | macOS only |
| **Vault (HashiCorp)** | Industry standard | Overkill voor lokaal product |

**Besluit:** Encrypted DB kolom (AES-256 met master key). Cross-platform, simpel, veilig genoeg voor v1.

### Secure Mode vs Developer Mode

Zie `kitt-the-bot.md` → Security sectie voor uitgebreide beschrijving.

**Kort:** Secure Mode (default) = geen bash, geen browser, alleen bestaande skills/integraties. Developer Mode = alles open + guided skill builder voor custom integraties.

---

## Fase 1: Database Strategie

> SQLite BLIJFT. Het is een lokaal product — geen externe DB nodig.

| # | Item | Probleem | Oplossing | Prioriteit |
|---|------|----------|-----------|------------|
| 1 | Transcript archivering | DB groeit onbeperkt (nu 707MB) | Na 90 dagen → archive tabel. Samenvattingen bewaren, raw data comprimeren | High |
| 2 | Embeddings activeren | chunks tabel = 0 rows, geen vector search actief | Embedding pipeline activeren voor transcripts + memory | High |
| 3 | Backup strategie | Geen automatische backups | Dagelijkse cron: cp kitt.db → backups/kitt-YYYY-MM-DD.db. Bewaar 7 dagen | Medium |
| 4 | DB migraties | Schema verandert bij updates | Versie-nummering + migratie scripts (CREATE IF NOT EXISTS, ALTER TABLE) | Medium |

### Waarom SQLite en niet Postgres?

| | SQLite | Postgres |
|---|--------|---------|
| Installatie | Niks — het is een file | Service installeren + configureren |
| Dependencies | Zero | postgres server + client |
| Backup | cp file.db backup.db | pg_dump |
| Cross-platform | Overal | Overal, maar meer setup |
| Performance | Prima tot ~10GB | Beter bij grotere datasets |
| Self-install | Perfect | Extra stap voor klant |

**Conclusie:** SQLite is de juiste keuze voor een lokaal self-install product. Postgres is overkill tenzij we naar hosted gaan.

### Archivering strategie

```
Transcripts ouder dan 90 dagen:
1. Maak samenvatting per week (via Claude)
2. Verplaats raw transcripts naar archive_transcripts tabel
3. Bewaar samenvattingen in transcripts (type='summary')
4. Embeddings van samenvattingen BLIJVEN in chunks tabel

→ Context blijft behouden via samenvattingen
→ DB groeit veel langzamer
→ Vector search werkt nog steeds op samenvattingen
```

---

## Fase 2: Portal Production-Ready

> De portal is het ENIGE dat de klant ziet. Geen terminal, geen code, geen raw files.

### Bestaande pagina's (oppoetsen)

| Pagina | Status | Wat moet beter |
|--------|--------|----------------|
| Dashboard | ✅ | Status overview, health checks, quick stats |
| Projects | ✅ | Goed genoeg voor v1 |
| Tasks | ✅ | Klant-friendly maken, minder technisch |
| Triage | ✅ | Intern houden (niet voor klanten) |
| Database viewer | ✅ | Intern houden |
| Logs | ✅ | Simpelere view voor klanten |
| Identity | ✅ | WYSIWYG editor ipv raw markdown |
| Skills | ✅ | Toggles, beschrijvingen, categorieën |
| Settings | ✅ | API key invoer toevoegen |
| Integrations | ✅ | Nango Connect UI embedden |

### Nieuwe pagina's (bouwen)

| Pagina | Wat | Prioriteit |
|--------|-----|------------|
| **Onboarding Wizard** | Eerste keer: naam, timezone, taal, API key, eerste channel | High |
| **API Keys** | Invoeren/beheren van Anthropic, OpenAI, etc. keys | High |
| **Billing** | Huidige tier, integratie-gebruik, upgrade/downgrade | Medium |
| **Skill Marketplace** | Browse + install beschikbare skills | Medium |

### Onboarding: Portal vs Claude Code?

De onboarding kan ook via Claude Code zelf — de AI stelt de vragen. Maar een portal wizard is visueler en minder intimiderend voor niet-technische users.

**Voorstel:** Beide. Portal wizard als primary, Claude Code als fallback ("Ik zie dat je nog niet geconfigureerd bent, zal ik je er doorheen loodsen?").

---

## Fase 3: Packaging & Distributie

> Van development repo → distribueerbaar product.

| # | Item | Beschrijving | Prioriteit |
|---|------|-------------|------------|
| 1 | Build pipeline | TypeScript → compiled JS (al mogelijk) | High |
| 2 | Source protection | Obfuscation of compiled-only distributie | High |
| 3 | Installer script | One-liner die alles opzet (Node, PM2, DB, dirs, .env template) | Critical |
| 4 | Update mechanisme | Pull nieuwe core zonder klant-data te overschrijven | High |
| 5 | Version management | Semantic versioning, changelog, compatibility matrix | Medium |

### Installer flow

```
Klant in Claude Code:
> "Install KITT"

Claude Code:
1. Download package van private registry/CDN
2. npm install --production
3. Maak directory structuur (profile/, skills/, etc.)
4. Init SQLite database met schema
5. Start PM2 processes
6. Open portal op localhost:8000
7. Portal toont onboarding wizard
```

### Source code bescherming opties

| Optie | Hoe | Effectiviteit | Effort |
|-------|-----|---------------|--------|
| **Compiled JS only** | Distribueer alleen dist/, geen TypeScript | Basis — JS is leesbaar | Laag |
| **Obfuscation** | javascript-obfuscator op compiled JS | Matig — te reverse-engineeren | Laag |
| **pkg/nexe binary** | Compile naar standalone binary | Goed — geen source zichtbaar | Midden |
| **npm private package** | @kittlabs/core als private npm package | Goed — standaard npm pattern | Midden |

**Voorstel v1:** Compiled JS only + obfuscation. Binary kan later.

---

## Fase 4: Billing & Licensing

> Pas relevant als het product werkt en er users zijn.

| # | Item | Beschrijving | Prioriteit |
|---|------|-------------|------------|
| 1 | Stripe integratie | Payment processing | Medium |
| 2 | License key systeem | Activatie bij installatie, tier check | Medium |
| 3 | Free tier enforcement | Integraties geblokkeerd zonder betaling | Medium |
| 4 | Free trial | 7 dagen alle integraties gratis | Medium |
| 5 | Usage tracking | Aantal actieve integraties per klant | Medium |

### Hoe tier enforcement werkt

```
Klant probeert Gmail te koppelen
  → Portal checkt: heeft klant een actief abonnement?
  → Nee: "Upgrade naar Starter om integraties te koppelen" + free trial optie
  → Ja: Nango Connect UI → OAuth flow → klaar
  → Trial: 7 dagen countdown, daarna geblokkeerd
```

---

## Fasering & Prioriteit

```
Nu:   Fase 0 (security) + Fase 1 (database)     — fundament
Dan:  Fase 2 (portal) + Fase 3 (packaging)       — product
Last: Fase 4 (billing)                            — monetisatie
```

**Eerste concrete stappen:**
1. API keys → encrypted storage (uit .env)
2. Embedding pipeline activeren
3. Transcript archivering bouwen
4. Installer script v1
5. Portal onboarding wizard

---

## Open Vragen

- [ ] Cross-platform: Windows/Linux support in v1 of alleen macOS?
- [ ] Private npm registry of eigen CDN voor distributie?
- [ ] Hoe license keys genereren/valideren zonder centrale server?
- [ ] Welke skills zijn "free tier" en welke vereisen subscription?
- [ ] Multi-user: hoe werkt dat technisch? Meerdere Telegram bots? Eén bot, meerdere users?
