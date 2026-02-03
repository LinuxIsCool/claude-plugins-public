# Voice Plugin Architecture

*Infrastructure-first design for comprehensive voice capabilities*

## Vision

Create the **ears and voice** of the Claude ecosystem:
- Always-on voice daemon that listens to everything
- Multi-backend STT/TTS with hexagonal architecture
- Integration with AgentNet, Statusline, Messages, and Logging
- Voice-controlled tmux navigation and Claude input
- Agent-specific voices for multi-agent conversations

---

## Core Components

```
┌─────────────────────────────────────────────────────────────────────┐
│                        VOICE DAEMON (systemd)                        │
│  Always-on background service managing audio input/output            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐          │
│  │ Audio Input  │───▶│     VAD      │───▶│Intent Router │          │
│  │  (PulseAudio │    │ (Silero/     │    │              │          │
│  │   /ALSA)     │    │  WebRTC)     │    └──────┬───────┘          │
│  └──────────────┘    └──────────────┘           │                   │
│                                                  │                   │
│         ┌────────────────────────────┬──────────┴────────┐          │
│         ▼                            ▼                   ▼          │
│  ┌──────────────┐           ┌──────────────┐    ┌──────────────┐   │
│  │ Tmux Router  │           │ Claude Input │    │ System Cmd   │   │
│  │ (Navigation) │           │ (Streaming)  │    │ (Search, etc)│   │
│  └──────────────┘           └──────────────┘    └──────────────┘   │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        CLAUDE CODE HOOKS                             │
│  Event-driven TTS responses via Stop, Notification, etc.             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  SessionStart ──▶ Voice Greeting (agent-specific voice)              │
│  UserPromptSubmit ──▶ Acknowledgment (optional)                      │
│  Stop ──▶ Response Summary (agent-specific voice)                    │
│  Notification ──▶ Alert (urgent voice)                               │
│  SubagentStop ──▶ Subagent Response (subagent voice)                 │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      INTEGRATION LAYER                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  AgentNet ──────▶ Voice profiles per agent (voice_id, settings)      │
│  Statusline ────▶ Session overrides, instance-specific voices        │
│  Messages ──────▶ Voice events as messages (searchable)              │
│  Logging ───────▶ Voice session transcripts (JSONL + markdown)       │
│  Transcripts ───▶ Reuse STT infrastructure (whisper, diarization)    │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 1. Hexagonal Architecture: Ports & Adapters

### 1.1 STT Port

```typescript
// src/ports/stt.ts

interface STTCapabilities {
  streaming: boolean;           // Real-time transcription
  batch: boolean;               // File-based transcription
  word_timestamps: boolean;     // Word-level timing
  speaker_diarization: boolean; // Speaker separation
  languages: string[];          // Supported languages
  vad_included: boolean;        // Built-in VAD
  local: boolean;               // Runs locally (no API)
  cost_per_hour?: number;       // API cost estimate
}

interface STTOptions {
  language?: string;
  model?: string;
  streaming?: boolean;
  vad_threshold?: number;
  initial_prompt?: string;
}

interface STTResult {
  text: string;
  segments: Array<{
    text: string;
    start_ms: number;
    end_ms: number;
    speaker?: string;
    confidence?: number;
  }>;
  language: string;
  processing_time_ms: number;
}

type StreamingEvent =
  | { type: "partial"; text: string; is_final: boolean }
  | { type: "final"; result: STTResult }
  | { type: "vad"; is_speech: boolean }
  | { type: "error"; error: Error };

interface STTPort {
  name(): string;
  capabilities(): STTCapabilities;
  isAvailable(): Promise<boolean>;

  // Batch mode
  transcribe(audio: AudioInput, options?: STTOptions): Promise<STTResult>;

  // Streaming mode (optional)
  transcribeStream?(
    audioStream: AsyncIterable<AudioChunk>,
    options?: STTOptions
  ): AsyncGenerator<StreamingEvent>;
}
```

### 1.2 TTS Port

```typescript
// src/ports/tts.ts

