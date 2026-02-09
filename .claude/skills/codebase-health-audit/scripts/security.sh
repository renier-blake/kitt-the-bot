#!/bin/bash
# Security Audit Script
# Scans for hardcoded secrets, exposed env vars, and dependency vulnerabilities
# Output: JSON array of findings

PROJECT_ROOT="${PROJECT_ROOT:-$(cd "$(dirname "$0")/../../../.." && pwd)}"
cd "$PROJECT_ROOT" || exit 1

findings="[]"

add_finding() {
  local title="$1" desc="$2" priority="$3" file="$4" line="$5"
  findings=$(echo "$findings" | jq --arg t "$title" --arg d "$desc" --arg p "$priority" --arg f "$file" --arg l "$line" \
    '. + [{"title": $t, "description": $d, "category": "security", "priority": $p, "file": $f, "line": ($l | tonumber? // 0)}]')
}

# 1. Check for hardcoded API keys/tokens/secrets in source code
while IFS= read -r match; do
  [ -z "$match" ] && continue
  file=$(echo "$match" | cut -d: -f1)
  line_num=$(echo "$match" | cut -d: -f2)
  line_content=$(echo "$match" | cut -d: -f3-)
  case "$file" in
    *.env*|*node_modules*|*dist*|*.sh|*SKILL.md*) continue ;;
  esac
  add_finding \
    "Potential hardcoded secret in $file" \
    "Line $line_num: $(echo "$line_content" | sed 's/"/\\"/g' | head -c 120)..." \
    "high" \
    "$file" \
    "$line_num"
done < <(grep -rn --include="*.ts" --include="*.js" --include="*.json" \
  -E "(api[_-]?key|api[_-]?secret|password|token|secret)\s*[:=]\s*['\"][^'\"]{8,}" \
  src/ 2>/dev/null | grep -v "process\.env" | grep -v "\.env" | grep -v "example" | grep -v "placeholder" | grep -v "type\b" | head -10)

# 2. Check if .env is in .gitignore
if ! grep -q "^\.env$" .gitignore 2>/dev/null; then
  add_finding ".env not in .gitignore" ".env file is not explicitly listed in .gitignore" "high" ".gitignore" "0"
fi

# 3. Check if .env is tracked by git
if git ls-files --error-unmatch .env 2>/dev/null >/dev/null; then
  add_finding ".env is tracked by git" ".env file is tracked in the git repository — this exposes secrets!" "high" ".env" "0"
fi

# 4. Check npm audit
audit_output=$(npm audit --json 2>/dev/null)
if [ -n "$audit_output" ]; then
  high=$(echo "$audit_output" | jq '.metadata.vulnerabilities.high // 0' 2>/dev/null)
  critical=$(echo "$audit_output" | jq '.metadata.vulnerabilities.critical // 0' 2>/dev/null)
  total=$((${high:-0} + ${critical:-0}))
  if [ "$total" -gt 0 ]; then
    add_finding \
      "npm audit: $total high/critical vulnerabilities" \
      "Critical: ${critical:-0}, High: ${high:-0}. Run 'npm audit' for details." \
      "high" \
      "package.json" \
      "0"
  fi
fi

# 5. Check for sensitive data patterns (AWS keys, JWTs, Stripe keys)
while IFS= read -r match; do
  [ -z "$match" ] && continue
  file=$(echo "$match" | cut -d: -f1)
  line_num=$(echo "$match" | cut -d: -f2)
  add_finding \
    "Possible credential pattern in $file" \
    "Found AWS/JWT/API key pattern on line $line_num" \
    "high" \
    "$file" \
    "$line_num"
done < <(grep -rn --include="*.ts" --include="*.js" \
  -E "(AKIA[A-Z0-9]{16}|sk-[a-zA-Z0-9]{20,}|sk_live_|pk_live_)" \
  src/ 2>/dev/null | head -5)

echo "$findings"
