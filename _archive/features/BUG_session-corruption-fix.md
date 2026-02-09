# BUG: Session Corruption / SIGINT na 6 seconden

**Status:** OPGELOST
**Datum:** 8 feb 2026
**Severity:** High (bridge crashte bij elk bericht)

## Symptomen

- KITT ontving Telegram bericht
- Agent startte maar stopte na exact ~6 seconden met SIGINT
- Response was leeg (0 chars)
- User kreeg "Ik heb je bericht verwerkt" (fallback message)
- Bridge herstartte via PM2

## Root Cause

**Corrupte/conflicterende sessie ID in `profile/state/sessions.json`**

KITT probeerde een bestaande sessie te hervatten (`resume: sessionId`) die:
- Mogelijk al in gebruik was door een andere Claude instantie (bijv. developer chat)
- Corrupt was geraakt door eerdere crashes
- Resource conflicts had met andere processen

De Claude Agent SDK kon de sessie niet correct hervatten, wat resulteerde in een SIGINT na ~6 seconden.

## Oplossing

**Quick fix:** Sessions clearen zodat KITT een nieuwe sessie start

```bash
echo '{"sessions": {}, "lastSaved": "..."}' > profile/state/sessions.json
pm2 restart kitt
```

## Structurele Fix (TODO)

1. **Betere logging** bij sessie resume failures
2. **Session health check** voordat resume wordt geprobeerd
3. **Auto-recovery**: als resume faalt binnen X seconden, automatisch nieuwe sessie starten
4. **Timeout detectie**: als agent geen response geeft binnen 30s, log warning

## Lessons Learned

- Session persistence is fragiel - sessies kunnen corrupt raken
- De `resume` optie in de Agent SDK kan conflicteren met andere Claude instanties
- Symptoom (SIGINT na 6 sec) was misleidend - leek op timeout maar was session conflict
- Sessions clearen is veilige recovery optie (verliest alleen conversation context)

## Gerelateerde Files

- `src/bridge/agent.ts` - Agent wrapper met query()
- `src/bridge/sessions.ts` - Session persistence
- `profile/state/sessions.json` - Opgeslagen sessies