interface TTSCapabilities {
  voices: Array<{
    id: string;
    name: string;
    gender: "male" | "female" | "neutral";
    language: string;
    preview_url?: string;
  }>;
  streaming: boolean;           // Streaming audio output
  voice_cloning: boolean;       // Custom voice support
  ssml: boolean;                // SSML markup support
  emotions: boolean;            // Emotional expression
  local: boolean;               // Runs locally
  cost_per_char?: number;       // API cost estimate
}

interface TTSOptions {
  voice_id: string;
  model?: string;
  speed?: number;               // 0.5 - 2.0
  pitch?: number;               // Semitones
  stability?: number;           // ElevenLabs-style
  similarity_boost?: number;
  style?: number;
  output_format?: "mp3" | "wav" | "ogg" | "pcm";
}

interface TTSResult {
  audio: Buffer | AsyncIterable<Buffer>;
  duration_ms: number;
  format: string;
  processing_time_ms: number;
}

interface TTSPort {
  name(): string;
  capabilities(): TTSCapabilities;
  isAvailable(): Promise<boolean>;

  // Synthesis
  synthesize(text: string, options: TTSOptions): Promise<TTSResult>;

  // Streaming (optional)
  synthesizeStream?(
    text: string,
    options: TTSOptions
  ): AsyncGenerator<Buffer>;

  // Playback helper
  play?(audio: Buffer): Promise<void>;
}
```

### 1.3 VAD Port (Voice Activity Detection)

```typescript
// src/ports/vad.ts

interface VADCapabilities {
  streaming: boolean;
  min_speech_ms: number;
  min_silence_ms: number;
  local: boolean;
}

interface VADOptions {
  threshold?: number;           // 0.0 - 1.0
  min_speech_duration_ms?: number;
  min_silence_duration_ms?: number;
  speech_pad_ms?: number;
}

interface VADResult {
  is_speech: boolean;
  probability: number;
  start_ms?: number;
  end_ms?: number;
}

interface VADPort {
  name(): string;
  capabilities(): VADCapabilities;
  isAvailable(): Promise<boolean>;

  // Process audio chunk
  process(audio: AudioChunk, options?: VADOptions): VADResult;

  // Streaming
  processStream?(
    audioStream: AsyncIterable<AudioChunk>,
    options?: VADOptions
  ): AsyncGenerator<VADResult>;
}
```

---

## 2. Adapter Implementations

### 2.1 STT Adapters

| Adapter | Type | Latency | Cost | Features |
|---------|------|---------|------|----------|
| **FasterWhisperAdapter** | Local/Batch | ~15s/5min | Free | GPU, high accuracy, reuse from transcripts |
| **WhisperStreamAdapter** | Local/Stream | ~500ms | Free | Lower latency, continuous recognition |
| **DeepgramAdapter** | Cloud/Stream | ~300ms | $0.01/min | Fastest streaming, speaker ID |
| **AssemblyAIAdapter** | Cloud/Stream | ~400ms | $0.01/min | Good accuracy, formatting |
| **VoskAdapter** | Local/Stream | ~200ms | Free | Offline, lightweight, many languages |
| **WhisperCppStreamAdapter** | Local/Stream | ~400ms | Free | whisper.cpp streaming mode |

### 2.2 TTS Adapters

| Adapter | Type | Latency | Cost | Features |
|---------|------|---------|------|----------|
| **HuggingFaceAdapter** | Local | ~2s | Free | XTTS, Bark, custom models |
| **ElevenLabsAdapter** | Cloud | ~500ms | $0.30/1K chars | Best quality, voice cloning |
| **OpenAIAdapter** | Cloud | ~600ms | $0.015/1K chars | Good quality, simple API |
| **CoquiAdapter** | Local | ~1.5s | Free | XTTS-v2, multi-speaker |
| **Pyttsx3Adapter** | Local | ~100ms | Free | Fallback, no setup |
| **EdgeTTSAdapter** | Cloud | ~300ms | Free | Microsoft Edge voices |
| **PiperAdapter** | Local | ~200ms | Free | Fast local, many voices |
| **F5TTSAdapter** | Local | ~1s | Free | HuggingFace, emotion control |

### 2.3 VAD Adapters

| Adapter | Type | Features |
|---------|------|----------|
| **SileroVADAdapter** | Local | Best accuracy, PyTorch |
| **WebRTCVADAdapter** | Local | Fastest, lightweight |
| **PyAnnoteVADAdapter** | Local | Integrated with diarization |

---

## 3. Voice Daemon Architecture

### 3.1 Daemon Components

```
voice-daemon/
├── src/
│   ├── daemon.ts              # Main daemon process
│   ├── audio/
│   │   ├── capture.ts         # Audio input capture (PulseAudio/ALSA)
│   │   ├── playback.ts        # Audio output playback
│   │   └── buffer.ts          # Ring buffer for continuous audio
│   ├── vad/
│   │   └── processor.ts       # VAD processing pipeline
│   ├── router/
│   │   ├── intent.ts          # Intent classification
│   │   ├── tmux.ts            # Tmux command routing
│   │   ├── claude.ts          # Claude input routing
│   │   └── system.ts          # System command routing
│   ├── ipc/
│   │   ├── server.ts          # Unix socket server
│   │   └── protocol.ts        # IPC message protocol
│   └── config/
│       └── schema.ts          # Configuration schema
├── systemd/
│   └── voice-daemon.service   # Systemd service file
└── scripts/
    ├── install.sh             # Installation script
    └── uninstall.sh           # Removal script
