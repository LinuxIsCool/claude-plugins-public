---
name: langchain
description: Framework for building LLM applications with chains, agents, tools, and composable components
allowed-tools: Read, Glob, Grep, Bash, WebFetch
---

# LangChain Mastery

LangChain is a framework for building agents and LLM-powered applications through composable components. It provides abstractions for models, prompts, chains, agents, tools, memory, and retrieval - enabling rapid prototyping while maintaining production-ready patterns.

The framework consists of three main layers:
- **langchain-core**: Base abstractions and LCEL (LangChain Expression Language)
- **langchain**: High-level implementations and utilities
- **partners**: Third-party integrations (OpenAI, Anthropic, etc.)

## Territory Map

```
langchain/
├── langchain_core/
│   ├── runnables/          # LCEL: Runnable, RunnableSequence, RunnableParallel
│   ├── prompts/            # PromptTemplate, ChatPromptTemplate
│   ├── messages/           # HumanMessage, AIMessage, SystemMessage, ToolMessage
│   ├── tools/              # BaseTool, @tool decorator, ToolException
│   ├── language_models/    # BaseChatModel, LLM abstractions
│   ├── output_parsers/     # Parse LLM outputs into structured formats
│   ├── retrievers/         # Document retrieval interfaces
│   └── vectorstores/       # Vector database abstractions
├── langchain/
│   ├── agents/             # create_agent(), AgentState, middleware
│   ├── chat_models/        # init_chat_model()
│   └── embeddings/         # init_embeddings()
└── partners/
    ├── anthropic/          # Claude integration
    ├── openai/             # GPT integration
    └── ...                 # Other providers
```

## Core Capabilities

### 1. Runnables and LCEL
The Runnable protocol is the foundation of LangChain, providing a standard interface for all components. Every Runnable supports:
- `.invoke()` - Synchronous execution
- `.ainvoke()` - Async execution
- `.batch()` - Parallel batch processing
- `.stream()` - Streaming outputs
- `.pipe()` or `|` operator - Chain composition

### 2. Model Interoperability
Swap models easily through unified interfaces:
- ChatModels: OpenAI GPT, Anthropic Claude, Ollama, etc.
- LLMs: Text completion models
- Embeddings: Text-to-vector conversion

### 3. Prompt Engineering
Template systems for consistent, reusable prompts:
- String templates with variables
- Chat message templates (system, human, AI)
- Few-shot prompting
- Dynamic prompt construction

### 4. Agents and Tools
Build autonomous agents that can use tools to accomplish tasks:
- Tool calling with function schemas
- ReAct pattern (Reasoning + Acting)
- Middleware for tool wrapping and validation
- Structured outputs

### 5. Memory and State
Maintain conversation context and application state:
- Message history
- Conversation buffer memory
- Checkpointing (via LangGraph)
- Store integration for persistent memory

## Beginner Techniques

### Basic Chain with Prompt Template

```python
from langchain_core.prompts import ChatPromptTemplate
from langchain.chat_models import init_chat_model

# Create a prompt template
prompt = ChatPromptTemplate.from_messages([
    ("system", "You are a helpful assistant that translates {input_language} to {output_language}."),
    ("human", "{text}")
])

# Initialize model
model = init_chat_model("gpt-4o", model_provider="openai")

# Chain with pipe operator (LCEL)
chain = prompt | model

# Invoke the chain
result = chain.invoke({
    "input_language": "English",
    "output_language": "French",
    "text": "Hello, how are you?"
})
print(result.content)
```

### Simple Tool Definition

```python
from langchain_core.tools import tool

@tool
def calculate_sum(a: int, b: int) -> int:
    """Add two numbers together.

    Args:
        a: First number
        b: Second number
    """
    return a + b

# Tool now has automatic schema generation
print(calculate_sum.name)        # "calculate_sum"
print(calculate_sum.description) # From docstring
print(calculate_sum.args_schema) # Pydantic model from type hints
```

### Streaming Responses

```python
from langchain_core.prompts import ChatPromptTemplate
from langchain.chat_models import init_chat_model

prompt = ChatPromptTemplate.from_messages([
    ("system", "You are a helpful assistant."),
    ("human", "{question}")
])

model = init_chat_model("claude-3-5-sonnet-20241022", model_provider="anthropic")
chain = prompt | model

# Stream tokens as they're generated
for chunk in chain.stream({"question": "Explain quantum computing"}):
    print(chunk.content, end="", flush=True)
```

