# Purpose

Document the journey of designing embeddings for Claude Code JSONL logs. This cookbook captures lessons learned from analyzing December 8, 2025 - the first day of logged sessions in this repository (18 sessions, 782 events, 1.6MB).

## Variables

TARGET_CORPUS: Claude Code JSONL logs
CORPUS_DATE: 2025-12-08
TOTAL_SESSIONS: 18
TOTAL_EVENTS: 782
RECOMMENDED_MODEL: all-MiniLM-L6-v2
ALTERNATIVE_MODEL: BGE-M3
OPTIMAL_DIMENSIONS: 384 (MiniLM) or 1024 (BGE-M3)
MAX_CHUNK_SIZE: 512 tokens

## Log Structure Analysis

### Event Type Distribution

| Event Type | Count | % of Total | Embedding Value |
|------------|-------|------------|-----------------|
| PreToolUse | 275 | 35.2% | Medium - tool intent |
| PostToolUse | 273 | 34.9% | High - tool results |
| SubagentStop | 53 | 6.8% | High - agent summaries |
| UserPromptSubmit | 40 | 5.1% | Highest - user intent |
| Stop | 40 | 5.1% | Low - metadata only |
| Notification | 40 | 5.1% | Low - system noise |
| AssistantResponse | 29 | 3.7% | Highest - Claude output |
| SessionStart | 18 | 2.3% | Low - metadata only |
| SessionEnd | 14 | 1.8% | Low - metadata only |

### Tool Usage Patterns

| Tool | Count | Content Type |
|------|-------|--------------|
| Read | 77 | File paths, code content |
| Bash | 76 | Commands, stdout/stderr |
| Grep | 51 | Search patterns, file matches |
| Glob | 37 | File patterns, directory trees |
| Task | 17 | Subagent prompts + responses |
| WebSearch | 9 | Queries, summaries |

## Lessons Learned

### Lesson 1: Structured Data Requires Text Extraction

JSONL log events are structured objects with nested data. Embedding raw JSON wastes tokens on syntax and field names.

**Problem:**
```json
{"ts": "2025-12-08T17:14:40.518426", "type": "UserPromptSubmit", "session_id": "35f45aae-fd4d-44dc-9c15-9b25feaa1397", "data": {"session_id": "35f45aae-fd4d-44dc-9c15-9b25feaa1397", "transcript_path": "/home/user/path", "cwd": "/home/user/path", "permission_mode": "bypassPermissions", "hook_event_name": "UserPromptSubmit", "prompt": "hello"}}
```

**Solution - Extract semantic content:**
```python
def extract_embeddable_text(event: dict) -> str:
    """Extract text worth embedding from a log event."""
    event_type = event.get("type", "")
    data = event.get("data", {})

    if event_type == "UserPromptSubmit":
        return f"User: {data.get('prompt', '')}"

    elif event_type == "AssistantResponse":
        return f"Claude: {data.get('response', '')}"

    elif event_type == "PreToolUse":
        tool = data.get("tool_name", "")
        inp = data.get("tool_input", {})
        preview = extract_preview(inp)
        return f"Tool call: {tool} - {preview}"

    elif event_type == "PostToolUse":
        tool = data.get("tool_name", "")
        response = data.get("tool_response", {})
        return f"Tool result: {tool} - {summarize_response(response)}"

    elif event_type == "SubagentStop":
        agent_id = data.get("agent_id", "")
        return f"Subagent {agent_id} completed"

    return ""  # Skip low-value events
```

### Lesson 2: Event Types Have Vastly Different Semantic Density

Not all events deserve equal embedding investment.

**High-value events (embed fully):**
- `UserPromptSubmit`: User intent - the query they want answered
- `AssistantResponse`: Claude's output - the answer provided
- `SubagentStop` with response: Agent work summaries

**Medium-value events (embed with context):**
- `PreToolUse`: What Claude intends to do
- `PostToolUse`: What tools returned (may need summarization)

**Low-value events (skip or minimal embedding):**
- `SessionStart`, `SessionEnd`: Metadata only
- `Notification`: System messages ("Claude is waiting for input")
- `Stop`: Marks conversation boundaries, no semantic content

