# Statusline Plugin Changelog

## [0.4.0] - 2025-12-17

### Added
- **Claude Process Number (Cx)**: Monotonic counter showing spawn order (C1, C2, C3...)
  - Counter file: `.claude/instances/process_counter.txt`
  - Stored in registry as `process_number`
  - Replaces redundant short_id in session tracking

### Changed
- **Session tracking format**: `abc12:0#5` → `C39:0#5`
  - Cx = Claude process number (spawn order)
  - A = Agent session (compaction count)
  - N = Prompt count
- **Bold styling**: Agent name, last directory, branch name now bold
- **Summary line**: Now white and bold instead of dim

### Fixed
- `grep -c` exit code bug causing double "0" output when no matches found

## [0.3.0] - 2025-12-17

### Added
- Agent session counter derived from JSONL (counts compact/clear events)
- Elegant single-source-of-truth architecture (no state file needed)

### Changed
- Session tracking format evolved through iterations:
  - v1: `P:A#N` with emojis
  - v2: `6:0#15` (numbers only)
  - v3: `abc12:0#15` (short_id + agent + prompt)

### Fixed
- Relative path bug in `user-prompt-submit.sh` (used `.claude/instances` instead of `$CWD/.claude/instances`)

## [0.2.0] - 2025-12-16

### Added
- Auto-summary generation on Stop hook
- Auto-name generation on first prompt

## [0.1.0] - 2025-12-15

### Added
- Initial release with registry, statusline, and /instances command
- Self-naming capability for Claude instances
- Session tracking with prompt count
