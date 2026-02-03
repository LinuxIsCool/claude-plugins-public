# tmux State Management Research Report

**Date:** January 29, 2026
**Purpose:** Research auto-saving and auto-restoring tmux sessions for Claude Code session recovery after system freeze/reboot

---

## Executive Summary

This report examines tmux state management solutions for automatically preserving and restoring Claude Code CLI sessions across system restarts. The current setup uses tmux-resurrect with pane content capture and nvim session strategy, but lacks automatic periodic saving (tmux-continuum is not installed).

The primary challenge with Claude Code restoration is that tmux-resurrect can save and attempt to restore the `claude` command, but cannot restore the internal Claude session state (conversation history, context, checkpoints). A hybrid approach is required: tmux-resurrect handles window/pane layout restoration, while Claude Code's native `--continue` and `--resume` flags handle session context restoration.

The recommended solution involves installing tmux-continuum for automatic periodic saves, configuring Claude Code process restoration in tmux-resurrect, and implementing custom hooks to capture Claude session IDs alongside tmux state for streamlined recovery workflows.

---

## Current Configuration Analysis

### What Is Installed

| Component | Status | Location |
|-----------|--------|----------|
| tmux-resurrect | Installed | `~/.config/tmux/plugins/tmux-resurrect/` |
| tmux-continuum | **Not installed** | - |
| TPM (Plugin Manager) | Installed | `~/.config/tmux/plugins/tpm/` |

### Current Configuration

From `~/.config/tmux/plugins.tmux`:

```bash
set -g @plugin 'tmux-plugins/tmux-resurrect'
set -g @resurrect-capture-pane-contents 'on'
set -g @resurrect-strategy-nvim 'session'
```

### Configuration Gaps

1. **No automatic periodic saving** - Requires manual `prefix + Ctrl-s` before shutdown
2. **No Claude Code process restoration configured** - Claude sessions appear in save file but restoration behavior is undefined
3. **No session ID capture** - Claude session IDs are not preserved for `--resume` flag usage
4. **No automatic restore on tmux start** - Manual `prefix + Ctrl-r` required after reboot

### Current Save File Analysis

The latest save file (`~/.local/share/tmux/resurrect/tmux_resurrect_20251215T193352.txt`) shows Claude Code processes are being captured:

```
pane	0	1	0	:	0	✳ Claude Name Updates	:/home/user/path --dangerously-skip-permissions
```

**Field breakdown:**
- Session name: `0`
- Window index: `1`
- Working directory: `/home/user/path
- Running command: `claude`
- Full command: `claude --dangerously-skip-permissions`

---

## tmux-resurrect Deep Dive

### Core Features

tmux-resurrect persists the entire tmux environment across system restarts:

| Feature | Description |
|---------|-------------|
| Window/pane layout | Exact geometry and arrangement preserved |
| Working directories | Each pane returns to its original `pwd` |
| Pane contents | Optional scrollback buffer preservation |
| Running programs | Configurable process restoration |
| Vim/Neovim sessions | Strategy-based session file restoration |

**Key bindings:**
- `prefix + Ctrl-s` - Save current environment
- `prefix + Ctrl-r` - Restore saved environment

**Storage location:** `~/.local/share/tmux/resurrect/` (or `~/.tmux/resurrect/`)

### Hooks Available

tmux-resurrect provides four hook points for custom behavior:

| Hook | When Called | Arguments | Use Case |
|------|-------------|-----------|----------|
| `@resurrect-hook-post-save-layout` | After sessions/panes/windows saved | State file path | Process save file, extract metadata |
| `@resurrect-hook-post-save-all` | End of save process (before spinner off) | None | Cleanup, notifications, secondary saves |
| `@resurrect-hook-pre-restore-all` | Before any tmux state altered | None | Preparation, environment setup |
| `@resurrect-hook-pre-restore-pane-processes` | Before running processes restored | None | Pre-process setup, conditionals |

**Hook configuration example:**
```bash
# Save window geometry on X11
set -g @resurrect-hook-post-save-all 'eval $(xdotool getwindowgeometry --shell $WINDOWID); echo 0,$X,$Y,$WIDTH,$HEIGHT > $HOME/.tmux/resurrect/geometry'
set -g @resurrect-hook-pre-restore-all 'wmctrl -i -r $WINDOWID -e $(cat $HOME/.tmux/resurrect/geometry)'
```

### Custom Process Restoration

**Default restored programs:** `vi vim nvim emacs man less more tail top htop irssi weechat mutt`

**Configuration syntax:**

```bash
# Basic addition
set -g @resurrect-processes 'ssh psql mysql sqlite3'

