---
name: openai-cookbook
description: Master OpenAI API patterns for embeddings, function calling, agents, fine-tuning, and RAG. Use when implementing semantic search, building agents with tools, creating evaluation frameworks, or integrating with 23+ vector databases. Contains 80+ production examples transferable to any LLM.
allowed-tools: Read, Glob, Grep, Bash, WebFetch
---

# OpenAI Cookbook Mastery

Production-ready patterns for LLM applications (transferable to Claude).

## Territory Map

```
resources/embeddings/openai-cookbook/
├── examples/
│   ├── embeddings/          # 11 embedding examples
│   ├── agents/              # Multi-agent, Agents SDK
│   ├── fine-tuning/         # 11 fine-tuning guides
│   ├── evaluation/          # Evals framework
│   ├── vector_databases/    # 23 integrations
│   ├── mcp/                 # MCP servers
│   └── utils/               # Reusable utilities
└── registry.yaml            # All examples cataloged
```

## Core Utilities

### Embedding Functions
```python
# From examples/utils/embeddings_utils.py
from openai import OpenAI
client = OpenAI()

def get_embedding(text, model="text-embedding-3-small"):
    text = text.replace("\n", " ")  # Always preprocess
    return client.embeddings.create(input=[text], model=model).data[0].embedding

def get_embeddings(texts, model="text-embedding-3-small"):
    assert len(texts) <= 2048  # Max batch size
    texts = [t.replace("\n", " ") for t in texts]
    return [d.embedding for d in client.embeddings.create(input=texts, model=model).data]
```

### Distance Functions
```python
from scipy import spatial

cosine_similarity = lambda a, b: 1 - spatial.distance.cosine(a, b)
l2_distance = lambda a, b: spatial.distance.euclidean(a, b)
```

## Beginner Techniques

### Basic Embeddings
```python
embedding = get_embedding("Hello world", model="text-embedding-3-small")
# Returns: list of 512 floats
```

### Semantic Search
```python
def search(query, documents, embeddings, top_k=5):
    query_embedding = get_embedding(query)
    similarities = [cosine_similarity(query_embedding, emb) for emb in embeddings]
    ranked = sorted(zip(similarities, documents), reverse=True)
    return ranked[:top_k]
```

### Token Counting
```python
import tiktoken

encoding = tiktoken.encoding_for_model("gpt-4")
num_tokens = len(encoding.encode(text))
```

## Intermediate Techniques

### Function Calling
```python
tools = [{
    "type": "function",
    "function": {
        "name": "search_database",
        "description": "Search the database",
        "parameters": {
            "type": "object",
            "properties": {"query": {"type": "string"}},
            "required": ["query"]
        }
    }
}]

response = client.chat.completions.create(
    model="gpt-4",
    tools=tools,
    messages=[{"role": "user", "content": "Find products..."}]
)

# Handle tool calls
if response.choices[0].message.tool_calls:
    for call in response.choices[0].message.tool_calls:
        result = execute_function(call.function.name, call.function.arguments)
        # Add result to messages and continue
```

### Parallel API Requests
```python
# From api_request_parallel_processor.py
# Handles rate limits, token budgets, retries
import asyncio
import aiohttp

async def process_requests(requests, rate_limit_tokens, rate_limit_requests):
    # Throttled async queue processor with token accounting
    pass
```

### RAG Pattern
```python
# 1. Document ingestion
chunks = split_documents(documents, chunk_size=500)
embeddings = get_embeddings([c.text for c in chunks])

# 2. Store in vector DB
db.add(chunks, embeddings)

# 3. Query
query_emb = get_embedding(query)
relevant = db.search(query_emb, k=5)

# 4. Generate
response = client.chat.completions.create(
    model="gpt-4",
    messages=[
        {"role": "system", "content": f"Context: {relevant}"},
        {"role": "user", "content": query}
    ]
)
```

## Advanced Techniques

### Agents SDK
```python
from agents import function_tool, Agent

@function_tool
def search(query: str) -> str:
    """Search the database"""
    return database.search(query)

agent = Agent(
    model="gpt-4",
    tools=[search],
    instructions="You are a helpful assistant"
)

result = await agent.run("Find products matching...")
```

### Multi-Agent Collaboration
```python
# From agents_sdk/multi-agent-portfolio-collaboration
analyst = Agent(model="gpt-4", tools=[analyze_tool])
executor = Agent(model="gpt-4", tools=[execute_tool])

# Orchestration logic
analysis = await analyst.run(task)
execution = await executor.run(analysis)
```

### Fine-Tuning
```python
# Prepare data
training_data = [
    {"messages": [
        {"role": "system", "content": "..."},
        {"role": "user", "content": "..."},
        {"role": "assistant", "content": "..."}
    ]}
]

# Create file
file = client.files.create(file=open("data.jsonl"), purpose="fine-tune")

# Start training
job = client.fine_tuning.jobs.create(
    training_file=file.id,
    model="gpt-4"
)
```

### Evaluation Framework
```python
# Define test cases
test_cases = [
    {"input": "...", "expected": "..."},
    ...
]

# Run evals
for case in test_cases:
    response = client.chat.completions.create(...)
    score = evaluate(response, case["expected"])
    results.append(score)

# Analyze
accuracy = sum(results) / len(results)
```

### MCP Server Integration
```python
# Build MCP servers for tools
# From mcp/building-a-supply-chain-copilot-with-agent-sdk-and-databricks-mcp
```

## Vector Database Integrations

23 databases with examples:
- Pinecone, Weaviate, Milvus, Qdrant
- MongoDB Atlas, Elasticsearch, Redis
- Chroma, LanceDB, PGVector
- Azure AI Search, Cassandra/AstraDB
- And more...

## Pattern Transferability to Claude

| OpenAI Pattern | Claude Equivalent |
|----------------|-------------------|
| `client.chat.completions.create()` | `client.messages.create()` |
| `tools=[...]` parameter | `tools=[...]` parameter |
| Function calling | Tool use |
| Embeddings API | Use Voyage AI or similar |
| Fine-tuning | Prompt engineering (mostly) |

## Key Files

| Pattern | File |
|---------|------|
| Embeddings | `examples/utils/embeddings_utils.py` |
| Parallel requests | `examples/api_request_parallel_processor.py` |
| Function calling | `examples/How_to_call_functions_with_chat_models.ipynb` |
| RAG | `examples/Question_answering_using_embeddings.ipynb` |
| Agents | `examples/agents_sdk/` |
| Fine-tuning | `examples/fine-tuning/` |
| Evaluation | `examples/evaluation/` |

## When to Use OpenAI Cookbook

- Learning LLM API patterns (transferable)
- Implementing embeddings and semantic search
- Building agents with tools
- Creating evaluation frameworks
- Integrating with vector databases
- Production scaling patterns

## Reference Files

- Embeddings utilities: `examples/utils/embeddings_utils.py`
- Parallel processor: `examples/api_request_parallel_processor.py`
- Registry: `registry.yaml`
