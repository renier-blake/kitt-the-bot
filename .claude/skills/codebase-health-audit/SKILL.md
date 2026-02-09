---
name: codebase-health-audit
description: Dagelijkse codebase health check — security, best practices, outdated code, inconsistenties, performance, en logs. Rapporteert findings als triage items.
metadata:
  kitt:
    emoji: "🔍"
    trigger: scheduled
    frequency: daily
    daypart: morning
---

# Codebase Health Audit

Dagelijkse automatische scan van de KITT codebase op problemen en verbeterpunten.
Findings worden als triage items in de portal gelogd.

---

## Wat het scant

| Categorie | Checks | Prioriteit |
|-----------|--------|-----------|
| **Security** | Hardcoded secrets, exposed env vars, onveilige deps | high |
| **Best Practices** | TypeScript errors, unused imports, code smells | medium |
| **Outdated Code** | Dead code, deprecated APIs, TODO/FIXME | low |
| **Inconsistenties** | Naming conventions, mixed patterns, file structuur | medium |
| **Performance** | Grote bestanden, inefficiënte queries, bundle size | medium |
| **Logs** | pm2 errors, crash patterns, think loop failures | high |

---

## Workflow

### 1. Run Audit Scripts

Voer de audit scripts uit in volgorde:

```bash
# Security scan
bash .claude/skills/codebase-health-audit/scripts/security.sh

# Best practices check
bash .claude/skills/codebase-health-audit/scripts/best-practices.sh

# Outdated code scan
bash .claude/skills/codebase-health-audit/scripts/outdated.sh

# Consistency check
bash .claude/skills/codebase-health-audit/scripts/consistency.sh

# Performance check
bash .claude/skills/codebase-health-audit/scripts/performance.sh

# Log analysis
bash .claude/skills/codebase-health-audit/scripts/logs.sh
```

Elk script output JSON array met findings:
```json
[
  {
    "title": "Hardcoded API key in config.ts",
    "description": "Found potential API key on line 42 of src/config.ts",
    "category": "security",
    "priority": "high",
    "file": "src/config.ts",
    "line": 42
  }
]
```

### 2. Deduplicate Against Existing Triage

Voordat je een finding rapporteert, check of het al in triage/issues staat:

```bash
sqlite3 -json profile/memory/kitt.db "
  SELECT title FROM portal_triage
  WHERE source = 'audit'
    AND processed = 0
    AND title LIKE '%FINDING_KEYWORD%'"
```

Skip findings die al gemeld zijn (voorkom spam).

### 3. Log to Triage (met labels)

Per unieke finding:

```bash
sqlite3 profile/memory/kitt.db "
  INSERT INTO portal_triage (title, description, source, labels, created_at)
  VALUES (
    'TITLE',
    'DESCRIPTION (category: X, priority: Y, file: Z)',
    'audit',
    '[\"audit\", \"CATEGORY\"]',
    unixepoch() * 1000
  );"
```

**Labels per categorie:**
| Categorie | Label |
|-----------|-------|
| Security | `["audit", "security"]` |
| Best Practices | `["audit", "best-practices"]` |
| Outdated | `["audit", "outdated"]` |
| Consistency | `["audit", "consistency"]` |
| Performance | `["audit", "performance"]` |
| Logs | `["audit", "logs"]` |

### 4. Telegram Rapportage

Stuur een korte samenvatting — alleen als er findings zijn:

```
🔍 Codebase Audit — [datum]

Gevonden: X items
├─ 🔴 High: Y (security, crashes)
├─ 🟡 Medium: Z (best practices, consistency)
└─ 🟢 Low: W (outdated, TODOs)

Top finding: [korte beschrijving van de belangrijkste]

Details staan in de portal triage inbox.
```

**Geen findings?** → Stuur niks. Stilte = gezond.

---

## Audit Details per Categorie

### Security

| Check | Hoe | Wat te zoeken |
|-------|-----|---------------|
| Hardcoded secrets | Grep patterns | API keys, tokens, passwords in code |
| .env exposure | Check .gitignore | .env files niet in git |
| Dependency vulns | npm audit | Known vulnerabilities |
| Exposed ports | Check configs | Onbedoeld open ports |

**Script:** `scripts/security.sh`

### Best Practices

| Check | Hoe | Wat te zoeken |
|-------|-----|---------------|
| TypeScript errors | tsc --noEmit | Type errors |
| Unused imports | grep + AST | Imports die niet gebruikt worden |
| Console.log in prod | Grep | Achtergebleven debug logs |
| Error handling | Grep | Unhandled promises, missing try/catch |

**Script:** `scripts/best-practices.sh`

### Outdated Code

| Check | Hoe | Wat te zoeken |
|-------|-----|---------------|
| TODO/FIXME | Grep | Openstaande items |
| Dead code | Unused exports | Functions die nergens gebruikt worden |
| Deprecated APIs | Package check | Verouderde library versies |

**Script:** `scripts/outdated.sh`

### Inconsistenties

| Check | Hoe | Wat te zoeken |
|-------|-----|---------------|
| Naming conventions | Grep patterns | camelCase vs snake_case mix |
| File structure | ls + patterns | Inconsistente mapstructuur |
| Import style | Grep | Mixed import styles (require vs import) |

**Script:** `scripts/consistency.sh`

### Performance

| Check | Hoe | Wat te zoeken |
|-------|-----|---------------|
| Large files | du/wc | Files > 500 lines |
| Bundle size | ls dist/ | Ongewoon grote bundles |
| N+1 queries | Grep | DB queries in loops |
| Memory leaks | Grep patterns | Event listeners zonder cleanup |

**Script:** `scripts/performance.sh`

### Logs

| Check | Hoe | Wat te zoeken |
|-------|-----|---------------|
| pm2 errors | pm2 logs | Recent errors en crashes |
| Think loop failures | DB query | Failed think loop runs |
| Restart patterns | pm2 info | Frequent restarts |

**Script:** `scripts/logs.sh`

---

## Fallbacks

| Situatie | Actie |
|----------|-------|
| Script faalt | Log error, ga door met volgende check |
| Geen findings | Niets rapporteren (stilte = gezond) |
| Database locked | Retry 1x na 5 sec |
| pm2 niet beschikbaar | Skip log analysis |

---

## Configuratie

De audit is conservatief — liever te weinig dan te veel findings.
False positives zijn erger dan gemiste issues.

**Rate:** Max 10 findings per dag in triage (voorkom overload)
**Prioriteit:** High findings altijd rapporteren, medium/low alleen als < 10 totaal

---
