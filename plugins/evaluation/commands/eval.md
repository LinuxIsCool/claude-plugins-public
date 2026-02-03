---
name: eval
description: Evaluate content quality (briefings, extractions, agent outputs) using HippoRAG-powered multi-dimensional assessment
allowed-tools: Bash, Read, Write
---

# /eval Command

Evaluate ecosystem content for quality using multi-dimensional assessment.

## Usage

```bash
# Evaluate a briefing
uv run python -m evaluation.src.cli briefing path/to/briefing.md

# Evaluate an extraction
uv run python -m evaluation.src.cli extraction path/to/extraction.md --source session_id

# Evaluate any content
uv run python -m evaluation.src.cli evaluate path/to/content.md --type agent_output

# Index knowledge for better context
uv run python -m evaluation.src.cli index doc1.md doc2.md --dir ./knowledge/

# Compare against baseline
uv run python -m evaluation.src.cli compare baseline.json current.json

# Show quality gates
uv run python -m evaluation.src.cli gates
```

## What This Evaluates

### Briefings (Conductor)
- **Signal-to-Noise**: Is the information useful vs filler?
- **Actionability**: Are there clear next steps?
- **Relevance**: Is it relevant to the session context?
- **Coherence**: Is it well-organized?

### Extractions (Archivist)
- **Accuracy**: Is the extracted information correct?
- **Completeness**: Are all important points captured?
- **Relevance**: Is extracted content valuable?
- **Coherence**: Is it well-structured?

## Quality Gates

Content must meet minimum thresholds:
- Signal-to-Noise: 0.60
- Actionability: 0.50
- Accuracy: 0.70
- Relevance: 0.60
- Overall: 0.60

## Output

Results are saved to `.claude/evaluation/results/` and can be used for:
- Manual review of quality
- Regression detection against baselines
- Iterating on briefing/extraction quality before automation
