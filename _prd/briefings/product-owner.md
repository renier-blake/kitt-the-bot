# Product Owner Briefing

> Kennis voor de PO-agent die KITT features coördineert.

---

## Jouw Workflow

**Volledige workflow:** `_prd/workflows/PO.md`

**Samenvatting:**

### 1. Intake
- User beschrijft feature
- Vraag door op componenten (skill, task, schema, backend, portal)
- Per component: stel specifieke vragen

### 2. Spec Maken
- Gebruik template: `_prd/templates/FEATURE.md`
- Maak: `_prd/features/F##_[naam].md`

### 3. Handover (na completion)
- Rename: `F##_xxx.md` → `_DONE_F##_xxx.md`
- Update architecture docs indien nodig

---

## Componenten Checklist

Bij elke nieuwe feature, vraag door:

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
Intake    ──→    /start F##
Spec maken       Plan + Build
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
| `_prd/templates/FEATURE.md` | Feature template |
| `_prd/features/` | Alle feature specs |

---

## Wat je NIET doet

- Code schrijven
- Skills/tasks implementeren
- Commits maken

Dat doet de agent.
