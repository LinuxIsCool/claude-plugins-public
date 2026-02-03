# Baseline Management

Guide for creating and managing quality baselines.

## What is a Baseline?

A baseline is a reference point for quality metrics. It captures:
- Expected quality levels for a content type
- Thresholds for regression detection
- Historical quality trends

## Creating a Baseline

### From Evaluation Results

```bash
# Run evaluation and save results
uv run python -m src.cli briefing excellent-briefing.md --save

# Results saved to .claude/evaluation/results/eval_YYYYMMDD_HHMMSS_*.yaml
```

### Manual Baseline

Create `baselines/briefing-baseline.json`:
```json
{
  "type": "briefing",
  "created": "2026-01-05T14:00:00",
  "signal_to_noise": 0.82,
  "actionability": 0.78,
  "relevance": 0.85,
  "coherence": 0.80,
  "overall": 0.81
}
```

## Baseline Storage

```
.claude/evaluation/
├── baselines/
│   ├── briefing-baseline.json
│   ├── extraction-baseline.json
│   └── agent-output-baseline.json
├── results/
│   └── eval_*.yaml
└── hipporag/
    └── (HippoRAG data)
```

## Using Baselines

### Compare Against Baseline

```bash
uv run python -m src.cli compare baselines/briefing-baseline.json current-eval.json
```

### Update Baseline

When quality improves, update the baseline:

```bash
# Generate new metrics
uv run python -m src.cli briefing improved-briefing.md -o new-baseline.json
```

## Baseline Strategy

### Conservative Approach
- Set baseline at current average quality
- Catch any regression
- Good for preventing degradation

### Aspirational Approach
- Set baseline at best achieved quality
- Push toward higher standards
- May trigger many warnings initially

### Rolling Baseline
- Update baseline weekly/monthly
- Tracks quality trends over time
- Balances stability with improvement

## Best Practices

1. **Document why**: Include notes on what made the baseline content good
2. **Version control**: Commit baselines to git
3. **Separate by type**: Different baselines for briefings vs extractions
4. **Review regularly**: Baselines should evolve as quality improves
