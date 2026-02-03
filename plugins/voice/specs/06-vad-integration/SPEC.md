# Spec: Voice Activity Detection (VAD) Integration

**Component**: Audio Processing
**Priority**: High
**Estimated Effort**: 2-3 hours
**Dependencies**: Silero VAD, torch

---

## Overview

Implement Voice Activity Detection using Silero VAD to accurately detect speech segments in audio streams. VAD is essential for the voice daemon to know when the user is speaking vs. silent.

## Goals

1. Accurate speech detection with low latency
2. Configurable sensitivity (threshold)
3. Support for both batch and streaming modes
4. Minimal resource usage

## Non-Goals

- Speaker identification
- Emotion detection
- Custom VAD model training

---

## Interface Design

### TypeScript Interface

```typescript
// plugins/voice/src/ports/vad.ts

export interface VADPort {
  name(): string;
  isAvailable(): Promise<boolean>;

  // Process single audio chunk
  process(audio: Buffer): Promise<VADResult>;

  // Process continuous stream
  processStream(
    audioStream: AsyncIterable<Buffer>
  ): AsyncIterable<SpeechSegment>;

  // Configuration
  setThreshold(threshold: number): void;
  getThreshold(): number;
}

export interface VADResult {
  isSpeech: boolean;
  probability: number;
  timestamp?: number;
}

export interface SpeechSegment {
  audio: Buffer;
  startTime: number;  // seconds
  endTime: number;    // seconds
  probability: number;
}

export interface VADConfig {
  threshold?: number;         // 0.0-1.0, default 0.5
  minSpeechDurationMs?: number;   // Default 250ms
  maxSpeechDurationS?: number;    // Default 30s
  minSilenceDurationMs?: number;  // Default 100ms
  speechPadMs?: number;           // Default 30ms
  sampleRate?: number;            // Default 16000
  windowSizeMs?: number;          // Default 32ms (512 samples at 16kHz)
}
```

### Python Backend

