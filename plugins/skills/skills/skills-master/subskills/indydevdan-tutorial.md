# IndyDevDan Skill Tutorials

Key insights from IndyDevDan's YouTube tutorials on Claude Code skills.

## Sources

- **Video 1**: "I finally CRACKED Claude Agent Skills" (`kFpLzCVLA20`)
  - Duration: ~27 minutes
  - Views: 63,000+
  - Focus: Comprehensive skill breakdown

- **Video 2**: "Let's write a skill from scratch" (`X2ciJedw2vU`)
  - Focus: Hands-on skill creation

## Key Concepts from Video 1

### The Skill Ecosystem

Claude Code now has multiple extension points:
- **Agent skills** - Capabilities Claude discovers automatically
- **Sub agents** - Specialized agents for specific tasks
- **Custom slash commands** - User-invoked commands
- **Output styles** - Control response formatting
- **Plugins** - Bundled extensions
- **Hooks** - Event-driven automation
- **Memory files** - Persistent context
- **MCP servers** - External integrations

### Skills vs Commands vs Hooks

| Feature | Invocation | Use Case |
|---------|------------|----------|
| Skills | Auto (Claude) + Manual | Capabilities Claude should know |
| Commands | Manual only | User-controlled workflows |
| Hooks | Event-driven | Automation around tool use |

### The Mental Model

"Building a skill is like creating an onboarding guide for a new team member."

Skills are NOT:
- Executable plugins
- API integrations
- Slash commands (though they can be invoked as such)

Skills ARE:
- Prompt-based context modifiers
- Discoverable capabilities
- Structured knowledge packages

## Skill Development Workflow

From the tutorials:

### 1. Identify the Need
- What capability is missing?
- When should Claude use this?
- What expertise needs to be captured?

### 2. Structure the Knowledge
- Break into logical sections
- Write clear instructions
- Include concrete examples

### 3. Write the Description
The description is CRITICAL:
- Must answer: What does this do? When to use it?
- Include trigger phrases
- Use third person voice

### 4. Test Iteratively
- Does it trigger when expected?
- Does it NOT trigger when unexpected?
- Are instructions clear enough?

## Progressive Disclosure (3 Levels)

From the video explanation:

**Level 1: Metadata (Always Loaded)**
- `name` and `description` in frontmatter
- This is what Claude sees at startup
- Budget: ~15,000 characters total for all skills

**Level 2: Instructions (On Trigger)**
- Full SKILL.md content loads when Claude decides to use it
- Keep under 500 lines for efficiency

**Level 3: Resources (On Demand)**
- Additional files (references/, scripts/)
- Load only when specifically needed

## Practical Tips

### From Video Demonstrations

1. **Start Simple**
   Begin with a minimal skill, expand as needed.

2. **Test Trigger Phrases**
   Actually ask Claude questions to verify discovery.

3. **Use the Cookbook Pattern**
   Organize how-to content in `cookbook/` directory.

4. **Scripts for Determinism**
   Put deterministic operations in `scripts/`.

5. **Reference for Context**
   Put documentation in `references/`.

### Common Mistakes

1. **Vague Descriptions**
   "Helps with code" won't trigger reliably.

2. **Over-Engineering**
   Start simple, complexity comes later.

3. **Ignoring Discovery**
   If users can't find it, it doesn't exist.

4. **Wrong Voice**
   Descriptions must be third person.

## Example from Tutorials

### Transcription Skill Pattern

```yaml
---
name: transcribe
description: Transcribes audio/video files to text using Fireworks API. Use when user asks to transcribe, convert speech to text, or needs transcripts.
---

# Transcribe Skill

## Prerequisites
- Fireworks API key in environment

## Workflow
1. Validate input file exists
2. Check file format (wav, mp3, m4a)
3. Call Fireworks transcription API
4. Parse response
5. Output formatted transcript

## Examples
...
```

## Architecture Insights

### The Skill Tool

Skills live in a meta-tool in Claude's tools array:

```javascript
tools: [
  { name: "Read", ... },
  { name: "Skill",
    inputSchema: { command: string },
    description: "<available_skills>..."
  }
]
```

### Discovery Mechanism

1. At startup, Claude's system prompt includes all skill metadata
2. User makes request
3. Claude matches intent to skill descriptions
4. Claude invokes `Skill` tool with matching command
5. Full skill content loads

**Key insight**: No embeddings, no keyword matching - pure LLM reasoning.

## Community Recommendations

From video comments and discussions:

1. **Join the Discord** - Active community for skill development
2. **Study Existing Skills** - Learn from what works
3. **Iterate Based on Usage** - Real-world testing reveals issues
4. **Share Your Skills** - Community benefits from contributions

## Resources

- IndyDevDan YouTube: https://youtube.com/@IndyDevDan
- Claude Code Docs: https://code.claude.com
- BuildWithClaude: https://buildwithclaude.com