## Intermediate Techniques

### Agents with Tools

```python
from langchain_core.messages import HumanMessage
from langchain_core.tools import tool
from langchain.agents import create_agent
from langchain.chat_models import init_chat_model

# Define tools
@tool
def get_weather(location: str) -> str:
    """Get the current weather for a location."""
    return f"The weather in {location} is sunny and 72°F"

@tool
def calculate(expression: str) -> float:
    """Evaluate a mathematical expression safely."""
    # Use safe eval or math parser in production
    return eval(expression)

# Create agent
model = init_chat_model("gpt-4o", model_provider="openai")
agent = create_agent(model, tools=[get_weather, calculate])

# Run agent
result = agent.invoke({
    "messages": [HumanMessage("What's the weather in Paris and what's 25 * 4?")]
})
print(result["messages"][-1].content)
```

### Parallel Execution with RunnableParallel

```python
from langchain_core.runnables import RunnableParallel
from langchain_core.prompts import ChatPromptTemplate
from langchain.chat_models import init_chat_model

model = init_chat_model("gpt-4o", model_provider="openai")

# Run multiple prompts in parallel
parallel_chain = RunnableParallel(
    summary=ChatPromptTemplate.from_template("Summarize: {text}") | model,
    sentiment=ChatPromptTemplate.from_template("What's the sentiment of: {text}") | model,
    keywords=ChatPromptTemplate.from_template("Extract keywords from: {text}") | model
)

results = parallel_chain.invoke({"text": "LangChain makes building AI apps easy!"})
print(results["summary"].content)
print(results["sentiment"].content)
print(results["keywords"].content)
```

### Conditional Branching with RunnableBranch

```python
from langchain_core.runnables import RunnableBranch
from langchain_core.prompts import ChatPromptTemplate
from langchain.chat_models import init_chat_model

model = init_chat_model("gpt-4o", model_provider="openai")

# Route based on input type
branch = RunnableBranch(
    (
        lambda x: "code" in x["type"],
        ChatPromptTemplate.from_template("Explain this code: {input}") | model
    ),
    (
        lambda x: "math" in x["type"],
        ChatPromptTemplate.from_template("Solve this problem: {input}") | model
    ),
    # Default
    ChatPromptTemplate.from_template("Help with: {input}") | model
)

result = branch.invoke({"type": "code", "input": "def hello(): pass"})
```

### Output Parsing

```python
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import JsonOutputParser
from langchain.chat_models import init_chat_model
from pydantic import BaseModel, Field

# Define structured output schema
class Person(BaseModel):
    name: str = Field(description="Person's name")
    age: int = Field(description="Person's age")
    occupation: str = Field(description="Person's job")

# Setup parser and prompt
parser = JsonOutputParser(pydantic_object=Person)
prompt = ChatPromptTemplate.from_template(
    "Extract person info from: {text}\n{format_instructions}"
)

model = init_chat_model("gpt-4o", model_provider="openai")
chain = prompt | model | parser

result = chain.invoke({
    "text": "John Smith is a 35 year old software engineer",
    "format_instructions": parser.get_format_instructions()
})
print(result)  # {"name": "John Smith", "age": 35, "occupation": "software engineer"}
```

## Advanced Techniques

### Custom Chains with RunnableLambda

```python
from langchain_core.runnables import RunnableLambda
from langchain_core.prompts import ChatPromptTemplate
from langchain.chat_models import init_chat_model

def preprocess(text: str) -> dict:
    """Custom preprocessing logic"""
    return {
        "text": text.strip().lower(),
        "word_count": len(text.split())
    }

def postprocess(output) -> str:
    """Custom postprocessing logic"""
    return f"[{output.content}] (processed)"

model = init_chat_model("gpt-4o", model_provider="openai")
prompt = ChatPromptTemplate.from_template("Analyze: {text}")

# Build chain with custom functions
chain = (
    RunnableLambda(preprocess)
    | prompt
    | model
    | RunnableLambda(postprocess)
)

result = chain.invoke("  HELLO WORLD  ")
```