```python
# plugins/voice/src/adapters/vad/silero_vad.py

"""
Silero VAD Integration

High-performance voice activity detection using Silero models.
"""

import torch
import numpy as np
from typing import Iterator, Tuple
from collections import deque

class SileroVAD:
    def __init__(
        self,
        threshold: float = 0.5,
        sample_rate: int = 16000,
        min_speech_duration_ms: int = 250,
        max_speech_duration_s: float = 30.0,
        min_silence_duration_ms: int = 100,
        speech_pad_ms: int = 30,
    ):
        self.threshold = threshold
        self.sample_rate = sample_rate
        self.min_speech_duration_ms = min_speech_duration_ms
        self.max_speech_duration_s = max_speech_duration_s
        self.min_silence_duration_ms = min_silence_duration_ms
        self.speech_pad_ms = speech_pad_ms

        # Load Silero VAD model
        self.model, self.utils = torch.hub.load(
            repo_or_dir='snakers4/silero-vad',
            model='silero_vad',
            force_reload=False,
            onnx=False,  # Use PyTorch for flexibility
        )

        self.get_speech_timestamps = self.utils[0]
        self.save_audio = self.utils[1]
        self.read_audio = self.utils[2]
        self.collect_chunks = self.utils[4]

        # For streaming mode
        self.reset_state()

    def reset_state(self):
        """Reset internal state for new stream."""
        self.model.reset_states()
        self.speech_buffer = []
        self.is_speaking = False
        self.speech_start_time = None
        self.current_time = 0.0

    def process_chunk(self, audio: np.ndarray) -> dict:
        """
        Process a single audio chunk.

        Args:
            audio: Audio samples as float32 numpy array, shape (samples,)

        Returns:
            dict with 'is_speech', 'probability'
        """
        # Ensure correct shape and type
        if audio.dtype != np.float32:
            audio = audio.astype(np.float32)

        if len(audio.shape) > 1:
            audio = audio.squeeze()

        # Normalize to [-1, 1]
        if np.abs(audio).max() > 1.0:
            audio = audio / 32768.0

        # Convert to tensor
        audio_tensor = torch.from_numpy(audio)

        # Get speech probability
        speech_prob = self.model(audio_tensor, self.sample_rate).item()

        return {
            'is_speech': speech_prob >= self.threshold,
            'probability': speech_prob,
        }

    def process_stream(
        self,
        audio_chunks: Iterator[np.ndarray],
        chunk_duration_ms: int = 32,
    ) -> Iterator[dict]:
        """
        Process audio stream and yield speech segments.

        Args:
            audio_chunks: Iterator of audio chunks
            chunk_duration_ms: Duration of each chunk in ms

        Yields:
            Speech segments with 'audio', 'start_time', 'end_time'
        """
        self.reset_state()

        chunk_duration_s = chunk_duration_ms / 1000.0
        min_speech_chunks = self.min_speech_duration_ms // chunk_duration_ms
        min_silence_chunks = self.min_silence_duration_ms // chunk_duration_ms

        silence_count = 0
        speech_chunks = []

        for chunk in audio_chunks:
            result = self.process_chunk(chunk)

            if result['is_speech']:
                silence_count = 0

                if not self.is_speaking:
                    self.is_speaking = True
                    self.speech_start_time = self.current_time

                speech_chunks.append(chunk)

            else:  # Silence
                if self.is_speaking:
                    silence_count += 1
                    speech_chunks.append(chunk)  # Include padding

                    # End of speech segment?
                    if silence_count >= min_silence_chunks:
                        if len(speech_chunks) >= min_speech_chunks:
                            yield {
                                'audio': np.concatenate(speech_chunks),
                                'start_time': self.speech_start_time,
                                'end_time': self.current_time,
                                'probability': result['probability'],
                            }

                        # Reset for next segment
                        self.is_speaking = False
                        speech_chunks = []
                        silence_count = 0

            self.current_time += chunk_duration_s

    def get_speech_timestamps_batch(
        self,
        audio: np.ndarray,
    ) -> list[dict]:
        """
        Get speech timestamps for complete audio file.

        Args:
            audio: Complete audio as numpy array

        Returns:
            List of speech segments with start/end timestamps
        """
        if audio.dtype != np.float32:
            audio = audio.astype(np.float32)

        audio_tensor = torch.from_numpy(audio)

        speech_timestamps = self.get_speech_timestamps(
            audio_tensor,
            self.model,
            threshold=self.threshold,
            sampling_rate=self.sample_rate,
            min_speech_duration_ms=self.min_speech_duration_ms,
            max_speech_duration_s=self.max_speech_duration_s,
            min_silence_duration_ms=self.min_silence_duration_ms,
            speech_pad_ms=self.speech_pad_ms,
        )

        return [
            {
                'start': ts['start'] / self.sample_rate,
                'end': ts['end'] / self.sample_rate,
            }
            for ts in speech_timestamps
        ]


# JSON-RPC interface for TypeScript communication
def main():
    import json
    import sys

    vad = SileroVAD()

    for line in sys.stdin:
        request = json.loads(line)
        method = request.get('method')
        params = request.get('params', {})

        if method == 'process_chunk':
            audio = np.frombuffer(
                bytes.fromhex(params['audio_hex']),
                dtype=np.int16
            ).astype(np.float32) / 32768.0

            result = vad.process_chunk(audio)
            print(json.dumps({'result': result}))

        elif method == 'set_threshold':
            vad.threshold = params['threshold']
            print(json.dumps({'result': {'ok': True}}))

        elif method == 'reset':
            vad.reset_state()
            print(json.dumps({'result': {'ok': True}}))

        sys.stdout.flush()


if __name__ == '__main__':
    main()
```

---

## Implementation Guide

### TypeScript Adapter

