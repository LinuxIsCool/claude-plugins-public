---
name: openai-agents-python
description: Official OpenAI Python SDK for building multi-agent workflows with tools, handoffs, and guardrails. Provider-agnostic, supporting OpenAI and 100+ LLMs. Use when building agentic systems with specialized agents, tool use, context management, or multi-agent orchestration.
allowed-tools: Read, Glob, Grep, Bash, WebFetch
---

# OpenAI Agents Python SDK Mastery

A lightweight yet powerful framework for building multi-agent workflows. Provider-agnostic, supporting OpenAI Responses API, Chat Completions API, and 100+ other LLMs via LiteLLM.

## Territory Map

```
resources/agents/openai-agents-python/
├── src/agents/              # Core implementation
├── examples/
│   ├── basic/              # Hello world, functions
│   ├── customer_service/   # Multi-agent handoffs
│   ├── agent_patterns/     # Common orchestration patterns
│   └── tools/              # Web search, file search, computer use
├── docs/
│   ├── agents.md           # Agent configuration
│   ├── running_agents.md   # Runner API
│   ├── handoffs.md         # Agent delegation
│   ├── tools.md            # Function tools
│   ├── guardrails.md       # Input/output validation
│   ├── streaming.md        # Real-time events
│   └── multi_agent.md      # Orchestration patterns
└── tests/                  # Comprehensive test suite
```

## Core Capabilities

### 5 Core Concepts
1. **Agents**: LLMs configured with instructions, tools, guardrails, and handoffs
2. **Handoffs**: Specialized tool calls for transferring control between agents
3. **Guardrails**: Configurable safety checks for input and output validation
4. **Sessions**: Automatic conversation history management across agent runs
5. **Tracing**: Built-in tracking of agent runs for debugging and optimization

### Agent Loop Lifecycle
1. Call LLM with model settings and message history
2. LLM returns response (may include tool calls)
3. If response has final output → return and end loop
4. If response has handoff → switch agent and continue loop
5. If response has tool calls → execute tools and continue loop
6. Repeat until `max_turns` exceeded

## Beginner Techniques

### Hello World
```python
from agents import Agent, Runner

agent = Agent(
    name="Assistant",
    instructions="You are a helpful assistant"
)

result = Runner.run_sync(agent, "Write a haiku about recursion in programming.")
print(result.final_output)
# Code within the code,
# Functions calling themselves,
# Infinite loop's dance.
```

### Function Tools
```python
from agents import Agent, Runner, function_tool

@function_tool
def get_weather(city: str) -> str:
    """Returns weather info for the specified city."""
    return f"The weather in {city} is sunny."

agent = Agent(
    name="Weather Agent",
    instructions="You are a helpful assistant.",
    tools=[get_weather],
)

async def main():
    result = await Runner.run(agent, input="What's the weather in Tokyo?")
    print(result.final_output)
    # The weather in Tokyo is sunny.
```

### Function Tool with Context
```python
from agents import function_tool, RunContextWrapper
from typing import Any

@function_tool
def read_file(ctx: RunContextWrapper[Any], path: str) -> str:
    """Read the contents of a file.

    Args:
        path: The path to the file to read.
    """
    # Context is automatically passed as first argument
    return "<file contents>"
```

### Basic Handoff
```python
from agents import Agent, Runner

spanish_agent = Agent(
    name="Spanish agent",
    instructions="You only speak Spanish.",
)

english_agent = Agent(
    name="English agent",
    instructions="You only speak English",
)

triage_agent = Agent(
    name="Triage agent",
    instructions="Handoff to the appropriate agent based on the language of the request.",
    handoffs=[spanish_agent, english_agent],
)

async def main():
    result = await Runner.run(triage_agent, input="Hola, ¿cómo estás?")
    print(result.final_output)
    # ¡Hola! Estoy bien, gracias por preguntar. ¿Y tú, cómo estás?
```

