---
name: a2a
description: Master the Agent2Agent (A2A) protocol for enabling AI agents to discover, communicate, and collaborate across different frameworks and organizations. Use when building agent-to-agent communication systems, implementing agent discovery mechanisms, handling long-running tasks with streaming, or deploying enterprise-ready agent collaboration.
allowed-tools: Read, Glob, Grep, Bash, WebFetch
---

# A2A Protocol Mastery

The Agent2Agent (A2A) Protocol is an open standard that enables seamless communication and interoperability between AI agents built on different frameworks, by different vendors, running on separate servers.

## Territory Map

```
resources/agents/A2A/
├── docs/
│   ├── specification.md        # Complete protocol specification
│   ├── topics/
│   │   ├── key-concepts.md     # Core building blocks
│   │   ├── agent-discovery.md  # Discovery strategies
│   │   ├── life-of-a-task.md   # Task lifecycle management
│   │   ├── streaming-and-async.md # SSE & push notifications
│   │   ├── enterprise-ready.md # Security & observability
│   │   ├── a2a-and-mcp.md      # Protocol comparison
│   │   └── what-is-a2a.md      # High-level overview
│   └── tutorials/python/       # Step-by-step Python guides
│       ├── 3-agent-skills-and-card.md
│       ├── 4-agent-executor.md
│       └── 7-streaming-and-multiturn.md
└── specification/
    ├── grpc/a2a.proto          # Protocol Buffers definition
    └── json/                   # JSON-RPC schemas
```

## Core Capabilities

- **Agent Discovery**: Well-known URIs, curated registries, Agent Cards with capabilities
- **Communication Patterns**: Request/response, SSE streaming, push notifications
- **Task Management**: Stateful tasks with lifecycle (submitted, working, completed, failed, etc.)
- **Content Types**: Text, files (inline/URI), structured JSON data
- **Enterprise Features**: OAuth2/OpenID Connect auth, TLS, distributed tracing, monitoring
- **Opaque Execution**: Agents collaborate without exposing internal memory, tools, or state

## Beginner Techniques

### Understanding Agent Cards

Agent Cards are JSON metadata documents that serve as "digital business cards" for A2A Servers.

```json
{
  "name": "Hello World Agent",
  "description": "A simple example agent",
  "version": "1.0.0",
  "url": "http://localhost:9999/",
  "capabilities": {
    "streaming": false,
    "pushNotifications": false
  },
  "defaultInputModes": ["text/plain"],
  "defaultOutputModes": ["text/plain"],
  "security": {
    "schemes": {
      "public": {
        "type": "none"
      }
    }
  },
  "skills": [
    {
      "id": "hello_world",
      "name": "Returns hello world",
      "description": "Simple greeting skill",
      "inputModes": ["text/plain"],
      "outputModes": ["text/plain"],
      "examples": ["Say hello", "Greet me"]
    }
  ]
}
```

**Key Agent Card Elements:**
- `url`: The A2A service endpoint
- `capabilities`: Declares streaming/push notification support
- `security.schemes`: Authentication requirements (none, Bearer, OAuth2, etc.)
- `skills`: Array of AgentSkill objects describing what the agent can do

### Discovering Agents via Well-Known URI

```bash
# Standard discovery pattern
curl https://agent-domain.example.com/.well-known/agent-card.json

# Returns the Agent Card for that agent
```

**Agent Discovery Strategies:**
1. **Well-Known URI**: `https://{domain}/.well-known/agent-card.json` (RFC 8615)
2. **Curated Registries**: Central catalogs with search/filtering
3. **Direct Configuration**: Hardcoded URLs for private/development scenarios

### Basic Message Exchange

A Message represents a single communication turn between client and agent.

```json
{
  "jsonrpc": "2.0",
  "id": "req-001",
  "method": "message.send",
  "params": {
    "message": {
      "role": "user",
      "messageId": "msg-001",
      "parts": [
        {
          "text": "What's the weather in Paris?"
        }
      ]
    }
  }
}
```

**Message Components:**
- `role`: Either "user" (client) or "agent" (server)
- `messageId`: Unique identifier for this message
- `parts`: Array of content (TextPart, FilePart, DataPart)

### Understanding Parts

Parts are the fundamental content containers within Messages and Artifacts.

