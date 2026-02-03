# Voice Fingerprinting Sub-Skill

## Overview

Extract and match voice embeddings to identify speakers across transcripts.

## Fingerprint Generation

Voice fingerprints are embedding vectors that capture acoustic characteristics:

```typescript
interface VoiceFingerprint {
  id: string;
  speaker_id: SpeakerID;
  embedding: Float32Array;   // 256-512 dimensions
  source_transcript_id: TID;
  source_utterance_ids: string[];
  quality: number;           // 0-1 confidence
  model: string;             // Embedding model used
  created_at: number;
}
```

## Fingerprinting Workflow

```
1. Extract audio segments per speaker
2. Generate embedding vectors
3. Store fingerprints with speaker
4. Use for cross-transcript matching
```

## Backend Selection

| Backend | Mode | Speed | Accuracy |
|---------|------|-------|----------|
| `resemblyzer` | Local | Fast | Good |
| `pyannote-audio` | Local | Medium | Best |
| `speechbrain` | Local | Medium | Very Good |
| `speaker-api` | API | Fast | Good |

## Matching Process

When a new transcript is processed:

```typescript
// For each speaker segment
const embedding = await fingerprintPort.fingerprint(audioSegment);

// Compare against known speakers
const matches = await store.matchSpeakerByFingerprint(embedding, {
  threshold: 0.85,  // Similarity threshold
  maxResults: 5
});

if (matches.length > 0 && matches[0].similarity > 0.90) {
  // High confidence match - assign existing speaker
  utterance.speaker_id = matches[0].speaker_id;
} else if (matches.length > 0 && matches[0].similarity > 0.75) {
  // Candidate match - flag for review
  utterance.speaker_id = matches[0].speaker_id;
  utterance.needs_verification = true;
} else {
  // New speaker - create profile
  const newSpeaker = await store.createSpeaker({ name: "Unknown Speaker" });
  utterance.speaker_id = newSpeaker.id;
}
```

## Quality Factors

Fingerprint quality depends on:

| Factor | Impact | Mitigation |
|--------|--------|------------|
| Audio quality | High | Use clean segments |
| Segment duration | High | Minimum 3 seconds |
| Background noise | Medium | Denoise preprocessing |
| Multiple speakers | High | Use diarized segments |
| Encoding artifacts | Low | Prefer lossless |

## Multiple Fingerprints

Speakers accumulate fingerprints over time:

```typescript
const speaker = await store.getSpeaker(speakerId);

// Multiple fingerprints from different recordings
speaker.fingerprints.length;  // e.g., 5 fingerprints

// Matching uses best match across all fingerprints
const matchResult = await store.matchSpeakerByFingerprint(embedding);
// matchResult.fingerprint_id identifies which one matched
```

## Embedding Distance

Similarity is computed as cosine distance:

```typescript
function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
```

## Thresholds

| Similarity | Interpretation |
|------------|----------------|
| > 0.95 | Very high confidence (same person) |
| 0.85 - 0.95 | High confidence |
| 0.75 - 0.85 | Moderate (manual verification) |
| 0.65 - 0.75 | Low confidence |
| < 0.65 | Different speaker |

## Speaker Merging

When fingerprints reveal duplicates:

```typescript
// Two speakers are same person
await store.mergeSpeakers(sourceId, targetId, {
  reason: "Voice fingerprint match (0.96 similarity)"
});
```

This transfers all fingerprints, facts, and transcript references.

## Privacy Considerations

Voice fingerprints are biometric data:
- Store embeddings, not raw audio
- Allow speaker deletion (GDPR compliance)
- Document retention policies
- Consider encryption at rest

## Integration Points

- **Transcription**: Generate fingerprints during processing
- **Speaker database**: Store with speaker profiles
- **Diarization**: Use to improve "who spoke when"
- **Search**: Find transcripts by speaker voice
