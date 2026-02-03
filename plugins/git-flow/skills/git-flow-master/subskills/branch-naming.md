# Branch Naming Sub-Skill

Detailed guidance for branch naming conventions.

## Naming Format

```
{prefix}/{agent-name}-{agent-id}-{title}
```

### Components

| Component | Description | Example |
|-----------|-------------|---------|
| `prefix` | Type of work | `feature`, `fix`, `refactor` |
| `agent-name` | Claude instance name | `claude`, `archivist`, `scribe` |
| `agent-id` | First 8 chars of session ID | `a3e7b2c1` |
| `title` | Descriptive title | `dark-mode-toggle` |

### Valid Prefixes

| Prefix | Use For |
|--------|---------|
| `feature` | New functionality |
| `fix` | Bug fixes |
| `refactor` | Code restructuring |
| `docs` | Documentation changes |
| `test` | Test additions/changes |
| `chore` | Maintenance tasks |

## Examples

```
feature/claude-a3e7b2c1-dark-mode-toggle
fix/archivist-f1d2e3a4-registry-parsing
refactor/scribe-b5c6d7e8-journal-structure
docs/claude-9a8b7c6d-api-documentation
```

## Generating Branch Names

### With Explicit Title

```bash
python3 ${CLAUDE_PLUGIN_ROOT}/tools/branch.py generate --title "dark mode toggle"

# Output: {"branch_name": "feature/claude-a3e7b2c1-dark-mode-toggle", ...}
```

### From Context (Haiku-generated)

```bash
python3 ${CLAUDE_PLUGIN_ROOT}/tools/branch.py generate --context "Adding a toggle in settings to enable dark mode theme"

# Haiku generates title from context
```

### With Prefix Override

```bash
python3 ${CLAUDE_PLUGIN_ROOT}/tools/branch.py generate --title "login bug" --prefix fix

# Output: {"branch_name": "fix/claude-a3e7b2c1-login-bug", ...}
```

## Validation

```bash
python3 ${CLAUDE_PLUGIN_ROOT}/tools/branch.py validate "feature/claude-a3e7b2c1-dark-mode"

# Output:
# {"valid": true, "branch_name": "feature/claude-a3e7b2c1-dark-mode", "issues": []}
```

### Common Validation Issues

- Missing prefix separator (no `/`)
- Invalid prefix (not in allowed list)
- Missing agent-id pattern (no `name-id-` structure)
- Invalid characters (uppercase, special chars)
- Too long (>100 chars)

## Parsing Branch Names

```bash
python3 ${CLAUDE_PLUGIN_ROOT}/tools/branch.py parse "feature/claude-a3e7b2c1-dark-mode"

# Output:
# {
#   "branch_name": "feature/claude-a3e7b2c1-dark-mode",
#   "prefix": "feature",
#   "agent_name": "claude",
#   "agent_id": "a3e7b2c1",
#   "title": "dark-mode"
# }
```

## Agent Name Resolution

Agent names come from statusline registry. The tool checks:

1. `CLAUDE_SESSION_ID` environment variable
2. Statusline registry at `~/.claude/statusline/registry.json`
3. Fallback to `CLAUDE_AGENT_NAME` env var
4. Default to "claude"

## Title Sanitization

Titles are sanitized for git/filesystem safety:

- Lowercased
- Spaces → hyphens
- Special characters → hyphens
- Multiple hyphens collapsed
- Max 40 characters
- Leading/trailing hyphens stripped

Examples:
- "Dark Mode Toggle" → "dark-mode-toggle"
- "Fix: Auth Bug #123" → "fix-auth-bug-123"
- "Add user settings (v2)" → "add-user-settings-v2"
