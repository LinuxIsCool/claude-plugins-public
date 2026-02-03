# Entity Extraction Sub-Skill

## Overview

Extract named entities, relationships, and topics from transcripts for knowledge graph integration.

## Entity Types

| Type | Examples | Use Case |
|------|----------|----------|
| `person` | "John Smith", "the CEO" | Contact discovery |
| `organization` | "Acme Corp", "engineering team" | Company mapping |
| `location` | "New York", "main office" | Geographic context |
| `product` | "iPhone 15", "our new API" | Product mentions |
| `concept` | "machine learning", "agile" | Topic clustering |
| `date` | "next Tuesday", "Q1 2025" | Timeline building |
| `event` | "annual conference", "standup" | Calendar integration |

## Extraction Pipeline

```
1. Load transcript utterances
2. Run NER on each utterance
3. Normalize entity names
4. Deduplicate across transcript
5. Extract relationships
6. Identify topics
7. Store for knowledge graph
```

## MCP Tools

No direct MCP tool - extraction runs as part of analysis:

```typescript
// Via analyst agent or programmatic call
const entities = await extractionPort.extractEntities(transcript);
const relationships = await extractionPort.extractRelationships(entities, transcript);
const topics = await extractionPort.extractTopics(transcript);
```

## Entity Structure

```typescript
interface ExtractedEntity {
  id: EntityID;
  type: EntityType;
  name: string;               // Normalized name
  mentions: EntityMention[];  // Where it appears
  confidence: number;
  external_ids?: {            // For linking
    wikidata?: string;
    dbpedia?: string;
  };
}

interface EntityMention {
  utterance_id: string;
  speaker_id: SpeakerID;
  text: string;              // As mentioned
  start_offset: number;
  end_offset: number;
  context: string;           // Surrounding text
}
```

## Relationship Types

Between entities:

| Relation | Example |
|----------|---------|
| `works_at` | Person → Organization |
| `located_in` | Organization → Location |
| `knows` | Person → Person |
| `part_of` | Team → Organization |
| `created` | Person → Product |
| `discusses` | Speaker → Topic |

```typescript
interface EntityRelationship {
  source_id: EntityID;
  target_id: EntityID;
  relation: string;
  confidence: number;
  evidence: {
    utterance_id: string;
    text: string;
  }[];
}
```

## Topic Modeling

Extract overarching themes:

```typescript
interface Topic {
  id: string;
  name: string;
  keywords: string[];
  relevance: number;        // 0-1 score
  utterance_ids: string[];  // Where discussed
}
```

Topics are extracted using:
- Keyword frequency analysis
- Semantic clustering
- LDA/BERTopic for large corpora

## Backend Selection

| Backend | Capabilities | Speed |
|---------|-------------|-------|
| `spacy` | NER, basic relations | Fast |
| `huggingface` | NER, flexible models | Medium |
| `openai` | All extraction types | API-dependent |
| `local-llm` | All types, private | Slow |

## Confidence Thresholds

| Level | Range | Action |
|-------|-------|--------|
| High | > 0.85 | Auto-include |
| Medium | 0.65-0.85 | Include with flag |
| Low | < 0.65 | Exclude or manual review |

## Entity Normalization

Consolidate variations:

```typescript
// Input mentions
"Acme Corp", "Acme Corporation", "ACME", "the company"

// Normalized entity
{
  name: "Acme Corporation",
  aliases: ["Acme Corp", "ACME"],
  type: "organization"
}
```

## Speaker-Entity Links

Track who mentions what:

```typescript
interface SpeakerEntityLink {
  speaker_id: SpeakerID;
  entity_id: EntityID;
  mention_count: number;
  first_mention: number;     // Timestamp
  last_mention: number;
  relationship?: string;     // "works_at", "knows", etc.
}
```

## Knowledge Graph Output

For integration with knowledge-graphs plugin:

```typescript
// Nodes
const nodes = entities.map(e => ({
  id: e.id,
  label: e.name,
  type: e.type,
  properties: { confidence: e.confidence }
}));

// Edges
const edges = relationships.map(r => ({
  source: r.source_id,
  target: r.target_id,
  label: r.relation,
  properties: { confidence: r.confidence }
}));
```

## Analysis Modes

### Quick Scan
- High-confidence entities only
- No relationship inference
- Basic topic detection

### Deep Analysis
- All confidence levels
- Full relationship mapping
- Comprehensive topics
- External ID linking

### Knowledge Graph Mode
- Optimized for graph database
- Include external IDs
- Normalized names
- Deduplicated across corpus

## Integration Points

- **Analyst agent**: Primary interface for extraction
- **Speaker database**: Link entities to speakers
- **Messages plugin**: Search by entity across conversations
- **Knowledge-graphs plugin**: FalkorDB/Graphiti storage
- **Journal plugin**: Capture insights from extraction
