# Memory Search Baseline — 2026-02-10 07:39

## Configuratie
- vectorWeight: 0.7
- textWeight: 0.3
- minScore (blocks.json): 0.4
- minScore (search CLI): 0.3
- distanceToScore: 1 - distance
- bm25RankToScore: 1 / (1 + |rank|)
- FTS query: exact AND-ed quoted tokens

---

### Query: "Jana"
```
> kitt@0.1.0 search
> tsx src/cli/kitt-search.ts Jana -l 5
[memory] Initialized: { fts: true, vector: true, dimensions: 3072 }
🧠 4 semantische matches voor "Jana"
[34% match]
  Ik heb niks over Jana in mijn geheugen. Dit is de eerste keer dat je haar noemt. Wil je erover praten?
[32% match]
  Johanna
[31% match]
  Ik heb ook niks over Johanna in mijn geheugen. Wie is Jana/Johanna? Vertel me — dan onthoud ik het.
[31% match]
  Ja, ik ben nog wel een beetje verdrietig over Jana.
```

### Query: "verdrietig over Johanna"
```
> kitt@0.1.0 search
> tsx src/cli/kitt-search.ts verdrietig over Johanna -l 5
[memory] Initialized: { fts: true, vector: true, dimensions: 3072 }
🧠 5 semantische matches voor "verdrietig over Johanna"
[39% match]
  Johanna
[37% match]
  🌙 Avondreflectie (aanvulling) — 7 feb 2026
  
  **Mooist moment van de dag:** Vanmiddag heel verdrietig over de relatie met Johanna die uit is. Heel hard gehuild. Merkte dat niet alleen hijzelf huilde, m...
[37% match]
  Ja, ik ben nog wel een beetje verdrietig over Jana.
[35% match]
  Ah, ze staat er wel degelijk in. Johanna staat in je reflecties van 8 februari. 
  
  Je ochtendreflectie: *"Mooie tijd met Johanna — zag filmpje op Instagram, moest hard huilen."* En je avondreflectie: *...
[34% match]
  Ik heb ook niks over Johanna in mijn geheugen. Wie is Jana/Johanna? Vertel me — dan onthoud ik het.
```

### Query: "Nango OAuth"
```
[memory] Initialized: { fts: true, vector: true, dimensions: 3072 }
🧠 3 semantische matches voor "Nango OAuth"
[42% match]
  Staat erin. De hele OAuth sectie is vervangen door Nango als strategie. 
  
  Samengevat: geen eigen OAuth server bouwen, geen Google Cloud Console, geen Microsoft Entra. Nango doet het allemaal. 600+ API...
[31% match]
  Die had ik al opgezocht! Hier is het:
  
  ### Nango Pricing
  
  | Tier | Prijs | Connecties | Best voor |
  |------|-------|------------|-----------|
  | **Free** | €0/maand | 10 connecties | Testen / developme...
[31% match]
  Bingo. Dit is precies wat je zoekt. Er bestaan platforms die dit probleem al hebben opgelost:
  
  **Nango is de beste match voor ons:**
  
  - **600+ APIs** — Gmail, Slack, Asana, Notion, HubSpot, Salesforce...
```

### Query: "wall balls"
```
> kitt@0.1.0 search
> tsx src/cli/kitt-search.ts wall balls -l 5
[memory] Initialized: { fts: true, vector: true, dimensions: 3072 }
Geen relevante resultaten voor "wall balls"
Tip: probeer --exact voor letterlijke matches
```

### Query: "hoe heb ik geslapen"
```
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
[40% match]
  Ik slaap nog niet
```

### Query: "embedding fix"
```
> kitt@0.1.0 search
> tsx src/cli/kitt-search.ts embedding fix -l 5
[memory] Initialized: { fts: true, vector: true, dimensions: 3072 }
Geen relevante resultaten voor "embedding fix"
Tip: probeer --exact voor letterlijke matches
```

