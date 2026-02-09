#!/bin/bash
# Consistency Audit Script
# Checks naming conventions, import styles, file structure patterns
# Output: JSON array of findings

PROJECT_ROOT="${PROJECT_ROOT:-$(cd "$(dirname "$0")/../../../.." && pwd)}"
cd "$PROJECT_ROOT" || exit 1

findings="[]"

add_finding() {
  local title="$1" desc="$2" priority="$3" file="$4" line="$5"
  findings=$(echo "$findings" | jq --arg t "$title" --arg d "$desc" --arg p "$priority" --arg f "$file" --arg l "$line" \
    '. + [{"title": $t, "description": $d, "category": "consistency", "priority": $p, "file": $f, "line": ($l | tonumber? // 0)}]')
}

# 1. Mixed import styles (require vs import)
require_count=$(grep -rn --include="*.ts" "require(" src/ 2>/dev/null | grep -v "node_modules" | wc -l | tr -d ' ')
import_count=$(grep -rn --include="*.ts" "^import " src/ 2>/dev/null | wc -l | tr -d ' ')
if [ "${require_count:-0}" -gt 0 ] && [ "${import_count:-0}" -gt 0 ]; then
  require_files=$(grep -rl --include="*.ts" "require(" src/ 2>/dev/null | grep -v "node_modules" | head -5 | tr '\n' ', ')
  add_finding \
    "Mixed import styles: $require_count require() + $import_count import" \
    "Files with require(): $require_files. Consider standardizing to ES imports." \
    "medium" \
    "src/" \
    "0"
fi

# 2. Naming convention consistency (check for snake_case in TS files which should be camelCase)
while IFS= read -r match; do
  [ -z "$match" ] && continue
  file=$(echo "$match" | cut -d: -f1)
  line_num=$(echo "$match" | cut -d: -f2)
  content=$(echo "$match" | cut -d: -f3- | head -c 80)
  add_finding \
    "snake_case variable in $file" \
    "Line $line_num: $content — TypeScript convention is camelCase" \
    "low" \
    "$file" \
    "$line_num"
done < <(grep -rn --include="*.ts" \
  -E "(const|let|var)\s+[a-z]+_[a-z]+" src/ 2>/dev/null | \
  grep -v "node_modules" | grep -v "__" | grep -v "_id" | grep -v "_at" | \
  grep -v "created_at\|updated_at\|logged_date\|logged_time\|meal_type\|food_name\|due_date\|start_date\|end_date" | \
  head -10)

# 3. File naming inconsistency
kebab_files=$(find src/ -name "*-*" -name "*.ts" 2>/dev/null | wc -l | tr -d ' ')
camel_files=$(find src/ -name "*[a-z][A-Z]*" -name "*.ts" 2>/dev/null | wc -l | tr -d ' ')
dot_files=$(find src/ -name "*.*.*" -name "*.ts" 2>/dev/null | wc -l | tr -d ' ')
if [ "$kebab_files" -gt 0 ] && [ "$camel_files" -gt 0 ]; then
  add_finding \
    "Mixed file naming: $kebab_files kebab-case + $camel_files camelCase" \
    "Standardize file naming convention across the project" \
    "low" \
    "src/" \
    "0"
fi

# 4. Inconsistent error handling patterns
# Check if some files use try/catch and others use .catch()
try_catch_files=$(grep -rl --include="*.ts" "try\s*{" src/ 2>/dev/null | wc -l | tr -d ' ')
dot_catch_files=$(grep -rl --include="*.ts" "\.catch(" src/ 2>/dev/null | wc -l | tr -d ' ')
if [ "${try_catch_files:-0}" -gt 2 ] && [ "${dot_catch_files:-0}" -gt 2 ]; then
  add_finding \
    "Mixed error handling: $try_catch_files files use try/catch, $dot_catch_files use .catch()" \
    "Consider standardizing error handling approach" \
    "low" \
    "src/" \
    "0"
fi

# 5. Inconsistent export patterns (default vs named)
default_exports=$(grep -rn --include="*.ts" "export default" src/ 2>/dev/null | wc -l | tr -d ' ')
named_exports=$(grep -rn --include="*.ts" "export \(async \)\?function\|export const\|export interface\|export type" src/ 2>/dev/null | wc -l | tr -d ' ')
if [ "${default_exports:-0}" -gt 3 ] && [ "${named_exports:-0}" -gt 3 ]; then
  default_files=$(grep -rl --include="*.ts" "export default" src/ 2>/dev/null | head -5 | tr '\n' ', ')
  add_finding \
    "Mixed export patterns: $default_exports default + $named_exports named exports" \
    "Files with default exports: $default_files" \
    "low" \
    "src/" \
    "0"
fi

echo "$findings"
