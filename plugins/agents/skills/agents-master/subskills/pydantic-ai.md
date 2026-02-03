---
name: pydantic-ai
description: Type-safe Python agent framework with Pydantic validation, dependency injection, and 19+ model providers
allowed-tools: Read, Glob, Grep, Bash, WebFetch
---

# Pydantic AI Mastery

Pydantic AI is a Python agent framework built by the Pydantic team that brings the FastAPI developer experience to GenAI applications. It provides type-safe agents with validation, dependency injection, and a model-agnostic interface.

## Territory Map

**Core Components**
- `/pydantic_ai_slim/pydantic_ai/agent/` - Agent orchestration with `Agent[AgentDepsT, OutputDataT]`
- `/pydantic_ai_slim/pydantic_ai/models/` - 19+ model provider integrations
- `/pydantic_ai_slim/pydantic_ai/tools.py` - Tool system with RunContext
- `/pydantic_ai_slim/pydantic_ai/output.py` - Output validation modes
- `/pydantic_ai_slim/pydantic_ai/toolsets/` - Tool organization and composition
- `/pydantic_graph/` - Graph-based execution engine

**Key Files**
- `agent/__init__.py` - Main Agent class with generics
- `_run_context.py` - RunContext for dependency injection
- `tools.py` - Tool definitions and decorators
- `output.py` - ToolOutput, NativeOutput, PromptedOutput, TextOutput
- `messages.py` - Vendor-agnostic message format

## Core Capabilities

- **Type-safe agents** with generics `Agent[AgentDepsT, OutputDataT]`
- **Dependency injection** via `RunContext[T]`
- **Pydantic validation** for tool arguments and outputs
- **19+ model providers**: OpenAI, Anthropic, Google, Gemini, Mistral, Cohere, Groq, Bedrock, etc.
- **Structured outputs** with multiple modes (tool, native, prompted)
- **Streaming** with real-time validation
- **Tool composition** through toolsets and MCP
- **Human-in-the-loop** tool approval
- **Graph-based execution** for complex workflows
- **OpenTelemetry integration** with Pydantic Logfire

## Beginner Techniques

### Basic Agent

```python
from pydantic_ai import Agent

# Simple text agent
agent = Agent('openai:gpt-4o')
result = agent.run_sync('What is the capital of France?')
print(result.output)  # "The capital of France is Paris."
```

### Structured Output

```python
from pydantic import BaseModel
from pydantic_ai import Agent

class CityLocation(BaseModel):
    city: str
    country: str

agent = Agent('google-gla:gemini-2.5-flash', output_type=CityLocation)
result = agent.run_sync('Where were the olympics held in 2012?')
print(result.output)  # city='London' country='United Kingdom'
```

### Simple Tool

```python
from pydantic_ai import Agent

agent = Agent('openai:gpt-4o')

@agent.tool_plain
def get_weather(city: str) -> str:
    """Get the weather for a city."""
    return f"The weather in {city} is sunny"

result = agent.run_sync('What is the weather in Paris?')
print(result.output)
```

## Intermediate Techniques

### Dependency Injection with RunContext

```python
from dataclasses import dataclass
from pydantic_ai import Agent, RunContext
import httpx

@dataclass
class MyDeps:
    api_key: str
    http_client: httpx.AsyncClient

agent = Agent('openai:gpt-4o', deps_type=MyDeps)

@agent.tool
async def fetch_data(ctx: RunContext[MyDeps], query: str) -> str:
    """Fetch data from external API."""
    response = await ctx.deps.http_client.get(
        'https://api.example.com',
        headers={'Authorization': f'Bearer {ctx.deps.api_key}'}
    )
    return response.text

async def main():
    async with httpx.AsyncClient() as client:
        deps = MyDeps('secret-key', client)
        result = await agent.run('Get data for X', deps=deps)
        print(result.output)
```

### Dynamic Instructions

```python
from pydantic_ai import Agent, RunContext

agent = Agent('openai:gpt-4o', deps_type=str)

@agent.instructions
async def get_instructions(ctx: RunContext[str]) -> str:
    """Generate dynamic instructions based on dependencies."""
    return f"You are a helpful assistant for {ctx.deps}"

result = agent.run_sync('Help me', deps='CompanyX')
```

### Multiple Output Types

