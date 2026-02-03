# Message Search Sub-Skill

Full-text search and filtering across all messages.

## Search Architecture

The messages plugin uses **SQLite FTS5** (Full-Text Search 5) for fast, ranked search results.

### Index Location
```
.claude/messages/search/index.db
```

### What Gets Indexed
- Message content (full text)
- Author name
- Platform
- Kind (message type)
- Thread ID
- Timestamps

## Search via CLI

### Basic Search
```bash
bun plugins/messages/src/cli.ts search "authentication"
```

### With Platform Filter
```bash
bun plugins/messages/src/cli.ts search "meeting" -p telegram
```

### With Limit
```bash
bun plugins/messages/src/cli.ts search "error" -l 50
```

## Search via MCP

### messages_search Tool

```json
{
  "query": "search terms",
  "limit": 20,
  "offset": 0,
  "platforms": ["claude-code", "telegram"],
  "kinds": [101, 102],
  "since": 1702800000000,
  "until": 1702900000000
}
```

### Response Format
```json
{
  "results": [
    {
      "message": { /* full message object */ },
      "score": 2.45,
      "highlights": ["...matched **text**..."]
    }
  ],
  "total": 150
}
```

## Search Query Syntax

FTS5 supports special query syntax:

### Phrase Search
```
"exact phrase"
```

### AND (implicit)
```
word1 word2
```
Both words must appear.

### OR
```
word1 OR word2
```

### NOT
```
word1 NOT word2
```

### Prefix
```
auth*
```
Matches "authentication", "authorize", "author".

### Column-Specific
```
content:error platform:telegram
```

## Filtering Options

| Filter | Description | CLI Flag | MCP Param |
|--------|-------------|----------|-----------|
| Platform | Source platform | `-p, --platform` | `platforms` |
| Limit | Max results | `-l, --limit` | `limit` |
| Kind | Message type | N/A | `kinds` |
| Since | After timestamp | N/A | `since` |
| Until | Before timestamp | N/A | `until` |

## Programmatic Search

### TypeScript API

```typescript
import { createSearchIndex } from "@plugins/messages";

const search = createSearchIndex();

// Basic search
const results = search.search("query", { limit: 20 });

// With filters
const filtered = search.search("error", {
  limit: 50,
  platforms: ["claude-code"],
  kinds: [101, 102]
});

// Get recent messages
const recent = search.recent(10);

// Get thread messages
const thread = search.getThreadMessages("thread-id", 100);
```

### Search Result Object

```typescript
interface SearchResult {
  message: Message;
  score: number;        // BM25 relevance score
  highlights?: string[]; // Matched snippets
}
```

## Best Practices

### Effective Queries
- Use specific terms over generic ones
- Combine with platform filters for large datasets
- Use phrase search for exact matches
- Limit results when exploring

### Performance
- Index is updated on each import
- Large imports may take time to index
- Search is fast even with millions of messages

### Common Patterns

**Find all Claude responses about a topic:**
```bash
bun plugins/messages/src/cli.ts search "authentication" -p claude-code
```

**Find recent Telegram messages:**
```bash
bun plugins/messages/src/cli.ts recent -p telegram -l 20
```

**Search within date range (via MCP):**
```json
{
  "query": "meeting",
  "since": 1702800000000,
  "until": 1702900000000
}
```

## Entity Search Methodology

When searching for messages from/about a specific **person** (like "Pravin"), standard search is often insufficient because:
- Search returns messages ranked by **relevance**, not completeness
- You need to know **ALL threads** they participate in
- You must **verify** thread names match the content you're attributing

### The Four-Step Process

#### Step 1: Scope Discovery (Count First)

**Before diving into content, understand the full scope.** Never assume the first few results are everything.

```bash
# Find all distinct threads mentioning a person
bun -e "
import { Database } from 'bun:sqlite';
const db = new Database('.claude/messages/search/index.db', { readonly: true });
const threads = db.query(\"SELECT DISTINCT thread_id FROM messages_meta WHERE platform = 'signal' AND data LIKE '%PersonName%'\").all();
console.log('Total threads:', threads.length);
threads.forEach(t => console.log(' ', t.thread_id));
"
```

#### Step 2: Thread Identification

Get thread names and message counts for each thread:

```bash
bun -e "
import { Database } from 'bun:sqlite';
const db = new Database('.claude/messages/search/index.db', { readonly: true });
const threads = db.query(\"SELECT DISTINCT thread_id FROM messages_meta WHERE platform = 'signal' AND data LIKE '%PersonName%'\").all();
for (const t of threads) {
  const info = db.query(\"SELECT title FROM threads WHERE id = ?\").get(t.thread_id);
  const count = db.query(\"SELECT COUNT(*) as c FROM messages_meta WHERE thread_id = ? AND data LIKE '%PersonName%'\").get(t.thread_id);
  console.log(t.thread_id, '|', info?.title || '(no title)', '| msgs:', count?.c);
}
"
```

