#!/bin/bash
# Outdated Code Audit Script
# Checks for TODO/FIXME, dead code, deprecated dependencies
# Output: JSON array of findings

PROJECT_ROOT="${PROJECT_ROOT:-$(cd "$(dirname "$0")/../../../.." && pwd)}"
cd "$PROJECT_ROOT" || exit 1

findings="[]"

add_finding() {
  local title="$1" desc="$2" priority="$3" file="$4" line="$5"
  findings=$(echo "$findings" | jq --arg t "$title" --arg d "$desc" --arg p "$priority" --arg f "$file" --arg l "$line" \
    '. + [{"title": $t, "description": $d, "category": "outdated", "priority": $p, "file": $f, "line": ($l | tonumber? // 0)}]')
}

# 1. TODO/FIXME/HACK/XXX comments
todo_count=0
todo_examples=""
while IFS= read -r match; do
  [ -z "$match" ] && continue
  todo_count=$((todo_count + 1))
  if [ $todo_count -le 5 ]; then
    file=$(echo "$match" | cut -d: -f1)
    line_num=$(echo "$match" | cut -d: -f2)
    content=$(echo "$match" | cut -d: -f3- | head -c 80)
    todo_examples="$todo_examples\n- $file:$line_num: $content"
  fi
done < <(grep -rn --include="*.ts" --include="*.js" \
  -E "(TODO|FIXME|HACK|XXX|TEMP|TEMPORARY)" \
  src/ 2>/dev/null)
if [ "$todo_count" -gt 0 ]; then
  add_finding \
    "$todo_count TODO/FIXME comments in codebase" \
    "Found $todo_count markers. Top examples: $(echo -e "$todo_examples" | head -c 300)" \
    "low" \
    "src/" \
    "0"
fi

# 2. Check for outdated npm packages
outdated_output=$(npm outdated --json 2>/dev/null)
if [ -n "$outdated_output" ] && [ "$outdated_output" != "{}" ]; then
  major_outdated=$(echo "$outdated_output" | jq '[to_entries[] | select(.value.current != .value.latest)] | length' 2>/dev/null)
  if [ "${major_outdated:-0}" -gt 0 ]; then
    top_packages=$(echo "$outdated_output" | jq -r 'to_entries[:5][] | "\(.key): \(.value.current) → \(.value.latest)"' 2>/dev/null | tr '\n' ', ')
    add_finding \
      "$major_outdated outdated npm packages" \
      "Top: $top_packages" \
      "low" \
      "package.json" \
      "0"
  fi
fi

# 3. Dead exports (exported but never imported elsewhere)
# Quick heuristic: check exported functions that aren't imported in other files
while IFS= read -r match; do
  [ -z "$match" ] && continue
  file=$(echo "$match" | cut -d: -f1)
  func_name=$(echo "$match" | grep -oE "export (async )?function \w+" | grep -oE "\w+$")
  [ -z "$func_name" ] && continue
  # Check if it's imported anywhere else
  import_count=$(grep -rl --include="*.ts" "$func_name" src/ 2>/dev/null | grep -v "$file" | wc -l | tr -d ' ')
  if [ "${import_count:-0}" -eq 0 ]; then
    line_num=$(echo "$match" | cut -d: -f2)
    add_finding \
      "Possibly unused export: $func_name in $file" \
      "Function '$func_name' is exported but not imported in any other file" \
      "low" \
      "$file" \
      "$line_num"
  fi
done < <(grep -rn --include="*.ts" "export \(async \)\?function " src/ 2>/dev/null | head -30)

# 4. Commented-out code blocks (more than 3 consecutive commented lines)
while IFS= read -r file; do
  [ -z "$file" ] && continue
  # Count blocks of 4+ consecutive // lines
  awk '
    /^\s*\/\// { count++; if(count==1) start=NR; next }
    { if(count >= 4) print FILENAME ":" start ": " count " lines of commented code"; count=0 }
    END { if(count >= 4) print FILENAME ":" start ": " count " lines of commented code" }
  ' "$file" 2>/dev/null | while IFS= read -r block; do
    line_num=$(echo "$block" | cut -d: -f2)
    desc=$(echo "$block" | cut -d: -f3-)
    add_finding \
      "Commented-out code block in $(basename "$file")" \
      "Starting at line $line_num:$desc" \
      "low" \
      "$file" \
      "$line_num"
  done
done < <(find src/ -name "*.ts" 2>/dev/null)

echo "$findings"
