# TOOLS.md - Local Notes

Skills define *how* tools work. This file is for *your* specifics — the stuff that's unique to your setup.

## What Goes Here

Things like:
- Camera names and locations
- SSH hosts and aliases  
- Preferred voices for TTS
- Speaker/room names
- Device nicknames
- Anything environment-specific

## Examples

```markdown
### Cameras
- living-room → Main area, 180° wide angle
- front-door → Entrance, motion-triggered

### SSH
- home-server → 192.168.1.100, user: admin

### TTS
- Preferred voice: "Nova" (warm, slightly British)
- Default speaker: Kitchen HomePod
```

## Why Separate?

Skills are shared. Your setup is yours. Keeping them apart means you can update skills without losing your notes, and share skills without leaking your infrastructure.

---

## Moltbot Commands
- **Gateway restart:** `pnpm moltbot gateway restart`

---

## Telegram
- Renier chat_id: **1306998969** (handle @zekerbleeker)
- KITT Bot: @kittthebot (ID: 8220600825) ← Active
- Old Bot: @Kit_reniers_bot (OpenClaw)

---

## Renier's Setup

### Network
- **Local IP:** 192.168.178.80
- **Tailscale IP:** 100.114.97.38
- **Hostname:** reniers-mac-mini

### Tailscale
- **Account:** renier@leadit.eu
- **Mac mini:** 100.114.97.38 (reniers-mac-mini)
- **iPhone 15 Pro:** 100.115.219.110 (iphone-15-pro)

### Services (via Tailscale)
- **Home Assistant:** http://100.114.97.38:8123
- **SSH:** ssh renierbleeker@100.114.97.38
- **Moltbot UI:** http://100.114.97.38:18789

### Home Assistant
- **IP:** 192.168.178.181
- **Local URL:** http://homeassistant.local:8123
- **Observer URL:** http://homeassistant.local:4357
- **HA OS:** 17.0
- **HA Core:** 2026.1.3
- **Hardware:** Aparte machine (niet de Mac mini)
- **SSH:** `ssh root@192.168.178.181`

### Moltbot ↔ HA Integration
- **Custom component:** `moltbot_conversation` (in `/config/custom_components/`)
- **HA praat met Moltbot via:** `http://192.168.178.80:18789/v1/chat/completions`
- **Auth:** Gateway token (niet hooks token)
- **Doel:** Voice assistant - HA stuurt spraak naar Moltbot, krijgt antwoord terug
- **Status:** Connection errors als Moltbot gateway niet draait of poort niet bereikbaar is

---

Add whatever helps you do your job. This is your cheat sheet.
