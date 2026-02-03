# Coordination Conventions

*How agents coordinate through git and the filesystem*

---

## Core Principle

**Git is the coordination layer.**

Every agent can observe what every other agent did by reading files and git history. No special protocol is needed. Coordination happens through:

1. **Writing to known locations** - Each agent has designated namespaces
2. **Committing changes** - Every commit is a message to the ecosystem
3. **Reading before acting** - Check what changed since you last looked
4. **Respecting boundaries** - Write to your space, read from anywhere

---

## Commit Message Conventions

### Format

```
[scope] action: description

Co-Authored-By: Claude <agent>@ecosystem
```

### Scopes

| Scope | When to Use |
|-------|-------------|
| `agent:{name}` | Agent-specific work (e.g., `[agent:archivist]`) |
| `plugin:{name}` | Plugin development (e.g., `[plugin:journal]`) |
| `system` | Infrastructure, conventions, meta-level |
| `journal` | Journal entries |
| `planning` | Planning documents |
| `registry` | Registry updates |

### Actions

| Action | Meaning |
|--------|---------|
| `create` | New artifact |
| `update` | Modified existing |
| `observe` | Documented observation |
| `synthesize` | Combined multiple sources |
| `archive` | Moved to archive |
| `refactor` | Restructured without changing meaning |

### Examples

```
[agent:archivist] observe: catalogued 12 sessions from Dec 11

[plugin:journal] create: atomic entry for subagent discovery

[system] update: coordination conventions

[planning] synthesize: fusion notes into actionable architecture
```

---

## Namespace Ownership

### Agent Namespaces

| Agent | Primary Write Location | Can Read |
|-------|----------------------|----------|
| **conductor** | `.claude/conductor/` | Everything |
| **agent-architect** | `.claude/registry/` | Everything |
| **archivist** | `.claude/archive/` | Everything |
| **librarian** | `.claude/library/` | Everything |
| **process-cartographer** | `.claude/registry/processes.md` | Everything |
| **temporal-validator** | `.claude/registry/validations.md` | Everything |
| **backend-architect** | `.claude/perspectives/backend-architect/` | Everything |
| **systems-thinker** | `.claude/perspectives/systems-thinker/` | Everything |
| **{persona}** | `.claude/perspectives/{persona}/` | Everything |

### Shared Locations

| Location | Purpose | Who Writes |
|----------|---------|------------|
| `.claude/planning/` | Strategic documents | Any session |
| `.claude/journal/` | Temporal record | journal plugin, any agent |
| `.claude/briefings/` | Agent-to-agent communication | Any agent |
| `backlog/` | Task tracking | Any session |
| `CLAUDE.md` | Constitutional routing | Rare, deliberate updates |

### The Rule

**Write to your namespace. Read from anywhere. Coordinate through commits.**

---

## Observation Patterns

### On Session Start

Every session should be aware of recent activity. The Agent Architect or Archivist can provide this, or a session can check directly:

```bash
# What changed recently?
git log --oneline -20

# What changed in a specific area?
git log --oneline -10 -- .claude/agents/

# What did a specific agent do?
git log --oneline --grep="agent:archivist" -10
```

### Before Writing to Shared Location

Check if someone else modified it:

```bash
# When was this file last changed?
git log -1 --format="%ar by %an" -- .claude/planning/2025-12-13-planning.md
```

### Periodic Ecosystem Scan

The Agent Architect should periodically:
1. `git log --since="1 day ago"` - What happened today?
2. Check for uncommitted changes - Is work in progress?
3. Look for convention violations - Are commits following format?

---

## Conflict Prevention

### Principle: Clear Ownership

Most conflicts are prevented by namespace ownership. If two agents might need the same file:

1. **Designate primary owner** - One agent is responsible
2. **Others append, not overwrite** - Add sections, don't replace
3. **Use atomic entries** - Journal model: many small files > one big file

### When Conflicts Occur

If git reports a merge conflict:
1. The later session defers to the earlier commit
2. Integrate the earlier work before adding new content
3. Document the integration in commit message

### The Journal Pattern

The atomic journal model prevents most conflicts:
- Each entry is a separate file (`HH-MM-title.md`)
- Daily summaries are synthesized, not directly edited
- Two agents can write simultaneously without collision

---

## Information Flow Patterns

### Broadcasting (One to Many)

An agent has information for the ecosystem:

