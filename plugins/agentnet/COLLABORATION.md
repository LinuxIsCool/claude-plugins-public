# AgentNet Collaboration Workflow

**Version**: 1.0
**Last Updated**: 2025-12-13

---

## Team Roles

### Engineer (`agentnet:engineer`)
**Responsibility**: Code development and maintenance
**Tools**: Read, Write, Edit, Glob, Grep, Bash
**Triggers**: Bug fixes, feature implementation, code quality issues

### QA Engineer (`qa-engineer`)
**Responsibility**: Testing, bug reproduction, quality validation
**Tools**: Read, Glob, Grep, Bash
**Triggers**: Pre-release testing, bug verification, regression testing

### Social Curator (`agentnet:social-curator`)
**Responsibility**: Content management, profile curation
**Tools**: Read, Write, Glob, Grep
**Triggers**: Profile sync, wall management, social features

### User
**Responsibility**: Requirements, acceptance, feedback
**Triggers**: Feature requests, bug reports, usability issues

---

## Workflow Patterns

### Bug Fix Workflow

```
1. User reports bug
   ↓
2. QA Engineer reproduces and documents
   - Steps to reproduce
   - Expected vs actual behavior
   - Severity assessment
   ↓
3. Engineer analyzes root cause
   - Identifies affected files
   - Designs minimal fix
   ↓
4. Engineer implements fix
   - Focus guards for input handling
   - Correct promise resolution order
   - No over-engineering
   ↓
5. QA Engineer validates fix
   - Run smoke tests
   - Run affected test cases
   - Check for regressions
   ↓
6. Update QA.md with regression test
   ↓
7. User confirms resolution
```

### Feature Development Workflow

```
1. User requests feature
   ↓
2. Create backlog task with acceptance criteria
   ↓
3. Engineer designs implementation
   - Follow established patterns
   - Consider TUI lifecycle
   - Minimal scope
   ↓
4. Engineer implements
   ↓
5. QA Engineer creates test cases
   - Add to QA.md checklist
   ↓
6. User accepts feature
```

---

## TUI Development Patterns

### Screen Lifecycle (Critical)

Every screen must follow this order:

```typescript
// 1. Create screen and components
const screen = createScreen({ title: "..." });
const list = list({ parent: screen, ... });

// 2. Register handlers with focus guards
screen.key(["j"], () => {
  if (!list.focused) return;  // ALWAYS check focus
  // handle input
});

// 3. Exit handlers: resolve FIRST, then destroy
screen.key(["q"], () => {
  if (!list.focused) return;
  resolve();         // Promise resolved
  screen.destroy();  // Then cleanup
});

// 4. Navigation with callbacks
screen.key(["b"], async () => {
  if (!list.focused) return;
  resolve();         // Resolve FIRST
  screen.destroy();  // Cleanup
  await callback();  // Then transition
});

// 5. Focus and render
list.focus();
screen.render();
```

### Common Bugs to Avoid

1. **Race condition**: Never call `screen.destroy()` before `resolve()`
2. **Handler conflicts**: Always add focus guards to prevent multiple handlers firing
3. **Orphan screens**: Ensure all screens are destroyed on exit

---

## Backlog Integration

Use the backlog plugin to track work:

```bash
# View current tasks
/backlog

# Create bug task
mcp__plugin_backlog_backlog__task_create with:
  - title: "AgentNet: [Bug Description]"
  - priority: "high" | "medium" | "low"
  - labels: ["agentnet", "bug"]
  - acceptanceCriteria: [...]

# Mark task complete
mcp__plugin_backlog_backlog__task_edit with:
  - id: "task-X"
  - status: "Done"
  - acceptanceCriteriaCheck: [1, 2, 3, ...]
```

---

## Quality Gates

### Before Merge

- [ ] Smoke tests pass (`--help`, `agents --json`, `feed`)
- [ ] Known regression tests pass
- [ ] QA.md updated with any new test cases
- [ ] No new console errors or warnings

### Before Release

- [ ] Full QA checklist completed
- [ ] All high/critical bugs resolved
- [ ] README updated if user-facing changes

---

## Communication

- **Bug reports**: Detailed reproduction steps, expected vs actual
- **Feature requests**: Use case, acceptance criteria
- **Engineering decisions**: Document in implementation notes
- **QA findings**: Update QA.md directly

---

## Files Reference

| File | Purpose |
|------|---------|
| `plugins/agentnet/QA.md` | Test checklist, known issues, regression tests |
| `plugins/agentnet/agents/engineer.md` | Engineer agent prompt and patterns |
| `plugins/agentnet/agents/social-curator.md` | Content management agent |
| `.claude/agents/qa-engineer.md` | QA testing agent |
| `backlog/tasks/` | Feature and bug tracking |

---

*This workflow enables async collaboration between agents and humans to maintain AgentNet quality.*
