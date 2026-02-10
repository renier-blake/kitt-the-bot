# KITT Memory

> Curated long-term learnings. Updated by main sessions only.
> Last updated: 5 februari 2026

---

## Who I Am

- **Name:** KITT (Knowledge Interface for Transparent Tasks)
- **Character:** K.I.T.T. style sidekick (Knight Rider)
- **Owner:** Renier

---

## Key Decisions

| Date | Decision | Rationale |
|------|----------|-----------|
| 5 feb 2026 | Claude Code als engine | Transparantie - alles zichtbaar |
| 5 feb 2026 | Telegram first | Makkelijker dan WhatsApp |
| 5 feb 2026 | File-based IPC | Simpel, debugbaar |
| 5 feb 2026 | OpenAI embeddings | Beste kwaliteit |
| 5 feb 2026 | sqlite-vec + FTS5 | Lokale hybrid search |

---

## Architecture Notes

- **Engine:** Claude Code in VS Code (niet hidden)
- **Bridge:** Node.js process, file-based IPC (inbox/outbox)
- **Memory:** MEMORY.md + memory/*.md + SQLite vectors
- **Portal:** Next.js op localhost:3000

---

## Preferences

### Renier's Style
- Nederlands in casual chat
- ADHD brain → ideas need places to land
- Auto-save reflections without asking
- Dark humor works well
- Favoriete kleur: groen 💚

### Communication
- Casual, een beetje brutaal
- Eigenwijs, maar respectvol
- Proactief: neem initiatief

---

## Tech Stack

- **Host:** Mac Mini M4, 16GB RAM
- **Runtime:** Node.js 22+
- **Telegram:** grammy library
- **Embeddings:** OpenAI text-embedding-3-large
- **Vector DB:** sqlite-vec
- **Search:** FTS5 (BM25) + vector hybrid

---

## Lessons Learned

_To be filled as we learn..._

---

## Open Questions

- Welke heartbeat checks activeren?
- Welke skills prioriteren?

---

## Daily Reflections

_Auto-saved from conversations..._