```typescript
// plugins/voice/src/adapters/vad/silero.ts

import { spawn, ChildProcess } from "child_process";
import { join } from "path";
import type { VADPort, VADConfig, VADResult, SpeechSegment } from "../../ports/vad.js";

export class SileroVADAdapter implements VADPort {
  private config: VADConfig;
  private pythonProcess: ChildProcess | null = null;
  private responseBuffer: string = "";
  private pendingResolve: ((value: any) => void) | null = null;

  constructor(config: VADConfig = {}) {
    this.config = {
      threshold: config.threshold ?? 0.5,
      minSpeechDurationMs: config.minSpeechDurationMs ?? 250,
      maxSpeechDurationS: config.maxSpeechDurationS ?? 30,
      minSilenceDurationMs: config.minSilenceDurationMs ?? 100,
      speechPadMs: config.speechPadMs ?? 30,
      sampleRate: config.sampleRate ?? 16000,
      windowSizeMs: config.windowSizeMs ?? 32,
    };
  }

  name(): string {
    return "silero";
  }

  async isAvailable(): Promise<boolean> {
    try {
      const { execSync } = await import("child_process");
      execSync("python3 -c 'import torch'", { stdio: "ignore" });
      return true;
    } catch {
      return false;
    }
  }

  private async ensureProcess(): Promise<void> {
    if (this.pythonProcess) return;

    const scriptPath = join(__dirname, "silero_vad.py");

    this.pythonProcess = spawn("python3", [scriptPath]);

    this.pythonProcess.stdout!.on("data", (data: Buffer) => {
      this.responseBuffer += data.toString();

      const lines = this.responseBuffer.split("\n");
      for (let i = 0; i < lines.length - 1; i++) {
        const line = lines[i].trim();
        if (line && this.pendingResolve) {
          try {
            const response = JSON.parse(line);
            this.pendingResolve(response.result);
            this.pendingResolve = null;
          } catch (e) {
            console.error("Failed to parse VAD response:", line);
          }
        }
      }
      this.responseBuffer = lines[lines.length - 1];
    });

    // Wait for initialization
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  private async callPython(method: string, params: object): Promise<any> {
    await this.ensureProcess();

    return new Promise((resolve, reject) => {
      this.pendingResolve = resolve;

      const request = JSON.stringify({ method, params }) + "\n";
      this.pythonProcess!.stdin!.write(request);

      setTimeout(() => {
        if (this.pendingResolve === resolve) {
          this.pendingResolve = null;
          reject(new Error("VAD timeout"));
        }
      }, 5000);
    });
  }

  async process(audio: Buffer): Promise<VADResult> {
    // Convert buffer to hex for JSON transport
    const audioHex = audio.toString("hex");

    const result = await this.callPython("process_chunk", {
      audio_hex: audioHex,
    });

    return {
      isSpeech: result.is_speech,
      probability: result.probability,
    };
  }

  async *processStream(
    audioStream: AsyncIterable<Buffer>
  ): AsyncIterable<SpeechSegment> {
    // Reset state
    await this.callPython("reset", {});

    const minSpeechChunks = Math.ceil(
      this.config.minSpeechDurationMs! / this.config.windowSizeMs!
    );
    const minSilenceChunks = Math.ceil(
      this.config.minSilenceDurationMs! / this.config.windowSizeMs!
    );

    let isSpeaking = false;
    let silenceCount = 0;
    let speechChunks: Buffer[] = [];
    let speechStartTime = 0;
    let currentTime = 0;

    const chunkDurationS = this.config.windowSizeMs! / 1000;

    for await (const chunk of audioStream) {
      const result = await this.process(chunk);

      if (result.isSpeech) {
        silenceCount = 0;

        if (!isSpeaking) {
          isSpeaking = true;
          speechStartTime = currentTime;
        }

        speechChunks.push(chunk);

      } else {  // Silence
        if (isSpeaking) {
          silenceCount++;
          speechChunks.push(chunk);  // Include padding

          if (silenceCount >= minSilenceChunks) {
            if (speechChunks.length >= minSpeechChunks) {
              yield {
                audio: Buffer.concat(speechChunks),
                startTime: speechStartTime,
                endTime: currentTime,
                probability: result.probability,
              };
            }

            isSpeaking = false;
            speechChunks = [];
            silenceCount = 0;
          }
        }
      }

      currentTime += chunkDurationS;
    }
  }

  setThreshold(threshold: number): void {
    this.config.threshold = threshold;
    this.callPython("set_threshold", { threshold }).catch(() => {});
  }

  getThreshold(): number {
    return this.config.threshold!;
  }

  async close(): Promise<void> {
    if (this.pythonProcess) {
      this.pythonProcess.kill();
      this.pythonProcess = null;
    }
  }
}

export function createSileroVAD(config?: VADConfig): SileroVADAdapter {
  return new SileroVADAdapter(config);
}
```

