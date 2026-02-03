---
name: elevenlabs
description: ElevenLabs TTS API reference and integration. Use when configuring voices, optimizing latency, understanding voice settings (stability, similarity_boost, style), selecting models, or troubleshooting ElevenLabs issues. Complete API documentation with code examples.
allowed-tools: Read, Bash, WebFetch
---

# ElevenLabs API Reference

Complete documentation for ElevenLabs text-to-speech API integration.

## When to Use

- Configuring ElevenLabs voices and settings
- Optimizing TTS latency for real-time applications
- Understanding voice_settings parameters
- Selecting the right model (Flash vs Turbo vs Multilingual)
- Troubleshooting audio quality issues
- Implementing voice cloning
- Working with the ElevenLabs API directly

## Quick Reference

### Authentication

```
Header: xi-api-key: YOUR_API_KEY
```

### Base URL

```
https://api.elevenlabs.io/v1
```

### Common Voices

| Voice | ID | Gender | Style |
|-------|-----|--------|-------|
| Rachel | `21m00Tcm4TlvDq8ikWAM` | Female | Professional, calm |
| Adam | `pNInz6obpgDQGcFmaJgB` | Male | Deep, authoritative |
| Domi | `AZnzlk1XvdvUeBnXmlld` | Female | Conversational |
| Elli | `MF3mGyEYCl7XYWbV9V6O` | Female | Young, friendly |
| Antoni | `ErXwobaYiN019PkySvjV` | Male | Warm, narrative |
| Josh | `TxGEqnHWrfWFTfGW9XjX` | Male | Deep, storytelling |
| Arnold | `VR6AewLTigWG4xSOukaG` | Male | Strong, commanding |
| Sam | `yoZ06aMxZJJ28mfd3POQ` | Male | Relaxed, casual |
| Fin | `D38z5RcWu1voky8WS1ja` | Male | Irish accent |
| Sarah | `EXAVITQu4vr4xnSDxMaL` | Female | Soft, gentle |

---

## Models

### Model Comparison

| Model ID | Name | Languages | Latency | Quality | Cost | Best For |
|----------|------|-----------|---------|---------|------|----------|
| `eleven_flash_v2_5` | Flash v2.5 | 32 | ~75ms | Good | 1 credit/2 chars | Real-time agents, chatbots |
| `eleven_turbo_v2_5` | Turbo v2.5 | 32 | ~150ms | Excellent | 1 credit/char | Professional content, audiobooks |
| `eleven_multilingual_v2` | Multilingual v2 | 29 | ~300ms | Best | 1 credit/char | Highest quality, dubbing |
| `eleven_monolingual_v1` | English v1 | 1 | ~200ms | Good | 1 credit/char | Legacy, English only |

### Model Selection Guide

**Use Flash v2.5 when:**
- Building voice agents or chatbots
- Real-time interactive applications
- Latency is critical (<100ms first byte)
- Processing large volumes of text

**Use Turbo v2.5 when:**
- Creating professional content
- Audiobook narration
- Video narration
- Quality matters more than latency

**Use Multilingual v2 when:**
- Highest quality is required
- Creating dubbing content
- Complex emotional performances
- Non-English content

---

## Text-to-Speech Endpoints

### POST /text-to-speech/{voice_id}

Convert text to speech audio.

**Endpoint:** `POST https://api.elevenlabs.io/v1/text-to-speech/{voice_id}`

**Headers:**
```json
{
  "Content-Type": "application/json",
  "xi-api-key": "YOUR_API_KEY"
}
```

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `voice_id` | string | Yes | Voice ID (use /voices endpoint to list) |

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `output_format` | string | `mp3_44100_128` | Audio format (see Output Formats) |
| `optimize_streaming_latency` | integer | 0 | 0-4, higher = lower latency |
| `enable_logging` | boolean | true | Set false for zero retention (enterprise) |

