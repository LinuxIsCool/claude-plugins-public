---
description: Show voice output status and configuration
allowed-tools: Bash
---

# Voice Status

Show the current voice output status and configuration.

## Steps

1. **Run the voice settings CLI:**
   ```bash
   bun ${CLAUDE_PLUGIN_ROOT}/src/cli/voice-settings.ts status
   ```

2. **Present the output** to the user in a clear format.

The output will show:
- Whether voice is enabled or disabled
- The active TTS backend (elevenlabs, pyttsx3, etc.)
- The current voice ID
- The configuration source (session, agent, model, or system default)
