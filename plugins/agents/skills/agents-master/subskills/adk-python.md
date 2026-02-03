---
name: adk-python
description: Master Google's Agent Development Kit (ADK) for building production-ready AI agents with code-first Python, multi-agent orchestration, and comprehensive tooling.
allowed-tools: Read, Glob, Grep, Bash, WebFetch
---

# Google ADK Python Mastery

Google's Agent Development Kit (ADK) is an open-source, code-first Python framework for building, evaluating, and deploying sophisticated AI agents with enterprise-grade capabilities. While optimized for Gemini, it's model-agnostic and deployment-agnostic.

## Territory Map

```
resources/agents/adk-python/
├── src/google/adk/
│   ├── agents/              # Agent implementations (LlmAgent, LoopAgent, ParallelAgent, SequentialAgent)
│   ├── runners.py           # Core orchestration engine (Runner class)
│   ├── tools/               # 90+ tool files (Google APIs, OpenAPI, MCP, BigQuery, etc.)
│   ├── models/              # LLM integrations (Gemini, Anthropic, LiteLLM)
│   ├── sessions/            # Session management (in-memory, Vertex AI, Spanner)
│   ├── memory/              # Long-term memory services
│   ├── evaluation/          # Evaluation framework (47 files)
│   ├── apps/                # App pattern with plugins and event compaction
│   ├── flows/               # Execution flow orchestration
│   ├── a2a/                 # Agent-to-Agent protocol
│   ├── cli/                 # CLI tools and web UI
│   └── telemetry/           # Observability and tracing
├── contributing/samples/    # 140+ agent examples
└── tests/                   # 2600+ unit tests across 236+ files
```

## Core Capabilities

- **Code-First Development**: Define agents, tools, and orchestration directly in Python
- **Multi-Agent Systems**: Coordinate LlmAgent, LoopAgent, ParallelAgent, SequentialAgent in hierarchies
- **Rich Tool Ecosystem**: 90+ built-in tools including Google Search, BigQuery, Bigtable, OpenAPI, MCP
- **Flexible Execution**: Runner manages reason-act loops with streaming, async, and live (bidirectional) modes
- **Production Ready**: Session persistence, memory services, artifact management, event compaction
- **Evaluation Framework**: Built-in testing with eval sets and rubric-based evaluators
- **Deployment Agnostic**: Deploy to Cloud Run, Vertex AI Agent Engine, or any container platform
- **Model Agnostic**: Works with Gemini (optimized), Anthropic Claude, or any LiteLLM-supported model

## Beginner Techniques

### Creating a Basic Agent with Tools

```python
from google.adk import Agent
from google.adk.tools import google_search

# Simple agent with built-in tool
root_agent = Agent(
    name="search_assistant",
    model="gemini-2.5-flash",
    instruction="You are a helpful assistant. Answer questions using Google Search.",
    description="An assistant that can search the web.",
    tools=[google_search]
)
```

### Defining Custom Python Function Tools

```python
import random
from google.adk import Agent
from google.adk.tools.tool_context import ToolContext

def roll_die(sides: int, tool_context: ToolContext) -> int:
    """Roll a die and return the result.

    Args:
        sides: The integer number of sides the die has.

    Returns:
        An integer of the result of rolling the die.
    """
    result = random.randint(1, sides)
    if 'rolls' not in tool_context.state:
        tool_context.state['rolls'] = []
    tool_context.state['rolls'] = tool_context.state['rolls'] + [result]
    return result

async def check_prime(nums: list[int]) -> str:
    """Check if given numbers are prime."""
    primes = set()
    for number in nums:
        if number <= 1:
            continue
        is_prime = True
        for i in range(2, int(number**0.5) + 1):
            if number % i == 0:
                is_prime = False
                break
        if is_prime:
            primes.add(number)
    return (
        'No prime numbers found.'
        if not primes
        else f"{', '.join(str(num) for num in primes)} are prime numbers."
    )

root_agent = Agent(
    model='gemini-2.0-flash',
    name='dice_agent',
    instruction="You roll dice and check prime numbers using the provided tools.",
    tools=[roll_die, check_prime]
)
```

### Running Agents Locally

