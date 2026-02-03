# Cook Plugin

Meta-orchestration engine for recursive self-improvement.

## Quick Start

```
/cook              # Start infinite OODA+L loop
/cook status       # Quick status check (no loop)
/cook steer "..."  # Add steering input
/cook stop         # Signal graceful shutdown
```

## Architecture

Cook implements the OODA loop enhanced with Learning:

```
OBSERVE → ORIENT → DECIDE → ACT → LEARN → (loop)
                                    ↓
                              SELF-IMPROVE
```

See `ARCHITECTURE.md` for complete design.

## Data Locations

| Data | Path |
|------|------|
| Goals | `.claude/cook/goals/hierarchy.yaml` |
| Emergence Feed | `.claude/cook/emergence/feed.yaml` |
| Sources Config | `.claude/cook/emergence/sources.yaml` |
| Role Models | `.claude/cook/rolemodels/registry.yaml` |
| Learning Log | `.claude/cook/learning/log.yaml` |

## Agents

| Agent | Purpose | Model |
|-------|---------|-------|
| `cook:cook` | Main orchestration | opus |
| `cook:emergence-tracker` | Web discovery | sonnet |
| `cook:self-improver` | System enhancement | opus |

## Sub-Skills

| Sub-Skill | Phase |
|-----------|-------|
| `observe` | Scan environment |
| `orient` | Assemble context |
| `decide` | Select actions |
| `act` | Execute via agents |
| `learn` | Record outcomes |
| `improve` | Self-modification |

## Orchestration Patterns

1. **Direct** - Cook uses tools
2. **Single** - Delegate to one agent
3. **Ensemble** - Parallel agents, synthesize
4. **Pipeline** - Sequential chain
5. **Swarm** - Emergent coordination

## Development

```bash
# Clear cache after changes
rm -rf ~/.claude/plugins/cache/linuxiscool-claude-plugins/cook/

# Restart Claude Code to pick up changes
```