### Lesson 3: Tool Responses Can Be Massive

`PostToolUse` events can contain entire file contents, directory trees, or command outputs that exceed model token limits.

**Example from logs - Glob result with 57 files:**
```json
{"tool_response": {"filenames": ["/path/to/file1.py", "/path/to/file2.py", ...], "durationMs": 294, "numFiles": 57}}
```

**Example from logs - Read result with full file:**
```json
{"tool_response": {"type": "text", "file": {"content": "#!/usr/bin/env python\n...[267 lines]...", "numLines": 267}}}
```

**Chunking Strategy for Tool Responses:**

```python
def prepare_tool_response_for_embedding(response: dict, max_tokens: int = 512) -> list[str]:
    """Break large tool responses into embeddable chunks."""
    chunks = []

    if "filenames" in response:
        # File listing - embed patterns, not full paths
        files = response["filenames"]
        summary = f"Found {len(files)} files"
        patterns = extract_file_patterns(files)  # e.g., "hooks/*.py", "utils/*.ts"
        chunks.append(f"{summary}: {', '.join(patterns)}")

    elif "content" in response.get("file", {}):
        # File content - use semantic chunking
        content = response["file"]["content"]
        chunks = semantic_chunk(content, max_tokens)

    elif "stdout" in response:
        # Command output - summarize or truncate
        stdout = response["stdout"]
        if len(stdout) > max_tokens * 4:  # Rough char estimate
            chunks.append(summarize_output(stdout))
        else:
            chunks.append(f"Output: {stdout}")

    return chunks
```

### Lesson 4: Temporal Context Matters for Retrieval

Log events form conversations. Searching for "how did Claude fix the bug?" requires understanding the exchange sequence: prompt -> tools -> response.

**Pattern: Embed Exchanges, Not Individual Events**

```python
def group_into_exchanges(events: list[dict]) -> list[dict]:
    """Group events into prompt->response exchanges."""
    exchanges = []
    current = None

    for event in events:
        event_type = event["type"]

        if event_type == "UserPromptSubmit":
            if current:
                exchanges.append(current)
            current = {
                "prompt": event["data"].get("prompt", ""),
                "tools": [],
                "response": None,
                "timestamp": event["ts"]
            }

        elif event_type in ("PreToolUse", "PostToolUse") and current:
            current["tools"].append(event)

        elif event_type == "AssistantResponse" and current:
            current["response"] = event["data"].get("response", "")

    if current:
        exchanges.append(current)

    return exchanges

def embed_exchange(exchange: dict) -> str:
    """Create embeddable text from an exchange."""
    parts = [f"User: {exchange['prompt']}"]

    if exchange["tools"]:
        tool_summary = summarize_tools(exchange["tools"])
        parts.append(f"Actions: {tool_summary}")

    if exchange["response"]:
        parts.append(f"Claude: {exchange['response']}")

    return "\n".join(parts)
```

### Lesson 5: Subagent Transcripts Are Gold Mines

`SubagentStop` events reference transcript paths containing full subagent conversations. The December 8 logs show subagents performing:
- File discovery (`Glob **/*.py`)
- Code research with `Read`, `Grep`
- Web searches for documentation
- Multi-step analysis tasks

**Pattern: Extract and Embed Subagent Summaries**

```python
def extract_subagent_summary(event: dict) -> str:
    """Extract subagent work summary from transcript."""
    data = event.get("data", {})
    transcript_path = data.get("agent_transcript_path", "")
    agent_id = data.get("agent_id", "")

    if not transcript_path:
        return f"Subagent {agent_id} completed (no transcript)"

    # Parse transcript for final response
    summary = parse_subagent_transcript(transcript_path)

    return f"Subagent {agent_id}: {summary}"
```

## Model Recommendations for Log Embeddings

### Recommended: all-MiniLM-L6-v2

| Factor | Assessment |
|--------|------------|
| Quality | Sufficient for log retrieval (MTEB ~56) |
| Speed | 20ms CPU, 2ms GPU - fast enough for real-time indexing |
| Size | 44MB - deployable anywhere |
| Dimensions | 384 - 1.5KB per embedding, manageable storage |

