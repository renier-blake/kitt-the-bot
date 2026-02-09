# SUG002: Context Loss bij Herhaalde Berichten

**Status:** open
**Datum:** 8 feb 2026
**Type:** behavior

---

## Probleem

Renier moest vandaag 3x hetzelfde bericht sturen ("Ja, dit mag je zo bouwen...") voordat ik het oppakte. De eerste keer (21:32) reageerde ik met een plan. Toen ik later een nieuwe sessie startte (22:32), was ik de context kwijt en wist ik niet meer wát er gebouwd moest worden.

Eerder op de dag hetzelfde patroon: Renier vertelde over de TTS-mogelijkheden die we al hadden (ElevenLabs + bridge), maar ik beweerde dat ik geen TTS skills had.

---

## Voorstel

- Optie A: Bij elk nieuw bericht altijd de laatste 5 transcripts lezen voordat ik reageer
- Optie B: Een "actieve context" opslaan in de meta tabel (bijv. "bezig met: codebase health audit skill, goedgekeurd door Renier")
- Optie C: Memory search uitvoeren als een bericht refereert aan iets eerder ("dat", "die", "het")

---

## Voorbeeld

21:19 — Renier: beschrijft codebase health audit skill
21:22 — KITT: maakt plan
21:32 — Renier: "Ja, dit mag je zo bouwen"
...nieuwe sessie...
22:32 — Renier: "Ja, dit mag je zo bouwen" (3e keer)
22:32 — KITT: "Ik mis de context van wát je precies wilt" 😬