**Request Body:**
```json
{
  "text": "Hello, this is a test.",
  "model_id": "eleven_turbo_v2_5",
  "voice_settings": {
    "stability": 0.5,
    "similarity_boost": 0.75,
    "style": 0.0,
    "use_speaker_boost": true,
    "speed": 1.0
  },
  "language_code": "en",
  "seed": 12345,
  "previous_text": "",
  "next_text": "",
  "pronunciation_dictionary_locators": []
}
```

**Response:** Binary audio data (application/octet-stream)

### POST /text-to-speech/{voice_id}/stream

Stream audio as it's generated (chunked transfer encoding).

**Endpoint:** `POST https://api.elevenlabs.io/v1/text-to-speech/{voice_id}/stream`

Same parameters as non-streaming endpoint.

**Response:** `text/event-stream` with binary audio chunks

---

## Voice Settings

### Parameters

| Parameter | Type | Range | Default | Description |
|-----------|------|-------|---------|-------------|
| `stability` | float | 0.0-1.0 | 0.5 | Voice consistency vs expressiveness |
| `similarity_boost` | float | 0.0-1.0 | 0.75 | Adherence to original voice |
| `style` | float | 0.0-1.0 | 0.0 | Style exaggeration (increases latency) |
| `use_speaker_boost` | boolean | - | true | Boost similarity to original speaker |
| `speed` | float | 0.5-2.0 | 1.0 | Speech rate multiplier |

### Stability

Controls the randomness between generations:

- **Low (0.0-0.3):** More expressive, emotional, varied. May sound unstable.
- **Medium (0.4-0.6):** Balanced expressiveness and consistency. Recommended starting point.
- **High (0.7-1.0):** Very consistent, potentially monotonous. Good for narration.

**Tip:** For dramatic performances, use lower stability and generate multiple times until you get a good take.

### Similarity Boost

Controls how closely the AI adheres to the original voice:

- **Low (0.0-0.3):** More creative interpretation, less like original.
- **Medium (0.4-0.7):** Balanced similarity. Good for most uses.
- **High (0.8-1.0):** Very close to original. May reproduce artifacts if source quality is poor.

**Warning:** High similarity with low-quality source audio may reproduce background noise.

### Style

Amplifies the speaker's style characteristics:

- **0.0:** No style amplification (fastest)
- **0.1-0.3:** Subtle style enhancement
- **0.4-1.0:** Strong style (increases latency significantly)

**Note:** Non-zero style values add latency. Keep at 0 for real-time applications.

### Speed

Adjusts speech rate:

- **0.5:** Half speed (slow, deliberate)
- **1.0:** Normal speed
- **1.5:** 50% faster
- **2.0:** Double speed (fast)

### Recommended Settings by Use Case

| Use Case | Stability | Similarity | Style | Speed |
|----------|-----------|------------|-------|-------|
| **Conversational AI** | 0.5 | 0.75 | 0.0 | 1.0 |
| **Audiobook** | 0.6 | 0.8 | 0.2 | 0.95 |
| **News/Narration** | 0.7 | 0.75 | 0.0 | 1.0 |
| **Character Voice** | 0.3 | 0.7 | 0.5 | varies |
| **Announcements** | 0.8 | 0.75 | 0.0 | 1.0 |

---

## Output Formats

### MP3 Formats

| Format | Sample Rate | Bitrate | Use Case |
|--------|-------------|---------|----------|
| `mp3_22050_32` | 22.05 kHz | 32 kbps | Low bandwidth |
| `mp3_24000_48` | 24 kHz | 48 kbps | Balanced |
| `mp3_44100_32` | 44.1 kHz | 32 kbps | High sample, low bitrate |
| `mp3_44100_64` | 44.1 kHz | 64 kbps | Good quality |
| `mp3_44100_96` | 44.1 kHz | 96 kbps | High quality |
| `mp3_44100_128` | 44.1 kHz | 128 kbps | **Default**, excellent |
| `mp3_44100_192` | 44.1 kHz | 192 kbps | Best MP3 quality |

