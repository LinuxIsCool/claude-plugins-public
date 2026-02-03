# Spec: HuggingFace XTTS v2 Adapter

**Component**: TTS Backend Adapter
**Priority**: Critical
**Estimated Effort**: 4-6 hours
**Dependencies**: CUDA toolkit, PyTorch with CUDA, TTS library

---

## Overview

Implement a high-quality, GPU-accelerated TTS adapter using Coqui's XTTS v2 model via HuggingFace/TTS library. This adapter will serve as the primary free alternative to ElevenLabs, offering voice cloning and multi-language support.

## Goals

1. Provide ElevenLabs-quality TTS without API costs
2. Support voice cloning from audio samples
3. Achieve <2s latency for typical responses (GPU)
4. Integrate seamlessly with existing TTS factory pattern

## Non-Goals

- Real-time streaming (batch synthesis only for v1)
- Training custom voices (use pre-trained + cloning)
- CPU optimization (GPU required for acceptable latency)

---

## Requirements

### System Requirements

```bash
# Must be installed before this component
sudo apt install nvidia-cuda-toolkit
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu121
pip install TTS  # Coqui TTS library
```

### Hardware Requirements

- NVIDIA GPU with 6-8GB VRAM minimum
- CUDA Compute Capability 7.0+ (RTX 20xx or newer)

---

## Interface Design

### TypeScript Adapter (Bun)

```typescript
// plugins/voice/src/adapters/tts/huggingface-xtts.ts

import type { TTSPort, TTSCapabilities, TTSOptions, TTSResult, VoiceInfo } from "../../ports/tts.js";

export interface XTTSConfig {
  modelPath?: string;           // Custom model path (default: auto-download)
  device?: "cuda" | "cpu";      // Default: cuda if available
  speakerWavDir?: string;       // Directory for voice clone samples
  defaultSpeaker?: string;      // Default speaker name or wav path
  language?: string;            // Default: "en"
}

export class HuggingFaceXTTSAdapter implements TTSPort {
  constructor(config?: XTTSConfig);

  name(): string;  // Returns "huggingface-xtts"
  capabilities(): TTSCapabilities;
  isAvailable(): Promise<boolean>;
  synthesize(text: string, options: TTSOptions): Promise<TTSResult>;
  listVoices(): Promise<VoiceInfo[]>;
  play(audio: Buffer): Promise<void>;

  // XTTS-specific methods
  cloneVoice(name: string, audioSamples: string[]): Promise<VoiceInfo>;
  getSpeakerEmbedding(wavPath: string): Promise<Float32Array>;
}
```

### Python Inference Server

The TypeScript adapter communicates with a Python subprocess for ML inference:

```python
# plugins/voice/src/adapters/tts/xtts_inference.py

"""
XTTS v2 Inference Server

Usage:
  python xtts_inference.py synthesize --text "Hello" --speaker default --output /tmp/audio.wav
  python xtts_inference.py list-speakers
  python xtts_inference.py clone --name "custom" --samples audio1.wav,audio2.wav

JSON-RPC mode (for IPC):
  python xtts_inference.py --json-rpc
  stdin: {"method": "synthesize", "params": {"text": "Hello", "speaker": "default"}}
  stdout: {"result": {"audio_path": "/tmp/audio.wav", "duration_ms": 1234}}
"""

from TTS.api import TTS
import torch
import json
import sys

class XTTSInference:
    def __init__(self, model_name: str = "tts_models/multilingual/multi-dataset/xtts_v2"):
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.tts = TTS(model_name).to(self.device)
        self.speakers = {}  # name -> embedding

    def synthesize(self, text: str, speaker: str, language: str = "en") -> dict:
        """Synthesize speech and return audio path + metadata."""
        pass

    def clone_voice(self, name: str, audio_paths: list[str]) -> dict:
        """Create speaker embedding from audio samples."""
        pass

    def list_speakers(self) -> list[dict]:
        """List available speakers (built-in + cloned)."""
        pass
```

---

## Implementation Guide

### File Structure

