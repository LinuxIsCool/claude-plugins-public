# Pipeline Sub-Skill

## Overview

Orchestrate end-to-end transcript processing from raw media to knowledge extraction.

## Pipeline Stages

```
┌─────────────┐   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐
│   Ingest    │ → │ Transcribe  │ → │  Diarize    │ → │   Enrich    │
│  (media)    │   │   (STT)     │   │ (speakers)  │   │ (entities)  │
└─────────────┘   └─────────────┘   └─────────────┘   └─────────────┘
                                            ↓
┌─────────────┐   ┌─────────────┐   ┌─────────────┐
│   Export    │ ← │    Store    │ ← │  Identify   │
│ (messages)  │   │  (events)   │   │ (speakers)  │
└─────────────┘   └─────────────┘   └─────────────┘
```

## Stage 1: Ingest

Prepare media for processing:

```typescript
interface IngestOptions {
  source: MediaSource;       // File, URL, buffer, stream
  format?: string;           // Override detection
  normalize?: boolean;       // Convert to standard format
  denoise?: boolean;         // Apply noise reduction
}
```

**Actions**:
- Detect media format
- Extract audio from video
- Convert to optimal format (16kHz mono WAV)
- Apply preprocessing (denoise, normalize)

## Stage 2: Transcribe

Convert speech to text:

```typescript
interface TranscribeStage {
  backend: string;           // whisper, whisper-api
  model: string;             // tiny, base, small, medium, large-v3
  language?: string;         // Auto-detect or specify
  options: TranscriptionOptions;
}
```

**Output**: Raw segments with timestamps

## Stage 3: Diarize

Segment by speaker:

```typescript
interface DiarizeStage {
  backend: string;           // pyannote, resemblyzer
  min_speakers?: number;
  max_speakers?: number;
  sensitivity?: number;
}
```

**Output**: Speaker-labeled segments

## Stage 4: Identify

Match speakers to known profiles:

```typescript
interface IdentifyStage {
  fingerprint_threshold: number;  // 0.85 default
  auto_create: boolean;           // Create new speakers
  require_verification: boolean;  // Flag uncertain matches
}
```

**Actions**:
- Generate fingerprints from segments
- Match against speaker database
- Assign or create speaker profiles
- Flag for manual verification if uncertain

## Stage 5: Enrich

Extract knowledge:

```typescript
interface EnrichStage {
  extract_entities: boolean;
  extract_topics: boolean;
  extract_relationships: boolean;
  summarize: boolean;
}
```

**Output**: Entities, topics, relationships, summary

## Stage 6: Store

Persist to event log:

```typescript
interface StoreStage {
  emit_events: boolean;      // Write to JSONL
  generate_markdown: boolean; // Create readable file
  index: boolean;            // Update search indexes
}
```

## Stage 7: Export (Optional)

Integrate with other plugins:

```typescript
interface ExportStage {
  to_messages: boolean;       // Emit as messages
  to_knowledge_graph: boolean; // Export entities
  to_journal: boolean;        // Create journal entry
}
```

## Pipeline Configuration

Define custom pipelines:

```typescript
const defaultPipeline: PipelineConfig = {
  stages: [
    { name: 'ingest', enabled: true },
    { name: 'transcribe', enabled: true, options: { backend: 'whisper', model: 'base' }},
    { name: 'diarize', enabled: true },
    { name: 'identify', enabled: true, options: { fingerprint_threshold: 0.85 }},
    { name: 'enrich', enabled: false },  // Disabled by default
    { name: 'store', enabled: true },
    { name: 'export', enabled: false }
  ]
};
```

## Quick Pipeline

For simple transcription without analysis:

```typescript
const quickPipeline: PipelineConfig = {
  stages: [
    { name: 'ingest', enabled: true },
    { name: 'transcribe', enabled: true, options: { model: 'tiny' }},
    { name: 'store', enabled: true }
  ]
};
```

## Full Analysis Pipeline

Complete processing with all enrichments:

```typescript
const fullPipeline: PipelineConfig = {
  stages: [
    { name: 'ingest', enabled: true, options: { denoise: true }},
    { name: 'transcribe', enabled: true, options: { model: 'large-v3' }},
    { name: 'diarize', enabled: true },
    { name: 'identify', enabled: true },
    { name: 'enrich', enabled: true, options: {
      extract_entities: true,
      extract_topics: true,
      extract_relationships: true,
      summarize: true
    }},
    { name: 'store', enabled: true },
    { name: 'export', enabled: true, options: { to_messages: true }}
  ]
};
```

## Pipeline Execution

```typescript
async function runPipeline(source: MediaSource, config: PipelineConfig): Promise<PipelineResult> {
  const context: PipelineContext = { source, transcript: null, speakers: [], entities: [] };

  for (const stage of config.stages) {
    if (!stage.enabled) continue;

    context = await executeStage(stage, context);

    if (context.error) {
      return { success: false, error: context.error, partial: context };
    }
  }

  return { success: true, transcript: context.transcript };
}
```

## Progress Reporting

```typescript
interface PipelineProgress {
  stage: string;
  progress: number;        // 0-100
  message: string;
  elapsed_ms: number;
  estimated_remaining_ms?: number;
}

// Callback for progress updates
type ProgressCallback = (progress: PipelineProgress) => void;
```

## Error Handling

| Stage | Common Errors | Recovery |
|-------|---------------|----------|
| Ingest | Invalid format | Try format conversion |
| Transcribe | Backend unavailable | Fall back to alternative |
| Diarize | Out of memory | Use simpler model |
| Identify | No fingerprint match | Create new speaker |
| Enrich | Extraction timeout | Skip and continue |
| Store | Disk full | Alert user |
| Export | Plugin unavailable | Log warning, continue |

## Batch Processing

Process multiple files:

```typescript
async function* batchPipeline(
  sources: MediaSource[],
  config: PipelineConfig
): AsyncGenerator<PipelineResult> {
  for (const source of sources) {
    yield await runPipeline(source, config);
  }
}

// Usage
for await (const result of batchPipeline(files, config)) {
  console.log(`Processed: ${result.transcript?.id}`);
}
```

## Integration Points

- **Transcriber agent**: Orchestrates pipeline execution
- **Analyst agent**: Triggers enrichment stages
- **MCP tools**: Provide low-level stage access
- **Commands**: User-facing pipeline invocation