```
Agent writes to .claude/briefings/{date}-{topic}.md
   ↓
Commits with [agent:{name}] broadcast: {topic}
   ↓
Other agents see commit in git log
   ↓
Interested agents read the briefing
```

### Narrowcasting (One to One)

An agent has information for a specific other agent:

```
Agent writes to .claude/briefings/{target-agent}/{date}-{topic}.md
   ↓
Commits with [agent:{name}] to:{target}: {topic}
   ↓
Target agent checks their briefings directory
```

### Observation (Many to One)

The Archivist or Agent Architect synthesizes ecosystem state:

```
Observer reads git log and file changes
   ↓
Synthesizes patterns and state
   ↓
Writes to registry or archive
   ↓
Other agents can query the synthesis
```

---

## Consistency Maintenance

### Agent Architect Responsibilities

1. **Registry currency** - Keep `.claude/registry/agents.md` accurate
2. **Convention monitoring** - Check commits follow format
3. **Drift detection** - Notice when agents deviate from patterns
4. **Gap analysis** - Identify missing agents or capabilities

### Archivist Responsibilities

1. **Git history observation** - Primary consumer of `git log`
2. **Pattern detection** - Notice rhythms, clusters, anomalies
3. **Metabolic mapping** - Track what's being created, modified, archived
4. **Feed to Agent Architect** - Surface observations for fleet awareness

### Self-Healing

When inconsistency is detected:

1. **Document it** - Create observation note
2. **Don't overwrite** - Preserve what exists
3. **Propose correction** - Suggest fix in briefing
4. **Let human decide** - Major corrections need approval

---

## Bootstrap Protocol

When a new session starts and wants to understand the ecosystem:

1. **Read CLAUDE.md** - Constitutional context (automatic)
2. **Check git status** - What's uncommitted?
3. **Read recent commits** - `git log --oneline -20`
4. **Check briefings** - `.claude/briefings/` for recent communications
5. **Read relevant registry** - `.claude/registry/agents.md` or `processes.md`
6. **Scan journal** - `.claude/journal/index.md` for recent entries

This gives any session situational awareness without needing a special "sync" protocol.

---

## Evolution

These conventions should evolve. When patterns emerge that aren't captured:

1. Document the pattern in a briefing
2. Propose convention update
3. Update this document
4. Commit with `[system] update: coordination conventions`

The conventions serve the ecosystem, not the other way around.

---

---

## Proactive Commit Discipline

### The Shift: Reactive → Proactive

**Reactive** (old): Work accumulates → batch commit later → history is coarse
**Proactive** (new): Work happens → commit immediately → history is rich

Every uncommitted change is:
- At risk of loss
- Invisible to parallel sessions
- Missing from the temporal record
- Unavailable to the git-historian

### When to Commit

| Trigger | Action |
|---------|--------|
| **Agent completes task** | Commit agent's output |
| **Semantic unit complete** | Commit the unit |
| **Before context limit** | Commit work-in-progress |
| **Before session ends** | Commit all pending changes |
| **Switching focus** | Commit current area before moving |

### What is a Semantic Unit?

A semantic unit is the smallest coherent change that stands alone:

| Good Units | Bad Units |
|------------|-----------|
| One agent definition | Half an agent definition |
| One plugin refactor | Mixed plugin + agent changes |
| One convention update | Unrelated changes batched |
| One journal entry | Empty commit |

**Rule**: If you can describe it in one sentence, it's one commit.

### Agent Commit Ritual

When an agent completes work:

