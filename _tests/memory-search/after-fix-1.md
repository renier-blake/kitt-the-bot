# Memory Search After Fix — 2026-02-10 07:42

## Wijzigingen
1. minScore: 0.4 → 0.20 (blocks.json)
2. maxResults: 5 → 8 (blocks.json)
3. bm25RankToScore: 1/(1+|rank|) → rank/(rank+3) — sigmoid-style
4. FTS5 query: exact AND → prefix OR per token, AND between tokens

---

### Query: "Jana"
```
> kitt@0.1.0 search
> tsx src/cli/kitt-search.ts Jana -l 5
[memory] Initialized: { fts: true, vector: true, dimensions: 3072 }
🧠 5 semantische matches voor "Jana"
[55% match]
  Ik heb niks over Jana in mijn geheugen. Dit is de eerste keer dat je haar noemt. Wil je erover praten?
[53% match]
  Ja, ik ben nog wel een beetje verdrietig over Jana.
[52% match]
  Ik heb ook niks over Johanna in mijn geheugen. Wie is Jana/Johanna? Vertel me — dan onthoud ik het.
[41% match]
  Ah, ze staat er wel degelijk in. Johanna staat in je reflecties van 8 februari. 
  
  Je ochtendreflectie: *"Mooie tijd met Johanna — zag filmpje op Instagram, moest hard huilen."* En je avondreflectie: *...
[32% match]
  Johanna
```

### Query: "verdrietig over Johanna"
```
> kitt@0.1.0 search
> tsx src/cli/kitt-search.ts verdrietig over Johanna -l 5
[memory] Initialized: { fts: true, vector: true, dimensions: 3072 }
🧠 5 semantische matches voor "verdrietig over Johanna"
[61% match]
  🌙 Avondreflectie (aanvulling) — 7 feb 2026
  
  **Mooist moment van de dag:** Vanmiddag heel verdrietig over de relatie met Johanna die uit is. Heel hard gehuild. Merkte dat niet alleen hijzelf huilde, m...
[51% match]
  Eerlijk gezegd denk ik niet dat het te maken heeft met Heiko, want dat ging eerder namelijk wel goed. Ik denk dat het te maken heeft met het feit dat we de skills niet meer laden in de context. Eerst ...
[47% match]
  Oké, hier is mijn analyse:
  
  **Het probleem is tweeledig:**
  
  1. **Scores zijn structureel laag.** Zelfs "Ik ben verdrietig ik mis Johanna" tegenover een chunk die letterlijk zegt "heel verdrietig over ...
[39% match]
  Johanna
[37% match]
  Ja, ik ben nog wel een beetje verdrietig over Jana.
```

### Query: "Nango OAuth"
```
  Bingo. Dit is precies wat je zoekt. Er bestaan platforms die dit probleem al hebben opgelost:
  
  **Nango is de beste match voor ons:**
  
  - **600+ APIs** — Gmail, Slack, Asana, Notion, HubSpot, Salesforce...
[54% match]
  Die had ik al opgezocht! Hier is het:
  
  ### Nango Pricing
  
  | Tier | Prijs | Connecties | Best voor |
  |------|-------|------------|-----------|
  | **Free** | €0/maand | 10 connecties | Testen / developme...
[52% match]
  Yo, check dit — die eerste is wel bijzonder. **Robin van Nango** heeft je gemaild! 😂 Letterlijk net hadden we het over Nango als OAuth strategie, en een van de founders mailt je.
  
  📬 Je hebt 5 ongele...
[50% match]
  Graag gedaan! Was een goede sessie — van "ik wil een service bouwen" naar een compleet plan met 16 features in het systeem. En Nango als de OAuth backbone was een goeie vondst, scheelt je weken werk.
  ...
```

### Query: "wall balls"
```
🧠 2 semantische matches voor "wall balls"
[43% match]
  ---
  
  ## ✅ F31 Gym Race Coach - VOLTOOID!
  
  **Wat is gebouwd:**
  
  💪 **Database Schema**
  - training_state table (race info, progress, targets)
  - workout_log table (completed workouts + RPE)
  
  🏋️ **28 Wor...
[42% match]
  Baseline staat in `_tests/memory-search/baseline.md`. Samengevat:
  
  **4 van 12 queries (33%) werkt.** Dat is niet best.
  
  - Scores liggen structureel tussen 0.30-0.43 — alles zit op elkaar gepropt
  - De ...
```

### Query: "hoe heb ik geslapen"
```
  | Score | **93/100 — EXCELLENT** 🏆 |
  | Deep | 1u 42m (21%) |
  | Light | 4u 54m (60%) |
  | REM | 1u 36m (20%) |
  | Wakker | 6 min |
  | Stress ...
[41% match]
  😴 **Slaap vannacht:**
  
  | | |
  |---|---|
  | Duur | **6u 42m** |
  | Score | **79/100 — FAIR** |
  | Deep | 1u 30m (22%) |
  | Light | 4u 00m (60%) |
  | REM | 1u 06m (17%) |
  | Wakker | 6 min |
  | Stress | 19 (la...
[40% match]
  Ik kan nog niet slapen
```

