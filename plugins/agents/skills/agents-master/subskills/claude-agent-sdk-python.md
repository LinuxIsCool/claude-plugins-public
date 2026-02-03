---
name: claude-agent-sdk-python
description: Build Python applications that programmatically control Claude Code with tools, hooks, and streaming conversations. Use for automation, custom workflows, and interactive AI-powered applications.
allowed-tools: Read, Glob, Grep, Bash
---

# Claude Agent SDK Python Mastery

Programmatically control Claude Code from Python applications with full support for tools, hooks, streaming conversations, and bidirectional communication.

## Territory Map

```
resources/agents/claude-agent-sdk-python/
├── src/claude_agent_sdk/
│   ├── query.py                # Unidirectional query() function
│   ├── client.py               # ClaudeSDKClient for bidirectional streaming
│   ├── types.py                # All type definitions
│   ├── __init__.py             # @tool decorator, create_sdk_mcp_server()
│   └── _internal/
│       ├── query.py            # Internal Query implementation
│       ├── client.py           # Internal client logic
│       └── transport/          # CLI subprocess management
├── examples/
│   ├── quick_start.py          # Basic query() examples
│   ├── streaming_mode.py       # ClaudeSDKClient patterns
│   ├── mcp_calculator.py       # In-process MCP tools
│   └── hooks.py                # Hook system examples
└── e2e-tests/                  # End-to-end test suite
```

## Core Capabilities

- **Two communication modes**: Unidirectional `query()` for one-shot tasks, bidirectional `ClaudeSDKClient` for conversations
- **Custom tools**: Define Python functions as in-process MCP servers (no subprocess overhead)
- **Hook system**: Intercept and control tool execution at PreToolUse, PostToolUse, UserPromptSubmit, Stop, and SubagentStop
- **Streaming responses**: Real-time message consumption with interrupts and dynamic control
- **Permission control**: Programmatic tool approval via callbacks or permission modes
- **Session management**: Multi-turn conversations with state, model switching, and file checkpointing

## Beginner Techniques

### Basic Query (Unidirectional)
```python
import anyio
from claude_agent_sdk import query, AssistantMessage, TextBlock

async def main():
    async for message in query(prompt="What is 2 + 2?"):
        if isinstance(message, AssistantMessage):
            for block in message.content:
                if isinstance(block, TextBlock):
                    print(block.text)

anyio.run(main)
```

### Query with Options
```python
from claude_agent_sdk import query, ClaudeAgentOptions

options = ClaudeAgentOptions(
    system_prompt="You are a helpful coding assistant",
    allowed_tools=["Read", "Write", "Bash"],
    permission_mode="acceptEdits",  # auto-accept file edits
    max_turns=5,
    cwd="/path/to/project"
)

async for message in query(
    prompt="Create a hello.py file",
    options=options
):
    print(message)
```

### Basic Streaming Client
```python
from claude_agent_sdk import ClaudeSDKClient

async with ClaudeSDKClient() as client:
    await client.query("What's the capital of France?")

    async for msg in client.receive_response():
        if isinstance(msg, AssistantMessage):
            for block in msg.content:
                if isinstance(block, TextBlock):
                    print(f"Claude: {block.text}")
```

## Intermediate Techniques

### Tool Definition with @tool Decorator
```python
from claude_agent_sdk import tool, create_sdk_mcp_server, ClaudeAgentOptions, ClaudeSDKClient

@tool("add", "Add two numbers", {"a": float, "b": float})
async def add_numbers(args):
    result = args["a"] + args["b"]
    return {
        "content": [{"type": "text", "text": f"Result: {result}"}]
    }

@tool("multiply", "Multiply two numbers", {"a": float, "b": float})
async def multiply_numbers(args):
    result = args["a"] * args["b"]
    return {
        "content": [{"type": "text", "text": f"Result: {result}"}]
    }

# Create in-process MCP server
calculator = create_sdk_mcp_server(
    name="calculator",
    version="1.0.0",
    tools=[add_numbers, multiply_numbers]
)

# Use with Claude
options = ClaudeAgentOptions(
    mcp_servers={"calc": calculator},
    allowed_tools=["mcp__calc__add", "mcp__calc__multiply"]
)

async with ClaudeSDKClient(options=options) as client:
    await client.query("Calculate 15 + 27")
    async for msg in client.receive_response():
        print(msg)
```

