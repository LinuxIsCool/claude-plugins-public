# Three-Tier Memory Architecture

## Purpose

Implement mem0's three-level memory system: User-level (permanent), Session-level (conversation-scoped), and Agent-level (task-scoped). This architecture enables personalization while maintaining appropriate context boundaries.

## Variables

```
MEMORY_LEVELS: user | session | agent | run
USER_PERSISTENCE: permanent
SESSION_PERSISTENCE: conversation-scoped
AGENT_PERSISTENCE: task-scoped
RUN_PERSISTENCE: execution-scoped
```

## Instructions

### Memory Hierarchy Overview

| Level | Identifier | Persistence | Use Case |
|-------|------------|-------------|----------|
| **User** | `user_id` | Permanent | Preferences, profile, long-term context |
| **Session** | `session_id` | Conversation-scoped | Current conversation, temporary preferences |
| **Agent** | `agent_id` | Task-scoped | Agent-specific knowledge, operational state |
| **Run** | `run_id` | Execution-scoped | Single execution context |

---

## User-Level Memory

User memories persist permanently and store preferences, profile information, and historical context that should carry across all interactions.

### When to Use User Memory

- User preferences (theme, language, coding style)
- Personal information (name, timezone, role)
- Historical facts that remain stable
- Cross-session context

### Implementation

```python
from mem0 import Memory

memory = Memory()

# Store user preferences
memory.add(
    "I prefer dark mode and use vim keybindings",
    user_id="user"
)

# Store user profile information
memory.add(
    [
        {"role": "user", "content": "My name is Shawn. I'm a software engineer at Anthropic."},
        {"role": "assistant", "content": "Nice to meet you, Shawn!"}
    ],
    user_id="user"
)

# Store technical preferences
memory.add(
    "I prefer Python for backend, TypeScript for frontend, and use PostgreSQL as my primary database",
    user_id="user",
    metadata={"category": "technical_preferences"}
)

# Retrieve user memories
user_memories = memory.get_all(user_id="user")
print(f"Found {len(user_memories['results'])} user memories")

# Search user context
results = memory.search(
    query="programming language preferences",
    user_id="user",
    limit=3
)
```

### User Memory Best Practices

```python
# DO: Store stable, long-term facts
memory.add("User's primary language is English", user_id="user")
memory.add("User prefers concise code comments", user_id="user")

# DO: Include metadata for categorization
memory.add(
    "User is working on a Claude Code plugin",
    user_id="user",
    metadata={
        "category": "project",
        "active": True,
        "started": "2026-01"
    }
)

# DON'T: Store temporary session-specific information at user level
# BAD: memory.add("User wants to debug the API endpoint today", user_id="user")
# BETTER: Use session-level for temporary context
```

---

## Session-Level Memory

Session memories are scoped to a specific conversation or interaction period. They store temporary context that should influence the current conversation but may not be relevant long-term.

### When to Use Session Memory

- Current task context
- Temporary preferences or modes
- Conversation-specific information
- Short-term goals

### Implementation

```python
from mem0 import Memory
import uuid

memory = Memory()

# Generate a unique session ID
session_id = f"session_{uuid.uuid4().hex[:8]}"

# Store session-specific context
memory.add(
    "In this session, the user wants to focus on API design",
    user_id="user",
    session_id=session_id
)

# Store temporary preferences
memory.add(
    "User wants verbose explanations in this session",
    user_id="user",
    session_id=session_id,
    metadata={"type": "session_preference"}
)

# Track conversation topics
memory.add(
    [
        {"role": "user", "content": "Let's debug the authentication module today"},
        {"role": "assistant", "content": "I'll help you debug the auth module. What issues are you seeing?"}
    ],
    user_id="user",
    session_id=session_id
)

# Search within session context
session_results = memory.search(
    query="current task focus",
    user_id="user",
    session_id=session_id,
    limit=5
)

# Get all session memories
session_memories = memory.get_all(
    user_id="user",
    session_id=session_id
)
```

### Session Management Pattern

```python
class SessionMemoryManager:
    """Manage session-scoped memories."""

    def __init__(self, user_id: str):
        self.memory = Memory()
        self.user_id = user_id
        self.session_id = None

    def start_session(self, session_id: str = None):
        """Start a new session."""
        import uuid
        self.session_id = session_id or f"session_{uuid.uuid4().hex[:8]}"
        return self.session_id

    def add_context(self, content: str, metadata: dict = None):
        """Add session context."""
        if not self.session_id:
            raise ValueError("No active session. Call start_session() first.")

        return self.memory.add(
            content,
            user_id=self.user_id,
            session_id=self.session_id,
            metadata=metadata
        )

    def get_context(self, query: str, limit: int = 5):
        """Get relevant session context."""
        if not self.session_id:
            return {"results": []}

        return self.memory.search(
            query=query,
            user_id=self.user_id,
            session_id=self.session_id,
            limit=limit
        )

    def end_session(self, promote_to_user: list = None):
        """End session and optionally promote memories to user level."""
        if promote_to_user:
            for memory_text in promote_to_user:
                self.memory.add(
                    memory_text,
                    user_id=self.user_id  # No session_id = user level
                )
        self.session_id = None

# Usage
manager = SessionMemoryManager(user_id="user")
session_id = manager.start_session()

manager.add_context("User is debugging authentication module")
manager.add_context("Focus on JWT token validation")

context = manager.get_context("current task")
print(f"Session context: {context}")

# End session, promote important discoveries
manager.end_session(promote_to_user=[
    "User's auth module uses JWT with RS256 algorithm"
])
```

