#!/bin/bash
#
# KITT Permission Setup Script
# Helps users grant macOS permissions for skills that need them
#
# Run this script from Terminal.app (not VS Code terminal)
#

set -e

echo ""
echo "╔═══════════════════════════════════════════════════════╗"
echo "║           KITT Permission Setup                       ║"
echo "╚═══════════════════════════════════════════════════════╝"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

check_reminders() {
    echo "Checking Reminders access..."

    if ! command -v remindctl &> /dev/null; then
        echo -e "${YELLOW}⚠ remindctl not installed${NC}"
        echo "  Install with: brew install steipete/tap/remindctl"
        return 1
    fi

    # Test actual access by trying to list reminders
    if remindctl today &>/dev/null; then
        echo -e "${GREEN}✓ Reminders: Authorized${NC}"
        return 0
    else
        echo -e "${YELLOW}⚠ Reminders: Not authorized${NC}"
        return 1
    fi
}

request_reminders() {
    echo ""
    echo -e "${BLUE}Requesting Reminders access...${NC}"
    echo "A popup should appear asking for permission."
    echo ""

    # Use osascript to trigger permission - this is more reliable than remindctl authorize
    osascript -e 'tell application "Reminders" to get name of every list' &>/dev/null && {
        echo -e "${GREEN}✓ Permission granted!${NC}"
        return 0
    }

    # If osascript failed, the user denied or something went wrong
    echo -e "${YELLOW}No popup appeared or permission was denied.${NC}"
    return 1
}

setup_reminders() {
    # First check if already authorized
    if check_reminders; then
        return 0
    fi

    echo ""
    echo -e "${BLUE}Triggering permission request...${NC}"
    echo ""

    # Try to request permission via osascript
    if request_reminders; then
        echo ""
        # Verify it worked
        if check_reminders; then
            return 0
        fi
    fi

    # Still not working - guide user to settings
    echo ""
    echo -e "${YELLOW}Automatic setup didn't work. Manual steps:${NC}"
    echo ""
    echo "  1. Open System Settings"
    echo "  2. Go to Privacy & Security → Reminders"
    echo "  3. Click '+' and add Terminal.app"
    echo "     (Located at /System/Applications/Utilities/Terminal.app)"
    echo ""

    read -p "Open System Settings now? [Y/n] " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Nn]$ ]]; then
        open "x-apple.systempreferences:com.apple.preference.security?Privacy_Reminders"
    fi

    echo ""
    read -p "Press Enter after granting permission..."
    check_reminders
}

# Main
echo "This script sets up macOS permissions for KITT skills."
echo ""
echo -e "${YELLOW}IMPORTANT:${NC} Run this from Terminal.app, not VS Code!"
echo ""
echo "Skills that need permissions:"
echo "  • Apple Reminders (remindctl)"
echo ""

# Check and setup each permission
echo "─────────────────────────────────────────────────────────"
setup_reminders
result=$?
echo "─────────────────────────────────────────────────────────"

if [ $result -eq 0 ]; then
    echo ""
    echo -e "${GREEN}Setup complete!${NC}"
    echo ""
    echo "To test:"
    echo "  remindctl today"
    echo ""
    echo -e "${BLUE}Note:${NC} Start KITT bridge from this Terminal for permissions to work:"
    echo "  cd \"$(pwd)\""
    echo "  npm run bridge:start"
    echo ""
else
    echo ""
    echo -e "${RED}Setup incomplete.${NC} Please grant permissions manually."
    echo ""
fi
