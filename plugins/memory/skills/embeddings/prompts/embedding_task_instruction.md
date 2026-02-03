# Embedding Task Instructions

Task-specific instructions for optimizing embedding quality. Modern embedding models support instruction prefixes that prime the model for specific tasks.

## Purpose

Different embedding tasks benefit from different instruction prefixes. This document provides templates for common tasks, compatible with instruction-following embedding models like E5, BGE, and Qwen3.

## Variables

SUPPORTED_MODELS: E5-v2, E5-Mistral-7B, BGE-v1.5, BGE-M3, Qwen3-Embedding
INSTRUCTION_POSITION: prefix (before text)
DEFAULT_SEPARATOR: ": " (colon + space)

## Task Templates

### Retrieval (Query Side)

Use for user queries in semantic search applications.

```
Instruction: Represent this query for retrieving relevant documents
Text: <user_query_here>
```

**Example:**
```python
query_instruction = "Represent this query for retrieving relevant documents: "
query = "How do I implement authentication in FastAPI?"
encoded_query = query_instruction + query
```

### Retrieval (Document Side)

Use for documents/passages being indexed.

```
Instruction: Represent this document for retrieval
Text: <document_text_here>
```

**Example:**
```python
doc_instruction = "Represent this document for retrieval: "
document = "FastAPI provides OAuth2 with Password and Bearer authentication..."
encoded_doc = doc_instruction + document
```

### Semantic Similarity

Use when comparing text similarity (symmetric task).

```
Instruction: Represent this sentence for semantic similarity comparison
Text: <sentence_here>
```

**Example:**
```python
similarity_instruction = "Represent this sentence for semantic similarity comparison: "
sentence1 = similarity_instruction + "The weather is beautiful today"
sentence2 = similarity_instruction + "It's a lovely day outside"
```

### Classification

Use when generating embeddings for text classification.

```
Instruction: Classify the following text
Text: <text_to_classify>
```

**Example:**
```python
class_instruction = "Classify the following text: "
text = "The new iPhone has amazing camera quality and battery life"
encoded = class_instruction + text
```

### Clustering

Use when generating embeddings for document clustering.

```
Instruction: Identify the main topic of this text
Text: <text_here>
```

**Example:**
```python
cluster_instruction = "Identify the main topic of this text: "
text = "Python's asyncio library enables concurrent programming..."
encoded = cluster_instruction + text
```

### Question Answering (Question)

Use for the question in QA retrieval.

```
Instruction: Represent this question for finding relevant answers
Text: <question_here>
```

### Question Answering (Context)

Use for the context/answer passages.

```
Instruction: Represent this passage that contains an answer to a question
Text: <passage_here>
```

### Code Search (Query)

Use for natural language queries searching code.

```
Instruction: Represent this natural language query for code search
Text: <query_here>
```

**Example:**
```python
code_query_instruction = "Represent this natural language query for code search: "
query = "function to sort a list in reverse order"
encoded = code_query_instruction + query
```

### Code Search (Code)

Use for code snippets being indexed.

```
Instruction: Represent this code snippet for search
Text: <code_here>
```

**Example:**
```python
code_instruction = "Represent this code snippet for search: "
code = "def reverse_sort(lst): return sorted(lst, reverse=True)"
encoded = code_instruction + code
```

## Model-Specific Formats

### E5 Models (intfloat/e5-*)

E5 uses "query:" and "passage:" prefixes.

```python
# For queries
query = "query: What is machine learning?"

# For documents/passages
doc = "passage: Machine learning is a subset of artificial intelligence..."
```

### BGE Models (BAAI/bge-*)

BGE uses instruction prefix format.

```python
# For queries
query_prefix = "Represent this sentence for searching relevant passages: "
query = query_prefix + "What is machine learning?"

# For documents (no prefix needed, but can use)
doc = "Machine learning is a subset of artificial intelligence..."
```

### Qwen3-Embedding

Qwen3 uses prompt_name parameter for task-specific encoding.

```python
from sentence_transformers import SentenceTransformer

model = SentenceTransformer('Qwen/Qwen3-Embedding-0.6B', trust_remote_code=True)

# Query encoding
query_embedding = model.encode(
    "What is machine learning?",
    prompt_name="query"
)

# Document encoding
doc_embedding = model.encode(
    "Machine learning is a subset of AI...",
    prompt_name="document"
)
```

## Implementation Patterns

### Unified Instruction Handler