---

## Agent-Level Memory

Agent memories store operational context specific to an AI agent or tool. This is useful for maintaining agent state, learned behaviors, and task-specific knowledge.

### When to Use Agent Memory

- Agent-specific configurations
- Learned behaviors from user feedback
- Tool state and operational context
- Multi-agent coordination

### Implementation

```python
from mem0 import Memory

memory = Memory()

# Store agent operational context
memory.add(
    "Code reviewer agent found 3 files with style violations in the last review",
    agent_id="code_reviewer",
    metadata={"type": "operational_state"}
)

# Store agent preferences/behaviors
memory.add(
    "Agent has learned to focus on security issues first based on user feedback",
    agent_id="code_reviewer",
    metadata={"type": "learned_behavior"}
)

# Store agent knowledge about the codebase
memory.add(
    "The project uses ESLint with Airbnb config for JavaScript files",
    agent_id="code_reviewer",
    user_id="user",  # Can combine with user_id for user-specific agent memory
    metadata={"type": "codebase_knowledge"}
)

# Retrieve agent memories
agent_memories = memory.get_all(agent_id="code_reviewer")

# Search agent context
results = memory.search(
    query="code style rules",
    agent_id="code_reviewer",
    limit=5
)
```

### Multi-Agent Memory Pattern

```python
from mem0 import Memory
from typing import Dict, List

class AgentMemorySystem:
    """Coordinate memory across multiple agents."""

    def __init__(self):
        self.memory = Memory()
        self.agents: Dict[str, dict] = {}

    def register_agent(self, agent_id: str, capabilities: List[str]):
        """Register an agent with its capabilities."""
        self.agents[agent_id] = {"capabilities": capabilities}

        # Store agent metadata
        self.memory.add(
            f"Agent {agent_id} has capabilities: {', '.join(capabilities)}",
            agent_id=agent_id,
            metadata={"type": "agent_registration"}
        )

    def share_knowledge(self, from_agent: str, to_agent: str, knowledge: str):
        """Share knowledge between agents."""
        # Store in source agent
        self.memory.add(
            f"Shared with {to_agent}: {knowledge}",
            agent_id=from_agent,
            metadata={"shared_to": to_agent}
        )

        # Store in target agent
        self.memory.add(
            f"Received from {from_agent}: {knowledge}",
            agent_id=to_agent,
            metadata={"shared_from": from_agent}
        )

    def get_agent_context(self, agent_id: str, query: str) -> dict:
        """Get relevant context for an agent."""
        return self.memory.search(
            query=query,
            agent_id=agent_id,
            limit=10
        )

    def get_shared_knowledge(self, agent_id: str) -> dict:
        """Get knowledge shared with this agent."""
        return self.memory.search(
            query="received from",
            agent_id=agent_id,
            limit=20
        )

# Usage
system = AgentMemorySystem()

# Register agents
system.register_agent("code_reviewer", ["code_review", "security_analysis"])
system.register_agent("documentation_writer", ["doc_generation", "api_docs"])

# Share knowledge between agents
system.share_knowledge(
    from_agent="code_reviewer",
    to_agent="documentation_writer",
    knowledge="The authentication module uses OAuth2 with PKCE flow"
)

# Get agent context
context = system.get_agent_context("documentation_writer", "authentication documentation")
```

---

## Run-Level Memory

Run memories are scoped to a single execution or workflow run. They track progress through a task and can be used for procedural memory.

### When to Use Run Memory

- Workflow progress tracking
- Single execution state
- Procedural memory (step-by-step task completion)
- Batch processing context

### Implementation

```python
from mem0 import Memory
import uuid

memory = Memory()

# Generate run ID
run_id = f"run_{uuid.uuid4().hex[:8]}"

# Store run progress
memory.add(
    "Step 1 complete: Loaded configuration files",
    agent_id="deployment_agent",
    run_id=run_id,
    metadata={"step": 1, "status": "complete"}
)

memory.add(
    "Step 2 complete: Validated dependencies",
    agent_id="deployment_agent",
    run_id=run_id,
    metadata={"step": 2, "status": "complete"}
)

# Search run context
run_results = memory.search(
    query="deployment progress",
    agent_id="deployment_agent",
    run_id=run_id,
    limit=10
)

# Get all run memories
run_memories = memory.get_all(
    agent_id="deployment_agent",
    run_id=run_id
)
```