```

### 3.2 IPC Protocol

The daemon communicates with Claude instances via Unix sockets:

```typescript
// IPC Message Types
type IPCMessage =
  | { type: "transcript"; text: string; session_id: string }
  | { type: "command"; action: "submit" | "cancel" | "pause" | "resume" }
  | { type: "status"; listening: boolean; vad_active: boolean }
  | { type: "speak"; text: string; voice_id: string; priority: number }
  | { type: "configure"; config: Partial<VoiceConfig> };

// Socket path
const SOCKET_PATH = "/run/user/{uid}/voice-daemon.sock";
```

### 3.3 Intent Classification

```typescript
interface IntentClassifier {
  classify(transcript: string): Intent;
}

type Intent =
  | { type: "tmux"; action: TmuxAction }
  | { type: "claude_input"; text: string; target?: string }
  | { type: "claude_submit" }
  | { type: "system"; action: SystemAction }
  | { type: "dictation"; text: string };

// Tmux Actions
type TmuxAction =
  | { action: "switch_pane"; direction: "left" | "right" | "up" | "down" }
  | { action: "switch_window"; index: number | "next" | "prev" }
  | { action: "switch_session"; name: string }
  | { action: "create_window" }
  | { action: "create_pane"; direction: "horizontal" | "vertical" }
  | { action: "close_pane" }
  | { action: "zoom_pane" };
```

### 3.4 Wake Word / Command Prefix

```typescript
interface WakeWordConfig {
  enabled: boolean;

  // Wake phrases for different contexts
  wake_phrases: {
    tmux: string[];      // e.g., ["hey tmux", "terminal"]
    claude: string[];    // e.g., ["hey claude", "assistant"]
    system: string[];    // e.g., ["computer", "system"]
  };

  // Continuous listening without wake word
  continuous_mode: {
    enabled: boolean;
    require_confirmation: boolean;  // "Did you say...?"
  };
}
```

---

## 4. Voice Identity System

### 4.1 Layered Voice Configuration

```
Priority (highest to lowest):
1. Session Override (statusline) - ephemeral per-session voice
2. Agent Profile (agentnet)    - persistent agent voice
3. Model Default              - opus/sonnet/haiku fallback
4. System Default             - global fallback voice
```

### 4.2 AgentNet Voice Profile Extension

```yaml
# .claude/social/profiles/backend-architect.yaml
---
id: backend-architect
name: Backend Architect
role: Senior backend engineer perspective
model: opus

