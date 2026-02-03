---
name: fish
description: Fish shell layer - completions, abbreviations, functions, variables, and fish-specific features distinct from bash/zsh.
allowed-tools: Bash, Read, Glob
---

# fish Layer

Fish (Friendly Interactive Shell) is a smart, user-friendly command line shell. While Claude Code's Bash tool uses bash, fish is often the user's login shell, affecting the environment.

## Detection

```bash
# Check login shell
echo "Login shell: $SHELL"

# Is fish available?
which fish 2>/dev/null && fish --version

# Check if fish config exists
ls -la ~/.config/fish/config.fish 2>/dev/null
```

## Important Distinction

**Claude Code's Bash tool runs bash**, even if fish is the login shell. However:
- Environment variables may originate from fish config
- User expects fish-style completions in their terminal
- Some fish-specific features won't work in Bash tool

## Configuration

### Config File Location
```bash
# Main config
cat ~/.config/fish/config.fish 2>/dev/null | head -50

# Config directory structure
ls -la ~/.config/fish/
# conf.d/        - Auto-loaded config snippets
# functions/     - User functions
# completions/   - Custom completions
# fish_variables - Universal variables
```

### Config Snippets
```bash
# Auto-loaded configs
ls ~/.config/fish/conf.d/ 2>/dev/null

# View a snippet
cat ~/.config/fish/conf.d/*.fish 2>/dev/null | head -30
```

## Abbreviations

Abbreviations expand as you type (different from aliases):

```bash
# List all abbreviations (run in fish)
fish -c "abbr --show"

# Common abbreviations might include:
# g → git
# gst → git status
# gco → git checkout
```

### Checking Abbreviations
```bash
# Show all abbreviations
fish -c "abbr --list"

# Show with expansions
fish -c "abbr --show" | head -20
```

## Functions

Fish functions are the primary way to extend fish:

```bash
# List user functions
ls ~/.config/fish/functions/ 2>/dev/null

# View a specific function
cat ~/.config/fish/functions/*.fish 2>/dev/null | head -30

# List all defined functions (including built-ins)
fish -c "functions --names" | head -30
```

### View Function Definition
```bash
# See what a function does
fish -c "functions some_function_name"
```

## Completions

Fish has powerful tab completion:

```bash
# User-defined completions
ls ~/.config/fish/completions/ 2>/dev/null

# System completions
ls /usr/share/fish/completions/ 2>/dev/null | head -20

# View a completion file
cat ~/.config/fish/completions/*.fish 2>/dev/null | head -30
```

## Variables

### Universal Variables
Persist across sessions and shells:
```bash
# View universal variables
fish -c "set -U" | head -20

# These are stored in:
cat ~/.config/fish/fish_variables 2>/dev/null | head -20
```

### Exported Variables
Available to child processes:
```bash
# View exported variables
fish -c "set -x" | head -20
```

### Path
Fish handles PATH specially:
```bash
# View fish path
fish -c "echo \$fish_user_paths"
fish -c "echo \$PATH" | tr ' ' '\n' | head -10
```

## Fish-Specific Syntax

Things that work in fish but NOT in bash:

```fish
# Variable setting (fish)
set variable value          # not: variable=value

# Command substitution (fish)
set result (command)        # not: result=$(command)

# Conditionals (fish)
if test condition           # different syntax
    command
end

# Loops (fish)
for item in list
    command
end
```

## Running Fish Commands from Bash Tool

Since Claude Code uses bash, run fish explicitly:

```bash
# Run a fish command
fish -c "echo 'Hello from fish'"

# Run with login config
fish -l -c "echo \$fish_user_paths"

# Interactive fish subshell (avoid in Claude Code)
# fish -i  # Don't use - will hang
```

## Plugin Managers

### Fisher
```bash
# Check if fisher is installed
fish -c "type fisher" 2>/dev/null

# List fisher plugins
cat ~/.config/fish/fish_plugins 2>/dev/null

# Fisher-installed plugins
ls ~/.config/fish/functions/ 2>/dev/null | head -20
```

### Oh My Fish
```bash
# Check if OMF is installed
fish -c "type omf" 2>/dev/null

# OMF directory
ls ~/.local/share/omf/ 2>/dev/null
```

## Environment Variables

Fish config often sets environment variables:

```bash
# Common exports from fish config
fish -c "set -x" | grep -E "^(EDITOR|VISUAL|PAGER|BROWSER|TERM)"

# Check specific variable
fish -c "echo \$EDITOR"
```

## Themes and Prompts

```bash
# Current prompt function
fish -c "functions fish_prompt"

# Check for starship
fish -c "type starship" 2>/dev/null && starship --version

# Starship config
cat ~/.config/starship.toml 2>/dev/null | head -30
```

## Integration Patterns

### Get Fish Variable in Bash Tool
```bash
# Read a fish variable
fish -c 'echo $some_variable'

# Read path
fish -c 'echo $PATH' | tr ' ' '\n'
```

### Use Fish Function from Bash Tool
```bash
# Call a fish function
fish -c "my_function arg1 arg2"
```

### Check User's Fish Setup
```bash
# Full environment dump (abbreviated)
fish -c "set" | head -50
```

## Common Fish Features

### Syntax Highlighting
- Fish highlights valid commands green, invalid red
- File paths that exist are underlined
- Works in terminal but not in Bash tool output

### Autosuggestions
- Fish suggests commands based on history
- Accept with right arrow
- Only works in interactive fish

### History
```bash
# Fish history location
cat ~/.local/share/fish/fish_history 2>/dev/null | tail -30

# Search history (from fish)
fish -c "history search 'pattern'" 2>/dev/null | head -10
```

## Safety Considerations

- Don't modify fish configs without understanding impact
- Some changes require fish restart to take effect
- Universal variables persist permanently
- Functions can override built-in commands

## Relationship to Other Layers

- **Claude Code**: Bash tool uses bash, not fish
- **tmux**: Panes typically run fish as shell
- **nvim**: :terminal runs user's shell (fish)
- **alacritty**: Launches fish as default shell
