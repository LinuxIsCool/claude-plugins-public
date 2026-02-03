---
description: Install the statusline plugin - configures settings, hooks, and symlinks
argument-hint: "[--copy]"
---

# Install Command

One-command setup for the statusline plugin.

## What It Does

1. Creates symlink `~/.claude/statusline.sh` → plugin's `statusline.sh`
2. Creates symlink `~/.claude/hooks/session-start.sh` → plugin's auto-register hook
3. Updates `~/.claude/settings.json` with statusline and hook configuration
4. Creates `~/.claude/instances/` directory for the registry

## Arguments

- `--copy` - Copy scripts instead of symlinking (for portability)

## How It Works

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Session Start  │────▶│  Hook fires      │────▶│  Auto-register  │
│                 │     │  (JSON stdin)    │     │  in registry    │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                                                          │
┌─────────────────┐     ┌──────────────────┐              │
│  Statusline     │◀────│  Lookup name     │◀─────────────┘
│  displays name  │     │  from registry   │
└─────────────────┘     └──────────────────┘
```

1. **SessionStart hook** receives `session_id` via JSON
2. **Hook script** registers instance in `~/.claude/instances/registry.json`
3. **Statusline script** looks up name from registry when rendering
4. **Self-naming skill** lets Claude update the name based on task

## Installation Script

The assistant should run:

```bash
#!/bin/bash
set -e

PLUGIN_DIR="plugins/statusline"
CLAUDE_DIR="$HOME/.claude"
SETTINGS_FILE="$CLAUDE_DIR/settings.json"

echo "Installing statusline plugin..."

# 1. Create directories
mkdir -p "$CLAUDE_DIR/instances"
echo "✓ Created directories"

# 2. Symlink statusline.sh
[ -e "$CLAUDE_DIR/statusline.sh" ] && rm "$CLAUDE_DIR/statusline.sh"
ln -sf "$PLUGIN_DIR/tools/statusline.sh" "$CLAUDE_DIR/statusline.sh"
chmod +x "$CLAUDE_DIR/statusline.sh"
echo "✓ Symlinked statusline.sh"

# 3. Update settings.json
if [ -f "$SETTINGS_FILE" ]; then
    cp "$SETTINGS_FILE" "$SETTINGS_FILE.bak"

    if command -v jq &> /dev/null; then
        jq '. + {
          "statusLine": {
            "type": "command",
            "command": "~/.claude/statusline.sh"
          }
        }' "$SETTINGS_FILE.bak" > "$SETTINGS_FILE"
        echo "✓ Updated settings.json"
    else
        echo "⚠ jq not found - manual config required"
    fi
else
    echo '{
      "statusLine": {"type": "command", "command": "~/.claude/statusline.sh"}
    }' | jq . > "$SETTINGS_FILE"
    echo "✓ Created settings.json"
fi

echo ""
echo "Installation complete!"
echo "Restart Claude Code to activate."
```

## Verification

After installation, verify:

```bash
# Check symlinks
ls -la ~/.claude/statusline.sh ~/.claude/hooks/session-start.sh

# Check settings
cat ~/.claude/settings.json | jq '{statusLine, hooks}'

# Check instances dir
ls -la ~/.claude/instances/
```

## What Happens on Restart

1. Claude Code starts
2. SessionStart hook fires automatically
3. Hook receives JSON with `session_id`
4. Instance registered as `Claude-{short_id}`
5. Statusline displays: `[Claude-abc12:abc12] dir | ctx:0% | $0.00`
6. Claude can self-name to change `Claude-abc12` → `Explorer`

## Self-Naming

After auto-registration, Claude can update its name:

```bash
python3 plugins/statusline/tools/registry.py register \
  "$SESSION_ID" "Explorer" \
  --task "Environmental exploration"
```

Or use the `statusline` skill for guidance on naming conventions.

## Uninstall

```bash
rm ~/.claude/statusline.sh
rm ~/.claude/hooks/session-start.sh
rm -rf ~/.claude/instances/
# Remove statusLine and hooks.SessionStart from settings.json
```

## Troubleshooting

**Statusline not showing?**
- Restart Claude Code
- Check `~/.claude/settings.json` has statusLine config
- Verify: `chmod +x ~/.claude/statusline.sh`

**Instances not registering?**
- Check hook config: `jq .hooks ~/.claude/settings.json`
- Test hook manually: `echo '{"session_id":"test","cwd":"/tmp"}' | ~/.claude/hooks/session-start.sh`
- Check registry: `cat ~/.claude/instances/registry.json`

**jq not found?**
- Install: `sudo apt install jq` or `brew install jq`