### LCEL Composition Patterns

```python
from langchain_core.runnables import RunnablePassthrough
from langchain_core.prompts import ChatPromptTemplate
from langchain.chat_models import init_chat_model

model = init_chat_model("gpt-4o", model_provider="openai")

# Use RunnablePassthrough to preserve inputs
prompt = ChatPromptTemplate.from_template("Topic: {topic}\nContext: {context}")

chain = {
    "topic": RunnablePassthrough(),  # Pass through the input
    "context": lambda x: f"Additional context about {x}"
} | prompt | model

result = chain.invoke("quantum computing")
```

### Agent Middleware

```python
from langchain.agents import create_agent
from langchain.agents.middleware.types import AgentMiddleware, ModelRequest, ModelResponse
from langchain.chat_models import init_chat_model
from langchain_core.messages import HumanMessage
from langchain_core.tools import tool

@tool
def search(query: str) -> str:
    """Search for information"""
    return f"Results for: {query}"

# Custom middleware to log all model calls
class LoggingMiddleware(AgentMiddleware):
    def wrap_model_call(self, request: ModelRequest, handler):
        print(f"🔍 Model called with {len(request.messages)} messages")
        response = handler(request)
        print(f"✅ Model responded with {len(response.result)} messages")
        return response

model = init_chat_model("gpt-4o", model_provider="openai")
agent = create_agent(
    model,
    tools=[search],
    middleware=[LoggingMiddleware()]
)

result = agent.invoke({"messages": [HumanMessage("Search for LangChain")]})
```

### Retrieval-Augmented Generation (RAG)

```python
from langchain_core.runnables import RunnablePassthrough
from langchain_core.prompts import ChatPromptTemplate
from langchain.chat_models import init_chat_model

# Simulated retriever (in production, use actual vector store)
def retrieve_docs(query: str) -> str:
    """Retrieve relevant documents"""
    docs = [
        "LangChain is a framework for LLM applications.",
        "It provides composable building blocks.",
        "LCEL enables declarative chain composition."
    ]
    return "\n".join(docs)

prompt = ChatPromptTemplate.from_template(
    "Context: {context}\n\nQuestion: {question}\n\nAnswer:"
)

model = init_chat_model("gpt-4o", model_provider="openai")

# RAG chain
rag_chain = {
    "context": lambda x: retrieve_docs(x["question"]),
    "question": lambda x: x["question"]
} | prompt | model

result = rag_chain.invoke({"question": "What is LangChain?"})
print(result.content)
```

### Structured Outputs with Tool Calling

```python
from langchain.chat_models import init_chat_model
from pydantic import BaseModel, Field
from typing import List

class Recipe(BaseModel):
    """A cooking recipe"""
    name: str = Field(description="Recipe name")
    ingredients: List[str] = Field(description="List of ingredients")
    steps: List[str] = Field(description="Cooking steps")
    prep_time: int = Field(description="Preparation time in minutes")

model = init_chat_model("gpt-4o", model_provider="openai")

# Bind structured output schema to model
structured_model = model.with_structured_output(Recipe)

result = structured_model.invoke("Give me a recipe for chocolate chip cookies")
print(f"Recipe: {result.name}")
print(f"Prep time: {result.prep_time} minutes")
print(f"Ingredients: {', '.join(result.ingredients)}")
```

### Async Agents for High Concurrency

```python
import asyncio
from langchain.agents import create_agent
from langchain.chat_models import init_chat_model
from langchain_core.messages import HumanMessage
from langchain_core.tools import tool

@tool
async def async_search(query: str) -> str:
    """Async search operation"""
    await asyncio.sleep(0.1)  # Simulate I/O
    return f"Results for: {query}"

model = init_chat_model("gpt-4o", model_provider="openai")
agent = create_agent(model, tools=[async_search])

async def run_multiple_queries():
    queries = [
        "LangChain features",
        "LCEL benefits",
        "Agent patterns"
    ]

    # Run multiple agents concurrently
    tasks = [
        agent.ainvoke({"messages": [HumanMessage(q)]})
        for q in queries
    ]

    results = await asyncio.gather(*tasks)
    return results

# Run async agent
# results = asyncio.run(run_multiple_queries())
```

