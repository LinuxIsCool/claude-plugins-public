---
name: plug
description: Plugin manager command. Use /plug to manage Claude Code plugins.
argument-hint: [list|install|remove|update|sync|status] [plugin-name]
---

# /plug - Plugin Manager

Invoke the plug skill to manage your Claude Code plugins.

## Usage

```
/plug                    # Show status
/plug list               # List installed plugins
/plug install user/repo  # Install from GitHub
/plug remove plugin-name # Remove a plugin
/plug update             # Update all plugins
/plug update plugin-name # Update specific plugin
/plug sync               # Sync with plug.lua
/plug status             # Health check
```

## Execute

Invoke the plug skill with arguments:

```
/skill plug $ARGUMENTS
```
