---
sidebar_position: 2
title: Data Pipeline
description: How data flows through KG Explorer
keywords: [pipeline, ingestion, extraction]
---

# Data Pipeline

Transform unstructured content into structured knowledge.

## Pipeline Stages

```
Sources -> Acquisition -> Extraction -> Resolution -> Integration -> Enrichment
```

### 1. Acquisition

- Download media
- Transcribe with Whisper
- Diarize speakers
- Segment into utterances

### 2. Extraction

- Entity recognition (LLM)
- Relationship inference
- Belief extraction

### 3. Resolution

- Find duplicate entities
- Compute similarity scores
- Merge or create new

### 4. Integration

- Atomic graph updates
- Index synchronization
- Event emission

### 5. Enrichment

- Build aggregation edges
- Generate insights
- Score quality

## Configuration

```yaml
pipeline:
  batch_size: 100
  extraction:
    llm_model: gpt-4o-mini
  resolution:
    similarity_threshold: 0.9
```

## Next Steps

- [Agent System](./agent-system) - Pipeline improvement
- [Performance](./performance) - Optimization