#### Step 3: Chronological Retrieval

Get recent messages sorted by **date**, not relevance score:

```bash
bun -e "
import { Database } from 'bun:sqlite';
const db = new Database('.claude/messages/search/index.db', { readonly: true });
const msgs = db.query(\"SELECT thread_id, data, created_at FROM messages_meta WHERE platform = 'signal' AND data LIKE '%PersonName%' ORDER BY created_at DESC LIMIT 20\").all();
for (const m of msgs) {
  const d = JSON.parse(m.data);
  const thread = db.query(\"SELECT title FROM threads WHERE id = ?\").get(m.thread_id);
  const date = new Date(m.created_at).toLocaleString('en-US', {month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'});
  console.log(date, '|', thread?.title || m.thread_id);
  console.log('  ', d.author?.name + ':', d.content?.substring(0, 80));
  console.log('');
}
"
```

#### Step 4: Verify Attribution

Always cross-reference thread IDs with thread titles before presenting results:

```bash
# Verify a specific thread
bun -e "
import { Database } from 'bun:sqlite';
const db = new Database('.claude/messages/search/index.db', { readonly: true });
const thread = db.query(\"SELECT * FROM threads WHERE id = ?\").get('signal_group_834');
console.log('Thread:', thread?.title, '| Type:', thread?.type);
"
```

### Database Schema Reference

The `messages_meta` table stores message metadata:
- `id` - Message CID
- `thread_id` - Thread identifier
- `platform` - Source platform (signal, telegram, email, etc.)
- `created_at` - Unix timestamp (milliseconds)
- `data` - JSON blob containing full message (author, content, etc.)

The `threads` table stores thread metadata:
- `id` - Thread identifier
- `title` - Human-readable thread name
- `type` - Thread type (dm, group, topic)

## Common Mistakes to Avoid

| Mistake | Why It's Wrong | Correct Approach |
|---------|----------------|------------------|
| Using `LIMIT` without understanding scope | May miss important threads | Query total count first |
| Trusting relevance order for completeness | High-scoring results may be subset | Get ALL distinct threads first |
| Assuming thread attribution | Content may not match stated thread | Verify thread titles with DB query |
| Using CLI search alone for entities | CLI optimized for keyword search, not entity discovery | Use direct SQL for person/entity searches |
| Presenting partial results as complete | Misleads about scope | Always state "Found X of Y threads" |

## When to Use Direct SQL vs CLI

| Use Case | Recommended Approach | Rationale |
|----------|---------------------|-----------|
| Quick keyword search | CLI `search` | Fast, ranked results |
| Finding all threads for a person | **Direct SQL** | CLI doesn't support entity-centric queries |
| Getting recent messages | CLI `recent` or SQL | Both work, SQL allows person filter |
| Thread-specific messages | CLI `thread <id>` | Purpose-built for this |
| Complete entity analysis | **Direct SQL with multiple queries** | Need scope → threads → messages pipeline |
| Verifying thread names | **Direct SQL** | No CLI command for thread lookup |

## Entity Search Template

Copy-paste template for comprehensive person search:

```bash
PERSON="Pravin"  # Change this
PLATFORM="signal"  # Change this (or remove filter)

bun -e "
import { Database } from 'bun:sqlite';
const db = new Database('.claude/messages/search/index.db', { readonly: true });
const person = '$PERSON';
const platform = '$PLATFORM';

// Step 1: Find all threads
const threads = db.query(\`SELECT DISTINCT thread_id FROM messages_meta WHERE platform = ? AND data LIKE ?\`).all(platform, \`%\${person}%\`);
console.log(\`Found \${threads.length} threads with \${person} on \${platform}:\\n\`);

// Step 2: Get thread details
for (const t of threads) {
  const info = db.query('SELECT title, type FROM threads WHERE id = ?').get(t.thread_id);
  const count = db.query(\`SELECT COUNT(*) as c FROM messages_meta WHERE thread_id = ? AND data LIKE ?\`).get(t.thread_id, \`%\${person}%\`);
  console.log(\`\${info?.title || t.thread_id} (\${info?.type || 'unknown'}) - \${count?.c} messages\`);
}

// Step 3: Get recent messages
console.log(\`\\nRecent messages from \${person}:\\n\`);
const msgs = db.query(\`SELECT thread_id, data, created_at FROM messages_meta WHERE platform = ? AND data LIKE ? ORDER BY created_at DESC LIMIT 15\`).all(platform, \`%\${person}%\`);
for (const m of msgs) {
  const d = JSON.parse(m.data);
  const thread = db.query('SELECT title FROM threads WHERE id = ?').get(m.thread_id);
  const date = new Date(m.created_at).toLocaleString('en-US', {month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'});
  console.log(\`\${date} | \${thread?.title || m.thread_id}\`);
  console.log(\`   \${d.author?.name}: \${d.content?.substring(0, 80)}\`);
  console.log('');
}
"
```
