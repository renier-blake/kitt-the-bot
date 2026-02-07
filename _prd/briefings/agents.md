# Agents Briefing

> Kennis over Multi-Agent orchestratie - hoe KITT sub-agents gebruikt.

---

## Jouw Scope

Als je werkt aan agent-gerelateerde features:
- Sub-agent spawning via Task tool
- Agent specialization
- Result aggregation
- Parallel execution

---

## Key Concepts

### Main Agent vs Sub-Agents
- **Main Agent:** Deze Claude Code session, ontvangt user input
- **Sub-Agents:** Gespawned via Task tool voor specifieke taken

### Available Sub-Agent Types
| Type | Use Case |
|------|----------|
| `Explore` | Codebase research, searches |
| `Bash` | Command execution |
| `Plan` | Architecture design |
| `general-purpose` | Complex multi-step |

### When to Use Sub-Agents
**DO:**
- Multiple independent searches
- Parallel research tasks
- Long-running operations

**DON'T:**
- Simple file reads
- Single searches
- Quick questions

---

## Task Tool Usage

```typescript
// Single sub-agent
Task({
  description: "Research AI frameworks",
  prompt: "Find the top 5...",
  subagent_type: "Explore"
})

// Parallel sub-agents (multiple calls in one response)
Task({ description: "Research A", ... })
Task({ description: "Research B", ... })

// Background (non-blocking)
Task({
  ...,
  run_in_background: true
})
```

---

## Reference Code

### OpenClaw (Primary for multi-agent)
```
_repos/openclaw/src/agents/tools/sessions-spawn-tool.ts  # Sub-agent spawning
_repos/openclaw/src/agents/subagent-announce.ts          # Result announcement
_repos/openclaw/src/process/command-queue.ts             # Lane-based queueing
```

### NanoClaw (Simpler approach)
```
_repos/nanoclaw/src/task-scheduler.ts    # Scheduled tasks
_repos/nanoclaw/container/agent-runner/  # How agents run
```

---

## Communication Pattern

```
Main Agent
    │
    ├── Spawn Sub-Agent A
    ├── Spawn Sub-Agent B
    ├── Spawn Sub-Agent C
    │
    ├── Wait for results
    │
    └── Synthesize → Respond to user
```

---

## Architecture Doc

Zie `_prd/architecture/multi-agent.md` voor:
- Complete architecture diagram
- Spawning patterns
- Comparison with OpenClaw
