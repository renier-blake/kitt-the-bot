#!/bin/bash
# Log Analysis Audit Script
# Checks pm2 errors, crash patterns, think loop failures
# Output: JSON array of findings

PROJECT_ROOT="${PROJECT_ROOT:-$(cd "$(dirname "$0")/../../../.." && pwd)}"
cd "$PROJECT_ROOT" || exit 1

findings="[]"

add_finding() {
  local title="$1" desc="$2" priority="$3" file="$4" line="$5"
  findings=$(echo "$findings" | jq --arg t "$title" --arg d "$desc" --arg p "$priority" --arg f "$file" --arg l "$line" \
    '. + [{"title": $t, "description": $d, "category": "logs", "priority": $p, "file": $f, "line": ($l | tonumber? // 0)}]')
}

# 1. PM2 error logs from last 24 hours
if command -v pm2 &>/dev/null; then
  # Get pm2 error log path
  error_log="$HOME/.pm2/logs/kitt-bridge-error.log"
  if [ -f "$error_log" ]; then
    # Count errors from last 24h (rough: last 200 lines)
    recent_errors=$(tail -200 "$error_log" 2>/dev/null | grep -ci "error\|exception\|fatal\|crash")
    if [ "${recent_errors:-0}" -gt 0 ]; then
      last_error=$(tail -200 "$error_log" 2>/dev/null | grep -i "error\|exception" | tail -1 | head -c 150)
      add_finding \
        "$recent_errors errors in pm2 error log" \
        "Most recent: $last_error" \
        "high" \
        "$error_log" \
        "0"
    fi
  fi

  # Check pm2 restart count
  restart_count=$(pm2 jlist 2>/dev/null | jq '.[0].pm2_env.restart_time // 0' 2>/dev/null)
  if [ "${restart_count:-0}" -gt 10 ]; then
    add_finding \
      "Process restarted $restart_count times" \
      "High restart count may indicate stability issues. Check pm2 logs for crash reasons." \
      "high" \
      "ecosystem.config.cjs" \
      "0"
  fi

  # Check pm2 process status
  pm2_status=$(pm2 jlist 2>/dev/null | jq -r '.[0].pm2_env.status // "unknown"' 2>/dev/null)
  if [ "$pm2_status" = "errored" ] || [ "$pm2_status" = "stopped" ]; then
    add_finding \
      "pm2 process status: $pm2_status" \
      "The KITT bridge process is not running normally" \
      "high" \
      "ecosystem.config.cjs" \
      "0"
  fi
fi

# 2. Think loop failures (from database)
db_file="profile/memory/kitt.db"
if [ -f "$db_file" ]; then
  # Check for recent think loop errors in transcripts
  error_transcripts=$(sqlite3 -json "$db_file" "
    SELECT COUNT(*) as count FROM transcripts
    WHERE type = 'error'
      AND created_at > (strftime('%s', 'now', '-24 hours') * 1000)" 2>/dev/null)
  error_count=$(echo "$error_transcripts" | jq '.[0].count // 0' 2>/dev/null)
  if [ "${error_count:-0}" -gt 0 ]; then
    last_err=$(sqlite3 "$db_file" "
      SELECT substr(content, 1, 150) FROM transcripts
      WHERE type = 'error'
      ORDER BY created_at DESC LIMIT 1" 2>/dev/null)
    add_finding \
      "$error_count error transcripts in last 24h" \
      "Most recent: $last_err" \
      "high" \
      "$db_file" \
      "0"
  fi

  # Check think loop execution gaps (no tick for > 30 min during waking hours)
  gap_check=$(sqlite3 "$db_file" "
    SELECT COUNT(*) FROM transcripts
    WHERE type IN ('thought', 'task')
      AND created_at > (strftime('%s', 'now', '-2 hours') * 1000)" 2>/dev/null)
  if [ "${gap_check:-0}" -eq 0 ]; then
    add_finding \
      "No think loop activity in last 2 hours" \
      "The think loop may be stuck or not running. Check pm2 status." \
      "medium" \
      "src/scheduler/think-loop.ts" \
      "0"
  fi
fi

# 3. Application log size check
if [ -d "$HOME/.pm2/logs" ]; then
  total_log_size=$(du -sm "$HOME/.pm2/logs" 2>/dev/null | cut -f1)
  if [ "${total_log_size:-0}" -gt 100 ]; then
    add_finding \
      "PM2 logs total ${total_log_size}MB" \
      "Consider flushing old logs with 'pm2 flush'" \
      "low" \
      "$HOME/.pm2/logs" \
      "0"
  fi
fi

# 4. Unhandled rejections in recent logs
if [ -f "$HOME/.pm2/logs/kitt-bridge-out.log" ]; then
  unhandled=$(tail -500 "$HOME/.pm2/logs/kitt-bridge-out.log" 2>/dev/null | grep -c "UnhandledPromiseRejection\|unhandledRejection")
  if [ "${unhandled:-0}" -gt 0 ]; then
    add_finding \
      "$unhandled unhandled promise rejections" \
      "Found unhandled promise rejections in recent logs — these can cause crashes" \
      "high" \
      "$HOME/.pm2/logs/kitt-bridge-out.log" \
      "0"
  fi
fi

echo "$findings"
