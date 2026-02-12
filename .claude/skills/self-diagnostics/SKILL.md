---
name: Self-Diagnostics
description: Bekijk KITT's eigen logs en agent history voor diagnostiek
metadata: {"kitt":{"trigger":"on_demand","emoji":"🔍"}}
---

# Self-Diagnostics

Bekijk KITT's eigen systeemlogs en agent execution history om problemen te diagnosticeren.

## Databronnen

### 1. PM2 Logs (runtime logs)

```bash
# Recente logs (laatste 100 regels)
pm2 logs kitt --lines 100 --nostream

# Alleen errors
pm2 logs kitt --lines 200 --nostream 2>&1 | grep -i -E "(error|fail|timeout|warn)"

# Agent pool events
pm2 logs kitt --lines 200 --nostream 2>&1 | grep "\[agent-pool\]"

# Think loop events
pm2 logs kitt --lines 200 --nostream 2>&1 | grep "\[think-loop\]"

# WhatsApp events
pm2 logs kitt --lines 200 --nostream 2>&1 | grep -i "whatsapp"

# Background tasks
pm2 logs kitt --lines 200 --nostream 2>&1 | grep "\[background-runner\]"
```

### 2. Agent Executions (database history)

```bash
# Recente agent executions (vandaag)
sqlite3 -json profile/data/kitt.db "
  SELECT id, type, status, chat_id, capability_id,
    datetime(started_at/1000, 'unixepoch', 'localtime') as started,
    datetime(completed_at/1000, 'unixepoch', 'localtime') as completed,
    duration_ms, result_length, error
  FROM agent_executions
  WHERE started_at > (unixepoch() - 86400) * 1000
  ORDER BY started_at DESC
  LIMIT 20
"

# Timeouts vandaag
sqlite3 -json profile/data/kitt.db "
  SELECT id, type, duration_ms, error,
    datetime(started_at/1000, 'unixepoch', 'localtime') as started
  FROM agent_executions
  WHERE status = 'timeout' AND started_at > (unixepoch() - 86400) * 1000
  ORDER BY started_at DESC
"

# Errors vandaag
sqlite3 -json profile/data/kitt.db "
  SELECT id, type, duration_ms, error,
    datetime(started_at/1000, 'unixepoch', 'localtime') as started
  FROM agent_executions
  WHERE status = 'error' AND started_at > (unixepoch() - 86400) * 1000
  ORDER BY started_at DESC
"

# Stats per type (vandaag)
sqlite3 -json profile/data/kitt.db "
  SELECT type,
    COUNT(*) as total,
    SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
    SUM(CASE WHEN status = 'timeout' THEN 1 ELSE 0 END) as timeouts,
    SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as errors,
    ROUND(AVG(duration_ms)/1000.0, 1) as avg_duration_sec,
    ROUND(MAX(duration_ms)/1000.0, 1) as max_duration_sec
  FROM agent_executions
  WHERE started_at > (unixepoch() - 86400) * 1000
  GROUP BY type
"
```

### 3. Background Tasks

```bash
# Actieve/recente background tasks
sqlite3 -json profile/data/kitt.db "
  SELECT id, chat_id, capability_id, status,
    datetime(created_at/1000, 'unixepoch', 'localtime') as created,
    datetime(completed_at/1000, 'unixepoch', 'localtime') as completed,
    CASE WHEN error IS NOT NULL THEN error ELSE NULL END as error
  FROM background_tasks
  WHERE created_at > (unixepoch() - 86400) * 1000
  ORDER BY created_at DESC
  LIMIT 10
"
```

## Instructies

1. **Begin altijd** met de agent execution stats per type — geeft snel overzicht
2. **Check pm2 logs** als er specifieke errors of timeouts zijn gevonden
3. **Filter op type** als de vraag specifiek is (bijv. "waarom duurde die blog zo lang" → filter op background)
4. **Rapporteer beknopt** — geen ruwe JSON dumps, maar samenvatting met key metrics

## Output Format

```
## KITT Diagnostics

**Periode:** [vandaag / laatste uur / specifiek]

### Agent Stats
| Type | Total | OK | Timeout | Error | Gem. duur |
|------|-------|----|---------|-------|-----------|
| chat | 15 | 14 | 1 | 0 | 8.2s |
| think | 24 | 24 | 0 | 0 | 45.3s |
| ...  |       |    |         |       |           |

### Issues Gevonden
- [beschrijving van gevonden problemen]
- [aanbeveling]

### Recente Errors/Timeouts
- [tijdstip] [type] [error beschrijving]
```

## Voorbeelden

**User:** "Waarom duurde die background task zo lang?"
→ Check agent_executions voor background type, sorteer op duration_ms DESC

**User:** "Zijn er errors vandaag?"
→ Run stats query + errors query, rapporteer samenvatting

**User:** "Hoe gaat de think loop?"
→ Check think + think-sub stats, grep pm2 logs op [think-loop]

**User:** "Check de logs"
→ Volledige diagnostics: stats + recente errors + pm2 log tail