**Best for:**
- Real-time session indexing
- Local/CPU-only deployments
- Development and testing

### Alternative: BGE-M3

| Factor | Assessment |
|--------|------------|
| Quality | Higher retrieval accuracy (MTEB ~63) |
| Speed | 50ms CPU, 5ms GPU |
| Size | 500MB+ |
| Dimensions | 1024 - 4KB per embedding |

**Best for:**
- Complex semantic queries ("What was discussed about plugin hot reloading?")
- Multi-hop retrieval across sessions
- Production with GPU resources

### Not Recommended for Logs: Large Models (4096 dims)

Models like NV-Embed-v2 or Qwen3-8B are overkill for log retrieval:
- Log text is relatively simple (prompts, responses, paths)
- No multilingual requirements (logs are English)
- 4096 dimensions = 16KB per embedding = 12MB per 782-event day

## Dimension Tradeoffs for Log Corpus

### Storage Calculations

For December 8 (782 events, ~500 worth embedding):

| Model | Dims | Per Event | Day Total | Year Estimate |
|-------|------|-----------|-----------|---------------|
| MiniLM | 384 | 1.5KB | 750KB | 274MB |
| BGE-M3 | 1024 | 4KB | 2MB | 730MB |
| NV-Embed | 4096 | 16KB | 8MB | 2.9GB |

**Recommendation:** 384 dimensions are sufficient. Logs are not the same as academic papers or code - the semantic distinctions needed are less nuanced.

### Quality vs Retrieval Speed

| Dimension | Cosine Similarity Computation | Notes |
|-----------|------------------------------|-------|
| 384 | 384 multiply-adds | Trivial, even in pure Python |
| 1024 | 1024 multiply-adds | Still fast, ~2.7x slower |
| 4096 | 4096 multiply-adds | Noticeable, ~10.7x slower |

For a log corpus, even with 10,000 events, 384-dim search is effectively instant.

## Text Preparation Examples

### Example 1: UserPromptSubmit

**Raw event:**
```json
{"ts": "2025-12-08T17:54:45.369815", "type": "UserPromptSubmit", "data": {"prompt": "Can you have 5 parallel subagents research how to achieve hot reloading with plugins?"}}
```

**Embedded text:**
```
User: Can you have 5 parallel subagents research how to achieve hot reloading with plugins?
```

### Example 2: PreToolUse (Task)

**Raw event:**
```json
{"type": "PreToolUse", "data": {"tool_name": "Task", "tool_input": {"description": "Research plugin command implementation", "prompt": "Find and analyze the /plugin command implementation...", "subagent_type": "Explore", "model": "sonnet"}}}
```

**Embedded text:**
```
Tool: Task (Explore/sonnet) - Research plugin command implementation: Find and analyze the /plugin command implementation...
```

### Example 3: PostToolUse (Read)

**Raw event:**
```json
{"type": "PostToolUse", "data": {"tool_name": "Read", "tool_input": {"file_path": "/home/user/path"}, "tool_response": {"file": {"content": "#!/usr/bin/env python\n...[267 lines]...", "numLines": 267}}}}
```

**Embedded text (with chunking):**
```
Read: log_event.py (267 lines) - Python logging hook for Claude Code sessions. Key functions: get_paths(), get_response(), generate_markdown(). Handles JSONL event logging and Markdown report generation.
```

### Example 4: AssistantResponse

**Raw event:**
```json
{"type": "AssistantResponse", "data": {"response": "Done! The subagent used the **Glob tool** to search for `*.py` files and found **67 Python files** across the repository..."}}
```

**Embedded text:**
```
Claude: Done! The subagent used the Glob tool to search for *.py files and found 67 Python files across the repository...
```

### Example 5: Exchange (Aggregated)

**Multiple events combined:**
```
User: Testing subagent functionality
Tools: Task (general-purpose) -> Subagent dcacee1c completed
Claude: Subagent test completed successfully. The general-purpose subagent confirmed: Agent type: Subagent for code search/analysis, Tools: Read, Grep, Glob, Edit...
```