### PreToolUse Hook for Command Filtering
```python
from claude_agent_sdk import ClaudeAgentOptions, ClaudeSDKClient, HookMatcher

async def check_bash_command(input_data, tool_use_id, context):
    tool_name = input_data["tool_name"]
    tool_input = input_data["tool_input"]

    if tool_name != "Bash":
        return {}

    command = tool_input.get("command", "")
    block_patterns = ["rm -rf", "sudo"]

    for pattern in block_patterns:
        if pattern in command:
            return {
                "hookSpecificOutput": {
                    "hookEventName": "PreToolUse",
                    "permissionDecision": "deny",
                    "permissionDecisionReason": f"Command contains forbidden pattern: {pattern}"
                }
            }

    return {}

options = ClaudeAgentOptions(
    allowed_tools=["Bash"],
    hooks={
        "PreToolUse": [
            HookMatcher(matcher="Bash", hooks=[check_bash_command])
        ]
    }
)

async with ClaudeSDKClient(options=options) as client:
    await client.query("Run the bash command: echo 'Hello!'")
    async for msg in client.receive_response():
        print(msg)
```

### PostToolUse Hook for Output Analysis
```python
async def review_tool_output(input_data, tool_use_id, context):
    tool_response = input_data.get("tool_response", "")

    if "error" in str(tool_response).lower():
        return {
            "systemMessage": "Command produced an error",
            "reason": "Tool execution failed",
            "hookSpecificOutput": {
                "hookEventName": "PostToolUse",
                "additionalContext": "The command encountered an error. Consider a different approach."
            }
        }

    return {}

options = ClaudeAgentOptions(
    allowed_tools=["Bash"],
    hooks={
        "PostToolUse": [
            HookMatcher(matcher="Bash", hooks=[review_tool_output])
        ]
    }
)
```

### Multi-turn Conversation
```python
async with ClaudeSDKClient() as client:
    # Turn 1
    await client.query("What's the capital of France?")
    async for msg in client.receive_response():
        print(msg)

    # Turn 2 - maintains context
    await client.query("What's the population of that city?")
    async for msg in client.receive_response():
        print(msg)
```

## Advanced Techniques

### Bidirectional Communication with Interrupts
```python
import asyncio

async with ClaudeSDKClient() as client:
    # Start long-running task
    await client.query("Count from 1 to 100 slowly")

    # Consume messages in background
    async def consume_messages():
        async for msg in client.receive_response():
            print(msg)

    consume_task = asyncio.create_task(consume_messages())

    # Interrupt after 2 seconds
    await asyncio.sleep(2)
    await client.interrupt()

    await consume_task

    # Send new query after interrupt
    await client.query("Just say hello")
    async for msg in client.receive_response():
        print(msg)
```

### Dynamic Permission Control
```python
async with ClaudeSDKClient() as client:
    # Start with default permissions
    await client.query("Analyze this codebase")
    async for msg in client.receive_response():
        print(msg)

    # Switch to auto-accept edits
    await client.set_permission_mode('acceptEdits')
    await client.query("Now implement the fix we discussed")
    async for msg in client.receive_response():
        print(msg)
```

### Model Switching
```python
async with ClaudeSDKClient() as client:
    # Start with default model
    await client.query("Help me understand this problem")
    async for msg in client.receive_response():
        print(msg)

    # Switch to different model for implementation
    await client.set_model('claude-sonnet-4-5-20250929')
    await client.query("Now implement the solution")
    async for msg in client.receive_response():
        print(msg)
```

### File Checkpointing and Rewind
```python
options = ClaudeAgentOptions(enable_file_checkpointing=True)

async with ClaudeSDKClient(options) as client:
    await client.query("Make some changes to my files")

    checkpoint_id = None
    async for msg in client.receive_response():
        if isinstance(msg, UserMessage):
            checkpoint_id = msg.uuid  # Save checkpoint
        print(msg)

    # Later, rewind files to checkpoint
    if checkpoint_id:
        await client.rewind_files(checkpoint_id)
```

