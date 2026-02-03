---
name: agents
description: Master skill for AI agent frameworks (18 sub-skills). Covers: CrewAI, LangChain, PydanticAI, OpenAI Agents, Eliza, Letta/MemGPT, Mem0, N8N, ADK, Archon, A2A protocol, Claude SDK, Anthropic SDK, Composio, Agno, Lucid Agents, OpenAPI spec. Invoke for multi-agent systems, memory, orchestration, tool integration.
allowed-tools: Read, Skill, Task, Glob, Grep
---

# Agents Plugin - Master Skill

AI agent frameworks, orchestration, memory systems, and tool integration.

## Sub-Skills Index

| Sub-Skill | Use When | File |
|-----------|----------|------|
| **crewai** | Multi-agent orchestration with roles, tasks, collaborative workflows | `subskills/crewai.md` |
| **langchain** | LLM apps with chains, agents, tools, composable components | `subskills/langchain.md` |
| **pydantic-ai** | Type-safe Python agents with validation, dependency injection | `subskills/pydantic-ai.md` |
| **openai-agents-python** | OpenAI SDK for multi-agent workflows, handoffs, guardrails | `subskills/openai-agents-python.md` |
| **eliza** | ElizaOS multi-agent TypeScript framework, modular plugins | `subskills/eliza.md` |
| **letta** | MemGPT pattern - stateful agents with self-editing memory | `subskills/letta.md` |
| **mem0** | Self-improving memory layer, fact extraction, semantic search | `subskills/mem0.md` |
| **n8n** | Workflow automation with AI/LangChain nodes | `subskills/n8n.md` |
| **adk-python** | Google's Agent Development Kit for production agents | `subskills/adk-python.md` |
| **archon** | AI agent platform with RAG, MCP, multi-model orchestration | `subskills/archon.md` |
| **a2a** | Agent2Agent protocol for cross-framework collaboration | `subskills/a2a.md` |
| **claude-agent-sdk-python** | Programmatically control Claude Code from Python | `subskills/claude-agent-sdk-python.md` |
| **anthropic-sdk-typescript** | Official TypeScript SDK for Claude API | `subskills/anthropic-sdk-typescript.md` |
| **composio** | Tool integration platform connecting agents to 500+ apps | `subskills/composio.md` |
| **agno** | AgentOS runtime for production multi-agent systems | `subskills/agno.md` |
| **lucid-agents** | Commerce SDK for AI agents with payments | `subskills/lucid-agents.md` |
| **openapi-specification** | API contracts for tool interfaces and integrations | `subskills/openapi-specification.md` |
| **agents** | OpenAI Agents marketplace architecture (91 agents, 65 plugins) | `subskills/agents.md` |

## Quick Selection Guide

### By Use Case

| Need | Sub-Skill |
|------|-----------|
| Multi-agent orchestration | crewai, openai-agents-python, eliza |
| Agent memory/state | letta, mem0 |
| Type-safe Python agents | pydantic-ai, adk-python |
| Workflow automation | n8n, langchain |
| Tool/API integration | composio, openapi-specification |
| Agent-to-agent communication | a2a |
| Claude Code automation | claude-agent-sdk-python |
| RAG + agents | archon |
| Payments/commerce | lucid-agents |

### By Language

| Language | Sub-Skills |
|----------|------------|
| Python | crewai, langchain, pydantic-ai, openai-agents-python, letta, mem0, adk-python, claude-agent-sdk-python |
| TypeScript | eliza, anthropic-sdk-typescript, n8n |
| Protocol/Spec | a2a, openapi-specification |

## How to Use

### Quick Reference
Use the index above to identify the right sub-skill for your task.

### Deep Dive
To load full sub-skill content:
```
Read: plugins/agents/skills/agents-master/subskills/{name}.md
```

### Example Workflow
```
User: "Help me build a multi-agent system with memory"
  ↓
Claude: Identifies need for orchestration + memory
  ↓
Claude: Reads subskills/crewai.md for orchestration patterns
Claude: Reads subskills/mem0.md for memory integration
  ↓
Claude: Provides combined guidance
```

## Sub-Skill Summaries

### Orchestration Frameworks

**crewai** - Role-based multi-agent orchestration. Define agents with roles, goals, backstories. Create tasks with dependencies. Supports sequential/parallel execution.

**openai-agents-python** - Official OpenAI SDK. Multi-agent with handoffs, tool use, guardrails. Provider-agnostic (100+ LLMs).

**eliza** - ElizaOS TypeScript framework. Modular plugin architecture. Character-driven agents.

**langchain** - Composable LLM applications. Chains, agents, tools, retrievers. Extensive integrations.

### Memory Systems

**letta** - MemGPT pattern. Self-editing memory with core/archival/recall. Persistent across sessions.

**mem0** - Automatic fact extraction. Semantic search over memories. Multi-level context (user/session/agent).

### Production Frameworks

**pydantic-ai** - Type-safe with Pydantic validation. Dependency injection. 19+ model providers.

**adk-python** - Google's ADK. Code-first Python. Comprehensive tooling for production.

**archon** - RAG + MCP integration. Multi-model orchestration. Knowledge base management.

### Integration & Protocols

**a2a** - Agent2Agent protocol. Cross-framework discovery and communication. Enterprise-ready.

**composio** - 500+ app integrations. Managed authentication. Production tool platform.

**openapi-specification** - API contract standard. Define tool interfaces. Agent integrations.

### SDKs

**claude-agent-sdk-python** - Control Claude Code programmatically. Hooks, tools, streaming.

**anthropic-sdk-typescript** - Official Claude API SDK. Messages, streaming, tool use, batching.

### Specialized

**n8n** - Visual workflow automation. AI/LangChain nodes. No-code integrations.

**lucid-agents** - Commerce SDK. Payments, transactions for AI agents.

**agno** - AgentOS runtime. Production multi-agent infrastructure.

**agents** - Reference architecture. 91 agents, 57 skills, 65 plugins catalog.
