---
name: rag-pipelines
description: Build Retrieval-Augmented Generation pipelines. Use when constructing context for LLMs, building QA systems over code, or creating documentation assistants. Covers chunking, retrieval, reranking, and prompt engineering.
allowed-tools: Read, Bash, Glob, Grep, Task, WebFetch
---

# RAG Pipelines

Retrieval-Augmented Generation for code understanding.

## What is RAG?

```
┌─────────────────────────────────────────────────────────────┐
│                    RAG PIPELINE                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   User Query: "How does authentication work?"                │
│         │                                                    │
│         ▼                                                    │
│   ┌───────────┐                                              │
│   │ RETRIEVER │ ──► Search codebase for relevant chunks      │
│   └─────┬─────┘                                              │
│         │                                                    │
│         ▼                                                    │
│   ┌───────────┐                                              │
│   │  CONTEXT  │ ──► auth_middleware.py, login.ts, etc.       │
│   └─────┬─────┘                                              │
│         │                                                    │
│         ▼                                                    │
│   ┌───────────┐                                              │
│   │ GENERATOR │ ──► LLM answers with retrieved context       │
│   └─────┬─────┘                                              │
│         │                                                    │
│         ▼                                                    │
│   Response: "Authentication uses JWT tokens in middleware..."│
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## The RAG Formula

```
Response = LLM(Query + Retrieved_Context)

Quality = f(Retrieval_Quality, Context_Relevance, Prompt_Design)
```

## Pipeline Components

### 1. Document Processing

```python
from typing import List, Dict

def process_codebase(root_path: str) -> List[Dict]:
    """
    Process codebase into indexable documents.

    Returns list of:
    {
        'id': unique identifier,
        'content': text content,
        'metadata': {
            'file_path': str,
            'language': str,
            'type': 'function' | 'class' | 'file' | 'comment',
            'start_line': int,
            'end_line': int
        }
    }
    """
    documents = []

    for file_path in glob(f"{root_path}/**/*", recursive=True):
        if is_code_file(file_path):
            content = read_file(file_path)
            language = detect_language(file_path)

            # Chunk by logical units
            chunks = chunk_by_structure(content, language)

            for chunk in chunks:
                documents.append({
                    'id': f"{file_path}:{chunk['start_line']}",
                    'content': chunk['content'],
                    'metadata': {
                        'file_path': file_path,
                        'language': language,
                        'type': chunk['type'],
                        'start_line': chunk['start_line'],
                        'end_line': chunk['end_line']
                    }
                })

    return documents
```

### 2. Chunking Strategies

#### Strategy A: Fixed Size with Overlap

```python
def fixed_chunk(text: str, chunk_size: int = 512, overlap: int = 50) -> List[str]:
    """Simple but loses context at boundaries."""
    words = text.split()
    chunks = []

    for i in range(0, len(words), chunk_size - overlap):
        chunk = ' '.join(words[i:i + chunk_size])
        chunks.append(chunk)

    return chunks
```

#### Strategy B: Semantic Chunking (Recommended for Code)

```python
def semantic_chunk(content: str, language: str) -> List[Dict]:
    """
    Chunk by code structure: functions, classes, modules.
    Preserves logical boundaries.
    """
    import tree_sitter

    parser = get_parser(language)
    tree = parser.parse(content.encode())

    chunks = []

    for node in tree.root_node.children:
        if node.type in ['function_definition', 'class_definition',
                          'method_definition', 'function_declaration']:
            chunks.append({
                'content': content[node.start_byte:node.end_byte],
                'type': node.type,
                'start_line': node.start_point[0],
                'end_line': node.end_point[0]
            })

    return chunks
```

#### Strategy C: Recursive Character Splitting (LangChain Style)

```python
def recursive_split(text: str, separators: List[str], chunk_size: int) -> List[str]:
    """
    Split recursively, trying each separator in order.
    Good for markdown, prose, mixed content.
    """
    chunks = []

    for sep in separators:
        if sep in text:
            parts = text.split(sep)
            for part in parts:
                if len(part) <= chunk_size:
                    chunks.append(part)
                else:
                    # Recurse with remaining separators
                    chunks.extend(recursive_split(
                        part,
                        separators[separators.index(sep)+1:],
                        chunk_size
                    ))
            return chunks

    # No separator found, force split
    return [text[i:i+chunk_size] for i in range(0, len(text), chunk_size)]

