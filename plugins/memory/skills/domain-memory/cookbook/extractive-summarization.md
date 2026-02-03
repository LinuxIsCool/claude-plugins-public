# Extractive Summarization

Understanding how Domain Memory Agent generates summaries by selecting key sentences.

## Purpose

Learn how extractive summarization works to:
- Generate effective document summaries
- Understand sentence scoring algorithms
- Configure summary length appropriately
- Distinguish from abstractive (LLM-based) summarization

## Variables

```yaml
DEFAULT_SENTENCE_COUNT: 5
MIN_SENTENCE_LENGTH: 20
POSITION_BOOST_FACTOR: 1.2
CACHE_SUMMARIES: true
```

## How Extractive Summarization Works

Unlike LLM-based abstractive summarization which generates new text, extractive summarization selects the most important sentences directly from the source document.

### The Algorithm

```python
def generate_summary(content: str, max_sentences: int = 5) -> str:
    """
    Generate extractive summary by selecting key sentences.

    Process:
    1. Split content into sentences
    2. Score each sentence by term importance
    3. Apply position-based boosting
    4. Select top N sentences
    5. Return sentences in original order
    """
    # Step 1: Sentence extraction
    sentences = split_sentences(content)

    if len(sentences) <= max_sentences:
        return content  # Document is short enough

    # Step 2: Calculate term frequencies for entire document
    all_tokens = tokenize(content)
    term_freq = Counter(all_tokens)

    # Step 3: Score each sentence
    scored = []
    for index, sentence in enumerate(sentences):
        tokens = tokenize(sentence)

        # Sum term frequencies for sentence tokens
        score = sum(term_freq.get(t, 0) for t in tokens)

        # Step 4: Position boost for first/last sentences
        if index == 0 or index == len(sentences) - 1:
            score *= 1.2

        scored.append((sentence, score, index))

    # Step 5: Select top sentences, maintain order
    top = sorted(scored, key=lambda x: x[1], reverse=True)[:max_sentences]
    ordered = sorted(top, key=lambda x: x[2])

    return ". ".join(s for s, _, _ in ordered) + "."
```

### Step-by-Step Example

Consider this document:

```text
Machine learning is transforming software development. Traditional programming
requires explicit rules for every scenario. Machine learning instead learns
patterns from data. Neural networks are a popular machine learning approach.
They consist of interconnected nodes that process information. Deep learning
uses neural networks with many layers. This enables complex pattern recognition.
The field continues to evolve rapidly with new architectures emerging regularly.
```

**Step 1: Split into sentences**

```python
sentences = [
    "Machine learning is transforming software development",
    "Traditional programming requires explicit rules for every scenario",
    "Machine learning instead learns patterns from data",
    "Neural networks are a popular machine learning approach",
    "They consist of interconnected nodes that process information",
    "Deep learning uses neural networks with many layers",
    "This enables complex pattern recognition",
    "The field continues to evolve rapidly with new architectures emerging regularly"
]
```

**Step 2: Calculate document-level term frequencies**

```python
term_frequencies = {
    "machine": 3,
    "learning": 4,
    "neural": 2,
    "networks": 2,
    "programming": 2,
    "data": 1,
    "patterns": 2,
    # ... other terms
}
```

**Step 3: Score each sentence**

```python
scores = [
    ("Machine learning is transforming software development", 7 * 1.2),  # First sentence boost
    ("Traditional programming requires explicit rules for every scenario", 2),
    ("Machine learning instead learns patterns from data", 9),
    ("Neural networks are a popular machine learning approach", 11),
    ("They consist of interconnected nodes that process information", 2),
    ("Deep learning uses neural networks with many layers", 8),
    ("This enables complex pattern recognition", 4),
    ("The field continues to evolve rapidly...", 2 * 1.2)  # Last sentence boost
]
```

**Step 4: Select top 3 sentences**

```python
top_3 = [
    "Neural networks are a popular machine learning approach",  # Score: 11
    "Machine learning instead learns patterns from data",        # Score: 9
    "Machine learning is transforming software development"      # Score: 8.4
]
```

**Step 5: Restore original order**

```python
summary = """Machine learning is transforming software development.
Machine learning instead learns patterns from data.
Neural networks are a popular machine learning approach."""
```

## Instructions

### Basic Summarization

```python
# Summarize a stored document
summary = await summarize(
    documentId="doc_123",
    maxSentences=3
)

print(summary["summary"])
# Output: Selected key sentences from the document
```

### Direct Content Summarization

```python
# Summarize content without storing it
summary = await summarize(
    content="""Your long text content here...
    Multiple paragraphs of information...
    That needs to be condensed...""",
    maxSentences=5
)
```

### Using Cached Summaries

```python
# First call generates and caches summary
result1 = await summarize(documentId="doc_123")
# result1["cached"] = False

# Second call returns cached version
result2 = await summarize(documentId="doc_123")
# result2["cached"] = True

# Force regeneration
result3 = await summarize(documentId="doc_123", regenerate=True)
# result3["cached"] = False
```

### Response Structure

