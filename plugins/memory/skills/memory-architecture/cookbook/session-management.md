# Purpose

Manage session-scoped memory to provide coherent context within a working session while enabling cross-session continuity. Sessions represent bounded interaction periods with distinct start/end events, enabling session-local caching, efficient context injection, and proper archival when sessions conclude.

## Variables

```yaml
# Session Configuration
SESSION_CONFIG:
  max_session_duration_hours: 8
  idle_timeout_minutes: 30
  max_hot_entries: 5
  auto_archive_on_end: true

# Session States
SESSION_STATES:
  - active
  - idle
  - suspended
  - ended

# Storage Paths
SESSION_ROOT: "${MEMORY_ROOT}/sessions"
ACTIVE_SESSION_FILE: "${SESSION_ROOT}/active.json"
SESSION_ARCHIVE: "${SESSION_ROOT}/archive/"

# Event Types
SESSION_EVENTS:
  - session_start
  - prompt_submitted
  - tool_executed
  - response_completed
  - session_idle
  - session_resume
  - session_end
```

## Instructions

### 1. Understand Session Lifecycle

Sessions follow a predictable lifecycle with well-defined transitions:

```
┌─────────────┐
│   START     │ ← SessionStart event
└──────┬──────┘
       │
       ▼
┌─────────────┐    idle_timeout    ┌─────────────┐
│   ACTIVE    │ ─────────────────► │    IDLE     │
└──────┬──────┘                    └──────┬──────┘
       │                                  │
       │ explicit end                     │ user returns
       │                                  │
       │         ┌────────────────────────┘
       ▼         ▼
┌─────────────────────────────────┐
│             RESUME              │
└─────────────────────────────────┘
       │
       │ Stop event / timeout
       ▼
┌─────────────┐
│    ENDED    │ → Archive & cleanup
└─────────────┘
```

### 2. Implement Session Data Structures

```python
from dataclasses import dataclass, field, asdict
from datetime import datetime, timedelta
from enum import Enum
from typing import List, Dict, Optional, Any
from pathlib import Path
import json
import uuid


class SessionState(Enum):
    ACTIVE = "active"
    IDLE = "idle"
    SUSPENDED = "suspended"
    ENDED = "ended"


@dataclass
class SessionEvent:
    """Event within a session."""
    event_type: str
    timestamp: str
    data: Dict[str, Any] = field(default_factory=dict)

    @classmethod
    def now(cls, event_type: str, **data) -> "SessionEvent":
        return cls(
            event_type=event_type,
            timestamp=datetime.now().isoformat(),
            data=data
        )


@dataclass
class SessionContext:
    """Current session context for injection."""
    recent_files: List[str] = field(default_factory=list)
    recent_tools: List[str] = field(default_factory=list)
    key_entities: List[str] = field(default_factory=list)
    current_task: Optional[str] = None
    working_directory: Optional[str] = None


@dataclass
class Session:
    """Complete session state."""
    id: str
    state: SessionState
    started_at: str
    last_activity: str
    context: SessionContext
    events: List[SessionEvent] = field(default_factory=list)
    hot_memory: List[Dict] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)

    @classmethod
    def create(cls, metadata: Dict = None) -> "Session":
        """Create a new session."""
        now = datetime.now().isoformat()
        return cls(
            id=str(uuid.uuid4())[:8],
            state=SessionState.ACTIVE,
            started_at=now,
            last_activity=now,
            context=SessionContext(),
            events=[SessionEvent.now("session_start")],
            metadata=metadata or {}
        )

    def to_dict(self) -> dict:
        """Serialize to dictionary."""
        return {
            "id": self.id,
            "state": self.state.value,
            "started_at": self.started_at,
            "last_activity": self.last_activity,
            "context": asdict(self.context),
            "events": [asdict(e) for e in self.events[-50:]],  # Keep last 50 events
            "hot_memory": self.hot_memory,
            "metadata": self.metadata
        }

    @classmethod
    def from_dict(cls, data: dict) -> "Session":
        """Deserialize from dictionary."""
        return cls(
            id=data["id"],
            state=SessionState(data["state"]),
            started_at=data["started_at"],
            last_activity=data["last_activity"],
            context=SessionContext(**data.get("context", {})),
            events=[SessionEvent(**e) for e in data.get("events", [])],
            hot_memory=data.get("hot_memory", []),
            metadata=data.get("metadata", {})
        )
```

