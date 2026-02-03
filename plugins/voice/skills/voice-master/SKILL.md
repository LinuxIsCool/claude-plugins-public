---
name: voice-master
description: Master skill for voice I/O (6 sub-skills). Covers: ElevenLabs API, TTS backends (HuggingFace, pyttsx3), STT backends (Whisper, Vosk, Deepgram), voice daemon, tmux voice control, agent voice mapping. Invoke for voice synthesis, speech recognition, voice commands, or agent-specific voices.
allowed-tools: Read, Bash, Glob, Grep, Task
---

# Voice Plugin - Master Skill

Voice input/output infrastructure for the Claude Code ecosystem.

## Sub-Skills Index

| Sub-Skill | Use When | File |
|-----------|----------|------|
| **elevenlabs** | ElevenLabs API, voice settings, models, latency optimization | `subskills/elevenlabs.md` |
| **backends** | Configuring TTS/STT backends, comparing options | `subskills/backends.md` |
| **daemon** | Managing the voice daemon, systemd setup | `subskills/daemon.md` |
| **tmux** | Voice-controlled tmux navigation | `subskills/tmux.md` |
| **identity** | Agent voice mapping, session overrides | `subskills/identity.md` |
| **troubleshoot** | Debugging voice issues, testing backends | `subskills/troubleshoot.md` |

## Quick Reference

### Test TTS

```typescript
import { speakAndPlay } from "@plugins/voice";

await speakAndPlay("Hello, this is a test.", {
  voiceId: "21m00Tcm4TlvDq8ikWAM",  // Rachel
  stability: 0.5,
});
```

### Check Available Backends

```typescript
import { getDefaultTTSFactory } from "@plugins/voice";

const factory = getDefaultTTSFactory();
const available = await factory.getAvailable();
console.log(`Using: ${available?.name()}`);
```

### Voice Identity Resolution

```typescript
import { resolveVoiceForSession } from "@plugins/voice";

const voice = await resolveVoiceForSession(sessionId, cwd);
// voice.source: "session" | "agent" | "model" | "system"
// voice.config: { backend, voiceId, settings }
```

## Architecture

```
┌─────────────────────────────────────────────┐
│              Voice Plugin                    │
├─────────────────────────────────────────────┤
│  Ports (Interfaces)                          │
│  ├── TTSPort                                 │
│  ├── STTPort                                 │
│  └── VADPort                                 │
├─────────────────────────────────────────────┤
│  Adapters (Implementations)                  │
│  ├── TTS: ElevenLabs, pyttsx3, (more)       │
│  ├── STT: (planned)                         │
│  └── VAD: (planned)                         │
├─────────────────────────────────────────────┤
│  Identity (Voice Resolution)                 │
│  ├── Session Override (statusline)          │
│  ├── Agent Profile (agentnet)               │
│  ├── Model Default (opus/sonnet/haiku)      │
│  └── System Default (pyttsx3)               │
├─────────────────────────────────────────────┤
│  Hooks (Claude Code Integration)            │
│  ├── SessionStart → Greeting                │
│  ├── Stop → Response summary                │
│  ├── Notification → Alert                   │
│  └── SubagentStop → Agent response          │
└─────────────────────────────────────────────┘
```

## TTS Backend Priority

| Priority | Backend | Type | Quality | Cost |
|----------|---------|------|---------|------|
| 100 | HuggingFace | Local | Excellent | Free |
| 90 | ElevenLabs | Cloud | Excellent | $0.30/1K chars |
| 80 | OpenAI | Cloud | Good | $0.015/1K chars |
| 70 | Piper | Local | Good | Free |
| 60 | Coqui | Local | Good | Free |
| 10 | pyttsx3 | Local | Basic | Free |

## Environment Variables

| Variable | Description |
|----------|-------------|
| `ELEVENLABS_API_KEY` | ElevenLabs API key |
| `OPENAI_API_KEY` | OpenAI API key (for TTS) |
| `HF_TOKEN` | HuggingFace token |
| `VOICE_DEBUG` | Set to "1" for debug logging |
| `VOICE_LOG_PATH` | Custom log path |

## Related Plugins

- **transcripts**: STT infrastructure (Whisper, PyAnnote)
- **messages**: Voice event logging
- **agentnet**: Agent voice profiles
- **statusline**: Session voice overrides
- **logging**: Hook patterns