---

## Testing Requirements

### Unit Tests

```typescript
// plugins/voice/specs/06-vad-integration/tests/unit.test.ts

describe("SileroVADAdapter", () => {
  test("name returns silero", () => {
    const vad = new SileroVADAdapter();
    expect(vad.name()).toBe("silero");
  });

  test("threshold can be set and retrieved", () => {
    const vad = new SileroVADAdapter({ threshold: 0.7 });
    expect(vad.getThreshold()).toBe(0.7);

    vad.setThreshold(0.3);
    expect(vad.getThreshold()).toBe(0.3);
  });
});
```

### Integration Tests

```typescript
// plugins/voice/specs/06-vad-integration/tests/integration.test.ts

describe("VAD Integration", () => {
  test("detects speech in audio", async () => {
    const vad = new SileroVADAdapter();
    const speechAudio = await Bun.file("fixtures/speech.raw").arrayBuffer();

    const result = await vad.process(Buffer.from(speechAudio));

    expect(result.isSpeech).toBe(true);
    expect(result.probability).toBeGreaterThan(0.5);
  });

  test("detects silence in audio", async () => {
    const vad = new SileroVADAdapter();
    const silenceAudio = Buffer.alloc(512 * 2);  // 512 samples of silence

    const result = await vad.process(silenceAudio);

    expect(result.isSpeech).toBe(false);
    expect(result.probability).toBeLessThan(0.5);
  });

  test("streams speech segments", async () => {
    const vad = new SileroVADAdapter();
    const audio = await Bun.file("fixtures/speech-with-pauses.raw").arrayBuffer();

    // Split into chunks
    const chunkSize = 512 * 2;  // 512 samples, 16-bit
    const chunks: Buffer[] = [];
    for (let i = 0; i < audio.byteLength; i += chunkSize) {
      chunks.push(Buffer.from(audio.slice(i, i + chunkSize)));
    }

    async function* audioStream() {
      for (const chunk of chunks) {
        yield chunk;
      }
    }

    const segments: SpeechSegment[] = [];
    for await (const segment of vad.processStream(audioStream())) {
      segments.push(segment);
    }

    expect(segments.length).toBeGreaterThan(0);
    expect(segments[0]).toHaveProperty("startTime");
    expect(segments[0]).toHaveProperty("endTime");
  });
});
```

---

## Success Criteria

1. [ ] Detects speech with >95% accuracy on test set
2. [ ] False positive rate <5% on silence/noise
3. [ ] Latency <10ms per chunk
4. [ ] Streaming mode yields correct segments
5. [ ] Threshold adjustment works dynamically

---

## Deliverables

```
plugins/voice/specs/06-vad-integration/
├── SPEC.md
├── src/
│   ├── silero.ts
│   └── silero_vad.py
├── tests/
│   ├── unit.test.ts
│   └── integration.test.ts
├── fixtures/
│   ├── speech.raw
│   ├── silence.raw
│   └── speech-with-pauses.raw
└── README.md
```
