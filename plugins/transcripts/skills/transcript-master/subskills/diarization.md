# Diarization Sub-Skill

## Overview

Speaker diarization answers "who spoke when" by segmenting audio into speaker-labeled time ranges. This stage runs between transcription and fingerprinting, providing the speaker boundaries needed for accurate voice identification.

## Supported Backends

| Backend | Model | GPU | Speakers | Overlapping | Embeddings |
|---------|-------|-----|----------|-------------|------------|
| `pyannote` | speaker-diarization-3.1 | Recommended | 1-20 | Yes | 256-dim |

PyAnnote 3.1 is the current default and only implemented backend. The factory pattern allows future expansion.

## Requirements

### Environment Setup

```bash
# Create/use shared ML environment
python3 -m venv ~/.venvs/ml
~/.venvs/ml/bin/pip install pyannote-audio

# HuggingFace token (pyannote models are gated)
export HF_TOKEN=hf_your_token_here
```

### HuggingFace Access

1. Create account at huggingface.co
2. Accept license at https://huggingface.co/pyannote/speaker-diarization-3.1
3. Generate token at https://huggingface.co/settings/tokens
4. Set `HF_TOKEN` environment variable or add to `.env`

## Configuration Options

```typescript
interface DiarizationOptions {
  num_speakers?: number;       // Known count improves accuracy
  min_speakers?: number;       // Range constraints
  max_speakers?: number;
  min_segment_duration_ms?: number;  // Filter short segments (default: 500)
}

interface PyAnnoteConfig {
  model?: string;              // "pyannote/speaker-diarization-3.1"
  device?: "cuda" | "cpu" | "auto";
  pythonPath?: string;         // Default: ~/.venvs/ml/bin/python
  hfToken?: string;            // Override environment variable
}
```

## Output Format

```typescript
interface DiarizationResult {
  segments: DiarizationSegment[];
  speaker_count: number;
  speaker_labels: string[];     // ["SPEAKER_00", "SPEAKER_01", ...]
  duration_ms: number;
  processing_time_ms: number;
  embeddings?: Record<string, Float32Array>;  // 256-dim per speaker
}

interface DiarizationSegment {
  speaker_label: string;        // "SPEAKER_00"
  start_ms: number;
  end_ms: number;
  confidence?: number;
}
```

## Diarization Workflow

```
1. Validate input (file path, format)
2. Load PyAnnote pipeline (cached after first load)
3. Load audio with torchaudio
4. Run speaker segmentation
5. Extract speaker embeddings
6. Return labeled segments with timestamps
```

### Integration with Transcription Service

```typescript
// TranscriptionService runs diarization in parallel with STT
const [transcription, diarization] = await Promise.all([
  stt.transcribe(input, options),
  diarization?.diarize(input, diarizeOptions)
]);

// Assign speaker labels to utterances via overlap matching
for (const utterance of transcription.utterances) {
  const overlapping = findOverlappingSegments(utterance, diarization.segments);
  utterance.speaker_label = majorityVote(overlapping);
}
```

## Resource Requirements

| Aspect | GPU (CUDA) | CPU |
|--------|------------|-----|
| Speed | 3-5x realtime | 0.5-1x realtime |
| Memory | 2-3GB VRAM | 4-6GB RAM |
| Load time | 10-15s | 15-30s |

### Memory Optimization

For long recordings, process in chunks to avoid OOM:

```bash
# Extract 5-minute chunks with ffmpeg
ffmpeg -i input.mp4 -ss 0 -t 300 -ar 16000 -ac 1 chunk_01.wav
ffmpeg -i input.mp4 -ss 300 -t 300 -ar 16000 -ac 1 chunk_02.wav
# ... process each chunk, adjust timestamps
```

## Speaker Labels

Diarization assigns generic labels (`SPEAKER_00`, `SPEAKER_01`) that persist only within a single file. Cross-file speaker identification requires voice fingerprinting.

### Label Consistency

Within a file, labels are consistent. Across files or chunks:
- Same person may get different labels
- Use speaker embeddings for cross-file matching
- Fingerprinting stage resolves to known speaker profiles

## Integration Points

### Input
- Audio/video file (any format ffmpeg supports)
- Preprocessed WAV (16kHz mono recommended)
- Transcription service provides file path

### Output Consumers
- **Transcription**: Assigns speaker labels to utterances
- **Voice Fingerprinting**: Uses embeddings for speaker matching
- **Speaker Database**: Auto-creates profiles from diarization
- **Pipeline**: Stage 3 between transcribe and identify

### Embeddings for Fingerprinting

```typescript
// Diarization provides embeddings
const result = await diarizationPort.diarize(input);

// Pass to fingerprinting for speaker matching
for (const [label, embedding] of Object.entries(result.embeddings)) {
  const matches = await store.matchSpeakerByFingerprint(embedding, {
    threshold: 0.85
  });
  // Resolve SPEAKER_00 → actual speaker profile
}
```

## Error Handling

| Error | Cause | Solution |
|-------|-------|----------|
| `HuggingFace token required` | Missing HF_TOKEN | Set environment variable or .env |
| `Python not found` | Missing venv | Create ~/.venvs/ml with pyannote-audio |
| `CUDA out of memory` | File too long | Process in chunks |
| `Exit code 137` | OOM killed | Reduce chunk size or use CPU |
| `No speakers detected` | Silent audio | Check audio content |

## Device Selection

```typescript
// Auto-detect (default)
const config = { device: "auto" };  // Uses CUDA if available

// Force CPU (for long files with limited VRAM)
const config = { device: "cpu" };

// Force GPU (error if unavailable)
const config = { device: "cuda" };
```

### CUDA/cuDNN Setup

PyAnnote requires cuDNN libraries for GPU:

```bash
# nvidia-cudnn-cu12 installs to venv
~/.venvs/ml/bin/pip install nvidia-cudnn-cu12

# Add to LD_LIBRARY_PATH for ctranslate2
export LD_LIBRARY_PATH=~/.venvs/ml/lib/python3.*/site-packages/nvidia/cudnn/lib:$LD_LIBRARY_PATH
```

## Best Practices

1. **Specify speaker count** when known - improves accuracy
2. **Use GPU** for files under 30 minutes when available
3. **Process in chunks** for files over 30 minutes on limited RAM
4. **Denoise first** - cleaner audio improves segmentation
5. **Run with transcription** - parallel execution saves time

## Performance Tuning

### Accuracy vs Speed

```typescript
// Fast (fewer speakers assumed)
{ max_speakers: 3, min_segment_duration_ms: 1000 }

// Accurate (more thorough segmentation)
{ max_speakers: 10, min_segment_duration_ms: 300 }
```

### Overlapping Speech

PyAnnote 3.1 detects overlapping speech segments where multiple speakers talk simultaneously. These segments may have reduced confidence scores.

## Streaming (Future)

The port interface defines `diarizeStream()` but PyAnnote doesn't support true streaming yet. Current implementation processes complete files.

```typescript
// Port interface (not yet implemented)
async *diarizeStream(input, options): AsyncGenerator<DiarizationStreamEvent> {
  // Would yield segments as detected
}
```

## Related Sub-Skills

- **transcription**: Provides audio input, receives speaker-labeled output
- **voice-fingerprinting**: Uses embeddings for cross-file speaker matching
- **speaker-database**: Stores resolved speaker profiles
- **pipeline**: Orchestrates diarization as stage 3
