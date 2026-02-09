#!/bin/bash
# Performance Audit Script
# Checks for large files, inefficient queries, bundle size, memory patterns
# Output: JSON array of findings

PROJECT_ROOT="${PROJECT_ROOT:-$(cd "$(dirname "$0")/../../../.." && pwd)}"
cd "$PROJECT_ROOT" || exit 1

findings="[]"

add_finding() {
  local title="$1" desc="$2" priority="$3" file="$4" line="$5"
  findings=$(echo "$findings" | jq --arg t "$title" --arg d "$desc" --arg p "$priority" --arg f "$file" --arg l "$line" \
    '. + [{"title": $t, "description": $d, "category": "performance", "priority": $p, "file": $f, "line": ($l | tonumber? // 0)}]')
}

# 1. Large source files (> 300 lines)
while IFS= read -r file; do
  [ -z "$file" ] && continue
  lines=$(wc -l < "$file" | tr -d ' ')
  if [ "$lines" -gt 300 ]; then
    add_finding \
      "$(basename "$file") is $lines lines" \
      "File $file has $lines lines. Consider splitting into smaller modules." \
      "medium" \
      "$file" \
      "0"
  fi
done < <(find src/ -name "*.ts" 2>/dev/null)

# 2. Database queries in loops
# Look for files that have both loop constructs and db operations nearby
while IFS= read -r file; do
  [ -z "$file" ] && continue
  has_loop=$(grep -c "for\s*(\\|\.forEach(\\|\.map(" "$file" 2>/dev/null)
  has_db=$(grep -c "\.run(\\|\.get(\\|\.all(\\|\.exec(" "$file" 2>/dev/null)
  if [ "${has_loop:-0}" -gt 0 ] && [ "${has_db:-0}" -gt 2 ]; then
    add_finding \
      "Potential N+1 queries in $(basename "$file")" \
      "File has $has_loop loops and $has_db DB operations. Review for batching opportunities." \
      "medium" \
      "$file" \
      "0"
  fi
done < <(find src/ -name "*.ts" 2>/dev/null)

# 3. Event listeners without cleanup
while IFS= read -r match; do
  [ -z "$match" ] && continue
  file=$(echo "$match" | cut -d: -f1)
  # Check if there's a corresponding removeListener or off()
  has_cleanup=$(grep -c "removeListener\|\.off(" "$file" 2>/dev/null)
  if [ "${has_cleanup:-0}" -eq 0 ]; then
    line_num=$(echo "$match" | cut -d: -f2)
    add_finding \
      "Event listener without cleanup in $(basename "$file")" \
      "Found addEventListener/on() without corresponding removeListener/off()" \
      "medium" \
      "$file" \
      "$line_num"
  fi
done < <(grep -rn --include="*.ts" "\.on(\|addEventListener(" src/ 2>/dev/null | head -10)

# 4. Synchronous file operations (blocking I/O)
while IFS= read -r match; do
  [ -z "$match" ] && continue
  file=$(echo "$match" | cut -d: -f1)
  line_num=$(echo "$match" | cut -d: -f2)
  content=$(echo "$match" | cut -d: -f3- | head -c 60)
  add_finding \
    "Sync file operation in $(basename "$file")" \
    "Line $line_num: $content — Use async version instead" \
    "low" \
    "$file" \
    "$line_num"
done < <(grep -rn --include="*.ts" \
  -E "readFileSync|writeFileSync|existsSync|mkdirSync|readdirSync" \
  src/ 2>/dev/null | grep -v "cli/" | head -10)

# 5. Large node_modules check
if [ -d "node_modules" ]; then
  nm_size=$(du -sm node_modules 2>/dev/null | cut -f1)
  if [ "${nm_size:-0}" -gt 500 ]; then
    add_finding \
      "node_modules is ${nm_size}MB" \
      "Consider auditing dependencies to reduce install size" \
      "low" \
      "package.json" \
      "0"
  fi
fi

# 6. SQLite database size
db_file="profile/memory/kitt.db"
if [ -f "$db_file" ]; then
  db_size=$(du -sm "$db_file" 2>/dev/null | cut -f1)
  if [ "${db_size:-0}" -gt 100 ]; then
    add_finding \
      "Database is ${db_size}MB" \
      "Consider running VACUUM or archiving old data" \
      "medium" \
      "$db_file" \
      "0"
  fi
fi

echo "$findings"
