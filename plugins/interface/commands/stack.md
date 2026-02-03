# Show Interface Stack

Detect and display the current interface stack context.

## What To Do

Run the following detection commands and present the results clearly:

```bash
echo "=== Interface Stack Context ==="
echo ""

# Layer 1: Claude Code
echo "Claude Code: Active (you're here)"
echo ""

# Layer 2: tmux
if [[ -n "$TMUX" ]]; then
  TMUX_SESSION=$(tmux display-message -p '#S' 2>/dev/null)
  TMUX_WINDOW=$(tmux display-message -p '#W' 2>/dev/null)
  TMUX_PANE=$(tmux display-message -p '#P' 2>/dev/null)
  echo "tmux: Session '$TMUX_SESSION', Window '$TMUX_WINDOW', Pane $TMUX_PANE"
else
  echo "tmux: Not active"
fi
echo ""

# Layer 3: nvim
if [[ -n "$NVIM" ]]; then
  echo "nvim: Active (embedded in nvim terminal)"
  echo "  Socket: $NVIM"
else
  echo "nvim: Not active (standalone)"
fi
echo ""

# Layer 4: Shell
echo "Shell: $SHELL"
echo "  (Note: Bash tool uses bash regardless of login shell)"
echo ""

# Layer 5: Terminal
echo "Terminal: TERM=$TERM"
if [[ -n "$COLORTERM" ]]; then
  echo "  COLORTERM=$COLORTERM"
fi
if [[ -n "$TERM_PROGRAM" ]]; then
  echo "  TERM_PROGRAM=$TERM_PROGRAM"
fi
echo ""

# Layer 6: Kernel
echo "Kernel: $(uname -r)"
echo ""

# Layer 7: Distribution
echo "OS: $(cat /etc/os-release 2>/dev/null | grep PRETTY_NAME | cut -d'"' -f2)"
echo ""

echo "=== Stack Summary ==="
echo "User → Claude Code"
[[ -n "$TMUX" ]] && echo "     → tmux ($TMUX_SESSION:$TMUX_WINDOW.$TMUX_PANE)"
[[ -n "$NVIM" ]] && echo "     → nvim (terminal buffer)"
echo "     → $SHELL"
echo "     → $TERM"
echo "     → Kernel $(uname -r)"
echo "     → $(cat /etc/os-release 2>/dev/null | grep ^ID= | cut -d= -f2)"
```

After showing the stack, offer:

1. **Deep dive**: "Would you like details on any specific layer?"
2. **Interface skill**: "Use `Skill(interface:interface)` for the full interface navigation skill"
3. **Navigator agent**: "Spawn `interface:interface-navigator` for comprehensive stack analysis"

$ARGUMENTS