## When to Use LangChain

### Use LangChain When:
- Building LLM applications that need model interoperability
- Creating agents with tool-calling capabilities
- Implementing RAG (Retrieval-Augmented Generation) systems
- Requiring prompt template management and versioning
- Building production applications with monitoring (via LangSmith)
- Prototyping complex multi-step LLM workflows
- Integrating multiple LLM providers with consistent interfaces
- Need streaming, async, and batch processing out of the box

### Consider Alternatives When:
- Building simple, one-off LLM calls (use provider SDKs directly)
- Need ultra-low latency with zero abstraction overhead
- Working with highly custom, non-standard LLM interfaces
- Building complex stateful agents (consider LangGraph instead)
- Require fine-grained control over every API call detail

### LangChain vs LangGraph:
- **LangChain**: High-level chains, quick prototyping, linear workflows
- **LangGraph**: Low-level agent orchestration, cyclic workflows, human-in-the-loop, complex state management

## Best Practices

1. **Type Safety**: Use Pydantic models for structured outputs and tool schemas
2. **Error Handling**: Wrap tool calls in try/except, use ToolException for controlled failures
3. **Streaming**: Use `.stream()` for better UX in production applications
4. **Async**: Prefer async methods (`.ainvoke()`, `.astream()`) for high-concurrency applications
5. **Testing**: Mock LLM calls in unit tests using `FakeChatModel` or similar
6. **Monitoring**: Integrate LangSmith for production observability
7. **Prompt Management**: Version control your prompts, use PromptTemplate consistently
8. **LCEL Composition**: Use `|` operator and dict syntax for readable chains
9. **Resource Cleanup**: Use context managers for connections to vector stores, databases
10. **Model Abstraction**: Use `init_chat_model()` instead of provider-specific imports for flexibility

## Common Patterns

### The RAG Pattern
```
retriever → format_docs → prompt → model → output_parser
```

### The Agent Pattern
```
prompt → model (with tools) → tool_executor → model → ... → final_answer
```

### The Chain Pattern
```
input → preprocessing → prompt → model → postprocessing → output
```

### The Ensemble Pattern
```
input → [model_1, model_2, model_3] (parallel) → aggregator → output
```

## Reference Files

Core implementation files in the LangChain repository:

- `/libs/core/langchain_core/runnables/base.py` - Runnable protocol and base classes
- `/libs/core/langchain_core/prompts/` - Prompt templates and chat prompts
- `/libs/core/langchain_core/tools/` - Tool definitions and decorators
- `/libs/core/langchain_core/messages/` - Message types (Human, AI, System, Tool)
- `/libs/langchain_v1/langchain/agents/factory.py` - Agent creation and middleware
- `/libs/langchain_v1/langchain/chat_models/` - Chat model initialization
- `/libs/partners/anthropic/` - Claude integration
- `/libs/partners/openai/` - OpenAI integration

Documentation:
- https://docs.langchain.com/oss/python/langchain/overview
- https://reference.langchain.com/python
- https://docs.langchain.com/oss/python/langchain/agents

## Troubleshooting

**Issue**: "Module not found" errors
- Ensure correct package installation: `pip install langchain langchain-openai langchain-anthropic`
- LangChain is split into multiple packages; install integration packages separately

**Issue**: Tool calling not working
- Verify model supports tool calling (GPT-4o, Claude 3+, etc.)
- Check tool schema with `tool.args_schema` to ensure proper Pydantic validation
- Use `model.bind_tools()` to explicitly bind tools to model

**Issue**: Streaming returns empty chunks
- Some models/providers have different streaming implementations
- Use `.astream_events()` for granular event streaming
- Check if model provider supports streaming

**Issue**: Async code not executing concurrently
- Ensure you're using `await` with async methods (`.ainvoke()`, `.astream()`)
- Use `asyncio.gather()` for parallel execution
- Check that tools are defined as async functions if they do I/O

**Issue**: Memory not persisting across invocations
- Add checkpointer to agent: `create_agent(model, tools, checkpointer=...)`
- Pass thread config: `{"configurable": {"thread_id": "unique-id"}}`
- For production, use persistent checkpointers (PostgreSQL, Redis, etc.)
