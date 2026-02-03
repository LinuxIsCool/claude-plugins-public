---
name: search
description: Search the codebase using the optimal method. Automatically classifies queries and selects between keyword, semantic, hybrid, and graph-based search.
arguments:
  - name: query
    description: What to search for
    required: true
  - name: method
    description: Force specific method (auto, keyword, vector, hybrid, graph, fuzzy)
    required: false
---

# /search Command

Search the codebase with intelligent method selection.

## What This Command Does

1. **Analyzes** your query to understand what you're looking for
2. **Selects** the optimal search method (or uses your specified method)
3. **Executes** the search across the codebase
4. **Returns** results with relevance scores and context

## Query Analysis

Your query will be classified as one of:

| Type | Pattern | Method Used |
|------|---------|-------------|
| **Exact** | Code identifiers (camelCase, snake_case) | Keyword/ripgrep |
| **Semantic** | Natural language, meaning-based | Vector search |
| **Exploratory** | Questions, "how does X work" | Hybrid + RAG |
| **Relational** | "What calls/uses X" | Graph (if available) |
| **Fuzzy** | Possible typos | Fuzzy search |

## Usage Examples

### Basic Search
```
/search authentication middleware
```
→ Finds files related to authentication middleware

### Force Keyword Search
```
/search getUserById --method keyword
```
→ Uses exact keyword matching for specific identifier

### Semantic Search
```
/search code that validates user input --method vector
```
→ Uses embeddings to find conceptually similar code

### Hybrid Search
```
/search how does error handling work --method hybrid
```
→ Combines keyword and semantic for best recall

## Method Options

| Method | Best For | Notes |
|--------|----------|-------|
| `auto` | Default | Let Navigator decide |
| `keyword` | Exact matches | Fast, precise |
| `vector` | Similar code | Requires embeddings |
| `hybrid` | General search | Best balance |
| `graph` | Relationships | Requires graph index |
| `fuzzy` | Typos/variants | Approximate matching |

## What Happens

```
┌─────────────────────────────────────────────────────────┐
│  /search authentication middleware                       │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  1. Query Analysis                                       │
│     → Type: semantic (natural language)                  │
│     → Method: hybrid (default for semantic)              │
│                                                          │
│  2. Search Execution                                     │
│     → BM25 keyword search: 15 results                    │
│     → Vector semantic search: 12 results                 │
│     → Reciprocal Rank Fusion: 10 combined               │
│                                                          │
│  3. Results                                              │
│     [0.92] src/middleware/auth.ts:15-45                  │
│     [0.87] src/services/authentication.py:1-30          │
│     [0.81] lib/auth/middleware.js:20-50                 │
│     ...                                                  │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

## Interpreting Results

Results include:
- **Score**: Relevance (0-1, higher is better)
- **File path**: Where the match was found
- **Lines**: Specific line range
- **Context**: Surrounding code (if available)

## Tips for Better Searches

1. **Be specific** for exact matches
   - Good: "getUserById function"
   - Bad: "user function"

2. **Be descriptive** for semantic search
   - Good: "code that validates email format"
   - Bad: "email"

3. **Ask questions** for exploratory search
   - Good: "how does authentication flow work"
   - Bad: "authentication"

4. **Use identifiers** for precision
   - Good: "AuthService.validateToken"
   - Bad: "token validation"

## Integration with Other Commands

```
# Find code, then explore it
/search authentication → (get file path) → Read file

# Search and get RAG context
/search how does X work → Results used as RAG context
```

## Configuration

The search command respects settings in `plugins/search/state/`:
- `preferences.local.md`: User-specific method preferences
- `learnings.md`: Query pattern history

## Troubleshooting

**No results?**
- Try broader query
- Try different method (--method fuzzy for typos)
- Check if index exists (for vector/graph search)

**Too many results?**
- Be more specific
- Use exact identifiers
- Add file type filters

**Wrong method chosen?**
- Override with --method
- Report pattern to improve auto-detection
