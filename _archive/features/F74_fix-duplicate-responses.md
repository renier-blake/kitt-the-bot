# F74: Think Loop Conversation Awareness

**Status:** ✅ Done
**Prioriteit:** High
**Datum:** 8 feb 2026

---

## Probleem

Think Loop heeft te weinig context over de lopende conversatie:
- Ziet alleen `lastUserMessage` (1 bericht)
- Weet niet of dat bericht al beantwoord is
- Weet niet of er een actieve heen-en-weer conversatie gaande is
- Weet niet of er ergens iets is blijven liggen

**Gevolg:** Think Loop reageert soms op dingen die al afgehandeld zijn, of mist dingen die wél aandacht nodig hebben.

---

## Filosofie

**NIET:** Hard-coded regels die Think Loop beperken
**WEL:** Meer context geven zodat Think Loop zelf intelligent kan beslissen

De Think Loop prompt werkt goed. We willen alleen de **context** verrijken, niet de besluitvorming overnemen.

---

## Huidige Context (te beperkt)

```typescript
lastUserMessage?: {
  content: string;
  time: string;
  minutesAgo: number;
}
```

Dit is niet genoeg. De Think Loop ziet alleen het laatste bericht, maar niet:
- Of er al op gereageerd is
- Of er daarna nog meer berichten zijn geweest
- Of er een actief gesprek gaande is
- Of er ergens iets is blijven hangen

---

## Voorgestelde Uitbreiding

### Nieuwe context: `conversationState`

```typescript
interface ConversationState {
  // Laatste paar exchanges (niet alleen lastUserMessage)
  recentExchanges: Array<{
    role: 'user' | 'kitt';
    type: 'message' | 'thought' | 'task';
    content: string;  // preview
    time: string;
    minutesAgo: number;
  }>;

  // Conversation flow indicators
  lastUserMessageAnswered: boolean;  // Is er een kitt|message NA de laatste user message?
  activeConversation: boolean;       // Was er recent (< 5 min) heen-en-weer?
  conversationGap: number;           // Minuten sinds laatste interactie

  // Unanswered messages (if any)
  unansweredUserMessages: Array<{
    content: string;
    time: string;
    minutesAgo: number;
  }>;
}
```

### Prompt aanpassing

In plaats van hard regels, geef de Think Loop deze context als informatie:

```markdown
## Conversatie Status

**Recente exchanges:**
- [15:42] Renier: "Kun je die file aanpassen?"
- [15:42] KITT: "Ja, momentje..."
- [15:45] Renier: "Top!"
- [15:45] KITT: "Klaar! Hier is het resultaat..."

**Status:**
- ✅ Laatste user bericht is beantwoord
- ✅ Actieve conversatie (laatste interactie 3 min geleden)
- Geen onbeantwoorde berichten

**Of:**

**Status:**
- ⚠️ Laatste user bericht is NIET beantwoord (5 min geleden)
- Geen recente KITT response na user bericht
```

De Think Loop kan dan zelf beslissen:
- "Actieve conversatie, ik bemoei me er niet mee"
- "Hier is iets blijven liggen, ik pak het op"
- "Conversatie is al een uur geleden, ik focus op taken"

---

## Implementatie

### 1. `buildThinkLoopContext()` uitbreiden

```typescript
// Get recent exchanges (last 10 messages)
const recentExchanges = todayResult.rows
  .slice(-10)
  .map(row => ({
    role: row.role,
    type: row.type,
    content: String(row.content).slice(0, 100),
    time: formatTime(row.created_at),
    minutesAgo: getMinutesAgo(row.created_at),
  }));

// Check if last user message was answered
const lastUserIdx = findLastIndex(recentExchanges, e => e.role === 'user');
const lastUserMessageAnswered = lastUserIdx >= 0 &&
  recentExchanges.slice(lastUserIdx + 1).some(e => e.role === 'kitt' && e.type === 'message');

// Check if conversation is active (recent back-and-forth)
const lastInteraction = recentExchanges[recentExchanges.length - 1];
const activeConversation = lastInteraction && lastInteraction.minutesAgo < 5;

// Find unanswered user messages
const unansweredUserMessages = findUnansweredMessages(recentExchanges);
```

