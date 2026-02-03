# Spec: Whisper STT Adapter

**Component**: STT Backend Adapter
**Priority**: High
**Estimated Effort**: 3-4 hours
**Dependencies**: faster-whisper, CUDA (optional)

---

## Overview

Implement a speech-to-text adapter using OpenAI's Whisper model via the faster-whisper library. This provides high-accuracy transcription for voice commands and dictation with optional GPU acceleration.

## Goals

1. Accurate speech-to-text with <10% WER
2. Support multiple model sizes (tiny → large)
3. GPU acceleration when available
4. Language detection and multi-language support
5. Word-level timestamps (optional)

## Non-Goals

- Real-time streaming (batch mode for v1)
- Speaker diarization
- Training/fine-tuning

---

## Interface Design

### TypeScript Adapter

```typescript
// plugins/voice/src/adapters/stt/whisper.ts

import type { STTPort, STTCapabilities, STTOptions, STTResult } from "../../ports/stt.js";

export interface WhisperConfig {
  model?: "tiny" | "base" | "small" | "medium" | "large-v3";
  language?: string;           // Default: auto-detect
  device?: "cuda" | "cpu";     // Default: cuda if available
  computeType?: "int8" | "float16" | "float32";  // Default: int8
  beamSize?: number;           // Default: 5
  vadFilter?: boolean;         // Default: true
}

export class WhisperAdapter implements STTPort {
  constructor(config?: WhisperConfig);

  name(): string;  // Returns "whisper"
  capabilities(): STTCapabilities;
  isAvailable(): Promise<boolean>;
  transcribe(audio: Buffer, options?: STTOptions): Promise<STTResult>;

  // Whisper-specific
  detectLanguage(audio: Buffer): Promise<string>;
  getWordTimestamps(audio: Buffer): Promise<WordTimestamp[]>;
}

interface WordTimestamp {
  word: string;
  start: number;  // seconds
  end: number;    // seconds
  confidence: number;
}
```

### Python Backend

```python
# plugins/voice/src/adapters/stt/whisper_inference.py

"""
Whisper STT Inference Server

Uses faster-whisper for optimized CPU/GPU inference.

Usage:
  python whisper_inference.py transcribe --audio /tmp/audio.wav --model base
  python whisper_inference.py --json-rpc  # IPC mode
"""

from faster_whisper import WhisperModel
import json
import sys
import numpy as np
from pathlib import Path

class WhisperInference:
    def __init__(self, model_size: str = "base", device: str = "auto", compute_type: str = "int8"):
        self.device = device if device != "auto" else ("cuda" if self._has_cuda() else "cpu")
        self.compute_type = compute_type if self.device == "cuda" else "int8"

        self.model = WhisperModel(
            model_size,
            device=self.device,
            compute_type=self.compute_type,
        )

    def _has_cuda(self) -> bool:
        try:
            import torch
            return torch.cuda.is_available()
        except ImportError:
            return False

    def transcribe(
        self,
        audio_path: str,
        language: str = None,
        beam_size: int = 5,
        vad_filter: bool = True,
        word_timestamps: bool = False,
    ) -> dict:
        """Transcribe audio file."""
        segments, info = self.model.transcribe(
            audio_path,
            language=language,
            beam_size=beam_size,
            vad_filter=vad_filter,
            word_timestamps=word_timestamps,
        )

        # Collect segments
        text_parts = []
        words = []

        for segment in segments:
            text_parts.append(segment.text)

            if word_timestamps and segment.words:
                for word in segment.words:
                    words.append({
                        "word": word.word,
                        "start": word.start,
                        "end": word.end,
                        "confidence": word.probability,
                    })

        return {
            "text": " ".join(text_parts).strip(),
            "language": info.language,
            "language_probability": info.language_probability,
            "duration": info.duration,
            "words": words if word_timestamps else None,
        }

    def detect_language(self, audio_path: str) -> dict:
        """Detect spoken language."""
        _, info = self.model.transcribe(audio_path, task="detect_language")
        return {
            "language": info.language,
            "probability": info.language_probability,
        }


def main():
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument("--json-rpc", action="store_true", help="Run in JSON-RPC mode")
    parser.add_argument("command", nargs="?", choices=["transcribe", "detect"])
    parser.add_argument("--audio", help="Audio file path")
    parser.add_argument("--model", default="base", help="Model size")
    parser.add_argument("--language", help="Language code")
    parser.add_argument("--device", default="auto", help="Device (cuda/cpu/auto)")

    args = parser.parse_args()

    whisper = WhisperInference(
        model_size=args.model,
        device=args.device,
    )

    if args.json_rpc:
        # JSON-RPC mode for IPC
        for line in sys.stdin:
            request = json.loads(line)
            method = request.get("method")
            params = request.get("params", {})

            if method == "transcribe":
                result = whisper.transcribe(**params)
            elif method == "detect_language":
                result = whisper.detect_language(**params)
            else:
                result = {"error": f"Unknown method: {method}"}

            print(json.dumps({"result": result}))
            sys.stdout.flush()

    elif args.command == "transcribe":
        result = whisper.transcribe(args.audio, language=args.language)
        print(json.dumps(result, indent=2))

    elif args.command == "detect":
        result = whisper.detect_language(args.audio)
        print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
```

