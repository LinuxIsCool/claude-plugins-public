# Unified Workspace Restoration

## Executive Summary

This report examines how neovim session management and fish shell state integrate with the Claude Code auto-restore system designed in `05-auto-restore-architecture.md`. The user's workspace consists of three primary components requiring restoration after system restart:

1. **Claude Code sessions** - Conversation context and task state (addressed in prior architecture)
2. **Neovim sessions** - Open buffers, window layouts, cursor positions
3. **Fish shell state** - Command history, universal variables, working directories

The key finding is that **tmux-resurrect serves as the unified foundation** for all three components, but each requires different restoration strategies:

| Component | Restoration Mechanism | Current Status | Gap |
|-----------|----------------------|----------------|-----|
| Claude Code | Custom hooks + context injection | Designed (not implemented) | Full implementation needed |
| Neovim | `@resurrect-strategy-nvim 'session'` | **Already configured** | Session files not being created |
| Fish shell | Native persistence + tmux-resurrect | **Fully automatic** | No gaps |

The primary gap is that **neovim session files (`Session.vim`) are not being automatically created**, preventing tmux-resurrect from restoring nvim state. The solution requires adding a session management plugin to neovim (vim-obsession or auto-session).

## Neovim Session Management

### Built-in Session Support

Neovim provides native session support through two commands:

```vim
:mksession [file]    " Create session file (default: Session.vim in cwd)
:source Session.vim  " Restore session
```

A session file captures:
- Buffer list (open files)
- Window layout (splits, tabs)
- Cursor positions
- Local options and mappings
- Folds state
- Current working directory

**Limitation**: The built-in commands are manual. Users must remember to run `:mksession` before closing neovim, which is error-prone.

### @resurrect-strategy-nvim 'session'

The user's tmux configuration already includes:

```bash
# From ~/.config/tmux/plugins.tmux
set -g @resurrect-strategy-nvim 'session'
```

This setting tells tmux-resurrect to look for `Session.vim` in the working directory when restoring a pane that was running nvim. The strategy script at `~/.config/tmux/plugins/tmux-resurrect/strategies/nvim_session.sh` performs:

```bash
# Pseudocode of strategy logic
if Session.vim exists in $DIRECTORY:
    return "nvim -S"  # Start nvim with session
else:
    return original_command  # Start nvim normally
```

**Current Gap**: No `Session.vim` files exist because nothing is creating them. The user's neovim config (NvChad-based) does not include session management.

### Auto-session Plugins

Several plugins automate session management:

#### Option 1: vim-obsession (Recommended for tmux-resurrect)

vim-obsession by Tim Pope is specifically recommended by tmux-resurrect documentation:

- Automatically saves session on every `BufEnter` event
- Restores state on `nvim -S` automatically
- Minimal configuration required
- Creates `Session.vim` in current directory

**Installation** (add to `~/.config/nvim/lua/custom/plugins.lua`):
```lua
{
  "tpope/vim-obsession",
  lazy = false,
  config = function()
    -- Auto-start session tracking if Session.vim exists
    if vim.fn.filereadable("Session.vim") == 1 then
      vim.cmd("source Session.vim")
    end
  end,
}
```

**Usage**: Run `:Obsess` once per project directory to start tracking. The session file updates automatically thereafter.

#### Option 2: auto-session

rmagatti/auto-session provides fully automatic session management:

- Auto-saves session on exit
- Auto-restores on nvim start (based on cwd)
- Stores sessions in a central directory (`~/.local/share/nvim/sessions/`)
- No manual `:Obsess` command needed

**Installation**:
```lua
{
  "rmagatti/auto-session",
  lazy = false,
  opts = {
    auto_save = true,
    auto_restore = true,
    auto_session_suppress_dirs = { "~/", "~/Downloads", "/tmp" },
  },
}
```

**Consideration**: auto-session stores sessions centrally, not as `Session.vim` in the project directory. This **breaks compatibility with tmux-resurrect's nvim strategy** which expects `Session.vim` in the working directory.

#### Option 3: persistence.nvim

folke/persistence.nvim is another popular option:

- Saves sessions to `~/.local/state/nvim/sessions/`
- Branch-aware (can save per git branch)
- Does NOT auto-restore by default (manual choice)

**Incompatibility**: Like auto-session, stores sessions centrally, not compatible with tmux-resurrect strategy.

### Current User Configuration

The user's neovim setup (`~/.config/nvim/`) is NvChad-based:

```
~/.config/nvim/
├── init.lua                 # Loads core and custom configs
├── lua/
│   ├── core/                # NvChad core
│   ├── plugins/             # Plugin configs
│   └── custom/              # User customizations
│       ├── plugins.lua      # Additional plugins
│       └── init.lua         # Custom autocmds
```

**Key observations from `/home/user/path
- Uses lazy.nvim for plugin management
- No session management plugin installed
- Has nvim-tree (file explorer) auto-opening on startup
- Has Avante (AI assistant) plugin

**No session-related configuration exists**. The `sessionoptions` vim option was not explicitly set.

### Recommended Configuration

For integration with tmux-resurrect, add vim-obsession:

```lua
-- Add to ~/.config/nvim/lua/custom/plugins.lua
{
  "tpope/vim-obsession",
  lazy = false,
  config = function()
    -- Set sessionoptions for optimal restoration
    vim.opt.sessionoptions = "buffers,curdir,folds,help,tabpages,winsize,winpos,localoptions"

    -- Auto-source existing session on startup
    vim.api.nvim_create_autocmd("VimEnter", {
      callback = function()
        -- Only if Session.vim exists and no files were passed
        if vim.fn.argc() == 0 and vim.fn.filereadable("Session.vim") == 1 then
          vim.cmd("source Session.vim")
        end
      end,
      nested = true,
    })
  end,
}
```

Then run `:Obsess` in each project directory to begin tracking.

## Fish Shell State

### What Persists Automatically

Fish shell handles state persistence natively with minimal configuration:

| State Type | Persistence | Location |
|------------|-------------|----------|
| Command history | Automatic, immediate | `~/.local/share/fish/fish_history` (671KB in user's system) |
| Universal variables | Automatic, synchronized | `~/.local/share/fish/fish_variables` |
| Functions | File-based | `~/.config/fish/functions/` |
| Abbreviations | Universal variables | Persisted automatically |
| Completions | File-based | `~/.config/fish/completions/` |

The user's fish history file is 671KB, indicating substantial history preservation.

**Universal variables** (set with `set -U`) are particularly powerful:
- Persist across logouts and reboots
- Synchronized across all running fish instances
- Include abbreviations defined with `abbr -U`

### What Needs Help

**Working directory** is the only fish state that does NOT persist automatically:
- Each new shell starts in `$HOME` or tmux-configured directory
- tmux-resurrect handles this via `@resurrect-capture-pane-contents 'on'`

The user's tmux configuration already has this setting enabled.

### Fish-Specific tmux Integration

The user's tmux configuration specifies fish as the default shell:

```bash
# From ~/.config/tmux/settings.tmux
set -g default-shell /usr/bin/fish
```

This means:
- All new panes launch fish
- tmux-resurrect restores panes with fish processes
- Working directory is restored by tmux-resurrect

### Current User Fish Configuration

The user's fish setup (`~/.config/fish/`):

```
~/.config/fish/
├── config.fish          # Main config with conda, nvm, pyenv, zoxide
├── config/
│   ├── abbr.fish       # Abbreviations (gc, gp, gs, vim→nvim)
│   ├── keys.fish       # Key bindings
│   ├── plugins.fish    # fish-command-timer, nvm.fish config
│   └── programs.fish   # autojump, fzf integration
└── functions/          # Custom functions
```

**Notable integrations**:
- **zoxide**: `zoxide init fish | source` - smarter directory navigation
- **autojump**: Alternative directory jumping
- **nvm.fish**: Node version management (auto-loads latest version)
- **pyenv**: Python version management
- **conda**: Conda environment support

All of these persist their state independently:
- zoxide stores frecency data in `~/.local/share/zoxide/`
- autojump stores data in `~/.local/share/autojump/`
- nvm uses `~/.nvm/` directory
- conda environments persist in `~/miniconda3/`

### No Additional Configuration Needed

Fish shell restoration is effectively complete through the combination of:
1. Native fish persistence (history, universal variables)
2. tmux-resurrect (working directories, pane contents)

## Unified Restoration Flow

### Component Restoration Order

The restoration sequence after system restart:

```
1. System Boot
   └── tmux server not running