### Structured Outputs
```python
from pydantic import BaseModel
from agents import Agent, Runner

class CalendarEvent(BaseModel):
    name: str
    date: str
    participants: list[str]

agent = Agent(
    name="Calendar extractor",
    instructions="Extract calendar events from text",
    output_type=CalendarEvent,
)

result = await Runner.run(
    agent,
    "Meeting with John and Sarah on Dec 15th for project review"
)
print(result.final_output.name)  # "Project review"
```

## Intermediate Techniques

### Context and Dependency Injection
```python
from dataclasses import dataclass
from agents import Agent, RunContextWrapper

@dataclass
class UserContext:
    name: str
    uid: str
    is_pro_user: bool

    async def fetch_purchases(self):
        return []

def dynamic_instructions(
    context: RunContextWrapper[UserContext], agent: Agent[UserContext]
) -> str:
    return f"The user's name is {context.context.name}. Help them with their questions."

agent = Agent[UserContext](
    name="Support Agent",
    instructions=dynamic_instructions,
)

context = UserContext(name="Alice", uid="123", is_pro_user=True)
result = await Runner.run(agent, "Hello!", context=context)
```

### Custom Handoffs with Callbacks
```python
from agents import Agent, handoff, RunContextWrapper
from pydantic import BaseModel

class AirlineContext(BaseModel):
    passenger_name: str | None = None
    flight_number: str | None = None

async def on_seat_booking_handoff(ctx: RunContextWrapper[AirlineContext]) -> None:
    # Pre-fetch data when handoff is invoked
    ctx.context.flight_number = f"FLT-{random.randint(100, 999)}"

seat_booking_agent = Agent[AirlineContext](
    name="Seat Booking Agent",
    handoff_description="A helpful agent that can update a seat on a flight.",
    instructions="Ask for confirmation number and desired seat, then update.",
)

triage_agent = Agent[AirlineContext](
    name="Triage Agent",
    instructions="You are a helpful triaging agent.",
    handoffs=[
        handoff(agent=seat_booking_agent, on_handoff=on_seat_booking_handoff),
    ],
)
```

### Handoff Input Filters
```python
from agents import Agent, handoff
from agents.extensions import handoff_filters

faq_agent = Agent(name="FAQ agent")

# Remove all tool calls from history before handoff
handoff_obj = handoff(
    agent=faq_agent,
    input_filter=handoff_filters.remove_all_tools,
)
```

### Handoff with Input Type
```python
from pydantic import BaseModel
from agents import Agent, handoff, RunContextWrapper

class EscalationData(BaseModel):
    reason: str

async def on_handoff(ctx: RunContextWrapper[None], input_data: EscalationData):
    print(f"Escalation reason: {input_data.reason}")

escalation_agent = Agent(name="Escalation agent")

handoff_obj = handoff(
    agent=escalation_agent,
    on_handoff=on_handoff,
    input_type=EscalationData,
)
```

### Agents as Tools (Manager Pattern)
```python
from agents import Agent, Runner

# Specialized sub-agents
booking_agent = Agent(
    name="Booking agent",
    instructions="Handle booking requests",
)

refund_agent = Agent(
    name="Refund agent",
    instructions="Handle refund requests",
)

# Manager agent that uses sub-agents as tools
customer_facing_agent = Agent(
    name="Customer-facing agent",
    instructions="Handle all direct user communication. Call relevant tools when needed.",
    tools=[
        booking_agent.as_tool(
            tool_name="booking_expert",
            tool_description="Handles booking questions and requests.",
        ),
        refund_agent.as_tool(
            tool_name="refund_expert",
            tool_description="Handles refund questions and requests.",
        )
    ],
)
```

### Sessions (Automatic Conversation Memory)
```python
from agents import Agent, Runner, SQLiteSession

agent = Agent(
    name="Assistant",
    instructions="Reply very concisely.",
)

# Create a session instance
session = SQLiteSession("conversation_123")

# First turn
result = await Runner.run(
    agent,
    "What city is the Golden Gate Bridge in?",
    session=session
)
print(result.final_output)  # "San Francisco"

# Second turn - agent automatically remembers previous context
result = await Runner.run(
    agent,
    "What state is it in?",
    session=session
)
print(result.final_output)  # "California"
```

