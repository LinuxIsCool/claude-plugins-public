# Contributing to Claude Code Plugin Marketplace

## Adding a Plugin

### Plugin Structure

Each plugin follows this directory structure:

```
plugins/{plugin-name}/
├── .claude-plugin/
│   └── plugin.json        # Plugin manifest
├── skills/                # Skills (invoked via Skill tool)
│   └── {skill-name}/
│       ├── SKILL.md       # Master skill (discoverable)
│       └── subskills/     # Sub-skills (loaded on-demand via Read)
│           ├── sub1.md
│           └── sub2.md
├── commands/              # Slash commands
│   └── {command-name}.md
├── agents/                # Subagents (invoked via Task tool)
│   └── {agent-name}.md
└── hooks/                 # Lifecycle hooks (optional)
    └── {hook-name}.md
```

### Plugin Manifest (plugin.json)

```json
{
  "name": "your-plugin",
  "description": "What this plugin does",
  "version": "0.1.0",
  "skills": ["./skills/"],
  "commands": ["./commands/"],
  "agents": ["./agents/agent-name.md"]
}
```

**Note**: The `skills` and `commands` fields accept directories, but `agents` requires specific `.md` file paths.

### Master Skill Pattern

To stay within Claude Code's ~15,000 character skill description budget, use **progressive disclosure**:

- **One master skill per plugin** — the discoverable entry point
- **Sub-skills loaded on-demand** — via the Read tool from `subskills/` directory
- **Description lists sub-skills** — so they're discoverable even though not directly loaded

```markdown
---
name: {plugin-name}
description: Master skill for [purpose]. Sub-skills (N): name1, name2. Invoke for [use cases].
allowed-tools: Read, Skill, Task, Glob, Grep
---

# {Plugin Name} - Master Skill

## Sub-Skills Index

| Sub-Skill | Use When | File |
|-----------|----------|------|
| **name1** | [trigger condition] | `subskills/name1.md` |
```

### Agent Definition

Agents provide persona-based subagents invoked via the Task tool:

```markdown
---
name: {agent-name}
description: {what the agent does - appears in Task tool listing}
tools: {comma-separated tool list}
model: {sonnet|opus|haiku}
---

# Agent identity and system prompt content...
```

## Development Workflow

```
Edit Source → Validate JSON → Clear Plugin Cache → Restart Claude Code
```

### Clear Plugin Cache

```bash
rm -rf ~/.claude/plugins/cache/{marketplace-name}/{plugin-name}/
```

## Code Quality

- Produce clean, reliable, maintainable code
- Minimize rigidity and fragility
- Prefer Skills and Subagents over MCP Servers
- Use `lib/paths.ts` for data storage paths (anchor to git root, avoid relative paths)

## Coordination

- **Commit messages**: `[scope] action: description`
- **Agent commits**: `[agent:type/hexid] action: description`
- **Git is the coordination layer** — agents coordinate through observable file changes

## Submitting

1. Fork this repository
2. Create a feature branch
3. Add your plugin following the structure above
4. Ensure `plugin.json` is valid JSON
5. Submit a pull request with a description of what your plugin does
