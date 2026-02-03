# Speaker Database Sub-Skill

## Overview

Manage speaker profiles with metadata, facts, and cross-platform identity linking.

## Speaker Entity

```typescript
interface Speaker {
  id: SpeakerID;              // spk_abc123...
  name: string;               // Primary display name
  aliases?: string[];         // Alternative names
  avatar?: string;            // Emoji or image

  fingerprints: VoiceFingerprint[];  // Voice embeddings
  identities: SpeakerIdentity[];     // Platform links
  facts: SpeakerFact[];              // Known facts

  stats: SpeakerStats;
  created_at: number;
  updated_at: number;
}
```

## Creating Speakers

### Via MCP Tool

```json
// transcripts_speaker_create
{
  "name": "Alice Chen",
  "aliases": ["A. Chen", "Alice"],
  "description": "Engineering lead at Acme Corp"
}
```

### Automatically

Speakers are created automatically during transcription when:
1. Diarization identifies distinct voices
2. Names are extracted from conversation
3. Manual assignment during review

## Linking to Messages Accounts

Speakers can link to messages plugin accounts for unified identity:

```typescript
// SpeakerIdentity for messages link
{
  platform: "messages",
  external_id: "alice_chen",  // Messages account ID
  handle: "Alice Chen",
  verified: true,
  linked_at: 1705347200000
}
```

## Speaker Facts

Store structured knowledge about speakers:

```typescript
interface SpeakerFact {
  key: string;           // "occupation", "organization", "expertise"
  value: string;
  source_transcript_id?: string;  // Where learned
  confidence?: number;
  created_at: number;
}
```

Common fact types:
- `occupation` - Job title
- `organization` - Company/team
- `expertise` - Domain knowledge
- `relationship` - Connection to other speakers
- `location` - Geographic info

## Speaker Statistics

Automatically tracked:
- `transcript_count` - Appearances
- `utterance_count` - Total utterances
- `total_speaking_time_ms` - Time spoken
- `first_appearance` - First transcript
- `last_appearance` - Most recent

## Merging Speakers

When duplicate speakers are discovered:

```typescript
// Merge source into target
{
  source_id: "spk_duplicate",
  target_id: "spk_canonical",
  reason: "Same person identified"
}
```

This:
1. Transfers all fingerprints
2. Combines facts (deduplicated)
3. Updates transcript references
4. Creates merge event for audit

## Storage

Speakers stored as JSON in `.claude/transcripts/speakers/`:

```
speakers/
├── spk_abc123.json
├── spk_def456.json
└── ...
```

## Queries

### List speakers
```
transcripts_speakers_list
```

### Get speaker details
```
transcripts_speaker_get { "id": "spk_abc123" }
```

### Find by name (via store)
```typescript
await store.findSpeakerByName("Alice");
```

## Best Practices

1. **Use canonical names**: "Alice Chen" not "alice"
2. **Add aliases early**: Capture variations
3. **Link to messages**: Enable cross-plugin identity
4. **Add facts progressively**: Enrich from conversations
5. **Review merges carefully**: Hard to undo