2. User opens terminal (alacritty)
   └── Launches fish shell
   └── Fish loads config, history, universal vars automatically

3. User runs tmux OR tmux-continuum auto-starts
   └── tmux-resurrect triggers (if @continuum-restore 'on')

4. tmux-resurrect restore phase
   ├── 4a. Restore sessions, windows, panes
   ├── 4b. Restore working directories
   ├── 4c. Restore pane contents (scrollback)
   ├── 4d. Restore running processes:
   │       ├── fish shells - start fresh but inherit cwd
   │       ├── nvim - runs "nvim -S" if Session.vim exists
   │       └── claude - starts fresh (no built-in restore)
   └── 4e. Run post-restore hooks

5. Post-restore hook (for Claude Code)
   └── Context injection into Claude panes

6. All components restored
```

### Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           SAVE PHASE (During Operation)                      │
└─────────────────────────────────────────────────────────────────────────────┘

┌───────────────┐     ┌───────────────┐     ┌───────────────┐
│   Fish Shell   │     │    Neovim      │     │  Claude Code   │
│               │     │               │     │               │
│ Automatic:    │     │ With plugin:   │     │ Logging plugin: │
│ • History     │     │ • Session.vim  │     │ • JSONL logs   │
│ • Variables   │     │   per project  │     │ • Summaries    │
│ • Functions   │     │               │     │               │
└───────┬───────┘     └───────┬───────┘     └───────┬───────┘
        │                     │                     │
        ▼                     ▼                     ▼
┌───────────────┐     ┌───────────────┐     ┌───────────────┐
│ ~/.local/share │     │ $PROJECT/     │     │ $PROJECT/     │
│ /fish/         │     │ Session.vim   │     │ .claude/      │
│ • fish_history│     │               │     │ logging/      │
│ • fish_vars   │     │               │     │               │
└───────────────┘     └───────────────┘     └───────────────┘
        │                     │                     │
        │                     │                     │
        └─────────────────────┼─────────────────────┘
                              │
                              ▼
                    ┌───────────────────────────────────┐
                    │         tmux-resurrect             │
                    │                                   │
                    │ Saves: prefix + Ctrl-s            │
                    │ • Sessions, windows, panes        │
                    │ • Working directories             │
                    │ • Pane contents (scrollback)      │
                    │ • Running commands                │
                    │                                   │
                    │ File: ~/.tmux/resurrect/last      │
                    │ (Note: current location unknown,  │
                    │  may be in XDG config directory)  │
                    └───────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────────────────┐
│                        RESTORE PHASE (After Reboot)                          │
└─────────────────────────────────────────────────────────────────────────────┘

                    ┌───────────────────────────────────┐
                    │       tmux-resurrect restore       │
                    │         prefix + Ctrl-r            │
                    │     (or tmux-continuum auto)       │
                    └───────────────┬───────────────────┘
                                    │
        ┌───────────────────────────┼───────────────────────────┐
        │                           │                           │
        ▼                           ▼                           ▼
┌───────────────┐           ┌───────────────┐           ┌───────────────┐
│  Fish panes   │           │  Nvim panes   │           │ Claude panes  │
│               │           │               │           │               │
│ • Fresh shell │           │ Strategy:     │           │ • Fresh start │
│ • Restore cwd │           │  nvim_session │           │ • Restore cwd │
│ • History OK  │           │               │           │               │
│ • Vars OK     │           │ If Session.vim│           │               │
│               │           │ exists:       │           │               │
│ COMPLETE      │           │   nvim -S     │           │ INCOMPLETE    │
│               │           │ else:         │           │               │
│               │           │   nvim        │           │               │
│               │           │               │           │               │
│               │           │ CONDITIONAL   │           │               │
└───────────────┘           └───────────────┘           └───────────────┘
                                                                │
                                                                ▼
                                                    ┌───────────────────────┐
                                                    │ Post-restore hook     │
                                                    │                       │
                                                    │ 1. Find Claude panes  │
                                                    │ 2. Look up session    │
                                                    │    from pane-map      │
                                                    │ 3. Load context from  │
                                                    │    logs/summaries     │
                                                    │ 4. Inject via         │
                                                    │    tmux send-keys     │
                                                    └───────────────────────┘
```

