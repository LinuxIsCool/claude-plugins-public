---
sidebar_position: 4
title: Contributing Data
description: How to contribute data to KG Explorer
keywords: [contributing, data, ingestion]
---

# Contributing Data

Add data to expand the knowledge graph.

## Contribution Methods

### Episode Upload (UI)

1. Click **Add Data** -> **Upload Episode**
2. Paste content
3. Set metadata
4. Submit

### Bulk Import (API)

```bash
curl -X POST http://localhost:3000/api/episodes/bulk \
  -H "Content-Type: application/json" \
  -d @episodes.json
```

### Transcript Pipeline

```bash
kg-explorer ingest transcript \
  --url "https://youtube.com/watch?v=..." \
  --diarize true
```

## Data Quality

Good episodes have:
- 50-500 words
- Single topic focus
- Clear source/speaker
- Temporal context

## Extraction Hints

```json
{
  "body": "Dan discussed Anthropic's Claude...",
  "hints": {
    "entities": [
      {"name": "Dan", "type": "Speaker"},
      {"name": "Claude", "type": "Product"}
    ]
  }
}
```

## Tracking

```bash
curl http://localhost:3000/api/contributions/status
```

## Next Steps

- [Quick Start](../getting-started/quick-start) - See contributions in action
- [Writing Queries](./writing-queries) - Query contributed data
