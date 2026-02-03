# Optimizer Sub-Skill

Generating and applying performance optimizations.

## Optimization Categories

### 1. Cache Optimizations

**Problem**: Stale or bloated plugin cache

**Detection**:
- Stale plugins (source newer than cache)
- Cache size > 200 MB
- Plugin count > 30

**Solutions**:

```bash
# Clear all stale caches
/dev-tools:reload all

# Clear specific plugin cache
rm -rf ~/.claude/plugins/cache/linuxiscool-claude-plugins/PLUGIN_NAME

# Enable dev-mode for active development
# (Creates symlinks instead of copies)
bash plugins/dev-tools/dev-mode.sh enable PLUGIN_NAME
```

### 2. Hook Optimizations

**Problem**: Slow hooks blocking startup or operations

**Detection**:
- Any hook > 100ms average
- SessionStart hooks > 50ms each
- Many hooks on same event type

**Solutions**:

**Consolidate related hooks**: If multiple hooks do similar work, combine them.

Example: Statusline plugin unified 3 hooks into 1:
- Before: auto-name.py, auto-description.py, auto-summary.py (15+ seconds)
- After: auto-identity.py single call (3-5 seconds)

**Move work to background**: Use async patterns for non-blocking operations.

```python
# Instead of blocking
result = expensive_operation()

# Use background process
(expensive_operation() &)
```

**Add fast-path exits**: Skip work when not needed.

```python
# Check condition first
if not should_run():
    sys.exit(0)
# Only then do expensive work
```

### 3. Startup Optimizations

**Problem**: Claude Code slow to become responsive

**Detection**:
- Total SessionStart time > 500ms
- Multiple plugins loading on startup
- Large CLAUDE.md or settings files

**Solutions**:

**Prune unused plugins**: Remove plugins you don't use.

```bash
# List installed plugins
ls ~/.claude/plugins/cache/*/

# Check if plugin is needed
grep -r "PLUGIN_NAME" .claude/ plugins/
```

**Lazy-load skills**: Use master skill pattern so sub-skills only load when needed.

**Optimize CLAUDE.md**: Keep it focused; move detailed docs to skill files.

### 4. Tool Optimizations

**Problem**: Individual tool calls taking too long

**Detection**:
- Read operations > 50ms average
- Bash commands > 100ms average
- Frequent small operations

**Solutions**:

**Batch operations**: Instead of many small reads, read once.

```python
# Instead of
for file in files:
    content = read(file)

# Use glob and read multiple
files = glob("*.py")
contents = {f: read(f) for f in files[:10]}
```

**Cache expensive results**: Store computed results for reuse.

**Use faster alternatives**:
- `Glob` instead of `find` in Bash
- `Grep` instead of `grep` in Bash
- Specific paths instead of broad searches

## Optimization Workflow

1. **Measure First**: Run `/perf:start baseline`
2. **Work Normally**: Perform typical operations
3. **Get Baseline**: Run `/perf:stop`
4. **Apply Fix**: Make one optimization
5. **Measure Again**: Run `/perf:start after-fix`
6. **Compare**: Run `/perf:history`
7. **Repeat**: One optimization at a time

## Recommended Priorities

| Priority | Issue | Impact | Effort |
|----------|-------|--------|--------|
| High | Stale caches | Immediate | Low |
| High | > 500ms startup | Every session | Medium |
| Medium | Large cache | Disk + scans | Low |
| Medium | Slow hooks | Per-event | High |
| Low | Tool timing | Per-operation | Medium |

## Anti-Patterns to Avoid

1. **Premature optimization**: Measure first, optimize second
2. **Over-consolidation**: Some separation is good for maintainability
3. **Caching everything**: Only cache expensive operations
4. **Ignoring stale caches**: Always clear before measuring
