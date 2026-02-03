---
name: domain-memory
description: This skill should be used when the user asks about "domain memory", "TF-IDF memory", "zero dependency memory", "lightweight memory", "no ML memory", "extractive summarization", or needs a memory system without machine learning dependencies.
version: 0.1.0
allowed-tools: Read, Glob, Grep, Bash
---

# Domain Memory Agent Skill

Provides expertise on domain-memory-agent - an MCP server providing lightweight semantic search and knowledge management without external ML dependencies.

## Overview

Domain Memory Agent uses TF-IDF (Term Frequency-Inverse Document Frequency) for semantic search instead of neural embeddings:

| Aspect | TF-IDF Approach | Neural Embeddings |
|--------|-----------------|-------------------|
| Dependencies | None (pure Python) | sentence-transformers, torch |
| Latency | <50ms on 1000 docs | 100-500ms |
| Memory | Minimal | ~100MB+ for model |
| Accuracy | Good for keyword-rich | Better for semantic |
| Explainability | Full (term weights) | Black box |

## Architecture

```
Document Storage (in-memory dict)
         ↓
TF-IDF Index
├── term_frequencies: {doc_id: {term: count}}
├── document_frequencies: {term: doc_count}
└── term_counts: {doc_id: total_terms}
         ↓
Search & Ranking
```

## TF-IDF Algorithm

Five-step processing:

### Step 1: Text Normalization
```python
def normalize(text):
    tokens = text.lower().split()
    return [t for t in tokens if len(t) > 2 and t not in STOP_WORDS]
```

### Step 2: Term Frequency
```python
def calculate_tf(doc_tokens):
    term_counts = Counter(doc_tokens)
    total = len(doc_tokens)
    return {term: count/total for term, count in term_counts.items()}
```

### Step 3: Document Frequency
```python
def update_df(term, doc_count):
    # Track how many documents contain each term
    document_frequencies[term] = doc_count
```

### Step 4: Inverse Document Frequency
```python
def calculate_idf(term, total_docs):
    df = document_frequencies.get(term, 0)
    return math.log(total_docs / (df + 1))
```

### Step 5: TF-IDF Score
```python
def tfidf_score(term, doc_id, total_docs):
    tf = term_frequencies[doc_id].get(term, 0)
    idf = calculate_idf(term, total_docs)
    return tf * idf
```

## Six Primary Tools

### 1. store_document

```python
await store_document(
    title="Authentication Guide",
    content="How to implement OAuth2 authentication...",
    tags=["auth", "security", "oauth"],
    metadata={"author": "team", "version": "1.0"}
)
# Auto-indexes for TF-IDF retrieval
```

### 2. semantic_search

```python
results = await semantic_search(
    query="implement user authentication",
    limit=5,
    tag_filter=["auth"],
    min_score=0.1
)
# Returns documents ranked by TF-IDF score
```

### 3. summarize

```python
summary = await summarize(
    doc_id="doc_123",
    sentence_count=3,
    regenerate=False  # Use cache if available
)
# Extractive summarization - picks key sentences
```

### 4. list_documents

```python
docs = await list_documents(
    tag_filter=["security"],
    sort_by="created",
    limit=10,
    offset=0
)
```

### 5. get_document

```python
doc = await get_document(doc_id="doc_123")
```

### 6. delete_document

```python
await delete_document(doc_id="doc_123")
# Removes and unindexes
```

## Performance Characteristics

| Operation | Latency |
|-----------|---------|
| store_document | <10ms |
| semantic_search (1000 docs) | <50ms |
| summarize | <100ms |
| indexing | Synchronous |

## Extractive Summarization

Unlike LLM-based summarization, extracts key sentences directly:

```python
def extractive_summarize(content, num_sentences=3):
    sentences = split_sentences(content)
    scores = []

    for sentence in sentences:
        # Score by term importance
        terms = normalize(sentence)
        score = sum(tfidf_score(t, doc_id) for t in terms)
        scores.append((sentence, score))

    # Return top sentences in original order
    top = sorted(scores, key=lambda x: x[1], reverse=True)[:num_sentences]
    return " ".join(s for s, _ in sorted(top, key=lambda x: sentences.index(x[0])))
```

## Integration with Claude Code

### UserPromptSubmit Hook

```python
def inject_domain_context(prompt):
    results = semantic_search(prompt, limit=3)
    if results:
        context = "[DOMAIN KNOWLEDGE]\n"
        for doc in results:
            context += f"- {doc['title']}: {doc['summary']}\n"
        return context
    return ""
```

### PostToolUse Hook for Documentation

```python
def capture_documentation(tool_name, tool_response):
    if tool_name == "WebFetch" and is_documentation(tool_response):
        store_document(
            title=extract_title(tool_response),
            content=tool_response,
            tags=["documentation", "auto-captured"]
        )
```

## When to Use Domain Memory

**Best for:**
- Edge deployments (no GPU/network)
- Privacy-sensitive applications
- Explainable search results
- Resource-constrained environments
- Quick prototyping without setup

**Consider alternatives for:**
- Semantic understanding → agentmemory, mem0
- Multi-hop reasoning → HippoRAG
- Production accuracy → mem0 (26% better)
- Permanent storage → lumera-memory

## Advantages of TF-IDF Approach

1. **Explainability**: Know exactly why documents matched
2. **No dependencies**: Pure Python implementation
3. **Offline capable**: No external services needed
4. **Fast indexing**: No embedding computation
5. **Predictable performance**: No model loading overhead

## Limitations

1. **Keyword dependent**: "car" won't match "automobile"
2. **No semantic understanding**: Misses conceptual similarities
3. **Vocabulary mismatch**: Query terms must appear in documents

## Hybrid Approach

Combine TF-IDF with embeddings when available:

```python
def hybrid_search(query, use_embeddings=True):
    tfidf_results = tfidf_search(query)

    if use_embeddings and embeddings_available():
        embedding_results = embedding_search(query)
        return merge_results(tfidf_results, embedding_results)

    return tfidf_results
```

## Additional Resources

### Reference Files
- `references/tfidf-implementation.md` - Full algorithm details
- `references/summarization.md` - Extractive patterns

### Repository
- Source: `/.research/claude-code-plugins-plus-skills/plugins/mcp/domain-memory-agent/`
- GitHub: https://github.com/jeremylongshore/claude-code-plugins-plus-skills

### Related Skills
- `../embeddings/SKILL.md` - When to add embeddings
- `../vector-search/SKILL.md` - Vector alternatives
