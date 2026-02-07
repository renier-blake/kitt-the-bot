# Brainstorm: Unified Data Brain

> **Datum:** 7 februari 2026 (laat in de nacht)
> **Context:** Renier kon niet slapen en had een stroom aan ideeën

---

## Het Probleem

KITT haalt data **on-demand** op via skills (curl calls, API requests). Dat is reactief. De Think Loop maakt beslissingen op basis van beperkte context (transcripts + tijd). Er ontbreken cruciale datapunten om goede beslissingen te nemen, zoals:

- Is Renier wakker? → Slaapdata was van gisteren, maar KITT dacht dat het vandaag was
- Is Renier bezig? → KITT stuurt berichten terwijl hij misschien druk is
- Is Renier thuis? → Geen locatie-awareness

## Het Grote Idee

**Alle data continu aggregeren in kitt.db**, niet on-demand ophalen. Dan heeft de Think Loop (en elke skill) altijd toegang tot de volledige context via de database + semantic search.

```
Nu:    Think Loop → curl Garmin → interpreteer → beslis
Straks: Think Loop → query kitt.db → alles is er al → beslis
```

### Wat er in de database zou zitten:

| Data | Bron | Update frequentie |
|------|------|-------------------|
| Transcripts | Telegram bridge | Real-time |
| KITT thoughts/reflecties | Think Loop | Elke 5 min |
| Health data (slaap, HRV, stappen) | Garmin API | Elke 15-30 min |
| Nutrition data | Manual logging | Per maaltijd |
| Workout data | Gym Race Coach | Per workout |
| Reminders/todo's | Apple Reminders | Elke 5-15 min |
| Sensor data (GPS, WiFi, etc.) | Sensor Logger app | Continu (stream) |
| Email highlights | Gmail (toekomstig) | Elke 15 min |

### Voordeel

De Think Loop + skills hoeven geen externe calls meer te doen. Alles zit in kitt.db. Semantic search werkt over ALLES — transcripts, health data, nutrition, locatie, reminders. Eén unified brain.

---

## Idee 1: Wake-Up Check

### Probleem
KITT stuurt berichten terwijl Renier misschien slaapt. Huidige slaapdata is niet betrouwbaar genoeg (datum verwarring).

### Oplossing: Multi-datapunt wake-up detectie

| Datapunt | Hoe checken | Betrouwbaarheid |
|----------|-------------|-----------------|
| Nieuwe slaaplog data | Garmin sync → slaap sessie afgesloten | Hoog |
| Stappen gezet | Garmin → laatste stap timestamp | Hoog |
| GPS locatie veranderd | Sensor Logger → beweging | Midden |
| WiFi netwerk | Sensor Logger → thuis/werk/onderweg | Midden |
| Telegram activiteit | Laatste bericht timestamp | Hoog |
| Camera (toekomstig) | Niet nu | - |

### Wake-up flow

```
Think Loop tick
    ↓
Check: is Renier wakker?
    - Slaaplog afgesloten? ✅
    - Stappen na 06:00? ✅
    - Telegram bericht recent? ❌
    ↓
Waarschijnlijk wakker, maar nog niet actief
    ↓
Stuur: "Goedemorgen! Ik zie dat je wakker bent. Laat me weten als je zover bent 🌅"
    ↓
Wacht op reactie → pas dan ochtend routine
```

### Snooze mechanisme

Als Renier niet reageert na X berichten:
- 1e bericht: normaal sturen
- Geen reactie na 10 min: wacht
- 2e poging na 30 min: "Ik zie dat je bezig bent, laat het me weten!"
- Geen reactie: stop met sturen tot Renier zelf iets stuurt

---

## Idee 2: Sensor Logger Integratie

### App: Sensor Logger
- App die sensoren van je telefoon uitleest
- Kan data streamen over HTTP naar een endpoint
- Sensoren: GPS, accelerometer, WiFi, barometer, etc.

### Architectuur

```
iPhone (Sensor Logger)
    ↓ HTTP POST (continu)
    ↓ via Tailscale VPN tunnel
    ↓
Mac Mini (KITT)
    ↓ HTTP server op lokale poort
    ↓
kitt.db (sensor_data table)
    ↓
Think Loop / Skills kunnen querien
```

### Setup stappen:
1. Tailscale installeren op iPhone + Mac Mini
2. VPN tunnel opzetten (beveiligd)
3. HTTP server draaien op Mac Mini (Express/Fastify op bijv. :3001)
4. Sensor Logger configureren om te streamen naar Tailscale IP:3001
5. Server ontvangt data en insert in kitt.db

### Interessante datapunten:

