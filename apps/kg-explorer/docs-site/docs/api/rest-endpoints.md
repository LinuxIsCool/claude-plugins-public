---
sidebar_position: 2
title: REST Endpoints
description: REST API reference
keywords: [rest, api, http]
---

# REST Endpoints

HTTP API for KG Explorer.

## Base URL

```
http://localhost:3000/api/v1
```

## Episodes

### Create

```http
POST /episodes
{
  "name": "episode-id",
  "body": "Content...",
  "reference_time": "2024-01-15T10:30:00Z"
}
```

### List

```http
GET /episodes?limit=20&status=processed
```

## Speakers

```http
GET /speakers?limit=20&sort=mention_count:desc
GET /speakers/:id
GET /speakers/:id/discusses
```

## Concepts

```http
GET /concepts?type=TECHNOLOGY
GET /concepts/:id
GET /concepts/:id/related
```

## Search

```http
GET /search?q=knowledge%20graphs&types=concept,speaker
```

## Graph Operations

```http
POST /graph/cypher
{
  "query": "MATCH (c:Concept) RETURN c LIMIT 10"
}
```

## Error Format

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Speaker not found"
  }
}
```

## Next Steps

- [GraphQL Schema](./graphql-schema) - Typed API
- [WebSocket Events](./websocket-events) - Real-time