```typescript
// TextPart - plain text content
{
  "text": "Hello world"
}

// FilePart - binary content (inline or URI)
{
  "file": {
    "name": "document.pdf",
    "mediaType": "application/pdf",
    "fileWithBytes": "base64_encoded_data..."
  }
}

// DataPart - structured JSON data
{
  "data": {
    "temperature": 22.5,
    "humidity": 65,
    "location": "Paris"
  }
}
```

## Intermediate Techniques

### Task Lifecycle Management

Tasks are stateful units of work with defined lifecycles.

```python
# Task states
TaskState = {
    "submitted": "Task received, not yet processing",
    "working": "Agent actively processing",
    "input-required": "Needs user input to continue",
    "auth-required": "Needs additional credentials",
    "completed": "Successfully finished (terminal)",
    "failed": "Error occurred (terminal)",
    "canceled": "User canceled (terminal)",
    "rejected": "Agent rejected the request (terminal)"
}
```

**Task Immutability**: Once a task reaches a terminal state (completed, failed, canceled, rejected), it cannot be restarted. Follow-up work requires a new task within the same `contextId`.

### Multi-Turn Conversations with Context

```json
// Initial request
{
  "method": "message.send",
  "params": {
    "message": {
      "role": "user",
      "parts": [{"text": "Book a flight to Helsinki"}]
    }
  }
}

// Response with Task and contextId
{
  "result": {
    "id": "task-123",
    "contextId": "ctx-conversation-abc",
    "status": {"state": "completed"},
    "artifacts": [...]
  }
}

// Follow-up in same context
{
  "method": "message.send",
  "params": {
    "message": {
      "role": "user",
      "contextId": "ctx-conversation-abc",
      "referenceTaskIds": ["task-123"],
      "parts": [{"text": "Also book a hotel near the airport"}]
    }
  }
}
```

**Context Management:**
- `contextId`: Groups related tasks into logical sessions
- `referenceTaskIds`: Hints which previous tasks are relevant
- Agents use context to maintain conversational state across tasks

### Implementing AgentExecutor (Python SDK)

```python
from a2a.server.agent_execution import AgentExecutor
from a2a.types import Message, Task, TaskStatusUpdateEvent

class MyAgentExecutor(AgentExecutor):
    async def execute(
        self,
        context: RequestContext,
        event_queue: EventQueue
    ):
        # Access incoming message
        user_message = context.message.parts[0].text

        # Process request
        result = await self.agent.invoke(user_message)

        # Send response message
        response = new_agent_text_message(result)
        await event_queue.enqueue(response)

    async def cancel(
        self,
        context: RequestContext,
        event_queue: EventQueue
    ):
        # Handle task cancellation
        raise UnsupportedOperationError("Cancellation not supported")
```

**Key Components:**
- `RequestContext`: Contains message, task details, contextId
- `EventQueue`: Send Messages, Tasks, StatusUpdates, ArtifactUpdates
- `execute()`: Handles message.send and message.stream requests
- `cancel()`: Handles task cancellation requests

### Task Refinements and Follow-ups

```python
# Pattern: Client sends refinement request
{
  "message": {
    "contextId": "ctx-abc",
    "referenceTaskIds": ["task-boat-123"],
    "parts": [{"text": "Make the boat red"}]
  }
}

# Server creates NEW task (not restart old one)
{
  "result": {
    "id": "task-boat-456",  # New taskId
    "contextId": "ctx-abc",  # Same context
    "artifacts": [{
      "artifactId": "artifact-v2-red",
      "name": "sailboat_image.png",  # Same name for tracking
      "parts": [...]
    }]
  }
}
```

**Artifact Mutation Tracking:**
- Client maintains version history
- Server uses consistent `name` for refined artifacts
- Each refinement creates new artifact with new `artifactId`

## Advanced Techniques

### Streaming with Server-Sent Events (SSE)

```python
# Enable streaming in Agent Card
agent_card = AgentCard(
    capabilities=AgentCapabilities(streaming=True),
    ...
)

# Executor: Stream status updates and artifacts
async def execute(self, context, event_queue):
    # Initial status
    await event_queue.enqueue(TaskStatusUpdateEvent(
        state=TaskState.working,
        message="Processing your request...",
        final=False
    ))

    # Incremental artifact chunks
    for chunk in generate_response_chunks():
        await event_queue.enqueue(TaskArtifactUpdateEvent(
            artifact=chunk,
            append=True,
            lastChunk=False
        ))

    # Final chunk
    await event_queue.enqueue(TaskArtifactUpdateEvent(
        artifact=final_chunk,
        append=True,
        lastChunk=True
    ))

    # Completion
    await event_queue.enqueue(TaskStatusUpdateEvent(
        state=TaskState.completed,
        final=True
    ))
```