# Programs with arguments (double quoted)
set -g @resurrect-processes 'some_program "git log"'

# Tilde (~) for partial matching
set -g @resurrect-processes '"~rails server"'  # Matches anywhere in process string

# Arrow (->) for restore command substitution
set -g @resurrect-processes '"~rails server->rails server"'

# Asterisk (*) to preserve arguments
set -g @resurrect-processes '"~rails server->rails server *"'

# Disable all program restoration
set -g @resurrect-processes 'false'

# Restore ALL programs (dangerous)
set -g @resurrect-processes ':all:'
```

**For Claude Code:**
```bash
# Attempt to restore claude command with arguments
set -g @resurrect-processes '"~claude->claude *"'
```

### Pane Content Saving

Enabled via `set -g @resurrect-capture-pane-contents 'on'` (already configured).

- Uses tmux's `capture-pane` command
- Saves visible buffer and scrollback
- Stored as compressed tarball: `pane_contents.tar.gz`
- Restores terminal output history on restore

**Limitation:** This saves the terminal buffer, but interactive CLI applications like Claude Code create new output upon restart rather than resuming mid-conversation.

---

## tmux-continuum Analysis

### Overview

tmux-continuum is a companion plugin to tmux-resurrect that adds automatic, periodic saving and optional automatic restore on tmux server start.

### Auto-save Capability

- Saves environment every 15 minutes by default
- Runs silently in background via status line hook
- No user intervention required

**Mechanism:** The plugin hooks into `status-right` variable updates. If another plugin (especially themes) overwrites `status-right`, auto-save stops working.

**Solution:** Load tmux-continuum last in the TPM plugin list.

### Configuration Options

```bash
# Enable automatic restore on tmux start
set -g @continuum-restore 'on'

# Change save interval (minutes)
set -g @continuum-save-interval '15'  # Default
set -g @continuum-save-interval '60'  # Every hour
set -g @continuum-save-interval '0'   # Disable auto-save

# Automatic tmux start on boot (macOS)
set -g @continuum-boot 'on'
set -g @continuum-boot-options 'iterm,fullscreen'

# Systemd integration (Linux)
set -g @continuum-systemd-start-cmd 'new-session -d'
```

### Integration with Resurrect

tmux-continuum wraps tmux-resurrect functionality:
- Uses resurrect's save/restore scripts
- Triggers resurrect saves on timer
- Invokes resurrect restore on tmux server start
- Respects all resurrect configuration options

### Timing Behavior

| Event | Timing |
|-------|--------|
| First auto-save | 15 minutes after tmux starts |
| Subsequent saves | Every N minutes (configurable) |
| Auto-restore | Only on tmux server start (not on config reload) |
| Manual save/restore | Always available via prefix + Ctrl-s/r |

### Storage Management

- Regular save file: ~5KB
- Automatic cleanup: Files older than 30 days removed, minimum 5 copies kept
- Symlink `last` always points to most recent save

---

## Alternative Tools (2024-2026)

### Zellij (Recommended Alternative Terminal Multiplexer)

**Key feature:** Built-in session resurrection since v0.39.0 (November 2023)

| Aspect | Zellij | tmux + plugins |
|--------|--------|----------------|
| Session persistence | Built-in, automatic | Requires resurrect + continuum |
| Configuration | Zero config default | Manual configuration |
| Scrollback preservation | Configurable line count | Via pane contents feature |
| Command re-execution | "Press ENTER to run" safety | Immediate execution |
| Storage format | Human-readable KDL files | Custom tab-delimited format |

**Zellij configuration options:**
```kdl
session_serialization true      // Enable/disable (default: true)
pane_viewport_serialization true // Save visible content
scrollback_lines_to_serialize 0  // 0 = all, or set limit
```

**Limitation for Claude Code:** Like tmux, Zellij cannot restore internal application state. The `claude` command would restart fresh.

### Other Session Managers

| Tool | Description | Stars |
|------|-------------|-------|
| tmux-sessionx | Session manager with fzf, zoxide, preview | Active |
| sesh | Smart terminal session manager | 1.5k |
| tmuxp | Python-based session manager with freeze/thaw | Mature |
| laio | Flexbox-inspired layout/session manager (Rust) | Newer |

### Claude-Specific Tools

| Tool | Description | Source |
|------|-------------|--------|
| claude-session-manager | Bash utility to capture/restore Claude sessions | [GitHub](https://github.com/drewburchfield/claude-session-manager) |
| Claude Session Restore | Multi-vector session analysis and restoration | Community |

**claude-session-manager features:**
- Scans for running `claude --` processes via `ps aux`
- Extracts working directories via `lsof`
- Captures session IDs from `~/.claude/projects/`
- Generates copy-paste commands for restoration

---

## Integration Opportunities for Claude Code

### Challenge: CLI Process Restoration

tmux-resurrect can restore the `claude` command invocation, but **cannot restore Claude Code's internal state**:

| What tmux-resurrect CAN restore | What it CANNOT restore |
|--------------------------------|------------------------|
| Window/pane layout | Conversation history |
| Working directory | Claude's in-memory context |
| Command invocation (`claude --dangerously-skip-permissions`) | Checkpoint state |
| Terminal scrollback | Active session ID |

**Result without intervention:** After restore, each pane starts a fresh Claude session in the correct directory, but loses all conversation context.

### Solution: Claude Code Native Resume Mechanism

Claude Code provides built-in session persistence:

```bash
# Continue most recent session
claude --continue
claude -c

