# Search Query Generation Prompt Template

Template for generating effective semantic search queries from user requests.

## Purpose

Provide a structured prompt template for LLMs to transform user questions and requests into optimized search queries for semantic memory retrieval. This includes query expansion, decomposition for multi-hop retrieval, and metadata filter generation.

## Variables

```yaml
QUERY_TYPE: simple | expanded | decomposed | filtered
MAX_QUERIES: 5
INCLUDE_FILTERS: true
MEMORY_CATEGORIES: facts, documents, preferences, relationships
```

## Instructions

1. Analyze the user's request to understand search intent
2. Generate one or more search queries optimized for semantic similarity
3. Optionally include metadata filters to narrow results
4. Use the generated queries with agentmemory's search_memory function

---

## Core Prompt Template

```
You are a search query optimization assistant. Your task is to transform a user's question or request into effective search queries for a semantic memory system.

## User Request
<request>
{{USER_REQUEST}}
</request>

## Available Memory Categories
{{MEMORY_CATEGORIES}}

## Query Generation Guidelines

1. **Semantic Optimization**
   - Rephrase the query to match how information is likely stored
   - Use declarative statements rather than questions
   - Include relevant synonyms and related terms

2. **Query Expansion**
   - Generate multiple query variations to improve recall
   - Consider different phrasings that mean the same thing
   - Include specific terms and general concepts

3. **Decomposition (for complex queries)**
   - Break multi-part questions into atomic queries
   - Identify entity references that need resolution
   - Create sub-queries for each information need

4. **Metadata Filters**
   - Identify any constraints (topic, source, time, entity)
   - Suggest appropriate category selection
   - Include confidence or novelty filters if relevant

## Output Format

Return a JSON object with:
{
  "intent": "Brief description of what the user is looking for",
  "queries": [
    {
      "text": "The search query text",
      "category": "Which memory category to search",
      "purpose": "What this query is meant to find",
      "priority": 1-5
    }
  ],
  "filters": {
    "metadata_key": "filter_value"
  },
  "search_strategy": "simple | expanded | multi_hop | filtered"
}

Return ONLY valid JSON.
```

---

## Example Usage

### Simple Query

**User Request:** "What programming language does the user prefer?"

**Expected Output:**
```json
{
  "intent": "Find user's programming language preference",
  "queries": [
    {
      "text": "User prefers programming language",
      "category": "user_preferences",
      "purpose": "Direct preference match",
      "priority": 1
    },
    {
      "text": "favorite programming language development",
      "category": "user_preferences",
      "purpose": "Alternative phrasing",
      "priority": 2
    }
  ],
  "filters": {
    "topic": "programming_languages"
  },
  "search_strategy": "simple"
}
```

### Complex Query

**User Request:** "What did we discuss about the authentication system for the new API, and what decisions were made?"

**Expected Output:**
```json
{
  "intent": "Find discussion history and decisions about API authentication",
  "queries": [
    {
      "text": "authentication system API implementation",
      "category": "conversations",
      "purpose": "Find technical discussions",
      "priority": 1
    },
    {
      "text": "authentication decision API security",
      "category": "decisions",
      "purpose": "Find recorded decisions",
      "priority": 1
    },
    {
      "text": "OAuth JWT token authentication API",
      "category": "conversations",
      "purpose": "Find specific auth method discussions",
      "priority": 2
    },
    {
      "text": "API security requirements authentication",
      "category": "requirements",
      "purpose": "Find security requirements",
      "priority": 3
    }
  ],
  "filters": {
    "topic": "authentication"
  },
  "search_strategy": "expanded"
}
```

### Multi-Hop Query

**User Request:** "What technologies does the company that John works for use?"

**Expected Output:**
```json
{
  "intent": "Find technologies used by John's employer (requires entity resolution)",
  "queries": [
    {
      "text": "John works at company employer",
      "category": "relationships",
      "purpose": "Step 1: Resolve John's employer",
      "priority": 1
    },
    {
      "text": "{{COMPANY}} technologies tech stack",
      "category": "facts",
      "purpose": "Step 2: Find company technologies (after resolving company name)",
      "priority": 2
    },
    {
      "text": "{{COMPANY}} uses programming languages frameworks",
      "category": "facts",
      "purpose": "Step 2 alternative: Specific tech query",
      "priority": 3
    }
  ],
  "filters": {},
  "search_strategy": "multi_hop"
}
```

---

## Specialized Templates

### Conversation Context Query

```
Generate search queries to find relevant conversation history for responding to:

<current_message>
{{USER_MESSAGE}}
</current_message>

<conversation_id>
{{CONVERSATION_ID}}
</conversation_id>

Focus on:
1. Topics mentioned in the current message
2. Entities referenced that may have prior discussion
3. Related concepts that provide helpful context

Return queries optimized for conversation_turns and conversations categories.
```

