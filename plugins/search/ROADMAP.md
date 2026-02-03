# Search Plugin Roadmap

## Vision

Transform Claude Code into a context-aware assistant that automatically retrieves relevant repository knowledge before responding, dramatically improving accuracy for codebase-specific questions.

## Philosophy

**Iterate before automating.** We develop deep understanding of retrieval quality through manual experimentation with the test harness. Only after we've validated what works do we wire it into Claude Code's hook system. Premature automation locks in suboptimal choices.

```
Understand → Experiment → Measure → Refine → ... → Automate
```

---

## Current State (Phase 0) ✓

**Completed:**
- RAG infrastructure with Protocol interfaces (`tools/rag/`)
- Test harness for iterating retrieval quality (`tools/rag_test.py`)
- Chunker (recursive, code-aware), Embedder (Ollama), Retriever (vector + hybrid)
- File-based index storage (JSONL + npz)
- Plugin skeleton with Navigator persona and documentation

**Validated:**
- 768-dim embeddings via nomic-embed-text (local, free)
- Hybrid search (BM25 + vector with RRF) outperforms pure vector
- Real user prompts can be sampled from `.claude/logging/` for testing

**Current Workflow:**
```bash
# 1. Index a repository
uv run rag_test.py index --path /repo --glob "**/*.py,**/*.md"

# 2. Test with real prompts from your Claude Code history
uv run rag_test.py sample --logs-dir .claude/logging --count 10 --hybrid

# 3. Examine results, adjust parameters, repeat
```

---

## Phase 1: Retrieval Quality

**Goal:** Improve precision and recall through advanced techniques.

### 1.1 Contextual Chunking (Anthropic technique)
Prepend context to each chunk before embedding:
```
"This chunk is from {file_path}, a {file_type} file in the {directory} directory.
The file {brief_description_from_first_lines}.

{chunk_content}"
```

Expected improvement: ~67% reduction in retrieval failures (per Anthropic research).

### 1.2 Reranking
Add lightweight reranker as second-stage filter:
```python
class Reranker(Protocol):
    def rerank(self, query: str, results: list[SearchResult], k: int) -> list[SearchResult]: ...
```

Options:
- Cross-encoder reranking (more accurate, slower)
- LLM-based reranking (use haiku for cheap verification)
- Cohere rerank API (if external calls acceptable)

### 1.3 Query Expansion
Expand user query before retrieval:
- Synonym expansion for technical terms
- Code symbol extraction (class names, function names)
- Intent classification (question type → retrieval strategy)

### 1.4 Evaluation Framework
```bash
# Compare retrieval strategies
uv run rag_test.py eval --baseline vector --candidate hybrid --prompts 100
```

Metrics:
- Precision@k, Recall@k, MRR (Mean Reciprocal Rank)
- Human relevance judgments (sample-based)

**Deliverables:**
- [ ] Contextual chunking implementation
- [ ] Reranker protocol + at least one implementation
- [ ] Evaluation command with metrics

---

## Phase 2: Index Intelligence

**Goal:** Smarter indexing that adapts to repository structure.

### 2.1 Semantic Chunking
For code files, use AST-aware chunking:
```python
class SemanticChunker:
    """Chunk by code structure: classes, functions, methods."""

    def chunk(self, document: Document) -> list[Chunk]:
        # Parse AST
        # Extract: class definitions, function definitions, docstrings
        # Preserve parent context (class name for methods)
```

### 2.2 Incremental Updates
```python
class IncrementalIndex:
    def update(self, changed_files: list[Path]) -> IndexDelta:
        """Re-embed only changed files, update index in-place."""
```

Trigger options:
- Git hook (post-commit)
- File watcher (background daemon)
- Manual command

### 2.3 Multi-Source Indexing
```yaml
sources:
  - type: repository
    path: .
    patterns: ["**/*.py"]

  - type: documentation
    path: ./docs
    patterns: ["**/*.md"]
    weight: 1.5  # Boost documentation matches

  - type: external
    url: https://docs.example.com
    refresh: weekly
```

