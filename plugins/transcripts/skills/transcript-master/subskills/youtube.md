# YouTube Transcript Extraction Sub-Skill

## Overview

Extract transcripts from YouTube videos and integrate them into the transcript pipeline.

## Capabilities

| Feature | Description |
|---------|-------------|
| **Caption Extraction** | Extract existing captions (manual or auto-generated) |
| **Multi-language** | Support for any language with available captions |
| **Audio Fallback** | Download audio and transcribe with Whisper when no captions |
| **Metadata Enrichment** | Include channel, view count, upload date, thumbnail |
| **Pipeline Integration** | Output compatible with existing transcript store |

## Usage

### Basic Extraction

```bash
# From URL
python scripts/youtube-transcript.py "https://www.youtube.com/watch?v=VIDEO_ID"

# From video ID directly
python scripts/youtube-transcript.py VIDEO_ID

# Save to file
python scripts/youtube-transcript.py VIDEO_ID -o transcript.json

# To staging directory (for import-to-store.py)
python scripts/youtube-transcript.py VIDEO_ID --to-staging
```

### Options

| Option | Description |
|--------|-------------|
| `--output, -o PATH` | Output JSON file path |
| `--language, -l LANG` | Preferred caption language (default: en) |
| `--audio` | Download audio and transcribe with Whisper (fallback) |
| `--title TITLE` | Override video title |
| `--to-staging` | Output to `.claude/transcripts/staging/` |
| `--quiet, -q` | Minimal output |

### Extraction Methods

The script tries methods in order:

1. **youtube-transcript-api** (fastest, no download)
   - Accesses YouTube's caption API directly
   - Works with manual and auto-generated captions
   - No video download required

2. **yt-dlp subtitles** (fallback)
   - Downloads subtitle files (VTT format)
   - Parses and converts to transcript format
   - Works when API access fails

3. **Audio + Whisper** (--audio flag)
   - Downloads audio with yt-dlp
   - Transcribes with faster-whisper
   - Use when no captions available

## Dependencies

### Required
- Python 3.8+

### For Caption Extraction
```bash
pip install youtube-transcript-api
```

### For yt-dlp Fallback
```bash
pip install yt-dlp webvtt-py
# or
brew install yt-dlp  # macOS
```

### For Audio Transcription
```bash
pip install faster-whisper yt-dlp
```

## Output Format

The script produces plugin-compatible JSON:

```json
{
  "id": "yt_abc123...",
  "title": "Video Title",
  "source": {
    "mode": "youtube",
    "video_id": "VIDEO_ID",
    "url": "https://www.youtube.com/watch?v=VIDEO_ID",
    "channel": "Channel Name",
    "channel_id": "UC...",
    "upload_date": "20250115",
    "duration_seconds": 1234,
    "view_count": 50000,
    "thumbnail": "https://..."
  },
  "utterances": [
    {
      "index": 0,
      "speaker": {"id": "spk_unknown", "name": "Unknown Speaker"},
      "text": "Transcript text here",
      "start_ms": 0,
      "end_ms": 5000,
      "confidence": {
        "transcription": 0.9,
        "speaker": 0.0,
        "timing": 0.95
      }
    }
  ],
  "processing": {
    "backend": "youtube-captions",
    "source": "auto",
    "duration_ms": 123000
  },
  "status": "complete",
  "created_at": 1704067200000,
  "updated_at": 1704067200000
}
```

## Pipeline Integration

### Import to Event Store

After extraction, import to the transcript store:

```bash
# Extract to staging
python scripts/youtube-transcript.py VIDEO_ID --to-staging

# Import to store
python scripts/import-to-store.py .claude/transcripts/staging/TIMESTAMP-yt-VIDEO_ID.json
```

### Emit to Messages Plugin

Once imported, emit utterances as messages:

```typescript
await transcripts_emit_to_messages({
  transcript_id: "yt_abc123..."
});
```

## Examples

### Quick Extraction

```bash
# Get transcript and print to stdout
python scripts/youtube-transcript.py "https://youtu.be/kFpLzCVLA20"
```

### Full Pipeline

```bash
# Extract with staging
python scripts/youtube-transcript.py VIDEO_ID --to-staging

# Find the staging file
ls -la .claude/transcripts/staging/

# Import to store
python scripts/import-to-store.py .claude/transcripts/staging/*.json
```

### Batch Processing

```bash
# Process multiple videos
for url in $(cat video_urls.txt); do
  python scripts/youtube-transcript.py "$url" --to-staging --quiet
done

# Import all
for f in .claude/transcripts/staging/*.json; do
  python scripts/import-to-store.py "$f"
done
```

### No Captions Available

```bash
# Use audio transcription fallback
python scripts/youtube-transcript.py VIDEO_ID --audio -o transcript.json
```

## Supported URL Formats

- `https://www.youtube.com/watch?v=VIDEO_ID`
- `https://youtu.be/VIDEO_ID`
- `https://www.youtube.com/embed/VIDEO_ID`
- `https://www.youtube.com/shorts/VIDEO_ID`
- `VIDEO_ID` (direct 11-character ID)

## Limitations

1. **Private/Unlisted Videos**: May not work without authentication
2. **Age-Restricted**: May require authentication
3. **Live Streams**: Captions may not be available until stream ends
4. **Region Locks**: Some videos restricted by geography

## Troubleshooting

### "No captions available"
- Try `--audio` flag for Whisper transcription
- Check if video has captions enabled
- Try different `--language` option

### "youtube-transcript-api not installed"
```bash
pip install youtube-transcript-api
```

### "yt-dlp failed"
```bash
pip install --upgrade yt-dlp
# or
yt-dlp -U
```

### Slow Whisper Transcription
- Use smaller model: modify script to use "tiny" instead of "base"
- Ensure CUDA available for GPU acceleration

## Related Sub-Skills

- **transcription**: Audio/video file transcription
- **pipeline**: Full processing workflow
- **messages-integration**: Emit to messages plugin
