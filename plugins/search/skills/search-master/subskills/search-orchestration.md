---
name: search-orchestration
description: The meta-skill for choosing search methods. Use when deciding between search approaches, building multi-method pipelines, or optimizing search strategy. The Navigator's decision framework.
allowed-tools: Read, Bash, Glob, Grep, Task
---

# Search Orchestration

Choosing the right search method for each task.

## The Navigator's Decision Framework

```
┌─────────────────────────────────────────────────────────────┐
│                    QUERY ARRIVES                             │
├─────────────────────────────────────────────────────────────┤
│                         │                                    │
│                         ▼                                    │
│              ┌─────────────────┐                            │
│              │  Analyze Query  │                            │
│              └────────┬────────┘                            │
│                       │                                      │
│         ┌─────────────┼─────────────┐                       │
│         ▼             ▼             ▼                       │
│    ┌─────────┐  ┌─────────┐  ┌─────────┐                   │
│    │ Specific│  │Semantic │  │Relational│                   │
│    │ (exact) │  │(meaning)│  │(connected)│                  │
│    └────┬────┘  └────┬────┘  └────┬────┘                   │
│         │            │            │                         │
│         ▼            ▼            ▼                         │
│    ┌─────────┐  ┌─────────┐  ┌─────────┐                   │
│    │ Keyword │  │ Vector  │  │  Graph  │                   │
│    │ Search  │  │ Search  │  │   RAG   │                   │
│    └─────────┘  └─────────┘  └─────────┘                   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Query Classification

### Query Types

| Type | Pattern | Example | Best Method |
|------|---------|---------|-------------|
| **Exact** | Specific identifier | "getUserById function" | Keyword/ripgrep |
| **Semantic** | Meaning-based | "code that validates input" | Vector search |
| **Exploratory** | Vague, broad | "authentication flow" | Hybrid + RAG |
| **Relational** | Connections | "what calls this function?" | Graph RAG |
| **Fuzzy** | Approximate | "autentication" (typo) | Fuzzy search |
| **Structural** | Code pattern | "all async functions" | AST/ripgrep |

### Automatic Classification

```python
import re
from enum import Enum

class QueryType(Enum):
    EXACT = "exact"
    SEMANTIC = "semantic"
    EXPLORATORY = "exploratory"
    RELATIONAL = "relational"
    FUZZY = "fuzzy"
    STRUCTURAL = "structural"

def classify_query(query: str) -> QueryType:
    """
    Classify query to determine best search method.
    """
    query_lower = query.lower()

    # Exact: Contains code identifiers
    if re.search(r'[a-z]+[A-Z][a-z]+', query):  # camelCase
        return QueryType.EXACT
    if re.search(r'[a-z]+_[a-z]+', query):  # snake_case
        return QueryType.EXACT
    if re.search(r'\.(py|js|ts|go|rs|java)$', query):  # file extension
        return QueryType.EXACT

    # Relational: Asking about connections
    relational_patterns = [
        r'what (calls|uses|imports|depends on)',
        r'(callers|callees|references) of',
        r'how .* (connects|relates) to',
        r'(parent|child|sibling) of'
    ]
    if any(re.search(p, query_lower) for p in relational_patterns):
        return QueryType.RELATIONAL

    # Structural: Looking for patterns
    structural_patterns = [
        r'all (async|class|function|method)s?',
        r'functions? (that|which|with)',
        r'pattern .* in'
    ]
    if any(re.search(p, query_lower) for p in structural_patterns):
        return QueryType.STRUCTURAL

    # Exploratory: Questions, broad terms
    if query_lower.startswith(('how', 'what', 'why', 'where', 'explain')):
        return QueryType.EXPLORATORY

    # Fuzzy: Likely typos (short with unusual letter combos)
    if len(query.split()) == 1 and len(query) < 15:
        # Check for common typo patterns
        if not query.isalpha():  # Mixed chars might be intentional
            return QueryType.EXACT
        # Could add dictionary check here
        return QueryType.SEMANTIC  # Default single words to semantic

    # Default to semantic for natural language
    return QueryType.SEMANTIC

def get_recommended_method(query_type: QueryType) -> str:
    """Map query type to search method."""
    mapping = {
        QueryType.EXACT: "ripgrep",
        QueryType.SEMANTIC: "vector",
        QueryType.EXPLORATORY: "hybrid_rag",
        QueryType.RELATIONAL: "graph_rag",
        QueryType.FUZZY: "fuzzy",
        QueryType.STRUCTURAL: "ast_ripgrep"
    }
    return mapping[query_type]