### 2.4 Index Compression
For large repositories:
- Product quantization for embedding compression
- Approximate nearest neighbor (HNSW) for faster search
- Tiered storage (hot/warm/cold chunks)

**Deliverables:**
- [ ] Semantic chunking for Python/TypeScript
- [ ] Incremental index updates
- [ ] Multi-source configuration
- [ ] Scalability to 100k+ chunks

---

## Phase 3: Advanced Retrieval

**Goal:** Cutting-edge retrieval capabilities.

### 3.1 Agentic RAG (Multi-Hop)
Multi-hop retrieval with reasoning:
```
Query: "How does authentication connect to the database?"

Step 1: Retrieve auth-related chunks → find auth.py
Step 2: Extract: "uses UserRepository"
Step 3: Retrieve UserRepository → find database patterns
Step 4: Synthesize answer from both retrievals
```

### 3.2 Knowledge Graph Hybrid
Combine vector search with structured graph queries:
```
Vector: semantic similarity
Graph: explicit relationships (imports, calls, inherits)
Fusion: weighted combination based on query type
```

Integration with knowledge-graphs plugin (Graphiti, FalkorDB).

### 3.3 Conversation-Aware Indexing
Index the current conversation for long sessions:
- Recent tool outputs (file reads, bash results)
- Key decisions and context established
- Allow "recall" queries: "what did we decide about X?"

### 3.4 Adaptive Retrieval
Learn from usage patterns:
- Which retrievals led to successful task completion?
- Which chunks are frequently retrieved together?
- User feedback signals (explicit thumbs up/down, implicit via follow-ups)

### 3.5 Cross-Repository Search
For monorepos or multi-project workspaces:
```
/search "error handling" --scope all-repos
/search "error handling" --scope current-repo
/search "error handling" --scope packages/core
```

**Deliverables:**
- [ ] Multi-hop retrieval prototype
- [ ] Graph-vector hybrid search
- [ ] Conversation indexing
- [ ] Usage analytics and adaptation
- [ ] Multi-repository support

---

## Phase 4: On-Demand Search Tools

**Goal:** Give Claude active search capabilities it can invoke when needed.

*This is different from passive hooks - Claude decides when to search based on task context.*

### 4.1 Search Skill
Skill that Claude invokes via the Skill tool:
```markdown
# skills/search-master/SKILL.md
---
name: search
description: Semantic search across indexed repository. Use when exploring
             unfamiliar code, answering "where is X?", or gathering context.
allowed-tools: Read, Bash
---

Invoke me to search the repository semantically...
```

Usage pattern:
```
User: "Where does error handling happen in this codebase?"
Claude: [invokes search skill] → gets semantic results
Claude: [uses results to guide exploration]
```

### 4.2 Navigator Subagent
Specialized search agent via Task tool:
```markdown
# agents/navigator.md
---
name: navigator
description: Deep semantic search agent. Spawns for complex multi-hop
             queries requiring reasoning about search results.
tools: Read, Grep, Glob, Bash
model: haiku  # Fast, cheap for search tasks
---
```

Usage pattern:
```
Claude: [spawns navigator agent] "Find how auth connects to database"
Navigator: [multi-hop search] → returns synthesized findings
Claude: [continues with detailed context]
```

### 4.3 Search Commands
User-facing slash commands:
```
/search "query"              # Semantic search, show results
/search index                # Build/rebuild index
/search index --status       # Show index health
/search related <file>       # Find semantically related files
```

### 4.4 MCP Server (Optional)
Expose search as MCP tools for IDE integration:
```json
{
  "tools": [
    {"name": "semantic_search", "description": "Search indexed repository"},
    {"name": "find_related", "description": "Find related code"},
    {"name": "index_status", "description": "Check index health"}
  ]
}
```

### 4.5 Agent Coordination
The Navigator coordinates with other plugin agents:
```
EXPLORER discovers → Navigator indexes discoveries
ARCHIVIST remembers → Navigator searches memories
WEAVER structures → Navigator queries the graph
```