### Query: "embedding fix"
```
> kitt@0.1.0 search
> tsx src/cli/kitt-search.ts embedding fix -l 5
[memory] Initialized: { fts: true, vector: true, dimensions: 3072 }
🧠 3 semantische matches voor "embedding fix"
[52% match]
  Oké, hier is alles wat ik de laatste 20 minuten heb gedaan:
  
  ### 1. Embedding pipeline onderzocht
  - Ontdekt dat `memory.initialize()` niet werd aangeroepen in de bridge startup
  - Maar ook ontdekt dat ...
[50% match]
  Sorry Renier. Je hebt gelijk — je vroeg me om aan de embedding issue te werken en ik heb dat niet gedaan. In plaats daarvan triggerde de avondreflectie-taak en die kreeg voorrang.
  
  Wat ik had moeten d...
[49% match]
  OK, de DB is nu 750MB (vooral door de vector index structuur die leeg is). Qua impact:
  
  - **1.059 transcripts** met ~372KB aan content
  - Embedding model: `text-embedding-3-large` (3.072 dimensies)
  - P...
```

### Query: "Kenji"
```
> tsx src/cli/kitt-search.ts Kenji -l 5
[memory] Initialized: { fts: true, vector: true, dimensions: 3072 }
🧠 5 semantische matches voor "Kenji"
[58% match]
  en dat tijdens de wandeling met kenji
[51% match]
  Nice, lekker geslapen? En hoe is het met Kenji? 🐕🚗
[51% match]
  Trusten Renier! 🌙 Geniet van Kenji en tot morgen om half 8. 🚗💤
[46% match]
  Hé, ik denk dat dit bericht niet voor mij bedoeld is maar voor iemand anders 😄 Klinkt als een planning-bericht over de kapper, Kenji, Rudy en het park.
  
  Ik ben KITT, je AI-sidekick — ik kan veel, maa...
[45% match]
  Done! ✅
  
  **Reminder aangemaakt:**
  - 📅 "Oppas regelen voor Kenji (dinsdag)" — 7 feb 2026
  
  Geniet van je week met Kenji! 🐕💚
```

### Query: "boodschappen"
```
  2. Eieren
  3. Cacaopoeder
  4. Ongezoete amandelmelk
  5. Courgettes
  6. Paprika
  7. Rode ui
  8. Kip
  9. Hüttenkäse
  10. Yoghurt
  11. Krieltj...
[60% match]
  ✅ **Boodschappenlijst aangemaakt:**
  
  📝 **Boodschappen**
  - [ ] High protein wraps
  - [ ] Unox rookworst
  
  Zeg maar als je meer wilt toevoegen!
[59% match]
  Ik ga zo boodschappen doen. Ik wil effe dat jij mij effe dit opslaat wat ik moet halen. Ik moet haarvermout hebben, eieren. Ik moet cacaopoeder hebben. Ik moet... even kijken. Melk, amandemelk, ongezo...
```

### Query: "context builder"
```
  src/context/
    ├── builder.ts        ← De basis: laadt identity, soul, user, memory, skills
    ├── memory-search.ts  ← Vect...
[51% match]
  Oké, alleen **Backend**. Geen skill, task, schema of portal.
  
  Backend specifiek:
  - **Welke modules geraakt?** `src/bridge/context.ts` + `src/scheduler/index.ts` + `src/scheduler/think-loop.ts`
  - **Bre...
[50% match]
  Goeie vraag. En je hebt gelijk — de context builder is nu basically een grote hardcoded string concatenatie. Laat me even nadenken over hoe dit past in de modulaire aanpak die we al hebben.
  
  Je hebt n...
[50% match]
  Yooo, KITT-106 is gebouwd! 🚗💨
  
  De hele nieuwe structuur staat er:
  - `src/context/` met builder, loaders, types
  - `profile/context/blocks.json` — de registry
  - `profile/data/` — DB en runtime files v...
```

### Query: "slaapdata"
```
  |---|---|
  | Duur | **8u 06m** |
  | Score | **93/100 — EXCELLENT** 🏆 |
  | Deep | 1u 42m (21%) |
  | Light | 4u 54m (60%) |
  | REM | 1u 36m (20%) |
  | Wakker | 6 min |
  | Stress ...
[33% match]
  😴 **Slaap vannacht:**
  
  | | |
  |---|---|
  | Duur | **6u 42m** |
  | Score | **79/100 — FAIR** |
  | Deep | 1u 30m (22%) |
  | Light | 4u 00m (60%) |
  | REM | 1u 06m (17%) |
  | Wakker | 6 min |
  | Stress | 19 (la...
```

