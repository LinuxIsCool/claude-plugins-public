# Awareness Ecosystem Roadmap

*A deliberate, incremental approach to building self-aware, learning systems.*

## Guiding Principles

1. **Go slow** - Each component fully understood before the next
2. **Separation of concerns** - Each plugin has one clear responsibility
3. **Composability** - Plugins designed to work together, not required to
4. **Avoid over-engineering** - Build what's needed, when it's needed
5. **Data as foundation** - Observation and storage precede intelligence

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    LAYER 5: ACQUISITION                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │  YouTube    │  │    Web      │  │   Document Processing   │  │
│  │ Transcripts │  │   Content   │  │   (PDFs, etc.)          │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    LAYER 4: INTELLIGENCE                        │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    AWARENESS PLUGIN                      │    │
│  │  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌─────────┐  │    │
│  │  │docs-reader│ │guide-util │ │techniques │ │meta-*   │  │    │
│  │  └───────────┘ └───────────┘ └───────────┘ └─────────┘  │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    LAYER 3: CODEBASE INTELLIGENCE               │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                 CODEBASE-INDEX PLUGIN                    │    │
│  │  ┌──────────────────┐  ┌───────────────────────────┐    │    │
│  │  │ Document Vectors │  │   Code Graph              │    │    │
│  │  │ (all files,      │  │   (AST, call graph,       │    │    │
│  │  │  semantic search)│  │    imports, types)        │    │    │
│  │  └──────────────────┘  └───────────────────────────┘    │    │
│  │  Uses: memory plugin for vectors                        │    │
│  │  Uses: knowledge-graph plugin for relationships         │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    LAYER 2: PERSISTENCE                         │
│  ┌─────────────────────────┐  ┌─────────────────────────────┐   │
│  │     MEMORY PLUGIN       │  │   KNOWLEDGE-GRAPH PLUGIN    │   │
│  │  ┌─────────────────┐    │  │  ┌───────────────────────┐  │   │
│  │  │ Vector Storage  │    │  │  │ Temporal Entities     │  │   │
│  │  │ (conversations, │    │  │  │ (what, when, context) │  │   │
│  │  │  documents,     │    │  │  └───────────────────────┘  │   │
│  │  │  embeddings)    │    │  │  ┌───────────────────────┐  │   │
│  │  └─────────────────┘    │  │  │ Relationships         │  │   │
│  │  ┌─────────────────┐    │  │  │ (links, patterns,     │  │   │
│  │  │ Content Store   │    │  │  │  code structure)      │  │   │
│  │  │ (full history,  │    │  │  └───────────────────────┘  │   │
│  │  │  file snapshots)│    │  │  ┌───────────────────────┐  │   │
│  │  └─────────────────┘    │  │  │ Graph Embeddings      │  │   │
│  │                         │  │  │ (node2vec, code2vec)  │  │   │
│  │                         │  │  └───────────────────────┘  │   │
│  └─────────────────────────┘  └─────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    LAYER 1: OBSERVATION                         │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │               LOGGING PLUGIN (exists)                    │    │
│  │  Captures: SessionStart, UserPromptSubmit, PreToolUse,  │    │
│  │           PostToolUse, Stop, SubagentStop, SessionEnd   │    │
│  │  NEW: log_search skill (vector search over logs)        │    │
│  └─────────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │            TIMESTAMP AWARENESS HOOKS                     │    │
│  │  Captures: Temporal context, session boundaries,        │    │
│  │           time between events, durations                │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

---

## Plugin Breakdown

### Layer 1: Observation

#### Logging Plugin (Exists)
- Already captures all hook events
- JSONL storage with markdown reports
- Foundation for everything else

#### Timestamp Awareness (Enhancement to Logging OR Separate)
**Question to consider**: Should this be part of logging or a separate plugin?

**Option A: Enhance Logging**
- Add temporal metadata to existing events
- Calculate durations, time gaps
- Minimal new code

**Option B: Separate Plugin**
- Dedicated temporal analysis
- Could consume logging output
- More modular

**Recommended**: Start with Option A (enhance logging), extract to Option B if it grows complex.

---

### Layer 2: Persistence

#### Memory Plugin (New)

**Responsibility**: Store and retrieve conversational data with semantic search

**Components**:
```
memory/
├── .claude-plugin/plugin.json
├── .mcp.json                    # MCP server for tools
├── src/
│   ├── mcp/
│   │   └── server.ts            # Memory tools
│   ├── storage/
│   │   ├── messages.ts          # Raw message storage
│   │   └── vectors.ts           # Vector embeddings
│   └── retrieval/
│       └── search.ts            # Semantic search
├── hooks/
│   └── capture_messages.py      # Hook to capture on events
└── data/
    ├── messages/                # Raw message storage
    └── vectors/                 # Vector index
```