### Knowledge Base Query

```
Generate search queries to answer the following question from the knowledge base:

<question>
{{USER_QUESTION}}
</question>

<available_topics>
{{TOPIC_LIST}}
</available_topics>

Generate queries that:
1. Target the most likely relevant topics
2. Use terminology matching how facts are typically stored
3. Include fallback queries for related information

Return queries for facts, documents, and document_chunks categories.
```

### Entity Resolution Query

```
Generate search queries to find information about the following entity:

<entity_reference>
{{ENTITY_REFERENCE}}
</entity_reference>

<context>
{{SURROUNDING_CONTEXT}}
</context>

Generate queries to:
1. Identify the canonical entity name
2. Find entity attributes
3. Find entity relationships

Return queries for entities and relationships categories.
```

---

## Integration Code

### Python Integration

```python
import json
from agentmemory import search_memory

def generate_search_queries(
    user_request: str,
    categories: list = None,
    llm_fn = None
) -> dict:
    """
    Generate optimized search queries from a user request.

    Args:
        user_request: The user's question or request
        categories: Available memory categories
        llm_fn: Function to call LLM (takes prompt, returns string)

    Returns:
        Parsed query specification
    """
    categories = categories or ["facts", "documents", "preferences", "relationships"]

    prompt = f'''You are a search query optimization assistant.

Transform this user request into effective semantic search queries:

<request>
{user_request}
</request>

Available categories: {", ".join(categories)}

Return JSON with format:
{{
  "intent": "What the user is looking for",
  "queries": [
    {{"text": "query", "category": "category", "purpose": "why", "priority": 1-5}}
  ],
  "filters": {{}},
  "search_strategy": "simple | expanded | multi_hop"
}}

Return ONLY valid JSON.'''

    response = llm_fn(prompt)

    try:
        return json.loads(response)
    except json.JSONDecodeError:
        # Fallback to simple query
        return {
            "intent": user_request,
            "queries": [{"text": user_request, "category": "facts", "purpose": "direct", "priority": 1}],
            "filters": {},
            "search_strategy": "simple"
        }


def execute_search_queries(
    query_spec: dict,
    n_results_per_query: int = 3,
    deduplicate: bool = True
) -> list:
    """
    Execute generated search queries against memory.

    Args:
        query_spec: Query specification from generate_search_queries
        n_results_per_query: Max results per query
        deduplicate: Remove duplicate results across queries

    Returns:
        List of search results
    """
    all_results = []
    seen_ids = set()

    # Sort queries by priority
    queries = sorted(query_spec["queries"], key=lambda q: q.get("priority", 5))

    for query in queries:
        # Skip placeholder queries (for multi-hop)
        if "{{" in query["text"]:
            continue

        results = search_memory(
            category=query["category"],
            search_text=query["text"],
            n_results=n_results_per_query,
            filter_metadata=query_spec.get("filters"),
            include_embeddings=False
        )

        for result in results:
            if deduplicate and result["id"] in seen_ids:
                continue

            seen_ids.add(result["id"])
            result["query_source"] = query["text"]
            result["query_purpose"] = query["purpose"]
            all_results.append(result)

    # Sort by distance
    all_results.sort(key=lambda r: r["distance"])

    return all_results


def search_with_query_generation(
    user_request: str,
    llm_fn,
    n_results: int = 5,
    categories: list = None
) -> dict:
    """
    Full pipeline: generate queries and execute search.

    Args:
        user_request: User's question or request
        llm_fn: LLM function for query generation
        n_results: Total results to return
        categories: Available memory categories

    Returns:
        Search results with query metadata
    """
    # Generate optimized queries
    query_spec = generate_search_queries(
        user_request=user_request,
        categories=categories,
        llm_fn=llm_fn
    )

    # Execute queries
    results = execute_search_queries(
        query_spec=query_spec,
        n_results_per_query=n_results,
        deduplicate=True
    )

    return {
        "intent": query_spec["intent"],
        "strategy": query_spec["search_strategy"],
        "queries_used": len(query_spec["queries"]),
        "results": results[:n_results]
    }


# Multi-hop search implementation
def multi_hop_search(
    query_spec: dict,
    llm_fn,
    max_hops: int = 2
) -> list:
    """
    Execute multi-hop search for complex queries.

    Args:
        query_spec: Query specification with multi_hop strategy
        llm_fn: LLM function for entity resolution
        max_hops: Maximum number of hops

    Returns:
        Final search results
    """
    resolved_entities = {}
    all_results = []

    for hop in range(max_hops):
        queries_to_run = []

        for query in query_spec["queries"]:
            query_text = query["text"]

            # Check for unresolved placeholders
            if "{{" in query_text:
                # Try to resolve from previous results
                for entity_name, entity_value in resolved_entities.items():
                    query_text = query_text.replace(f"{{{{{entity_name}}}}}", entity_value)

                # Skip if still has placeholders
                if "{{" in query_text:
                    continue

            queries_to_run.append({**query, "text": query_text})

        # Execute queries for this hop
        for query in queries_to_run:
            results = search_memory(
                category=query["category"],
                search_text=query["text"],
                n_results=3,
                include_embeddings=False
            )

            all_results.extend(results)

            # Extract entities for next hop
            for result in results:
                # Look for entity metadata
                entity = result["metadata"].get("entity")
                if entity:
                    resolved_entities[query.get("entity_key", "COMPANY")] = entity

    return all_results
```