### PCM Formats (Raw Audio)

| Format | Sample Rate | Use Case |
|--------|-------------|----------|
| `pcm_8000` | 8 kHz | Telephony |
| `pcm_16000` | 16 kHz | Voice applications |
| `pcm_22050` | 22.05 kHz | Standard audio |
| `pcm_24000` | 24 kHz | Good quality |
| `pcm_32000` | 32 kHz | High quality |
| `pcm_44100` | 44.1 kHz | CD quality |
| `pcm_48000` | 48 kHz | Professional audio |

### Opus Formats

| Format | Sample Rate | Bitrate |
|--------|-------------|---------|
| `opus_48000_32` | 48 kHz | 32 kbps |
| `opus_48000_64` | 48 kHz | 64 kbps |
| `opus_48000_96` | 48 kHz | 96 kbps |
| `opus_48000_128` | 48 kHz | 128 kbps |
| `opus_48000_192` | 48 kHz | 192 kbps |

### Legacy Formats

| Format | Use Case |
|--------|----------|
| `ulaw_8000` | Legacy telephony (US) |
| `alaw_8000` | Legacy telephony (Europe) |

---

## Voice Endpoints

### GET /voices

List all available voices.

**Response:**
```json
{
  "voices": [
    {
      "voice_id": "21m00Tcm4TlvDq8ikWAM",
      "name": "Rachel",
      "samples": null,
      "category": "premade",
      "fine_tuning": { "is_allowed_to_fine_tune": false },
      "labels": {
        "accent": "american",
        "description": "calm",
        "age": "young",
        "gender": "female",
        "use_case": "narration"
      },
      "description": "A calm, professional voice.",
      "preview_url": "https://...",
      "available_for_tiers": [],
      "settings": null,
      "sharing": null,
      "high_quality_base_model_ids": ["eleven_multilingual_v2"],
      "safety_control": null
    }
  ]
}
```

### GET /voices/{voice_id}

Get details for a specific voice.

### GET /voices/settings/default

Get default voice settings.

**Response:**
```json
{
  "stability": 0.5,
  "similarity_boost": 0.75,
  "style": 0.0,
  "use_speaker_boost": true,
  "speed": 1.0
}
```

### GET /voices/{voice_id}/settings

Get settings for a specific voice.

### POST /voices/{voice_id}/settings/edit

Update voice settings.

**Request Body:**
```json
{
  "stability": 0.5,
  "similarity_boost": 0.75,
  "style": 0.0,
  "use_speaker_boost": true,
  "speed": 1.0
}
```

---

## Voice Cloning

### Instant Voice Cloning (IVC)

Quick voice cloning from audio samples.

**POST /voices/add**

```
Content-Type: multipart/form-data

Fields:
- name: Voice name
- description: Voice description
- files: Audio files (up to 25 samples)
- labels: JSON object with labels
```

**Requirements:**
- Clean audio, minimal background noise
- Consistent voice (same speaker throughout)
- 1-5 minutes of audio recommended
- Supported formats: MP3, WAV, M4A, etc.

### Professional Voice Cloning (PVC)

High-quality voice cloning with training.

1. Create voice: `POST /voices/add`
2. Add samples: `POST /voices/{voice_id}/samples`
3. Train: `POST /voices/{voice_id}/train`
4. Verify (captcha or manual)

**Requirements:**
- More audio samples (5-30 minutes)
- Higher quality audio
- Verification process
- Takes longer to train

---

## Latency Optimization

### optimize_streaming_latency Parameter

| Value | Effect |
|-------|--------|
| 0 | Default, no optimization |
| 1 | Some optimizations |
| 2 | Moderate optimizations |
| 3 | Aggressive optimizations |
| 4 | Maximum optimization + text normalizer disabled |

