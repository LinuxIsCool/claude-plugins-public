# Prompt Versioning System

This directory contains versioned prompts for the statusline plugin's AI-generated content.

## Structure

```
prompts/
├── config.yaml           # Active version configuration
├── README.md             # This file
├── name/
│   ├── 1_ecosystem_aware.md
│   └── (future versions...)
├── description/
│   └── 1_plugin_role.md
└── summary/
    └── 1_feature_level.md
```

## Version Naming Convention

```
<number>_<version_name>.md
```

- `number`: Sequential version number (1, 2, 3...)
- `version_name`: Descriptive snake_case name

Examples:
- `1_ecosystem_aware.md`
- `2_metaphorical_focus.md`
- `3_minimal_guidance.md`

## Prompt File Format

Each prompt file uses YAML frontmatter with full metadata:

```markdown
---
version: 1
name: ecosystem_aware
created: 2025-12-18
author: claude
rationale: |
  Why this version was created.
  What problem it solves or improvement it makes.
test_results: |
  - Observed behavior in testing
  - Strengths and weaknesses
  - Edge cases discovered
notes: |
  Additional context, insights, or caveats.
---

[Actual prompt content here]
```

## Configuration

Edit `config.yaml` to change active versions:

```yaml
active:
  name: 1_ecosystem_aware
  description: 1_plugin_role
  summary: 1_feature_level
```

Changes take effect on next Claude Code restart (after cache clear).

## Creating New Versions

1. **Copy** the current active version as a starting point
2. **Increment** the version number
3. **Name** it descriptively (what makes it different)
4. **Document** rationale in frontmatter
5. **Test** before switching active version
6. **Update** `config.yaml` to activate

Example workflow:
```bash
# Create new version
cp prompts/name/1_ecosystem_aware.md prompts/name/2_metaphorical_only.md

# Edit the new version
# ... make changes ...

# Update config.yaml
# active:
#   name: 2_metaphorical_only

# Clear cache and restart
rm -rf ~/.claude/plugins/cache/linuxiscool-claude-plugins/statusline/
```

## Iteration Philosophy

- **Never delete** old versions (git history helps, but explicit files are clearer)
- **Document failures** - negative results are valuable (note in test_results)
- **Small changes** - iterate incrementally, one hypothesis at a time
- **A/B testing** - log which version produced which output for analysis

---

## Prompt Functions

### name
Generates symbolic 1-2 word session names (callsigns).

| Aspect | Details |
|--------|---------|
| Trigger | First user prompt only |
| Input | `{user_prompt}` - First user message |
| Output | 1-2 words like "Oracle", "Crucible" |
| Philosophy | Metaphorical, evocative, domain-appropriate |

### description
Generates "[Plugin] [Role]" identity descriptors.

| Aspect | Details |
|--------|---------|
| Trigger | Every user prompt |
| Input | Session context, previous descriptions |
| Output | Two words like "Statusline Craftsman" |
| Philosophy | Literal plugin name + evocative role, stable across session |

### summary
Generates feature-level work summaries.

| Aspect | Details |
|--------|---------|
| Trigger | Every user prompt and Stop event |
| Input | Recent conversation context |
| Output | 5-10 word first-person summary |
| Philosophy | Specific but not too granular, names the domain |

---

## Testing Prompts

```bash
# Preview filled prompt without API call
./tools/test-prompts.py name --preview --user-prompt "Fix the login bug"

# Test with mock response (no API call)
./tools/test-prompts.py summary --mock "Debugging auth flow"

# Test against real API
./tools/test-prompts.py name --user-prompt "Help me refactor the database layer"
```

## Debug Mode

Enable debug output with environment variables:

```bash
DEBUG_NAME=1 claude        # Name generation debug
DEBUG_SUMMARY=1 claude     # Summary generation debug
DEBUG_DESCRIPTION=1 claude # Description generation debug
```

---

## Analyzing Results

Use the statusline JSONL log to analyze prompt effectiveness:

```bash
# Extract all generated names
jq -r 'select(.type=="name") | .value' ~/.claude/instances/statusline.jsonl

# Count name frequency
jq -r 'select(.type=="name") | .value' ~/.claude/instances/statusline.jsonl | sort | uniq -c | sort -rn

# Find descriptions that don't match format
jq -r 'select(.type=="description") | .value' ~/.claude/instances/statusline.jsonl | grep -v "^[A-Z][a-z]* [A-Z][a-z]*$"
```

---

## Legacy Files

The old flat files (`name.txt`, `description.txt`, `summary.txt`) are deprecated.
Python hooks now load from `prompts/<function>/<version>.md` based on `config.yaml`.