**SSE Event Types:**
- `Task`: Initial task object
- `TaskStatusUpdateEvent`: State changes, intermediate messages
- `TaskArtifactUpdateEvent`: Artifact chunks with append/lastChunk flags

### Push Notifications for Long-Running Tasks

```python
# Client provides webhook configuration
{
  "method": "message.send",
  "params": {
    "message": {...},
    "pushNotificationConfig": {
      "url": "https://client.example.com/webhook",
      "token": "client-verification-token",
      "authentication": {
        "schemes": {
          "bearer": {
            "type": "http",
            "scheme": "bearer"
          }
        }
      }
    }
  }
}

# Server sends notifications on significant events
# POST to client webhook with StreamResponse payload
{
  "statusUpdate": {
    "taskId": "task-789",
    "state": "completed",
    "message": "Processing finished",
    "final": true
  }
}
```

**Push Notification Security:**
- **Server validates webhook URL**: Prevent SSRF attacks via allowlisting
- **Server authenticates to webhook**: Bearer tokens, HMAC, mTLS
- **Client validates notification**: JWT signature verification, token matching
- **Replay protection**: Timestamps, nonces (jti claims)
- **Key rotation**: Use JWKS endpoints for public key distribution

### Enterprise Authentication & Authorization

```json
// Agent Card with OAuth2
{
  "security": {
    "schemes": {
      "oauth2": {
        "type": "oauth2",
        "flows": {
          "authorizationCode": {
            "authorizationUrl": "https://auth.example.com/authorize",
            "tokenUrl": "https://auth.example.com/token",
            "scopes": {
              "read:data": "Read access",
              "write:data": "Write access"
            }
          }
        }
      }
    }
  }
}
```

**Authentication Flow:**
1. Client parses Agent Card `security` schemes
2. Client obtains credentials (OAuth flow, API key, etc.) out-of-band
3. Client sends credentials in HTTP headers: `Authorization: Bearer <token>`
4. Server validates credentials and applies authorization policies
5. Server returns 401 (invalid) or 403 (forbidden) on auth failures

**In-Task Authentication** (`auth-required` state):
```json
// Agent needs additional credentials for a tool
{
  "id": "task-456",
  "status": {
    "state": "auth-required",
    "message": "Need Google Calendar access",
    "authenticationRequest": {
      "provider": "google",
      "scopes": ["calendar.readonly"]
    }
  }
}
```

### Parallel Task Execution

```python
# Client creates parallel tasks in same context
# Task 1: Book flight
flight_task = await send_message("Book flight to Helsinki", contextId="ctx-trip")

# Task 2: Book hotel (depends on Task 1)
hotel_task = await send_message(
    "Book hotel near airport",
    contextId="ctx-trip",
    referenceTaskIds=[flight_task.id]
)

# Task 3: Book activity (also depends on Task 1)
activity_task = await send_message(
    "Book snowmobile tour",
    contextId="ctx-trip",
    referenceTaskIds=[flight_task.id]
)

# Task 4: Add spa (depends on Task 2)
spa_task = await send_message(
    "Add spa reservation to hotel",
    contextId="ctx-trip",
    referenceTaskIds=[hotel_task.id]
)
```

**Parallel Follow-Up Benefits:**
- Start dependent tasks as soon as prerequisites complete
- Track individual task progress independently
- Enable DAG-like workflows without coupling

### Distributed Tracing & Observability

```python
# Server propagates trace context (OpenTelemetry)
from opentelemetry import trace
from opentelemetry.trace.propagation.tracecontext import TraceContextTextMapPropagator

# Extract trace context from incoming HTTP headers
carrier = request.headers
ctx = TraceContextTextMapPropagator().extract(carrier)

# Start span with parent context
tracer = trace.get_tracer(__name__)
with tracer.start_as_current_span("process_task", context=ctx):
    # Process task
    result = await executor.execute(context, event_queue)

    # Log structured events
    logger.info("task_completed", extra={
        "taskId": task.id,
        "contextId": task.contextId,
        "duration_ms": duration,
        "trace_id": trace.get_current_span().get_span_context().trace_id
    })
```

