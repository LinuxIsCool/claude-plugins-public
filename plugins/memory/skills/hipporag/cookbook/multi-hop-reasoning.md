# Multi-Hop Reasoning with HippoRAG

## Purpose

Master HippoRAG's ability to answer complex questions requiring information synthesis across multiple documents. This cookbook covers multi-hop query patterns, fact chain traversal, recognition memory filtering, and evaluation strategies for reasoning-intensive tasks.

## Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `LINKING_TOP_K` | `5` | Number of top facts to use for graph search |
| `RETRIEVAL_TOP_K` | `200` | Documents retrieved per query |
| `QA_TOP_K` | `5` | Documents fed to final QA reader |
| `DAMPING` | `0.5` | PPR damping factor (affects hop distance) |
| `PASSAGE_NODE_WEIGHT` | `0.05` | Weight for passage nodes in PPR |

## Instructions

### Understanding Multi-Hop Retrieval

Standard RAG retrieves documents independently based on query similarity. HippoRAG extends this by:

1. **Extracting query entities**: Identifies key entities in the question
2. **Finding relevant facts**: Matches query to stored (subject, predicate, object) triples
3. **Graph traversal**: Uses Personalized PageRank to follow entity relationships
4. **Pattern completion**: Retrieves documents connected through multi-hop paths

```
Query: "What county is Erik Hort's birthplace a part of?"

Standard RAG:
  Query → Embedding Search → Documents mentioning "Erik Hort" OR "county"

HippoRAG Multi-Hop:
  Query → Extract "Erik Hort", "birthplace", "county"
        → Find facts: ("Erik Hort", "birthplace", "Montebello")
        → Graph traversal: Montebello → Rockland County
        → Retrieve: "Erik Hort's birthplace is Montebello"
                    "Montebello is a part of Rockland County"
```

### Multi-Hop Query Types

| Type | Example | Hops |
|------|---------|------|
| **Bridge** | "Where was the director of Titanic born?" | 2 |
| **Comparison** | "Are X and Y from the same country?" | 2 |
| **Compositional** | "Who founded the company that made the iPhone?" | 2-3 |
| **Intersection** | "Which scientist won Nobel Prize AND worked at Princeton?" | 2 |

## Code Examples

### Example 1: Basic Multi-Hop Retrieval

```python
from hipporag import HippoRAG

hipporag = HippoRAG(
    save_dir='outputs/multihop',
    llm_model_name='gpt-4o-mini',
    embedding_model_name='text-embedding-3-small'
)

# Documents with implicit relationships
documents = [
    "James Cameron directed the movie Titanic.",
    "Titanic won 11 Academy Awards in 1998.",
    "James Cameron was born in Kapuskasing, Ontario, Canada.",
    "Kapuskasing is a small town in Northern Ontario.",
    "The Academy Awards ceremony is held annually in Los Angeles."
]

hipporag.index(docs=documents)

# Multi-hop query requiring 2 hops
queries = [
    "Where was the director of Titanic born?",  # Cameron → birthplace
    "In what region is the birthplace of Titanic's director?"  # Cameron → Kapuskasing → Ontario
]

results = hipporag.retrieve(queries=queries, num_to_retrieve=5)

for result in results:
    print(f"\nQuery: {result.question}")
    print("Retrieved documents (by relevance):")
    for i, (doc, score) in enumerate(zip(result.docs, result.doc_scores)):
        print(f"  {i+1}. [{score:.4f}] {doc}")
```

### Example 2: Comparison Queries

```python
# Documents for comparison questions
documents = [
    "Imperial River is located in Florida, United States.",
    "The Amaradia river flows through Romania.",
    "Florida is a state in the southeastern United States.",
    "Romania is a country in southeastern Europe.",
    "The Imperial River may also refer to rivers in South America."
]

hipporag.index(docs=documents)

# Comparison query - requires understanding both entities
query = "Are Imperial River (Florida) and Amaradia both located in the same country?"

# The answer requires:
# 1. Imperial River → Florida → United States
# 2. Amaradia → Romania (not United States)
# 3. Comparison: Different countries

results = hipporag.retrieve(queries=[query], num_to_retrieve=10)
print(f"Retrieved {len(results[0].docs)} documents for comparison")
```

### Example 3: Compositional Queries with Evaluation

```python
# Film-related documents for compositional queries
documents = [
    "The Ancestor (1936) was directed by Guido Brignone.",
    "Guido Brignone was born on November 16, 1886.",
    "Guido Brignone died on February 4, 1959.",
    "The Old Guard (1960) is a French comedy film.",
    "The Old Guard was directed by Gilles Grangier.",
    "Gilles Grangier directed over 50 films.",
    "Jean-Jacques Annaud was born on October 1, 1943."
]

hipporag.index(docs=documents)

# Compositional queries requiring fact chaining
queries = [
    "When is the director of The Ancestor (1936)'s birthday?",
    "Who directed The Old Guard (1960)?"
]

gold_docs = [
    ["The Ancestor (1936) was directed by Guido Brignone.",
     "Guido Brignone was born on November 16, 1886."],
    ["The Old Guard (1960) is a French comedy film.",
     "The Old Guard was directed by Gilles Grangier."]
]

gold_answers = [
    ["November 16, 1886"],
    ["Gilles Grangier"]
]

# Run evaluation
solutions, responses, meta, retrieval_metrics, qa_metrics = hipporag.rag_qa(
    queries=queries,
    gold_docs=gold_docs,
    gold_answers=gold_answers
)

print(f"\nRetrieval Metrics: {retrieval_metrics}")
print(f"QA Metrics: {qa_metrics}")

for sol in solutions:
    print(f"\nQ: {sol.question}")
    print(f"A: {sol.answer}")
```