# Resume specific session by ID
claude --resume <sessionId>
claude -r "<sessionId>"

# Interactive session selection
claude --resume
```

**Session storage:** `~/.claude/sessions/` (JSON files, auto-saved after every message)

### Proposed Hook Points

#### Hook 1: Capture Session IDs on Save

```bash
# ~/.config/tmux/hooks/claude-save-sessions.sh
#!/usr/bin/env bash

CLAUDE_SESSION_FILE="$HOME/.tmux/resurrect/claude_sessions.txt"

# Extract claude session IDs from running processes
ps aux | grep -E 'claude.*(--session|-s)' | while read line; do
    # Parse session ID and pane info
    # Write: <pane_id>|<session_id>|<working_dir>
done > "$CLAUDE_SESSION_FILE"

# Alternative: parse Claude's session storage
find ~/.claude/projects/ -name "*.session" -mmin -60 | while read session; do
    # Extract active sessions
done >> "$CLAUDE_SESSION_FILE"
```

**tmux.conf configuration:**
```bash
set -g @resurrect-hook-post-save-all 'bash ~/.config/tmux/hooks/claude-save-sessions.sh'
```

#### Hook 2: Generate Resume Commands on Restore

```bash
# ~/.config/tmux/hooks/claude-restore-sessions.sh
#!/usr/bin/env bash

CLAUDE_SESSION_FILE="$HOME/.tmux/resurrect/claude_sessions.txt"

if [[ -f "$CLAUDE_SESSION_FILE" ]]; then
    # For each pane that was running claude, generate:
    # tmux send-keys -t <pane_id> "claude --resume <session_id>" Enter
    while IFS='|' read pane_id session_id working_dir; do
        tmux send-keys -t "$pane_id" "claude --resume \"$session_id\"" Enter
    done < "$CLAUDE_SESSION_FILE"
fi
```

**tmux.conf configuration:**
```bash
set -g @resurrect-hook-pre-restore-pane-processes 'bash ~/.config/tmux/hooks/claude-restore-sessions.sh'
```

### Alternative: Wrapper Script Approach

Create a wrapper that embeds session tracking:

```bash
# ~/.local/bin/claude-tmux
#!/usr/bin/env bash

# Capture current tmux pane ID
PANE_ID=$(tmux display-message -p '#{session_name}:#{window_index}.#{pane_index}')

