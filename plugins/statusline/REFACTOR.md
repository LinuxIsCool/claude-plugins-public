# Statusline Plugin Refactor Plan

**Status**: COMPLETED (2025-12-18)

This document tracked the refactoring of the statusline plugin. The work is now complete.

## Summary of Changes

### Problem Solved
- System freezes (15+ seconds) when opening new Claude sessions
- Data corruption where sessions lost their names
- Prompts inferring from directory path instead of user intent

### Solution Implemented
Consolidated 3 separate hooks into 1 unified hook:
- **Before**: `auto-name.py`, `auto-description.py`, `auto-summary.py` (3 subprocess calls)
- **After**: `auto-identity.py` (1 subprocess call, 3x faster)

### New Architecture
```
hooks/auto-identity.py
  └─> Single API call with JSON output
      └─> {"name":"X","description":"Y","summary":"Z"}
          └─> Saves to respective locations
```

### Versioned Prompt System
```
prompts/
├── config.yaml           # Maps element → active version
├── name/
│   └── 1_ecosystem_aware.md
├── description/
│   └── 1_plugin_role.md
└── summary/
    └── 1_feature_level.md
```

Template variables filled via Python's `.format()`.

## Completed Phases

### Phase 1: Logging (COMPLETE)
- JSONL logging at `~/.claude/instances/statusline.jsonl`
- Events: session_start, prompt_count, name, description, summary, etc.

### Phase 2: Code Review (COMPLETE)
- Identified race conditions from 3 concurrent hooks
- Found data corruption in auto-register logic
- Documented prompt inference issues

### Phase 3: Refactor (COMPLETE)
- Unified 3 hooks into `auto-identity.py`
- Added `multiline` param to `generate_with_backend()`
- Created versioned prompt system
- Fixed auto-register to preserve existing data

### Phase 4: Validation (ONGOING)
- Initial testing shows improved performance
- Prompt quality iteration continues via versioned files
- User feedback loop active

## Design Principles (Maintained)

| Element | Rule |
|---------|------|
| Name | 1-2 words, symbolic, never changes after init |
| Description | 2 words: `[Plugin] [Role]`, stable |
| Summary | 5-10 words, updates every prompt/stop |

## Future Work
See `ROADMAP.md` for strategic evolution plans.