## Integration with Claude Auto-Restore

### Shared tmux-resurrect Foundation

All three components share tmux-resurrect as the orchestration layer:

| Component | tmux-resurrect Role | Additional Mechanism |
|-----------|--------------------|--------------------|
| Fish | Restores pane with fish process, cwd | Native fish persistence |
| Neovim | Runs `nvim -S` strategy | vim-obsession creates Session.vim |
| Claude | Restores pane with `claude` command, cwd | Post-restore hook injects context |

The unified save command (`prefix + Ctrl-s`) triggers all persistence:
1. tmux-resurrect saves pane state
2. vim-obsession has already been saving `Session.vim` on every buffer change
3. Claude logging plugin has been writing JSONL continuously

### Separate Concerns

Each component maintains independent state:

**Fish**: No coupling needed
- State lives in `~/.local/share/fish/`
- tmux-resurrect only needs to know cwd and command

**Neovim**: File-based coupling
- State lives in `$PROJECT/Session.vim`
- tmux-resurrect checks for file existence
- Strategy determines nvim launch command

**Claude**: Data-based coupling
- State lives in `$PROJECT/.claude/logging/` and `~/.claude/instances/`
- Post-restore hook reads pane-session map
- Context injection based on log files

### Potential Conflicts

#### Conflict 1: nvim-tree vs Session Restore

The user's nvim config auto-opens nvim-tree on `VimEnter`:

```lua
-- From ~/.config/nvim/lua/custom/init.lua
autocmd("VimEnter", {
  callback = function()
    vim.defer_fn(function()
      require("nvim-tree.api").tree.toggle({ focus = false })
    end, 0)
  end,
})
```

When restoring with `nvim -S`, this may conflict with the session's window layout (which might already include nvim-tree). **Recommendation**: Modify autocmd to skip when restoring session:

```lua
autocmd("VimEnter", {
  callback = function()
    -- Skip if restoring session
    if vim.g.obsession_no_auto_tree then return end
    vim.defer_fn(function()
      require("nvim-tree.api").tree.toggle({ focus = false })
    end, 0)
  end,
})
```

#### Conflict 2: Multiple Session.vim Files

If vim-obsession is active in multiple project directories, each has its own `Session.vim`. This is **desired behavior** - each project restores independently.

However, if a user runs nvim without being in a project directory (e.g., `~/`), vim-obsession might create an unwanted session file. **Recommendation**: Use `auto_session_suppress_dirs` pattern to exclude home directory.

#### Conflict 3: Timing of Claude Context Injection

The post-restore hook sends context to Claude panes, but must wait for Claude to be ready (showing prompt). If nvim is also restoring in another pane, timing may vary.

**Recommendation**: Hook should:
1. Process Claude panes sequentially
2. Wait for Claude prompt detection (pattern match)
3. Use retry with backoff
4. Skip unresponsive panes with warning

### Unified Hook Architecture

Extend the post-restore hook to coordinate all components:

```bash
#!/bin/bash
# ~/.claude/hooks/post-tmux-restore.sh

# 1. Wait for tmux to stabilize
sleep 0.5

# 2. Fish panes: No action needed (already restored)

# 3. Nvim panes: Verify session restoration
NVIM_PANES=$(tmux list-panes -a -F '#{pane_id}|#{pane_current_command}' | grep -E '\|nvim$')
while IFS='|' read -r pane_id cmd; do
    # Optionally verify nvim loaded session
    # (Can check with nvim --server socket --remote-expr)
    :
done <<< "$NVIM_PANES"

# 4. Claude panes: Context injection (from 05-auto-restore-architecture.md)
CLAUDE_PANES=$(tmux list-panes -a -F '#{pane_id}|#{session_name}:#{window_index}.#{pane_index}' \
    | grep claude)
# ... context injection logic ...

# 5. Report status
echo "Restoration complete: $(date)"
```

