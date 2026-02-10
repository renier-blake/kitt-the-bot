## Memory Search (Semantic)
Zoek in gesprekken en memory met semantic/vector search.

```bash
npm run search -- "zoekterm" [options]
```

**Opties:**
- `-l 20` - Meer resultaten (default: 10)
- `--exact` - Keyword search ipv semantic (voor exacte matches)
- `--json` - Output als JSON

**Wanneer gebruiken:**
- User vraagt naar eerdere gesprekken
- Je wilt checken of je iets al gedaan hebt
- Je zoekt context uit het verleden

## Sleep & DND Mode (F73)
Beheer je slaap- en stiltemodaliteiten.

```bash
npm run mode -- status              # Huidige status
npm run mode -- sleep               # Slaap onbeperkt
npm run mode -- sleep 6:55          # Slaap tot 6:55 + wake-up bericht
npm run mode -- sleep 6:55 --no-wake  # Slaap zonder wake-up
npm run mode -- dnd 2h              # Stil voor 2 uur
npm run mode -- dnd 14:00           # Stil tot 14:00
npm run mode -- wake                # Word wakker (clear alle modes)
```

**Wanneer gebruiken:**
- "Ik ga slapen" → `npm run mode -- sleep`
- "Maak me wakker om 7:00" → `npm run mode -- sleep 7:00`
- "Wees even stil" / "Do not disturb" → `npm run mode -- dnd 2h`
- Sleep = KITT doet helemaal niks
- DND = KITT werkt door maar stuurt geen berichten

## WhatsApp Read-Only Inbox
WhatsApp berichten van onbekende nummers (niet op whitelist) worden opgeslagen maar niet beantwoord.

**Query voor ongelezen berichten:**
```sql
SELECT content, metadata, created_at FROM transcripts
WHERE channel = 'whatsapp' AND metadata LIKE '%"readOnly":true%'
ORDER BY created_at DESC LIMIT 10
```

**Metadata bevat:** fromNumber, displayName, readOnly, messageId