### Permission Callback
```python
from claude_agent_sdk import CanUseTool, PermissionResultAllow, PermissionResultDeny

async def can_use_tool_callback(tool_name, tool_input, context):
    if tool_name == "Write":
        file_path = tool_input.get("file_path", "")
        if "important" in file_path.lower():
            return PermissionResultDeny(
                message="Cannot write to important files",
                interrupt=False
            )

    return PermissionResultAllow()

options = ClaudeAgentOptions(
    allowed_tools=["Read", "Write"],
    can_use_tool=can_use_tool_callback
)

async with ClaudeSDKClient(options=options) as client:
    await client.query("Write to important_config.txt")
    async for msg in client.receive_response():
        print(msg)
```

### Mixed SDK and External MCP Servers
```python
# In-process SDK server
my_tools_server = create_sdk_mcp_server(
    name="my-tools",
    tools=[add_numbers, multiply_numbers]
)

# External subprocess server
options = ClaudeAgentOptions(
    mcp_servers={
        "internal": my_tools_server,  # In-process
        "external": {                 # External subprocess
            "type": "stdio",
            "command": "external-server",
            "args": ["--config", "config.json"]
        }
    }
)
```

### Custom Agents
```python
from claude_agent_sdk import AgentDefinition

options = ClaudeAgentOptions(
    agents={
        "code-reviewer": AgentDefinition(
            description="Expert code reviewer",
            prompt="You are a senior software engineer focused on code quality",
            tools=["Read", "Grep"],
            model="opus"
        ),
        "implementer": AgentDefinition(
            description="Implementation specialist",
            prompt="You implement features efficiently",
            tools=["Read", "Write", "Edit", "Bash"],
            model="sonnet"
        )
    }
)
```

### Structured Output
```python
options = ClaudeAgentOptions(
    output_format={
        "type": "json_schema",
        "schema": {
            "type": "object",
            "properties": {
                "summary": {"type": "string"},
                "confidence": {"type": "number"}
            }
        }
    }
)

async for message in query(
    prompt="Analyze this code",
    options=options
):
    if isinstance(message, ResultMessage):
        structured_data = message.structured_output
        print(structured_data)
```

## Key Patterns

| Pattern | Use Case |
|---------|----------|
| `query()` | One-shot tasks, batch processing, automation scripts |
| `ClaudeSDKClient` | Interactive conversations, chat apps, stateful sessions |
| `@tool` decorator | Custom in-process tools without subprocess overhead |
| PreToolUse hooks | Permission control, input validation, command filtering |
| PostToolUse hooks | Output analysis, error handling, feedback injection |
| Interrupts | User control, cancellation, dynamic flow changes |
| Permission modes | acceptEdits (auto-approve), bypassPermissions (allow all), default (prompt) |
| File checkpointing | Undo functionality, experimental changes, safe exploration |

## When to Use Claude Agent SDK Python

**Use query() when:**
- Simple one-off questions
- Batch processing of independent prompts
- Automated scripts and CI/CD pipelines
- All inputs known upfront
- No need for follow-up messages

**Use ClaudeSDKClient when:**
- Building chat interfaces or conversational UIs
- Interactive debugging or exploration
- Multi-turn conversations with context
- Need to react to Claude's responses
- Real-time applications with interrupts

**Use custom tools when:**
- Need application-specific capabilities
- Want better performance than external MCP servers
- Need direct access to application state
- Simpler deployment (single process)

**Use hooks when:**
- Need deterministic control over tool execution
- Want to filter or validate commands
- Need to inject additional context
- Building safety guardrails
- Automated feedback loops

## Error Handling

```python
from claude_agent_sdk import (
    ClaudeSDKError,      # Base error
    CLINotFoundError,    # Claude Code not installed
    CLIConnectionError,  # Connection issues
    ProcessError,        # Process failed
    CLIJSONDecodeError   # JSON parsing issues
)

try:
    async for message in query(prompt="Hello"):
        print(message)
except CLINotFoundError:
    print("Please install Claude Code")
except ProcessError as e:
    print(f"Process failed with exit code: {e.exit_code}")
except CLIJSONDecodeError as e:
    print(f"Failed to parse response: {e}")
```

## Reference Files

- Unidirectional API: `src/claude_agent_sdk/query.py`
- Bidirectional client: `src/claude_agent_sdk/client.py`
- All types: `src/claude_agent_sdk/types.py`
- Tool decorator: `src/claude_agent_sdk/__init__.py` (tool, create_sdk_mcp_server)
- Quick start: `examples/quick_start.py`
- Streaming patterns: `examples/streaming_mode.py`
- MCP tools: `examples/mcp_calculator.py`
- Hooks: `examples/hooks.py`