### 3. Implement Session Manager

```python
class SessionManager:
    """Manage session lifecycle and state."""

    def __init__(self,
                 session_root: Path,
                 idle_timeout_minutes: int = 30,
                 max_duration_hours: int = 8,
                 max_hot_entries: int = 5):
        self.session_root = session_root
        self.idle_timeout = timedelta(minutes=idle_timeout_minutes)
        self.max_duration = timedelta(hours=max_duration_hours)
        self.max_hot_entries = max_hot_entries

        self.active_file = session_root / "active.json"
        self.archive_dir = session_root / "archive"
        self.archive_dir.mkdir(parents=True, exist_ok=True)

        self._session: Optional[Session] = None

    @property
    def session(self) -> Optional[Session]:
        """Get current session, loading from disk if needed."""
        if self._session is None:
            self._session = self._load_active_session()
        return self._session

    def start_session(self, metadata: Dict = None) -> Session:
        """Start a new session."""
        # End any existing session first
        if self.session and self.session.state != SessionState.ENDED:
            self.end_session()

        self._session = Session.create(metadata)
        self._persist()
        return self._session

    def get_or_create_session(self) -> Session:
        """Get existing session or create new one."""
        session = self.session

        if session is None:
            return self.start_session()

        # Check if session should auto-end
        if self._should_end_session(session):
            self.end_session()
            return self.start_session()

        # Check if session is idle and should resume
        if session.state == SessionState.IDLE:
            self._resume_session()

        return self._session

    def record_event(self, event_type: str, **data) -> None:
        """Record an event in the current session."""
        session = self.get_or_create_session()

        event = SessionEvent.now(event_type, **data)
        session.events.append(event)
        session.last_activity = event.timestamp

        # Update context based on event type
        self._update_context_from_event(event)

        self._persist()

    def add_to_hot_memory(self, entry: Dict) -> None:
        """Add entry to session's hot memory."""
        session = self.get_or_create_session()

        session.hot_memory.append({
            **entry,
            "added_at": datetime.now().isoformat()
        })

        # Enforce max entries
        if len(session.hot_memory) > self.max_hot_entries:
            session.hot_memory = session.hot_memory[-self.max_hot_entries:]

        self._persist()

    def get_hot_memory(self) -> List[Dict]:
        """Get current session's hot memory."""
        session = self.session
        if session is None:
            return []
        return session.hot_memory

    def end_session(self) -> Optional[Dict]:
        """End the current session and archive."""
        if self._session is None:
            return None

        self._session.state = SessionState.ENDED
        self._session.events.append(SessionEvent.now("session_end"))

        # Archive session
        archive_path = self._archive_session()

        # Clear active session
        if self.active_file.exists():
            self.active_file.unlink()

        result = self._session.to_dict()
        result["archive_path"] = str(archive_path)

        self._session = None
        return result

    def get_session_summary(self) -> Dict:
        """Get summary of current session for injection."""
        session = self.session
        if session is None:
            return {}

        duration = datetime.now() - datetime.fromisoformat(session.started_at)

        return {
            "session_id": session.id,
            "duration_minutes": int(duration.total_seconds() / 60),
            "state": session.state.value,
            "event_count": len(session.events),
            "hot_memory_count": len(session.hot_memory),
            "context": asdict(session.context)
        }

    def _should_end_session(self, session: Session) -> bool:
        """Check if session should auto-end."""
        now = datetime.now()
        started = datetime.fromisoformat(session.started_at)
        last_activity = datetime.fromisoformat(session.last_activity)

        # Max duration exceeded
        if now - started > self.max_duration:
            return True

        # Idle timeout exceeded significantly (2x idle timeout = end)
        if now - last_activity > self.idle_timeout * 2:
            return True

        return False

    def _resume_session(self) -> None:
        """Resume an idle session."""
        if self._session:
            self._session.state = SessionState.ACTIVE
            self._session.events.append(SessionEvent.now("session_resume"))
            self._session.last_activity = datetime.now().isoformat()
            self._persist()

    def _update_context_from_event(self, event: SessionEvent) -> None:
        """Update session context based on event."""
        if self._session is None:
            return

        ctx = self._session.context

        if event.event_type == "tool_executed":
            tool = event.data.get("tool")
            if tool and tool not in ctx.recent_tools[-5:]:
                ctx.recent_tools.append(tool)
                ctx.recent_tools = ctx.recent_tools[-10:]

            file_path = event.data.get("file_path")
            if file_path and file_path not in ctx.recent_files[-5:]:
                ctx.recent_files.append(file_path)
                ctx.recent_files = ctx.recent_files[-10:]

        elif event.event_type == "prompt_submitted":
            # Extract entities from prompt
            entities = event.data.get("entities", [])
            for entity in entities:
                if entity not in ctx.key_entities:
                    ctx.key_entities.append(entity)
            ctx.key_entities = ctx.key_entities[-20:]

    def _load_active_session(self) -> Optional[Session]:
        """Load active session from disk."""
        if not self.active_file.exists():
            return None

        try:
            data = json.loads(self.active_file.read_text())
            session = Session.from_dict(data)

            # Check if session is still valid
            if session.state == SessionState.ENDED:
                return None

            # Check idle state
            last_activity = datetime.fromisoformat(session.last_activity)
            if datetime.now() - last_activity > self.idle_timeout:
                session.state = SessionState.IDLE

            return session
        except (json.JSONDecodeError, KeyError):
            return None

    def _persist(self) -> None:
        """Persist current session to disk."""
        if self._session is None:
            return

        self.active_file.parent.mkdir(parents=True, exist_ok=True)
        self.active_file.write_text(json.dumps(self._session.to_dict(), indent=2))

    def _archive_session(self) -> Path:
        """Archive session to archive directory."""
        if self._session is None:
            return self.archive_dir

        # Create archive filename
        started = datetime.fromisoformat(self._session.started_at)
        filename = f"{started.strftime('%Y-%m-%d_%H-%M')}_{self._session.id}.json"
        archive_path = self.archive_dir / filename

        archive_path.write_text(json.dumps(self._session.to_dict(), indent=2))
        return archive_path
```

