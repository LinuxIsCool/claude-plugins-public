---
name: plugin-developer
description: Develop and hot-reload Claude Code plugins. Use when creating plugins, modifying skills/commands/hooks, clearing plugin cache, or refreshing plugins without full restart. Handles the development cycle of edit → validate → clear cache → reload.
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, Task
---

# Plugin Developer Skill

Streamline Claude Code plugin development with cache management and hot-reload capabilities.

## The Development Cycle

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐     ┌──────────┐
│ Edit Source │ ──▶ │   Validate   │ ──▶ │ Clear Cache │ ──▶ │  Reload  │
│  (plugins/) │     │  (structure) │     │  (~/.claude)│     │ (restart)│
└─────────────┘     └──────────────┘     └─────────────┘     └──────────┘
```

## Plugin Cache Location

Claude Code caches plugins at:
```
~/.claude/plugins/cache/{marketplace-name}/{plugin-name}/{version}/
```

For this repository:
```
~/.claude/plugins/cache/linuxiscool-claude-plugins/
├── agents/0.1.0/
├── awareness/0.1.0/
├── llms/0.1.0/
└── ...
```

## Quick Commands

### Clear All Plugin Caches
```bash
rm -rf ~/.claude/plugins/cache/linuxiscool-claude-plugins/
```

### Clear Specific Plugin Cache
```bash
rm -rf ~/.claude/plugins/cache/linuxiscool-claude-plugins/{plugin-name}/
```

### Validate Plugin Structure
```bash
# Check for required files
ls plugins/{plugin-name}/.claude-plugin/plugin.json

# Count skills
find plugins/{plugin-name}/skills -name "SKILL.md" | wc -l

# Check skill descriptions
grep "^description:" plugins/{plugin-name}/skills/*/SKILL.md
```

## Validation Checklist

### Plugin Level
- [ ] `plugins/{name}/.claude-plugin/plugin.json` exists
- [ ] plugin.json has required fields: name, version, description
- [ ] Plugin registered in `.claude-plugin/marketplace.json`

### Skill Level
- [ ] `SKILL.md` has YAML frontmatter with `---` delimiters
- [ ] Frontmatter has `name` field
- [ ] Frontmatter has `description` field (under 1024 chars recommended)
- [ ] Optional: `allowed-tools` field for tool restrictions

### Command Level
- [ ] Command files in `commands/` directory
- [ ] Markdown format with clear instructions
- [ ] `$ARGUMENTS` placeholder for user input

### Hook Level
- [ ] Hooks defined in plugin.json under `hooks` key
- [ ] Hook scripts exist and are executable
- [ ] Scripts handle JSON input/output correctly

## Development Workflow

### 1. Make Changes
Edit files in the source directory:
```
plugins/{plugin-name}/
├── .claude-plugin/plugin.json
├── skills/
│   └── {skill-name}/SKILL.md
├── commands/
│   └── {command-name}.md
└── hooks/
    └── {hook-script}.py
```

### 2. Validate Changes
```bash
# Check plugin.json is valid JSON
python -c "import json; json.load(open('plugins/{name}/.claude-plugin/plugin.json'))"

# Check SKILL.md frontmatter
head -10 plugins/{name}/skills/{skill}/SKILL.md

# Check description length
grep "^description:" plugins/{name}/skills/*/SKILL.md | while read line; do
  echo "${#line} chars: ${line:0:80}..."
done
```

### 3. Clear Cache
```bash
# Clear specific plugin
rm -rf ~/.claude/plugins/cache/linuxiscool-claude-plugins/{plugin-name}/

# Or clear all
rm -rf ~/.claude/plugins/cache/linuxiscool-claude-plugins/
```

### 4. Reload
Two options:
1. **Full restart**: Exit and restart Claude Code (cleanest)
2. **Soft reload**: Use `/plugin` commands (if available)

## Common Issues

### Skills Not Appearing
1. Check SKILL.md has valid YAML frontmatter
2. Verify plugin is in marketplace.json
3. Clear cache and restart
4. Check for truncation (too many skills)

### Skills Truncated
- Claude Code has ~15,000 char budget for skill descriptions
- Use master skill pattern (hierarchical skills)
- Keep descriptions concise

### Cache Not Clearing
```bash
# Force clear with sudo if needed (shouldn't be necessary)
rm -rf ~/.claude/plugins/cache/

# Check permissions
ls -la ~/.claude/plugins/
```

### Plugin Not Loading
1. Check marketplace.json syntax (valid JSON)
2. Verify source path is correct
3. Check plugin.json exists at source path
4. Look for errors in Claude Code startup

## Inline Reload Function

When developing, use this pattern to quickly test changes:

```python
#!/usr/bin/env python3
"""Plugin cache clearer - run after making changes"""
import shutil
from pathlib import Path

CACHE_DIR = Path.home() / ".claude/plugins/cache/linuxiscool-claude-plugins"

def clear_plugin_cache(plugin_name: str = None):
    """Clear plugin cache for quick reload."""
    if plugin_name:
        target = CACHE_DIR / plugin_name
    else:
        target = CACHE_DIR

    if target.exists():
        shutil.rmtree(target)
        print(f"Cleared: {target}")
    else:
        print(f"Not found: {target}")

    print("\n⚠️  Restart Claude Code to load fresh plugins")

if __name__ == "__main__":
    import sys
    plugin = sys.argv[1] if len(sys.argv) > 1 else None
    clear_plugin_cache(plugin)
```

Save as `tools/clear_plugin_cache.py` and run:
```bash
python tools/clear_plugin_cache.py           # Clear all
python tools/clear_plugin_cache.py awareness # Clear specific
```

## Testing Skill Changes

### Quick Test Pattern
1. Make change to SKILL.md
2. Clear cache: `rm -rf ~/.claude/plugins/cache/linuxiscool-claude-plugins/{plugin}/`
3. In new Claude session: `Skill({plugin}:{skill})`
4. Verify behavior

### Test Skill Discovery
After restart, check if skill appears:
```
User: "What skills do you have?"
# Look for your skill in the list
```

### Test Skill Invocation
```
User: "Use the {skill-name} skill to help me with X"
# Or directly: Skill({plugin}:{skill})
```

## Master Skill Pattern

For plugins with many skills, use hierarchical structure:
```
plugins/{plugin}/skills/
└── {plugin}-master/
    ├── SKILL.md           # Master skill (discoverable)
    └── subskills/         # Sub-skills (loaded via Read)
        ├── skill1.md
        ├── skill2.md
        └── ...
```

Benefits:
- Only master SKILL.md consumes discovery budget
- Sub-skills loaded on demand via Read tool
- Scales to 100+ skills per plugin

## Integration with Awareness

This skill complements:
- **plugin-studier** - Understand existing plugins
- **skill-creator** - Create new skills
- **techniques** - Practice plugin development patterns

Development cycle:
```
plugin-studier (learn) → skill-creator (build) → plugin-developer (test/reload)
```