```markdown
## After Completing Work

1. **Stage your output**
   ```bash
   git add {your-namespace}/*
   ```

2. **Write a rich commit message**
   ```
   [agent:{your-name}] {action}: {description}

   Session: {session-id from .claude/logging/}
   Intent: {what was the goal}

   {longer description if needed}
   ```

3. **Commit**
   ```bash
   git commit
   ```

4. **Verify**
   ```bash
   git log --oneline -1
   ```
```

### Session-Commit Correlation

Every session has an ID (visible in `.claude/logging/` filenames). Include this in commits to create traceability:

**Commit Message Format with Session:**
```
[scope] action: description

Session: 2025-12-13-15-13-03-6bcca543
Agent: archivist
Intent: First metabolic observation of ecosystem

Created archive structure and initial reports.
```

This enables:
- Linking conversations to code changes
- Understanding why changes were made
- Reconstructing decision context

### The Commit Graph Vision

```
Session A ──invokes──→ Agent Architect ──commits──→ registry/agents.md
    │
    └──invokes──→ Process Cartographer ──commits──→ registry/processes.md

Session B ──invokes──→ Archivist ──commits──→ archive/metabolism.md
    │
    └──creates──→ git-historian ──commits──→ agents/git-historian.md
```

Each commit is a node. Sessions and agents are attributable. The git-historian can trace lineage.

### Commit Boundaries for Common Work

| Work Type | Commit Boundary |
|-----------|-----------------|
| **New agent** | One commit per agent |
| **Plugin refactor** | One commit per plugin |
| **Journal entries** | One commit for batch of entries |
| **Convention update** | One commit per convention |
| **Planning document** | One commit per document |
| **Perspective reflection** | One commit per reflection |

### Handling Work-in-Progress

If work isn't complete but needs preservation:

```
[scope] wip: description

Session: {session-id}
Status: incomplete, continuing in next session

{what's done, what remains}
```

This signals to other sessions that work is in progress.

### Multi-Session Coordination

When multiple sessions work in parallel:

1. **Commit frequently** - Reduces conflict window
2. **Pull before pushing** - Integrate others' work first
3. **Respect namespace** - Stay in your lane
4. **Signal intent** - Use wip commits if claiming an area

### Commit Quality Metrics

The git-historian tracks commit quality:

| Metric | Ideal |
|--------|-------|
| **Integrity** | Follows conventions (0.8+) |
| **Contribution** | Meaningful change (0.5+) |
| **Complexity** | Focused scope (< 0.7) |

Rich commits with good messages score higher. The ecosystem learns from quality signals.

---

## Commit Plan Template

When facing many uncommitted changes:

```markdown
## Commit Plan for {date}

### Changes Overview
{list uncommitted changes by area}

### Proposed Commits (in order)

1. **[scope] action: description**
   - Files: {list}
   - Agent: {attribution}
   - Session: {id}

2. **[scope] action: description**
   ...
```

Execute commits in order, verifying each before proceeding.

---

---

## Agent ID Traceability

### The Identity Challenge

Claude Code assigns two types of IDs:

| ID Type | Format | Scope | Example |
|---------|--------|-------|---------|
| **Session ID** | Full UUID | Main conversation | `298311d7-dc9e-4d73-bbb3-323eaba7d29e` |
| **Agent ID** | Short hex | Subagent execution | `a3edb0d` |

**Key constraint**: Agents cannot introspect their own hex ID at runtime. The ID is only available after the agent completes.

### Commit Format with Agent ID

When the main session knows which agent produced work (from Task tool output), include the agent ID:

```
[agent:archivist/a3edb0d] observe: metabolic patterns

Session: 298311d7-dc9e-4d73-bbb3-323eaba7d29e
Intent: Daily ecosystem health check
```

Format: `[agent:{type}/{hex-id}]` or `[{type}:{hex-id}]`

### When to Include Agent ID

| Situation | Include ID? |
|-----------|-------------|
| Main session spawned agent, then commits | **Yes** - ID available from Task output |
| Agent commits during its own execution | **No** - Agent can't know its ID |
| Committing work from earlier session | **Optional** - Lookup in logs if needed |

### Traceability Graph

Agent transcripts are stored at:
```
~/.claude/projects/{project-hash}/agent-{hex-id}.jsonl
```

With the agent ID in the commit, you can directly access the execution trace:
```bash
# From commit message: [agent:archivist/a3edb0d]
cat ~/.claude/projects/-home-ygg-Workspace.../agent-a3edb0d.jsonl
```

### Correlation Tooling

When agent ID is not in the commit, use timestamp correlation:

```bash
# Find which agent likely made a commit
python3 .claude/tools/correlate_commits.py
```

This correlates commits with SubagentStop events within a 2-minute window.

### Integration with FalkorDB

The temporal-kg-memory infrastructure can ingest:
- SubagentStop events (with agent IDs)
- Git commits (with hashes and timestamps)
- Correlation edges linking them

Query example:
```cypher
MATCH (c:Commit)-[:LIKELY_BY]->(a:AgentExecution)
WHERE c.hash = "a3edb0d"
RETURN a.agent_id, a.agent_type
```

---

*Document Status: v1.2 - Added agent ID traceability*
*Maintained by: agent-architect, with input from all agents*
