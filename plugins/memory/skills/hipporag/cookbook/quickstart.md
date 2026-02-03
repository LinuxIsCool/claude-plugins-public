# HippoRAG Quickstart

## Purpose

Get started with HippoRAG for basic document indexing and knowledge graph-enhanced retrieval. This cookbook covers installation, initialization, document ingestion, and query execution using HippoRAG's hippocampal memory-inspired architecture.

## Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SAVE_DIR` | `outputs/` | Directory for storing HippoRAG index artifacts |
| `LLM_MODEL` | `gpt-4o-mini` | LLM for entity extraction and QA |
| `EMBEDDING_MODEL` | `text-embedding-3-small` | Model for entity/passage embeddings |
| `RETRIEVAL_TOP_K` | `200` | Number of documents to retrieve |
| `QA_TOP_K` | `5` | Documents fed to QA reader |
| `DAMPING` | `0.5` | PageRank damping factor |

## Instructions

### Step 1: Installation

```bash
# Install HippoRAG from source
git clone https://github.com/OSU-NLP-Group/HippoRAG.git
cd HippoRAG
pip install -e .

# Required dependencies
pip install igraph numpy pandas transformers openai tqdm
```

### Step 2: Initialize HippoRAG Instance

```python
from hipporag import HippoRAG

# Basic initialization with OpenAI
hipporag = HippoRAG(
    save_dir='outputs/my_index',
    llm_model_name='gpt-4o-mini',
    embedding_model_name='text-embedding-3-small'
)
```

### Step 3: Index Documents

```python
# Prepare your document corpus
documents = [
    "Albert Einstein developed the theory of general relativity in 1915.",
    "General relativity describes gravity as the curvature of spacetime.",
    "Einstein was born in Ulm, Germany in 1879.",
    "The photoelectric effect, explained by Einstein, earned him the Nobel Prize.",
    "Quantum mechanics emerged from Einstein's work on the photoelectric effect."
]

# Index documents - this performs:
# 1. Named Entity Recognition (NER)
# 2. Triple extraction (subject, predicate, object)
# 3. Knowledge graph construction
# 4. Embedding generation for passages, entities, and facts
hipporag.index(docs=documents)
```

### Step 4: Retrieve Documents

```python
# Simple retrieval
queries = ["What did Einstein contribute to physics?"]
results = hipporag.retrieve(queries=queries, num_to_retrieve=5)

# Access retrieved documents
for result in results:
    print(f"Query: {result.question}")
    for doc, score in zip(result.docs, result.doc_scores):
        print(f"  [{score:.4f}] {doc}")
```

### Step 5: Retrieval-Augmented QA

```python
# Full RAG pipeline with answer generation
queries = ["How did Einstein's work lead to quantum mechanics?"]
solutions, responses, metadata = hipporag.rag_qa(queries=queries)

for solution in solutions:
    print(f"Q: {solution.question}")
    print(f"A: {solution.answer}")
    print(f"Context docs: {len(solution.docs)}")
```

## Code Examples

### Example 1: Complete Workflow

```python
import os
from hipporag import HippoRAG

# Set API key
os.environ["OPENAI_API_KEY"] = "your-api-key"

# Initialize
hipporag = HippoRAG(
    save_dir='outputs/research_papers',
    llm_model_name='gpt-4o-mini',
    embedding_model_name='text-embedding-3-small'
)

# Research paper abstracts
papers = [
    "Transformers use self-attention mechanisms for sequence modeling.",
    "BERT introduced bidirectional pre-training for language understanding.",
    "GPT models use autoregressive language modeling for generation.",
    "Attention mechanisms compute weighted sums of value vectors.",
    "Pre-training on large corpora improves downstream task performance."
]

# Index
hipporag.index(docs=papers)

# Multi-hop query requiring relationship understanding
queries = [
    "How do transformers relate to GPT models?",
    "What technique allows BERT to understand context bidirectionally?"
]

# Retrieve with evaluation (optional gold docs)
results = hipporag.retrieve(queries=queries)

for r in results:
    print(f"\n=== {r.question} ===")
    for i, (doc, score) in enumerate(zip(r.docs[:3], r.doc_scores[:3])):
        print(f"{i+1}. [{score:.3f}] {doc[:80]}...")
```

