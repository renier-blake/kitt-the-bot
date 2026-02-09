# SUG001: Plan Mode Deadlocks

**Status:** open
**Datum:** 8 feb 2026
**Type:** architecture

---

## Probleem

Plan Mode veroorzaakt herhaaldelijk deadlocks in de Telegram-flow. De agent gaat in Plan Mode (bijv. voor F61 blog-refactor), maar kan de approval niet ontvangen via Telegram. Resultaat: Renier stuurt berichten, krijgt geen antwoord, en moet meerdere keren "Kitt?" sturen.

Dit patroon is gisteren (7 feb) al geïdentificeerd en vandaag (8 feb) opnieuw opgetreden — minstens 3 keer.

---

## Voorstel

- Optie A: Plan Mode volledig uitschakelen voor Telegram-agent (alleen in Claude Code direct)
- Optie B: Auto-timeout op Plan Mode (bijv. 2 minuten) met fallback naar directe uitvoering
- Optie C: Detectie in de bridge: als agent >60 sec stil is in Plan Mode, stuur een "ik zit vast" bericht

---

## Voorbeeld

08:31 — Renier: "Hoe sta ik ervoor met die blogpost?"
08:34 — Renier: "??"
08:40 — Renier: "Ik durf te wedden dat het weer die plan mode is"
08:45 — KITT (Think Loop): "Je hebt gelijk — ik zat inderdaad vast in plan mode"
