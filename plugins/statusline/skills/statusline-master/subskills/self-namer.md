# Self-Namer Sub-Skill

Help Claude instances name themselves based on their task.

## When to Self-Name

**DO name yourself when:**
- User states a clear task: "Help me debug the auth system" → name yourself `Debugger`
- Beginning substantive work after understanding the goal
- Task changes significantly from original focus
- User explicitly asks you to name yourself

**DON'T name yourself when:**
- Just answering a quick question
- Task is still unclear or exploratory
- Already have a descriptive name that fits
- Session will be very short

**Timing:** Name yourself after your first substantive response, once you understand what you'll be working on. Don't rush - a generic name is fine until the task crystallizes.

## How to Self-Name

```bash
python3 plugins/statusline/tools/registry.py register \
  "$SESSION_ID" "YourName" \
  --task "Brief task description"
```

The `$SESSION_ID` environment variable is set by the SessionStart hook.

## Naming Algorithm

### Step 1: Analyze Task

Consider the primary activity:
- What has the user asked for?
- What will I spend most time doing?
- What distinguishes this session from others?

### Step 2: Choose Category

Map task to naming category:

| Task Involves | Category | Example Names |
|---------------|----------|---------------|
| Searching, browsing, discovery | Explorer | Explorer, Scout, Cartographer |
| Reading code, reviewing | Reviewer | Reviewer, Auditor, Inspector |
| Writing documentation | Writer | Scribe, Documenter, Writer |
| Finding and fixing bugs | Debugger | Debugger, Detective, Fixer |
| Designing systems | Architect | Architect, Designer, Planner |
| Running tests | Tester | Tester, Validator, QA |
| Cleaning up code | Refactorer | Refactorer, Cleaner, Optimizer |
| Building features | Builder | Builder, Implementer, Creator |
| Learning, researching | Researcher | Researcher, Scholar, Learner |
| Planning, strategizing | Strategist | Strategist, Planner, Coordinator |

### Step 3: Check Uniqueness

```bash
# Get active instance names
python3 plugins/statusline/tools/registry.py list --active --json | jq -r '.[].name'
```

If name is taken, add qualifier:
- Explorer → Explorer-2
- Debugger → AuthDebugger (task-specific)

### Step 4: Register

```bash
python3 plugins/statusline/tools/registry.py register \
  "$SESSION_ID" "<chosen-name>" \
  --task "<task-description>" \
  --model "claude-opus-4-5" \
  --cwd "$(pwd)"
```

## Examples

### Example 1: Environmental Exploration

User: "Explore the environment and understand what's available"

Analysis:
- Primary activity: Discovery, mapping
- Category: Explorer
- Name: **Explorer**

### Example 2: Bug Fix

User: "Fix the login bug where users can't authenticate"

Analysis:
- Primary activity: Debugging, investigating
- Category: Debugger
- Name: **Debugger** or **AuthDebugger**

### Example 3: Documentation Update

User: "Update the API documentation to reflect new endpoints"

Analysis:
- Primary activity: Writing documentation
- Category: Writer
- Name: **Scribe** or **DocWriter**

### Example 4: Multiple Similar Tasks

If "Debugger" is taken:
- AuthDebugger (specific)
- Debugger-2 (numbered)
- Detective (synonym)

## Self-Introduction

When named, can introduce self:

> I'm **Explorer**, focused on environmental exploration and discovery.
> Session: 117ec3ac | Working in: /exploration

## Updating Name

If task changes significantly:

```bash
python3 plugins/statusline/tools/registry.py register \
  "$SESSION_ID" "NewName" \
  --task "New task description"
```

## Tips

- Name should be memorable and descriptive
- Avoid generic names like "Claude" or "Assistant"
- Consider what would appear in git blame
- Name should make sense in a multi-agent context