### Example 2: With Evaluation Metrics

```python
# Define gold standard for evaluation
queries = ["What is the capital of France?"]
gold_docs = [["Paris is the capital and largest city of France."]]
gold_answers = [["Paris"]]

# Retrieve with evaluation
results, metrics = hipporag.retrieve(
    queries=queries,
    gold_docs=gold_docs
)
print(f"Recall@5: {metrics.get('recall@5', 'N/A')}")

# RAG QA with evaluation
solutions, responses, meta, retrieval_metrics, qa_metrics = hipporag.rag_qa(
    queries=queries,
    gold_docs=gold_docs,
    gold_answers=gold_answers
)
print(f"Exact Match: {qa_metrics.get('exact_match', 'N/A')}")
print(f"F1 Score: {qa_metrics.get('f1', 'N/A')}")
```

### Example 3: Document Deletion and Updates

```python
# Delete specific documents from the index
docs_to_remove = [
    "Albert Einstein developed the theory of general relativity in 1915."
]
hipporag.delete(docs_to_delete=docs_to_remove)

# Re-index with updated documents
updated_docs = [
    "Einstein published his theory of general relativity in November 1915.",
    "The field equations of general relativity were finalized in 1915."
]
hipporag.index(docs=updated_docs)
```

### Example 4: Dense Passage Retrieval Fallback

```python
# When no relevant facts are found, HippoRAG falls back to DPR
# You can also explicitly use DPR-only retrieval
results = hipporag.retrieve_dpr(queries=queries, num_to_retrieve=10)

# DPR-based RAG QA
solutions, responses, meta = hipporag.rag_qa_dpr(queries=queries)
```

## Common Patterns

### Pattern 1: Incremental Indexing

```python
# HippoRAG supports incremental indexing
# New documents are added without re-processing existing ones

# Initial index
hipporag.index(docs=initial_docs)

# Later, add more documents
hipporag.index(docs=new_docs)  # Only new docs are processed
```

### Pattern 2: Custom Save Directory per Project

```python
# Organize indices by project
projects = {
    'legal': 'outputs/legal_docs',
    'medical': 'outputs/medical_docs',
    'technical': 'outputs/tech_docs'
}

hipporag_legal = HippoRAG(save_dir=projects['legal'], ...)
hipporag_medical = HippoRAG(save_dir=projects['medical'], ...)
```

### Pattern 3: Batch Query Processing

```python
# Process multiple queries efficiently
queries = [
    "What is machine learning?",
    "How does deep learning differ from traditional ML?",
    "What are neural network architectures?"
]

# Batch retrieve - embeddings computed once per unique query
results = hipporag.retrieve(queries=queries)
```

### Pattern 4: Accessing Graph Information

```python
# Get statistics about the constructed knowledge graph
graph_info = hipporag.get_graph_info()
print(f"Phrase nodes: {graph_info['num_phrase_nodes']}")
print(f"Passage nodes: {graph_info['num_passage_nodes']}")
print(f"Total triples: {graph_info['num_total_triples']}")
print(f"Synonymy edges: {graph_info['num_synonymy_triples']}")
```

## Troubleshooting

### Common Issues

1. **Empty retrieval results**: Ensure documents are indexed before retrieval
2. **Low recall**: Increase `retrieval_top_k` or adjust `damping` factor
3. **Slow indexing**: Entity extraction is LLM-intensive; consider batching
4. **Memory errors**: Process large corpora in chunks; monitor `embedding_batch_size`

### Verifying Index State

```python
# Check if ready for retrieval
print(f"Ready: {hipporag.ready_to_retrieve}")

# Verify indexed content
chunk_store = hipporag.chunk_embedding_store
print(f"Indexed passages: {len(chunk_store.get_all_ids())}")

entity_store = hipporag.entity_embedding_store
print(f"Extracted entities: {len(entity_store.get_all_ids())}")
```