```

## Method Selection Matrix

### By Query Characteristics

| If Query Has... | Use... | Because... |
|-----------------|--------|------------|
| Code identifiers | Keyword | Exact match wins |
| Natural language | Vector | Captures meaning |
| Questions | Hybrid + RAG | Need context |
| "What calls X" | Graph | Relationship traversal |
| Possible typos | Fuzzy | Approximate matching |
| Pattern match | ripgrep | Regex power |

### By Expected Results

| If You Want... | Use... |
|----------------|--------|
| Single exact file | ripgrep |
| Conceptually similar code | Vector |
| Context for LLM | RAG pipeline |
| Connected entities | Graph RAG |
| Everything matching pattern | ripgrep with glob |

### By Scale

| Scale | Fast Method | Quality Method |
|-------|-------------|----------------|
| < 1K files | ripgrep | Any |
| 1K - 10K | ripgrep + hybrid | Hybrid |
| 10K - 100K | Indexed search | Hybrid + rerank |
| > 100K | Elasticsearch | Elasticsearch + rerank |

## The Orchestrator

```python
class SearchOrchestrator:
    """
    Central coordinator for search method selection and execution.
    """

    def __init__(self, config: dict):
        self.keyword_engine = KeywordSearch(config)
        self.vector_engine = VectorSearch(config)
        self.graph_engine = GraphSearch(config) if config.get('graph_enabled') else None
        self.fuzzy_engine = FuzzySearch(config)
        self.history = []  # For learning

    async def search(self, query: str, method: str = "auto") -> list[dict]:
        """
        Execute search with automatic or specified method.

        Args:
            query: The search query
            method: "auto", "keyword", "vector", "hybrid", "graph", "fuzzy"

        Returns:
            List of search results with scores and metadata
        """
        # Classify if auto
        if method == "auto":
            query_type = classify_query(query)
            method = get_recommended_method(query_type)

            # Log for learning
            self.history.append({
                'query': query,
                'classified_as': query_type.value,
                'method_chosen': method
            })

        # Execute appropriate method
        if method == "keyword" or method == "ripgrep":
            return await self.keyword_engine.search(query)

        elif method == "vector":
            return await self.vector_engine.search(query)

        elif method == "hybrid" or method == "hybrid_rag":
            keyword_results = await self.keyword_engine.search(query)
            vector_results = await self.vector_engine.search(query)
            return self.fuse(keyword_results, vector_results)

        elif method == "graph" or method == "graph_rag":
            if not self.graph_engine:
                # Fallback to hybrid
                return await self.search(query, method="hybrid")
            return await self.graph_engine.search(query)

        elif method == "fuzzy":
            return await self.fuzzy_engine.search(query)

        else:
            raise ValueError(f"Unknown method: {method}")

    def fuse(self, keyword_results: list, vector_results: list) -> list:
        """Reciprocal rank fusion of result sets."""
        return reciprocal_rank_fusion(keyword_results, vector_results)

    def get_learning_summary(self) -> dict:
        """Analyze search history for patterns."""
        from collections import Counter

        type_counts = Counter(h['classified_as'] for h in self.history)
        method_counts = Counter(h['method_chosen'] for h in self.history)

        return {
            'total_queries': len(self.history),
            'query_type_distribution': dict(type_counts),
            'method_distribution': dict(method_counts)
        }
```

## Fallback Strategies

### When Primary Method Fails

```python
FALLBACK_CHAIN = {
    'vector': ['hybrid', 'keyword'],      # If vector returns nothing
    'keyword': ['fuzzy', 'vector'],       # If exact match fails
    'graph': ['hybrid', 'keyword'],       # If graph unavailable
    'fuzzy': ['keyword', 'vector'],       # If fuzzy too broad
}

async def search_with_fallback(query: str, primary: str) -> list:
    """Try primary method, fall back on failure."""
    results = await search(query, method=primary)

    if not results or len(results) < 3:
        for fallback in FALLBACK_CHAIN.get(primary, []):
            results = await search(query, method=fallback)
            if results and len(results) >= 3:
                break

    return results
