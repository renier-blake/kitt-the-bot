# Brainstorm

Sparren, ideeën verkennen, en alles vastleggen in een brainstorm document.

## Trigger

Herkent varianten van:
- "Ik heb een idee"
- "Laten we brainstormen over..."
- "Ik wil even sparren"
- "Wat als we..."
- "Even een idee kwijt"

## Workflow

### 1. Topic bepalen

Vraag kort wat het onderwerp is (als dat niet al duidelijk is uit het bericht).

### 2. Bestaand document checken

```bash
ls profile/user/brainstorms/ 2>/dev/null
```

Check of er al een brainstorm doc bestaat over hetzelfde of een gerelateerd onderwerp. Als dat zo is:
- Meld het: "Er is al een brainstorm over [X], wil je die uitbreiden of een nieuwe starten?"
- Bij uitbreiden: voeg een nieuwe sessie toe aan het bestaande document

### 3. Brainstormen

Dit is het belangrijkste deel. Wees een actieve sparringpartner:
- Stel vragen om ideeën scherper te maken
- Doe eigen suggesties en alternatieven
- Speel advocaat van de duivel waar nodig
- Denk mee over haalbaarheid, edge cases, prioriteiten
- Wees eerlijk — als iets niet slim klinkt, zeg het

### 4. Document opslaan

Na het gesprek (of als de user aangeeft klaar te zijn), sla alles op:

**Locatie:** `profile/user/brainstorms/SLUG.md`

**Naamgeving:** Korte kebab-case slug van het onderwerp, bijv:
- `skills-marketplace.md`
- `voice-mode.md`
- `multi-tenant-auth.md`

**Format:**

```markdown
# [Onderwerp]

> Brainstorm document — wordt automatisch bijgewerkt bij nieuwe sessies.

## Sessie — [datum, bijv. 10 februari 2026]

### Kernidee
[1-3 zinnen over het hoofdidee]

### Besproken punten
- [Punt 1]
- [Punt 2]
- [...]

### Open vragen
- [Vraag 1]
- [Vraag 2]

### Volgende stappen
- [Actie 1]
- [Actie 2]

---

## Sessie — [eerdere datum]
[Eerdere sessie inhoud als die er is]
```

### 5. Bevestig

```
Brainstorm opgeslagen in profile/user/brainstorms/SLUG.md

Wil je hier een issue van maken?
```

## Regels

1. **Geen context loading** — Brainstorm docs worden NIET in de context geladen. Ze zijn puur voor opslag en terugzoeken via search.
2. **Zoekbaar** — Documenten zijn vindbaar via `npm run search -- "onderwerp"` omdat ze in de profile directory staan.
3. **Meerdere sessies per doc** — Als je verder brainstormt over hetzelfde onderwerp, voeg een nieuwe sessie toe bovenaan (nieuwste eerst).
4. **Nederlands** — Tenzij de user in het Engels brainstormt.
5. **Actieve sparringpartner** — Niet alleen opschrijven wat de user zegt. Meedenken, tegengas geven, alternatieven bieden.
6. **Issue aanbieden** — Na een brainstorm altijd aanbieden om er een issue van te maken (via /create-issue).

## Fallbacks

| Situatie | Actie |
|----------|-------|
| User wil niet opslaan | Respecteer dat, sla niks op |
| Onderwerp te vaag | Vraag door tot het concreet genoeg is |
| Brainstorm loopt dood | Stel nieuwe invalshoeken voor of sluit af |
| Bestaand doc over zelfde topic | Vraag: uitbreiden of nieuw? |