# Default separators for code
CODE_SEPARATORS = [
    "\n\n\n",      # Multiple blank lines (module boundaries)
    "\nclass ",     # Class definitions
    "\ndef ",       # Function definitions
    "\n\n",         # Paragraph breaks
    "\n",           # Line breaks
    " ",            # Word breaks
]
```

### 3. Retrieval Methods

#### Basic Vector Retrieval

```python
async def retrieve_similar(query: str, index, k: int = 5) -> List[Dict]:
    """Simple semantic retrieval."""
    query_embedding = await embed(query)
    results = index.search(query_embedding, k=k)
    return results
```

#### Hybrid Retrieval (Recommended)

```python
async def retrieve_hybrid(query: str, index, corpus, k: int = 5) -> List[Dict]:
    """Combine keyword and semantic."""
    # See hybrid-search sub-skill for details
    keyword_results = bm25_search(query, corpus, k=k*2)
    semantic_results = await vector_search(query, index, k=k*2)
    return reciprocal_rank_fusion(keyword_results, semantic_results, k=k)
```

#### Multi-Query Retrieval

```python
async def multi_query_retrieve(query: str, index, k: int = 5) -> List[Dict]:
    """
    Generate multiple query variations, retrieve for each, merge.
    Improves recall for ambiguous queries.
    """
    # Generate variations
    variations = await llm_generate_variations(query, n=3)
    # Example: "authentication" →
    #   ["user login", "auth middleware", "token validation"]

    all_results = []
    for variation in [query] + variations:
        results = await retrieve_similar(variation, index, k=k)
        all_results.extend(results)

    # Dedupe and re-rank
    return dedupe_by_id(all_results)[:k]
```

#### Parent-Child Retrieval

```python
async def parent_child_retrieve(query: str, index, k: int = 5) -> List[Dict]:
    """
    Retrieve small chunks, return their parent context.
    Best recall for specific queries, full context for generation.
    """
    # Retrieve fine-grained chunks
    child_results = await retrieve_similar(query, index, k=k*2)

    # Get parent documents
    parent_ids = set(r['metadata']['parent_id'] for r in child_results)
    parents = [get_document(pid) for pid in parent_ids]

    return parents[:k]
```

### 4. Reranking

```python
async def rerank(query: str, documents: List[Dict], top_k: int = 5) -> List[Dict]:
    """
    Use cross-encoder to rerank initial retrieval.
    More accurate but slower than bi-encoder retrieval.
    """
    from sentence_transformers import CrossEncoder

    model = CrossEncoder('cross-encoder/ms-marco-MiniLM-L-6-v2')

    pairs = [(query, doc['content']) for doc in documents]
    scores = model.predict(pairs)

    ranked = sorted(zip(documents, scores), key=lambda x: -x[1])
    return [doc for doc, score in ranked[:top_k]]
```

### 5. Context Assembly

```python
def assemble_context(documents: List[Dict], max_tokens: int = 4000) -> str:
    """
    Assemble retrieved documents into LLM context.

    Strategies:
    - Simple concatenation
    - Structured with metadata
    - Hierarchical (summaries + details)
    """
    context_parts = []
    current_tokens = 0

    for doc in documents:
        doc_tokens = count_tokens(doc['content'])

        if current_tokens + doc_tokens > max_tokens:
            break

        # Format with metadata
        formatted = f"""
### {doc['metadata']['file_path']}
Lines {doc['metadata']['start_line']}-{doc['metadata']['end_line']}

```{doc['metadata']['language']}
{doc['content']}
```
"""
        context_parts.append(formatted)
        current_tokens += doc_tokens

    return "\n".join(context_parts)