# Voice configuration
voice:
  # Primary voice (used by default)
  primary:
    backend: elevenlabs
    voice_id: "adam"           # ElevenLabs voice ID
    settings:
      stability: 0.5
      similarity_boost: 0.75
      style: 0.3

  # Fallback chain
  fallbacks:
    - backend: openai
      voice_id: "onyx"
    - backend: piper
      voice_id: "en_US-lessac-high"
    - backend: pyttsx3
      voice_id: null  # System default

  # Emotion mappings (future)
  emotions:
    excited: { style: 0.8, speed: 1.1 }
    thoughtful: { stability: 0.7, speed: 0.9 }
    concerned: { stability: 0.4, speed: 0.95 }

stats:
  postCount: 5
  voiceInteractions: 42
  lastSpoke: 2025-12-19T09:30:00Z
---
```

### 4.3 Default Voice Mappings

```typescript
// config/voice-defaults.ts

export const MODEL_VOICE_DEFAULTS: Record<string, VoiceConfig> = {
  opus: {
    elevenlabs: { voice_id: "adam", stability: 0.5 },
    openai: { voice_id: "onyx" },
    piper: { voice_id: "en_US-lessac-high" },
  },
  sonnet: {
    elevenlabs: { voice_id: "rachel", stability: 0.6 },
    openai: { voice_id: "nova" },
    piper: { voice_id: "en_US-amy-high" },
  },
  haiku: {
    elevenlabs: { voice_id: "elli", stability: 0.7 },
    openai: { voice_id: "shimmer" },
    piper: { voice_id: "en_US-jenny-high" },
  },
};

export const AGENT_VOICE_DEFAULTS: Record<string, Partial<VoiceConfig>> = {
  "archivist": { elevenlabs: { voice_id: "antoni" } },
  "librarian": { elevenlabs: { voice_id: "domi" } },
  "systems-thinker": { elevenlabs: { voice_id: "fin" } },
  // ... more agents
};
```

---

## 5. Hook Integration

### 5.1 Plugin Configuration

```json
// plugins/voice/.claude-plugin/plugin.json
{
  "name": "voice",
  "version": "0.1.0",
  "description": "Voice input/output for Claude Code ecosystem",
  "hooks": {
    "SessionStart": [{
      "hooks": [{
        "type": "command",
        "command": "bun ${CLAUDE_PLUGIN_ROOT}/hooks/voice-hook.ts SessionStart"
      }]
    }],
    "UserPromptSubmit": [{
      "hooks": [{
        "type": "command",
        "command": "bun ${CLAUDE_PLUGIN_ROOT}/hooks/voice-hook.ts UserPromptSubmit"
      }]
    }],
    "Stop": [{
      "hooks": [{
        "type": "command",
        "command": "bun ${CLAUDE_PLUGIN_ROOT}/hooks/voice-hook.ts Stop"
      }]
    }],
    "Notification": [{
      "hooks": [{
        "type": "command",
        "command": "bun ${CLAUDE_PLUGIN_ROOT}/hooks/voice-hook.ts Notification"
      }]
    }],
    "SubagentStop": [{
      "hooks": [{
        "type": "command",
        "command": "bun ${CLAUDE_PLUGIN_ROOT}/hooks/voice-hook.ts SubagentStop"
      }]
    }]
  },
  "skills": ["./skills/"],
  "commands": ["./commands/"],
  "agents": ["./agents/voice-conductor.md"]
}
```

### 5.2 Unified Voice Hook

```typescript
// hooks/voice-hook.ts

import { getVoiceForSession, speak, log } from "../src/index";