### Example 4: Inspecting the Reasoning Chain

```python
# Low-level access to understand multi-hop retrieval

# Step 1: Get fact scores for query
query = "What county is Erik Hort's birthplace a part of?"
hipporag.prepare_retrieval_objects()
hipporag.get_query_embeddings([query])

# Get raw fact scores
query_fact_scores = hipporag.get_fact_scores(query)
print(f"Fact scores shape: {query_fact_scores.shape}")

# Step 2: See which facts were selected after reranking
top_k_fact_indices, top_k_facts, rerank_log = hipporag.rerank_facts(
    query, query_fact_scores
)

print("\nFacts before reranking (recognition memory):")
for fact in rerank_log['facts_before_rerank'][:5]:
    print(f"  {fact}")

print("\nFacts after reranking:")
for fact in rerank_log['facts_after_rerank']:
    print(f"  {fact}")

# Step 3: Trace graph traversal
# The selected facts' entities become seed nodes for PPR
for fact in top_k_facts:
    subject, predicate, obj = fact
    print(f"\nSeed entities from fact '{subject} --[{predicate}]--> {obj}':")
    print(f"  - {subject}")
    print(f"  - {obj}")
```

### Example 5: MuSiQue-Style Multi-Hop Questions

```python
# MuSiQue benchmark-style questions (multi-step decomposition)

documents = [
    "Aulad (1968) is a Hindi language drama film.",
    "Aulad has music composed by Chitragupta Shrivastava.",
    "Chitragupta Shrivastava was born on November 16, 1918.",
    "Chitragupta Shrivastava composed music for over 200 Hindi films.",
    "The film Aadmi Sadak Ka has music by Ravi.",
    "Ravi Shankar Sharma composed music for Hindi films."
]

hipporag.index(docs=documents)

# Complex compositional question
query = "When is the composer of film Aulad (1968)'s birthday?"

# This requires:
# 1. Aulad (1968) → composer → Chitragupta Shrivastava
# 2. Chitragupta Shrivastava → birthday → November 16, 1918

solutions, responses, metadata = hipporag.rag_qa(queries=[query])
print(f"Answer: {solutions[0].answer}")
print(f"\nSupporting documents:")
for doc in solutions[0].docs[:3]:
    print(f"  - {doc}")
```

### Example 6: Handling Long Reasoning Chains

```python
from hipporag.utils.config_utils import BaseConfig

# Configure for longer reasoning chains
config = BaseConfig(
    linking_top_k=10,  # More facts for longer chains
    retrieval_top_k=50,  # More candidates
    damping=0.3,  # Lower damping = more exploration (longer chains)
    qa_top_k=8  # More context for complex questions
)

hipporag = HippoRAG(global_config=config, save_dir='outputs/long_chains')

# Documents requiring 3+ hops
documents = [
    "Company A was founded by Person X.",
    "Person X graduated from University Y.",
    "University Y is located in City Z.",
    "City Z is the capital of Country W.",
    "Country W is in Continent V."
]

hipporag.index(docs=documents)

# 4-hop question
query = "On which continent is the university where Company A's founder studied?"
# A → X → Y → Z → W → V

results = hipporag.retrieve(queries=[query])
```

## Common Patterns

### Pattern 1: Decomposing Complex Questions

```python
def decompose_question(question: str) -> list:
    """
    Manually or with LLM decompose a multi-hop question.
    """
    # Example: "Where was the director of Titanic born?"
    # Decomposed:
    #   1. "Who directed Titanic?"
    #   2. "Where was [director] born?"

    # For HippoRAG, the graph traversal handles this implicitly,
    # but explicit decomposition can help for very complex queries
    return [question]  # HippoRAG handles internally

# For explicit sub-question handling
sub_questions = [
    "Who directed Titanic?",
    "Where was James Cameron born?"
]

# Sequential retrieval with context accumulation
context = []
for sq in sub_questions:
    results = hipporag.retrieve(queries=[sq], num_to_retrieve=3)
    context.extend(results[0].docs)
```

### Pattern 2: Iterative Reasoning (IRCoT-style)

```python
from hipporag.utils.config_utils import BaseConfig

# Configure for iterative retrieval-reasoning
config = BaseConfig(
    max_qa_steps=3,  # Multiple retrieval-reasoning iterations
    qa_top_k=5
)

hipporag = HippoRAG(global_config=config, save_dir='outputs/iterative')

# The rag_qa method can iteratively retrieve and reason
# (depends on prompt template supporting this pattern)
```