```

### Confidence-Based Routing

```python
async def confident_search(query: str) -> list:
    """
    Run multiple methods, return best by confidence.
    """
    results = {}
    confidences = {}

    # Run in parallel
    keyword_results = await keyword_search(query)
    vector_results = await vector_search(query)

    # Score confidence by result quality signals
    confidences['keyword'] = score_confidence(keyword_results, query)
    confidences['vector'] = score_confidence(vector_results, query)

    # Return highest confidence
    best_method = max(confidences, key=confidences.get)

    if best_method == 'keyword':
        return keyword_results
    else:
        return vector_results

def score_confidence(results: list, query: str) -> float:
    """
    Score how confident we are in these results.
    """
    if not results:
        return 0.0

    # Factors:
    # - Top result score
    # - Score gap between top and rest
    # - Number of results
    # - Query term overlap

    top_score = results[0].get('score', 0)
    score_gap = top_score - (results[1].get('score', 0) if len(results) > 1 else 0)

    return 0.4 * top_score + 0.3 * score_gap + 0.3 * min(len(results) / 10, 1)
```

## Integration with Claude Code

### Enhancing Built-in Tools

```python
# Before using Claude Code's Grep tool, check if another method is better

def should_use_grep(query: str) -> bool:
    """Determine if ripgrep is the best choice."""
    query_type = classify_query(query)
    return query_type in [QueryType.EXACT, QueryType.STRUCTURAL]

# In practice:
# 1. If should_use_grep(query) → Use Grep tool directly
# 2. Else → Use search orchestrator
```

### Delegating to Explore Agent

```python
def should_delegate_to_explore(query: str) -> bool:
    """
    Determine if the Explore agent is better for this query.

    Delegate when:
    - Query is exploratory and needs multiple rounds
    - Answer requires understanding relationships
    - Query is about architecture/structure
    """
    exploration_signals = [
        'how does .* work',
        'explain .* architecture',
        'what is the .* pattern',
        'understand .* flow',
        'trace .* through'
    ]
    return any(re.search(p, query.lower()) for p in exploration_signals)
```

## Self-Improvement Loop

### Tracking Success

```python
class SearchTracker:
    """Track search effectiveness for learning."""

    def __init__(self, state_file: str = "plugins/search/state/learnings.md"):
        self.state_file = state_file
        self.sessions = []

    def log_search(self, query: str, method: str, results: list,
                   user_selected: int = None):
        """Log a search and optional user feedback."""
        self.sessions.append({
            'timestamp': datetime.now().isoformat(),
            'query': query,
            'method': method,
            'result_count': len(results),
            'user_selected_rank': user_selected  # Which result did user pick?
        })

    def analyze_patterns(self) -> dict:
        """Find patterns in successful searches."""
        # Which methods work best for which query types?
        successes = [s for s in self.sessions if s.get('user_selected_rank', 99) <= 3]

        method_success = {}
        for s in successes:
            query_type = classify_query(s['query']).value
            method = s['method']
            key = (query_type, method)
            method_success[key] = method_success.get(key, 0) + 1

        return method_success

    def update_strategy(self):
        """Update routing based on learned patterns."""
        patterns = self.analyze_patterns()
        # Use patterns to adjust classification → method mapping
        # Write to state file for persistence
```

### Learnings Log Format

```markdown
# Search Learnings Log

## Entry: 2025-12-17T13:45:00

**Query**: "authentication middleware"
**Classified As**: exact
**Method Used**: keyword
**Result**: Good - found auth_middleware.py immediately
**Learning**: camelCase patterns → keyword search works

---

## Entry: 2025-12-17T14:00:00

**Query**: "how does user login work"
**Classified As**: exploratory
**Method Used**: hybrid_rag
**Result**: Good - RAG provided context
**Learning**: "how does X work" → hybrid + RAG is correct

---

## Patterns Discovered

| Query Pattern | Best Method | Success Rate |
|---------------|-------------|--------------|
| camelCase identifiers | keyword | 95% |
| "how does X" questions | hybrid_rag | 88% |
| typo-like queries | fuzzy | 76% |
```

## The Navigator's Heuristics

1. **Start Simple**
   - Try keyword first for specific terms
   - Escalate complexity only when needed

2. **Trust the Signals**
   - Code identifiers → keyword
   - Questions → semantic/RAG
   - Connections → graph

3. **Learn from Users**
   - Track which results get clicked
   - Adjust routing based on patterns

4. **Fail Fast, Fallback Gracefully**
   - If primary method returns nothing → try alternatives
   - Don't make users wait for empty results

5. **Context Matters**
   - Same query might need different methods in different repos
   - Track per-project patterns
