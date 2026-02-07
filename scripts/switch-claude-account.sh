#!/bin/bash
# Switch Claude account wanneer rate limits bereikt zijn
# Usage: ./scripts/switch-claude-account.sh

echo "🔄 Switching Claude account..."
echo ""

# Logout current
claude logout 2>/dev/null

# Login new account (opens browser)
claude login

echo ""
echo "✅ Done! Je bent nu ingelogd met een ander account."
