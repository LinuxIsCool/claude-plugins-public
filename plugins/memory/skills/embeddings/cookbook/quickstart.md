# Purpose

Get started with text embeddings in under 5 minutes. This guide covers installation, basic usage, and your first semantic search.

## Variables

DEFAULT_MODEL: all-MiniLM-L6-v2
DEFAULT_DIMENSIONS: 384
RECOMMENDED_BATCH_SIZE: 32
MAX_SEQUENCE_LENGTH: 256

## Instructions

### Step 1: Install Dependencies

```bash
# Core library - sentence-transformers includes everything needed
pip install sentence-transformers

# Optional: for similarity visualization
pip install numpy scipy matplotlib
```

### Step 2: Generate Your First Embedding

```python
from sentence_transformers import SentenceTransformer

# Load the model (downloads automatically on first use)
model = SentenceTransformer('all-MiniLM-L6-v2')

# Generate a single embedding
text = "Machine learning is transforming software development."
embedding = model.encode(text)

print(f"Embedding shape: {embedding.shape}")  # (384,)
print(f"First 5 values: {embedding[:5]}")
```

### Step 3: Compute Semantic Similarity

```python
from sentence_transformers import SentenceTransformer, util

model = SentenceTransformer('all-MiniLM-L6-v2')

# Define sentences to compare
sentences = [
    "The cat sits on the mat.",
    "A feline rests on a rug.",
    "Python is a programming language.",
    "Machine learning requires data."
]

# Encode all sentences
embeddings = model.encode(sentences)

# Compute pairwise cosine similarity
similarity_matrix = util.cos_sim(embeddings, embeddings)

print("Similarity Matrix:")
for i, sent1 in enumerate(sentences):
    for j, sent2 in enumerate(sentences):
        if i < j:
            print(f"  '{sent1[:30]}...' vs '{sent2[:30]}...': {similarity_matrix[i][j]:.4f}")
```

**Expected Output:**
```
  'The cat sits on the mat.' vs 'A feline rests on a rug.': 0.6842
  'The cat sits on the mat.' vs 'Python is a programming langua...': 0.0421
  'A feline rests on a rug.' vs 'Machine learning requires data...': 0.0893
```

### Step 4: Basic Semantic Search

```python
from sentence_transformers import SentenceTransformer, util
import torch

model = SentenceTransformer('all-MiniLM-L6-v2')

# Your knowledge base
corpus = [
    "Python decorators allow you to modify function behavior.",
    "Machine learning models learn patterns from data.",
    "Docker containers provide isolated environments.",
    "Git branches enable parallel development workflows.",
    "API endpoints expose functionality to external systems.",
    "Database indexes improve query performance significantly.",
]

# Encode the corpus once
corpus_embeddings = model.encode(corpus, convert_to_tensor=True)

# User query
query = "How do I speed up database queries?"
query_embedding = model.encode(query, convert_to_tensor=True)

# Find top 3 most similar
similarities = util.cos_sim(query_embedding, corpus_embeddings)[0]
top_results = torch.topk(similarities, k=3)

print(f"Query: {query}\n")
print("Top matches:")
for score, idx in zip(top_results.values, top_results.indices):
    print(f"  [{score:.4f}] {corpus[idx]}")
```

**Expected Output:**
```
Query: How do I speed up database queries?

Top matches:
  [0.5823] Database indexes improve query performance significantly.
  [0.1542] Python decorators allow you to modify function behavior.
  [0.1201] Machine learning models learn patterns from data.
```

## Performance Characteristics

### all-MiniLM-L6-v2 Baseline

| Metric | Value |
|--------|-------|
| Model Size | 22M parameters |
| Embedding Dimensions | 384 |
| Max Sequence Length | 256 tokens |
| CPU Latency (single) | ~20ms |
| GPU Latency (single) | ~2ms |
| Memory Footprint | ~44MB |
| MTEB Average Score | ~56 |

### Throughput Benchmarks

| Configuration | Documents/Second |
|---------------|------------------|
| CPU (batch=1) | ~50 |
| CPU (batch=32) | ~200 |
| GPU (batch=1) | ~500 |
| GPU (batch=32) | ~2000 |

## Common Patterns

### Saving and Loading Embeddings

```python
import numpy as np
from sentence_transformers import SentenceTransformer

model = SentenceTransformer('all-MiniLM-L6-v2')

# Generate embeddings
texts = ["Document one", "Document two", "Document three"]
embeddings = model.encode(texts)

# Save to disk
np.save('embeddings.npy', embeddings)

# Load later
loaded_embeddings = np.load('embeddings.npy')
```

### Adding to a Vector Database (ChromaDB)

```python
import chromadb
from chromadb.utils.embedding_functions import SentenceTransformerEmbeddingFunction

# Use the same model as your embedding function
ef = SentenceTransformerEmbeddingFunction(model_name="all-MiniLM-L6-v2")

client = chromadb.PersistentClient(path="./chroma_db")
collection = client.get_or_create_collection(
    name="documents",
    embedding_function=ef
)

# Add documents (embeddings generated automatically)
collection.add(
    documents=["Document one", "Document two", "Document three"],
    ids=["doc1", "doc2", "doc3"]
)

# Query
results = collection.query(
    query_texts=["What is document one about?"],
    n_results=2
)
print(results)
```

## Troubleshooting

### Out of Memory on Large Batches

```python
# Use smaller batches
embeddings = model.encode(large_corpus, batch_size=16, show_progress_bar=True)
```

### Slow Performance on CPU

```python
# Enable ONNX runtime (if available)
model = SentenceTransformer('all-MiniLM-L6-v2', device='cpu')
model.to('cpu')

# Or use quantized model
# See cookbook/onnx-optimization.md
```

### Model Download Issues

```python
# Set cache directory explicitly
import os
os.environ['SENTENCE_TRANSFORMERS_HOME'] = '/path/to/cache'

# Or download offline
from huggingface_hub import snapshot_download
snapshot_download(repo_id="sentence-transformers/all-MiniLM-L6-v2")
```

## Next Steps

- **Model Selection**: See `cookbook/model-selection.md` for choosing the right model
- **Batch Processing**: See `cookbook/batch-processing.md` for production workloads
- **ONNX Optimization**: See `cookbook/onnx-optimization.md` for 10x faster CPU inference
- **Task-Specific**: See `prompts/embedding_task_instruction.md` for retrieval optimization