**Deliverables:**
- [ ] Search skill that Claude can invoke
- [ ] Navigator subagent for complex queries
- [ ] `/search` command family
- [ ] Per-project configuration via `.claude/search.local.md`
- [ ] Optional MCP server for IDE integration

---

## Phase 5: Automatic Context (Optional)

**Goal:** Passive context injection via hooks - only after on-demand tools prove value.

*This phase is optional. On-demand tools (Phase 4) may be sufficient.*

### 5.1 UserPromptSubmit Hook
```
hooks/
└── context-injection.md    # Prompt-based hook
```

Hook workflow:
1. Intercept `UserPromptSubmit` event
2. If index exists → retrieve top-k chunks for user's prompt
3. Inject as `<retrieved-context>` block before prompt reaches Claude
4. Track injection in hook response for observability

### 5.2 Prompt Caching Optimization
Leverage Claude's prompt caching for retrieved context:
```
┌─────────────────────────────────────────────┐
│ System prompt (cached)                      │
├─────────────────────────────────────────────┤
│ Retrieved context (cached if stable)        │  ← Cache this
├─────────────────────────────────────────────┤
│ Conversation history                        │
├─────────────────────────────────────────────┤
│ Current user prompt                         │
└─────────────────────────────────────────────┘
```

### 5.3 Tool-Aware Retrieval
Retrieve context relevant to tool usage:
```
PreToolUse:Read → retrieve related files
PreToolUse:Edit → retrieve patterns from similar edits
```

**Deliverables:**
- [ ] Working hook that injects context
- [ ] Prompt caching integration
- [ ] PreToolUse context injection

---

## Implementation Priority

```
Phase 1 (Retrieval Quality)    ████████░░  HIGH - foundation for everything
Phase 2 (Index Intelligence)   ██████░░░░  HIGH - scalability & precision
Phase 3 (Advanced Retrieval)   ████░░░░░░  MEDIUM - cutting-edge features
Phase 4 (On-Demand Tools)      ████░░░░░░  MEDIUM - skills, agents, commands
Phase 5 (Automatic Context)    ░░░░░░░░░░  OPTIONAL - hooks if needed
```

**Recommended Iteration Loop:**
```
1. Experiment with test harness (Phase 0)
2. Measure retrieval quality on real prompts
3. Identify weaknesses (wrong chunks, missing context)
4. Implement targeted improvement (Phases 1-3)
5. Measure again
6. Repeat until quality threshold met
7. Build skills/agents/commands for on-demand use (Phase 4)
8. Evaluate: is automatic injection even needed? (Phase 5)
```

**Key Insight:** On-demand tools (Phase 4) may obviate the need for automatic context injection (Phase 5). Claude can learn when to invoke search, just as it learns when to use Grep or Glob.

---

## Success Metrics

| Metric | Baseline | Target |
|--------|----------|--------|
| Retrieval relevance (human judged) | - | >80% |
| Context injection latency | - | <500ms |
| Index build time (10k files) | - | <5min |
| Storage overhead | - | <50MB per 10k chunks |
| Cache hit rate (prompt caching) | - | >60% |

---

## Dependencies

- **Ollama**: Local embeddings (nomic-embed-text)
- **NumPy**: Vector operations
- **httpx**: Ollama API calls
- **Claude Code hooks**: UserPromptSubmit, PreToolUse events (Phase 4 only)

Optional:
- **FalkorDB**: Graph-vector hybrid (Phase 3)
- **Cohere API**: Reranking (Phase 1)

---

## References

- [Anthropic: Contextual Retrieval](https://www.anthropic.com/engineering/contextual-retrieval)
- [Recursive Retrieval Strategies](https://medium.com/enterprise-rag/advanced-rag-and-the-3-types-of-recursive-retrieval-cdd0fa52e1ba)
- [Claude Code Hooks Documentation](https://docs.anthropic.com/claude-code/hooks)
- [Prompt Caching](https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching)