```

### 6. Prompt Templates

#### Code QA Template

```python
CODE_QA_PROMPT = """You are a code assistant. Answer the question based on the provided code context.

## Code Context
{context}

## Question
{question}

## Instructions
- Answer based ONLY on the provided code context
- If the answer isn't in the context, say "I don't see this in the provided code"
- Include relevant code snippets in your answer
- Reference specific files and line numbers

## Answer
"""
```

#### Code Explanation Template

```python
CODE_EXPLAIN_PROMPT = """Explain the following code in detail.

## Code
```{language}
{code}
```

## Context (Related Code)
{context}

## Explanation
Provide:
1. What the code does (high-level)
2. How it works (step by step)
3. Key patterns or idioms used
4. Potential edge cases or issues
"""
```

#### Documentation Generation Template

```python
DOC_GEN_PROMPT = """Generate documentation for this code.

## Code
```{language}
{code}
```

## Related Code (for context)
{context}

## Generate
- Brief description
- Parameters (with types if inferrable)
- Return value
- Example usage
- Any important notes
"""
```

## Complete Pipeline Example

```python
class RAGPipeline:
    def __init__(self, index, corpus, llm_client):
        self.index = index
        self.corpus = corpus
        self.llm = llm_client

    async def query(self, question: str) -> str:
        """Full RAG pipeline."""

        # 1. Retrieve
        candidates = await self.retrieve_hybrid(question, k=10)

        # 2. Rerank
        relevant = await self.rerank(question, candidates, top_k=5)

        # 3. Assemble context
        context = self.assemble_context(relevant, max_tokens=4000)

        # 4. Generate
        prompt = CODE_QA_PROMPT.format(
            context=context,
            question=question
        )

        response = await self.llm.complete(prompt)

        # 5. Return with sources
        return {
            'answer': response,
            'sources': [doc['metadata']['file_path'] for doc in relevant]
        }
```

## Evaluation

### Metrics

| Metric | What it Measures | How to Compute |
|--------|------------------|----------------|
| **Context Recall** | % of needed info retrieved | Manual annotation |
| **Answer Correctness** | Is the answer right? | LLM-as-judge or human |
| **Faithfulness** | Does answer match context? | Check for hallucination |
| **Relevance** | Is context on-topic? | Semantic similarity |

### RAGAS Evaluation

```python
from ragas import evaluate
from ragas.metrics import (
    faithfulness,
    answer_relevancy,
    context_precision,
    context_recall
)

# Prepare evaluation dataset
eval_data = {
    'question': questions,
    'answer': generated_answers,
    'contexts': retrieved_contexts,
    'ground_truths': expected_answers
}

# Run evaluation
results = evaluate(
    eval_data,
    metrics=[
        faithfulness,
        answer_relevancy,
        context_precision,
        context_recall
    ]
)

print(results)
# {'faithfulness': 0.85, 'answer_relevancy': 0.92, ...}
```

## Anti-Patterns

1. **Stuffing too much context**
   - Bad: Dump 10K tokens of code
   - Good: Retrieve focused, relevant chunks

2. **Ignoring chunk boundaries**
   - Bad: Cut functions in half
   - Good: Chunk by semantic units

3. **No reranking**
   - Bad: Trust initial retrieval scores
   - Good: Cross-encoder rerank for accuracy

4. **Generic prompts**
   - Bad: "Answer the question: {q}"
   - Good: Domain-specific templates with structure

5. **No evaluation loop**
   - Bad: Deploy and hope
   - Good: Continuous eval with RAGAS or similar

## Integration with Claude Code

### Use with Explore Agent

```
For complex code understanding:
1. Use Explore agent to find relevant areas
2. Use RAG pipeline for specific questions
3. Combine insights
```

### Building Indices

```bash
# Index a codebase for RAG
# See vector-embeddings sub-skill for indexing details
```

## Tools and Frameworks

| Tool | Best For | Notes |
|------|----------|-------|
| **LangChain** | Quick prototyping | Many integrations |
| **LlamaIndex** | Document QA | Excellent for RAG |
| **Haystack** | Production | Modular pipelines |
| **Archon** | Code-specific | Has hybrid search built-in |
| **ragas** | Evaluation | Standard for RAG metrics |