**MCP Tools**:
- `memory_store` - Store a message/conversation
- `memory_search` - Semantic search over stored content
- `memory_recall` - Retrieve specific conversations
- `memory_context` - Get relevant context for current query

**Vector Storage Options** (start simple):
1. **Phase 1**: JSON + simple embeddings file (no dependencies)
2. **Phase 2**: ChromaDB (local, lightweight)
3. **Phase 3**: Hosted solution if needed

**Hook Integration**:
```python
# On UserPromptSubmit and AssistantResponse
# Capture message, generate embedding, store both
```

---

#### Knowledge-Graph Plugin (New)

**Responsibility**: Track entities, relationships, and temporal patterns

**Components**:
```
knowledge-graph/
├── .claude-plugin/plugin.json
├── .mcp.json
├── src/
│   ├── mcp/
│   │   └── server.ts
│   ├── graph/
│   │   ├── entities.ts          # Entity extraction/storage
│   │   ├── relationships.ts     # Link management
│   │   └── temporal.ts          # Time-based queries
│   └── query/
│       └── traversal.ts         # Graph queries
└── data/
    └── graph.json               # Graph storage (start simple)
```

**MCP Tools**:
- `kg_add_entity` - Add entity with timestamp and context
- `kg_add_relationship` - Link entities
- `kg_query` - Query the graph
- `kg_temporal_query` - "What did we discuss about X in the last week?"
- `kg_patterns` - Discover recurring patterns