## Chunking Strategy for Long Content

### Code Files (from Read tool)

```python
def chunk_code_for_embedding(content: str, max_tokens: int = 512) -> list[str]:
    """Semantic chunking for code files."""
    chunks = []

    # Split by major structural elements
    sections = split_by_functions_and_classes(content)

    current_chunk = []
    current_size = 0

    for section in sections:
        section_size = estimate_tokens(section)

        if current_size + section_size > max_tokens:
            if current_chunk:
                chunks.append("\n".join(current_chunk))
            current_chunk = [section]
            current_size = section_size
        else:
            current_chunk.append(section)
            current_size += section_size

    if current_chunk:
        chunks.append("\n".join(current_chunk))

    return chunks
```

### Tool Output (from Bash)

```python
def chunk_bash_output(stdout: str, max_tokens: int = 512) -> list[str]:
    """Chunk command output by lines."""
    lines = stdout.split("\n")
    chunks = []
    current = []
    current_size = 0

    for line in lines:
        line_size = estimate_tokens(line)
        if current_size + line_size > max_tokens:
            chunks.append("\n".join(current))
            current = [line]
            current_size = line_size
        else:
            current.append(line)
            current_size += line_size

    if current:
        chunks.append("\n".join(current))

    return chunks
```

## Tips and Tricks

### Tip 1: Pre-filter Before Embedding

Save compute by filtering out noise events before embedding.

```python
SKIP_TYPES = {"Notification", "Stop", "SessionStart", "SessionEnd"}

def should_embed(event: dict) -> bool:
    if event["type"] in SKIP_TYPES:
        return False
    if event["type"] == "Notification" and "waiting for your input" in event.get("data", {}).get("message", ""):
        return False
    return True
```

### Tip 2: Add Metadata as Prefix

Include event type and timestamp in embedded text for context.

```python
def prepare_with_metadata(event: dict) -> str:
    ts = event["ts"][:19].replace("T", " ")
    event_type = event["type"]
    content = extract_content(event)
    return f"[{ts}] [{event_type}] {content}"
```

### Tip 3: Batch Embedding for Efficiency

Log indexing is typically offline - use batch processing.

```python
from sentence_transformers import SentenceTransformer

model = SentenceTransformer('all-MiniLM-L6-v2')

# Collect all texts first
texts = [extract_embeddable_text(e) for e in events if should_embed(e)]

# Embed in batches (32 is optimal for most systems)
embeddings = model.encode(
    texts,
    batch_size=32,
    show_progress_bar=True,
    convert_to_numpy=True
)
```

### Tip 4: Index Session Summaries Separately

Create session-level embeddings for high-level search.

```python
def create_session_summary(session_events: list[dict]) -> str:
    """Create a session summary for embedding."""
    prompts = [e["data"]["prompt"] for e in session_events if e["type"] == "UserPromptSubmit"]
    tools_used = Counter()
    for e in session_events:
        if e["type"] == "PostToolUse":
            tools_used[e["data"]["tool_name"]] += 1

    return f"""Session summary:
Topics: {'; '.join(prompts[:3])}...
Tools: {', '.join(f'{t}({c})' for t, c in tools_used.most_common(5))}
Events: {len(session_events)}"""
```

### Tip 5: Use Matryoshka for Flexible Search

MiniLM supports dimension truncation. Index at 384, search at 128 for speed.

```python
# Index with full dimensions
embeddings_384 = model.encode(texts)

# For fast initial search, truncate
embeddings_128 = embeddings_384[:, :128]

# Coarse search with 128 dims
candidates = cosine_search(query_128, embeddings_128, k=100)

# Re-rank with full 384 dims
final_results = cosine_search(query_384, embeddings_384[candidates], k=10)
```

## Playbook: End-to-End Log Embedding Pipeline

### Step 1: Load and Parse JSONL

