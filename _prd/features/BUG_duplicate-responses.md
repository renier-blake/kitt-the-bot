# BUG: Dubbele/driedubbele responses op één bericht

**Status:** 🐛 Open
**Prioriteit:** Medium
**Ontdekt:** 8 feb 2026

## Probleem

Als Renier een bericht stuurt via Telegram, krijgt hij soms 2-3 responses over hetzelfde onderwerp. De berichten zijn grotendeels hetzelfde.

## Oorzaak

Er draaien twee systemen die allebei op berichten reageren:

1. **Chat agent** — direct getriggerd door Telegram bericht, antwoordt via agent SDK
2. **Think Loop** — tikt elke 5 minuten, ziet het bericht in de transcripts, en reageert er ook op

Deze twee weten niet van elkaar. De Think Loop ziet een recent bericht en denkt "hier moet ik op reageren", terwijl de chat agent dat al heeft gedaan.

## Verwacht gedrag

- Chat agent reageert direct → 1 response
- Think Loop ziet dat er al een response is en doet niks met dat bericht

## Mogelijke oplossingen

1. **Think Loop check:** In de prompt of filtering, checken of het laatste user bericht al een kitt-response heeft gekregen (er staat al een kitt message NA het user bericht in de transcripts)
2. **Timestamp check:** Think Loop negeert user berichten die minder dan X minuten oud zijn (de chat agent handelt die af)
3. **Flag in transcripts:** Chat agent markeert berichten als "handled", Think Loop skipt die

## Gerelateerde files

- `src/scheduler/think-loop.ts` — Think Loop prompt en context
- `src/bridge/agent.ts` — Chat agent
- `src/scheduler/index.ts` — Think Loop execution
