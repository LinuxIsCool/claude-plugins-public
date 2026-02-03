---
name: transcript-master
description: Master skill for transcript management (9 sub-skills). Covers: transcription, diarization, speaker-database, voice-fingerprinting, entity-extraction, messages-integration, search, pipeline, experimental-research. Invoke for audio/video transcription, speaker diarization ("who spoke when"), speaker identification, voice recognition, knowledge extraction, and safe experimentation.
allowed-tools: Read, Skill, Task, Glob, Grep, Bash
---

# Transcript Management - Master Skill

## Overview

The transcript plugin provides comprehensive audio/video transcription with:
- **Voice fingerprinting** for speaker identification across recordings
- **Speaker database** with metadata, facts, and relationships
- **Entity extraction** for knowledge graph integration
- **Messages plugin interoperability**

## Quick Reference

| User Intent | Sub-Skill | File |
|-------------|-----------|------|
| "Transcribe this audio/video file" | transcription | `subskills/transcription.md` |
| "Who spoke when?" "Separate speakers" "Diarize" | diarization | `subskills/diarization.md` |
| "Who is this speaker?" "Identify voice" | speaker-database | `subskills/speaker-database.md` |
| "Recognize this voice" "Voice fingerprint" | voice-fingerprinting | `subskills/voice-fingerprinting.md` |
| "Extract entities" "Find topics" | entity-extraction | `subskills/entity-extraction.md` |
| "Link to messages" "Emit utterances" | messages-integration | `subskills/messages-integration.md` |
| "Search transcripts" "Find mentions" | search | `subskills/search.md` |
| "Full processing pipeline" | pipeline | `subskills/pipeline.md` |
| "Test safely" "Check resources" "What model can run?" | experimental-research | `subskills/experimental-research.md` |

## Sub-Skills Index

### transcription
Use when user wants to convert audio/video to text.
Covers: backend selection, model configuration, language detection, streaming vs batch.

### diarization
Use when separating audio by speaker ("who spoke when").
Covers: PyAnnote backend, GPU acceleration, speaker embeddings, chunked processing for long files.

### speaker-database
Use when managing speaker profiles, linking identities, adding facts.
Covers: creating speakers, merging duplicates, linking to messages accounts.

### voice-fingerprinting
Use when identifying speakers by voice, cross-transcript recognition.
Covers: embedding generation, similarity matching, clustering unknown voices.

### entity-extraction
Use when extracting named entities, topics, and relationships.
Covers: NER configuration, topic modeling, knowledge graph integration.

### messages-integration
Use when integrating with the messages plugin.
Covers: shared accounts, utterance emission, bidirectional linking.

### search
Use when searching transcript content or speaker mentions.
Covers: full-text search, speaker filtering, temporal queries.

### pipeline
Use for full end-to-end processing of new recordings.
Covers: transcribe → diarize → fingerprint → extract → emit workflow.

### experimental-research
Use for safe experimentation with transcription systems.
Covers: resource probing, progressive testing, model selection, system safety.
Philosophy: Concrete Computing - treat resources as precious even when abundant.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Application Layer                       │
│  ┌──────────┐  ┌────────────┐  ┌────────────┐  ┌─────────┐ │
│  │Transcribe│  │Identify    │  │Extract     │  │Emit     │ │
│  │UseCase   │  │Speaker     │  │Entities    │  │Messages │ │
│  └────┬─────┘  └─────┬──────┘  └─────┬──────┘  └────┬────┘ │
├───────┼──────────────┼───────────────┼──────────────┼───────┤
│       │              │               │              │       │
│   ┌───▼───┐      ┌───▼───┐      ┌───▼───┐      ┌───▼───┐  │
│   │Trans- │      │Finger │      │Extract│      │Bridge │  │
│   │Port   │      │Port   │      │Port   │      │       │  │
│   └───┬───┘      └───┬───┘      └───┬───┘      └───┬───┘  │
├───────┼──────────────┼───────────────┼──────────────┼───────┤
│       │              │               │              │       │
│   ┌───▼───┐      ┌───▼───┐      ┌───▼───┐      ┌───▼───┐  │
│   │Whisper│      │PyAnn- │      │spaCy  │      │Message│  │
│   │Adapter│      │ote    │      │OpenAI │      │Store  │  │
│   └───────┘      └───────┘      └───────┘      └───────┘  │
│                    Adapters Layer                           │
└─────────────────────────────────────────────────────────────┘
```

## Storage Structure

```
.claude/transcripts/
├── store/
│   ├── events/              # Event-sourced JSONL (source of truth)
│   │   └── YYYY/MM/DD/events.jsonl
│   └── content/             # Transcript markdown files
│       └── XX/{tid}.md
├── speakers/                # Speaker profiles (JSON)
│   └── {spk_id}.json
├── entities/                # Entity database (JSON)
│   └── {ent_id}.json
└── search/
    └── index.db             # SQLite FTS5
```

## MCP Tools

| Tool | Description |
|------|-------------|
| `transcripts_transcribe` | Transcribe audio/video file |
| `transcripts_list` | List all transcripts |
| `transcripts_get` | Get transcript by ID |
| `transcripts_speakers_list` | List all speakers |
| `transcripts_speaker_create` | Create speaker profile |
| `transcripts_speaker_get` | Get speaker by ID |
| `transcripts_stats` | Get store statistics |
| `transcripts_emit_to_messages` | Emit to messages plugin |
| `transcripts_backends_list` | List transcription backends |

## Usage Example

```typescript
// Transcribe a file
await transcripts_transcribe({
  file_path: "/path/to/recording.mp3",
  title: "Team Meeting 2025-01-15",
  backend: "whisper",
  model: "base"
});

// Create speaker profile
await transcripts_speaker_create({
  name: "Alice Chen",
  description: "Engineering lead"
});

// Emit to messages plugin
await transcripts_emit_to_messages({
  transcript_id: "tx_abc123..."
});
```

## Related Plugins

- **messages**: Shared account system, utterance emission
- **knowledge-graphs**: Entity and relationship storage
- **logging**: Session transcript source