### 2. `buildThinkPrompt()` uitbreiden

Voeg een "Conversatie Status" sectie toe aan de prompt met bovenstaande info.

---

## Acceptance Criteria

- [x] Think Loop krijgt `recentExchanges` (laatste 10 berichten)
- [x] Think Loop krijgt `lastUserMessageAnswered` indicator
- [x] Think Loop krijgt `activeConversation` indicator
- [x] Think Loop krijgt lijst van `unansweredUserMessages` (indien van toepassing)
- [x] Prompt toont deze info op een leesbare manier
- [x] Think Loop maakt zelf de beslissing (geen hard-coded blocks)

---

## Wat F74 NIET deed (opgelost door Processing Lock)

F74 was "informational only" — het gaf meer context maar enforceeerde niks. De processing lock (toegevoegd na F74) lost de race condition daadwerkelijk op:

- ✅ Processing lock in `meta` tabel (`agent_processing_since`)
- ✅ Telegram handler zet lock vóór `runAgent()`, released na opslaan response
- ✅ Think Loop checkt lock en skipt tick als chat agent bezig is
- ✅ Stale lock bescherming (> 2 min → auto-release)
- ✅ Conversatie Status prompt vereenvoudigd (anti-dubbel guidance verwijderd)

**Files:** `src/scheduler/processing-lock.ts`, `src/bridge/telegram.ts`, `src/scheduler/index.ts`

---

## Model Upgrade: Think Loop → Opus

De Think Loop moet beter kunnen redeneren over conversatie-context. Daarom upgraden we het model.

**Wijziging in `profile/schedules/registry.json`:**
```json
"thinkLoop": {
  "model": "opus"  // was: "haiku"
}
```

**Impact:**
- Think Loop reasoning: `haiku` → `opus` (betere nuance)
- Tasks met `model: null`: blijven via Think Loop (nu opus)
- Tasks met `model: 'opus'` (zelfreflectie, blog): aparte sub-agent (geen wijziging)
- Tasks met `model: 'haiku'`: kunnen we later toevoegen voor simpele reminders

**Kosten:** Opus is duurder, maar Think Loop draait maar 1x per 5 minuten. Met betere reasoning voorkomt het ook onnodige messages (die ook tokens kosten).

---

## Gerelateerde Files

| File | Wijziging |
|------|-----------|
| `src/scheduler/think-loop.ts` | Context uitbreiden met `conversationState` |
| `src/scheduler/think-loop.ts` | Prompt uitbreiden met "Conversatie Status" sectie |
| `profile/schedules/registry.json` | `thinkLoop.model`: `haiku` → `opus` |

---

## Voorbeeld Output in Prompt

```markdown
## Conversatie Status

**Recente uitwisselingen (laatste 10):**
[07:30] Renier: "Ja, maar die skills, die, dat laden van die transcripts..."
[07:30] KITT: "Ah, nu snap ik het! De Think Loop gebruikt runAgent..."
[07:33] 🧠 KITT (thought): "Bericht gestuurd: Ja, je hebt helemaal gelijk!..."
[07:35] Renier: "Nee, wat mij betreft mag je die gewoon laden..."
[07:35] KITT: "Ah, ik snap je vraag nu..."
[07:37] Renier: "Oké, dus die kid zelfreflectieskill..."
[07:37] KITT: "Precies! Dat is het hele probleem..."
[07:38] 🧠 KITT (thought): "Observatie: Renier is aan het debuggen..."
[07:38] Renier: "Ja, ik zit even te denken..."
[07:38] KITT: "Oké, nu snap ik het volledige plaatje..."

**Conversatie analyse:**
- ✅ Laatste user bericht (07:38) is beantwoord door KITT (07:38)
- ✅ Actieve conversatie — laatste interactie 2 minuten geleden
- ✅ Geen onbeantwoorde berichten gevonden

→ Conversatie loopt goed, focus op scheduled tasks tenzij er iets urgents is.
```

Dit geeft de Think Loop alle info die nodig is om zelf te beslissen.