| Sensor | Wat het vertelt |
|--------|----------------|
| **GPS** | Thuis, werk, onderweg, op vakantie |
| **WiFi SSID** | Thuis netwerk = thuis, werk netwerk = op werk |
| **Accelerometer** | In beweging of stil (slaapt?) |
| **Stappenteller** | Actief of inactief |
| **Licht sensor** | Telefoon in broekzak vs op tafel |
| **Batterij** | Opladen = waarschijnlijk thuis/slaap |

### Database schema (concept)

```sql
CREATE TABLE sensor_data (
    id INTEGER PRIMARY KEY,
    sensor_type TEXT,        -- 'gps', 'wifi', 'accelerometer', etc.
    timestamp INTEGER,       -- unix timestamp ms
    value_json TEXT,         -- JSON met sensor waarden
    created_at INTEGER DEFAULT (unixepoch() * 1000)
);

-- Index voor snelle queries
CREATE INDEX idx_sensor_type_time ON sensor_data(sensor_type, timestamp DESC);
```

---

## Idee 3: Snooze Skill

### Probleem
KITT kan spammerig zijn — blijft berichten sturen terwijl Renier bezig is.

### Oplossing

```
Renier: "snooze 1 uur" of "hou even je mond"
    ↓
KITT: stopt met proactieve berichten voor 1 uur
    ↓
Na 1 uur: "Ik ben er weer! Iets gemist?"
```

### Automatische snooze detectie

| Signaal | Actie |
|---------|-------|
| 2+ berichten zonder reactie | Automatisch snooze 30 min |
| "Later" of "nu niet" | Snooze 1 uur |
| "Snooze [tijd]" | Snooze voor opgegeven tijd |
| Nacht (23:00-07:00) + geen activiteit | Automatisch snooze tot wakker |

### Implementatie

Simpel veld in registry.json:
```json
{
  "snooze": {
    "active": true,
    "until": "2026-02-07T08:00:00Z",
    "reason": "nacht - geen activiteit"
  }
}
```

Think Loop checkt snooze status en skipt berichten als active=true.

---

## Idee 4: Data Aggregatie Service

### Concept

Een achtergrond service die periodiek data ophaalt en in kitt.db zet:

```
┌─────────────────────────────────────┐
│         Data Aggregator             │
│                                     │
│  Garmin    → elke 15 min → kitt.db  │
│  Reminders → elke 5 min  → kitt.db  │
│  Sensors   → continu     → kitt.db  │
│  Email     → elke 15 min → kitt.db  │
│                                     │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│           kitt.db                    │
│                                     │
│  transcripts    (gesprekken)        │
│  facts          (onthouden)         │
│  health_data    (Garmin)            │
│  food_log       (voeding)           │
│  sensor_data    (telefoon)          │
│  reminders_cache (Apple)            │
│  email_cache    (Gmail)             │
│  workout_log    (training)          │
│                                     │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│     Think Loop / Skills / Chat      │
│                                     │
│  Alles doorzoekbaar via:            │
│  - SQL queries                      │
│  - Semantic search (embeddings)     │
│  - FTS5 keyword search              │
│                                     │
└─────────────────────────────────────┘
```

---

## De Kernvraag

> "Zou het het systeem verbeteren?"

**Ja, absoluut.** En hier is waarom:

1. **Betere beslissingen** — Think Loop heeft ALLE context, niet alleen transcripts
2. **Snellere responses** — geen API calls meer on-demand, data is er al
3. **Minder fouten** — geen datum verwarring meer bij slaapdata
4. **Proactief handelen** — KITT kan patronen herkennen over meerdere databronnen
5. **Unified search** — "wanneer heb ik het best geslapen deze week?" doorzoekt alles

Het verschil is: van een **reactieve chatbot** naar een **proactieve assistent met een volledig beeld**.

---

## Prioriteit

| # | Wat | Effort | Impact |
|---|-----|--------|--------|
| 1 | **Snooze mechanisme** | Klein | Hoog — stopt spam |
| 2 | **Wake-up check** (multi-datapunt) | Midden | Hoog — geen nacht berichten meer |
| 3 | **Data Aggregatie** (Garmin + Reminders caching) | Midden | Hoog — unified brain |
| 4 | **Sensor Logger integratie** | Groot | Midden — locatie awareness |

---

## Open Vragen

- Sensor Logger: welke sensoren exact aanzetten? (batterij impact)
- Tailscale: al geïnstalleerd op de Mac Mini?
- Data retentie: hoelang sensor data bewaren? (kan groot worden)
- Embeddings: moeten we sensor data ook embedden, of alleen SQL queries?
