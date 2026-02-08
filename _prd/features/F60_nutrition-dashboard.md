# F60: Nutrition Dashboard

**Status:** 📝 Spec
**Prioriteit:** Medium

## Wat

Een dashboard pagina in het portal met dagelijks en wekelijks overzicht van voeding.

## Views

- **Dagoverzicht:** Per maaltijd, macro's (kcal, protein, carbs, fat)
- **Weekoverzicht:** Trends, gemiddelden per dag
- **Energiebalans:** Calorieën gegeten vs. verbrand (Garmin) + netto balans

## Data bronnen

- `food_log` tabel — voedingsdata
- Garmin API — verbrande calorieën (TDEE, active calories)

## Toegang

- Desktop: portal (localhost:3000)
- Mobiel: via Tailscale (aparte setup)

## Notities

- Onderdeel van de bredere portal restyling (zie brainstorm/portal.md)
- Technische keuzes afhankelijk van portal framework beslissing