### Hosted Tools
```python
from agents import Agent, FileSearchTool, Runner, WebSearchTool

agent = Agent(
    name="Assistant",
    tools=[
        WebSearchTool(),
        FileSearchTool(
            max_num_results=3,
            vector_store_ids=["VECTOR_STORE_ID"],
        ),
    ],
)

result = await Runner.run(
    agent,
    "Which coffee shop should I go to, taking into account my preferences and the weather in SF?"
)
```

### Model Settings
```python
from agents import Agent, ModelSettings

agent = Agent(
    name="Creative Agent",
    instructions="Write creative content",
    model="gpt-4",
    model_settings=ModelSettings(
        temperature=0.9,
        top_p=0.95,
        max_tokens=1000,
    )
)
```

## Advanced Techniques

### Input Guardrails
```python
from pydantic import BaseModel
from agents import (
    Agent,
    GuardrailFunctionOutput,
    InputGuardrailTripwireTriggered,
    RunContextWrapper,
    Runner,
    TResponseInputItem,
    input_guardrail,
)

class MathHomeworkOutput(BaseModel):
    is_math_homework: bool
    reasoning: str

guardrail_agent = Agent(
    name="Guardrail check",
    instructions="Check if the user is asking you to do their math homework.",
    output_type=MathHomeworkOutput,
)

@input_guardrail
async def math_guardrail(
    ctx: RunContextWrapper[None],
    agent: Agent,
    input: str | list[TResponseInputItem]
) -> GuardrailFunctionOutput:
    result = await Runner.run(guardrail_agent, input, context=ctx.context)

    return GuardrailFunctionOutput(
        output_info=result.final_output,
        tripwire_triggered=result.final_output.is_math_homework,
    )

agent = Agent(
    name="Customer support agent",
    instructions="You are a customer support agent.",
    input_guardrails=[math_guardrail],
)

# Usage with exception handling
try:
    await Runner.run(agent, "Help me solve: 2x + 3 = 11?")
except InputGuardrailTripwireTriggered:
    print("Math homework guardrail tripped")
```

### Output Guardrails
```python
from pydantic import BaseModel
from agents import (
    Agent,
    GuardrailFunctionOutput,
    OutputGuardrailTripwireTriggered,
    RunContextWrapper,
    Runner,
    output_guardrail,
)

class MessageOutput(BaseModel):
    response: str

class MathOutput(BaseModel):
    reasoning: str
    is_math: bool

guardrail_agent = Agent(
    name="Guardrail check",
    instructions="Check if the output includes any math.",
    output_type=MathOutput,
)

@output_guardrail
async def math_guardrail(
    ctx: RunContextWrapper, agent: Agent, output: MessageOutput
) -> GuardrailFunctionOutput:
    result = await Runner.run(guardrail_agent, output.response, context=ctx.context)

    return GuardrailFunctionOutput(
        output_info=result.final_output,
        tripwire_triggered=result.final_output.is_math,
    )

agent = Agent(
    name="Customer support agent",
    instructions="You are a customer support agent.",
    output_guardrails=[math_guardrail],
    output_type=MessageOutput,
)
```

### Guardrail Execution Modes
```python
# Parallel execution (default) - runs concurrently with agent
@input_guardrail(run_in_parallel=True)
async def fast_guardrail(...) -> GuardrailFunctionOutput:
    # May have already consumed tokens if it fails
    pass

# Blocking execution - runs BEFORE agent starts
@input_guardrail(run_in_parallel=False)
async def blocking_guardrail(...) -> GuardrailFunctionOutput:
    # Agent never executes if guardrail fails
    # Ideal for cost optimization
    pass
```

### Streaming Events
```python
import asyncio
from openai.types.responses import ResponseTextDeltaEvent
from agents import Agent, Runner

async def main():
    agent = Agent(
        name="Joker",
        instructions="You are a helpful assistant.",
    )

    result = Runner.run_streamed(agent, input="Please tell me 5 jokes.")

    async for event in result.stream_events():
        # Stream text token by token
        if event.type == "raw_response_event" and isinstance(event.data, ResponseTextDeltaEvent):
            print(event.data.delta, end="", flush=True)
```

