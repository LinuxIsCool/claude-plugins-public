---
sidebar_position: 1
title: GraphQL Schema
description: GraphQL API schema reference
keywords: [graphql, api, schema]
---

# GraphQL Schema

Typed API access to the knowledge graph.

## Endpoint

```
POST http://localhost:3000/api/graphql
```

## Core Types

### Speaker

```graphql
type Speaker {
  id: ID!
  name: String!
  transcriptCount: Int!
  discusses: [DiscussesEdge!]!
  beliefs: [BelievesEdge!]!
}
```

### Concept

```graphql
type Concept {
  id: ID!
  name: String!
  summary: String
  type: ConceptType!
  relatedTo: [RelatedEdge!]!
  discussedBy: [Speaker!]!
}
```

## Queries

```graphql
type Query {
  speaker(id: ID!): Speaker
  concept(id: ID!): Concept
  search(query: String!): SearchResult!
}
```

## Example

```graphql
query GetSpeaker($name: String!) {
  speakers(filter: { name: { eq: $name } }) {
    edges {
      node {
        name
        discusses {
          concept { name }
          mentionCount
        }
      }
    }
  }
}
```

## Next Steps

- [REST Endpoints](./rest-endpoints) - HTTP API
- [WebSocket Events](./websocket-events) - Real-time
