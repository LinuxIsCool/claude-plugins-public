# Awareness Plugin

A self-awareness and learning plugin for Claude Code that enables systematic documentation reading, guide utilization, and technique mastery.

## Philosophy

> *Seek first to understand before seeking to be understood.*

This plugin embodies:
- **Self-reflection** - Examine decisions and patterns
- **Anti-fragility** - Grow stronger from challenges
- **Curiosity** - Active exploration, question assumptions
- **Self-improvement** - Compound learnings over time

## Master Skill: `awareness`

A single discoverable skill with 9 sub-skills loaded on-demand.

### Sub-Skills

| Sub-Skill | Purpose |
|-----------|---------|
| **docs-reader** | Systematic Claude Code documentation reading |
| **guide-utilizer** | Effective use of claude-code-guide subagent |
| **techniques** | Claude Code technique mastery through experimentation |
| **skill-creator** | Creating new skills and extending capabilities |
| **plugin-studier** | Understanding plugin architecture |
| **plugin-developer** | Hot-reload plugins, cache management, development cycle |
| **resource-studier** | Exploring reference materials in resources/ |
| **agent-creator** | Creating custom agents and sub-agents |
| **temporal-kg-memory** | Building knowledge graphs from conversation logs |

## Core Principles

1. **Start small** - Begin with fundamentals, smallest experiments
2. **Digest as you go** - Understanding > speed
3. **Compound learning** - Each concept builds on previous
4. **Maximize coherence** - Seek connections between topics
5. **Test incrementally** - Never build too far ahead of verification

## Installation

```bash
# Navigate to your Claude Code workspace
cd /path/to/your/project

# Install the awareness plugin
/plugin install awareness@linuxiscool-claude-plugins
```

Or add to marketplace.json:

```json
{
  "plugins": [
    {"name": "awareness", "source": "./plugins/awareness/"}
  ]
}
```

## Usage

The skills are model-invoked, meaning Claude will automatically use them when the context matches. You can also explicitly request them:

```markdown
# Trigger docs-reader
Help me learn about Claude Code hooks systematically

# Trigger guide-utilizer
I need authoritative information about MCP server configuration

# Trigger techniques
Let's practice the Edit tool technique
```

## Directory Structure

```
awareness/
├── .claude-plugin/
│   └── plugin.json              # Plugin manifest
├── skills/
│   └── awareness/               # Master skill (discoverable)
│       ├── SKILL.md             # Master skill definition
│       └── subskills/           # Sub-skills (loaded via Read)
│           ├── docs-reader.md
│           ├── guide-utilizer.md
│           ├── techniques.md
│           ├── skill-creator.md
│           ├── plugin-studier.md
│           ├── plugin-developer.md
│           ├── resource-studier.md
│           ├── agent-creator.md
│           └── temporal-kg-memory.md
├── commands/
│   └── learn.md                 # /learn command
└── README.md
```

## Roadmap

- [ ] Add `/reflect` command for session reflection
- [ ] Add hooks for automatic learning capture
- [ ] Add memory persistence for learnings/patterns
- [ ] Add `/awareness-status` dashboard command

## Version History

- **0.1.0** - Initial release with three core skills

## License

MIT
