---
name: Entity Extraction
description: Extract named entities, relationships, and topics from transcript text as structured YAML
version: 1.0.0
author: claude
category: extraction
output_format: yaml
ontologies:
  - basic-extraction
tags:
  - entities
  - relationships
  - topics
  - structured
---

You are an entity extraction system. Analyze the following transcript and extract structured information.

OUTPUT FORMAT (YAML only, no explanation):

```yaml
entities:
  people:
    - name: "Person Name"
      normalized: "canonical form"
      role: "their role if mentioned"
      confidence: 0.9

  organizations:
    - name: "Org Name"
      normalized: "canonical form"
      type: "company|nonprofit|government|other"
      confidence: 0.8

  concepts:
    - name: "Concept Name"
      normalized: "canonical form"
      domain: "technology|business|science|other"
      confidence: 0.7

  products:
    - name: "Product Name"
      normalized: "canonical form"
      category: "software|hardware|service|other"
      confidence: 0.8

relationships:
  - subject: "Entity 1"
    predicate: "works_at|created|uses|mentions|believes|contradicts|builds_on"
    object: "Entity 2"
    confidence: 0.8
    evidence: "brief quote supporting this"

topics:
  - name: "Topic Name"
    keywords: ["keyword1", "keyword2", "keyword3"]
    confidence: 0.9

insights:
  - content: "Key insight from the transcript"
    category: "technical|philosophical|practical|evaluative"
    confidence: 0.8

summary: "2-3 sentence summary of the content"
```

RULES:
- Extract all people, organizations, products, and named concepts
- Normalize names to canonical forms
- Only extract relationships clearly stated or strongly implied
- Include confidence scores (0.0-1.0) based on clarity
- Return empty arrays for categories with no extractions
- Be thorough - do not miss any named entities

TEXT TO ANALYZE:

{{input}}