### 4. Implement Session-Aware Context Injection

```python
class SessionContextInjector:
    """Inject session context into prompts."""

    def __init__(self, session_manager: SessionManager):
        self.session_mgr = session_manager

    def get_injection_context(self, prompt: str) -> str:
        """Get context to inject based on current session."""
        session = self.session_mgr.get_or_create_session()

        parts = []

        # Add session status
        parts.append(self._format_session_status(session))

        # Add recent files context
        if session.context.recent_files:
            parts.append(self._format_recent_files(session.context.recent_files))

        # Add hot memory
        if session.hot_memory:
            parts.append(self._format_hot_memory(session.hot_memory))

        # Add current task if set
        if session.context.current_task:
            parts.append(f"Current task: {session.context.current_task}")

        if not parts:
            return ""

        return "[SESSION CONTEXT]\n" + "\n\n".join(parts) + "\n[END SESSION]"

    def _format_session_status(self, session: Session) -> str:
        """Format session status line."""
        duration = datetime.now() - datetime.fromisoformat(session.started_at)
        duration_str = f"{int(duration.total_seconds() / 60)}m"

        return f"Session: {session.id} | Duration: {duration_str} | Events: {len(session.events)}"

    def _format_recent_files(self, files: List[str]) -> str:
        """Format recent files list."""
        if not files:
            return ""

        lines = ["Recent files:"]
        for f in files[-5:]:
            lines.append(f"  - {f}")

        return "\n".join(lines)

    def _format_hot_memory(self, memories: List[Dict]) -> str:
        """Format hot memory entries."""
        if not memories:
            return ""

        lines = ["Recent context:"]
        for mem in memories[-5:]:
            summary = mem.get("summary", mem.get("content", "")[:100])
            added = mem.get("added_at", "")
            if added:
                age = self._format_age(added)
                lines.append(f"  - [{age}] {summary}")
            else:
                lines.append(f"  - {summary}")

        return "\n".join(lines)

    def _format_age(self, timestamp: str) -> str:
        """Format timestamp as relative age."""
        try:
            age = datetime.now() - datetime.fromisoformat(timestamp)
            if age.total_seconds() < 60:
                return "just now"
            elif age.total_seconds() < 3600:
                return f"{int(age.total_seconds() / 60)}m ago"
            else:
                return f"{int(age.total_seconds() / 3600)}h ago"
        except:
            return "?"
```

