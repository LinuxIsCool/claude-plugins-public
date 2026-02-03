NEVER truncate data. Truncating data in code causes silent data loss. This is a bad practice. If there is a strong case for truncation, check in with the user before doing so.

NEVER add hard-coded data to documents. Data will typically change rapidly making those documents outdated very fast.

ABSOLUTELY NO INSIPID LLM-ESSE. DO NOT EVER USE THE PHRASE: "NOT JUST X BUT Y" OR "WE ARE NOT JUST X WE ARE Y". Don't use negate statements like "It's not just X". Only use positive statements.

When writing code, produce clean, reliable, maintainable code that maximizes quality and generality while minimizing lines of code. Minimize rigidity and minimize fragility.

NEVER PRODUCE MOCK DATA. NEVER PRODUCE FAKE DATA. ONLY USE DATA FROM RELIABLE SOURCES. CHECK ALL SOURCES ALWAYS. CITE ALL SOURCES ACCESSED.

---

# Skills Over MCP Servers

**Prefer Skills and Subagents over MCP Servers.** This repository favors the Skills/Subagents pattern for Claude Code integration:

| Approach | When to Use |
|----------|-------------|
| **Skills** | Stateless operations, documentation, workflows, guidance |
| **Subagents** | Complex tasks requiring autonomy, specialized personas |
| **MCP Servers** | Only when stateful server process is absolutely required |

**Rationale**:
- Skills and agents are file-based, version-controlled, and always available
- MCP servers require running processes, can fail silently, add operational complexity
- Skills integrate directly with Claude Code's conversation context
- Agents provide persona-based interaction without external dependencies

**Migration Path**: When an MCP server exists, evaluate if its functionality can be provided through:
1. A skill that invokes CLI commands
2. A subagent that orchestrates the operation
3. Direct file operations via existing tools

See `plugins/messages/` as an example: has both MCP server (for legacy) and agents/skills (preferred).

---

# Coordination

**Git is the inter-agent coordination layer.** Agents coordinate through observable file changes.

- **Write** to your designated namespace
- **Read** from anywhere
- **Commit** with structured messages: `[scope] action: description`
- **Include agent ID** when known: `[agent:type/hexid] action: description`
- **Observe** git log for ecosystem activity

**Agent ID traceability**: After spawning a subagent, include its hex ID (from Task output) in commits to enable direct transcript lookup. 

See `.claude/conventions/coordination.md` for full patterns.

---

# Timezone

**All times displayed to the user must be in Pacific Time** (`America/Los_Angeles`).

- Store as UTC, convert on display
- Format: `Jan 14, 9:16 AM PST`

See `.claude/conventions/timezone.md` for code patterns.

---

# Ecosystem Orientation

Read `.claude/README.md` for complete context:
- Vision and philosophy
- Agent fleet
- Process registry
- Journal system
- Active vs dormant components
- Continuation points

**Quick links**:
- Current state: `.claude/journal/` (latest daily entry)
- Agent fleet: `.claude/registry/agents.md`
- Processes: `.claude/registry/processes.md`
- Strategic context: `.claude/briefings/`

---

# Journal Entries

Before creating journal entries, **read the journal-writer subskill**:
`plugins/journal/skills/journal-master/subskills/journal-writer.md`

**Critical rules**:

| Field | Rule |
|-------|------|
| `created` | Actual file creation time (NOW). Use timestamp from transcript or `date` command. NEVER fabricate. |
| `references_date` | Add this field when documenting past events. The `created` field is still NOW. |
| `parent_daily` | Must match the folder date: file in `2025/12/16/` → `parent_daily: [[2025-12-16]]` |

**Body footer REQUIRED** for graph connectivity:
```markdown
---

*Parent: [[YYYY-MM-DD]] → [[YYYY-MM]] → [[YYYY]]*
```

Frontmatter wikilinks are metadata only—graph visualizers (Quartz, Obsidian) only crawl links in the body.

---

# Plugin Architecture

## Master Skill Pattern

Claude Code has a ~15,000 character budget for skill descriptions. To prevent truncation ("Showing X of Y skills"), use **progressive disclosure**:

- **One master skill per plugin**: Each plugin exposes ONE discoverable SKILL.md
- **Sub-skills via Read tool**: Master skill contains an index; sub-skills are loaded on-demand from `subskills/` directory
- **Description lists sub-skills**: Master skill description enumerates available sub-skills for discoverability

### Directory Structure
```
plugins/{plugin-name}/skills/
└── {skill-name}/
    ├── SKILL.md           # Master skill (discoverable)
    └── subskills/         # Sub-skills (loaded via Read)
        ├── sub1.md
        ├── sub2.md
        └── ...
```

