---
description: Disable voice output
allowed-tools: Bash
---

# Disable Voice Output

Disable voice output for Claude Code sessions in this project.

## Steps

1. **Run the voice settings CLI:**
   ```bash
   bun ${CLAUDE_PLUGIN_ROOT}/src/cli/voice-settings.ts off
   ```

   This will:
   - Update `.claude/voice.local.md` with `enabled: false`
   - Confirm silently (no speech)

2. **Report the result** to the user based on the CLI output.

Voice output is now disabled until you run `/voice:on`. Responses will be text-only.