# Run claude and capture session ID
claude "$@" 2>&1 | tee >(
    # Parse session ID from output and save mapping
    grep -oP 'Session: \K[a-f0-9-]+' >> "$HOME/.tmux/resurrect/claude_pane_sessions.txt"
)
```

---

## Recommendations

### Priority 1: Install tmux-continuum (Immediate)

Add to `~/.config/tmux/plugins.tmux`:

```bash
set -g @plugin 'tmux-plugins/tmux-continuum'
set -g @continuum-restore 'on'
set -g @continuum-save-interval '5'  # Save every 5 minutes
```

**Critical:** Ensure tmux-continuum loads AFTER any theme plugins to prevent status-right conflicts.

Install: `prefix + I` in tmux to fetch via TPM.

### Priority 2: Configure Claude Process Restoration

Add to resurrect configuration:

```bash
set -g @resurrect-processes '"~claude->claude --continue"'
```

This tells resurrect to restore any process matching `claude` by running `claude --continue`, which resumes the most recent session in that directory.

### Priority 3: Create Session ID Capture Hook

Implement a post-save hook that:
1. Parses `~/.claude/projects/` for recent session files
2. Maps working directories to session IDs
3. Saves mapping alongside resurrect state

### Priority 4: Create Restore Helper Script

Implement a pre-restore hook or standalone script that:
1. Reads session ID mappings
2. Generates appropriate `claude --resume <id>` commands
3. Optionally auto-executes in restored panes

### Priority 5: Document Recovery Workflow

Create a runbook for post-crash recovery:

1. Start tmux (auto-restores via continuum)
2. Verify pane layouts restored
3. For Claude panes: either accept `--continue` default or manually use `--resume` with captured session IDs
4. Use Claude's `/rewind` command if needed to restore specific checkpoints

---

## Sources

### Official Documentation
- [tmux-resurrect GitHub Repository](https://github.com/tmux-plugins/tmux-resurrect) - Main plugin for session persistence
- [tmux-resurrect Hooks Documentation](https://github.com/tmux-plugins/tmux-resurrect/blob/master/docs/hooks.md) - Hook configuration and examples
- [tmux-resurrect Restoring Programs](https://github.com/tmux-plugins/tmux-resurrect/blob/master/docs/restoring_programs.md) - Custom program restoration syntax
- [tmux-continuum GitHub Repository](https://github.com/tmux-plugins/tmux-continuum) - Automatic save/restore plugin
- [tmux-continuum FAQ](https://github.com/tmux-plugins/tmux-continuum/blob/master/docs/faq.md) - Common configuration questions
- [tmux-continuum Configuration Options](https://deepwiki.com/tmux-plugins/tmux-continuum/4.1-configuration-options) - Detailed configuration reference

### Claude Code Session Management
- [Resume Claude Code Sessions After Restart](https://mehmetbaykar.com/posts/resume-claude-code-sessions-after-restart/) - Mehmet Baykar's guide to session resumption
- [Claude Code Session Management](https://stevekinney.com/courses/ai-development/claude-code-session-management) - Steve Kinney's development course
- [claude-session-manager](https://github.com/drewburchfield/claude-session-manager) - Third-party session capture tool
- [Claude Code Checkpointing Documentation](https://code.claude.com/docs/en/checkpointing) - Official checkpointing features

### Alternative Tools
- [Zellij Session Resurrection](https://zellij.dev/documentation/session-resurrection.html) - Built-in persistence in Zellij
- [awesome-tmux](https://github.com/rothgar/awesome-tmux) - Curated list of tmux resources and plugins
- [tmux plugins list](https://github.com/tmux-plugins/list) - Official plugin directory

### Community Resources
- [ArcoLinux tmux Guide](https://arcolinux.com/everything-you-need-to-know-about-tmux-reconstructing-tmux-sessions-after-restarts/) - Comprehensive reconstruction guide
- [Claude Code + tmux Workflow](https://www.blle.co/blog/claude-code-tmux-beautiful-terminal) - Integration patterns
- [How to Start and Restore Tmux Sessions Automatically](https://www.rockyourcode.com/how-to-start-and-restore-tmux-sessions-automatically-with-tmux-continuum/) - Step-by-step continuum setup

### Known Issues
- [Hooks pre-restore-all and post-restore-all don't work correctly with tmux v3.4](https://github.com/tmux-plugins/tmux-resurrect/issues/504) - Compatibility issue with newer tmux
- [@resurrect-processes does not work with npm start](https://github.com/tmux-plugins/tmux-resurrect/issues/201) - Node.js process restoration challenges
