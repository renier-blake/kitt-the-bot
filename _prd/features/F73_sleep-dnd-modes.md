# F73: Sleep & Do Not Disturb Modes

**Status:** ✅ Implemented
**Prioriteit:** High
**Datum:** 8 feb 2026

---

## Probleem

Huidige sleep mode is te simpel:
- KITT gaat slapen en doet helemaal niks
- Geen onderscheid tussen "ik wil niet gestoord worden" en "KITT mag niks doen"
- Wake-up reminder werkt niet: KITT stuurt geen bericht als sleep mode eindigt

## Oplossing

Twee aparte modes:

| Mode | Think Loop | Skills | Telegram berichten |
|------|------------|--------|-------------------|
| **Sleep** | Uit | Nee | Nee |
| **DND** (Do Not Disturb) | Aan | Ja (background) | Nee |
| **Awake** | Aan | Ja | Ja |

Plus: **Wake-up reminder** - optioneel bericht sturen wanneer sleep mode eindigt.

---

## User Stories

1. **"Ik ga slapen"** → Sleep indefinite, geen wake-up bericht
2. **"Maak me wakker om 6:55"** → Sleep tot 6:55, wake-up bericht om 6:55
3. **"Wees even stil voor 2 uur"** → DND voor 2 uur, skills draaien gewoon door
4. **"Do not disturb tot 14:00"** → DND tot 14:00

---

## Database Schema

Nieuwe/aangepaste meta keys:

```sql
-- Bestaand (hergebruiken)
kitt_sleep_until    -- Unix timestamp ms, KITT slaapt volledig

-- Nieuw
kitt_dnd_until      -- Unix timestamp ms, KITT is stil maar werkt door
kitt_wake_reminder  -- Unix timestamp ms, wanneer wake-up bericht sturen (NULL = geen)
```

---

## Implementatie

### 1. sleep-mode.ts uitbreiden

```typescript
// Bestaand
export async function isKittSleeping(db: Client): Promise<boolean>
export async function setSleep(db: Client, until: number | 'indefinite'): Promise<void>
export async function clearSleep(db: Client): Promise<void>

// Nieuw
export async function isKittDND(db: Client): Promise<boolean>
export async function setDND(db: Client, until: number): Promise<void>
export async function clearDND(db: Client): Promise<void>

export async function setWakeReminder(db: Client, timestamp: number): Promise<void>
export async function getWakeReminder(db: Client): Promise<number | null>
export async function clearWakeReminder(db: Client): Promise<void>

// Helper: should KITT send messages?
export async function canSendMessages(db: Client): Promise<boolean> {
  const sleeping = await isKittSleeping(db);
  const dnd = await isKittDND(db);
  return !sleeping && !dnd;
}
```

### 2. Think Loop aanpassen (scheduler/index.ts)

```typescript
async runThinkLoop(): Promise<void> {
  // Check sleep mode - exit completely
  if (await isKittSleeping(db)) {
    // Check wake reminder BEFORE exiting
    const wakeTime = await getWakeReminder(db);
    if (wakeTime && wakeTime <= Date.now()) {
      // Wake time passed! Send wake-up message
      await this.sendWakeUpMessage();
      await clearWakeReminder(db);
      await clearSleep(db);
    }
    return; // Still sleeping or just woke up
  }

  // Normal think loop processing...
  // Skills run, tasks execute

  // Before sending message, check DND
  if (thought.shouldAct && thought.action === 'message') {
    if (await canSendMessages(db)) {
      await sendTelegram(thought.message);
    } else {
      console.log('[think-loop] DND active, message suppressed:', thought.message?.slice(0, 50));
      // Still log to transcripts for visibility
    }
  }
}
```

### 3. Telegram handler (bridge/telegram.ts)

KITT moet de intent herkennen en de juiste mode instellen. Dit gebeurt via de agent - geen hardcoded parsing nodig. De agent heeft tools nodig:

```typescript
// Tools voor de agent
{
  name: 'set_sleep_mode',
  description: 'Put KITT in sleep mode (completely off)',
  parameters: {
    until: 'timestamp or "indefinite"',
    wake_reminder: 'optional timestamp for wake-up message'
  }
}

{
  name: 'set_dnd_mode',
  description: 'Put KITT in Do Not Disturb mode (works silently)',
  parameters: {
    until: 'timestamp'
  }
}
```

### 4. Wake-up bericht

Wanneer `kitt_wake_reminder` timestamp is bereikt:

```typescript
async sendWakeUpMessage(): Promise<void> {
  const message = "Goedemorgen! ☀️ Je wilde om deze tijd gewekt worden.";
  await sendTelegram(RENIER_CHAT_ID, message);

  // Log to transcripts
  await logTranscript(db, {
    role: 'kitt',
    type: 'message',
    content: message,
    channel: 'telegram'
  });
}
```

---

## Acceptance Criteria

- [ ] "Ik ga slapen" → Sleep indefinite, geen wake-up
- [ ] "Maak me wakker om 6:55" → Sleep + wake reminder, bericht om 6:55
- [ ] "Wees stil voor 2 uur" → DND 2 uur, skills blijven draaien
- [ ] Wake-up bericht wordt daadwerkelijk gestuurd
- [ ] DND mode logt berichten maar stuurt ze niet
- [ ] User bericht wekt KITT altijd (cleart sleep EN dnd)

---

## Gerelateerde Files

| File | Wijziging |
|------|-----------|
| `src/scheduler/sleep-mode.ts` | DND functions, wake reminder |
| `src/scheduler/index.ts` | Think Loop checks |
| `src/bridge/telegram.ts` | Clear modes on user message |
| `src/bridge/agent.ts` | Tools voor sleep/dnd |

---

## Lees Eerst

- `_prd/architecture/think-loop.md`
- `src/scheduler/sleep-mode.ts` (huidige implementatie)
- `src/scheduler/index.ts` (Think Loop)