### Master SKILL.md Template
```markdown
---
name: {plugin-name}
description: Master skill for [purpose]. Sub-skills (N): name1, name2, name3. Invoke for [use cases].
allowed-tools: Read, Skill, Task, Glob, Grep
---

# {Plugin Name} - Master Skill

## Sub-Skills Index

| Sub-Skill | Use When | File |
|-----------|----------|------|
| **name1** | [trigger condition] | `subskills/name1.md` |
```

## Plugin Development Workflow

```
Edit Source → Validate → Clear Cache → Restart Claude Code
```

### Cache Location
```
~/.claude/plugins/cache/{marketplace-name}/{plugin-name}/
```

### Clear Cache
```bash
rm -rf ~/.claude/plugins/cache/{marketplace-name}/{plugin-name}/
```

Use the `awareness:plugin-developer` sub-skill for detailed development guidance.

## Plugin Agents Pattern

Plugins can define **subagents** that become available via the Task tool with namespaced identifiers.

### Directory Structure
```
plugins/{plugin-name}/
├── .claude-plugin/
│   └── plugin.json        # Include "agents": ["./agents/"]
├── skills/                # Skills (via Skill tool)
├── commands/              # Slash commands
└── agents/                # Subagents (via Task tool)
    └── {agent-name}.md
```

### Agent Definition Schema
```markdown
---
name: {agent-name}
description: {what the agent does - appears in Task tool}
tools: {comma-separated tool list}
model: {sonnet|opus|haiku}
---

# Agent identity and prompt content...
```

### Namespacing Convention

| Source | Subagent Type |
|--------|---------------|
| `.claude/agents/archivist.md` | `archivist` |
| `plugins/awareness/agents/mentor.md` | `awareness:mentor` |
| `plugins/journal/agents/scribe.md` | `journal:scribe` |

### plugin.json Extension
```json
{
  "name": "awareness",
  "skills": ["./skills/"],
  "commands": ["./commands/"],
  "agents": ["./agents/mentor.md"]
}
```

**Note**: Unlike `skills` and `commands`, the `agents` field requires specific `.md` file paths, not directories.

### Current Status

**Both project-level and plugin-level agents are natively supported by Claude Code.**

- Project agents: `.claude/agents/*.md` → subagent_type: `{name}`
- Plugin agents: Listed in `plugin.json` `agents` field → subagent_type: `{plugin}:{name}`

The aggregation script (`scripts/aggregate-plugin-agents.sh`) is optional - useful for copying plugin agents to project level if needed.

## Plugin Data Storage Paths

**CRITICAL**: Never use relative paths like `.claude/messages/` for data storage. These resolve based on the current working directory, causing **data fragmentation** when plugins are run from different directories.

### The Problem

```typescript
// BAD - Creates separate databases depending on where you run from
const DEFAULT_DB_PATH = ".claude/messages/search/index.db";

// Running from /repo/plugins/messages/ → /repo/plugins/messages/.claude/messages/
// Running from /repo/ → /repo/.claude/messages/
// Result: TWO separate databases with different data!
```

### The Solution

Use `lib/paths.ts` to anchor all data paths to the **git repository root**:

```typescript
import { getClaudePath } from "../../lib/paths";

// GOOD - Always resolves to /repo/.claude/messages/search/index.db
const dbPath = getClaudePath("messages/search/index.db");
```

### Available Functions

| Function | Returns | Example |
|----------|---------|---------|
| `getRepoRoot()` | Git repo root | `/home/user/claude-plugins` |
| `getClaudePath(subpath)` | Path in `.claude/` | `getClaudePath("messages")` → `/repo/.claude/messages` |
| `getRepoPath(subpath)` | Path in repo | `getRepoPath("plugins/x")` → `/repo/plugins/x` |

### Implementation Pattern

```typescript
// In your module's config or index file
import { getClaudePath } from "../../lib/paths";

export function getSearchDbPath(): string {
  return getClaudePath("messages/search/index.db");
}

export function getMessagesBasePath(): string {
  return getClaudePath("messages");
}

// Then use these functions instead of hardcoded paths
class MyStore {
  constructor(dbPath?: string) {
    const resolvedPath = dbPath ?? getSearchDbPath();
    // ...
  }
}
```

### Quick Check

If you see any of these patterns, fix them:
- `".claude/..."` without `getClaudePath()`
- `DEFAULT_PATH = ".claude/..."`
- Relative paths in database/file storage code