```
plugins/voice/src/adapters/tts/
├── huggingface-xtts.ts      # TypeScript adapter
├── xtts_inference.py        # Python inference server
├── xtts_speakers/           # Speaker embeddings cache
│   ├── default.json         # Default speaker config
│   └── {name}.npy          # Cached embeddings
└── index.ts                 # Update to include XTTS
```

### Step 1: Python Inference Server

Create `xtts_inference.py` with:

1. **Model Loading**
   ```python
   def __init__(self):
       self.tts = TTS("tts_models/multilingual/multi-dataset/xtts_v2")
       self.tts.to("cuda" if torch.cuda.is_available() else "cpu")
   ```

2. **Synthesis Method**
   ```python
   def synthesize(self, text: str, speaker_wav: str, language: str = "en") -> str:
       output_path = f"/tmp/xtts_{uuid.uuid4().hex}.wav"
       self.tts.tts_to_file(
           text=text,
           speaker_wav=speaker_wav,
           language=language,
           file_path=output_path
       )
       return output_path
   ```

3. **JSON-RPC Interface**
   ```python
   def handle_request(self, request: dict) -> dict:
       method = request.get("method")
       params = request.get("params", {})

       if method == "synthesize":
           path = self.synthesize(**params)
           return {"result": {"audio_path": path}}
       elif method == "list_speakers":
           return {"result": self.list_speakers()}
       # ... etc
   ```

### Step 2: TypeScript Adapter

Create `huggingface-xtts.ts` with:

1. **Process Management**
   ```typescript
   private pythonProcess: ChildProcess | null = null;

   private async ensureProcess(): Promise<void> {
     if (!this.pythonProcess) {
       this.pythonProcess = spawn("python3", [
         join(__dirname, "xtts_inference.py"),
         "--json-rpc"
       ]);
       // Setup stdin/stdout communication
     }
   }
   ```

2. **IPC Communication**
   ```typescript
   private async callPython(method: string, params: object): Promise<any> {
     await this.ensureProcess();

     const request = JSON.stringify({ method, params }) + "\n";
     this.pythonProcess.stdin.write(request);

     // Read response from stdout
     const response = await this.readResponse();
     return JSON.parse(response).result;
   }
   ```

3. **Synthesize Implementation**
   ```typescript
   async synthesize(text: string, options: TTSOptions): Promise<TTSResult> {
     const startTime = Date.now();

     const result = await this.callPython("synthesize", {
       text,
       speaker: options.voiceId || this.config.defaultSpeaker,
       language: options.language || "en",
     });

     const audio = await Bun.file(result.audio_path).arrayBuffer();

     return {
       audio: Buffer.from(audio),
       durationMs: result.duration_ms,
       format: "wav",
       processingTimeMs: Date.now() - startTime,
       charCount: text.length,
     };
   }
   ```

### Step 3: Update Factory

In `plugins/voice/src/adapters/tts/index.ts`:

```typescript
import { HuggingFaceXTTSAdapter } from "./huggingface-xtts.js";

const BACKEND_PRIORITY: Record<string, number> = {
  "huggingface-xtts": 100,  // Highest priority
  elevenlabs: 90,
  // ... existing backends
};

// In TTSFactory.create():
case "huggingface-xtts":
  adapter = new HuggingFaceXTTSAdapter(backendConfig);
  break;
```

---

## Voice Cloning

### Clone from Audio Sample

```typescript
// Usage
const adapter = new HuggingFaceXTTSAdapter();
const voice = await adapter.cloneVoice("agent-archivist", [
  "samples/archivist-sample-1.wav",
  "samples/archivist-sample-2.wav",
]);

// Now use in synthesis
await adapter.synthesize("Hello, I am the archivist.", {
  voiceId: "agent-archivist"
});
```

### Speaker Embedding Storage

```
.claude/voice/speakers/
├── agent-archivist.json    # Metadata
├── agent-archivist.npy     # Embedding vector
├── agent-mentor.json
└── agent-mentor.npy
```

---

## Testing Requirements

### Unit Tests

