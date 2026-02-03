---
name: awareness
description: Master skill for Claude Code self-improvement and learning. Sub-skills (10): docs-reader, guide-utilizer, techniques, skill-creator, plugin-studier, plugin-developer, resource-studier, agent-creator, temporal-kg-memory, claudemd-management. Invoke for documentation learning, Claude Code mastery, creating/testing plugins, building memory systems, or managing CLAUDE.md evolution.
allowed-tools: Read, Skill, Task, Glob, Grep, Bash
---

# Awareness Plugin - Master Skill

Self-improvement and learning capabilities for Claude Code.

## Sub-Skills Index

| Sub-Skill | Use When | File |
|-----------|----------|------|
| **docs-reader** | Learning Claude Code features, understanding capabilities, building foundational knowledge | `subskills/docs-reader.md` |
| **guide-utilizer** | Need authoritative answers about Claude Code from claude-code-guide subagent | `subskills/guide-utilizer.md` |
| **techniques** | Practicing Claude Code techniques, developing mastery through experimentation | `subskills/techniques.md` |
| **skill-creator** | Creating new skills, packaging knowledge, extending capabilities | `subskills/skill-creator.md` |
| **plugin-studier** | Understanding plugin architecture, learning from existing implementations | `subskills/plugin-studier.md` |
| **plugin-developer** | Hot-reload plugins, clear cache, validate changes, development cycle | `subskills/plugin-developer.md` |
| **resource-studier** | Exploring reference materials, understanding patterns from resources/ | `subskills/resource-studier.md` |
| **agent-creator** | Creating custom agents/sub-agents with specific tools and prompts | `subskills/agent-creator.md` |
| **temporal-kg-memory** | Building knowledge graphs from conversation logs, agent memory systems | `subskills/temporal-kg-memory.md` |
| **claudemd-management** | Managing CLAUDE.md evolution: validation, versioning, A/B experiments, metrics | `subskills/claudemd-management.md` |

## How to Use

### Quick Reference
For brief guidance, use the index above to identify the right sub-skill.

### Deep Dive
To load full sub-skill content:
```
Read the sub-skill file: plugins/awareness/skills/awareness/subskills/{name}.md
```

### Learning Progression
```
docs-reader → guide-utilizer → techniques → skill-creator → plugin-developer
                                    ↓                              ↓
                              plugin-studier              (test & iterate)
                                    ↓
                              agent-creator
                                    ↓
                          temporal-kg-memory (advanced)
```

## Sub-Skill Summaries

### docs-reader
Systematic approach to Claude Code documentation. Five learning levels:
1. Fundamentals (CLI, tools, workflows)
2. Configuration (settings, CLAUDE.md, permissions)
3. Extension (hooks, commands, skills, plugins)
4. Advanced (MCP servers, sub-agents, extended thinking)
5. Mastery (Agent SDK, enterprise, CI/CD)

### guide-utilizer
Maximize effectiveness of the `claude-code-guide` subagent. Techniques for:
- Formulating precise queries
- Interpreting responses
- Combining with documentation reading

### techniques
Hands-on practice for mastering Claude Code patterns:
- Tool mastery (Read, Edit, Bash, Grep/Glob)
- Sub-agent patterns (Explore, General-purpose, Custom)
- Extended thinking triggers and depth control
- Memory & context (CLAUDE.md, settings hierarchy)
- Hooks (event-driven automation)
- Skills & commands creation

### skill-creator
Meta-skill for creating new skills:
- SKILL.md format and structure
- Description writing for auto-discovery
- Tool selection best practices
- Testing and validation

### plugin-studier
Understanding Claude Code plugin architecture:
- plugin.json structure
- Hooks, commands, skills integration
- MCP server patterns
- Learning from existing plugins

### plugin-developer
Development cycle for plugins:
- Clear plugin cache (`~/.claude/plugins/cache/`)
- Validate plugin structure and SKILL.md format
- Hot-reload workflow: edit → validate → clear cache → restart
- Master skill pattern for large plugins
- Testing skill discovery and invocation

### resource-studier
Exploring reference materials in resources/:
- Agent frameworks (crewai, langchain, etc.)
- Embeddings (graphiti, pgvector, etc.)
- Example implementations

### agent-creator
Creating custom agents and sub-agents:
- Agent file format
- Model selection (opus, sonnet, haiku)
- Tool restrictions
- System prompts

### temporal-kg-memory
Building knowledge graphs from conversation history:
- FalkorDB + Graphiti integration
- Log event parsing and ingestion
- Three modes: Direct FalkorDB, Ollama (local), Cloud API
- Temporal queries and session analysis

### claudemd-management
Managing CLAUDE.md evolution:
- Validation (word count, references, patterns, enforcement)
- Version control (snapshots with metadata)
- A/B experiments (hypothesis testing, session correlation)
- Metrics extraction (tool usage, agent invocations, errors)
- Workspace: `.claude/claudemd/`
