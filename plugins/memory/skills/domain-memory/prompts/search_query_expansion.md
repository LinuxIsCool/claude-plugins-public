# Search Query Expansion Template

A prompt template for expanding user queries to improve TF-IDF search recall.

## Purpose

Use this template to expand terse user queries into richer search queries that better match document vocabulary in the knowledge base.

## Variables

```yaml
EXPANSION_STRATEGY: synonym_and_related
MAX_EXPANDED_TERMS: 10
INCLUDE_ORIGINAL: true
DOMAIN_CONTEXT: general
```

## Template

<query_expansion_prompt>

### Original Query

```
<fill_in_original_query>
{user's original search query}
</fill_in_original_query>
```

### Domain Context

```
<fill_in_domain_context>
{optional: domain or topic area for the knowledge base}
Examples: "software engineering", "machine learning", "devops", "api design"
</fill_in_domain_context>
```

### Expansion Instructions

Expand the original query by:

1. **Preserve Original Terms**: Keep all meaningful terms from the original query
2. **Add Synonyms**: Include common synonyms for key terms
3. **Add Related Terms**: Include closely related technical terms
4. **Add Abbreviations/Expansions**: Include both abbreviated and expanded forms
5. **Domain Vocabulary**: Add domain-specific terminology if context is provided

### Expansion Rules

- Maximum expanded query length: 10-15 terms
- Do not add generic filler words
- Maintain the original intent
- Prioritize terms likely to appear in technical documentation

### Expanded Query Output

```
<expanded_query>
{expanded search query with additional terms}
</expanded_query>
```

### Term Mapping

```yaml
<term_mappings>
original_terms:
  - term: "{original term 1}"
    expansions: ["{synonym}", "{related term}"]
  - term: "{original term 2}"
    expansions: ["{abbreviation}", "{expansion}"]
</term_mappings>
```

</query_expansion_prompt>

## Examples

### Example 1: Technical Query Expansion

**Input:**
```
Original Query: "Python error handling"
Domain Context: "software engineering"
```

**Output:**
```
Expanded Query: "Python error handling exception try catch raise traceback debugging errors exceptions"

Term Mappings:
- term: "error"
  expansions: ["exception", "error", "errors", "traceback"]
- term: "handling"
  expansions: ["handling", "catch", "raise", "try", "except"]
- term: "Python"
  expansions: ["Python", "python3", "py"]
```

### Example 2: API Query Expansion

**Input:**
```
Original Query: "REST authentication"
Domain Context: "api design"
```

**Output:**
```
Expanded Query: "REST authentication API auth OAuth JWT token bearer authorization security RESTful"

Term Mappings:
- term: "REST"
  expansions: ["REST", "RESTful", "API", "endpoint"]
- term: "authentication"
  expansions: ["authentication", "auth", "OAuth", "JWT", "token", "bearer", "authorization"]
```

### Example 3: Database Query Expansion

**Input:**
```
Original Query: "SQL performance"
Domain Context: "databases"
```

**Output:**
```
Expanded Query: "SQL performance query optimization index indexing slow queries execution plan database tuning PostgreSQL MySQL"

Term Mappings:
- term: "SQL"
  expansions: ["SQL", "query", "queries", "database", "PostgreSQL", "MySQL"]
- term: "performance"
  expansions: ["performance", "optimization", "tuning", "slow", "fast", "execution"]
```

## Usage Instructions

### For Claude Code Agent

When the user's search query is short or may suffer from vocabulary mismatch:

1. Read this template
2. Fill in the original query from the user
3. Optionally set domain context based on the knowledge base
4. Generate expanded query following the template
5. Use expanded query for `semantic_search`

```python
# Example workflow
original_query = "async patterns"
domain = "python programming"

# After expansion
expanded_query = "async patterns asynchronous asyncio await coroutines concurrent programming Python"

# Use expanded query for search
results = await semantic_search(query=expanded_query, limit=10)
```

### Integration with Search Flow

```python
async def search_with_expansion(user_query: str, domain: str = None) -> dict:
    """
    Search with automatic query expansion.

    Steps:
    1. Expand the query
    2. Search with expanded query
    3. Return results with expansion metadata
    """
    # Generate expanded query (in practice, use this template with LLM)
    expanded = expand_query(user_query, domain)

    # Search with expanded query
    results = await semantic_search(
        query=expanded["expanded_query"],
        limit=10
    )

    return {
        "original_query": user_query,
        "expanded_query": expanded["expanded_query"],
        "term_mappings": expanded["mappings"],
        "results": results["results"]
    }
```

## Common Expansion Patterns

### Technical Term Patterns

| Original | Expansions |
|----------|------------|
| API | API, endpoint, interface, service |
| DB | database, DB, datastore, persistence |
| auth | authentication, authorization, auth, security |
| config | configuration, config, settings, options |
| error | error, exception, failure, issue |
| test | test, testing, spec, unit, integration |

### Action Verb Patterns

| Original | Expansions |
|----------|------------|
| create | create, add, new, insert, generate |
| read | read, get, fetch, retrieve, query |
| update | update, modify, change, edit, patch |
| delete | delete, remove, drop, destroy |
| search | search, find, query, lookup, filter |

### Concept Patterns

| Original | Expansions |
|----------|------------|
| async | async, asynchronous, concurrent, parallel |
| cache | cache, caching, memoize, store |
| log | log, logging, trace, debug, monitor |
| deploy | deploy, deployment, release, publish |
| scale | scale, scaling, scalable, horizontal, vertical |

## When to Use Query Expansion

**Expand when:**
- User query is very short (1-2 words)
- Query uses abbreviations or jargon
- Initial search returns few results
- Query is conceptual rather than keyword-specific

**Skip expansion when:**
- User provides a detailed, specific query
- Query includes quoted exact phrases
- User is searching for specific document titles
- Initial search returns good results

## See Also

- `../cookbook/tfidf-search.md` - Understanding how query terms affect search
- `../cookbook/hybrid-approach.md` - Alternative to expansion using embeddings
- `../cookbook/quickstart.md` - Basic search usage
