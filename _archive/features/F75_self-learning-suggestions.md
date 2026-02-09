# F75: Self-Learning Suggestions

**Status:** 🔧 In Progress (Fase 1)
**Prioriteit:** Medium
**Datum:** 8 feb 2026

---

## Probleem

KITT reflecteert dagelijks, maar:
- Spot geen expliciete fouten uit gesprekken
- Maakt geen concrete verbetervoorstellen
- Leert niet structureel van wat mis ging

**Gevolg:** Dezelfde fouten kunnen zich herhalen omdat er geen feedback loop is.

---

## Filosofie

**NIET:** Hard-coded fout-detectie op specifieke woorden ("nee", "fout")
**WEL:** KITT zoekt naar signalen dat iets niet goed ging en maakt zelf suggesties

Signalen (niet limitatief):
- Conversatie "vastliep" (user moest meerdere keren uitleggen)
- User corrigeerde KITT
- Lange pauze na KITT response
- User gaf negatieve feedback
- KITT begreep de vraag verkeerd

---

## Oplossing: Suggestion Files

### Structuur

```
profile/suggestions/
├── SUG001_context-awareness.md
├── SUG002_voice-response-timing.md
└── ...
```

### Format per suggestie

```markdown
# SUG001: [Korte titel]

**Status:** open | accepted | rejected
**Datum:** 8 feb 2026
**Type:** behavior | architecture | feature

---

## Probleem

Wat ging er mis? Beschrijf het patroon of incident.

---

## Voorstel

Hoe kunnen we dit oplossen?

- Optie A: ...
- Optie B: ...

---

## Voorbeeld

[Concrete situatie uit transcript waar dit probleem optrad]

---

## Notities

[Renier's feedback, beslissing, etc.]
```

---

## Implementatie

### Fase 1: Zelfreflectie Uitbreiding

Update `kitt-self-reflection` skill om:

1. **Signalen zoeken** in transcripts
   - Niet op keywords, maar op patronen
   - Meerdere correcties achter elkaar
   - Herhaalde uitleg nodig
   - Negatieve reacties

2. **Suggestie aanmaken** als er iets gevonden wordt
   - Volgende SUG nummer bepalen
   - File schrijven in `profile/suggestions/`
   - Kort en concreet houden

3. **IDENTITY.md** blijft voor geleerde lessen
   - Suggesties zijn voorstellen (open)
   - Identity notes zijn bevestigde learnings (accepted)

### Fase 2: Reminder Taak (later)

- Taak die checkt of er open suggesties zijn
- In ochtendbriefing of apart moment
- "Er zijn 2 openstaande suggesties voor verbetering"

### Fase 3: Database (optioneel, later)

Als files te beperkt worden:
- `kitt_suggestions` tabel
- Status tracking
- Relatie met transcripts

---

## Wijzigingen

| File | Wijziging |
|------|-----------|
| `.claude/skills/kitt-self-reflection/SKILL.md` | Fout-analyse sectie toevoegen |
| `profile/suggestions/` | Nieuwe folder voor suggestie files |

---

## Acceptance Criteria

- [ ] Zelfreflectie zoekt naar signalen van problemen
- [ ] Bij probleem: suggestie file aanmaken (SUG###)
- [ ] Suggestie bevat: probleem, voorstel, voorbeeld
- [ ] Status tracking (open/accepted/rejected)
- [ ] Geen hard-coded keyword matching

---

## Voorbeeld Output

```markdown
# SUG003: Think Loop context niet zichtbaar in Telegram

**Status:** open
**Datum:** 8 feb 2026
**Type:** architecture

---

## Probleem

User verwees naar een Think Loop bericht, maar de Telegram handler
had geen context van wat de Think Loop had gestuurd. User moest
uitleggen waar het over ging.

---

## Voorstel

- Optie A: Recent transcripts injecteren in Telegram handler context
- Optie B: Shared session tussen Think Loop en Telegram

---

## Voorbeeld

[19:00] KITT (Think Loop): "Avondreflectie — even terugblikken..."
[19:01] User: "herinner me later nog maar een keer"
[19:01] KITT: "Welk ding precies?"
→ KITT zag het Think Loop bericht niet

---

## Notities

[Wachten op Renier's beslissing]
```
