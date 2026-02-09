#!/bin/bash
# Best Practices Audit Script
# Checks TypeScript errors, unused imports, console.logs, error handling
# Output: JSON array of findings

PROJECT_ROOT="${PROJECT_ROOT:-$(cd "$(dirname "$0")/../../../.." && pwd)}"
cd "$PROJECT_ROOT" || exit 1

findings="[]"

add_finding() {
  local title="$1" desc="$2" priority="$3" file="$4" line="$5"
  findings=$(echo "$findings" | jq --arg t "$title" --arg d "$desc" --arg p "$priority" --arg f "$file" --arg l "$line" \
    '. + [{"title": $t, "description": $d, "category": "best-practices", "priority": $p, "file": $f, "line": ($l | tonumber? // 0)}]')
}

# 1. TypeScript type errors
tsc_output=$(npx tsc --noEmit 2>&1)
tsc_exit=$?
if [ $tsc_exit -ne 0 ]; then
  error_count=$(echo "$tsc_output" | grep -c "error TS")
  if [ "$error_count" -gt 0 ]; then
    # Get first 3 errors as examples
    first_errors=$(echo "$tsc_output" | grep "error TS" | head -3 | sed 's/"/\\"/g' | tr '\n' ' ')
    add_finding \
      "TypeScript: $error_count type errors" \
      "Examples: $first_errors" \
      "medium" \
      "tsconfig.json" \
      "0"
  fi
fi

# 2. Console.log statements in production code (not in CLI tools)
console_count=0
while IFS= read -r match; do
  [ -z "$match" ] && continue
  console_count=$((console_count + 1))
done < <(grep -rn --include="*.ts" "console\.log\(" src/ 2>/dev/null | grep -v "src/cli/" | grep -v "logger" | head -20)
if [ "$console_count" -gt 5 ]; then
  add_finding \
    "$console_count console.log statements in non-CLI code" \
    "Found console.log in production code. Consider using the logger instead." \
    "low" \
    "src/" \
    "0"
fi

# 3. Unhandled promise patterns (async without try/catch or .catch)
while IFS= read -r match; do
  [ -z "$match" ] && continue
  file=$(echo "$match" | cut -d: -f1)
  line_num=$(echo "$match" | cut -d: -f2)
  add_finding \
    "Potential unhandled async in $file" \
    "Async function call without apparent error handling on line $line_num" \
    "medium" \
    "$file" \
    "$line_num"
done < <(grep -rn --include="*.ts" \
  -E "await\s+\w+\(" src/ 2>/dev/null | \
  grep -v "try" | grep -v "catch" | grep -v "\.catch" | grep -v "test" | \
  head -5)

# 4. Any 'any' type usage (TypeScript anti-pattern)
any_count=$(grep -rn --include="*.ts" -E ":\s*any\b|as\s+any\b" src/ 2>/dev/null | wc -l | tr -d ' ')
if [ "${any_count:-0}" -gt 10 ]; then
  add_finding \
    "$any_count uses of 'any' type" \
    "Excessive use of 'any' type undermines TypeScript's type safety. Consider using proper types." \
    "medium" \
    "src/" \
    "0"
fi

# 5. Empty catch blocks
while IFS= read -r match; do
  [ -z "$match" ] && continue
  file=$(echo "$match" | cut -d: -f1)
  line_num=$(echo "$match" | cut -d: -f2)
  add_finding \
    "Empty catch block in $file" \
    "Catch block on line $line_num appears to silently swallow errors" \
    "medium" \
    "$file" \
    "$line_num"
done < <(grep -rn --include="*.ts" -A1 "catch\s*(" src/ 2>/dev/null | \
  grep -B1 "^\s*}" | grep "catch" | head -5)

echo "$findings"
