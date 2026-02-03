# Briefing Evaluation

Guide for evaluating Conductor briefings.

## What Makes a Good Briefing?

A high-quality briefing should:

1. **High signal-to-noise**: Every sentence provides value
2. **Actionable**: Clear next steps or focus areas
3. **Relevant**: Tailored to the session context
4. **Coherent**: Well-organized and easy to scan

## Running Briefing Evaluation

```bash
cd /home/user/path

# Basic evaluation
uv run python -m src.cli briefing path/to/briefing.md

# With session context
uv run python -m src.cli briefing briefing.md --session "Morning session focused on library plugin"
```

## Evaluation Dimensions

| Dimension | Weight | Gate |
|-----------|--------|------|
| Signal-to-Noise | 25% | 0.60 |
| Actionability | 25% | 0.50 |
| Relevance | 20% | 0.60 |
| Coherence | 15% | - |

## Interpreting Results

### Signal-to-Noise Score

| Score | Meaning |
|-------|---------|
| 0.9+ | Almost pure signal, every word matters |
| 0.7-0.9 | Good density, minor filler |
| 0.5-0.7 | Mixed, needs tightening |
| <0.5 | Too much noise, major revision needed |

### Actionability Score

| Score | Meaning |
|-------|---------|
| 0.9+ | Crystal clear actions, could execute immediately |
| 0.7-0.9 | Clear direction with some interpretation needed |
| 0.5-0.7 | Vague suggestions, needs more specificity |
| <0.5 | No actionable content |

## Example: Improving a Low-Scoring Briefing

**Before** (Signal-to-Noise: 0.4):
> The ecosystem continues to evolve and develop. There are many plugins that do various things. The journal system is important for tracking work. Sessions are happening regularly.

**After** (Signal-to-Noise: 0.85):
> Focus: Library plugin needs migration validation. Key files: plugins/library/src/migrator.py (92 resources pending). Blocked by: FalkorDB indexing issue from session 4349eb9c.

## Integration with Conductor

Once briefing quality is validated:

1. Save high-quality briefings as examples
2. Analyze what makes them work
3. Update Conductor's briefing template
4. Test again until quality gates pass consistently
5. Only then consider SessionStart automation