### Pattern 3: Comparing Multiple Entities

```python
def compare_entities(hipporag, entity_a: str, entity_b: str, attribute: str) -> dict:
    """
    Compare two entities on a specific attribute.
    """
    query_a = f"What is {entity_a}'s {attribute}?"
    query_b = f"What is {entity_b}'s {attribute}?"

    results_a = hipporag.retrieve(queries=[query_a], num_to_retrieve=5)
    results_b = hipporag.retrieve(queries=[query_b], num_to_retrieve=5)

    return {
        entity_a: results_a[0].docs[:2],
        entity_b: results_b[0].docs[:2]
    }

# Usage
comparison = compare_entities(
    hipporag,
    "Gloria (1980 Film)",
    "A New Life (Film)",
    "director's country"
)
```

### Pattern 4: Evaluating Multi-Hop Recall

```python
def evaluate_multihop_recall(hipporag, queries, gold_chains):
    """
    Evaluate if all documents in a reasoning chain are retrieved.

    gold_chains: List of lists, each inner list is the required
                 document chain for one query
    """
    k_list = [1, 2, 5, 10, 20]
    results_by_k = {k: [] for k in k_list}

    for query, chain in zip(queries, gold_chains):
        result = hipporag.retrieve(queries=[query], num_to_retrieve=max(k_list))
        retrieved = result[0].docs

        for k in k_list:
            top_k = set(retrieved[:k])
            chain_set = set(chain)
            recall = len(top_k & chain_set) / len(chain_set)
            results_by_k[k].append(recall)

    # Average recall at each k
    return {k: sum(v)/len(v) for k, v in results_by_k.items()}
```

### Pattern 5: Debugging Low Multi-Hop Recall

```python
def diagnose_multihop_failure(hipporag, query, expected_docs):
    """
    Diagnose why multi-hop retrieval might be failing.
    """
    print(f"Query: {query}\n")

    # 1. Check extracted entities
    hipporag.prepare_retrieval_objects()
    hipporag.get_query_embeddings([query])

    # 2. Check fact scores
    fact_scores = hipporag.get_fact_scores(query)
    top_indices = fact_scores.argsort()[-10:][::-1]

    print("Top matching facts:")
    for idx in top_indices:
        fact_id = hipporag.fact_node_keys[idx]
        fact_content = hipporag.fact_embedding_store.get_row(fact_id)['content']
        print(f"  [{fact_scores[idx]:.4f}] {fact_content}")

    # 3. Check if bridge entities exist
    print("\nExpected documents in index:")
    for doc in expected_docs:
        chunk_id = hipporag.chunk_embedding_store.text_to_hash_id.get(doc)
        if chunk_id:
            print(f"  [FOUND] {doc[:50]}...")
        else:
            print(f"  [MISSING] {doc[:50]}...")

    # 4. Run retrieval and compare
    results = hipporag.retrieve(queries=[query], num_to_retrieve=20)
    retrieved_set = set(results[0].docs)
    expected_set = set(expected_docs)

    print(f"\nRecall: {len(retrieved_set & expected_set)}/{len(expected_set)}")
    print(f"Missing: {expected_set - retrieved_set}")
```

## Troubleshooting

### Common Multi-Hop Issues

1. **Bridge entity missing**: The connecting entity wasn't extracted during indexing
2. **Facts not connected**: Synonymy edges may not link related entities
3. **Damping too high**: PPR doesn't explore far enough (increase linking_top_k, decrease damping)
4. **Recognition memory filtering**: Relevant facts filtered out during reranking

### Tuning for Better Multi-Hop

```python
# For longer reasoning chains
config = BaseConfig(
    linking_top_k=10,      # More seed facts
    damping=0.3,           # More exploration
    synonymy_edge_sim_threshold=0.75,  # More entity connections
    passage_node_weight=0.02  # Less weight on direct passage matches
)
```

### Verifying Fact Chains

```python
# Check if the knowledge graph connects expected entities
def verify_path_exists(hipporag, entity_a: str, entity_b: str, max_hops: int = 3):
    """Check if two entities are connected within max_hops."""
    from hipporag.utils.misc_utils import compute_mdhash_id

    key_a = compute_mdhash_id(entity_a.lower(), prefix="entity-")
    key_b = compute_mdhash_id(entity_b.lower(), prefix="entity-")

    if key_a not in hipporag.node_name_to_vertex_idx:
        return False, f"Entity '{entity_a}' not in graph"
    if key_b not in hipporag.node_name_to_vertex_idx:
        return False, f"Entity '{entity_b}' not in graph"

    idx_a = hipporag.node_name_to_vertex_idx[key_a]
    idx_b = hipporag.node_name_to_vertex_idx[key_b]

    # BFS for path
    path = hipporag.graph.get_shortest_path(idx_a, idx_b)
    if path:
        return True, f"Path length: {len(path)-1} hops"
    return False, "No path found"
```