### Procedural Memory Pattern

```python
from mem0 import Memory
from mem0.configs.enums import MemoryType

memory = Memory()

# Create procedural memory (requires agent_id)
result = memory.add(
    [
        {"role": "user", "content": "Deploy the application to staging"},
        {"role": "assistant", "content": "Starting deployment process..."}
    ],
    agent_id="deployment_agent",
    run_id="deploy_staging_001",
    memory_type=MemoryType.PROCEDURAL.value  # "procedural_memory"
)

# Procedural memories capture:
# - Task objective
# - Progress status
# - Sequential agent actions
# - Action results
# - Key findings
# - Errors encountered
```

---

## Combined Multi-Level Pattern

The most powerful pattern combines all levels for comprehensive context.

```python
from mem0 import Memory
import uuid

memory = Memory()

class MultiLevelMemorySystem:
    """Comprehensive three-tier memory implementation."""

    def __init__(self, user_id: str):
        self.memory = Memory()
        self.user_id = user_id
        self.session_id = None
        self.agent_id = None
        self.run_id = None

    def set_session(self, session_id: str = None):
        self.session_id = session_id or f"session_{uuid.uuid4().hex[:8]}"
        return self.session_id

    def set_agent(self, agent_id: str):
        self.agent_id = agent_id

    def set_run(self, run_id: str = None):
        self.run_id = run_id or f"run_{uuid.uuid4().hex[:8]}"
        return self.run_id

    def add_memory(self, content, level: str = "user", metadata: dict = None):
        """Add memory at specified level."""
        kwargs = {"user_id": self.user_id, "metadata": metadata}

        if level == "session" and self.session_id:
            kwargs["session_id"] = self.session_id
        elif level == "agent" and self.agent_id:
            kwargs["agent_id"] = self.agent_id
        elif level == "run" and self.run_id:
            kwargs["agent_id"] = self.agent_id
            kwargs["run_id"] = self.run_id

        return self.memory.add(content, **kwargs)

    def get_context(self, query: str, levels: list = None):
        """Get context from specified levels (or all)."""
        levels = levels or ["user", "session", "agent"]
        results = {"user": [], "session": [], "agent": [], "run": []}

        if "user" in levels:
            user_results = self.memory.search(
                query=query,
                user_id=self.user_id,
                limit=3
            )
            results["user"] = user_results.get("results", [])

        if "session" in levels and self.session_id:
            session_results = self.memory.search(
                query=query,
                user_id=self.user_id,
                session_id=self.session_id,
                limit=3
            )
            results["session"] = session_results.get("results", [])

        if "agent" in levels and self.agent_id:
            agent_results = self.memory.search(
                query=query,
                agent_id=self.agent_id,
                limit=3
            )
            results["agent"] = agent_results.get("results", [])

        if "run" in levels and self.run_id:
            run_results = self.memory.search(
                query=query,
                agent_id=self.agent_id,
                run_id=self.run_id,
                limit=3
            )
            results["run"] = run_results.get("results", [])

        return results

    def build_context_string(self, query: str) -> str:
        """Build a combined context string for LLM prompts."""
        context = self.get_context(query)

        sections = []

        if context["user"]:
            user_memories = "\n".join(f"- {m['memory']}" for m in context["user"])
            sections.append(f"## User Context\n{user_memories}")

        if context["session"]:
            session_memories = "\n".join(f"- {m['memory']}" for m in context["session"])
            sections.append(f"## Session Context\n{session_memories}")

        if context["agent"]:
            agent_memories = "\n".join(f"- {m['memory']}" for m in context["agent"])
            sections.append(f"## Agent Context\n{agent_memories}")

        if context["run"]:
            run_memories = "\n".join(f"- {m['memory']}" for m in context["run"])
            sections.append(f"## Run Context\n{run_memories}")

        return "\n\n".join(sections) if sections else "No relevant context found."

# Usage
system = MultiLevelMemorySystem(user_id="user")
system.set_session()
system.set_agent("code_assistant")
system.set_run()

# Add memories at different levels
system.add_memory("User prefers Python for backend", level="user")
system.add_memory("Currently debugging auth module", level="session")
system.add_memory("Agent uses flake8 for linting", level="agent")
system.add_memory("Run started: processing 5 files", level="run")

# Get combined context
context_string = system.build_context_string("code quality")
print(context_string)
```

---

## Next Steps

- [Conversation Extraction](./conversation-extraction.md) - Extract memories from conversations
- [Graph Memory](./graph-memory.md) - Neo4j graph memory for relationships
- [Token Optimization](./token-optimization.md) - Achieve 90% token reduction