## Recommendations

### Immediate Actions

1. **Install vim-obsession in neovim**

   Add to `/home/user/path
   ```lua
   {
     "tpope/vim-obsession",
     lazy = false,
   },
   ```

   Then restart nvim and run:
   ```
   :Lazy sync
   ```

2. **Initialize sessions in active projects**

   For each project directory where nvim is used:
   ```vim
   :Obsess
   ```

   This creates `Session.vim` that will be tracked automatically.

3. **Set sessionoptions**

   Add to `/home/user/path
   ```lua
   vim.opt.sessionoptions = "buffers,curdir,folds,help,tabpages,winsize,winpos,localoptions"
   ```

### Future Actions

4. **Modify nvim-tree autocmd**

   Update `/home/user/path to avoid conflict with session restore:
   ```lua
   autocmd("VimEnter", {
     callback = function()
       -- Skip if session is being restored
       if vim.v.this_session ~= "" then return end
       vim.defer_fn(function()
         require("nvim-tree.api").tree.toggle({ focus = false })
       end, 0)
     end,
   })
   ```

5. **Add tmux-continuum for automatic saves**

   Add to `/home/user/path
   ```bash
   set -g @plugin 'tmux-plugins/tmux-continuum'
   set -g @continuum-save-interval '5'  # Save every 5 minutes
   set -g @continuum-restore 'on'       # Auto-restore on tmux start
   ```

6. **Implement Claude auto-restore system**

   Follow the architecture in `05-auto-restore-architecture.md` to implement:
   - Pane-session mapper
   - Post-restore hook for Claude context injection

### Configuration Summary

| File | Changes |
|------|---------|
| `~/.config/nvim/lua/custom/plugins.lua` | Add vim-obsession plugin |
| `~/.config/nvim/lua/custom/init.lua` | Add sessionoptions, modify nvim-tree autocmd |
| `~/.config/tmux/plugins.tmux` | (Optional) Add tmux-continuum |
| `~/.claude/hooks/post-tmux-restore.sh` | Create hook for Claude context injection |
| `~/.tmux.conf` or `~/.config/tmux/*.tmux` | Add `@resurrect-hook-post-restore-all` |

### No Changes Needed

The following already work correctly:

- **Fish shell**: All persistence is automatic
- **tmux-resurrect**: Already configured with nvim session strategy
- **Working directories**: tmux-resurrect handles this

## Sources

### Documentation Referenced
- [tmux-resurrect: Restoring vim and neovim sessions](https://github.com/tmux-plugins/tmux-resurrect/blob/master/docs/restoring_vim_and_neovim_sessions.md)
- [tmux-resurrect: Save & Restore Hooks](https://github.com/tmux-plugins/tmux-resurrect/blob/master/docs/hooks.md)
- [fish shell: history documentation](https://fishshell.com/docs/current/cmds/history.html)
- [fish shell: FAQ](https://fishshell.com/docs/current/faq.html)

### Session Management Plugins
- [tpope/vim-obsession](https://github.com/tpope/vim-obsession) - Recommended for tmux-resurrect
- [rmagatti/auto-session](https://github.com/rmagatti/auto-session) - Automatic session management
- [folke/persistence.nvim](https://github.com/folke/persistence.nvim) - Simple session management
- [Shatur/neovim-session-manager](https://github.com/Shatur/neovim-session-manager) - VSCode-like sessions

### User Configuration Files Analyzed
- `/home/user/path - tmux-resurrect configuration
- `/home/user/path - fish shell as default
- `/home/user/path - NvChad custom plugins
- `/home/user/path - Custom autocmds
- `/home/user/path - Fish configuration
- `/home/user/path - Fish abbreviations
- `/home/user/path - Strategy implementation
