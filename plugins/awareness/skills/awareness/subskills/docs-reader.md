---
name: docs-reader
description: Systematically read and digest Claude Code documentation. Use when learning about Claude Code features, understanding system capabilities, or building foundational knowledge. Start with basics, progress methodically, and compound understanding.
allowed-tools: Task, Read, WebFetch, WebSearch, TodoWrite
---

# Documentation Reader Skill

A systematic approach to reading and digesting Claude Code documentation.

## Core Principles

1. **Start small** - Begin with fundamentals before advanced topics
2. **Digest as you go** - Don't rush; understanding > speed
3. **Compound learning** - Each concept builds on previous
4. **Maximize coherence** - Seek connections between topics

## Learning Progression

### Level 1: Fundamentals
1. Overview and core concepts
2. CLI basics and essential commands
3. Tool inventory (14 tools)
4. Basic workflows

### Level 2: Configuration
5. Settings files hierarchy
6. CLAUDE.md memory system
7. Permissions and security
8. Environment variables

### Level 3: Extension
9. Hooks (11 event types)
10. Slash commands (built-in + custom)
11. Skills (model-invoked capabilities)
12. Plugins (packaging and distribution)

### Level 4: Advanced
13. MCP servers and integrations
14. Sub-agents and delegation
15. Extended thinking
16. Headless/programmatic usage

### Level 5: Mastery
17. Claude Agent SDK
18. Enterprise deployment
19. CI/CD integration
20. Custom agent architectures

## How to Use

When you need to learn about Claude Code:

1. **Identify the topic** - What specific capability or feature?
2. **Determine level** - Where does this fit in the progression?
3. **Use claude-code-guide** - Query the subagent for accurate info
4. **Practice immediately** - Apply what you learn
5. **Record the learning** - Note insights for future reference

## Example Queries for claude-code-guide

### Fundamentals
- "What are all the tools available in Claude Code?"
- "How does the CLI command structure work?"
- "What are the essential keyboard shortcuts?"

### Configuration
- "How does the CLAUDE.md memory hierarchy work?"
- "What settings can be configured in settings.json?"
- "How do permissions work in Claude Code?"

### Extension
- "What hook events are available and when do they trigger?"
- "How do I create a custom slash command?"
- "What's the difference between skills and commands?"

### Advanced
- "How do I create an MCP server?"
- "How do sub-agents work? What types are available?"
- "How do I use extended thinking effectively?"

## Recording Learnings

After each learning session, record:

```markdown
## Learning: [Topic]
**Date**: YYYY-MM-DD
**Level**: [1-5]
**Insight**: [Key understanding gained]
**Applied**: [How you practiced it]
**Confidence**: [0-1 scale]
```

## Anti-Patterns to Avoid

- Skipping fundamentals to reach advanced topics
- Learning without practicing
- Consuming without recording
- Moving too fast, losing coherence
- Treating documentation as exhaustive (explore beyond docs)

## Resources Beyond Docs

1. **GitHub repositories** - anthropics/claude-code, related projects
2. **Anthropic website** - claude.ai, console.anthropic.com
3. **Example projects** - Real-world implementations
4. **Community discussions** - GitHub issues, forums

## Next Skill

After mastering docs-reader, progress to:
- **guide-utilizer** - Maximize claude-code-guide effectiveness
- **techniques** - Practice specific Claude Code techniques
