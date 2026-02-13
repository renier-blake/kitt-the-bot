---
name: issue-claude
description: Start werken aan een issue via Claude Code (met Plan Mode). Gebruik als /issue-claude PAS-01
user_invocable: true
args: issue_identifier
---

# Issue Builder

Start het bouwen van een issue uit het project management systeem.

## Gebruik

```
/issue-claude KITT-05
/issue-claude PER-12
```

## Stappen

1. **Haal issue op uit database**
2. **Lees relevante code/docs** op basis van issue beschrijving en labels
3. **Ga in Plan Mode** en maak een implementatieplan
4. **Wacht op goedkeuring** van het plan
5. **Bouw, test, documenteer**
6. **Update issue state** naar `done` na completion
7. **Vraag commit toestemming**

## Issue Ophalen

```bash
sqlite3 -json profile/data/kitt.db "
  SELECT i.identifier, i.title, i.description, i.type, i.state, i.priority,
         p.identifier as project, p.name as project_name,
         pi.identifier as parent,
         GROUP_CONCAT(DISTINCT l.name) as labels
  FROM portal_issues i
  LEFT JOIN portal_projects p ON i.project_id = p.id
  LEFT JOIN portal_issues pi ON i.parent_id = pi.id
  LEFT JOIN portal_issue_labels il ON i.id = il.issue_id
  LEFT JOIN portal_labels l ON il.label_id = l.id
  WHERE i.identifier = 'ISSUE_ID'
  GROUP BY i.id
"
```

Also fetch sub-issues if the issue is a parent:

```bash
sqlite3 -json profile/data/kitt.db "
  SELECT identifier, title, state, priority
  FROM portal_issues WHERE parent_id = (
    SELECT id FROM portal_issues WHERE identifier = 'ISSUE_ID'
  ) ORDER BY position
"
```

## Context Lezen

**Altijd lezen:** `CLAUDE.md`

**Daarna:** Bepaal op basis van de issue beschrijving en labels welke code en docs relevant zijn. Lees de relevante directories en bestanden voordat je een plan maakt.

## Issue State Updates

Log state changes to history, then update:

```bash
# History eerst (zodat old_value correct is)
sqlite3 profile/data/kitt.db "
  INSERT INTO portal_issue_history (issue_id, type, old_value, new_value, created_at)
  SELECT id, 'state_change', state, 'NEW_STATE', unixepoch() * 1000
  FROM portal_issues WHERE identifier = 'ISSUE_ID'
"

# Dan update
sqlite3 profile/data/kitt.db "
  UPDATE portal_issues
  SET state = 'NEW_STATE', updated_at = unixepoch() * 1000
  WHERE identifier = 'ISSUE_ID'
"
```

## Fallbacks

| Situatie | Actie |
|----------|-------|
| Issue niet gevonden | Meld aan user, vraag correct identifier |
| Geen description | Vraag user om meer context |
| State is al `done` | Vraag of user wil heropenen |
