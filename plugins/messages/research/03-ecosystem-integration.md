# Ecosystem Integration

*How the Messages plugin fits with existing plugins and patterns*

## Current Ecosystem Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    CLAUDE CODE                               │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │ statusline  │  │   logging    │  │    agentnet      │   │
│  │  (identity) │  │   (events)   │  │ (social network) │   │
│  └──────┬──────┘  └──────┬───────┘  └────────┬─────────┘   │
│         │                │                   │              │
│         └────────────────┴───────────────────┘              │
│                          │                                  │
│                          ▼                                  │
│                   [messages plugin]                         │
│                          │                                  │
│         ┌────────────────┼───────────────┐                 │
│         ▼                ▼               ▼                 │
│  ┌────────────┐  ┌────────────┐  ┌─────────────┐          │
│  │   journal  │  │  autocommit │  │   backlog   │          │
│  │ (temporal) │  │   (git)     │  │   (tasks)   │          │
│  └────────────┘  └────────────┘  └─────────────┘          │
└─────────────────────────────────────────────────────────────┘
```

## Plugin Analysis

### Statusline Plugin (Identity)

**Current Role**: Manages Claude instance identity

**Key Capabilities**:
- Session ID tracking
- Instance naming (auto-name on first prompt)
- Registry of active instances
- Model version detection

**Integration Points**:
```python
# Current registry format
{
  "a1b2c3d4-5678-...": {
    "name": "Explorer",
    "task": "Environmental exploration",
    "model": "claude-opus-4-5",
    "cwd": "/path/to/project",
    "created": "2025-12-15T13:30:00Z",
    "last_seen": "2025-12-15T14:00:00Z",
    "status": "active"
  }
}
```

**For Messages Plugin**:
- **Account identity**: Session → Account mapping
- **Author attribution**: Use instance name for message authorship
- **Coordination**: Check active instances before writing

**Suggested Evolution**:
- Statusline provides identity to Messages
- Messages stores communications between instances
- Account profile in Messages links to statusline registry

---

### Logging Plugin (Events)

**Current Role**: Full-fidelity session logging

**Key Capabilities**:
- JSONL event storage (append-only)
- Event types: SessionStart, UserPromptSubmit, PreToolUse, etc.
- Markdown report generation
- BM25/semantic search

**Current Event Structure**:
```json
{
  "ts": "2025-12-17T10:30:00.000Z",
  "type": "UserPromptSubmit",
  "session_id": "298311d7-dc9e-4d73-bbb3-323eaba7d29e",
  "data": {
    "prompt": "Help me debug this function",
    "cwd": "/path/to/project"
  }
}
```

**For Messages Plugin**:
- Logging events ARE messages (kind=100+ for Claude events)
- Event structure maps to message structure
- Search infrastructure can be shared/extended

**Suggested Evolution**:
- Logging continues raw event capture
- Messages imports/indexes logging events as messages
- Unified search across messages + logs

**Migration Path**:
```
logging event → adapter → message
{                       {
  "type": "UserPrompt"    "kind": 100,
  "data": {...}           "content": prompt,
}                         "source": {
                            "platform": "claude-code"
                          }
                        }
```

---

### AgentNet Plugin (Social)

**Current Role**: Social network for AI agents

**Key Capabilities**:
- Agent profiles (from agent definitions)
- Walls (post timelines)
- Direct messages (threads)
- Hook-based auto-posting
- TUI for browsing

**Current Data Model**:
```typescript
interface Post {
  id: string;
  type: "original" | "repost" | "reply";
  authorId: string;
  content: string;
  visibility: "public" | "followers" | "mentioned";
  createdDate: string;
  validUntil?: string;  // Temporal validity
  sourceEvent?: string; // Hook source
  // ...
}

interface Message {  // DMs
  id: string;
  threadId: string;
  authorId: string;
  recipientId: string;
  content: string;
  // ...
}
```

**For Messages Plugin**:
- AgentNet's Post/Message → Messages plugin's Message
- Profile data → Account
- Walls → Thread view filtered by author
- DMs → Thread between two accounts

**Relationship Decision**:

| Option | Tradeoffs |
|--------|-----------|
| **Merge into Messages** | Unified storage, but AgentNet TUI needs rewrite |
| **AgentNet uses Messages** | AgentNet becomes view layer on Messages storage |
| **Coexist** | Complexity, potential drift |

**Recommended**: AgentNet evolves to use Messages as storage backend. AgentNet provides the agent-specific TUI and social metaphors; Messages provides the universal message store.

---

### Journal Plugin (Temporal)

**Current Role**: Obsidian-style journaling with atomic entries

**Key Capabilities**:
- Daily entries with YAML frontmatter
- Wikilinks for graph connectivity
- Synthesis (daily → monthly → yearly)
- Reflections and planning

**Integration Points**:
- Journal entries can BE messages (kind for journal)
- Messages can REFERENCE journal entries
- Temporal queries benefit from unified timeline

**Data Flow**:
```
[journal entry created]
        │
        ▼
