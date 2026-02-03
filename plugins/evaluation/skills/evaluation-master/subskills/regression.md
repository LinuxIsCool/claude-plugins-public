# Regression Detection

Guide for detecting quality regression.

## What is Quality Regression?

Quality regression occurs when:
- New content scores lower than baseline
- Changes to generation process reduce quality
- Automation produces worse results than manual

## Running Regression Check

```bash
cd /home/user/path

# Compare current against baseline
uv run python -m src.cli compare baseline.json current.json

# With custom threshold (default: 10%)
uv run python -m src.cli compare baseline.json current.json --threshold 0.05
```

## Regression Thresholds

| Threshold | Meaning | Use Case |
|-----------|---------|----------|
| 5% | Strict | Critical content, catch small changes |
| 10% | Standard | Normal monitoring |
| 20% | Lenient | Variable content, focus on major issues |

## Interpreting Results

### No Regression
```
Quality Comparison
┌──────────────────┬──────────┬─────────┬─────────┐
│ Metric           │ Baseline │ Current │ Change  │
├──────────────────┼──────────┼─────────┼─────────┤
│ Signal To Noise  │     0.82 │    0.85 │ +3.7%   │
│ Actionability    │     0.78 │    0.80 │ +2.6%   │
│ Overall          │     0.81 │    0.83 │ +2.5%   │
└──────────────────┴──────────┴─────────┴─────────┘

No regression detected
```

### Regression Detected
```
Quality Comparison
┌──────────────────┬──────────┬─────────┬─────────┐
│ Metric           │ Baseline │ Current │ Change  │
├──────────────────┼──────────┼─────────┼─────────┤
│ Signal To Noise  │     0.82 │    0.68 │ -17.1%  │
│ Actionability    │     0.78 │    0.72 │ -7.7%   │
│ Overall          │     0.81 │    0.70 │ -13.6%  │
└──────────────────┴──────────┴─────────┴─────────┘

Regression Warnings:
  ! Signal-to-Noise degraded by 17.1% (0.82 -> 0.68)
  ! Overall degraded by 13.6% (0.81 -> 0.70)
```

## Common Causes of Regression

### Briefing Regression
- Template changes adding boilerplate
- Including less relevant context
- Over-generalizing content

### Extraction Regression
- Prompts changed to be less specific
- Source sessions are more complex
- Processing pipeline changes

## Responding to Regression

1. **Identify the cause**: What changed since baseline?
2. **Review examples**: Compare high vs low quality outputs
3. **Adjust process**: Fix templates, prompts, or pipelines
4. **Re-test**: Run evaluation again
5. **Update baseline**: Once quality restored/improved

## Automated Regression Checks

Once evaluation is trusted, consider:

```bash
# In CI/CD or hook
uv run python -m src.cli compare baseline.json latest.json
if [ $? -ne 0 ]; then
    echo "Quality regression detected!"
    exit 1
fi
```

This prevents automation of degraded content.