**Tradeoffs:**
- Higher values may reduce pronunciation accuracy
- Level 4 disables text normalization (numbers, abbreviations)
- Use with LLM-normalized text for best results

### Best Practices for Low Latency

1. **Use Flash v2.5 model** (~75ms first byte)
2. **Set optimize_streaming_latency=3 or 4**
3. **Pre-normalize text** with your LLM before sending
4. **Use streaming endpoint** (`/stream`)
5. **Keep style=0** (non-zero adds latency)
6. **Use PCM output** for fastest decoding
7. **Chunk long text** into sentences

### Example: Optimal Latency Configuration

```json
{
  "text": "Hello, how can I help you today?",
  "model_id": "eleven_flash_v2_5",
  "voice_settings": {
    "stability": 0.5,
    "similarity_boost": 0.75,
    "style": 0.0,
    "use_speaker_boost": false
  }
}
```

Query: `?optimize_streaming_latency=4&output_format=pcm_24000`

---

## Error Handling

### Common Errors

| Status | Error | Solution |
|--------|-------|----------|
| 401 | Invalid API key | Check xi-api-key header |
| 422 | Validation error | Check request body format |
| 429 | Rate limited | Reduce request frequency |
| 500 | Server error | Retry with exponential backoff |

### Rate Limits

- Vary by subscription tier
- Check `X-RateLimit-*` headers in response
- Implement exponential backoff for 429 errors

---

## Code Examples

### TypeScript/Bun

```typescript
import { ElevenLabsAdapter } from "./elevenlabs";

const adapter = new ElevenLabsAdapter({
  apiKey: process.env.ELEVENLABS_API_KEY,
  defaultModel: "eleven_turbo_v2_5",
});

const result = await adapter.synthesize("Hello world", {
  voiceId: "21m00Tcm4TlvDq8ikWAM",
  stability: 0.5,
  similarityBoost: 0.75,
});

await adapter.play(result.audio);
```

### cURL

```bash
curl -X POST "https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM" \
  -H "xi-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Hello world",
    "model_id": "eleven_turbo_v2_5",
    "voice_settings": {
      "stability": 0.5,
      "similarity_boost": 0.75
    }
  }' \
  --output speech.mp3
```

### Python

```python
from elevenlabs import ElevenLabs

client = ElevenLabs(api_key="YOUR_API_KEY")

audio = client.text_to_speech.convert(
    voice_id="21m00Tcm4TlvDq8ikWAM",
    text="Hello world",
    model_id="eleven_turbo_v2_5",
    voice_settings={
        "stability": 0.5,
        "similarity_boost": 0.75
    }
)
```

---

## Integration with Voice Plugin

### Default Voice Resolution

The voice plugin resolves voices in this order:

1. **Session override** (`.claude/voice/sessions/{session_id}.json`)
2. **Agent profile** (`.claude/voice/agents/{agent_type}.json`)
3. **Model default** (opus/sonnet/haiku mapping)
4. **System default** (Rachel voice)

### Agent Voice Configuration

```json
// .claude/voice/agents/backend-architect.json
{
  "backend": "elevenlabs",
  "voiceId": "pNInz6obpgDQGcFmaJgB",
  "settings": {
    "stability": 0.6,
    "similarityBoost": 0.8,
    "style": 0.1
  }
}
```

### Model Voice Defaults

| Model | Voice | Rationale |
|-------|-------|-----------|
| Opus | Adam (deep, authoritative) | Matches Opus's thoughtful nature |
| Sonnet | Rachel (professional) | Balanced, clear |
| Haiku | Elli (young, quick) | Matches Haiku's speed |

---

## Resources

- [ElevenLabs API Reference](https://elevenlabs.io/docs/api-reference)
- [Voice Library](https://elevenlabs.io/voice-library)
- [Pricing](https://elevenlabs.io/pricing)
- [Status Page](https://status.elevenlabs.io/)
