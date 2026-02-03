---
name: llama-cookbook
description: Master Meta's Llama models for inference, fine-tuning, RAG, and multi-agent systems. Use when building with Llama 3/4 models, implementing tool calling, fine-tuning with LoRA/FSDP, or creating production AI applications. Official Meta guide with 25+ end-to-end examples.
allowed-tools: Read, Glob, Grep, Bash, WebFetch
---

# Llama Cookbook Mastery

Official Meta guide for building with Llama models.

## Territory Map

```
resources/embeddings/llama-cookbook/
├── getting-started/
│   ├── build_with_llama_api.ipynb    # Llama 4 API
│   ├── inference/                     # Local and API inference
│   ├── finetuning/                    # LoRA, FSDP, vision
│   ├── RAG/                           # Retrieval-augmented generation
│   └── responsible_ai/                # Llama Guard, Prompt Guard
├── end-to-end-use-cases/
│   ├── agents/                        # 101, 201 tutorials
│   ├── chatbots/                      # Customer service, WhatsApp
│   ├── RAG/                           # Text, multimodal, RAFT
│   ├── content_generation/            # Blog, podcast creation
│   └── coding/                        # Coding assistant, text-to-SQL
└── 3p-integrations/
    ├── aws/, azure/, groq/            # Cloud providers
    ├── langchain/, llamaindex/        # Frameworks
    └── vllm/, tgi/                    # Inference servers
```

## Model Lineup

| Model | Context | Best For |
|-------|---------|----------|
| Llama 4 Scout | 10M tokens | Massive context analysis |
| Llama 4 Maverick | 1M tokens | Long documents, research |
| Llama 3.3 70B | 128K | Complex reasoning |
| Llama 3.2 Vision | 128K | Image understanding |
| Llama 3.2 1B | 128K | Edge/mobile deployment |

## Beginner Techniques

### Basic Chat Completion
```python
from llama_api import LlamaAPI

client = LlamaAPI()

response = client.chat.completions.create(
    model="llama-3.3-70b",
    messages=[{"role": "user", "content": "Hello!"}]
)
```

### Vision Models
```python
response = client.chat.completions.create(
    model="llama-3.2-11b-vision",
    messages=[{
        "role": "user",
        "content": [
            {"type": "text", "text": "Describe this image"},
            {"type": "image_url", "image_url": {"url": "..."}}
        ]
    }]
)
```

## Intermediate Techniques

### RAG Implementation
```python
# 1. Chunk documents
chunks = split_documents(documents, chunk_size=500)

# 2. Embed chunks
embeddings = embed_model.encode(chunks)

# 3. Store in vector DB
vector_db.add(chunks, embeddings)

# 4. Query
query_embedding = embed_model.encode(query)
relevant_chunks = vector_db.search(query_embedding, k=5)

# 5. Generate with context
response = client.chat.completions.create(
    model="llama-3.3-70b",
    messages=[
        {"role": "system", "content": f"Context: {relevant_chunks}"},
        {"role": "user", "content": query}
    ]
)
```

### Tool Calling
```python
tools = [{
    "type": "function",
    "function": {
        "name": "search_database",
        "description": "Search the product database",
        "parameters": {
            "type": "object",
            "properties": {"query": {"type": "string"}},
            "required": ["query"]
        }
    }
}]

response = client.chat.completions.create(
    model="llama-3.3-70b",
    tools=tools,
    messages=[...]
)
```

### JSON Mode
```python
response = client.chat.completions.create(
    model="llama-3.3-70b",
    response_format={"type": "json_object"},
    messages=[{"role": "user", "content": "Extract entities as JSON: ..."}]
)
```

## Advanced Techniques

### LoRA Fine-Tuning (Single GPU)
```python
from peft import LoraConfig, get_peft_model

config = LoraConfig(
    r=16,
    lora_alpha=32,
    target_modules=["q_proj", "v_proj"],
    lora_dropout=0.05
)

model = get_peft_model(base_model, config)
# Train with ~0.1% parameters
```

### FSDP Multi-GPU Fine-Tuning
```python
from torch.distributed.fsdp import FullyShardedDataParallel

# FULL_SHARD: Maximum memory savings
# SHARD_GRAD_OP: Balanced approach
# HYBRID_SHARD: Multi-node efficient

model = FullyShardedDataParallel(
    model,
    sharding_strategy="FULL_SHARD",
    mixed_precision=BF16_POLICY
)
```

### RAFT (Retrieval + Fine-Tuning)
```
Problem: Fine-tuning causes hallucinations
Solution: Train on (question, documents, oracle_answer) tuples
Result: Domain expert without hallucination
```

### Llama Guard (Safety)
```python
from llama_guard import LlamaGuard

guard = LlamaGuard()

# Input validation
is_safe = guard.check_input(user_prompt)

# Output filtering
is_safe = guard.check_output(model_response)
```

## End-to-End Applications

### NotebookLlama: PDF to Podcast
```
PDF → Preprocess (1B) → Transcript (70B) → Dramatize (8B) → TTS → Audio
```

### WhatsApp Bot with Llama 4
- Text interaction
- Image reasoning (Vision)
- Audio-to-audio (STT + Llama + TTS)

### Research Paper Analyzer (1M context)
- Ingest entire paper with references
- Q&A without RAG (context fits!)
- Long-form analysis

## Framework Integrations

### LangChain
```python
from langchain_community.llms import LlamaCpp

llm = LlamaCpp(model_path="llama-3.3-70b.gguf")
chain = prompt | llm | parser
```

### LlamaIndex
```python
from llama_index.llms.llama_api import LlamaAPI

llm = LlamaAPI(model="llama-3.3-70b")
index = VectorStoreIndex.from_documents(documents)
query_engine = index.as_query_engine(llm=llm)
```

### vLLM (High Throughput)
```python
from vllm import LLM

llm = LLM(model="meta-llama/Llama-3.3-70B")
outputs = llm.generate(prompts, sampling_params)
```

## When to Use Llama Cookbook

- Building with Llama models
- Fine-tuning for domain expertise
- Implementing RAG systems
- Creating multi-agent workflows
- Safety and responsible AI
- Production deployment patterns

## Reference Files

- Llama API: `getting-started/build_with_llama_api.ipynb`
- Fine-tuning: `getting-started/finetuning/`
- Agents: `end-to-end-use-cases/agents/`
- RAG: `end-to-end-use-cases/RAG/`
- Safety: `getting-started/responsible_ai/`