### Streaming High-Level Events
```python
from agents import Agent, ItemHelpers, Runner, function_tool

@function_tool
def get_data() -> str:
    return "Data retrieved"

async def main():
    agent = Agent(
        name="Assistant",
        instructions="Use the get_data tool, then respond.",
        tools=[get_data],
    )

    result = Runner.run_streamed(agent, input="Hello")

    async for event in result.stream_events():
        if event.type == "raw_response_event":
            continue  # Ignore token-level events
        elif event.type == "agent_updated_stream_event":
            print(f"Agent updated: {event.new_agent.name}")
        elif event.type == "run_item_stream_event":
            if event.item.type == "tool_call_item":
                print("-- Tool was called")
            elif event.item.type == "tool_call_output_item":
                print(f"-- Tool output: {event.item.output}")
            elif event.item.type == "message_output_item":
                print(f"-- Message: {ItemHelpers.text_message_output(event.item)}")
```

### Tool Use Behavior Control
```python
from agents import Agent, function_tool, ModelSettings
from agents.agent import StopAtTools

@function_tool
def get_weather(city: str) -> str:
    """Returns weather info for the specified city."""
    return f"The weather in {city} is sunny"

# Stop immediately after first tool call
agent1 = Agent(
    name="Weather Agent",
    instructions="Retrieve weather details.",
    tools=[get_weather],
    tool_use_behavior="stop_on_first_tool"
)

# Stop only if specific tools are called
agent2 = Agent(
    name="Selective Agent",
    instructions="Get weather or sum numbers.",
    tools=[get_weather, sum_numbers],
    tool_use_behavior=StopAtTools(stop_at_tool_names=["get_weather"])
)

# Force tool use
agent3 = Agent(
    name="Forced Tool Agent",
    instructions="Retrieve weather details.",
    tools=[get_weather],
    model_settings=ModelSettings(tool_choice="get_weather")  # Force specific tool
)
```

### Custom Tool Use Handler
```python
from agents import Agent, function_tool, FunctionToolResult, RunContextWrapper
from agents.agent import ToolsToFinalOutputResult
from typing import List, Any

@function_tool
def get_weather(city: str) -> str:
    return f"The weather in {city} is sunny"

def custom_tool_handler(
    context: RunContextWrapper[Any],
    tool_results: List[FunctionToolResult]
) -> ToolsToFinalOutputResult:
    """Processes tool results to decide final output."""
    for result in tool_results:
        if result.output and "sunny" in result.output:
            return ToolsToFinalOutputResult(
                is_final_output=True,
                final_output=f"Final weather: {result.output}"
            )
    return ToolsToFinalOutputResult(
        is_final_output=False,
        final_output=None
    )

agent = Agent(
    name="Weather Agent",
    instructions="Retrieve weather details.",
    tools=[get_weather],
    tool_use_behavior=custom_tool_handler
)
```

### RunConfig for Global Settings
```python
from agents import Agent, Runner, RunConfig, ModelSettings

agent = Agent(name="Assistant")

result = await Runner.run(
    agent,
    "Hello",
    run_config=RunConfig(
        model="gpt-4",  # Override agent model
        model_settings=ModelSettings(temperature=0.7),  # Global settings
        max_turns=10,
        workflow_name="Customer Support",  # For tracing
        trace_id="unique-trace-id",
        group_id="conversation-group",  # Link multiple traces
        trace_metadata={"user_id": "123", "session": "abc"},
        nest_handoff_history=True,  # Collapse history on handoff
        tracing_disabled=False,
        trace_include_sensitive_data=False,
    )
)
```