---

## Implementation Guide

### File Structure

```
plugins/voice/src/adapters/stt/
├── whisper.ts              # TypeScript adapter
├── whisper_inference.py    # Python backend
├── base.ts                 # Base adapter class
└── index.ts                # Factory and exports
```

### TypeScript Adapter

```typescript
// plugins/voice/src/adapters/stt/whisper.ts

import { spawn, ChildProcess } from "child_process";
import { writeFileSync, unlinkSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import type { STTPort, STTCapabilities, STTOptions, STTResult } from "../../ports/stt.js";

export interface WhisperConfig {
  model?: "tiny" | "base" | "small" | "medium" | "large-v3";
  language?: string;
  device?: "cuda" | "cpu";
  computeType?: "int8" | "float16" | "float32";
  beamSize?: number;
  vadFilter?: boolean;
}

export class WhisperAdapter implements STTPort {
  private config: WhisperConfig;
  private pythonProcess: ChildProcess | null = null;
  private responseBuffer: string = "";
  private pendingResolve: ((value: any) => void) | null = null;

  constructor(config: WhisperConfig = {}) {
    this.config = {
      model: config.model || "base",
      language: config.language,
      device: config.device || "cuda",
      computeType: config.computeType || "int8",
      beamSize: config.beamSize || 5,
      vadFilter: config.vadFilter ?? true,
    };
  }

  name(): string {
    return "whisper";
  }

  capabilities(): STTCapabilities {
    return {
      streaming: false,
      languages: ["en", "es", "fr", "de", "it", "pt", "ru", "ja", "ko", "zh"],
      languageDetection: true,
      wordTimestamps: true,
      local: true,
      costPerMinute: 0,
    };
  }

  async isAvailable(): Promise<boolean> {
    try {
      // Check if faster-whisper is installed
      const { execSync } = await import("child_process");
      execSync("python3 -c 'import faster_whisper'", { stdio: "ignore" });
      return true;
    } catch {
      return false;
    }
  }

  private async ensureProcess(): Promise<void> {
    if (this.pythonProcess) return;

    const scriptPath = join(__dirname, "whisper_inference.py");

    this.pythonProcess = spawn("python3", [
      scriptPath,
      "--json-rpc",
      "--model", this.config.model!,
      "--device", this.config.device!,
    ]);

    this.pythonProcess.stdout!.on("data", (data: Buffer) => {
      this.responseBuffer += data.toString();

      // Check for complete JSON response
      const lines = this.responseBuffer.split("\n");
      for (let i = 0; i < lines.length - 1; i++) {
        const line = lines[i].trim();
        if (line && this.pendingResolve) {
          try {
            const response = JSON.parse(line);
            this.pendingResolve(response.result);
            this.pendingResolve = null;
          } catch (e) {
            console.error("Failed to parse response:", line);
          }
        }
      }
      this.responseBuffer = lines[lines.length - 1];
    });

    this.pythonProcess.on("error", (err) => {
      console.error("Whisper process error:", err);
      this.pythonProcess = null;
    });

    // Wait for process to initialize
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  private async callPython(method: string, params: object): Promise<any> {
    await this.ensureProcess();

    return new Promise((resolve, reject) => {
      this.pendingResolve = resolve;

      const request = JSON.stringify({ method, params }) + "\n";
      this.pythonProcess!.stdin!.write(request);

      // Timeout
      setTimeout(() => {
        if (this.pendingResolve === resolve) {
          this.pendingResolve = null;
          reject(new Error("Whisper inference timeout"));
        }
      }, 60000);  // 60 second timeout
    });
  }

  async transcribe(audio: Buffer, options: STTOptions = {}): Promise<STTResult> {
    const startTime = Date.now();

    // Write audio to temp file
    const tempPath = join(tmpdir(), `whisper-${Date.now()}.wav`);
    writeFileSync(tempPath, audio);

    try {
      const result = await this.callPython("transcribe", {
        audio_path: tempPath,
        language: options.language || this.config.language,
        beam_size: this.config.beamSize,
        vad_filter: this.config.vadFilter,
        word_timestamps: options.wordTimestamps,
      });

      return {
        text: result.text,
        language: result.language,
        confidence: result.language_probability,
        durationMs: result.duration * 1000,
        processingTimeMs: Date.now() - startTime,
        words: result.words,
      };
    } finally {
      // Clean up temp file
      try { unlinkSync(tempPath); } catch {}
    }
  }

  async detectLanguage(audio: Buffer): Promise<string> {
    const tempPath = join(tmpdir(), `whisper-detect-${Date.now()}.wav`);
    writeFileSync(tempPath, audio);

    try {
      const result = await this.callPython("detect_language", {
        audio_path: tempPath,
      });
      return result.language;
    } finally {
      try { unlinkSync(tempPath); } catch {}
    }
  }

  async close(): Promise<void> {
    if (this.pythonProcess) {
      this.pythonProcess.kill();
      this.pythonProcess = null;
    }
  }
}

export function createWhisperAdapter(config?: WhisperConfig): WhisperAdapter {
  return new WhisperAdapter(config);
}
```