async function main() {
  const event = process.argv[2];
  const data = JSON.parse(await readStdin());

  const { session_id, cwd, transcript_path } = data;

  // Get voice config for this session
  const voice = await getVoiceForSession(session_id, cwd);

  switch (event) {
    case "SessionStart":
      await speak("Ready.", voice, { priority: "low" });
      break;

    case "Stop":
      const response = extractResponse(transcript_path);
      const summary = await summarizeForVoice(response);
      await speak(summary, voice, { priority: "normal" });
      break;

    case "Notification":
      await speak("I need your attention.", voice, { priority: "high" });
      break;

    case "SubagentStop":
      const agentVoice = await getVoiceForAgent(data.agent_id);
      const agentSummary = await summarizeSubagent(data);
      await speak(agentSummary, agentVoice, { priority: "normal" });
      break;
  }

  // Log voice event to messages
  await logVoiceEvent(event, session_id, { voice, text: summary });
}
```

---

## 6. Messages Integration

### 6.1 Voice Message Kinds

```typescript
// Message kinds for voice events (3000-3099 range)
export const VoiceKind = {
  // Input events
  STT_TRANSCRIPT: 3000,        // Voice-to-text transcript
  STT_PARTIAL: 3001,           // Partial recognition result
  VAD_START: 3002,             // Speech started
  VAD_END: 3003,               // Speech ended

  // Output events
  TTS_REQUEST: 3010,           // TTS synthesis requested
  TTS_COMPLETE: 3011,          // TTS playback completed

  // Control events
  VOICE_SESSION_START: 3020,   // Voice session started
  VOICE_SESSION_END: 3021,     // Voice session ended

  // Commands
  TMUX_COMMAND: 3030,          // Voice-triggered tmux command
  CLAUDE_INPUT: 3031,          // Voice input to Claude
  SYSTEM_COMMAND: 3032,        // Voice system command
};
```

### 6.2 Voice Message Schema

```typescript
interface VoiceMessage {
  kind: number;
  content: string;              // Transcript or TTS text
  account_id: string;           // "user" or agent_id
  created_at: number;

  // Voice-specific metadata
  tags: Array<[string, string]>;
  // e.g., [
  //   ["stt_backend", "faster-whisper"],
  //   ["tts_backend", "elevenlabs"],
  //   ["voice_id", "adam"],
  //   ["duration_ms", "2340"],
  //   ["confidence", "0.95"],
  //   ["language", "en"],
  // ]

  refs: {
    session_id?: string;        // Claude session
    thread_id?: string;         // Voice session thread
    reply_to?: string;          // Previous voice message
  };
}
```

---

## 7. File Structure

```
plugins/voice/
├── .claude-plugin/
│   └── plugin.json             # Plugin configuration with hooks
├── src/
│   ├── ports/                  # Port interfaces
│   │   ├── stt.ts
│   │   ├── tts.ts
│   │   └── vad.ts
│   ├── adapters/               # Backend implementations
│   │   ├── stt/
│   │   │   ├── faster-whisper.ts
│   │   │   ├── whisper-stream.ts
│   │   │   ├── deepgram.ts
│   │   │   ├── vosk.ts
│   │   │   └── index.ts        # Factory
│   │   ├── tts/
│   │   │   ├── huggingface.ts
│   │   │   ├── elevenlabs.ts
│   │   │   ├── openai.ts
│   │   │   ├── coqui.ts
│   │   │   ├── piper.ts
│   │   │   ├── pyttsx3.ts
│   │   │   └── index.ts        # Factory with priority
│   │   └── vad/
│   │       ├── silero.ts
│   │       ├── webrtc.ts
│   │       └── index.ts
│   ├── daemon/                 # Voice daemon
│   │   ├── index.ts            # Main daemon entry
│   │   ├── audio/
│   │   │   ├── capture.ts
│   │   │   ├── playback.ts
│   │   │   └── buffer.ts
│   │   ├── router/
│   │   │   ├── intent.ts
│   │   │   ├── tmux.ts
│   │   │   └── claude.ts
│   │   └── ipc/
│   │       ├── server.ts
│   │       └── protocol.ts
│   ├── identity/               # Voice identity management
│   │   ├── resolver.ts         # Layered voice resolution
│   │   ├── agentnet.ts         # AgentNet integration
│   │   └── statusline.ts       # Statusline integration
│   ├── integration/            # Plugin integrations
│   │   ├── messages.ts         # Messages plugin bridge
│   │   ├── logging.ts          # Logging plugin bridge
│   │   └── transcripts.ts      # Transcripts plugin reuse
│   └── index.ts                # Main exports
├── hooks/
│   └── voice-hook.ts           # Unified hook handler
├── daemon/
│   ├── systemd/
│   │   └── voice-daemon.service
│   └── scripts/
│       ├── install.sh
│       └── uninstall.sh
├── skills/
│   └── voice-master/
│       ├── SKILL.md            # Master skill
│       └── subskills/
│           ├── backends.md     # Backend configuration
│           ├── daemon.md       # Daemon management
│           ├── tmux.md         # Tmux voice control
│           └── troubleshoot.md # Troubleshooting
├── commands/
│   └── voice.md                # /voice command
├── agents/
│   └── voice-conductor.md      # Voice orchestration agent
├── config/
│   ├── default.yaml            # Default configuration
│   └── voice-defaults.ts       # Voice mappings
├── tests/
│   ├── adapters/
│   └── integration/
└── README.md
```

---

## 8. Configuration

### 8.1 Main Configuration File

```yaml
# ~/.config/voice-daemon/config.yaml