### Conditional Tool Enabling
```python
from agents import Agent, AgentBase, Runner, RunContextWrapper
from pydantic import BaseModel

class LanguageContext(BaseModel):
    language_preference: str = "french_spanish"

def french_enabled(ctx: RunContextWrapper[LanguageContext], agent: AgentBase) -> bool:
    """Enable French for French+Spanish preference."""
    return ctx.context.language_preference == "french_spanish"

spanish_agent = Agent(name="spanish_agent", instructions="Respond in Spanish.")
french_agent = Agent(name="french_agent", instructions="Respond in French.")

orchestrator = Agent(
    name="orchestrator",
    instructions="You must call ALL available tools to provide responses.",
    tools=[
        spanish_agent.as_tool(
            tool_name="respond_spanish",
            tool_description="Respond in Spanish",
            is_enabled=True,  # Always enabled
        ),
        french_agent.as_tool(
            tool_name="respond_french",
            tool_description="Respond in French",
            is_enabled=french_enabled,  # Conditional
        ),
    ],
)
```

### Custom Session Implementation
```python
from agents.memory import Session
from typing import List

class MyCustomSession:
    """Custom session implementation following the Session protocol."""

    def __init__(self, session_id: str):
        self.session_id = session_id
        # Your initialization here

    async def get_items(self, limit: int | None = None) -> List[dict]:
        # Retrieve conversation history for the session
        pass

    async def add_items(self, items: List[dict]) -> None:
        # Store new items for the session
        pass

    async def pop_item(self) -> dict | None:
        # Remove and return the most recent item
        pass

    async def clear_session(self) -> None:
        # Clear all items for the session
        pass

# Use custom session
agent = Agent(name="Assistant")
result = await Runner.run(agent, "Hello", session=MyCustomSession("my_session"))
```

### Agent Cloning
```python
from agents import Agent

pirate_agent = Agent(
    name="Pirate",
    instructions="Write like a pirate",
    model="gpt-4.1",
)

robot_agent = pirate_agent.clone(
    name="Robot",
    instructions="Write like a robot",
)
```

### Lifecycle Hooks
```python
from agents import Agent
from agents.lifecycle import AgentHooks

class CustomHooks(AgentHooks):
    async def on_agent_start(self, context, agent):
        print(f"Agent {agent.name} starting")

    async def on_agent_end(self, context, agent, result):
        print(f"Agent {agent.name} finished")

agent = Agent(
    name="Assistant",
    hooks=CustomHooks(),
)
```

### Error Handling in Tools
```python
from agents import function_tool, RunContextWrapper
from typing import Any

def my_custom_error_function(context: RunContextWrapper[Any], error: Exception) -> str:
    """Provide user-friendly error message."""
    print(f"Tool failed: {error}")
    return "An internal server error occurred. Please try again later."

@function_tool(failure_error_function=my_custom_error_function)
def get_user_profile(user_id: str) -> str:
    """Fetches a user profile from a mock API."""
    if user_id == "user_123":
        return "User profile for user_123 successfully retrieved."
    else:
        raise ValueError(f"Could not retrieve profile for user_id: {user_id}")
```

### Recommended Handoff Prompts
```python
from agents import Agent
from agents.extensions.handoff_prompt import RECOMMENDED_PROMPT_PREFIX

billing_agent = Agent(
    name="Billing agent",
    instructions=f"""{RECOMMENDED_PROMPT_PREFIX}
    You are a billing agent specialized in payment processing.
    <Fill in the rest of your prompt here>.""",
)
```

## Orchestration Patterns

### LLM-Based Orchestration
Use LLM intelligence for planning and decision-making:
- Equip agents with tools (web search, file search, code execution)
- Provide handoffs to specialized agents
- Let LLM autonomously plan and execute tasks
- Invest in good prompts and monitoring
- Use specialized agents rather than general-purpose ones

### Code-Based Orchestration
Use code for deterministic, predictable flows:
```python
# 1. Sequential chaining
research_result = await Runner.run(research_agent, task)
outline_result = await Runner.run(outline_agent, research_result.final_output)
blog_result = await Runner.run(writer_agent, outline_result.final_output)

# 2. Parallel execution
results = await asyncio.gather(
    Runner.run(agent1, task1),
    Runner.run(agent2, task2),
    Runner.run(agent3, task3),
)

# 3. Evaluation loop
while not passes_criteria:
    result = await Runner.run(task_agent, input)
    evaluation = await Runner.run(eval_agent, result.final_output)
    if evaluation.passed:
        break
    input = evaluation.feedback
```

