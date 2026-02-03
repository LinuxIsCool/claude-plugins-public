---
name: evaluation
description: Master skill for automated quality evaluation (5 sub-skills). Covers HippoRAG setup, briefing evaluation, extraction evaluation, baseline management, and regression detection. Invoke for quality assessment, evaluation metrics, or testing before automation.
allowed-tools: Read, Bash, Glob, Grep, Skill, Task
---

# Evaluation Plugin - Master Skill

Automated quality evaluation for the claude-plugins ecosystem using HippoRAG.

## Philosophy

**Quality before automation.** This plugin exists because we recognized that feeding low-quality information to Claude instances is worse than feeding nothing. The evaluation system lets us:

1. **Test** briefings and extractions manually
2. **Measure** quality with multi-dimensional metrics
3. **Iterate** until quality meets thresholds
4. **Then automate** with confidence

## Sub-Skills Index

| Sub-Skill | Use When | File |
|-----------|----------|------|
| **hipporag-setup** | Setting up HippoRAG, indexing knowledge | `subskills/hipporag-setup.md` |
| **briefing-eval** | Evaluating Conductor briefings | `subskills/briefing-eval.md` |
| **extraction-eval** | Evaluating Archivist extractions | `subskills/extraction-eval.md` |
| **baseline-mgmt** | Creating and managing quality baselines | `subskills/baseline-mgmt.md` |
| **regression** | Detecting quality regression | `subskills/regression.md` |

## Quick Reference

### Evaluate a Briefing

```bash
cd /home/user/path
uv run python -m src.cli briefing path/to/briefing.md
```

### Evaluate an Extraction

```bash
uv run python -m src.cli extraction path/to/extraction.md --source SESSION_ID
```

### Quality Dimensions

| Dimension | What It Measures | Briefing | Extraction |
|-----------|------------------|----------|------------|
| Signal-to-Noise | Useful info vs filler | Yes | No |
| Actionability | Clear next steps | Yes | No |
| Accuracy | Factual correctness | No | Yes |
| Completeness | All points captured | No | Yes |
| Relevance | Content value | Yes | Yes |
| Coherence | Organization | Yes | Yes |

### Quality Gates (Minimum Thresholds)

| Gate | Threshold | Meaning |
|------|-----------|---------|
| Signal-to-Noise | 0.60 | At least 60% useful content |
| Actionability | 0.50 | At least some clear actions |
| Accuracy | 0.70 | High factual correctness |
| Relevance | 0.60 | Mostly relevant content |
| Overall | 0.60 | Weighted average passes |

## Architecture

```
evaluation/
├── src/
│   ├── evaluator.py   # Core HippoRAG-based evaluator
│   ├── dimensions.py  # Evaluation dimensions and prompts
│   ├── metrics.py     # Quality metrics and gates
│   └── cli.py         # Command-line interface
├── skills/            # This documentation
├── commands/          # /eval slash command
└── agents/            # Evaluator agent
```

## Integration Points

- **Conductor**: Evaluate briefings before enabling SessionStart hook
- **Archivist**: Evaluate extractions before enabling SessionEnd hook
- **Any Agent**: Evaluate any agent output for quality

## Usage Pattern

1. Generate output manually (briefing, extraction)
2. Run evaluation: `uv run python -m src.cli ...`
3. Review scores and reasoning
4. Iterate until quality gates pass
5. Once quality is proven, consider automation
