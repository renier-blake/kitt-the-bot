# BUG: Wake-up reminder wordt niet gestuurd

**Status:** ✅ Fixed
**Prioriteit:** Medium
**Ontdekt:** 8 feb 2026
**Opgelost:** 8 feb 2026

## Probleem

Renier zei "maak me wakker om 6:55". KITT zette sleep mode tot 6:55 (correct), maar stuurde geen wake-up bericht toen de tijd verstreek.

De Think Loop tick om 07:02 besloot: *"Renier slaapt waarschijnlijk nog. Beste move: wachten."* — terwijl Renier expliciet had gevraagd om gewekt te worden.

## Oorzaak

`kitt_sleep_until` is puur een interne sleep mode toggle — het zorgt ervoor dat KITT stopt met denken. Maar er is geen mechanisme dat:

1. Een **wake-up taak aanmaakt** wanneer Renier zegt "maak me wakker om X"
2. De Think Loop laat weten dat er een expliciete wake-up is gevraagd

De Think Loop agent ziet alleen de tijd en de transcripts, maar niet dat er een wake-up afspraak was.

## Oplossing

Als Renier zegt "maak me wakker om X":
1. Sleep mode instellen (zoals nu)
2. **Eenmalige task aanmaken** (frequency: `once`) met:
   - `time_window_start`: het gevraagde tijdstip
   - `time_window_end`: +15 min
   - Beschrijving: "Renier wakker maken — hij heeft hierom gevraagd"
3. Think Loop pikt de task op als open task en stuurt een goedemorgen bericht

Alternatief: de bridge kan bij het verlopen van `kitt_sleep_until` automatisch een bericht sturen als er een specifiek tijdstip was ingesteld (niet bij onbeperkte sleep).

## Fix

**Wijziging:** `src/cli/kitt-mode.ts`

Wanneer `npm run mode -- sleep 6:55` wordt uitgevoerd:
1. Sleep mode wordt gezet tot 6:55 (zoals voorheen)
2. Wake reminder wordt gezet in meta tabel (backup)
3. **NIEUW:** Een one-time task wordt aangemaakt:
   - title: "Renier wakker maken"
   - priority: high
   - time_window_start: 6:55
   - time_window_end: 7:10

De Think Loop ziet nu expliciet een taak "Renier wakker maken" en handelt deze af.

## Gerelateerde files

- `src/cli/kitt-mode.ts` — **GEWIJZIGD** — maakt nu task aan
- `src/scheduler/task-engine.ts` — createTask functie
- `src/scheduler/sleep-mode.ts` — wake reminder (backup)