```python
from pydantic import BaseModel
from pydantic_ai import Agent

class SuccessResult(BaseModel):
    data: dict[str, str]

class ErrorResult(BaseModel):
    error: str

agent = Agent(
    'openai:gpt-4o',
    output_type=[SuccessResult, ErrorResult],
    instructions='Extract data or return an error if unable'
)

result = agent.run_sync('Parse this: name=John, age=30')
# Result is either SuccessResult or ErrorResult
```

## Advanced Techniques

### Streaming Structured Output

```python
from pydantic import BaseModel
from pydantic_ai import Agent
from typing import Annotated

class Whale(BaseModel):
    name: str
    length: float  # meters
    weight: float | None = None  # kg

agent = Agent('openai:gpt-4o', output_type=list[Whale])

async def stream_whales():
    async with agent.run_stream('Generate 5 whale species') as result:
        async for whales in result.stream_output(debounce_by=0.01):
            for whale in whales:
                print(f"{whale.name}: {whale.length}m")
```

### Custom Output Functions

```python
from pydantic_ai import Agent, ModelRetry, RunContext

def validate_sql_query(query: str) -> list[dict]:
    """Run SQL query with validation."""
    if not query.startswith('SELECT'):
        raise ModelRetry('Only SELECT queries supported')

    # Execute query and return results
    return execute_query(query)

agent = Agent[None, list[dict]](
    'openai:gpt-4o',
    output_type=[validate_sql_query],
    instructions='Generate SQL queries to answer questions'
)

result = agent.run_sync('Show me all users')
```

### Tool Preparation and Filtering

```python
from pydantic_ai import Agent, RunContext
from pydantic_ai.tools import ToolDefinition
from dataclasses import replace

async def prepare_tools(
    ctx: RunContext[None],
    tool_defs: list[ToolDefinition]
) -> list[ToolDefinition]:
    """Conditionally enable tools based on context."""
    if ctx.model.system == 'openai':
        # Enable strict mode for OpenAI
        return [replace(td, strict=True) for td in tool_defs]
    return tool_defs

agent = Agent(
    'openai:gpt-4o',
    prepare_tools=prepare_tools
)
```

### Toolsets and Composition

```python
from pydantic_ai import Agent, RunContext
from pydantic_ai.toolsets import FunctionToolset, CombinedToolset

# Create toolsets
math_toolset = FunctionToolset()

@math_toolset.add_tool
def add(a: int, b: int) -> int:
    """Add two numbers."""
    return a + b

@math_toolset.add_tool
def multiply(a: int, b: int) -> int:
    """Multiply two numbers."""
    return a * b

# Dynamic toolset from function
@agent.toolset
async def get_tools(ctx: RunContext[str]) -> FunctionToolset:
    """Return tools based on user context."""
    toolset = FunctionToolset()

    @toolset.add_tool
    def custom_tool(x: str) -> str:
        return f"{ctx.deps}: {x}"

    return toolset

agent = Agent('openai:gpt-4o', toolsets=[math_toolset])
```

### Human-in-the-Loop Tool Approval

```python
from pydantic_ai import Agent, RunContext
from pydantic_ai.tools import DeferredToolRequests, DeferredToolResults

agent = Agent('openai:gpt-4o', output_type=[str, DeferredToolRequests])

@agent.tool(requires_approval=True)
async def delete_user(ctx: RunContext, user_id: int) -> str:
    """Delete a user from the database."""
    # This tool requires approval before execution
    return f"Deleted user {user_id}"

# First run - get approval requests
result = await agent.run('Delete user 123')
if isinstance(result.output, DeferredToolRequests):
    # Present to user for approval
    for call in result.output.approvals:
        print(f"Approve: {call.tool_name}({call.arguments})?")

    # After approval, create results
    from pydantic_ai.tools import ToolApproved
    deferred_results = DeferredToolResults({
        call.tool_call_id: ToolApproved()
        for call in result.output.approvals
    })

    # Continue run with approval
    final = await agent.run(
        user_prompt=None,
        message_history=result.all_messages(),
        deferred_tool_results=deferred_results
    )
```

### Output Validators

```python
from pydantic_ai import Agent, ModelRetry, RunContext

agent = Agent('openai:gpt-4o', output_type=str)

@agent.output_validator
async def validate_output(ctx: RunContext, data: str) -> str:
    """Validate and transform output."""
    if 'forbidden_word' in data.lower():
        raise ModelRetry('Output contains forbidden content')

    # Transform output
    return data.upper()

result = agent.run_sync('Generate a message')
```

### Multi-Model Providers

