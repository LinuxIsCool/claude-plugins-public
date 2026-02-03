---
name: claude-cookbooks
description: Master Claude API patterns from Anthropic's official cookbook. Use when building with Claude API, implementing RAG, tool use, sub-agents, extended thinking, Skills API for document generation, or multi-agent workflows. Contains 50+ production-ready examples.
allowed-tools: Read, Glob, Grep, Bash, WebFetch
---

# Claude Cookbooks Mastery

Production-ready patterns for building with Claude API.

## Territory Map

```
resources/embeddings/anthropic-cookbook/
├── capabilities/
│   ├── classification/      # Text categorization with RAG
│   ├── retrieval_augmented_generation/  # RAG fundamentals
│   ├── contextual-embeddings/   # Advanced retrieval
│   └── summarization/       # Multi-document synthesis
├── tool_use/
│   ├── calculator_tool.ipynb
│   ├── customer_service_agent.ipynb
│   ├── memory_cookbook.ipynb
│   └── tool_search_with_embeddings.ipynb
├── multimodal/
│   ├── getting_started_with_vision.ipynb
│   └── using_sub_agents.ipynb
├── extended_thinking/       # Transparent reasoning
├── patterns/agents/         # Multi-LLM workflows
├── skills/                  # Excel, PowerPoint, PDF generation
└── third_party/            # Voyage AI, Pinecone, MongoDB
```

## Core Patterns

### 1. Basic Tool Integration
```python
tools = [{
    "type": "function",
    "function": {
        "name": "calculate",
        "description": "Perform arithmetic",
        "parameters": {
            "type": "object",
            "properties": {"expression": {"type": "string"}},
            "required": ["expression"]
        }
    }
}]

response = client.messages.create(
    model="claude-opus-4-5-20251101",
    tools=tools,
    messages=[...]
)
```

### 2. RAG Implementation
```
Document corpus → Chunk → Embed (Voyage AI) → Store (vector DB)
                                                    ↓
User query → Embed → Retrieve top-k → Context → Claude → Response
```

### 3. Agentic Loop
```python
while True:
    response = client.messages.create(...)
    if response.stop_reason == "end_turn":
        break
    elif response.stop_reason == "tool_use":
        # Process tool calls
        tool_results = execute_tools(response)
        messages.append(tool_results)
```

### 4. Sub-Agent Architecture
```
User → Opus (orchestrator)
         ↓
    Haiku (extraction) × N  # 95% cost reduction
         ↓
    Opus (synthesis)
         ↓
    Response
```

## Beginner Techniques

### Simple Chat Completion
```python
from anthropic import Anthropic
client = Anthropic()

response = client.messages.create(
    model="claude-opus-4-5-20251101",
    max_tokens=1024,
    messages=[{"role": "user", "content": "Hello!"}]
)
```

### Vision Basics
```python
response = client.messages.create(
    model="claude-opus-4-5-20251101",
    messages=[{
        "role": "user",
        "content": [
            {"type": "image", "source": {"type": "base64", ...}},
            {"type": "text", "text": "Describe this image"}
        ]
    }]
)
```

## Intermediate Techniques

### Extended Thinking
```python
response = client.messages.create(
    model="claude-opus-4-5-20251101",
    thinking={"type": "enabled", "budget_tokens": 5000},
    messages=[...]
)
# response.content has [thinking_block, text_block]
```

### Prompt Caching (90% cost reduction)
```python
system = [
    {"type": "text", "text": "Long system prompt..."},
    {"type": "text", "text": "Cached context...",
     "cache_control": {"type": "ephemeral"}}
]
```

### Memory Management
```python
# From memory_cookbook.ipynb
# Store/retrieve context with explicit memory tools
# Compress long histories with context editing
```

## Advanced Techniques

### Skills API (Document Generation)
```python
response = client.beta.messages.create(
    model="claude-opus-4-5-20251101",
    betas=["skills-2025-10-02", "files-api-2025-04-14"],
    container={"type": "bash"},
    tools=[...],  # code_execution tool
    messages=[{"role": "user", "content": "Create Excel report"}]
)
# Extract file_ids → Download with client.beta.files.download()
```

### Multi-Agent Workflows
```python
# Sequential: LLM1 → LLM2 (quality focus)
# Parallel: LLM1 || LLM2 → combine (latency focus)
# Hierarchical: Planner → Workers (cost optimization)
```

### Evaluator-Optimizer Loop
```python
# Generate → Evaluate → If quality < threshold → Improve → Loop
# From patterns/agents/evaluator_optimizer.ipynb
```

### Tool Search with Embeddings
```python
# Embed all tools, find top-K relevant for query
# From tool_use/tool_search_with_embeddings.ipynb
```

## Third-Party Integrations

- **Voyage AI**: State-of-the-art embeddings
- **Pinecone, MongoDB**: Vector databases
- **Deepgram**: Audio transcription
- **ElevenLabs**: Text-to-speech

## Key Patterns Reference

| Pattern | Example File | Use Case |
|---------|--------------|----------|
| Basic tools | calculator_tool.ipynb | Simple operations |
| Customer agent | customer_service_agent.ipynb | Multi-tool chatbot |
| RAG | retrieval_augmented_generation/ | Document Q&A |
| Sub-agents | using_sub_agents.ipynb | Cost optimization |
| Extended thinking | extended_thinking.ipynb | Complex reasoning |
| Skills API | skills/notebooks/ | Document generation |
| Agents | patterns/agents/ | Multi-step workflows |

## When to Use Claude Cookbooks

- Learning Claude API best practices
- Implementing production tool use
- Building RAG systems with evaluation
- Creating multi-agent architectures
- Generating documents (Excel, PowerPoint, PDF)
- Optimizing costs with sub-agents and caching

## Reference Files

- Tool use fundamentals: `tool_use/calculator_tool.ipynb`
- RAG guide: `capabilities/retrieval_augmented_generation/guide.ipynb`
- Sub-agents: `multimodal/using_sub_agents.ipynb`
- Skills: `skills/notebooks/01_skills_introduction.ipynb`
