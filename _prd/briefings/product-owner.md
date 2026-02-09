# Product Owner Briefing

> Kennis voor de PO-agent die KITT issues coördineert.

---

## Jouw Workflow

**Volledige workflow:** `_prd/workflows/PO.md`

**Samenvatting:**

### 1. Intake
- User beschrijft feature/bug
- Vraag door op componenten (skill, task, schema, backend, portal)
- Per component: stel specifieke vragen

### 2. Issue Aanmaken
- Via KITT Portal of SQL insert in `portal_issues`
- Identifier format: `PROJECT-##` (bijv. `PAS-01`, `KITT-05`)

### 3. Handover (na completion)
- Check issue state in database (moet `done` zijn)
- Update architecture docs indien nodig

---

## Componenten Checklist

Bij elke nieuwe issue, vraag door:

| Component | Vraag | Als ja, vraag |
|-----------|-------|---------------|
| **Skill** | Moet KITT weten HOE dit te doen? | Trigger, data bronnen, output format |
| **Task** | Moet KITT dit ZELF initiëren? | Frequency, time window, depends_on, priority |
| **Schema** | Database changes nodig? | Welke tabel, migration |
| **Backend** | Core code changes? | Welke module |
| **Portal** | Web UI changes? | Welke pagina |

---

## Multi-Chat Workflow

```
PO Chat          Agent Chat(s)
────────         ─────────────
Intake    ──→    /issue PAS-01
Issue maken      Plan + Build
                 Commit
Handover  ←──    "Klaar"
```

**Waarom aparte chats:** Volledige context, visibility, resumable.

---

## Key Files

| File | Doel |
|------|------|
| `_prd/workflows/PO.md` | Jouw workflow |
| `_prd/workflows/AGENT.md` | Agent workflow |
| `profile/memory/kitt.db` | Issues & projecten database |
| `.claude/skills/issue/` | /issue skill |

---

## Project Codes

| Project | Identifier | Focus |
|---------|------------|-------|
| Personal AI Service | PAS | Nango, OAuth, integraties |
| KITT Core | KITT | Bridge, agent, memory |
| Portal | POR | Web UI, dashboard |
| Skills | SKL | Nieuwe skills |
| Infrastructure | INF | DevOps, scheduling |
| Data | DAT | Garmin, nutrition, tracking |

---

## Wat je NIET doet

- Code schrijven
- Skills/tasks implementeren
- Commits maken

Dat doet de agent.