### Query: "sleep data"
```
> tsx src/cli/kitt-search.ts sleep data -l 5
[memory] Initialized: { fts: true, vector: true, dimensions: 3072 }
🧠 4 semantische matches voor "sleep data"
[46% match]
  Genoteerd! 📝 Twee bugs op de lijst nu:
  
  1. **Skills niet geladen in Think Loop** → hallucineert data
  2. **Wake-up reminder niet gestuurd** → sleep mode stopt, maar geen bericht
  
  Allebei goede fixes v...
[40% match]
  - Nutrition logging gaat soepel.
  
  Waar ik faalde:
  - Ik zei eerst dat ik geen Garmin-data had. Vergeten dat ik de skill had. Stom.
  - De midnight-wraparound bug in checkTimeWindow was mijn code. Grace p...
[36% match]
  Sleep 20min
[30% match]
  😴
```

### Query: "gehakt mais crackers"
```
🧠 4 semantische matches voor "gehakt mais crackers"
[70% match]
  Vanavond heb ik 250 gram gehakt op, met drie van die mais crackers, weet je wat dat zijn? Die mais wafel crackers dingen. Volgens mij zijn die iets van 30 kilocalorieën per stuk. En ongeveer 20 gram c...
[34% match]
  Gelogd! 🍽️
  
  **Avondeten:**
  - 250g rundergehakt — 523 kcal, 48g protein
  - 3 maiscrackers — 90 kcal
  - 20g chilisaus — 20 kcal
  
  **Dag totaal: 1.747 kcal | 157g protein**
  
  Nog ruimte als je wilt snacken ...
[34% match]
  Ja krieltjes
[30% match]
  🚗 Haha, krieltjes zijn kleine aardappeltjes! Grilletjes zijn dunne plakjes gemarineerd varkensvlees die je grilt of bakt.
  
  Heb je krieltjes gegeten in plaats van grilletjes? Dan moet ik de lunch aanp...
```

---

## Vergelijking: Baseline vs Fix 1

| Query | Baseline Top | Fix 1 Top | Delta | Verwacht gevonden? |
|-------|-------------|-----------|-------|-------------------|
| "Jana" | 0.34 | **0.55** | +0.21 ✅ | ⚠️ Beter maar vindt nog steeds geen originele Johanna reflecties |
| "verdrietig over Johanna" | 0.39 | **0.61** | +0.22 ✅ | ✅ Avondreflectie 7 feb nu TOP resultaat! |
| "Nango OAuth" | 0.42 | **0.57** | +0.15 ✅ | ✅ Meerdere relevante resultaten |
| "wall balls" | 0.00 | **0.43** | +0.43 ✅ | ✅ Was NIKS, nu gym race coach gevonden! |
| "hoe heb ik geslapen" | 0.42 | **0.42** | +0.00 | ✅ Onveranderd, was al goed |
| "embedding fix" | 0.00 | **0.52** | +0.52 ✅ | ✅ Was NIKS, nu embedding pipeline gesprek! |
| "Kenji" | 0.37 | **0.58** | +0.21 ✅ | ✅ Wandeling + hond referenties |
| "boodschappen" | 0.43 | **0.62** | +0.19 ✅ | ✅ Boodschappenlijst + voice message |
| "context builder" | 0.39 | **0.52** | +0.13 ✅ | ✅ Meerdere relevante gesprekken |
| "slaapdata" | 0.36 | **0.36** | +0.00 | ⚠️ Onveranderd, puur vector (geen keyword hit) |
| "sleep data" | 0.36 | **0.46** | +0.10 ✅ | ⚠️ Beter maar niet de juiste slaapdata |
| "gehakt mais crackers" | 0.43 | **0.70** | +0.27 ✅ | ✅ Exacte match, hoge score |

### Conclusies Fix 1

- **10 van 12 queries verbeterd** (83%)
- **2 queries die NIKS vonden werken nu** (wall balls, embedding fix)
- Gemiddelde top score: baseline 0.33 → fix 0.53 (+0.20)
- FTS5 prefix matching werkt: "Jana" vindt nu chunks die "Jana" bevatten
- BM25 sigmoid normalisatie tilt keyword matches significant
- "slaapdata" onveranderd: geen keyword hit (FTS5 tokeniseert anders), puur vector
- "Jana" → "Johanna" prefix matching werkt NIET: FTS5 prefix zoekt woorden die BEGINNEN met "Jana", maar "Johanna" begint niet met "Jana"

### Openstaande issues

1. "Jana" → "Johanna" werkt niet via prefix (Johanna begint niet met Jana)
   → Mogelijke fix: substring matching of fuzzy search toevoegen
2. "slaapdata" scoort laag — Nederlandse compound woorden splitsen niet goed in embeddings
   → Mogelijke fix: query expansion (slaapdata → slaap data → sleep)
3. "sleep data" vindt bugs/reflecties ipv de echte slaapdata rapporten
   → Vector search snapt de intentie niet goed