**Entity Types**:
- Concepts (ideas, topics)
- Files (code files we've worked on)
- Decisions (choices made)
- Learnings (insights gained)
- Questions (things wondered about)

**Storage Options** (start simple):
1. **Phase 1**: JSON adjacency list (no dependencies)
2. **Phase 2**: SQLite with graph queries
3. **Phase 3**: Neo4j if scale demands

---

### Layer 3: Intelligence

#### Awareness Plugin (Exists, Expand)

**Current Skills**:
- docs-reader
- guide-utilizer
- techniques

**New Meta-Skills to Add**:

##### skill-creator
```yaml
---
name: skill-creator
description: Create new skills for Claude Code. Use when you need to define a new capability, package knowledge into a reusable skill, or extend the awareness system.
allowed-tools: Read, Write, Edit, Glob
---
```

##### agent-creator
```yaml
---
name: agent-creator
description: Create new custom agents/sub-agents. Use when you need specialized AI personalities for specific tasks, or want to define new agent types.
allowed-tools: Read, Write, Edit, Task
---
```

##### plugin-studier
```yaml
---
name: plugin-studier
description: Study and understand plugins in this repository. Use when learning from existing implementations, understanding patterns, or preparing to create new plugins.
allowed-tools: Read, Glob, Grep, Task
---
```

##### resource-studier
```yaml
---
name: resource-studier
description: Study resources and reference materials in this repository. Use when exploring examples, understanding patterns, or learning from documentation.
allowed-tools: Read, Glob, Grep
---
```

---

### Layer 3: Codebase Intelligence

#### Codebase-Index Plugin (New)

**Responsibility**: Hold the entire project in mind through vector search and code graph analysis

This is the "brain" that makes awareness truly aware of the codebase. It builds on memory and knowledge-graph plugins.

**Three Search Modalities**:

```
┌─────────────────────────────────────────────────────────────────┐
│                    CODEBASE-INDEX PLUGIN                        │
├─────────────────────────────────────────────────────────────────┤
│  1. CONVERSATION SEARCH (via logging plugin)                    │
│     "What did we discuss about authentication?"                 │
│     → Searches JSONL logs via log_search skill                  │
├─────────────────────────────────────────────────────────────────┤
│  2. DOCUMENT/CODE SEARCH (via memory plugin)                    │
│     "Find code related to user validation"                      │
│     → Semantic search over all repo files                       │
├─────────────────────────────────────────────────────────────────┤
│  3. STRUCTURAL SEARCH (via knowledge-graph plugin)              │
│     "What calls the authenticate() function?"                   │
│     → Graph traversal over code relationships                   │
└─────────────────────────────────────────────────────────────────┘
```

**Components**:
```
codebase-index/
├── .claude-plugin/plugin.json
├── .mcp.json                    # MCP server
├── src/
│   ├── mcp/
│   │   └── server.ts            # Unified search tools
│   ├── indexer/
│   │   ├── file-scanner.ts      # Walk repo, identify files
│   │   ├── code-parser.ts       # AST parsing (tree-sitter)
│   │   └── embedder.ts          # Generate embeddings
│   ├── graph/
│   │   ├── ast-extractor.ts     # Extract code structure
│   │   ├── call-graph.ts        # Function call relationships
│   │   ├── import-graph.ts      # Module dependencies
│   │   └── type-graph.ts        # Type relationships
│   └── search/
│       ├── semantic.ts          # Vector similarity search
│       ├── structural.ts        # Graph queries
│       └── hybrid.ts            # Combined search
├── hooks/
│   └── index_on_change.py       # Re-index when files change
└── skills/
    └── codebase-search/
        └── SKILL.md             # Skill for searching
```

**MCP Tools**:
- `codebase_search` - Unified semantic + structural search
- `codebase_index` - Trigger indexing
- `codebase_stats` - Show index statistics
- `code_context` - Get relevant context for current work
- `find_related` - Find related code/files
- `call_graph` - Query function call relationships
- `dependency_graph` - Query module dependencies

**Code Graph Structure**:

```
Entity Types:
├── File         (path, type, size, last_modified)
├── Module       (name, exports, imports)
├── Class        (name, methods, properties, extends)
├── Function     (name, params, returns, complexity)
├── Variable     (name, type, scope)
├── Type         (name, definition, usage)
└── Comment      (text, location, references)

Relationship Types:
├── IMPORTS      (Module → Module)
├── EXPORTS      (Module → Symbol)
├── CALLS        (Function → Function)
├── EXTENDS      (Class → Class)
├── IMPLEMENTS   (Class → Interface)
├── USES_TYPE    (Symbol → Type)
├── DEFINED_IN   (Symbol → File)
├── REFERENCES   (Symbol → Symbol)
└── DOCUMENTS    (Comment → Symbol)
```

**Graph Embeddings**:

For structural similarity, we embed the code graph:

1. **Node2Vec** - Learn node embeddings from graph walks
2. **Code2Vec** - Learn from AST paths
3. **GraphSAGE** - Inductive embeddings for new nodes

**Use cases**:
- "Find functions similar to this one" (structural similarity)
- "What code is architecturally related to this module?"
- "Which files tend to change together?"

**Indexing Strategy**:

```
Initial Index (on plugin install):
1. Scan all files in repository
2. Parse code files into AST (using tree-sitter)
3. Extract entities and relationships
4. Generate embeddings for all content
5. Build graph structure

Incremental Update (on file change hook):
1. Detect changed files
2. Re-parse only changed files
3. Update affected relationships
4. Re-generate affected embeddings
5. Update graph indices
```

**Storage Requirements**:

| Data Type | Storage | Size Estimate (10k LOC) |
|-----------|---------|-------------------------|
| File content | memory plugin | ~1MB |
| Embeddings | memory plugin | ~50MB |
| Graph nodes | knowledge-graph | ~1MB |
| Graph edges | knowledge-graph | ~5MB |
| Graph embeddings | knowledge-graph | ~10MB |

---

### Layer 4: Acquisition

#### YouTube Transcripts Plugin (New)

**Responsibility**: Fetch and process YouTube video transcripts

**Components**:
```
youtube-transcripts/
├── .claude-plugin/plugin.json
├── .mcp.json
├── src/
│   ├── mcp/
│   │   └── server.ts
│   └── fetch/
│       └── transcript.ts        # Fetch via API or scraping
└── skills/
    └── video-learner/
        └── SKILL.md             # Skill for learning from videos
```

**MCP Tools**:
- `yt_fetch_transcript` - Get transcript for a video
- `yt_summarize` - Summarize a transcript
- `yt_extract_concepts` - Pull key concepts from video

**Integration with Memory/KG**:
- Store transcripts in memory plugin
- Extract entities to knowledge graph
- Link to temporal context (when watched)

---

## Phased Development Roadmap

### Phase 0: Current State (Complete)
- [x] Awareness plugin with 3 core skills (docs-reader, guide-utilizer, techniques)
- [x] Awareness plugin with 4 meta-skills (skill-creator, agent-creator, plugin-studier, resource-studier)
- [x] Logging plugin capturing events
- [x] Brainstorm plugin for structured thinking
- [x] Schedule.md with MCP patterns

### Phase 1: Log Search Skill (Next - Smallest Step)
**Focus**: Add vector search to logging plugin - proves the pattern with minimal new code

- [ ] Add embedding generation to logging plugin hook
- [ ] Store embeddings alongside JSONL logs
- [ ] Create `log_search` skill in logging plugin
- [ ] Test semantic search over conversation history
- [ ] Document the pattern for reuse

**Why start here**:
- Logging plugin already captures all conversations
- No new plugin needed
- Proves vector search pattern before building memory plugin
- Immediate value: "What did we discuss about X?"

### Phase 2: Timestamp Awareness
**Focus**: Temporal context without new plugin complexity

- [ ] Enhance logging plugin with temporal metadata
- [ ] Add duration tracking between events
- [ ] Add session boundary awareness
- [ ] Create temporal query capabilities
- [ ] Evaluate if separate plugin is needed

### Phase 3: Memory Plugin (General Vector Storage)
**Focus**: Reusable vector storage that multiple plugins can use

- [ ] Design storage interface (abstractions for different backends)
- [ ] Implement JSON + numpy backend (zero dependencies)
- [ ] Create embedding generation service
- [ ] Build semantic search API
- [ ] Create MCP server with tools
- [ ] Migrate logging search to use memory plugin
- [ ] Test with documents and code files

**Storage evolution**:
1. JSON files + numpy (start here)
2. ChromaDB (when needed)
3. Hosted solution (if scale demands)

### Phase 4: Knowledge Graph Plugin (Relationship Storage)
**Focus**: General-purpose graph that codebase-index will build on

- [ ] Design entity and relationship model (see Code Graph Structure above)
- [ ] Implement JSON adjacency list storage
- [ ] Build graph query API
- [ ] Add temporal indexing for time-based queries
- [ ] Create graph embedding support (node2vec)
- [ ] Create MCP server with tools
- [ ] Test with conversation entities

**Graph embedding approach**:
1. Start with simple adjacency-based embeddings
2. Add node2vec for path-based similarity
3. Consider GraphSAGE for inductive learning

### Phase 5: Codebase Index Plugin (Intelligence Layer)
**Focus**: The "hold the entire project in mind" capability

- [ ] Implement file scanner and watcher
- [ ] Add tree-sitter for AST parsing
- [ ] Extract code entities to knowledge graph
- [ ] Generate embeddings for all code via memory plugin
- [ ] Build call graph analysis
- [ ] Build import/dependency graph
- [ ] Create unified search (semantic + structural)
- [ ] Add incremental indexing on file changes
- [ ] Create `codebase_search` MCP tool
- [ ] Create `codebase-search` skill

**This is the big one** - depends on memory + knowledge-graph being solid

### Phase 6: Integration & Refinement
**Focus**: All plugins working together smoothly

- [ ] Awareness queries logging for conversation history
- [ ] Awareness queries memory for semantic search
- [ ] Awareness queries knowledge graph for relationships
- [ ] Awareness uses codebase-index for code understanding
- [ ] Create unified query interface
- [ ] Performance optimization
- [ ] Document integration patterns

### Phase 7: Acquisition Plugins
**Focus**: Bringing in external knowledge

- [ ] YouTube transcripts plugin
- [ ] Integration with memory/KG
- [ ] Other sources as needed (PDFs, web content, etc.)

---

## Key Decisions to Make

### Decision 1: Vector Storage
**Options**:
1. JSON + numpy (zero dependencies, limited scale)
2. ChromaDB (lightweight, local, good for prototyping)
3. Qdrant/Pinecone (hosted, scalable, more complex)

**Recommendation**: Start with #1 or #2, migrate if needed.

### Decision 2: Graph Storage
**Options**:
1. JSON adjacency list (simple, portable)
2. SQLite with graph queries (more powerful, still local)
3. Neo4j (full graph DB, significant complexity)

**Recommendation**: Start with #1, consider #2 for complex queries.

### Decision 3: Hook Coordination
**Question**: How do multiple plugins respond to the same hooks?

**Options**:
1. Each plugin has own hook handlers (parallel)
2. Central hook dispatcher that routes to plugins
3. Plugin chain where output flows through

**Recommendation**: Start with #1 (simplest), monitor for conflicts.

### Decision 4: Embedding Model
**Options**:
1. Claude via API (consistent, cost per call)
2. Local model (sentence-transformers, free but requires setup)
3. Hosted embedding API (OpenAI, Cohere, etc.)

**Recommendation**: Start with local model for cost-efficiency.

---

## Questions to Contemplate

1. **How much memory is useful?** Not all conversations need storing. What criteria determines what's worth remembering?

2. **Entity granularity**: How fine-grained should knowledge graph entities be? Too coarse loses detail, too fine creates noise.

3. **Temporal decay**: Should older memories/entities be weighted less? Or is all history equally valuable?

4. **Cross-session continuity**: How do we maintain coherence across sessions while respecting context limits?

5. **Privacy/Security**: What should never be stored? How do we handle sensitive information?

6. **Plugin boundaries**: When does a skill belong in awareness vs. a separate plugin?

---

## Anti-Patterns to Avoid

1. **Building before understanding** - Don't create memory plugin until we've deeply used logging
2. **Premature optimization** - JSON files before databases
3. **Feature creep** - Each plugin does one thing well
4. **Coupling** - Plugins should work independently, integration is optional
5. **Complexity for complexity's sake** - Simple solutions first

---

## Success Metrics

For each phase, we should be able to answer:

1. **Does it work?** - Basic functionality achieved
2. **Is it useful?** - Actually improves workflows
3. **Is it simple?** - Understandable, maintainable
4. **Is it composable?** - Works with other plugins
5. **Did we learn?** - Understanding deepened

---

*This roadmap is a living document. Update as understanding grows.*
