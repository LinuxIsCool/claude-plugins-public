# Messages Plugin - Research Overview

*Research compilation for universal messaging backbone*

## Research Scope

This research explores paradigms for building a universal messaging system that:

1. **Unifies messages from all platforms** - Telegram, WhatsApp, Signal, emails, forum posts, HTTP requests, URL reads, Claude Code events
2. **Enables agent-to-agent communication** - Compatible with the ecosystem's multi-agent architecture
3. **Serves as a local centralized store** - Pull messages from all platforms into a queryable local database
4. **Supports content-addressable storage** - Immutable, verifiable message history
5. **Provides a terminal interface** - For exploring messages, accounts, and networks

## Research Documents

| Document | Focus |
|----------|-------|
| [01-decentralized-protocols.md](./01-decentralized-protocols.md) | Nostr, ATProtocol, ActivityPub, Matrix |
| [02-data-architecture.md](./02-data-architecture.md) | Event sourcing, CQRS, ElizaOS schema, CAS |
| [03-ecosystem-integration.md](./03-ecosystem-integration.md) | Current plugins, coordination patterns |
| [04-design-synthesis.md](./04-design-synthesis.md) | Synthesized architecture recommendations |

## Key Findings Summary

### From Decentralized Protocols

**Nostr** offers the simplest event model:
- Single JSON event structure with kind, content, tags, signature
- Relays are dumb pipes (store and forward)
- Client-side filtering and verification
- *Takeaway: Simplicity enables extensibility*

**ATProtocol** provides the identity model:
- DIDs (Decentralized Identifiers) separate identity from hosting
- Repositories as signed Merkle trees
- Lexicons define schemas
- *Takeaway: Portable identity with schema evolution*

**ActivityPub** shows federation patterns:
- Actor → Inbox/Outbox model
- Activities wrap Objects
- Server-to-server delivery
- *Takeaway: Clear message flow semantics*

**Matrix** demonstrates synchronization:
- Event DAG for conflict-free replication
- State resolution algorithms
- Eventual consistency guarantees
- *Takeaway: Multi-party sync without central authority*

### From Data Architecture

**Event Sourcing** provides the storage model:
- Append-only event log as source of truth
- Materialized views for queries
- Full audit trail
- *Takeaway: Events are immutable; state is derived*

**Content-Addressable Storage** ensures integrity:
- CIDs link content to identity
- Merkle DAGs enable efficient sync
- Immutable history
- *Takeaway: Content defines identity*

**ElizaOS Schema** shows agent-centric modeling:
- Accounts (identities)
- Memories (messages with embeddings)
- Rooms (conversations)
- Worlds (contexts)
- *Takeaway: Agent-first data model*

### From Ecosystem Integration

**Current patterns in use:**
- Git as coordination layer (file changes as messages)
- YAML frontmatter + markdown body
- Hooks for event capture (logging plugin)
- Session/Agent identity (statusline plugin)
- Social primitives (AgentNet plugin)

**Integration opportunities:**
- Extend logging events to message format
- Unify with statusline identity
- Subsume AgentNet with richer model
- Bridge to external platforms via adapters

## Core Design Principles (Proposed)

1. **Event-First**: Every message is an immutable event
2. **Identity-Portable**: Accounts decouple from sources
3. **Content-Addressed**: Messages have deterministic IDs
4. **Schema-Flexible**: Kinds/types are extensible
5. **Adapter-Based**: Platform bridges are plugins
6. **Markdown-Native**: Human-readable storage
7. **Git-Coordinated**: Files + commits as coordination layer

## Next Steps

1. Finalize clarifying questions
2. Design schema (Message, Account, Thread, Adapter)
3. Plan adapter architecture for external platforms
4. Define TUI interface requirements
5. Prototype core storage layer

---

*Research conducted: 2025-12-17*