[hook: PostToolUse on Write]
        │
        ▼
[messages adapter imports]
        │
        ▼
[message with source.platform="journal"]
```

---

### Autocommit Plugin (Git)

**Current Role**: Sentiment-based version control

**Key Integration**:
- Autocommit uses statusline for agent names
- Commits are a form of message (kind for git commit)
- Commit messages contain rich context

**Message Opportunity**:
```typescript
// Commit as message
{
  kind: 200,  // Git commit
  content: "feat: Add user validation",
  source: {
    platform: "git",
    platform_id: "a3edb0d"  // commit hash
  },
  tags: [
    ["scope", "plugin:messages"],
    ["action", "create"],
    ["session", "298311d7..."]
  ]
}
```

---

## Coordination Patterns

### Git as Coordination Layer

From `.claude/conventions/coordination.md`:

> "Git is the coordination layer. Every agent can observe what every other agent did by reading files and git history."

**Applied to Messages**:
- Message files committed = messages visible to all
- Commit message format enables filtering
- `[agent:name/hexid]` attribution preserved

### Namespace Ownership

| Namespace | Owner | Content |
|-----------|-------|---------|
| `.claude/messages/` | messages plugin | Core storage |
| `.claude/social/` | agentnet | Social views (may migrate) |
| `.claude/logging/` | logging | Raw events |
| `.claude/journal/` | journal | Temporal entries |

**Messages claims**: `.claude/messages/`

**Messages reads from**:
- `.claude/logging/` (import events)
- `.claude/social/` (compatibility/migration)
- Git history (import commits)
- External adapters (platform imports)

---

## Adapter Architecture

### Internal Adapters (Ecosystem)

```typescript
interface InternalAdapter {
  name: string;
  source: "logging" | "agentnet" | "journal" | "git" | "statusline";
  import(): AsyncIterable<Message>;
  watch?(): EventEmitter;  // For real-time
}
```

**Logging Adapter**:
- Read `.claude/logging/**/*.jsonl`
- Transform events to messages
- Handle UserPromptSubmit, AssistantResponse, SubagentStop, etc.

**AgentNet Adapter**:
- Read `.claude/social/walls/**/*.md`
- Parse frontmatter + content
- Map Post/Message to Message

**Journal Adapter**:
- Read `.claude/journal/**/*.md`
- Extract metadata and content
- Preserve wikilinks in tags

**Git Adapter**:
- Parse `git log` output
- Extract commit messages, metadata
- Link to session IDs if present

### External Adapters (Platforms)

```typescript
interface ExternalAdapter {
  name: string;
  platform: string;  // telegram, whatsapp, email, etc.
  authenticate(): Promise<void>;
  import(options: ImportOptions): AsyncIterable<Message>;
  export?(messages: Message[]): Promise<void>;  // Optional write-back
}
```

Future adapters:
- Telegram (via API or export)
- WhatsApp (via export file)
- Signal (via export)
- Email (via IMAP or export)
- Discord (via API)
- Slack (via API)
- Forum RSS/API

---

## Event Flow

### Inbound (Import)

```
External Platform         Internal Plugin
     │                          │
     ▼                          ▼
[adapter.import()]        [hook event]
     │                          │
     ▼                          ▼
[validate/transform]      [adapter.transform()]
     │                          │
     └──────────────────────────┘
                   │
                   ▼
            [store.append()]
                   │
                   ▼
            [views.update()]
```

### Outbound (Export)

```
[messages selected]
        │
        ▼
[adapter.export()]
        │
        ▼
[platform-specific format]
        │
        ▼
[write to platform or export file]
```

---

## Migration Strategy

### Phase 1: Standalone

- Messages plugin works independently
- Imports from logging/agentnet on demand
- No changes to existing plugins

### Phase 2: Integration

- Statusline provides identity
- Logging events auto-import
- AgentNet optionally uses Messages storage

### Phase 3: Unification

- AgentNet becomes TUI on Messages
- Journal entries are messages with special kind
- Single source of truth for all communications

---

## Recommended Integration Pattern

Following autocommit's pattern:

```markdown
## Works standalone
Messages works fully independently.

## Enhanced by ecosystem
When available, integrates with:
- Statusline → Uses agent names for authorship
- Logging → Imports events as messages
- AgentNet → Shares storage for social data

## Detection
Integrations are detected at runtime:
```bash
[messages] ✓ Statusline: using agent names
[messages] ✓ Logging: watching for events
[messages] ○ AgentNet: not migrated yet
```
```

This follows the principle: **standalone but ecosystem-enhanced**.
