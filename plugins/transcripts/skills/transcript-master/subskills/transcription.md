# Transcription Sub-Skill

## Overview

Convert audio/video files to text using configurable backends.

## Supported Backends

| Backend | Mode | Requires | Best For |
|---------|------|----------|----------|
| `whisper` | Local | whisper.cpp | Privacy, offline |
| `whisper-local` | Local | whisper.cpp | Explicit local |
| `whisper-api` | API | OpenAI API key | Speed, accuracy |

## Model Selection

| Model | Size | Speed | Accuracy | Use Case |
|-------|------|-------|----------|----------|
| `tiny` | 39M | Fastest | Basic | Quick drafts |
| `base` | 74M | Fast | Good | Default |
| `small` | 244M | Medium | Better | General use |
| `medium` | 769M | Slow | Very good | Important recordings |
| `large-v3` | 1.5G | Slowest | Best | Critical transcription |

## Transcription Workflow

```
1. Check backend availability
2. Validate input file
3. Run transcription
4. Parse segments into utterances
5. Create transcript entity
6. Store events + content file
```

## MCP Tool: transcripts_transcribe

```json
{
  "file_path": "/path/to/audio.mp3",
  "title": "Optional title",
  "backend": "whisper",
  "language": "en",
  "model": "base"
}
```

## Language Support

Whisper supports 99 languages. Common codes:
- `en` - English
- `es` - Spanish
- `zh` - Chinese
- `fr` - French
- `de` - German
- `ja` - Japanese
- `ko` - Korean

Leave blank for auto-detection.

## Output Format

Transcripts are stored as:
1. **Event** in JSONL (source of truth)
2. **Markdown file** with speaker-attributed utterances

Example markdown:
```markdown
---
id: tx_abc123...
status: complete
created_at: 1705347200000
---

# Meeting Recording

**[0:00] Speaker:** Welcome everyone to today's meeting.

**[0:15] Speaker:** Let's start with the agenda.
```

## Error Handling

| Error | Cause | Solution |
|-------|-------|----------|
| Backend not available | Missing whisper.cpp | Install whisper.cpp |
| API key required | No OpenAI key | Set apiKey in config |
| File not found | Invalid path | Check file exists |
| Unsupported format | Bad audio format | Convert to wav/mp3 |

## Performance Tips

1. **Pre-convert to WAV**: Whisper prefers 16kHz mono WAV
2. **Use smaller models** for long recordings
3. **Batch large files**: Split into chunks for progress
4. **GPU acceleration**: Use CUDA-enabled whisper.cpp