```json
{
  "summary": "Selected key sentences from document...",
  "cached": false,
  "documentId": "doc_123",
  "sentenceCount": 3,
  "originalLength": 487,
  "summaryLength": 52
}
```

## Common Patterns

### Pattern 1: Optimal Sentence Count

```python
# Rule of thumb: 1 sentence per 100 words
word_count = doc["wordCount"]
optimal_sentences = max(2, min(10, word_count // 100))

summary = await summarize(
    documentId=doc["id"],
    maxSentences=optimal_sentences
)
```

| Document Length | Recommended Sentences |
|----------------|----------------------|
| < 200 words | 2-3 |
| 200-500 words | 3-5 |
| 500-1000 words | 5-7 |
| > 1000 words | 7-10 |

### Pattern 2: Summary as Search Preview

```python
async def search_with_summaries(query: str) -> list:
    """Search and include summaries for quick preview."""
    results = await semantic_search(query=query, limit=5)

    enriched = []
    for result in results["results"]:
        # Get or generate summary
        doc_summary = await summarize(
            documentId=result["id"],
            maxSentences=2
        )

        enriched.append({
            "title": result["title"],
            "score": result["score"],
            "preview": doc_summary["summary"],
            "excerpts": result["relevantExcerpts"]
        })

    return enriched
```

### Pattern 3: Batch Summarization

```python
async def summarize_all_documents():
    """Pre-generate summaries for all documents."""
    docs = await list_documents(limit=1000)

    for doc in docs["documents"]:
        if not doc["hasSummary"]:
            await summarize(documentId=doc["id"], maxSentences=5)
            print(f"Generated summary for: {doc['title']}")
```

### Pattern 4: Hierarchical Summarization

```python
async def multi_level_summary(doc_id: str) -> dict:
    """Generate summaries at multiple granularities."""
    return {
        "one_liner": (await summarize(documentId=doc_id, maxSentences=1))["summary"],
        "brief": (await summarize(documentId=doc_id, maxSentences=3))["summary"],
        "detailed": (await summarize(documentId=doc_id, maxSentences=7))["summary"]
    }
```

## Scoring Factors Explained

### Term Frequency Contribution

Sentences containing frequently-used terms score higher:

```python
# High-scoring sentence (many high-frequency terms)
"Machine learning neural networks process data patterns"
# Low-scoring sentence (common/filtered words)
"This is also an important thing to consider"
```

### Position Boosting

First and last sentences receive a 1.2x multiplier:

```python
# First sentence often introduces the topic
"This paper presents a novel approach to distributed systems."  # Boosted

# Last sentence often summarizes conclusions
"These results demonstrate significant performance improvements."  # Boosted

# Middle sentences need strong term scores to compete
"The implementation uses a modified B-tree structure."  # No boost
```

### Sentence Length Filter

Sentences shorter than 20 characters are excluded:

```python
# Excluded (too short)
"See Figure 1."
"Note:"
"For example:"

# Included
"The algorithm achieves O(log n) complexity."
```

## Comparison: Extractive vs Abstractive

| Aspect | Extractive (This System) | Abstractive (LLM) |
|--------|-------------------------|-------------------|
| Output | Exact sentences from source | Newly generated text |
| Accuracy | 100% faithful to source | May paraphrase or hallucinate |
| Dependencies | None (pure algorithm) | Requires LLM API |
| Latency | < 100ms | 500ms - 5s |
| Cost | Free | API token costs |
| Coherence | May feel choppy | Smooth, natural flow |
| Compression | Limited to sentence units | Can compress ideas |

### When Extractive Excels

- Legal/medical documents requiring exact quotations
- Technical documentation where precision matters
- Audit trails requiring source traceability
- Offline environments without LLM access
- High-volume processing with cost constraints

### When to Consider Abstractive

- User-facing summaries requiring natural prose
- Cross-document synthesis
- Summarizing into specific formats
- Translation combined with summarization

## Customization Strategies

### Improving Summary Quality

1. **Write well-structured documents**: Good topic sentences rank higher
2. **Front-load important information**: Position boost helps first sentence
3. **Use consistent terminology**: Term frequency rewards repetition
4. **Include concluding sentences**: Last sentence gets boosted

### Sentence Splitting Awareness

The algorithm splits on `.!?` followed by space:

```python
# Correct splitting
"First sentence. Second sentence."  # 2 sentences

# Problematic cases
"Dr. Smith presented."  # May split incorrectly
"Version 2.0 released."  # May split incorrectly
"U.S.A. policy changed."  # Multiple splits
```

## Troubleshooting

**Summary too short:**
- Document may have fewer sentences than requested
- Sentences may be filtered for length
- Check `sentenceCount` in response

**Summary seems random:**
- Document may lack clear topic sentences
- Terms may be evenly distributed (no standout sentences)
- Try reducing `maxSentences` for more selectivity

**Missing important information:**
- Key information may be in low-scoring sentences
- Try increasing `maxSentences`
- Consider restructuring source document

## See Also

- `tfidf-search.md` - Term frequency scoring used in summarization
- `quickstart.md` - Basic summarization usage
- `../prompts/search_query_expansion.md` - Using summaries for query context