### Multi-Turn Conversations
```python
from agents import Agent, Runner, trace

agent = Agent(name="Assistant", instructions="Reply very concisely.")

thread_id = "thread_123"
with trace(workflow_name="Conversation", group_id=thread_id):
    # First turn
    result = await Runner.run(agent, "What city is the Golden Gate Bridge in?")
    print(result.final_output)  # San Francisco

    # Second turn
    new_input = result.to_input_list() + [{"role": "user", "content": "What state is it in?"}]
    result = await Runner.run(agent, new_input)
    print(result.final_output)  # California
```

## When to Use OpenAI Agents Python SDK

Use this SDK when:
- Building multi-agent systems with specialized roles
- Need agent-to-agent handoffs and delegation
- Implementing guardrails for safety and validation
- Want automatic conversation memory (sessions)
- Require detailed tracing and debugging
- Building agentic workflows with tool use
- Need provider-agnostic agent framework (supports 100+ LLMs)
- Want both LLM-based and code-based orchestration

Avoid when:
- Need simple single-agent interactions (overkill)
- Building primarily UI-focused chatbot (use Responses API directly)
- Working with non-LLM agents

## Design Patterns Comparison

| Pattern | Manager (Agents as Tools) | Handoffs |
|---------|---------------------------|----------|
| Control | Centralized (manager retains control) | Decentralized (peer delegation) |
| Usage | `tools=[sub_agent.as_tool()]` | `handoffs=[sub_agent]` |
| Flow | Manager → Tool-Agent → Manager | Agent A → Agent B (B takes over) |
| History | Manager sees all | Handoff receives full history |
| Best for | Orchestration, data aggregation | Task specialization, workflows |

## Key Exceptions

```python
from agents.exceptions import (
    AgentsException,              # Base class for all SDK exceptions
    MaxTurnsExceeded,             # Exceeded max_turns limit
    ModelBehaviorError,           # LLM produced invalid output
    UserError,                    # SDK misuse/configuration error
    InputGuardrailTripwireTriggered,   # Input guardrail failed
    OutputGuardrailTripwireTriggered,  # Output guardrail failed
)
```

## Reference Files

| Concept | File |
|---------|------|
| Agent configuration | `docs/agents.md` |
| Runner API | `docs/running_agents.md` |
| Handoffs | `docs/handoffs.md` |
| Function tools | `docs/tools.md` |
| Guardrails | `docs/guardrails.md` |
| Streaming | `docs/streaming.md` |
| Multi-agent patterns | `docs/multi_agent.md` |
| Customer service example | `examples/customer_service/main.py` |
| Agent patterns | `examples/agent_patterns/` |

## Installation

```bash
# Basic installation
pip install openai-agents

# With voice support
pip install 'openai-agents[voice]'

# With Redis session support
pip install 'openai-agents[redis]'

# Using uv
uv add openai-agents
```

## Environment Setup

```bash
export OPENAI_API_KEY='your-api-key-here'
```

## Quick Reference

```python
# Core imports
from agents import (
    Agent,                    # Main agent class
    Runner,                   # Execute agents
    function_tool,            # Decorator for tools
    handoff,                  # Create handoffs
    input_guardrail,          # Input validation
    output_guardrail,         # Output validation
    ModelSettings,            # Model configuration
    RunConfig,                # Global run settings
    SQLiteSession,            # Session management
    RunContextWrapper,        # Context for tools/handoffs
)

# Tracing
from agents import trace

# Hosted tools
from agents import (
    WebSearchTool,
    FileSearchTool,
    ComputerTool,
    CodeInterpreterTool,
    LocalShellTool,
)

# Extensions
from agents.extensions import handoff_filters
from agents.extensions.handoff_prompt import RECOMMENDED_PROMPT_PREFIX
```
