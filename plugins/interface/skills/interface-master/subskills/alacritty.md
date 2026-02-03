---
name: alacritty
description: Alacritty terminal emulator layer - GPU-accelerated rendering, configuration, fonts, colors, and terminal capabilities.
allowed-tools: Bash, Read, Glob
---

# alacritty Layer

Alacritty is a GPU-accelerated terminal emulator. It renders all terminal output and translates keyboard input. Understanding this layer helps with display issues and configuration.

## Detection

```bash
# Check if in alacritty
echo "TERM: $TERM"
echo "COLORTERM: $COLORTERM"
echo "TERM_PROGRAM: ${TERM_PROGRAM:-'unset'}"

# Alacritty sets specific values
# TERM is usually alacritty or xterm-256color
# COLORTERM is usually truecolor

# Check alacritty version
alacritty --version 2>/dev/null
```

## Configuration

### Config File Location
Alacritty uses TOML config (modern) or YAML (legacy):

```bash
# TOML config (preferred)
cat ~/.config/alacritty/alacritty.toml 2>/dev/null | head -50

# YAML config (legacy)
cat ~/.config/alacritty/alacritty.yml 2>/dev/null | head -50

# Config directory
ls -la ~/.config/alacritty/
```

### Config Sections

```bash
# View font config
grep -A 10 '\[font\]' ~/.config/alacritty/alacritty.toml 2>/dev/null

# View colors
grep -A 30 '\[colors\]' ~/.config/alacritty/alacritty.toml 2>/dev/null

# View keybindings
grep -A 20 '\[\[keyboard.bindings\]\]' ~/.config/alacritty/alacritty.toml 2>/dev/null
```

## Terminal Capabilities

### Color Support
```bash
# Check color capability
tput colors

# Test 256 colors
for i in {0..255}; do printf "\e[48;5;${i}m%3d\e[0m " "$i"; ((i+1) % 16 == 0 && printf "\n"); done

# Test true color
printf "\e[38;2;255;100;0mTruecolor test\e[0m\n"
```

### Terminal Size
```bash
# Current size
echo "Columns: $COLUMNS"
echo "Lines: $LINES"

# Or using tput
tput cols
tput lines

# Or stty
stty size
```

### Terminal Info
```bash
# terminfo database entry
infocmp $TERM 2>/dev/null | head -30

# Specific capabilities
tput bold     # Bold text capability
tput sgr0     # Reset attributes
tput smcup    # Enter alternate screen
tput rmcup    # Exit alternate screen
```

## Font Configuration

```bash
# Check font settings
grep -A 10 'font' ~/.config/alacritty/alacritty.toml 2>/dev/null

# Common font settings:
# family = "JetBrains Mono"
# size = 11.0
# offset.x = 0
# offset.y = 0
```

### Font Rendering
```bash
# Check system fonts available
fc-list | grep -i "mono\|code" | head -10

# Check if specific font exists
fc-list | grep -i "JetBrains"
```

## Color Schemes

```bash
# View color scheme
grep -A 50 '\[colors\]' ~/.config/alacritty/alacritty.toml 2>/dev/null

# Colors sections typically include:
# [colors.primary]
# background = "#1e1e2e"
# foreground = "#cdd6f4"

# [colors.normal]
# black, red, green, yellow, blue, magenta, cyan, white

# [colors.bright]
# (bright variants)
```

## Keybindings

```bash
# View custom keybindings
grep -B 1 -A 4 'keyboard.bindings' ~/.config/alacritty/alacritty.toml 2>/dev/null

# Common bindings:
# Ctrl+Shift+C - Copy
# Ctrl+Shift+V - Paste
# Ctrl+Plus - Increase font size
# Ctrl+Minus - Decrease font size
```

## Window Configuration

```bash
# Window settings
grep -A 10 '\[window\]' ~/.config/alacritty/alacritty.toml 2>/dev/null

# Settings include:
# decorations = "full" | "none"
# opacity = 0.95
# padding.x = 5
# padding.y = 5
# startup_mode = "Windowed" | "Maximized" | "Fullscreen"
```

## Scrollback

```bash
# Check scrollback settings
grep -A 5 '\[scrolling\]' ~/.config/alacritty/alacritty.toml 2>/dev/null

# Default is usually 10000 lines
# history = 10000
# multiplier = 3
```

## GPU Rendering

```bash
# Check GPU info
glxinfo 2>/dev/null | grep -E "OpenGL renderer|OpenGL version" | head -5

# Or with vulkan
vulkaninfo 2>/dev/null | grep "GPU" | head -5

# Alacritty uses OpenGL for rendering
```

## Shell Integration

```bash
# Check which shell alacritty launches
grep 'program\|shell' ~/.config/alacritty/alacritty.toml 2>/dev/null

# Default uses $SHELL environment variable
echo "Default shell: $SHELL"
```

## Troubleshooting

### Rendering Issues
```bash
# Check if GPU acceleration works
glxgears 2>/dev/null &
sleep 2 && kill %1 2>/dev/null

# Check for software rendering fallback
grep -i 'renderer\|software' /var/log/Xorg.0.log 2>/dev/null | tail -5
```

### Font Issues
```bash
# Refresh font cache
fc-cache -fv 2>/dev/null | tail -5

# Check if font is available
fc-match "JetBrains Mono"
```

### Color Issues
```bash
# Verify TERM is set correctly
echo $TERM

# Check if tmux is overriding
echo "TMUX: $TMUX"
# tmux often sets TERM=tmux-256color
```

## Live Reload

Alacritty supports live config reload:
```bash
# Check if live reload is enabled
grep 'live_config_reload' ~/.config/alacritty/alacritty.toml 2>/dev/null

# Default is true - config changes apply immediately
```

## Environment Variables

```bash
# Alacritty-relevant environment
env | grep -E "^(TERM|COLORTERM|DISPLAY|WAYLAND_DISPLAY)" | sort
```

## Integration Patterns

### Detect Alacritty
```bash
# Multiple detection methods
if [[ "$TERM" == "alacritty" ]] || [[ "$TERM_PROGRAM" == "Alacritty" ]]; then
  echo "Definitely in Alacritty"
elif [[ "$COLORTERM" == "truecolor" ]]; then
  echo "Probably in a modern terminal (possibly Alacritty)"
fi
```

### Use Alacritty Features
```bash
# Change font size via escape codes (alacritty supports)
# Increase: Ctrl+Plus (or Ctrl+Shift+=)
# Decrease: Ctrl+Minus
# Reset: Ctrl+0

# Open URL under cursor: Ctrl+Click (if configured)
```

## Safety Considerations

- Config changes may apply immediately (live reload)
- Invalid config can prevent alacritty from starting
- Keep backup of working config
- Test changes before saving

## Relationship to Other Layers

- **Claude Code**: Output rendered by alacritty
- **tmux**: Runs inside alacritty, may override TERM
- **nvim**: Renders inside alacritty (or tmux in alacritty)
- **fish**: Launched by alacritty as default shell
- **Pop!_OS**: May use COSMIC terminal instead of alacritty