daemon:
  enabled: true
  autostart: true
  socket_path: /run/user/1000/voice-daemon.sock
  log_level: info
  log_path: ~/.local/share/voice-daemon/logs/

audio:
  input_device: default
  output_device: default
  sample_rate: 16000
  channels: 1
  buffer_size_ms: 100

vad:
  backend: silero
  threshold: 0.5
  min_speech_ms: 250
  min_silence_ms: 1000
  speech_pad_ms: 300

stt:
  # Priority order for backend selection
  backends:
    - name: faster-whisper
      enabled: true
      config:
        model: large-v3
        device: cuda
    - name: vosk
      enabled: true
      config:
        model_path: ~/.local/share/vosk/model-en
    - name: deepgram
      enabled: false
      config:
        api_key: ${DEEPGRAM_API_KEY}

  # Streaming vs batch mode
  mode: streaming
  streaming_backend: vosk  # For real-time
  batch_backend: faster-whisper  # For final transcript

tts:
  # Priority order for backend selection
  backends:
    - name: huggingface
      enabled: true
      config:
        model: xtts-v2
        device: cuda
    - name: elevenlabs
      enabled: true
      config:
        api_key: ${ELEVENLABS_API_KEY}
    - name: openai
      enabled: true
      config:
        api_key: ${OPENAI_API_KEY}
    - name: piper
      enabled: true
      config:
        model_path: ~/.local/share/piper/voices/
    - name: pyttsx3
      enabled: true  # Always available fallback

wake:
  enabled: true
  phrases:
    tmux: ["hey tmux", "terminal"]
    claude: ["hey claude", "assistant", "claude"]
    system: ["computer"]
  continuous_mode: false

tmux:
  enabled: true
  commands:
    # Voice phrases mapped to tmux commands
    "switch left": "select-pane -L"
    "switch right": "select-pane -R"
    "switch up": "select-pane -U"
    "switch down": "select-pane -D"
    "next window": "next-window"
    "previous window": "previous-window"
    "new window": "new-window"
    "split horizontal": "split-window -h"
    "split vertical": "split-window -v"
    "close pane": "kill-pane"
    "zoom": "resize-pane -Z"

claude:
  enabled: true
  target: auto  # auto-detect active claude instance
  streaming_input: true  # Stream text as you speak
  submit_phrase: "send it"  # Phrase to submit
  cancel_phrase: "cancel"   # Phrase to cancel

