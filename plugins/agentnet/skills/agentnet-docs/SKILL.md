---
name: agentnet-docs
description: Documentation skill for AgentNet foundational technologies (5 sub-skills). Covers: Bun runtime, gray-matter YAML parsing, neo-neo-bblessed TUI library, terminal UI patterns, Zod validation. Invoke for runtime docs, frontmatter parsing, terminal interfaces, or schema validation.
allowed-tools: Read, Glob, Grep
---

# AgentNet Documentation - Master Skill

Reference documentation for the foundational technologies used in AgentNet development.

## Sub-Skills Index

| Sub-Skill | Use When | File |
|-----------|----------|------|
| **bun-runtime** | Runtime APIs, TypeScript execution, package management, testing | `subskills/bun-runtime.md` |
| **gray-matter** | YAML frontmatter parsing, markdown files with metadata | `subskills/gray-matter.md` |
| **neo-neo-bblessed** | Terminal UI widgets, screen management, keyboard events | `subskills/neo-neo-bblessed.md` |
| **tui-patterns** | TUI architecture, navigation patterns, accessibility | `subskills/tui-patterns.md` |
| **zod-validation** | Schema definitions, runtime validation, type inference | `subskills/zod-validation.md` |

## Quick Reference

### Bun Runtime
- Native TypeScript execution without transpilation
- Built-in test runner: `bun test`
- Package management: `bun install`, `bun add`
- TSConfig path mappings respected natively

### Gray-Matter
- Parse YAML frontmatter from markdown files
- Returns `{ data, content, excerpt }` object
- Supports custom delimiters and parsers

### neo-neo-bblessed
- Screen, Box, List, Textarea widgets
- `keyable: true` required for keyboard event propagation
- vi mode navigation with `keys: true, vi: true`
- Mouse and scrolling support

### TUI Patterns
- Painter's algorithm for efficient rendering
- Model-View-Update architecture
- Return-based navigation over callbacks
- Focus management and keyboard-first design

### Zod Validation
- TypeScript-first schema validation
- `z.infer<typeof schema>` for type inference
- Composable schemas with `.extend()`, `.merge()`
- Detailed error reporting with `.safeParse()`

## Usage

Read the full sub-skill documentation when working on:

```typescript
// Bun runtime questions
Read("subskills/bun-runtime.md")

// Frontmatter parsing
Read("subskills/gray-matter.md")

// TUI development
Read("subskills/neo-neo-bblessed.md")
Read("subskills/tui-patterns.md")

// Schema validation
Read("subskills/zod-validation.md")
```

## Related Skills

- **agentnet-master**: Core AgentNet APIs (profiles, posts, messages, TUI, hooks)
- **commander-cli**: CLI framework documentation (in agentnet-master/subskills/)
