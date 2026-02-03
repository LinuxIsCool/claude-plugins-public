# Link Patterns Sub-Skill

Wikilink conventions for journal entries, temporal hierarchy, and cross-referencing.

## Temporal Hierarchy

Journal follows a hierarchical structure where each level links to its parent:

```
[[2025]]
  └── [[2025-12]]
        └── [[2025-12-17]]
              ├── [[09-41-official-plugins-exploration]]
              ├── [[13-00-log-archaeology-and-obsidian-command]]
              └── [[17-46-statusline-elegance-and-identity]]
```

### Hierarchy Links

**Yearly → Monthly:**
```markdown
# In 2025.md
## December
- [[2025-12]] - Month summary
```

**Monthly → Daily:**
```markdown
# In 2025-12.md
## Week 3
- [[2025-12-16]] Monday
- [[2025-12-17]] Tuesday
```

**Daily → Atomic:**
```markdown
# In 2025-12-17.md
## Atomic Entries
- [[09-41-official-plugins-exploration]]
- [[13-00-log-archaeology-and-obsidian-command]]
```

**Atomic → Daily:**
```markdown
# In 13-00-log-archaeology-and-obsidian-command.md

---
*Parent: [[2025-12-17]] → [[2025-12]] → [[2025]]*
```

## Frontmatter vs Body Links

### Frontmatter Links (Metadata Only)
```yaml
---
parent_daily: [[2025-12-17]]
prev_day: [[2025-12-16]]
next_day: [[2025-12-18]]
links:
  - "[[related-topic]]"
---
```
**NOT visible in Obsidian graph** - used for structured metadata.

### Body Links (Graph Visible)
```markdown
Continued from [[2025-12-16]]. See also [[related-topic]].

---
*Parent: [[2025-12-17]] → [[2025-12]] → [[2025]]*
```
**Visible in Obsidian graph** - creates edges between nodes.

## Cross-Reference Patterns

### Session References
When one entry discusses another session:
```markdown
This builds on work from [[13-00-log-archaeology-and-obsidian-command]].
```

### Concept References
When introducing reusable concepts:
```markdown
Following the [[master-skill-pattern]], each plugin exposes one discoverable skill.
```

### Plugin References
When discussing plugin architecture:
```markdown
The [[logging]] plugin provides session tracking.
See [[journal:journal-master]] for journaling capabilities.
```

### Agent References
When mentioning agents:
```markdown
Spawned [[obsidian:graph-curator]] to analyze connectivity.
```

## Navigation Links

### Prev/Next Pattern
```markdown
<- [[2025-12-16]] | **[[2025-12]]** | [[2025-12-18]] ->
```

### Breadcrumb Footer
```markdown
---
*Parent: [[2025-12-17]] → [[2025-12]] → [[2025]]*
```

### See Also Section
```markdown
## See Also
- [[related-entry-1]]
- [[related-entry-2]]
- [[concept-page]]
```

## Link Density Guidelines

### Daily Entries (High Density)
- Link to all atomic children
- Link to prev/next days
- Link to parent monthly
- Link to mentioned concepts
- **Target: 10-30 links**

### Atomic Entries (Medium Density)
- Link to parent daily (required)
- Link to related atomics
- Link to concepts discussed
- **Target: 3-10 links**

### Concept Pages (Variable)
- Link to all entries that discuss this concept
- Link to related concepts
- **Target: Depends on concept breadth**

## Automated Link Injection

The PostToolUse hook automatically injects:

### For Daily Entries
```markdown
# Injected frontmatter
parent_monthly: [[2025-12]]
prev_day: [[2025-12-16]]
next_day: [[2025-12-18]]

# Injected footer
*Parent: [[2025-12-17]] → [[2025-12]] → [[2025]]*
```

### For Atomic Entries
```markdown
# Injected frontmatter
parent_daily: [[2025-12-17]]

# Injected footer
*Parent: [[2025-12-17]] → [[2025-12]] → [[2025]]*
```

## Anti-Patterns

### Over-Linking
❌ Don't link every noun:
```markdown
The [[function]] returns a [[string]] from the [[database]].
```

✅ Link to meaningful references:
```markdown
The parseConfig function returns configuration from the settings database.
See [[config-architecture]] for design rationale.
```

### Path Links
❌ Don't use full paths:
```markdown
[[.claude/journal/2025/12/17/2025-12-17]]
```

✅ Use simple names (Obsidian resolves them):
```markdown
[[2025-12-17]]
```

### Duplicating Frontmatter in Body
❌ Don't repeat frontmatter links unnecessarily:
```markdown
---
parent_daily: [[2025-12-17]]
---
Parent: [[2025-12-17]]  # Redundant
```

✅ Use footer pattern (different format, same info):
```markdown
---
parent_daily: [[2025-12-17]]
---
...content...

---
*Parent: [[2025-12-17]] → [[2025-12]] → [[2025]]*
```

## Special Cases

### Index Files
```markdown
# In .claude/journal/index.md
## Years
- [[2024]]
- [[2025]]

## Recent
- [[2025-12-17]] - Latest daily
```

### Monthly Summaries
```markdown
# In 2025-12.md
## Highlights
- [[2025-12-17]] - Obsidian plugin created
- [[2025-12-16]] - Major refactoring session
```

### Concept Notes
```markdown
# In master-skill-pattern.md
## Definition
One master skill per plugin with progressive disclosure.

## Examples
- [[awareness:awareness]] - 9 sub-skills
- [[journal:journal-master]] - 6 sub-skills
- [[obsidian-master]] - 6 sub-skills
```