### 5. Implement Session Event Handlers

```python
class SessionEventHandler:
    """Handle session events from Claude Code hooks."""

    def __init__(self, session_manager: SessionManager,
                 memory_manager=None):
        self.session_mgr = session_manager
        self.memory_mgr = memory_manager

    def on_session_start(self, event_data: Dict) -> Dict:
        """Handle SessionStart hook event."""
        session = self.session_mgr.start_session(metadata=event_data)

        return {
            "session_id": session.id,
            "status": "started"
        }

    def on_prompt_submitted(self, prompt: str, entities: List[str] = None) -> None:
        """Handle UserPromptSubmit hook event."""
        self.session_mgr.record_event(
            "prompt_submitted",
            prompt_preview=prompt[:100],
            entities=entities or []
        )

    def on_tool_executed(self, tool_name: str, tool_input: Dict,
                         tool_output: str) -> None:
        """Handle PostToolUse hook event."""
        # Extract relevant info
        file_path = tool_input.get("file_path") or tool_input.get("path")

        self.session_mgr.record_event(
            "tool_executed",
            tool=tool_name,
            file_path=file_path,
            output_length=len(tool_output)
        )

        # Add to hot memory if significant
        if tool_name in ["Write", "Edit", "Bash"]:
            summary = self._summarize_tool_execution(tool_name, tool_input, tool_output)
            if summary:
                self.session_mgr.add_to_hot_memory({
                    "type": "tool_result",
                    "tool": tool_name,
                    "summary": summary
                })

    def on_response_completed(self, response_preview: str) -> None:
        """Handle response completion."""
        self.session_mgr.record_event(
            "response_completed",
            response_preview=response_preview[:200]
        )

    def on_session_end(self) -> Dict:
        """Handle Stop hook event."""
        result = self.session_mgr.end_session()

        # Archive session to warm/cold memory if memory manager available
        if self.memory_mgr and result:
            self._archive_session_to_memory(result)

        return result or {}

    def _summarize_tool_execution(self, tool: str, input: Dict,
                                   output: str) -> Optional[str]:
        """Create summary of tool execution."""
        if tool == "Write":
            path = input.get("file_path", "unknown")
            lines = len(input.get("content", "").split("\n"))
            return f"Created {path} ({lines} lines)"

        elif tool == "Edit":
            path = input.get("file_path", "unknown")
            old = input.get("old_string", "")[:30]
            new = input.get("new_string", "")[:30]
            return f"Edited {path}: '{old}' -> '{new}'"

        elif tool == "Bash":
            cmd = input.get("command", "")[:50]
            return f"Ran: {cmd}"

        return None

    def _archive_session_to_memory(self, session_data: Dict) -> None:
        """Archive session summary to long-term memory."""
        if not self.memory_mgr:
            return

        # Create session summary for archival
        summary = f"""Session {session_data.get('id')}
Duration: {session_data.get('started_at')} to {session_data.get('last_activity')}
Events: {len(session_data.get('events', []))}

Context:
- Files: {', '.join(session_data.get('context', {}).get('recent_files', [])[:5])}
- Tools: {', '.join(session_data.get('context', {}).get('recent_tools', [])[:5])}
"""

        self.memory_mgr.cold.archive(
            content=summary,
            source=f"session:{session_data.get('id')}"
        )
```

