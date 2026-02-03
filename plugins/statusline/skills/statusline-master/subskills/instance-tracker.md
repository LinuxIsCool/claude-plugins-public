# Instance Tracker Sub-Skill

Track and coordinate with other Claude instances.

## When to Use

- Checking what other instances are working on
- Avoiding duplicate work
- Coordinating multi-instance tasks
- Understanding session history

## Tracking Operations

### List Active Instances

```bash
python3 plugins/statusline/tools/registry.py list --active
```

Output:
```
ID           Name            Status     Task
------------ --------------- ---------- --------------------------------
117ec3ac     Explorer        active     Environmental exploration
a1b2c3d4     Debugger        active     Fixing auth bug
```

### Get Instance Details

```bash
python3 plugins/statusline/tools/registry.py get <session_id_prefix>
```

### Find by Name

```python
from statusline.tools.registry import find_by_name

result = find_by_name("Explorer")
if result:
    session_id, data = result
    print(f"Found: {session_id}")
```

### Check for Conflicts

Before starting work, check if another instance is working on the same area:

```bash
# Check active instances
python3 plugins/statusline/tools/registry.py list --active --json | \
  jq -r '.[] | "\(.name): \(.task)"'
```

## Coordination Patterns

### Parallel Work

When multiple instances work simultaneously:

1. Each names themselves distinctly
2. Each registers their task
3. Check for overlap before starting
4. Avoid modifying same files

### Handoff

When one instance hands off to another:

1. First instance documents state in journal
2. First instance marks self inactive
3. Second instance reads journal entry
4. Second instance continues with context

### Collaboration

When instances need to share information:

1. Use shared storage (`.claude/instances/messages/`)
2. Write to journal for async communication
3. Check registry for current state

## Registry Management

### Mark Inactive

When done with a session:

```python
from statusline.tools.registry import mark_inactive

mark_inactive("session_id_here")
```

### Cleanup Stale

Remove instances not seen in 24 hours:

```python
from statusline.tools.registry import cleanup_stale

cleanup_stale(hours=24)
```

### Update Last Seen

Keep presence fresh (usually automatic via statusline):

```python
from statusline.tools.registry import update_last_seen

update_last_seen("session_id_here")
```

## Integration with Other Systems

### Linking to Git

When making commits, add session info:

```bash
git commit -m "feat: Add feature

Session-Id: $SESSION_ID
Instance-Name: $INSTANCE_NAME"
```

### Linking to Journal

Include in journal entries:

```yaml
---
session_id: 117ec3ac
instance_name: Explorer
---
```

### Linking to Logs

Logs are automatically named with session ID by Claude Code.

## Query Examples

### Who Was Working on Feature X?

```bash
# Search journal for mentions
grep -r "feature-x" .claude/journal/

# Check git history
git log --grep="feature-x" --format="%H %s"

# Look up session from commit
git log -1 --format="%b" <commit> | grep "Session-Id"
```

### What Did Instance X Work On?

```bash
# Get instance details
python3 plugins/statusline/tools/registry.py get <session_id>

# Find journal entries
grep -rl "session_id: <session_id>" .claude/journal/

# Find commits
git log --grep="Session-Id: <session_id>"
```

## Tips

- Check other instances before starting similar work
- Use unique names to enable easy searching
- Document handoffs in journal
- Keep task descriptions up to date
