---
name: hipporag
description: This skill should be used when the user asks about "HippoRAG", "hippocampal memory", "knowledge graph RAG", "PageRank retrieval", "multi-hop reasoning", "entity extraction for RAG", or needs to implement sophisticated memory systems that mimic human long-term memory.
version: 0.1.0
allowed-tools: Read, Glob, Grep, Bash, WebFetch
---

# HippoRAG Skill

Provides expertise on HippoRAG - a neuroscience-inspired RAG framework that enables LLMs to continuously integrate knowledge across external documents by mimicking hippocampal memory indexing.

## Overview

HippoRAG draws inspiration from human hippocampal function to solve limitations of standard RAG approaches. Key innovations:

1. **Knowledge Graph Construction** - Documents processed to extract relational information
2. **Entity and Fact Embeddings** - Separate embedding stores for passages, entities, and facts
3. **Personalized PageRank** - Ranks nodes based on query relevance, like hippocampal replay

## Architecture

```
Documents → OpenIE → Triples → Knowledge Graph
                                    ↓
Query → Entity Recognition → Seed Nodes → PageRank → Ranked Results
```

### Key Components

| Component | Purpose | Implementation |
|-----------|---------|----------------|
| **OpenIE** | Extract (subject, predicate, object) triples | LLM-based or rule-based |
| **Knowledge Graph** | Store entity relationships | NetworkX or Neo4j |
| **PageRank** | Rank relevance from seed nodes | Personalized PageRank |
| **Embedding Models** | Entity and passage vectors | NV-Embed-v2, GritLM, Contriever |

## Why HippoRAG Outperforms Standard RAG

Standard RAG limitations:
- Retrieves passages independently
- Struggles with multi-hop reasoning
- No relationship awareness

HippoRAG advantages:
- **Pattern Completion**: Reconstructs related context from partial cues
- **Multi-hop Reasoning**: Follows relationships through graph
- **Contextual Sense-making**: Understands entity relationships

## Core Workflow

### Step 1: Document Ingestion

```python
from hipporag import HippoRAG

hippo = HippoRAG(
    llm_model="gpt-4o",
    embedding_model="NV-Embed-v2"
)

# Ingest documents with entity extraction
hippo.ingest_documents([
    "Einstein developed the theory of relativity in 1905.",
    "The theory of relativity revolutionized physics."
])
```

### Step 2: Knowledge Graph Building

HippoRAG automatically:
1. Extracts entities (Einstein, theory of relativity, physics)
2. Identifies relationships (developed, revolutionized)
3. Builds graph with weighted edges

### Step 3: Query with PageRank

```python
# Query triggers:
# 1. Entity recognition in query
# 2. Seed node identification
# 3. PageRank propagation
# 4. Passage retrieval

results = hippo.retrieve(
    query="What did Einstein contribute to science?",
    top_k=5
)
```

## Configuration Options

### LLM Integration

Supports multiple LLM backends:

```python
# OpenAI
hippo = HippoRAG(llm_model="gpt-4o")

# Local vLLM
hippo = HippoRAG(llm_model="vllm/Llama-3-8B-Instruct")

# Anthropic
hippo = HippoRAG(llm_model="claude-3-sonnet")
```

### Embedding Models

```python
# High quality (recommended)
hippo = HippoRAG(embedding_model="NV-Embed-v2")

# Balanced
hippo = HippoRAG(embedding_model="GritLM-7B")

# Lightweight
hippo = HippoRAG(embedding_model="Contriever")
```

## Performance Characteristics

Compared to GraphRAG and RAPTOR:
- **Cost efficient**: Lower API costs for indexing
- **Latency efficient**: Faster online retrieval
- **Fewer resources**: Smaller offline index size

## When to Use HippoRAG

**Best for:**
- Complex document collections with relationships
- Multi-hop reasoning requirements
- Questions requiring entity relationship understanding
- Research and knowledge-intensive applications

**Consider alternatives for:**
- Simple semantic search → agentmemory
- Token optimization → mem0
- Zero dependencies → domain-memory
- Real-time chat memory → claude-mem

## Integration with Claude Code

### Knowledge Graph Hook

```python
# PostToolUse hook for entity extraction
from hipporag import extract_entities

def capture_knowledge(tool_response):
    entities = extract_entities(tool_response)
    for entity in entities:
        store_entity(entity)
```

### Query Enhancement

```python
# UserPromptSubmit hook for context injection
def enhance_prompt(prompt):
    related_entities = hippo.get_related_entities(prompt)
    context = hippo.retrieve(prompt, top_k=3)
    return format_context(related_entities, context)
```

## Dependencies

```bash
pip install hipporag

# Required:
# - OpenAI API key (for LLM)
# - Embedding model weights
# - NetworkX for graph operations
```

## Additional Resources

### Reference Files
- `references/architecture-deep-dive.md` - Full architecture explanation
- `references/pagerank-algorithm.md` - PageRank implementation details
- `references/entity-extraction.md` - OpenIE patterns

### Repository
- Source: `/.research/HippoRAG/` (cloned locally)
- GitHub: https://github.com/OSU-NLP-Group/HippoRAG

### Related Skills
- `../memory-architecture/SKILL.md` - Three-tier patterns
- `../embeddings/SKILL.md` - Embedding model selection