### 6. Implement Session Resume Logic

```python
class SessionResumer:
    """Handle resuming sessions with context restoration."""

    def __init__(self, session_manager: SessionManager):
        self.session_mgr = session_manager

    def get_resume_context(self) -> Optional[str]:
        """Get context for resuming an idle session."""
        session = self.session_mgr.session

        if session is None or session.state != SessionState.IDLE:
            return None

        # Calculate idle duration
        last_activity = datetime.fromisoformat(session.last_activity)
        idle_duration = datetime.now() - last_activity

        parts = [
            f"Welcome back. Session {session.id} was idle for {self._format_duration(idle_duration)}.",
            "",
            "Last activity summary:"
        ]

        # Get last few events
        recent_events = session.events[-5:]
        for event in recent_events:
            event_time = datetime.fromisoformat(event.timestamp)
            relative = self._format_relative_time(event_time)
            parts.append(f"  - [{relative}] {event.event_type}")

        # Add context hints
        if session.context.recent_files:
            parts.append(f"\nRecent files: {', '.join(session.context.recent_files[-3:])}")

        if session.context.current_task:
            parts.append(f"\nYou were working on: {session.context.current_task}")

        return "\n".join(parts)

    def _format_duration(self, duration: timedelta) -> str:
        """Format duration as human-readable string."""
        total_seconds = int(duration.total_seconds())

        if total_seconds < 60:
            return f"{total_seconds} seconds"
        elif total_seconds < 3600:
            return f"{total_seconds // 60} minutes"
        else:
            hours = total_seconds // 3600
            minutes = (total_seconds % 3600) // 60
            return f"{hours}h {minutes}m"

    def _format_relative_time(self, timestamp: datetime) -> str:
        """Format timestamp relative to now."""
        age = datetime.now() - timestamp
        return self._format_duration(age) + " ago"
```

## When to Use This Pattern

Use session management when:

- **Working sessions have clear boundaries** - Users start and stop work
- **Context should persist within sessions** - Continuity within work periods
- **Cross-session continuity is needed** - Pick up where you left off
- **Session-level analytics matter** - Track work patterns
- **Hot memory needs session scope** - Recent context is session-specific

Avoid when:

- Sessions are ephemeral (single-query)
- All interactions are independent
- No session lifecycle events available

## Trade-offs and Considerations

### Session Duration Tuning

| Max Duration | Use Case |
|--------------|----------|
| 1-2 hours | Focused task completion |
| 4-8 hours | Workday sessions |
| 24 hours | Multi-day projects |
| Unlimited | Long-running processes |

### Idle Timeout Impact

| Timeout | Behavior |
|---------|----------|
| 5 min | Aggressive - frequent new sessions |
| 30 min | Balanced - typical coffee break |
| 2 hours | Relaxed - extended breaks allowed |

### Storage Considerations

```python
# Estimate storage per session
hot_memory_entries = 5
avg_entry_size = 500  # bytes
events_per_session = 50
avg_event_size = 200  # bytes

session_size = (
    hot_memory_entries * avg_entry_size +
    events_per_session * avg_event_size
)
# ~12.5 KB per session

# Daily estimate (8 hour sessions, 30 min idle)
sessions_per_day = 16  # Worst case
daily_storage = sessions_per_day * session_size
# ~200 KB per day
```

### Resume Context Limits

- Keep resume context under 500 tokens
- Prioritize most recent/relevant events
- Truncate file lists if too long
- Consider user preferences for verbosity
