---
description: Enable voice output
allowed-tools: Bash
---

# Enable Voice Output

Enable voice output for Claude Code sessions in this project.

## Steps

1. **Run the voice settings CLI:**
   ```bash
   bun ${CLAUDE_PLUGIN_ROOT}/src/cli/voice-settings.ts on
   ```

   This will:
   - Update `.claude/voice.local.md` with `enabled: true`
   - Speak "Voice enabled." as confirmation

2. **Report the result** to the user based on the CLI output.

The next responses will be spoken aloud. Voice hooks will detect the settings change immediately.