**Enterprise Observability:**
- **Distributed Tracing**: W3C Trace Context headers, OpenTelemetry
- **Structured Logging**: Include taskId, contextId, trace IDs
- **Metrics**: Request rates, latencies, error rates, task durations
- **Auditing**: Log sensitive operations, authentication events

### Protocol Extensions

```json
// Agent Card declares custom extensions
{
  "extensions": {
    "customVendor": {
      "featureName": {
        "enabled": true,
        "config": {...}
      }
    }
  }
}

// Client checks extension support
if (agentCard.extensions?.customVendor?.featureName?.enabled) {
  // Use custom feature
}
```

**Extension Guidelines:**
- Namespace extensions under vendor/organization name
- Make extensions optional (graceful degradation)
- Document extension schemas clearly
- Consider proposing popular extensions for standardization

## When to Use A2A

- **Cross-Organization Agent Collaboration**: Agents from different companies/teams need to work together
- **Framework-Agnostic Integration**: Connect agents built on LangChain, CrewAI, ADK, custom frameworks
- **Long-Running Agentic Workflows**: Tasks taking minutes/hours/days with human-in-the-loop
- **Enterprise Agent Deployments**: Need security, auth, observability, governance
- **Agent Marketplace/Discovery**: Enable dynamic agent discovery and capability negotiation
- **Multi-Turn Agent Conversations**: Agents that ask clarifying questions, negotiate, refine outputs
- **Stateful Task Management**: Track work across sessions, resume interrupted tasks
- **Opaque Agent Collaboration**: Agents maintain autonomy without exposing internals

## A2A vs Other Protocols

### A2A vs MCP (Model Context Protocol)

| Aspect | A2A | MCP |
|--------|-----|-----|
| **Purpose** | Agent-to-agent collaboration | Model-to-tool/data connection |
| **Interaction** | Multi-turn, stateful, negotiation | Stateless tool invocation |
| **Use Case** | Complex agent workflows | Connecting LLMs to resources |
| **State** | Tasks, contexts, artifacts | Stateless function calls |
| **Autonomy** | Agents reason and delegate | Tools perform predefined functions |

**Complementary**: A2A agent can use MCP internally to access tools/data, then expose A2A interface for collaboration.

### Why Not Just Wrap Agents as Tools?

Wrapping agents as tools (e.g., via MCP) is limiting because:
- **Lost Autonomy**: Agents can't negotiate, ask questions, or reason multi-step
- **No State**: Can't maintain context across interactions
- **Reduced Capability**: Multi-turn conversations collapsed to single function calls
- **No Task Lifecycle**: Can't track long-running work or request input

A2A preserves agent capabilities while enabling collaboration.

## Reference Files

### Core Specification
- `/resources/agents/A2A/docs/specification.md` - Complete protocol specification
- `/resources/agents/A2A/specification/grpc/a2a.proto` - Normative Protocol Buffers definition

### Concepts & Guides
- `/resources/agents/A2A/docs/topics/key-concepts.md` - Task, Message, Part, Artifact definitions
- `/resources/agents/A2A/docs/topics/life-of-a-task.md` - Task lifecycle, refinements, parallel tasks
- `/resources/agents/A2A/docs/topics/streaming-and-async.md` - SSE streaming, push notifications
- `/resources/agents/A2A/docs/topics/agent-discovery.md` - Well-known URIs, registries, security
- `/resources/agents/A2A/docs/topics/enterprise-ready.md` - Auth, TLS, tracing, monitoring
- `/resources/agents/A2A/docs/topics/a2a-and-mcp.md` - Protocol comparison and positioning

### Tutorials
- `/resources/agents/A2A/docs/tutorials/python/3-agent-skills-and-card.md` - Building Agent Cards
- `/resources/agents/A2A/docs/tutorials/python/4-agent-executor.md` - Implementing AgentExecutor
- `/resources/agents/A2A/docs/tutorials/python/7-streaming-and-multiturn.md` - LangGraph example with SSE

### SDK Resources
- Python SDK: `pip install a2a-sdk` - https://github.com/a2aproject/a2a-python
- Go SDK: `go get github.com/a2aproject/a2a-go`
- JavaScript SDK: `npm install @a2a-js/sdk`
- Java SDK: Maven - https://github.com/a2aproject/a2a-java
- .NET SDK: `dotnet add package A2A`

### Community
- GitHub Discussions: https://github.com/a2aproject/A2A/discussions
- Protocol Website: https://a2a-protocol.org
- Samples Repository: https://github.com/a2aproject/a2a-samples