```python
from google.adk import Runner

# Create a runner
runner = Runner(agent=root_agent)

# Synchronous execution (for testing/debugging)
response = runner.run("Roll a 6-sided die and check if it's prime")
print(response.text)

# Async execution (for production)
import asyncio

async def main():
    async for event in runner.run_async("Roll a 6-sided die"):
        if event.text:
            print(event.text)

asyncio.run(main())
```

### CLI Development Workflow

```bash
# Launch interactive web UI (recommended for development)
adk web /path/to/agent_dir

# Run agent via CLI
adk run /path/to/agent_dir

# Start FastAPI server for production
adk api_server /path/to/agent_dir
```

## Intermediate Techniques

### Multi-Agent Orchestration with SequentialAgent

```python
from google.adk.agents.llm_agent import LlmAgent
from google.adk.agents.sequential_agent import SequentialAgent

# Define specialized sub-agents
roll_agent = LlmAgent(
    name="roll_agent",
    description="Handles rolling dice of different sizes.",
    model="gemini-2.0-flash",
    instruction="You roll dice. Call roll_die with number of sides as integer.",
    tools=[roll_die]
)

prime_agent = LlmAgent(
    name="prime_agent",
    description="Handles checking if numbers are prime.",
    model="gemini-2.0-flash",
    instruction="You check primes. Call check_prime with list of integers.",
    tools=[check_prime]
)

# Coordinate agents sequentially
root_agent = SequentialAgent(
    name="sequential_coordinator",
    sub_agents=[roll_agent, prime_agent]
    # Agents execute in order: roll_agent -> prime_agent
)
```

### Using the App Pattern with Plugins

```python
from google.adk import Agent
from google.adk.apps import App
from google.adk.plugins import ContextFilterPlugin

root_agent = Agent(
    name="my_agent",
    model="gemini-2.5-flash",
    instruction="You are a helpful assistant.",
    tools=[...]
)

# App provides plugins, event compaction, custom configuration
app = App(
    name="my_app",
    root_agent=root_agent,
    plugins=[
        # Keep only last 3 invocations in context
        ContextFilterPlugin(num_invocations_to_keep=3)
    ]
)
```

### Custom Tool with LLM Request Processing

```python
from google.adk.tools.function_tool import FunctionTool
from google.adk.tools.tool_context import ToolContext
from google.adk.models.llm_request import LlmRequest
from google.genai import types
from typing_extensions import override

async def query_large_data(query: str, tool_context: ToolContext) -> dict:
    """Query large dataset and save as artifact."""
    report_content = generate_large_report(query)
    artifact_name = f"report_{query}.txt"

    await tool_context.save_artifact(
        artifact_name,
        types.Part.from_text(text=report_content),
        custom_metadata={'summary': f'Report for {query}'}
    )
    return {
        'message': f'Report saved as {artifact_name}',
        'artifact_name': artifact_name
    }

class QueryLargeDataTool(FunctionTool):
    """Tool that saves results as artifacts and injects them into context."""

    def __init__(self):
        super().__init__(query_large_data)

    @override
    async def process_llm_request(
        self,
        *,
        tool_context: ToolContext,
        llm_request: LlmRequest,
    ) -> None:
        await super().process_llm_request(
            tool_context=tool_context, llm_request=llm_request
        )
        # Inject artifact content immediately after generation
        if llm_request.contents and llm_request.contents[-1].parts:
            function_response = llm_request.contents[-1].parts[0].function_response
            if function_response and function_response.name == 'query_large_data':
                artifact_name = function_response.response.get('artifact_name')
                if artifact_name:
                    artifact = await tool_context.load_artifact(artifact_name)
                    if artifact:
                        llm_request.contents.append(
                            types.Content(
                                role='user',
                                parts=[
                                    types.Part.from_text(text=f'Artifact {artifact_name}:'),
                                    artifact
                                ]
                            )
                        )
```

### Session Management and State Persistence

```python
from google.adk import Runner
from google.adk.sessions.in_memory_session_service import InMemorySessionService

# Use in-memory sessions (default)
runner = Runner(agent=root_agent)

# Multi-turn conversation with session persistence
session_id = "user-123-session"
async for event in runner.run_async("Hello", session_id=session_id):
    print(event.text)

# Continue conversation with same session
async for event in runner.run_async("What was my first message?", session_id=session_id):
    print(event.text)
```

### Evaluation with Eval Sets

