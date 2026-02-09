# BUG: Dubbele/driedubbele responses op één bericht

**Status:** ✅ Fixed
**Prioriteit:** Medium
**Ontdekt:** 8 feb 2026
**Opgelost:** 9 feb 2026

## Probleem

Als Renier een bericht stuurt via Telegram, krijgt hij soms 2-3 responses over hetzelfde onderwerp. De berichten zijn grotendeels hetzelfde.

## Oorzaak

Er draaien twee systemen die allebei op berichten reageren:

1. **Chat agent** — direct getriggerd door Telegram bericht, antwoordt via agent SDK
2. **Think Loop** — tikt elke 5 minuten, ziet het bericht in de transcripts, en reageert er ook op

Race condition: Think Loop bouwt context terwijl chat agent nog bezig is → ziet geen response → stuurt ook een antwoord.

## Oplossing: Processing Lock

**Aanpak 3 is geïmplementeerd:** Een processing lock in de `meta` tabel.

1. **Telegram handler** zet lock (`agent_processing_since`) vóór `runAgent()`
2. **Chat agent** verwerkt het bericht
3. **Response** wordt opgeslagen in transcripts (blocking, niet async)
4. **Lock** wordt vrijgegeven
5. **Think Loop** checkt lock aan het begin van elke tick → skipt als lock actief

**Stale lock bescherming:** Lock ouder dan 2 min wordt automatisch genegeerd (crash recovery).

**Eerder geprobeerd:** F74 gaf de Think Loop meer conversatie-context ("is het laatste bericht al beantwoord?"). Dit was informational only en loste de race condition niet op.

## Gerelateerde files

- `src/scheduler/processing-lock.ts` — Lock module (acquire, release, isAgentProcessing)
- `src/bridge/telegram.ts` — Lock acquire/release rond runAgent()
- `src/scheduler/index.ts` — Lock check in runThinkLoop()
- `src/scheduler/think-loop.ts` — Vereenvoudigde conversatie status (anti-dubbel guidance verwijderd)
