# Search Sub-Skill

## Overview

Search and query transcripts, speakers, and entities across the corpus.

## Search Targets

| Target | Index | Example Query |
|--------|-------|---------------|
| Transcripts | Full-text | "budget discussion" |
| Utterances | Full-text + metadata | "John talking about sales" |
| Speakers | Name + facts | "engineer at Acme" |
| Entities | Name + type | "person named Alice" |

## MCP Tools

### transcripts_search

Full-text search across transcript utterances using FTS5.

```json
{
  "query": "quarterly review",
  "speakers": ["spk_abc123"],
  "limit": 20,
  "highlights": true,
  "grouped": false
}
```

**Parameters:**
- `query` (required): FTS5 query (supports AND, OR, NOT, "phrases", prefix*)
- `speakers`: Filter by speaker IDs
- `transcripts`: Filter by transcript IDs
- `limit`: Max results (default 20)
- `offset`: Pagination offset
- `highlights`: Include highlighted snippets (default true)
- `grouped`: Group results by transcript (default false)

### transcripts_search_stats

Get statistics about the search index.

```json
{}
```

Returns: `{ transcripts_indexed, utterances_indexed, unique_speakers, date_range }`

### transcripts_rebuild_index

Rebuild the FTS5 search index from all stored transcripts.

```json
{
  "clear": true
}
```

### transcripts_get

```json
{
  "id": "tx_abc123..."
}
```

Returns full transcript with utterances, speakers, entities.

### transcripts_list

```json
{
  "status": "complete",
  "limit": 50
}
```

## Query Patterns

### By Speaker

```typescript
// Find all utterances by speaker
const results = await store.searchUtterances({
  speaker_id: "spk_alice"
});

// Find transcripts where speaker appears
const transcripts = await store.listTranscripts({
  speaker_id: "spk_alice"
});
```

### By Content

```typescript
// Full-text search across utterances
const results = await store.searchUtterances({
  query: "machine learning",
  limit: 50
});
```

### By Entity

```typescript
// Find where entity is mentioned
const mentions = await store.searchByEntity({
  entity_id: "ent_acme_corp"
});

// Find transcripts discussing topic
const transcripts = await store.searchByTopic({
  topic: "quarterly review"
});
```

### By Time Range

```typescript
// Transcripts in date range
const results = await store.listTranscripts({
  created_after: Date.parse("2025-01-01"),
  created_before: Date.parse("2025-03-31")
});

// Utterances at specific timestamp
const utterances = await store.searchUtterances({
  transcript_id: "tx_abc123",
  time_from_ms: 60000,  // 1 minute
  time_to_ms: 120000    // 2 minutes
});
```

## Search Index

The plugin uses **SQLite FTS5** for full-text search, following the same pattern as the messages plugin:

```typescript
import { TranscriptSearchIndex } from "../infrastructure/search.js";

const searchIndex = new TranscriptSearchIndex();

// Search utterances
const results = searchIndex.search("quarterly review", {
  limit: 20,
  speakers: ["spk_alice"],
  createdAfter: Date.parse("2025-01-01"),
});

// Search with highlights
const highlighted = searchIndex.searchWithHighlights("machine learning");

// Get stats
const stats = searchIndex.stats();
// → { transcripts: 42, utterances: 1234, speakers: 8, dateRange: {...} }
```

### Database Schema

```sql
-- FTS5 virtual table for full-text search
CREATE VIRTUAL TABLE utterances_fts USING fts5(
  id UNINDEXED,
  transcript_id UNINDEXED,
  speaker_id UNINDEXED,
  speaker_name,
  text,
  tokenize='porter unicode61'
);

-- Metadata table for filtering
CREATE TABLE utterances_meta (
  id TEXT PRIMARY KEY,
  transcript_id TEXT NOT NULL,
  speaker_id TEXT NOT NULL,
  speaker_name TEXT NOT NULL,
  text TEXT NOT NULL,
  start_ms INTEGER NOT NULL,
  end_ms INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
```

### Migration

To rebuild the search index from existing transcripts:

```bash
/transcripts rebuild-index
```

Or programmatically:

```typescript
const store = new TranscriptStore();
const searchIndex = new TranscriptSearchIndex();

for await (const summary of store.listTranscripts()) {
  const transcript = await store.getTranscript(summary.id);
  if (transcript) searchIndex.index(transcript);
}
```

## Result Formats

### Transcript Result

```typescript
{
  id: "tx_abc123",
  title: "Team Meeting",
  created_at: 1705347200000,
  duration_ms: 3600000,
  speaker_count: 4,
  utterance_count: 156,
  preview: "First 200 chars of content..."
}
```

### Utterance Result

```typescript
{
  id: "ut_abc123_0042",
  transcript_id: "tx_abc123",
  speaker: { id: "spk_alice", name: "Alice Chen" },
  text: "I think we should focus on...",
  start_ms: 145000,
  end_ms: 152000,
  highlight: "I think we should focus on <mark>machine learning</mark>..."
}
```

### Speaker Result

```typescript
{
  id: "spk_alice",
  name: "Alice Chen",
  transcript_count: 12,
  total_speaking_time_ms: 7200000,
  facts: [
    { key: "occupation", value: "Engineering Lead" },
    { key: "organization", value: "Acme Corp" }
  ]
}
```

## Cross-Plugin Search

### Via Messages Plugin

If transcripts are emitted to messages:

```typescript
// Search utterances as messages
const results = await messages_search({
  query: "budget",
  kinds: [1051],  // UTTERANCE_MESSAGE_KIND
  accounts: ["alice_chen"]
});
```

### Via Knowledge Graph

If entities are exported:

```typescript
// Query graph for relationships
const results = await graphQuery(`
  MATCH (s:Speaker)-[:MENTIONS]->(e:Entity {type: 'organization'})
  WHERE e.name CONTAINS 'Acme'
  RETURN s.name, count(*) as mentions
`);
```

## Search Best Practices

1. **Start broad**: Use simple queries first
2. **Add filters**: Narrow with speaker, date, entity
3. **Use speaker context**: "What did Alice say about X"
4. **Combine with entities**: Search by who + what
5. **Export for analysis**: Use search results with analyst agent

## Performance

| Operation | Complexity | Notes |
|-----------|-----------|-------|
| List transcripts | O(n) | Filtered scan |
| Get transcript | O(1) | Direct lookup |
| Full-text search | O(log n) | Inverted index |
| Speaker lookup | O(1) | Hash map |
| Entity search | O(m) | m = mention count |

## Pagination

For large result sets:

```typescript
const page1 = await store.searchUtterances({
  query: "meeting",
  limit: 20,
  offset: 0
});

const page2 = await store.searchUtterances({
  query: "meeting",
  limit: 20,
  offset: 20
});
```