```python
from typing import Literal
from dataclasses import dataclass

TaskType = Literal[
    "retrieval_query",
    "retrieval_document",
    "similarity",
    "classification",
    "clustering",
    "qa_question",
    "qa_context",
    "code_query",
    "code_document"
]

@dataclass
class InstructionTemplate:
    e5: str
    bge: str
    generic: str

TASK_INSTRUCTIONS: dict[TaskType, InstructionTemplate] = {
    "retrieval_query": InstructionTemplate(
        e5="query: ",
        bge="Represent this sentence for searching relevant passages: ",
        generic="Represent this query for retrieving relevant documents: "
    ),
    "retrieval_document": InstructionTemplate(
        e5="passage: ",
        bge="",  # BGE doesn't require doc prefix
        generic="Represent this document for retrieval: "
    ),
    "similarity": InstructionTemplate(
        e5="query: ",
        bge="Represent this sentence: ",
        generic="Represent this sentence for semantic similarity: "
    ),
    "classification": InstructionTemplate(
        e5="query: ",
        bge="Represent this sentence for classification: ",
        generic="Classify the following text: "
    ),
    "clustering": InstructionTemplate(
        e5="query: ",
        bge="Represent this sentence for clustering: ",
        generic="Identify the main topic of this text: "
    ),
    "qa_question": InstructionTemplate(
        e5="query: ",
        bge="Represent this question for finding answers: ",
        generic="Represent this question for finding relevant answers: "
    ),
    "qa_context": InstructionTemplate(
        e5="passage: ",
        bge="",
        generic="Represent this passage that contains an answer: "
    ),
    "code_query": InstructionTemplate(
        e5="query: ",
        bge="Represent this query for code search: ",
        generic="Represent this natural language query for code search: "
    ),
    "code_document": InstructionTemplate(
        e5="passage: ",
        bge="",
        generic="Represent this code snippet for search: "
    )
}

def get_instruction(
    task: TaskType,
    model_family: Literal["e5", "bge", "generic"] = "generic"
) -> str:
    """Get the appropriate instruction prefix for a task and model."""
    template = TASK_INSTRUCTIONS[task]
    return getattr(template, model_family)

def apply_instruction(text: str, task: TaskType, model_family: str = "generic") -> str:
    """Apply instruction prefix to text."""
    instruction = get_instruction(task, model_family)
    return instruction + text

# Usage
query = "How do I implement caching in Python?"
instructed_query = apply_instruction(query, "retrieval_query", "bge")
print(instructed_query)
# Output: "Represent this sentence for searching relevant passages: How do I implement caching in Python?"
```

### Batch Processing with Instructions

```python
from sentence_transformers import SentenceTransformer
from typing import List

def embed_with_instructions(
    texts: List[str],
    task: TaskType,
    model_name: str = "BAAI/bge-base-en-v1.5"
) -> list:
    """Embed texts with appropriate task instructions."""

    # Determine model family
    if "e5" in model_name.lower():
        model_family = "e5"
    elif "bge" in model_name.lower():
        model_family = "bge"
    else:
        model_family = "generic"

    # Apply instructions
    instructed_texts = [
        apply_instruction(text, task, model_family)
        for text in texts
    ]

    # Generate embeddings
    model = SentenceTransformer(model_name)
    embeddings = model.encode(instructed_texts)

    return embeddings

# Usage
queries = ["What is Python?", "How does JavaScript work?"]
query_embeddings = embed_with_instructions(queries, "retrieval_query")

documents = ["Python is a programming language...", "JavaScript runs in browsers..."]
doc_embeddings = embed_with_instructions(documents, "retrieval_document")
```

### Asymmetric Retrieval Pattern

```python
from sentence_transformers import SentenceTransformer, util
import numpy as np

class AsymmetricRetriever:
    """
    Retriever that applies different instructions to queries and documents.
    Critical for optimal retrieval performance with instruction-based models.
    """

    def __init__(self, model_name: str = "BAAI/bge-base-en-v1.5"):
        self.model = SentenceTransformer(model_name)
        self.model_family = self._detect_family(model_name)
        self.corpus_embeddings = None
        self.corpus = []

    def _detect_family(self, name: str) -> str:
        if "e5" in name.lower():
            return "e5"
        elif "bge" in name.lower():
            return "bge"
        return "generic"

    def index_documents(self, documents: List[str]):
        """Index documents with document-specific instructions."""
        self.corpus = documents
        instructed_docs = [
            apply_instruction(doc, "retrieval_document", self.model_family)
            for doc in documents
        ]
        self.corpus_embeddings = self.model.encode(
            instructed_docs,
            convert_to_tensor=True,
            normalize_embeddings=True
        )

    def search(self, query: str, top_k: int = 10) -> List[dict]:
        """Search with query-specific instruction."""
        instructed_query = apply_instruction(
            query, "retrieval_query", self.model_family
        )
        query_embedding = self.model.encode(
            instructed_query,
            convert_to_tensor=True,
            normalize_embeddings=True
        )

        scores = util.cos_sim(query_embedding, self.corpus_embeddings)[0]
        top_indices = scores.argsort(descending=True)[:top_k]

        results = []
        for idx in top_indices:
            results.append({
                "document": self.corpus[idx],
                "score": float(scores[idx])
            })

        return results

# Usage
retriever = AsymmetricRetriever("BAAI/bge-base-en-v1.5")
retriever.index_documents([
    "Python is a high-level programming language.",
    "Machine learning uses algorithms to learn from data.",
    "Docker containers isolate applications.",
])

results = retriever.search("What programming language is easy to learn?")
for r in results:
    print(f"[{r['score']:.4f}] {r['document']}")
```

## Performance Impact

Task-specific instructions improve retrieval quality:

| Scenario | Without Instruction | With Instruction | Improvement |
|----------|---------------------|------------------|-------------|
| MS MARCO (Recall@10) | 0.72 | 0.78 | +8% |
| NQ (Recall@10) | 0.68 | 0.75 | +10% |
| Code Search | 0.45 | 0.62 | +38% |

## Best Practices

1. **Always use asymmetric instructions** for retrieval tasks
2. **Match instruction to model family** (E5, BGE, etc.)
3. **Keep instructions concise** - long instructions reduce effective context
4. **Be consistent** - use same instruction for all queries/documents in a collection
5. **Test on your data** - optimal instructions may vary by domain

## Next Steps

- **Model Selection**: See `cookbook/model-selection.md` for choosing instruction-aware models
- **Sentence Transformers**: See `cookbook/sentence-transformers.md` for implementation
- **Benchmarking**: Use `tools/embedding_benchmark.py` to test instruction impact