```python
# Create eval set JSON file: my_eval_set.evalset.json
{
  "evalSetId": "hello_world_eval_001",
  "scenarios": [
    {
      "scenarioId": "roll_and_check",
      "turns": [
        {
          "userUtterance": "Roll an 8-sided die and check if it's prime"
        }
      ]
    }
  ]
}
```

```bash
# Run evaluation
adk eval /path/to/agent /path/to/my_eval_set.evalset.json
```

## Advanced Techniques

### Complex Multi-Agent with ParallelAgent and Coordinator

```python
from google.adk.agents.llm_agent import LlmAgent
from google.adk.agents.parallel_agent import ParallelAgent

# Create specialized agents
weather_agent = LlmAgent(
    name="weather_agent",
    model="gemini-2.0-flash",
    description="Fetches weather information",
    tools=[get_weather]
)

news_agent = LlmAgent(
    name="news_agent",
    model="gemini-2.0-flash",
    description="Fetches latest news",
    tools=[get_news]
)

# Coordinator with sub-agents
coordinator = LlmAgent(
    name="coordinator",
    model="gemini-2.5-flash",
    description="I coordinate weather and news queries",
    instruction="""
        You coordinate requests by delegating to specialized agents.
        For weather queries, transfer to weather_agent.
        For news queries, transfer to news_agent.
    """,
    sub_agents=[weather_agent, news_agent]
)
```

### Custom Event Compaction for Context Window Management

```python
from google.adk.apps import App, EventsCompactionConfig
from google.adk.apps.base_events_summarizer import BaseEventsSummarizer
from google.adk.events.event import Event

class CustomEventsSummarizer(BaseEventsSummarizer):
    """Custom summarizer for event compaction."""

    async def summarize(
        self,
        events: list[Event],
        invocation_ids: list[str]
    ) -> str:
        # Implement custom summarization logic
        # Could use LLM to create intelligent summaries
        return f"Summary of {len(events)} events across {len(invocation_ids)} invocations"

app = App(
    name="my_app",
    root_agent=root_agent,
    events_compaction_config=EventsCompactionConfig(
        summarizer=CustomEventsSummarizer(),
        compaction_interval=5,  # Compact every 5 invocations
        overlap_size=2          # Keep 2 invocations overlap
    )
)
```

### Agent Callbacks for Custom Logic Injection

```python
from google.adk.agents.callback_context import CallbackContext
from google.adk.models.llm_request import LlmRequest
from google.adk.models.llm_response import LlmResponse

async def before_model_callback(
    context: CallbackContext,
    request: LlmRequest
) -> LlmResponse | None:
    """Execute before each LLM call."""
    print(f"About to call LLM with {len(request.contents)} messages")
    # Return None to proceed normally
    # Return LlmResponse to skip LLM call
    return None

async def after_model_callback(
    context: CallbackContext,
    response: LlmResponse
) -> LlmResponse | None:
    """Execute after each LLM call."""
    print(f"LLM responded with: {response.text}")
    # Modify or replace response if needed
    return response

agent = Agent(
    name="agent_with_callbacks",
    model="gemini-2.5-flash",
    instruction="You are helpful",
    before_model=before_model_callback,
    after_model=after_model_callback
)
```

### Integration with OpenAPI Specifications

```python
from google.adk.tools.openapi_tool.openapi_spec_parser.openapi_toolset import OpenAPIToolset

# Load tools from OpenAPI spec
pet_store_toolset = OpenAPIToolset(
    openapi_spec_url="https://petstore3.swagger.io/api/v3/openapi.json",
    name="pet_store"
)

agent = Agent(
    name="pet_store_agent",
    model="gemini-2.5-flash",
    instruction="You help users interact with the pet store API",
    tools=[pet_store_toolset]
)
```

### Model Context Protocol (MCP) Tool Integration

```python
from google.adk.tools.mcp_tool.mcp_toolset import MCPToolset

# Connect to MCP server
mcp_toolset = MCPToolset(
    name="filesystem_mcp",
    server_config={
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-filesystem", "/allowed/path"]
    }
)

agent = Agent(
    name="mcp_agent",
    model="gemini-2.5-flash",
    instruction="You can access the filesystem via MCP tools",
    tools=[mcp_toolset]
)
```