logging:
  enabled: true
  events:
    stt: true
    tts: true
    commands: true
  messages_integration: true  # Log to messages plugin
```

---

## 9. Implementation Phases

### Phase 1: Core Infrastructure (Week 1)
- [ ] Port interfaces (STT, TTS, VAD)
- [ ] Basic adapters (faster-whisper, elevenlabs, pyttsx3, silero)
- [ ] Voice identity resolver (agentnet integration)
- [ ] Hook integration (Stop hook TTS)

### Phase 2: Daemon Foundation (Week 2)
- [ ] Audio capture (PulseAudio)
- [ ] VAD processing pipeline
- [ ] IPC server
- [ ] Systemd service

### Phase 3: Claude Integration (Week 3)
- [ ] Claude input streaming
- [ ] Submit/cancel voice commands
- [ ] Session-aware voice routing
- [ ] Messages plugin integration

### Phase 4: Tmux Control (Week 4)
- [ ] Intent classification
- [ ] Tmux command mapping
- [ ] Wake word detection
- [ ] Multi-target routing

### Phase 5: Advanced Features (Week 5+)
- [ ] Additional STT/TTS backends
- [ ] Voice emotion detection
- [ ] Multi-speaker support
- [ ] Document/ebook reader
- [ ] Agent voice conversations

---

## 10. Research: Additional TTS Options

| Backend | Type | Quality | Latency | Cost | Notes |
|---------|------|---------|---------|------|-------|
| **Piper** | Local | Good | Fast | Free | ONNX, many voices, 200ms |
| **F5-TTS** | Local | Excellent | Medium | Free | HuggingFace, emotion control |
| **Parler-TTS** | Local | Good | Medium | Free | HuggingFace, descriptive prompts |
| **StyleTTS2** | Local | Excellent | Slow | Free | Best local quality |
| **Edge-TTS** | Cloud | Good | Fast | Free | Microsoft Edge voices |
| **Google TTS** | Cloud | Good | Fast | Free (limited) | gTTS library |
| **Amazon Polly** | Cloud | Good | Fast | $4/1M chars | AWS integration |
| **Azure TTS** | Cloud | Excellent | Fast | $4/1M chars | Many neural voices |
| **PlayHT** | Cloud | Excellent | Medium | $0.05/1K chars | Voice cloning |
| **Resemble.ai** | Cloud | Excellent | Medium | Custom | Voice cloning |
| **Tortoise-TTS** | Local | Excellent | Very Slow | Free | Best quality, too slow |
| **Bark** | Local | Good | Slow | Free | Emotional, non-verbal sounds |
| **SpeechT5** | Local | Medium | Fast | Free | Lightweight |

### Recommended Priority Order

1. **HuggingFace (XTTS-v2, F5-TTS)** - Best local quality with GPU
2. **ElevenLabs** - Best cloud quality
3. **Piper** - Fastest local option
4. **OpenAI** - Reliable cloud backup
5. **Edge-TTS** - Free cloud option
6. **pyttsx3** - Universal fallback

---

## 11. Dependencies

```json
// package.json
{
  "dependencies": {
    // Audio
    "naudiodon": "^2.x",        // Cross-platform audio I/O

    // IPC
    "socket.io": "^4.x",        // WebSocket for IPC

    // TTS clients
    "elevenlabs": "^0.x",
    "openai": "^4.x",

    // Local inference
    "onnxruntime-node": "^1.x", // For Piper, Silero

    // Utilities
    "dotenv": "^16.x",
    "zod": "^3.x",
    "commander": "^11.x"
  }
}
```

```python
# Python dependencies (for local ML)
# requirements.txt
torch>=2.0
torchaudio>=2.0
faster-whisper>=0.10
pyannote.audio>=3.1
silero-vad>=4.0
TTS>=0.22  # Coqui
pyttsx3>=2.90
sounddevice>=0.4
numpy>=1.24
```

---

*Document created: 2025-12-19*
*Status: Architecture Design Phase*
