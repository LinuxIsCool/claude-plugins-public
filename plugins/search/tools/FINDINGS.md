# RAG System Evaluation Findings

## Summary

After extensive testing on real user queries from 482 Claude Code sessions:

| Metric | Value | Note |
|--------|-------|------|
| Total real queries tested | 40 | Subset of 82 ecosystem-related |
| Queries answerable by RAG | 13 (32%) | Fundamental ceiling |
| Original MRR | 0.182 | Poor performance |
| Perfect classifier MRR | 0.560 | Best possible with filtering |
| Current classifier MRR | 0.192 | 1.1x improvement |

## Key Finding: 68% of Real Queries Cannot Be Answered

The majority of user queries in Claude Code sessions are **not information retrieval** tasks:

| Query Type | Count | % | Can RAG Help? |
|------------|-------|---|---------------|
| Context-dependent | ~22% | No | Requires conversation history |
| Action requests | ~20% | No | User wants action, not info |
| Debugging | ~12% | No | Runtime state, not indexed |
| Knowledge | ~45% | Maybe | Depends on query quality |

## What Works

Queries that succeed (MRR > 0) share these characteristics:

1. **Contain specific entity names**: "agentnet", "registry", "journal plugin"
2. **Clear knowledge intent**: "What is X?", "How does X work?"
3. **Standalone**: Don't require prior context to understand

Examples:
- "What is the registry?" → MRR 1.0
- "Are you aware of agentnet?" → MRR 1.0
- "What subagents do you have available?" → MRR 0.25

## What Fails

Queries that fail (MRR = 0) exhibit:

1. **Context dependency**: "Where is it?", "How do I interact with it?"
2. **Compound questions**: "Can you X and also Y?"
3. **Action disguised as questions**: "Can you create an agent that..."
4. **Vague references**: "What does this imply?"

Examples:
- "Where is the vis?" → Context-dependent, what is "vis"?
- "Can you explain each of these 10 plugins?" → What 10 plugins?
- "Why is agent renaming not working right now?" → Runtime debugging

## Classifier Performance

Built a heuristic query classifier achieving 94% accuracy on test set:

| Classification | Action |
|----------------|--------|
| ACTION | Don't retrieve - user wants action |
| DEBUGGING | Don't retrieve - runtime state |
| CONTEXT | Don't retrieve - needs history |
| KNOWLEDGE | Attempt retrieval |

However, on real queries, the classifier is **too aggressive**:
- Filters 55% of queries (good)
- But filters 7 of 13 successful queries (bad)
- Net improvement only 1.1x vs potential 3.1x

## Recommendations

### 1. Be Permissive, Not Restrictive

Instead of pre-filtering, attempt retrieval and use **confidence thresholds** to reject low-quality results:

```python
results = retriever.search(query, k=5)
if results[0].score < 0.55:
    return "Low confidence, skipping retrieval"
```

### 2. Improve Chunk Quality

Current chunks are code-aware but still fragment context. Consider:
- Larger chunk sizes (1024+ tokens)
- Document-level embeddings for initial filtering
- Hierarchical retrieval (doc → chunk)

### 3. Accept RAG's Limited Role

RAG is appropriate for ~32% of Claude Code queries. For the rest:
- **Context queries** → Conversation history / log search
- **Action queries** → Direct tool use
- **Debugging** → Runtime introspection

### 4. Focus Evaluation on Answerable Queries

Don't inflate or deflate metrics with unanswerable queries. Create test sets that:
- Contain only standalone knowledge queries
- Measure retrieval quality on fair ground
- Separately measure query classification accuracy

## Files Created

| File | Purpose |
|------|---------|
| `rag/classifier.py` | Query type classifier |
| `test_classifier.py` | Unit test for classifier |
| `test_classifier_full.py` | Full real query test |
| `analyze_perfect_classifier.py` | Upper bound analysis |
| `ecosystem_user_queries.json` | 82 real queries extracted |
| `real_queries_eval.json` | Per-query MRR results |

## Next Steps

1. **Implement confidence thresholding** in retrieval pipeline
2. **Build standalone query test set** for fair evaluation
3. **Explore hybrid approaches**: classifier + threshold + fallback