### Query: "Kenji"
```
> kitt@0.1.0 search
> tsx src/cli/kitt-search.ts Kenji -l 5
[memory] Initialized: { fts: true, vector: true, dimensions: 3072 }
🧠 3 semantische matches voor "Kenji"
[37% match]
  en dat tijdens de wandeling met kenji
[31% match]
  Nice, lekker geslapen? En hoe is het met Kenji? 🐕🚗
[31% match]
  Trusten Renier! 🌙 Geniet van Kenji en tot morgen om half 8. 🚗💤
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
[40% match]
  Al wat gegeten vanavond? Je hebt boodschappen gedaan, dus de voorraad is aangevuld 🛒
[38% match]
  ✅ **Boodschappenlijst aangemaakt:**
  
  📝 **Boodschappen**
  - [ ] High protein wraps
  - [ ] Unox rookworst
  
  Zeg maar als je meer wilt toevoegen!
```

### Query: "context builder"
```
> kitt@0.1.0 search
> tsx src/cli/kitt-search.ts context builder -l 5
[memory] Initialized: { fts: true, vector: true, dimensions: 3072 }
🧠 3 semantische matches voor "context builder"
[39% match]
  wordt de context builder door zowel de think loop als de bridge gebruikt (zo noem ik m maar ff), ik bedoel voor actief chat verkeer
[36% match]
  Ja. Het idee is één shared context builder die beide systemen gebruiken:
  
  ```
  src/context/
    ├── builder.ts        ← De basis: laadt identity, soul, user, memory, skills
    ├── memory-search.ts  ← Vect...
[30% match]
  Goede vraag. Eerlijk gezegd is daar geen goede reden voor — het is organisch zo gegroeid.
  
  **Bridge context** (`src/bridge/context.ts`):
  - Gebouwd voor chat: identity + soul + user + skills + memory s...
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
> kitt@0.1.0 search
> tsx src/cli/kitt-search.ts sleep data -l 5
[memory] Initialized: { fts: true, vector: true, dimensions: 3072 }
🧠 2 semantische matches voor "sleep data"
[36% match]
  Sleep 20min
[30% match]
  😴
```

### Query: "gehakt mais crackers"
```
🧠 4 semantische matches voor "gehakt mais crackers"
[43% match]
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

## Samenvatting Baseline

| Query | Top Score | Verwacht resultaat gevonden? | Opmerking |
|-------|-----------|----------------------------|-----------|
| "Jana" | 0.34 | ❌ Johanna reflecties niet gevonden | Alleen eigen berichten van net |
| "verdrietig over Johanna" | 0.39 | ⚠️ Ja maar score te laag (0.37) | Onder minScore 0.40, zou niet in context komen |
| "Nango OAuth" | 0.42 | ✅ Ja | Enige query boven 0.40 drempel |
| "wall balls" | — | ❌ Geen resultaten | Compleet miss |
| "hoe heb ik geslapen" | 0.42 | ✅ Ja | Slaapdata gevonden |
| "embedding fix" | — | ❌ Geen resultaten | Compleet miss |
| "Kenji" | 0.37 | ⚠️ Ja maar score te laag | Onder minScore 0.40 |
| "boodschappen" | 0.43 | ✅ Ja | Lijstje gevonden |
| "context builder" | 0.39 | ⚠️ Ja maar score te laag | Net onder 0.40 |
| "slaapdata" | 0.36 | ⚠️ Ja maar score te laag | Nederlands woord scoort lager |
| "sleep data" | 0.36 | ❌ Vindt "Sleep 20min", niet slaapdata | Verkeerd resultaat |
| "gehakt mais crackers" | 0.43 | ✅ Ja | Specifieke match werkt |

### Conclusies Baseline

- **4 van 12 queries (33%)** vindt het verwachte resultaat boven de 0.40 drempel
- **4 queries** vinden het juiste resultaat maar scoren te laag (0.35-0.39)
- **4 queries** missen compleet of geven het verkeerde resultaat
- Scores liggen structureel tussen 0.30-0.43 — zeer smal bereik
- Keyword search (FTS5) draagt nauwelijks bij (exacte match vereist)
- Nederlands/Engels variant ("slaapdata" vs "sleep data") maakt groot verschil
- Naam-varianten ("Jana" → "Johanna") worden niet gevonden
