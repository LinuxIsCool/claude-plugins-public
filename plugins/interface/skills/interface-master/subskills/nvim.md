---
name: nvim
description: Neovim editor layer - understanding nvim when Claude Code runs inside nvim terminal buffers, remote commands, and integration patterns.
allowed-tools: Bash, Read, Glob
---

# nvim Layer

Neovim (nvim) is a modern text editor. Claude Code may run inside an nvim terminal buffer, creating a unique integration opportunity.

## Detection

```bash
# Check if inside nvim
if [[ -n "$NVIM" ]]; then
  echo "Inside nvim terminal"
  echo "Socket: $NVIM"
  # Can communicate via this socket
else
  echo "Not in nvim"
fi

# Alternative check
if [[ -n "$NVIM_LISTEN_ADDRESS" ]]; then
  echo "Nvim socket (legacy): $NVIM_LISTEN_ADDRESS"
fi
```

## Embedding Scenarios

### Scenario 1: Standalone
```
Claude Code ← not in nvim
```
- Most common
- No nvim integration available

### Scenario 2: In nvim Terminal Buffer
```
nvim
└── :terminal
    └── Claude Code
```
- Full nvim integration possible
- Can send commands to parent nvim
- Can read/write buffers

### Scenario 3: nvim in Another Pane
```
tmux
├── pane 0: Claude Code
└── pane 1: nvim
```
- No direct nvim communication
- Can use tmux send-keys to nvim pane

## Configuration

### Config File Location
```bash
# Standard location
cat ~/.config/nvim/init.lua 2>/dev/null | head -50

# Or init.vim for vimscript
cat ~/.config/nvim/init.vim 2>/dev/null | head -50

# Check config directory
ls -la ~/.config/nvim/
```

### Installed Plugins
```bash
# lazy.nvim plugins
ls ~/.local/share/nvim/lazy/ 2>/dev/null

# packer plugins
ls ~/.local/share/nvim/site/pack/packer/start/ 2>/dev/null

# Check lazy-lock.json for versions
cat ~/.config/nvim/lazy-lock.json 2>/dev/null | head -20
```

## Observation Commands (when in nvim)

### Buffer Information
```bash
# List buffers (requires nvim remote)
nvim --server "$NVIM" --remote-expr 'execute("ls")'

# Current buffer name
nvim --server "$NVIM" --remote-expr 'bufname("%")'

# Current buffer number
nvim --server "$NVIM" --remote-expr 'bufnr("%")'

# Buffer content (first 10 lines)
nvim --server "$NVIM" --remote-expr 'getline(1, 10)'
```

### Window/Tab Information
```bash
# Current window
nvim --server "$NVIM" --remote-expr 'winnr()'

# Tab count
nvim --server "$NVIM" --remote-expr 'tabpagenr("$")'

# Window layout
nvim --server "$NVIM" --remote-expr 'winlayout()'
```

### Cursor Position
```bash
# Line number
nvim --server "$NVIM" --remote-expr 'line(".")'

# Column number
nvim --server "$NVIM" --remote-expr 'col(".")'

# Full position
nvim --server "$NVIM" --remote-expr 'getcurpos()'
```

## Action Commands (when in nvim)

### Execute Vim Commands
```bash
# Run ex command
nvim --server "$NVIM" --remote-send ':echo "Hello from Claude"<CR>'

# Save current buffer
nvim --server "$NVIM" --remote-send ':w<CR>'

# Open file
nvim --server "$NVIM" --remote-send ':e /path/to/file<CR>'
```

### Edit Operations
```bash
# Go to line 50
nvim --server "$NVIM" --remote-send ':50<CR>'

# Search
nvim --server "$NVIM" --remote-send '/pattern<CR>'

# Insert text at cursor
nvim --server "$NVIM" --remote-send 'iHello<Esc>'
```

### Window Management
```bash
# Split horizontal
nvim --server "$NVIM" --remote-send ':split<CR>'

# Split vertical
nvim --server "$NVIM" --remote-send ':vsplit<CR>'

# Close window
nvim --server "$NVIM" --remote-send ':close<CR>'
```

## Working with Buffers

### Read Buffer Content
```bash
# Read entire buffer
nvim --server "$NVIM" --remote-expr 'join(getline(1, "$"), "\n")'

# Read specific lines
nvim --server "$NVIM" --remote-expr 'getline(10, 20)'
```

### Modify Buffer
```bash
# Set line 5 to new content
nvim --server "$NVIM" --remote-expr 'setline(5, "new content")'

# Append line
nvim --server "$NVIM" --remote-expr 'append("$", "new line")'

# Delete line 10
nvim --server "$NVIM" --remote-send ':10d<CR>'
```

## Useful Neovim Concepts

### Modes
- **Normal**: Navigation, commands (`Esc` to enter)
- **Insert**: Typing text (`i`, `a`, `o` to enter)
- **Visual**: Selection (`v`, `V`, `Ctrl-V` to enter)
- **Command**: Ex commands (`:` to enter)

### Registers
```bash
# Get register content
nvim --server "$NVIM" --remote-expr 'getreg("+")'  # system clipboard
nvim --server "$NVIM" --remote-expr 'getreg("0")'  # yank register
```

### Marks
```bash
# Get mark position
nvim --server "$NVIM" --remote-expr 'getpos("'"'"'a")'  # mark a
```

## Integration Patterns

### Pattern 1: Read file from nvim
Instead of `Read` tool, get from nvim buffer:
```bash
# If file is open in nvim
nvim --server "$NVIM" --remote-expr 'join(getline(1, "$"), "\n")' > /tmp/buffer.txt
cat /tmp/buffer.txt
```

### Pattern 2: Write to nvim
Instead of `Write` tool, write to nvim buffer:
```bash
# Send content to nvim (complex, usually better to use Write tool)
nvim --server "$NVIM" --remote-send ':%d<CR>'  # clear buffer
# Then set lines...
```

### Pattern 3: Coordinate Editing
```bash
# Tell user what line to look at
nvim --server "$NVIM" --remote-send ':50<CR>'  # go to line 50
echo "Check line 50 in nvim"
```

## Safety Considerations

- **remote-send** can disrupt user's editing
- Always check current mode before sending
- Prefer remote-expr (queries) over remote-send (mutations)
- Confirm with user before major buffer changes
- Escape special characters properly

## When nvim Is Not Available

If `$NVIM` is not set:
- Use standard `Read`, `Write`, `Edit` tools
- No direct nvim integration possible
- Can still read nvim config files for understanding

## Common nvim Configurations

```bash
# Check for LSP servers
nvim --server "$NVIM" --remote-expr 'execute(":LspInfo")' 2>/dev/null

# Check for formatter
nvim --server "$NVIM" --remote-expr 'execute(":ConformInfo")' 2>/dev/null

# Check colorscheme
nvim --server "$NVIM" --remote-expr 'g:colors_name' 2>/dev/null
```

## Relationship to Other Layers

- **Claude Code**: May run in nvim :terminal
- **tmux**: nvim may run in a tmux pane
- **fish**: nvim's :terminal uses user's shell
- **alacritty**: Renders nvim (or nvim is in tmux in alacritty)
