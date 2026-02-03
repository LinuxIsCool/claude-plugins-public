---
description: Rename the current tmux window to reflect agent identity
argument-hint: "[name|reset]"
---

# Rename Window Command

Rename the current tmux window to show agent identity. Makes it easy to distinguish multiple Claude instances at a glance.

## Arguments

- No argument: Use registered agent name and process number (e.g., "Sigil:C124")
- `<name>`: Use custom name (e.g., "MyAgent")
- `reset`: Restore automatic window naming (tmux takes over)

## Workflow

### Step 1: Get Current Identity

First, retrieve this session's identity from the registry:

```bash
# Get session info
SESSION_ID="$SESSION_ID"
REGISTRY=".claude/instances/registry.json"

# Extract name and process number
INFO=$(jq -r --arg sid "$SESSION_ID" '.[$sid] | "\(.name // "Claude")|\(.process_number // "?")"' "$REGISTRY" 2>/dev/null)
NAME=$(echo "$INFO" | cut -d'|' -f1)
PROCESS_NUM=$(echo "$INFO" | cut -d'|' -f2)
```

### Step 2: Determine Window Name

If an argument was provided, use it. Otherwise use the format `Name:CXXX`:

- With argument "Spark": Window name = "Spark"
- Without argument: Window name = "Sigil:C124" (from registry)

### Step 3: Handle Reset or Rename

**If argument is "reset":**

```bash
# Re-enable automatic window naming
tmux set-window-option automatic-rename on

# Tmux will automatically update the window name to the running command
```

Output:
```markdown
Window automatic-rename **enabled**

(tmux will now manage the window name)
```

**Otherwise (rename):**

```bash
# Rename the current tmux window
tmux rename-window "WINDOW_NAME"

# Disable automatic-rename so the name sticks
# (This only affects this window, not globally)
tmux set-window-option automatic-rename off
```

### Step 4: Confirm

Report the new window name to the user.

## Output Format

```markdown
Window renamed to **Sigil:C124**

(automatic-rename disabled for this window)
```

## Example Usage

```bash
# Use registered identity
/statusline:rename

# Use custom name
/statusline:rename Spark

# Restore automatic naming (let tmux manage it)
/statusline:rename reset
```

## Notes

- Requires tmux (no-op if not in tmux session)
- Disables `automatic-rename` for this window only, not globally
- The name persists until the window is closed or manually renamed
- Run this after naming yourself to make the window match your identity

## See Also

- `/statusline:instances` - List all Claude instances
- Self-namer skill - How Claude chooses its name
