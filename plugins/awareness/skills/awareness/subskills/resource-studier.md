---
name: resource-studier
description: Study resources and reference materials in this repository. Use when exploring examples, understanding patterns, learning from documentation, or surveying what reference materials are available. Covers the resources/ directory and any supporting documentation.
allowed-tools: Read, Glob, Grep
---

# Resource Studier

A skill for exploring and learning from reference materials in the repository.

## Resources Directory Structure

```
resources/
├── Backlog.md/              # Task management system reference
├── claude-code-hooks-mastery/
│   └── ...                  # Hook documentation and examples
└── claude-code-hooks-multi-agent-observability/
    └── ...                  # Multi-agent patterns
```

## Study Approach

### Phase 1: Survey
Understand what resources exist:

```
1. List all directories in resources/
2. Read any README or index files
3. Catalog what topics are covered
4. Note file types and organization
```

### Phase 2: Targeted Reading
Based on current learning goals:

```
1. Identify relevant resource(s)
2. Read introductory/overview content
3. Study examples and code samples
4. Note key patterns and techniques
```

### Phase 3: Application
Connect resources to practice:

```
1. How does this apply to current work?
2. What can I try based on this resource?
3. What questions does this raise?
```

## Resource Categories

### Documentation
- README files
- Guides and tutorials
- API references
- Architecture docs

### Examples
- Code samples
- Configuration templates
- Hook implementations
- Command definitions

### Patterns
- Architectural patterns
- Integration patterns
- Best practices
- Anti-patterns to avoid

### References
- External links
- Related projects
- Standards and specs

## Studying a Resource: Template

```markdown
## Resource Study: [Name]

**Date**: YYYY-MM-DD
**Path**: resources/[path]

### Purpose
What is this resource about?

### Key Contents
- File/Section 1: [summary]
- File/Section 2: [summary]

### Main Takeaways
1. [Key insight]
2. [Key insight]

### Applicable To
How can I use this?

### Follow-up
What should I explore next?
```

## Cross-Resource Analysis

When patterns appear across resources:

| Pattern | Source 1 | Source 2 | Notes |
|---------|----------|----------|-------|
| [Pattern] | [Where found] | [Where found] | [Consistency?] |

## Resource Discovery Commands

### List all resources
```bash
ls -la resources/
```

### Find markdown files
```bash
find resources/ -name "*.md"
```

### Search for topic
```bash
grep -r "topic" resources/
```

### Count files by type
```bash
find resources/ -type f | sed 's/.*\.//' | sort | uniq -c
```

## Hooks Mastery Resource

The `claude-code-hooks-mastery/` resource is particularly valuable for:
- Understanding all hook events
- Seeing implementation examples
- Learning hook patterns
- Debugging hook issues

### Key Files to Study
- Hook event reference
- Example implementations
- Common patterns
- Troubleshooting guide

## Multi-Agent Observability Resource

The `claude-code-hooks-multi-agent-observability/` resource covers:
- Observing sub-agent behavior
- Logging multi-agent interactions
- Debugging agent chains
- Performance monitoring

### Key Patterns
- How to trace agent execution
- Correlating parent/child agents
- Aggregating agent results

## Integration with Other Skills

- **docs-reader**: Use resources to supplement official docs
- **plugin-studier**: Resources may contain plugin examples
- **techniques**: Practice techniques shown in resources

## Recording Resource Learnings

After studying resources, record:

1. **What was the resource?** (path, purpose)
2. **What did you learn?** (key insights)
3. **How is it relevant?** (application)
4. **What's next?** (follow-up actions)

## Best Practices

1. **Survey before diving deep** - Know what exists
2. **Connect to goals** - Study what's relevant now
3. **Take notes** - Record learnings
4. **Practice immediately** - Apply what you learn
5. **Cross-reference** - Link to other resources/docs
