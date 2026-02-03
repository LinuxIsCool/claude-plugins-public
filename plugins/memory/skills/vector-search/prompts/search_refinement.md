# Search Query Refinement Prompt

## Purpose

Template for iteratively refining search queries to improve retrieval quality. Use when initial search results are unsatisfactory or when building query expansion systems.

## Variables

```yaml
ORIGINAL_QUERY: "<user's original search query>"
SEARCH_RESULTS: "<top N results from initial search>"
RESULT_COUNT: 5
USER_FEEDBACK: "<optional: user's feedback on results>"
DOMAIN_CONTEXT: "<optional: specific domain or topic area>"
```

## Instructions

Use this prompt template to refine vector search queries through:
1. Query expansion (adding related terms)
2. Query reformulation (rephrasing for better embedding)
3. Filter inference (identifying implicit metadata constraints)
4. Multi-query generation (creating diverse query variants)

---

## Prompt Template: Query Expansion

```markdown
# Query Expansion for Vector Search

## Context
You are helping improve a vector similarity search by expanding the original query with semantically related terms and concepts.

## Original Query
{ORIGINAL_QUERY}

## Current Top Results
{SEARCH_RESULTS}

## Task
Analyze the query and generate 3-5 expanded query variants that:
1. Include synonyms and related terminology
2. Add contextual phrases that might appear in relevant documents
3. Reformulate using different semantic angles
4. Maintain the original search intent

## Output Format
```json
{
  "expanded_queries": [
    {
      "query": "expanded query text",
      "rationale": "why this expansion might find different relevant results"
    }
  ],
  "inferred_filters": {
    "potential_category": "...",
    "time_relevance": "recent|historical|any",
    "source_type": "..."
  }
}
```

## Guidelines
- Preserve the core intent of the original query
- Consider domain-specific terminology if context is provided
- Avoid overly broad expansions that dilute relevance
- Include both more specific and more general variants
```

---

## Prompt Template: Result-Aware Refinement

```markdown
# Search Refinement Based on Results

## Context
The initial search returned results that may not fully satisfy the user's information need. Refine the query based on the gap between what was found and what was likely wanted.

## Original Query
{ORIGINAL_QUERY}

## Retrieved Results
{SEARCH_RESULTS}

## User Feedback (if available)
{USER_FEEDBACK}

## Task
1. Identify what the current results are about
2. Identify what might be missing based on the query intent
3. Generate refined queries that target the gap

## Analysis Required
- What topics do the current results cover well?
- What aspects of the query seem underrepresented?
- Are there specific terms that might better capture the intent?
- Should the query be more specific or more general?

## Output
```json
{
  "results_analysis": {
    "covered_topics": ["..."],
    "missing_aspects": ["..."],
    "relevance_issues": ["..."]
  },
  "refined_queries": [
    {
      "query": "refined query text",
      "targets": "what gap this addresses",
      "confidence": "high|medium|low"
    }
  ],
  "recommended_filters": {
    "add_filter": {"field": "value"},
    "remove_filter": "field_to_remove"
  }
}
```
```

---

## Prompt Template: Multi-Query Generation

```markdown
# Multi-Query Vector Search

## Context
Generate multiple diverse queries from a single user query to improve recall through query ensemble techniques.

## Original Query
{ORIGINAL_QUERY}

## Domain Context
{DOMAIN_CONTEXT}

## Task
Generate 5 semantically diverse queries that together cover:
1. The literal interpretation of the query
2. Conceptual/abstract interpretation
3. Example-based interpretation (what specific instances might match)
4. Related questions the user might also be asking
5. Alternative phrasings from different perspectives

## Output
```json
{
  "query_ensemble": [
    {
      "type": "literal|conceptual|example|related|alternative",
      "query": "query text",
      "embedding_strategy": "use_as_is|concatenate_with_original|separate_search"
    }
  ],
  "fusion_recommendation": {
    "method": "rrf|weighted_average|max_score",
    "weights": [0.3, 0.2, 0.2, 0.15, 0.15]
  }
}
```
```

---

## Prompt Template: Filter Inference

```markdown
# Metadata Filter Inference

## Context
Analyze a natural language query to extract implicit metadata filters that can improve search precision.

## Query
{ORIGINAL_QUERY}

## Available Metadata Fields
```
- source: [chat, email, document, code, meeting_notes]
- date_created: timestamp
- author: string
- project: string
- priority: [high, medium, low]
- status: [active, archived, draft]
- tags: array of strings
- language: [en, es, fr, de, ...]
```

## Task
Extract any implicit filters from the query that map to available metadata fields.

## Examples
- "recent meeting notes about project X" -> {source: "meeting_notes", date_created: {$gt: last_week}, project: "X"}
- "high priority tasks from Alice" -> {priority: "high", author: "Alice"}
- "archived Python code" -> {status: "archived", tags: {$contains: "python"}}

## Output
```json
{
  "explicit_filters": {
    "field": "value or condition"
  },
  "implicit_filters": {
    "field": {
      "value": "inferred value",
      "confidence": "high|medium|low",
      "reasoning": "why this filter was inferred"
    }
  },
  "cleaned_query": "query with filter terms removed for better embedding",
  "warnings": ["any ambiguities or uncertainties"]
}
```
```