```typescript
// plugins/voice/specs/01-huggingface-xtts/tests/unit.test.ts

describe("HuggingFaceXTTSAdapter", () => {
  test("name returns correct identifier", () => {
    const adapter = new HuggingFaceXTTSAdapter();
    expect(adapter.name()).toBe("huggingface-xtts");
  });

  test("capabilities returns correct values", () => {
    const caps = adapter.capabilities();
    expect(caps.voiceCloning).toBe(true);
    expect(caps.local).toBe(true);
    expect(caps.streaming).toBe(false);
  });

  test("isAvailable returns false without CUDA", async () => {
    // Mock torch.cuda.is_available() = false
    const available = await adapter.isAvailable();
    expect(available).toBe(false);
  });
});
```

### Integration Tests

```typescript
// plugins/voice/specs/01-huggingface-xtts/tests/integration.test.ts

describe("XTTS Integration", () => {
  test("synthesizes speech with default speaker", async () => {
    const adapter = new HuggingFaceXTTSAdapter();
    const result = await adapter.synthesize("Hello world", {
      voiceId: "default"
    });

    expect(result.audio.length).toBeGreaterThan(1000);
    expect(result.format).toBe("wav");
    expect(result.processingTimeMs).toBeLessThan(5000);
  });

  test("clones voice from sample", async () => {
    const voice = await adapter.cloneVoice("test-voice", [
      "fixtures/sample.wav"
    ]);

    expect(voice.id).toBe("test-voice");
    expect(voice.name).toBe("test-voice");
  });

  test("synthesis with cloned voice", async () => {
    await adapter.cloneVoice("test", ["fixtures/sample.wav"]);
    const result = await adapter.synthesize("Test message", {
      voiceId: "test"
    });

    expect(result.audio.length).toBeGreaterThan(1000);
  });
});
```

### Performance Benchmarks

```typescript
// plugins/voice/specs/01-huggingface-xtts/tests/benchmark.test.ts

describe("XTTS Performance", () => {
  const testCases = [
    { name: "short", text: "Hello.", expectedMaxMs: 1500 },
    { name: "medium", text: "This is a medium length sentence for testing.", expectedMaxMs: 2000 },
    { name: "long", text: "This is a longer paragraph...".repeat(5), expectedMaxMs: 4000 },
  ];

  for (const tc of testCases) {
    test(`latency for ${tc.name} text`, async () => {
      const result = await adapter.synthesize(tc.text, { voiceId: "default" });
      expect(result.processingTimeMs).toBeLessThan(tc.expectedMaxMs);
    });
  }
});
```

---

## Integration Points

### With Voice Identity Resolver

```typescript
// In identity/resolver.ts
const voiceConfig = await resolveVoiceForAgent(agentId, cwd);

// voiceConfig.backend might be "huggingface-xtts"
// voiceConfig.voiceId might be "agent-archivist" (cloned voice)
```

### With Voice Hook

```typescript
// In hooks/voice-hook.ts
await speakAndPlay(text, options, "huggingface-xtts");
```

### With Quality Testing

```typescript
// Test against ElevenLabs baseline
const xttsResult = await xttsAdapter.synthesize(text, opts);
const elevenResult = await elevenAdapter.synthesize(text, opts);

// Compare latency
expect(xttsResult.processingTimeMs).toBeLessThan(elevenResult.processingTimeMs * 2);
```

---

## Success Criteria

1. [ ] Adapter synthesizes speech with <2s latency (GPU)
2. [ ] Voice cloning works with 1-3 audio samples
3. [ ] All 17 supported languages work
4. [ ] Integrates with existing TTS factory
5. [ ] Falls back gracefully when CUDA unavailable
6. [ ] Unit tests pass
7. [ ] Integration tests pass
8. [ ] Performance benchmarks meet targets

---

## Deliverables

```
plugins/voice/specs/01-huggingface-xtts/
├── SPEC.md                           # This file
├── src/
│   ├── huggingface-xtts.ts          # TypeScript adapter
│   └── xtts_inference.py            # Python inference server
├── tests/
│   ├── unit.test.ts
│   ├── integration.test.ts
│   └── benchmark.test.ts
├── fixtures/
│   └── sample.wav                   # Test audio sample
└── README.md                        # Usage documentation
```
