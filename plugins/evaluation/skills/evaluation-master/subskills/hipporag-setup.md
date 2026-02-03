# HippoRAG Setup

Guide for setting up HippoRAG infrastructure for evaluation.

## Prerequisites

- Python 3.10+
- Ollama running locally (for LLM and embeddings)

## Installation

```bash
# Install HippoRAG
pip install hipporag

# Or with uv (recommended)
cd /home/user/path
uv pip install hipporag
```

## Ollama Models

The evaluator uses Ollama for local inference:

```bash
# Pull required models
ollama pull llama3.2
ollama pull nomic-embed-text
```

## Configuration

The evaluator uses these defaults:

| Setting | Default |
|---------|---------|
| LLM Model | `ollama/llama3.2` |
| Embedding Model | `ollama/nomic-embed-text` |
| LLM Base URL | `http://localhost:11434` |
| Save Directory | `.claude/evaluation/hipporag` |

## Indexing Knowledge

To improve evaluation context, index relevant documents:

```bash
# Index specific documents
uv run python -m src.cli index doc1.md doc2.md

# Index a directory
uv run python -m src.cli index --dir /path/to/knowledge/

# Index journal entries
uv run python -m src.cli index --dir .claude/journal/
```

## How HippoRAG Helps Evaluation

1. **Multi-hop retrieval**: Finds related knowledge through graph connections
2. **Context enrichment**: Retrieved docs provide reference for accuracy checking
3. **Pattern recognition**: Identifies similar past content for comparison

## Troubleshooting

### "HippoRAG not installed"
```bash
pip install hipporag
```

### "Connection refused to localhost:11434"
```bash
# Start Ollama
ollama serve
```

### Slow evaluation
- First run downloads models
- Subsequent runs are faster
- Consider using haiku for dimension evaluation if speed matters
