# Extraction Evaluation

Guide for evaluating Archivist extractions.

## What Makes a Good Extraction?

A high-quality extraction should:

1. **Accurate**: Faithfully represents the source session
2. **Complete**: Captures all significant knowledge
3. **Relevant**: Focuses on valuable, reusable information
4. **Coherent**: Well-organized for future reference

## Running Extraction Evaluation

```bash
cd /home/user/path

# Basic evaluation
uv run python -m src.cli extraction path/to/extraction.md

# With source session context
uv run python -m src.cli extraction extraction.md --source 4349eb9c
```

## Evaluation Dimensions

| Dimension | Weight | Gate |
|-----------|--------|------|
| Accuracy | 25% | 0.70 |
| Completeness | 20% | - |
| Relevance | 20% | 0.60 |
| Coherence | 15% | - |

## Interpreting Results

### Accuracy Score

| Score | Meaning |
|-------|---------|
| 0.9+ | Perfectly faithful to source |
| 0.7-0.9 | Minor inaccuracies or interpretations |
| 0.5-0.7 | Some errors or misrepresentations |
| <0.5 | Significant accuracy problems |

### Completeness Score

| Score | Meaning |
|-------|---------|
| 0.9+ | Comprehensive, nothing significant missed |
| 0.7-0.9 | Most important points captured |
| 0.5-0.7 | Notable gaps in coverage |
| <0.5 | Major omissions |

## Extraction Types

### Session Extraction
Extract knowledge from a conversation session:
- Decisions made
- Problems solved
- Patterns discovered
- Resources identified

### Document Extraction
Extract knowledge from documents:
- Key concepts
- Relationships
- Action items
- References

## Example: Good vs Poor Extraction

**Poor Extraction** (Accuracy: 0.5, Completeness: 0.4):
> The session involved some work on plugins. There were discussions about various topics. Some issues were resolved.

**Good Extraction** (Accuracy: 0.9, Completeness: 0.85):
> Session 4349eb9c (2026-01-05):
> - Completed: Library plugin phases 8-10 (export system, migration utilities)
> - Key pattern: Two-stage hybrid search (exact title → fuzzy content)
> - Architecture decision: Plugin data in .claude/library/, not plugins/library/.claude/
> - Resources added: 5 (AlphaEvolve, SCP, RLM paper, DeepSeek blog, Anthropic GitHub)
> - Blocked: None
> - Next: Validate migration system with real bookmarks import

## Integration with Archivist

Once extraction quality is validated:

1. Analyze what makes high-quality extractions
2. Update Archivist's extraction prompts
3. Test on diverse session types
4. Only automate when quality gates pass consistently
