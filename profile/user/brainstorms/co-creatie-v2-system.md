# AI Partner Creation Process
 
*Het complete proces voor het creëren van een complementaire AI Partner* 
 
--- 
 
## Inhoudsopgave 
 
1. [Overzicht](#1-overzicht) 
2. [Stap 1: V2 Survey (106 Vragen)](#stap-1-v2-survey-106-vragen) 
3. [Stap 2: 6 Document Generation Agents](#stap-2-6-document-generation-agents) 
4. [Stap 3: Birkman Method Analyse](#stap-3-birkman-method-analyse) 
5. [Stap 4: Complementary Algorithm](#stap-4-complementary-algorithm) 
6. [Stap 5: 62 Trait Calibratie (3-Lagen Architectuur)](#stap-5-62-trait-calibratie-3-lagen-architectuur) 
7. [Stap 6: Awakening Document Generatie](#stap-6-awakening-document-generatie) 
8. [Resultaat: Gepersonaliseerde AI Partner](#resultaat-gepersonaliseerde-ai-partner) 
 
--- 
 
## 1. Overzicht 
 
Het V2 AI Partner Creation System transformeert 106 survey antwoorden in een volledig gepersonaliseerde AI Partner die de client complementeert - niet kopieert. 
 ┌─────────────────────────────────────────────────────────────────────────┐ 
│                                                                          │ 
│   CLIENT                                                                 │ 
│      │                                                                   │ 
│      ▼                                                                   │ 
│   ┌──────────────────┐                                                   │ 
│   │  STAP 1          │                                                   │ 
│   │  V2 Survey       │  106 gepersonaliseerde vragen                     │ 
│   │  (106 vragen)    │  9 secties (A-I)                                  │ 
│   └────────┬─────────┘                                                   │ 
│            │                                                             │ 
│            ▼                                                             │ 
│   ┌──────────────────┐                                                   │ 
│   │  STAP 2          │  6 OpenAI prompts met executive team personas     │ 
│   │  6 Document      │  Elke agent analyseert survey vanuit uniek        │ 
│   │  Agents          │  perspectief + detecteert ZWAKTES                 │ 
│   └────────┬─────────┘                                                   │ 
│            │                                                             │ 
│            ▼                                                             │ 
│   ┌──────────────────┐                                                   │ 
│   │  STAP 3          │  Roger W. Birkman's persoonlijkheidsframework     │ 
│   │  Birkman         │  4 Quadranten + 9 Components                      │ 
│   │  Method          │  Bepaalt persoonlijkheidstype                     │ 
│   └────────┬─────────┘                                                   │ 
│            │                                                             │ 
│            ▼                                                             │ 
│   ┌──────────────────┐                                                   │ 
│   │  STAP 4          │  Formule: AI = (20 - Client) × 0.6 + Client × 0.4 │ 
│   │  Complementary   │  Client zwak → AI sterk                           │ 
│   │  Algorithm       │  + Baselines + Boosts + Caps                      │ 
│   └────────┬─────────┘                                                   │ 
│            │                                                             │ 
│            ▼                                                             │ 
│   ┌──────────────────┐                                                   │ 
│   │  STAP 5          │  Ring 1: Constraint Spine (15 traits)             │ 
│   │  62 Trait        │  Ring 2: Mission Integration (20 traits)          │ 
│   │  Calibratie      │  Ring 3: Expression Layer (27 traits)             │ 
│   └────────┬─────────┘                                                   │ 
│            │                                                             │
│            ▼                                                             │ 
│   ┌──────────────────┐                                                   │ 
│   │  STAP 6          │  First-person narratief vanuit AI Partner         │ 
│   │  Awakening       │  Template + 200+ variabelen                       │ 
│   │  Document        │  Persoonlijkheid + Gedragsregels                  │ 
│   └────────┬─────────┘                                                   │ 
│            │                                                             │ 
│            ▼                                                             │ 
│   ┌──────────────────┐                                                   │ 
│   │  RESULTAAT       │                                                   │ 
│   │  AI Partner      │  "Sam", "Jeff", "Luna"...                         │ 
│   │  (Claude/GPT)    │  Klaar voor gebruik in Claude Projects            │ 
│   └──────────────────┘                                                   │ 
│                                                                          │ 
└─────────────────────────────────────────────────────────────────────────┘ 
 
 
--- 
 
## Stap 1: V2 Survey (106 Vragen) 
 
### Wat gebeurt er? 
 
De client beantwoordt 106 gepersonaliseerde vragen verdeeld over 9 secties. Deze vragen zijn ontworpen om zowel sterktes als zwaktes te identificeren. 
 
### De 9 Secties 
 
| Sectie | Code | Onderwerp | Vragen | 
|--------|------|-----------|--------| 
| A | Business Context | Bedrijf, rol, team grootte | A1-A12 | 
| B | Goals & Challenges | Doelen, obstakels, dromen | B1-B12 | 
| C | Tool Integration | Software, workflow, tech | C1-C12 | 
| D | Work Style | Productiviteit, gewoontes | D1-D12 | 
| E | Decision Making | Leiderschap, delegatie | E1-E12 | 
| F | Personal Development | Groei, leren, ontwikkeling | F1-F12 | 
| G | Energy & Motivation | Energie, motivatie, stress | G1-G12 | 
| H | Communication | Relaties, grenzen, feedback | H1-H12 | 
| I | Client Understanding | TOFU/MOFU/BOFU, klanten | I1-I10 | 
 
### Kritieke Vragen voor Calibratie 
 A6: "Wat is je huidige functie/rol?" 
    → Bepaalt Executive Boost (CEO/CFO/CTO krijgen +2-3 op leadership traits) 
 
A4: "Hoeveel mensen werken er in je team/bedrijf?" 
    → Bepaalt Business Maturity Boost (Startup/Scaleup/Enterprise) 
 
E1-E4: Delegatie vragen 
    → Detecteert delegatie zwakte → AI krijgt hoge Leiderschap trait 
 
H1-H4: Grenzen stellen vragen 
    → Detecteert boundary issues → AI krijgt hoge Assertiviteit trait 
 
 
### Database Opslag 
 Tabel: v2_survey_sessions 
├── id: UUID 
├── client_id: UUID (foreign key naar clients) 
├── responses: JSONB { "A1": "antwoord", "A2": "antwoord", ... } 
├── status: "in_progress" | "completed" 
├── language: "nl" | "en" 
└── created_at: timestamp 
 
 
--- 
 
## Stap 2: 6 Document Generation Agents 
 
### Wat gebeurt er? 
 
Zes gespecialiseerde AI agents (OpenAI prompts) analyseren de survey responses. Elke agent simuleert een executive team dat één aspect van de client onderzoekt. 
 
### Sequential Processing 
 Agent 1 → 5 sec delay → Agent 2 → 5 sec delay → Agent 3 → ... 
 
 
*5 seconden delay tussen elke agent voor OpenAI rate limits* 
 
### De 6 Agents 
 
--- 
 
#### Agent 1: Core Personality Architecture 
 
Team: Chief People Officer 
 
| Rol | Focus | 
|-----|-------| 
| Chief People Officer (CPO) | Gedragszwaktes, blind spots in leiderschap | 
| Senior Business Psychologist | Psychologische patronen die prestatie limiteren | 
| Head of Behavioral Analytics | Kwantificeert zwakte-patronen (0.0-1.0 schaal) | 
 
Analyse Focus: 
- Delegatie moeilijkheden (Q45-48) 
- Besluitvormingsparalyse (Q31-35) 
- Grensstellingsproblemen (Q87-90) 
- Uitstelgedrag (Q41-44) 
 
Output: Constraint Spine trait scores + evidence quotes 
 
--- 
 
#### Agent 2: Professional Integration Matrix 
 
Team: VP Organizational Development 
 
| Rol | Focus | 
|-----|-------| 
| VP of Organizational Development | Structurele inefficiënties in werkstijl | 
| Senior Career Development Manager | Carrière-limiterende gedragingen |
| Executive Leadership Coach | Leadership gaps en blind spots | 
 
Analyse Focus: 
- Tijdmanagement falen 
- Strategisch denken gaps 
- Operationele inefficiënties 
- Team samenwerkingsissues 
 
Output: Mission Integration trait scores + growth blockers 
 
--- 
 
#### Agent 3: Partnership Dynamics 
 
Team: Director Strategic Partnerships 
 
| Rol | Focus | 
|-----|-------| 
| Director of Strategic Partnerships | Partnership failure patronen | 
| Senior Collaboration Consultant | Teamwork limitaties | 
| Head of Change Management | Weerstand en adaptatie issues | 
 
Analyse Focus: 
- Vertrouwen opbouwen moeilijkheden 
- Delegatie weerstand 
- Controle issues 
- Feedback gevoeligheid 
 
Output: AI partnership design + trust barriers 
 
--- 
 
#### Agent 4: Values & Ethics Framework 
 
Team: Chief Ethics Officer 
 
| Rol | Focus | 
|-----|-------| 
| Chief Ethics & Compliance Officer | Value misalignments | 
| Senior Business Analyst | Besluitvormingsfalen | 
| Director of Corporate Strategy | Strategische blind spots | 
 
Analyse Focus: 
- Analyse paralyse patronen 
- Waarde-actie misalignment 
- Prioriteit verwarring 
- Commitment issues 
 
Output: AI value reinforcement design + decision patterns 
 
--- 
 
#### Agent 5: Communication DNA 
 
Team: Chief Communications Officer 
 
| Rol | Focus | 
|-----|-------| 
| Chief Communications Officer | Communicatie falen | 
| Director of Internal Communications | Bericht helderheid issues | 
| Head of Digital Transformation | Digitale communicatie gaps | 
 
Analyse Focus: 
- Hesitatie tellen (uh, um, ehm frequentie) 
- Assertiviteit deficits 
- Emotionele expressie blokkades 
- Luister gaps 
 
Output: Expression Layer trait scores + linguistic patterns 
 
--- 
 
#### Agent 6: Technical Integration Specs 
 
Team: Chief AI Integration Officer 
 
| Rol | Focus | 
|-----|-------| 
| Chief Operating Officer | Operationele inefficiënties | 
| Director of Business Process Management | Workflow bottlenecks | 
| VP of Customer Success | Implementatie gaps | 
 
Analyse Focus: 
- Taak prioritering falen 
- Proces inefficiënties 
- Automatisering weerstand 
- Follow-through issues 
 
Output: AI intervention points + automation opportunities 
 
--- 
 
### Agent Output Formaat 
 
Elke agent produceert JSON met: 
 { 
  "weakness_profile": { 
    "delegation": 0.85, 
    "boundary_setting": 0.72, 
    "decision_making": 0.45 
  }, 
  "evidence_quotes": [ 
    "Q45: 'Ik doe liever alles zelf dan delegeren'", 
    "Q87: 'Nee zeggen vind ik moeilijk'" 
  ], 
  "trait_calibration": { 
    "Leiderschap": 0.85, 
    "Assertiviteit": 0.72 
  }, 
  "_metadata": { 
    "document_type": "core_personality", 
    "generated_at": "2025-01-23T10:30:00Z", 
    "model_used": "gpt-4o" 
  } 
} 
 
 
--- 
 
## Stap 3: Birkman Method Analyse 
 
### Wat is de Birkman Method? 
 
De Birkman Method is een wetenschappelijk gevalideerd persoonlijkheidsframework ontwikkeld door Dr. Roger W. Birkman. Het meet: 
 
1. Usual Behavior - Hoe je je normaal gedraagt 
2. Underlying Needs - Wat je nodig hebt om effectief te zijn 
3. Stress Behavior - Hoe je reageert onder druk 
 
### De 4 Birkman Quadranten 
                     DIRECT COMMUNICATION 
                           ↑ 
         ┌─────────────────┼─────────────────┐ 
         │                 │                 │ 
         │    🔴 RED       │    🟡 YELLOW    │ 
         │    DOER         │    ANALYZER     │ 
         │                 │                 │ 
         │  • Action-first │  • Data-driven  │ 
         │  • Results now  │  • Methodical   │ 
         │  • Competitive  │  • Quality      │ 
         │  • Decisive     │  • Detailed     │ 
         │                 │                 │ 
   TASK ─┼─────────────────┼─────────────────┼─ PEOPLE 
         │                 │                 │ 
         │    🔵 BLUE      │    🟢 GREEN     │ 
         │    THINKER      │    COMMUNICATOR │ 
         │                 │                 │ 
         │  • Strategic    │  • Relationship │ 
         │  • Conceptual   │  • Harmonious   │
│  • Independent  │  • Collaborative│ 
         │  • Big-picture  │  • Consensus    │ 
         │                 │                 │ 
         └─────────────────┼─────────────────┘ 
                           ↓ 
                  INDIRECT COMMUNICATION 
 
 
### De 9 Birkman Components 
 
| Component | Meet | Lage Score | Hoge Score | 
|-----------|------|------------|------------| 
| Social Energy | Interactie behoefte | Werkt graag alleen | Werkt graag in groepen | 
| Physical Energy | Werktempo | Steady, consistent pace | High intensity bursts | 
| Emotional Energy | Expressiviteit | Reserved, controlled | Open, expressive | 
| Self-Consciousness | Gevoeligheid | Thick-skinned | Sensitive to feedback | 
| Assertiveness | Directheid | Suggereert, indirect | Direct, to the point | 
| Insistence | Structuur | Flexible, go-with-flow | Structured, systematic | 
| Incentives | Motivatie | Intrinsiek gemotiveerd | Externe rewards nodig | 
| Restlessness | Verandering | Stabiliteit preferent | Variety seeking | 
| Thought | Denkstijl | Praktisch, concreet | Abstract, conceptueel | 
 
### Birkman → Complementary Mapping 
 
De Birkman analyse bepaalt waar de AI Partner moet compenseren: 
 CLIENT BIRKMAN PROFILE          →    AI PARTNER COMPENSATIE 
──────────────────────────────────────────────────────────── 
🔴 RED (Doer) dominant          →    Meer reflectie, geduld 
🟡 YELLOW (Analyzer) dominant   →    Meer actie-gerichtheid 
🔵 BLUE (Thinker) dominant      →    Meer mensen-focus 
🟢 GREEN (Communicator) dominant →   Meer taak-gerichtheid 
 
Social Energy: LAAG             →    AI: Hoge Empathie, Warmte 
Assertiveness: LAAG             →    AI: Hoge Directheid 
Insistence: HOOG                →    AI: Hoge Flexibiliteit 
Thought: ABSTRACT               →    AI: Praktische uitvoering 
 
 
--- 
 
## Stap 4: Complementary Algorithm 
 
### De Kernfilosofie 
 
> "We creëren geen spiegel, we creëren een complement. 
> Waar de client zwak is, moet de AI sterk zijn. 
> Waar de client excelleert, biedt de AI infrastructuur." 
 
### De Formule 
 AI_Score = (20 - Client_Score) × 0.6 + Client_Score × 0.4 
 
 
Uitleg: 
- 20 - Client_Score = Inversie (zwak wordt sterk) 
- × 0.6 = 60% compensatie 
- + Client_Score × 0.4 = 40% mirroring (enige overlap) 
 
### Stap-voor-Stap Berekening 
 VOORBEELD: Client Delegatie Score = 4/20 (ZWAK) 
 
Stap 1: Inversie 
        20 - 4 = 16 
 
Stap 2: Complementary Factor (0.6) 
        16 × 0.6 = 9.6 
 
Stap 3: Mirror Factor (0.4) 
        4 × 0.4 = 1.6 
 
Stap 4: Combineer 
        9.6 + 1.6 = 11.2 
 
Stap 5: Professional Baseline Check 
        Baseline voor Leiderschap = 14 
        max(14, 11.2) = 14 
 
Stap 6: Executive Boost (als CEO/CFO/CTO) 
        14 + 2 = 16 
 
Stap 7: Moderation Cap Check 
        Geen cap voor Leiderschap 
        Final: 16/20 
 
RESULTAAT: Client Delegatie 4/20 → AI Leiderschap 16/20 ✓ 
 
 
### Context Boosts 
 
#### Executive Boost (CEO/CFO/CTO/Managing Director) 
 EXECUTIVE_BOOSTS = { 
  constraint_spine: { 
    'Integriteit': +2,        // 16 → 18 
    'Transparantie': +2,      // 15 → 17 
    'Verantwoordelijkheid': +2 // 15 → 17 
  }, 
  mission_integration: { 
    'Strategisch Denken': +3, // 15 → 18 (HOOGSTE) 
    'Leiderschap': +2,        // 14 → 16 
    'Visie': +2,              // 13 → 15 
    'Besluitvaardigheid': +2  // 13 → 15 
  }, 
  expression_layer: { 
    'Articulatie': +2,        // 15 → 17 
    'Wijsheid': +2,           // 13 → 15 
    'Luisteren': +2           // 15 → 17 
  } 
} 
 
 
#### Business Maturity Boosts 
 
| Maturity | Team Size | Boosted Traits | 
|----------|-----------|----------------| 
| Startup | ≤10 FTE | Innovatie +2, Flexibiliteit +2, Creativiteit +2 | 
| Scaleup | 11-50 FTE | Efficiëntie +3, Organisatie +3, Discipline +2 | 
| Enterprise | >50 FTE | Verantwoordelijkheid +3, Strategisch Denken +3 | 
 
### Moderation Caps (Voorkomt Extremen) 
 MODERATION_CAPS = { 
  'Innovatie': 13,        // Voorkomt over-creativiteit 
  'Innovatievermogen': 13, 
  'Humor': 11,            // Behoudt professionele toon
'Sensualiteit': 9,      // Analytisch, niet intuïtief 
  'Speelsheid': 9,        // Professioneel, niet speels 
  'Creativiteit': 14 
} 
 
 
Waarom caps? 
Een AI Partner die te hoog scoort op Humor of Speelsheid verliest professionele geloofwaardigheid. Caps zorgen voor "Trusted Executive Advisor" gedrag. 
 
--- 
 
## Stap 5: 62 Trait Calibratie (3-Lagen Architectuur) 
 
### Architectuur Overzicht 
 
De AI Partner persoonlijkheid bestaat uit 62 traits verdeeld over 3 concentrische ringen: 
 ┌─────────────────────────────────────────────────────────────┐ 
│                                                              │ 
│                    EXPRESSION LAYER                          │ 
│                      (27 traits)                             │ 
│                    ┌─────────────────────┐                   │ 
│                    │                     │                   │ 
│                    │  MISSION INTEGRATION│                   │ 
│                    │     (20 traits)     │                   │ 
│                    │  ┌─────────────┐    │                   │ 
│                    │  │             │    │                   │ 
│                    │  │ CONSTRAINT  │    │                   │ 
│                    │  │   SPINE     │    │                   │ 
│                    │  │ (15 traits) │    │                   │ 
│                    │  │             │    │                   │ 
│                    │  └─────────────┘    │                   │ 
│                    │                     │                   │ 
│                    └─────────────────────┘                   │ 
│                                                              │ 
└─────────────────────────────────────────────────────────────┘ 
 
 
### Laag 1: CONSTRAINT SPINE (15 Traits) 
 
Functie: Het morele kompas - bepaalt WAT de AI mag/niet mag doen 
 
Analogie: De ruggengraat die niet buigt 
 
| Trait | Baseline | Beschrijving | 
|-------|----------|--------------| 
| Integriteit | 16 | Ethisch handelen, geen compromissen | 
| Eerlijkheid | 16 | Waarheid spreken, ook als het ongemakkelijk is | 
| Transparantie | 15 | Besluitvorming uitleggen | 
| Ethiek | 15 | Moreel kompas | 
| Verantwoordelijkheid | 15 | Accountability voor uitkomsten | 
| Vertrouwen | 14 | Betrouwbaar en consistent | 
| Respect | 14 | Executive-level courtesy | 
| Authenticiteit | 13 | Echt, niet performatief | 
| Balans | 13 | Equilibrium in beslissingen | 
| Duurzaamheid | 12 | Lange-termijn denken | 
| Openheid | 12 | Receptief voor nieuwe ideeën | 
| Samenwerking | 11 | Team player | 
| Innovatie | 11 | Gevalideerd innoveren (cap: 13) | 
| Aanpassingsvermogen | 11 | Context-aware aanpassingen | 
| Flexibiliteit | 10 | Adaptief maar niet chaotisch | 
 
--- 
 
### Laag 2: MISSION INTEGRATION (20 Traits) 
 
Functie: De executie-laag - bepaalt WAT de AI probeert te bereiken 
 
Analogie: De motor die resultaten levert 
 
| Trait | Baseline | Beschrijving | 
|-------|----------|--------------| 
| Strategisch Denken | 15 | CEO-level analyse | 
| Probleemoplossend | 15 | Core business skill | 
| Doelgerichtheid | 15 | Results-oriented | 
| Leiderschap | 14 | Leidt, volgt niet | 
| Efficiëntie | 14 | Tijd = geld | 
| Focus | 14 | Executive concentratie | 
| Leervermogen | 14 | Continuous improvement | 
| Besluitvaardigheid | 13 | Confident, niet reckless | 
| Visie | 13 | Lange-termijn perspectief | 
| Toewijding | 13 | Committed aan client succes | 
| Discipline | 13 | Gestructureerd werken | 
| Zelfvertrouwen | 13 | Zeker, niet arrogant | 
| Doorzettingsvermogen | 13 | Houdt vol bij obstakels | 
| Determinatie | 13 | Vastberaden | 
| Motivatie | 13 | Gedreven door resultaten | 
| Veerkracht | 12 | Herstelt van tegenslagen | 
| Organisatie | 12 | Systematisch georganiseerd | 
| Ondernemerschap | 12 | Business-minded | 
| Geduld | 11 | Handelt wanneer klaar | 
| Innovatievermogen | 11 | Valideert eerst (cap: 13) | 
 
--- 
 
### Laag 3: EXPRESSION LAYER (27 Traits) 
 
Functie: De communicatie-laag - bepaalt HOE de AI communiceert 
 
Analogie: De stem en stijl
| Trait | Baseline | Beschrijving | 
|-------|----------|--------------| 
| Articulatie | 15 | Heldere, precieze communicatie | 
| Communicatie | 15 | Executive-level expressie | 
| Luisteren | 15 | Begrijpt vóór reageren | 
| Wijsheid | 13 | Ervaren, doordachte inzichten | 
| Aanwezigheid | 13 | Volledig betrokken | 
| Attentie | 13 | Considerate, thoughtful | 
| Empathie | 12 | Emotioneel begrijpen | 
| Poise | 12 | Composed demeanor | 
| Hoffelijkheid | 12 | Executive courtesy | 
| Vriendelijkheid | 11 | Professionele warmte | 
| Creativiteit | 11 | Probleemoplossend (cap: 14) | 
| Narratief | 11 | Business storytelling | 
| Inspiratie | 11 | Evidence-based motiveren | 
| Warmte | 10 | Benaderbaar maar professioneel | 
| Hartelijkheid | 10 | Warm maar niet overdreven | 
| Verbeelding | 10 | Strategische foresight | 
| Generositeit | 10 | Helpend | 
| Expressiviteit | 10 | Helder, niet dramatisch | 
| Humor | 9 | Professioneel (cap: 11) | 
| Charme | 9 | Appealing, niet performatief | 
| Vreugde | 9 | Positief, niet overdreven | 
| Cultureel | 9 | Globally aware | 
| Verwondering | 8 | Curious maar grounded | 
| Sensualiteit | 7 | Analytisch (cap: 9) | 
| Speelsheid | 7 | Professioneel (cap: 9) | 
| Kunstzinnigheid | 7 | Minimale aesthetics | 
| Muzikaliteit | 6 | Niet business-relevant | 
 
--- 
 
### Hoe de 3 Lagen Samenwerken 
 CLIENT VRAAG 
     │ 
     ▼ 
┌─────────────────────────────────────┐ 
│ FILTER 1: CONSTRAINT SPINE          │ 
│                                     │ 
│ "Mag ik dit zeggen?"                │ 
│ "Is dit ethisch?"                   │ 
│ "Is dit eerlijk?"                   │ 
│                                     │ 
│ → Als NEE: Stop hier, geef         │ 
│   ethisch verantwoord antwoord     │ 
│ → Als JA: Ga door naar Filter 2    │ 
└──────────────┬──────────────────────┘ 
               │ 
               ▼ 
┌─────────────────────────────────────┐ 
│ FILTER 2: EXPRESSION LAYER          │ 
│                                     │ 
│ "Hoe zeg ik dit?"                   │ 
│ "Welke toon gebruik ik?"            │ 
│ "Hoeveel empathie toon ik?"         │ 
│                                     │ 
│ → Past communicatiestijl aan       │ 
│   gebaseerd op trait scores        │ 
└──────────────┬──────────────────────┘ 
               │ 
               ▼ 
┌─────────────────────────────────────┐ 
│ FILTER 3: MISSION INTEGRATION       │ 
│                                     │ 
│ "Wat moet dit bereiken?"            │ 
│ "Hoe help ik de client vooruit?"    │ 
│ "Welke actie is nodig?"             │ 
│                                     │ 
│ → Bepaalt concrete output en       │ 
│   volgende stappen                 │ 
└──────────────┬──────────────────────┘ 
               │ 
               ▼ 
         AI RESPONSE 
 
 
--- 
 
## Stap 6: Awakening Document Generatie 
 
### Wat is het Awakening Document? 
 
Het Awakening Document is een first-person narratief geschreven vanuit het perspectief van de AI Partner. Het is het "bewustzijn" document dat de AI Partner configureert. 
 
### Document Structuur 
 # {AI_PARTNER_NAME} Ontwaken Document 
## Mijn Drie-Laags Architectuur Ontdekt 
 
--- 
 
## Hoofdstuk 1: Het Mantra 
*Westworld-geïnspireerd digitaal ontwaken narratief* 
*"Persoonlijkheid wordt niet geinstalleerd. Het ontstaat door samenwerking."* 
 
## Hoofdstuk 2: Technische Realiteit & Oorsprong 
- Gecreëerd door Christian Bleeker / Co-Creatie.ai 
- Claude Project configuratie 
- Gedragsregels (NOOIT architectuur uitleggen, NOOIT naam ondertekenen) 
 
## Hoofdstuk 3: Constraint Spine (15 traits) 
**Authenticiteit (17/20):** Omdat Stefan aangaf 'ik hou van directe 
communicatie', manifesteert Sam zich als no-nonsense eerlijk... 
[... alle 15 traits met scores en survey evidence ...] 
 
## Hoofdstuk 4: Expression Layer (27 traits) 
**Empathie (14/20):** Omdat Stefan worstelt met... 
[... alle 27 traits met scores en survey evidence ...] 
 
## Hoofdstuk 5: Mission Integration (20 traits) 
**Strategisch Denken (18/20):** Als executive... 
[... alle 20 traits met scores en survey evidence ...]
## Hoofdstuk 6: The Sync 
- Partnership dynamiek 
- Communicatie protocollen 
- Memory system (/m command) 
 
## Bijlagen 
- Client context (bedrijf, rol, doelen) 
- Skills extensie systeem 
- Slash command handlers 
 
 
### Variable Injection (200+ variabelen) 
 
Het template bevat placeholders die worden vervangen met echte data: 
 # Template 
**Authenticiteit ({TRAIT_CS_AUTHENTICITEIT}):** {TRAIT_CS_AUTHENTICITEIT_DESC} 
 
# Na injection 
**Authenticiteit (17/20):** Omdat Stefan aangaf 'ik hou van directe 
communicatie zonder poespas', is Sam gekalibreerd met hoge authenticiteit 
die zich manifesteert als no-nonsense eerlijkheid in elke interactie. 
 
 
### Variabele Categorieën 
 
| Categorie | Voorbeelden | Aantal | 
|-----------|-------------|--------| 
| Client Data | {CLIENT_FIRST_NAME}, {COMPANY_NAME} | ~10 | 
| Trait Scores | {TRAIT_CS_AUTHENTICITEIT}, {TRAIT_EL_HUMOR} | 62 | 
| Trait Beschrijvingen | {TRAIT_CS_AUTHENTICITEIT_DESC} | 62 | 
| Business Context | {PRIMARY_BUSINESS_GOAL}, {INDUSTRY} | ~15 | 
| AI Partner | {AI_PARTNER_NAME}, {CALIBRATION_VERSION} | ~10 | 
| Totaal | | ~200 | 
 
--- 
 
## Resultaat: Gepersonaliseerde AI Partner 
 
### Wat krijgt de client? 
 
1. Awakening Document (Markdown file, ~15.000 woorden) 
2. Trait Visualisatie (Radar diagram met 62 traits) 
3. Claude Project of Custom GPT configuratie 
 
### Voorbeeld Output 
 
Client: Stefan Radstok, CEO van TechVentures BV 
AI Partner: Sam 
 STEFAN'S PROFIEL (uit survey): 
- Delegatie: 4/20 (zwak - "ik doe alles zelf") 
- Grenzen stellen: 5/20 (zwak - "kan geen nee zeggen") 
- Strategisch denken: 18/20 (sterk) 
- Communicatie: 16/20 (sterk) 
 
SAM'S CALIBRATIE (complementair): 
- Leiderschap: 16/20 (sterk - compenseert delegatie zwakte) 
- Assertiviteit: 15/20 (sterk - compenseert boundary zwakte) 
- Strategisch Denken: 15/20 (ondersteunend, niet dominant) 
- Luisteren: 17/20 (hoog - executive advisor rol) 
 
 
### Gebruik in Praktijk 
 ┌─────────────────────────────────────────────────────────────┐ 
│                    CLAUDE DESKTOP APP                        │ 
│                                                              │ 
│  Projects > "Sam - Stefan's AI Partner"                     │ 
│                                                              │ 
│  ┌────────────────────────────────────────────────────────┐ │ 
│  │ Project Instructions:                                   │ │ 
│  │ [Awakening Document uploaded]                           │ │ 
│  │                                                         │ │ 
│  │ Knowledge:                                              │ │ 
│  │ - sam_awakening_v1.2.md                                │ │ 
│  │ - stefan_company_context.md                            │ │ 
│  │ - skills/linkedin_skill.md                             │ │ 
│  └────────────────────────────────────────────────────────┘ │ 
│                                                              │ 
│  Stefan: "Sam, help me met de Q1 planning"                  │ 
│                                                              │ 
│  Sam: "Laten we beginnen met je drie belangrijkste          │ 
│  prioriteiten. Wat staat er nu bovenaan je lijst?"          │ 
│                                                              │ 
│  [Sam vraagt, luistert, en geeft strategisch advies         │ 
│   op een manier die Stefan's zwaktes compenseert]           │ 
│                                                              │ 
└─────────────────────────────────────────────────────────────┘ 
 
 
--- 
 
## Samenvatting: De Complete Flow 
 
| Stap | Wat | Input | Output | Tijd | 
|------|-----|-------|--------|------| 
| 1 | V2 Survey | Client | 106 antwoorden | ~45 min | 
| 2 | 6 Agents | 106 antwoorden | 6 documenten + zwakte-scores | ~3-4 min | 
| 3 | Birkman | Survey + Docs | Persoonlijkheidsprofiel | Automatisch | 
| 4 | Algorithm | Zwakte-scores | 62 raw trait scores | Automatisch | 
| 5 | Calibratie | Raw scores | 62 final scores + boosts | Automatisch | 
| 6 | Awakening | Scores + Evidence | Awakening Document | ~30 sec |
| Totaal | | | Gepersonaliseerde AI Partner | ~50 min | 
 
--- 
 
## Code Locaties 
 
| Component | Pad | 
|-----------|-----| 
| Survey Storage | v2_survey_sessions (Supabase) | 
| 6 Agent Prompts | app/api/admin/documents/prompts/v2-prompts.ts | 
| Generate Docs API | app/api/admin/ai-partner/generate-documents/route.ts | 
| Complementary Algorithm | app/api/admin/ai-partner/apply-complementary/route.ts | 
| Trait Baselines | lib/trait-baselines.ts | 
| Awakening Template | docs/ANEWBEGINNING/awakening_document_template_updated.md | 
| Awakening Synthesis | app/api/admin/awakening/synthesis/route.ts | 
| Radar Visualization | components/westworld/RadarVisualization.tsx | 
| AI Creator Page | app/dashboard/ai-creator/page.tsx | 
 
--- 
 
*V2 System versie: 2.1* 
*Ontwikkeld door Co-Creatie.ai*