```python
from pydantic_ai import Agent

# Different model providers
openai_agent = Agent('openai:gpt-4o')
anthropic_agent = Agent('anthropic:claude-sonnet-4-5')
google_agent = Agent('google-gla:gemini-2.5-flash')
mistral_agent = Agent('mistral:mistral-large')
bedrock_agent = Agent('bedrock:anthropic.claude-sonnet-4-20250514-v1:0')

# Model-agnostic code
def create_agent(model: str):
    return Agent(model, output_type=dict)
```

### Graph-Based Execution

```python
from pydantic_ai import Agent

agent = Agent('openai:gpt-4o')

# Iterate through execution graph
async with agent.iter('What is 2+2?') as agent_run:
    async for node in agent_run:
        print(f"Node: {type(node).__name__}")
        # UserPromptNode -> ModelRequestNode -> CallToolsNode

    # Access final result
    print(agent_run.result.output)
```

### Custom Model Settings

```python
from pydantic_ai import Agent
from pydantic_ai.settings import ModelSettings

agent = Agent(
    'openai:gpt-4o',
    model_settings=ModelSettings(
        temperature=0.7,
        max_tokens=1000,
        top_p=0.9
    )
)

# Override at runtime
result = agent.run_sync(
    'Generate text',
    model_settings=ModelSettings(temperature=0.1)
)
```

## When to Use Pydantic AI

**Ideal For:**
- Production GenAI applications requiring type safety
- Multi-agent systems with complex tool orchestration
- Applications needing model-agnostic interfaces
- Projects requiring structured output validation
- Systems with dynamic dependency injection needs
- Applications needing observability and monitoring
- Workflows requiring human-in-the-loop approvals

**Not Ideal For:**
- Simple single-shot LLM calls (use SDK directly)
- Non-Python applications
- Projects not using async/await patterns
- Applications without structured output needs

**Choose Pydantic AI over alternatives when:**
- You need full type safety and IDE support
- Pydantic validation is already in your stack
- You want model provider flexibility
- You need production-grade reliability
- Observability with Logfire is valuable

## Reference Files

**Core Documentation:**
- `/docs/agents.md` - Agent creation and configuration
- `/docs/dependencies.md` - Dependency injection patterns
- `/docs/tools.md` - Tool definition and usage
- `/docs/output.md` - Output types and validation
- `/docs/message-history.md` - Conversation management

**API Reference:**
- `/pydantic_ai_slim/pydantic_ai/agent/__init__.py` - Agent class
- `/pydantic_ai_slim/pydantic_ai/_run_context.py` - RunContext
- `/pydantic_ai_slim/pydantic_ai/tools.py` - Tool types
- `/pydantic_ai_slim/pydantic_ai/output.py` - Output types

**Examples:**
- `/examples/` - Production-ready example applications
- `/docs/examples/` - Documentation examples

**Model Providers:**
- `/pydantic_ai_slim/pydantic_ai/models/openai.py`
- `/pydantic_ai_slim/pydantic_ai/models/anthropic.py`
- `/pydantic_ai_slim/pydantic_ai/models/google.py`
- `/pydantic_ai_slim/pydantic_ai/models/gemini.py`
- `/pydantic_ai_slim/pydantic_ai/models/mistral.py`
- `/pydantic_ai_slim/pydantic_ai/models/cohere.py`
- `/pydantic_ai_slim/pydantic_ai/models/groq.py`
- `/pydantic_ai_slim/pydantic_ai/models/bedrock.py`

**Key Type Signatures:**
```python
# Agent generic signature
class Agent[AgentDepsT, OutputDataT]:
    def __init__(
        self,
        model: Model | KnownModelName | str | None = None,
        *,
        output_type: OutputSpec[OutputDataT] = str,
        deps_type: type[AgentDepsT] = NoneType,
        instructions: Instructions[AgentDepsT] = None,
        tools: Sequence[Tool | ToolFuncEither] = (),
        toolsets: Sequence[AbstractToolset | ToolsetFunc] | None = None,
    ) -> None: ...

# RunContext signature
@dataclass
class RunContext[RunContextAgentDepsT]:
    deps: RunContextAgentDepsT
    model: Model
    usage: RunUsage
    messages: list[ModelMessage]
    tool_name: str | None
    retry: int

# Tool function signatures
ToolFuncContext = Callable[Concatenate[RunContext[AgentDepsT], ToolParams], Any]
ToolFuncPlain = Callable[ToolParams, Any]
```