```python
import json
from pathlib import Path

def load_session_logs(log_dir: Path) -> list[dict]:
    """Load all JSONL files from a log directory."""
    events = []
    for jsonl_file in sorted(log_dir.glob("*.jsonl")):
        with open(jsonl_file) as f:
            for line in f:
                if line.strip():
                    events.append(json.loads(line))
    return events
```

### Step 2: Extract Embeddable Content

```python
def extract_all_content(events: list[dict]) -> list[tuple[dict, str]]:
    """Extract embeddable text from events."""
    results = []
    for event in events:
        if not should_embed(event):
            continue
        text = extract_embeddable_text(event)
        if text:
            results.append((event, text))
    return results
```

### Step 3: Generate Embeddings

```python
from sentence_transformers import SentenceTransformer
import numpy as np

def embed_logs(event_text_pairs: list[tuple[dict, str]]) -> tuple[list[dict], np.ndarray]:
    """Generate embeddings for log content."""
    model = SentenceTransformer('all-MiniLM-L6-v2')

    events = [pair[0] for pair in event_text_pairs]
    texts = [pair[1] for pair in event_text_pairs]

    embeddings = model.encode(texts, batch_size=32, show_progress_bar=True)

    return events, embeddings
```

### Step 4: Store in Vector Database

```python
import chromadb
from chromadb.utils.embedding_functions import SentenceTransformerEmbeddingFunction

def store_in_chroma(events: list[dict], embeddings: np.ndarray, collection_name: str = "claude_logs"):
    """Store log embeddings in ChromaDB."""
    ef = SentenceTransformerEmbeddingFunction(model_name="all-MiniLM-L6-v2")

    client = chromadb.PersistentClient(path="./.chroma_logs")
    collection = client.get_or_create_collection(name=collection_name, embedding_function=ef)

    # Prepare metadata
    ids = [f"{e['session_id'][:8]}_{e['ts']}" for e in events]
    metadatas = [
        {
            "type": e["type"],
            "session_id": e["session_id"],
            "timestamp": e["ts"]
        }
        for e in events
    ]
    documents = [extract_embeddable_text(e) for e in events]

    # Add to collection
    collection.add(
        ids=ids,
        embeddings=embeddings.tolist(),
        metadatas=metadatas,
        documents=documents
    )

    return collection
```

### Step 5: Query Logs Semantically

```python
def search_logs(query: str, collection, n_results: int = 5) -> list[dict]:
    """Semantic search over log embeddings."""
    results = collection.query(
        query_texts=[query],
        n_results=n_results,
        include=["documents", "metadatas", "distances"]
    )

    return [
        {
            "text": doc,
            "metadata": meta,
            "similarity": 1 - dist  # ChromaDB returns distance, not similarity
        }
        for doc, meta, dist in zip(
            results["documents"][0],
            results["metadatas"][0],
            results["distances"][0]
        )
    ]

# Example queries
search_logs("plugin hot reloading", collection)
search_logs("subagent file search", collection)
search_logs("Python files in repository", collection)
```

## Story: The December 8 Corpus

December 8, 2025 represents the first day of Claude Code logging in this repository. The 18 sessions capture:

- **Session 0f78bdd7** (15:11): First session, simple testing
- **Session b7ebc124** (15:28): Plugin development testing
- **Session 17-14-35** (17:14): Testing logging with tool usage
- **Session 0143495c** (17:48): Complex multi-subagent research on hot reloading
- **Session 6701e294** (18:37): Subagent testing with haiku model

The richest session (17-48-29-0143495c) contains 452 events, including 5 parallel subagents researching:
1. Plugin command implementation
2. File watcher hook approaches
3. Claude Code hooks system
4. Python hot reload techniques
5. Claude Code settings/config

This single session demonstrates why embedding strategy matters: the semantic content varies from simple greetings ("Hello") to complex multi-paragraph research summaries about inotify, importlib.reload(), and VS Code extension patterns.

## Next Steps

- **Real-time indexing**: See `cookbook/batch-processing.md` for stream processing
- **Hybrid search**: Combine embeddings with keyword search on tool names
- **Cross-session retrieval**: Build session graphs using subagent relationships
- **Temporal queries**: "What did we discuss about X last week?"