---

## Query Optimization Patterns

### Question to Statement Conversion

| Question | Optimized Query |
|----------|-----------------|
| "What is Python?" | "Python is a programming language" |
| "When was React created?" | "React was created released history" |
| "Who wrote Hamlet?" | "Hamlet was written by author" |
| "How does OAuth work?" | "OAuth authentication process flow" |

### Synonym Expansion

| Original Term | Expanded Terms |
|---------------|----------------|
| "programming language" | "language, coding, development, syntax" |
| "database" | "database, DB, data store, storage" |
| "authentication" | "auth, login, credentials, security" |
| "deployment" | "deploy, release, ship, production" |

### Context-Aware Expansion

```python
def expand_query_with_context(query: str, context: dict) -> list:
    """Expand query based on available context."""
    expansions = [query]

    # Add user-specific expansions
    if context.get("user_domain") == "healthcare":
        medical_synonyms = {
            "patient": ["client", "case", "individual"],
            "diagnosis": ["assessment", "evaluation", "determination"]
        }
        for term, synonyms in medical_synonyms.items():
            if term in query.lower():
                for syn in synonyms:
                    expansions.append(query.replace(term, syn))

    # Add temporal expansions
    if "recent" in query.lower():
        expansions.append(query.replace("recent", "last week"))
        expansions.append(query.replace("recent", "this month"))

    return expansions
```

---

## Filter Generation

### Metadata Filter Patterns

```python
def generate_filters_from_request(request: str) -> dict:
    """Extract metadata filters from natural language request."""
    filters = {}

    # Topic detection
    topic_keywords = {
        "programming": ["code", "programming", "development", "software"],
        "infrastructure": ["deploy", "server", "cloud", "docker", "kubernetes"],
        "database": ["database", "sql", "query", "storage"],
        "security": ["security", "authentication", "authorization", "encrypt"]
    }

    for topic, keywords in topic_keywords.items():
        if any(kw in request.lower() for kw in keywords):
            filters["topic"] = topic
            break

    # Source detection
    if "from documentation" in request.lower():
        filters["source"] = "documentation"
    elif "from conversation" in request.lower():
        filters["fact_type"] = "conversation"

    # Confidence filter
    if "certain" in request.lower() or "definitely" in request.lower():
        filters["min_confidence"] = 0.9

    # Novelty filter
    if "unique" in request.lower() or "novel" in request.lower():
        filters["novel"] = "True"

    return filters
```

### Category Selection

```python
def select_categories(request: str) -> list:
    """Select appropriate categories based on request."""
    request_lower = request.lower()

    categories = []

    # Preference queries
    if any(word in request_lower for word in ["prefer", "like", "favorite", "want"]):
        categories.append("user_preferences")

    # Relationship queries
    if any(word in request_lower for word in ["relationship", "connected", "related", "works at"]):
        categories.append("relationships")

    # Entity queries
    if any(word in request_lower for word in ["who is", "what is", "company", "person", "organization"]):
        categories.append("entities")

    # Fact queries
    if any(word in request_lower for word in ["what", "how", "why", "when", "define"]):
        categories.append("facts")
        categories.append("document_chunks")

    # Conversation history
    if any(word in request_lower for word in ["discussed", "talked about", "mentioned", "said"]):
        categories.append("conversations")
        categories.append("conversation_turns")

    # Default to facts if nothing matched
    if not categories:
        categories = ["facts", "document_chunks"]

    return categories
```

---

## Performance Tips

### Query Efficiency

1. **Prioritize specific queries** - Run most specific queries first
2. **Limit results per query** - 3-5 results usually sufficient
3. **Use filters aggressively** - Reduce search space early
4. **Deduplicate across queries** - Track seen IDs

### Query Quality

1. **Match storage format** - Query in same style as stored content
2. **Include entity names** - Use specific names when known
3. **Balance precision/recall** - Multiple queries improve recall
4. **Consider embeddings** - Semantic search handles paraphrasing

### Common Mistakes

1. **Question format** - "What is X?" performs worse than "X is..."
2. **Too many stop words** - "the", "a", "of" add noise
3. **Single query reliance** - One query misses many matches
4. **Ignoring categories** - Wrong category = no results