### Production Runner with Custom Services

```python
from google.adk import Runner
from google.adk.sessions.in_memory_session_service import InMemorySessionService
from google.adk.memory.in_memory_memory_service import InMemoryMemoryService
from google.adk.artifacts.in_memory_artifact_service import InMemoryArtifactService

# Create runner with custom service configuration
runner = Runner(
    agent=root_agent,
    session_service=InMemorySessionService(),
    memory_service=InMemoryMemoryService(),
    artifact_service=InMemoryArtifactService()
)

# For production, use Spanner/Vertex AI services instead:
# from google.adk.sessions.spanner_session_service import SpannerSessionService
# session_service = SpannerSessionService(
#     project_id="my-project",
#     instance_id="my-instance",
#     database_id="my-database"
# )
```

### Live Bidirectional Streaming (Gemini Live API)

```python
from google.adk.agents.run_config import RunConfig

async def run_live_agent():
    runner = Runner(agent=root_agent)

    # Use run_live for bidirectional streaming with audio
    async for event in runner.run_live(
        session_id="live-session-123",
        run_config=RunConfig(
            enable_audio_input=True,
            enable_audio_output=True
        )
    ):
        if event.output_transcription:
            print(f"Agent said: {event.output_transcription.text}")
        if event.audio_artifact:
            # Handle audio output
            pass
```

## When to Use ADK Python

- **Building production AI agents** that require reliability, testing, and deployment flexibility
- **Multi-agent systems** with specialized agents coordinating on complex tasks
- **Enterprise integrations** requiring Google Cloud tools (BigQuery, Bigtable, Vertex AI)
- **Code-first development** when you need full control over agent logic and behavior
- **Evaluation-driven development** with comprehensive test suites and rubric-based metrics
- **Scalable deployments** to Cloud Run, Vertex AI Agent Engine, or Kubernetes
- **Complex orchestration** with reason-act loops, tool confirmation, and human-in-the-loop
- **Model flexibility** when you want to swap between Gemini, Claude, or other LLMs
- **Agent-to-Agent communication** using the A2A protocol for distributed systems

## Reference Files

### Core Framework
- `/resources/agents/adk-python/src/google/adk/__init__.py` - Main exports (Agent, Runner)
- `/resources/agents/adk-python/src/google/adk/agents/llm_agent.py` - LlmAgent implementation
- `/resources/agents/adk-python/src/google/adk/runners.py` - Runner orchestration engine
- `/resources/agents/adk-python/src/google/adk/apps/app.py` - App pattern with plugins

### Agent Types
- `/resources/agents/adk-python/src/google/adk/agents/sequential_agent.py` - Sequential orchestration
- `/resources/agents/adk-python/src/google/adk/agents/parallel_agent.py` - Parallel execution
- `/resources/agents/adk-python/src/google/adk/agents/loop_agent.py` - Loop-based agents

### Tools
- `/resources/agents/adk-python/src/google/adk/tools/__init__.py` - Tool exports
- `/resources/agents/adk-python/src/google/adk/tools/function_tool.py` - Python function tools
- `/resources/agents/adk-python/src/google/adk/tools/openapi_tool/` - OpenAPI integration
- `/resources/agents/adk-python/src/google/adk/tools/mcp_tool/` - MCP integration
- `/resources/agents/adk-python/src/google/adk/tools/bigquery/` - BigQuery tools
- `/resources/agents/adk-python/src/google/adk/tools/google_search_tool.py` - Google Search

### Examples (140+ samples)
- `/resources/agents/adk-python/contributing/samples/hello_world/` - Basic agent
- `/resources/agents/adk-python/contributing/samples/simple_sequential_agent/` - Multi-agent
- `/resources/agents/adk-python/contributing/samples/context_offloading_with_artifact/` - Advanced patterns

### Documentation
- `/resources/agents/adk-python/README.md` - Project overview
- `/resources/agents/adk-python/AGENTS.md` - AI coding assistant context
- `/resources/agents/adk-python/CONTRIBUTING.md` - Development guidelines
- `/resources/agents/adk-python/llms.txt` - Summarized LLM context
- `/resources/agents/adk-python/llms-full.txt` - Comprehensive LLM context
- https://google.github.io/adk-docs - Official documentation
- https://github.com/google/adk-samples - Sample repository