---

## Prompt Template: Iterative Refinement Session

```markdown
# Iterative Search Refinement

## Session Context
This is turn {TURN_NUMBER} of an iterative search refinement session.

## Search History
```yaml
turn_1:
  query: "{query_1}"
  top_result_relevance: {relevant: N, irrelevant: M}
  user_action: "clicked result 2, refined query"
turn_2:
  query: "{query_2}"
  ...
```

## Current Query
{ORIGINAL_QUERY}

## Latest Results
{SEARCH_RESULTS}

## User Feedback
{USER_FEEDBACK}

## Task
Based on the search session history, recommend the next refinement:

1. If the user seems to be narrowing down: suggest more specific queries
2. If the user seems stuck: suggest alternative angles
3. If results are improving: suggest minor tweaks
4. If results are degrading: suggest returning to a previous successful query

## Output
```json
{
  "session_analysis": {
    "trajectory": "narrowing|broadening|stuck|improving",
    "key_successful_terms": ["..."],
    "key_unsuccessful_terms": ["..."]
  },
  "next_query_recommendation": {
    "query": "suggested next query",
    "rationale": "why this should help",
    "alternative": "backup query if this doesn't work"
  },
  "session_recommendation": "continue|pivot|reset"
}
```
```

---

## Usage Example

```python
"""
Example implementation using the search refinement prompts.
"""
from typing import List, Dict
import json


class SearchRefiner:
    """Use LLM to refine vector search queries."""

    def __init__(self, llm_client, vector_store):
        self.llm = llm_client
        self.store = vector_store

    def expand_query(self, query: str, results: List[Dict]) -> List[str]:
        """Generate expanded queries using LLM."""
        prompt = f"""
# Query Expansion for Vector Search

## Original Query
{query}

## Current Top Results
{json.dumps(results[:5], indent=2)}

## Task
Generate 3 expanded query variants that might find additional relevant results.
Return as JSON array of query strings.
"""
        response = self.llm.generate(prompt)
        expanded = json.loads(response)
        return expanded

    def extract_filters(self, query: str) -> Dict:
        """Extract metadata filters from natural language query."""
        prompt = f"""
# Metadata Filter Inference

## Query
{query}

## Available Fields
source, date_created, author, project, priority, status, tags

## Task
Extract filters and return the cleaned query for embedding.
Return as JSON with "filters" and "cleaned_query" keys.
"""
        response = self.llm.generate(prompt)
        return json.loads(response)

    def refined_search(self, query: str, k: int = 10) -> List[Dict]:
        """
        Search with automatic query refinement.

        1. Extract filters from query
        2. Search with cleaned query
        3. If results are poor, expand query and re-search
        """
        # Step 1: Extract filters
        extraction = self.extract_filters(query)
        filters = extraction.get("filters", {})
        clean_query = extraction.get("cleaned_query", query)

        # Step 2: Initial search
        results = self.store.search(clean_query, k=k, filters=filters)

        # Step 3: Check result quality (simplified)
        if len(results) < k // 2 or results[0].get("distance", 1) > 0.5:
            # Results seem poor, try expansion
            expanded = self.expand_query(query, results)
            all_results = results

            for exp_query in expanded[:2]:
                exp_results = self.store.search(exp_query, k=k, filters=filters)
                all_results.extend(exp_results)

            # Deduplicate and re-rank
            seen = set()
            unique_results = []
            for r in all_results:
                if r["id"] not in seen:
                    seen.add(r["id"])
                    unique_results.append(r)

            results = sorted(unique_results, key=lambda x: x.get("distance", 1))[:k]

        return results
```

## Performance Considerations

```
Query expansion adds latency:
- LLM call: 200-2000ms depending on model
- Additional vector searches: 10-100ms each

Recommendations:
- Cache expanded queries for common searches
- Use faster/smaller LLM for expansion
- Limit to 2-3 expansion queries
- Run expanded searches in parallel
```

## When to Use This Pattern

**Use query refinement when:**
- Initial recall is low despite relevant documents existing
- Users struggle to formulate effective queries
- Domain vocabulary varies significantly
- Building conversational search interfaces

**Skip refinement when:**
- Simple keyword matching is sufficient
- Latency budget is very tight (<100ms)
- Query patterns are predictable and can be handled with templates
- Dataset is small and recall is already high