---

## Model Comparison

| Model | Parameters | VRAM | WER (English) | Speed (RTF) |
|-------|-----------|------|---------------|-------------|
| tiny | 39M | ~1GB | ~10% | 0.03x |
| base | 74M | ~1GB | ~7% | 0.05x |
| small | 244M | ~2GB | ~5% | 0.1x |
| medium | 769M | ~5GB | ~4% | 0.2x |
| large-v3 | 1.5B | ~10GB | ~3% | 0.4x |

**Recommendation**: Start with `base` for good balance of speed and accuracy.

---

## Testing Requirements

### Unit Tests

```typescript
// plugins/voice/specs/05-whisper-stt/tests/unit.test.ts

describe("WhisperAdapter", () => {
  test("name returns whisper", () => {
    const adapter = new WhisperAdapter();
    expect(adapter.name()).toBe("whisper");
  });

  test("capabilities indicate local and word timestamps", () => {
    const caps = new WhisperAdapter().capabilities();
    expect(caps.local).toBe(true);
    expect(caps.wordTimestamps).toBe(true);
    expect(caps.languageDetection).toBe(true);
  });
});
```

### Integration Tests

```typescript
// plugins/voice/specs/05-whisper-stt/tests/integration.test.ts

describe("Whisper Integration", () => {
  test("transcribes English speech", async () => {
    const adapter = new WhisperAdapter({ model: "base" });
    const audio = await Bun.file("fixtures/hello-world.wav").arrayBuffer();

    const result = await adapter.transcribe(Buffer.from(audio));

    expect(result.text.toLowerCase()).toContain("hello");
    expect(result.language).toBe("en");
  });

  test("detects language correctly", async () => {
    const adapter = new WhisperAdapter();
    const audio = await Bun.file("fixtures/spanish-sample.wav").arrayBuffer();

    const lang = await adapter.detectLanguage(Buffer.from(audio));
    expect(lang).toBe("es");
  });

  test("provides word timestamps", async () => {
    const adapter = new WhisperAdapter();
    const audio = await Bun.file("fixtures/hello-world.wav").arrayBuffer();

    const result = await adapter.transcribe(Buffer.from(audio), {
      wordTimestamps: true
    });

    expect(result.words).toBeDefined();
    expect(result.words!.length).toBeGreaterThan(0);
    expect(result.words![0]).toHaveProperty("word");
    expect(result.words![0]).toHaveProperty("start");
  });
});
```

### Accuracy Tests

```typescript
// plugins/voice/specs/05-whisper-stt/tests/accuracy.test.ts

import { calculateWER } from "./utils/wer.js";

describe("Whisper Accuracy", () => {
  const testCases = [
    { file: "fixtures/test1.wav", expected: "hello world" },
    { file: "fixtures/test2.wav", expected: "the quick brown fox" },
    { file: "fixtures/test3.wav", expected: "testing one two three" },
  ];

  test("WER below 10% on test set", async () => {
    const adapter = new WhisperAdapter({ model: "base" });
    let totalWER = 0;

    for (const tc of testCases) {
      const audio = await Bun.file(tc.file).arrayBuffer();
      const result = await adapter.transcribe(Buffer.from(audio));
      const wer = calculateWER(tc.expected, result.text);
      totalWER += wer;
    }

    const avgWER = totalWER / testCases.length;
    expect(avgWER).toBeLessThan(0.1);  // < 10%
  });
});
```

---

## Success Criteria

1. [ ] Transcribes speech with <10% WER on test set
2. [ ] Supports models: tiny, base, small, medium, large-v3
3. [ ] GPU acceleration works when CUDA available
4. [ ] Language detection works for 10+ languages
5. [ ] Word timestamps are accurate
6. [ ] Processing time reasonable (<5s for 30s audio on GPU)

---

## Deliverables

```
plugins/voice/specs/05-whisper-stt/
├── SPEC.md
├── src/
│   ├── whisper.ts
│   └── whisper_inference.py
├── tests/
│   ├── unit.test.ts
│   ├── integration.test.ts
│   ├── accuracy.test.ts
│   └── utils/
│       └── wer.ts
├── fixtures/
│   ├── hello-world.wav
│   ├── spanish-sample.wav
│   └── test1-3.wav
└── README.md
```
