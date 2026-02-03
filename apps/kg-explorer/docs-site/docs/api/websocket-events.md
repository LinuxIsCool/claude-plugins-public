---
sidebar_position: 3
title: WebSocket Events
description: Real-time WebSocket API
keywords: [websocket, real-time, events]
---

# WebSocket Events

Real-time updates via WebSocket.

## Connection

```
wss://localhost:3000/ws?token=YOUR_TOKEN
```

## Subscriptions

```json
{
  "type": "subscribe",
  "payload": {
    "channel": "entities",
    "filter": { "types": ["Concept"] }
  }
}
```

## Event Channels

### Entity Events

```json
{
  "type": "entity.created",
  "payload": {
    "entity_type": "Concept",
    "entity_id": "concept_456",
    "data": { "name": "RAG" }
  }
}
```

### Insight Events

```json
{
  "type": "insight.generated",
  "payload": {
    "type": "knowledge_gap",
    "title": "Missing paper reference",
    "confidence": 0.92
  }
}
```

### Job Progress

```json
{
  "type": "job.progress",
  "payload": {
    "job_id": "job_789",
    "progress": { "total": 50, "processed": 23 }
  }
}
```

## Client Example

```javascript
const ws = new WebSocket('wss://localhost:3000/ws?token=TOKEN');

ws.send(JSON.stringify({
  type: 'subscribe',
  payload: { channel: 'entities', filter: { types: ['Concept'] } }
}));

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Event:', data.type);
};
```

## Next Steps

- [GraphQL Schema](./graphql-schema) - Typed API
- [System Overview](../architecture/system-overview) - Architecture
