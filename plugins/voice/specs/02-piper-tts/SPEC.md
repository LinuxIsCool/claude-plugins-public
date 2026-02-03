# Spec: Piper TTS Adapter

**Component**: TTS Backend Adapter (Fast CPU Fallback)
**Priority**: High
**Estimated Effort**: 2-3 hours
**Dependencies**: piper-tts, ONNX runtime

---

## Overview

Implement a fast, lightweight TTS adapter using Piper. This serves as the primary CPU fallback when GPU is unavailable, offering ~200ms latency with good quality. Piper uses ONNX models optimized for CPU inference.

## Goals

1. Provide fast TTS without GPU requirements
2. Achieve <500ms latency for typical responses
3. Support 100+ pre-trained voices
4. Zero API costs, fully local

## Non-Goals

- Voice cloning (use XTTS for that)
- Emotion/style control
- Streaming synthesis

---

## Requirements

### Installation

```bash
pip install piper-tts

# Download voice models (example: US English Lessac)
mkdir -p ~/.local/share/piper/voices
cd ~/.local/share/piper/voices
wget https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/high/en_US-lessac-high.onnx
wget https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/high/en_US-lessac-high.onnx.json
```

### System Requirements

- CPU: Any modern x86_64 or ARM64
- RAM: 500MB per loaded model
- Disk: ~50MB per voice model

---

## Interface Design

### TypeScript Adapter

```typescript
// plugins/voice/src/adapters/tts/piper.ts

export interface PiperConfig {
  voicesDir?: string;           // Default: ~/.local/share/piper/voices
  defaultVoice?: string;        // Default: en_US-lessac-high
  sampleRate?: number;          // Default: 22050
  lengthScale?: number;         // Speed: 0.5-2.0, default 1.0
  noiseScale?: number;          // Variation: 0.0-1.0, default 0.667
  noiseW?: number;              // Phoneme width noise, default 0.8
}

export class PiperAdapter implements TTSPort {
  constructor(config?: PiperConfig);

  name(): string;  // Returns "piper"
  capabilities(): TTSCapabilities;
  isAvailable(): Promise<boolean>;
  synthesize(text: string, options: TTSOptions): Promise<TTSResult>;
  listVoices(): Promise<VoiceInfo[]>;
  play(audio: Buffer): Promise<void>;

  // Piper-specific
  downloadVoice(voiceId: string): Promise<void>;
  getInstalledVoices(): Promise<string[]>;
}
```

---

## Implementation Guide

### File Structure

```
plugins/voice/src/adapters/tts/
├── piper.ts                  # TypeScript adapter
└── index.ts                  # Update to include Piper
```

### Core Implementation

```typescript
// plugins/voice/src/adapters/tts/piper.ts

import { spawn } from "child_process";
import { existsSync, readdirSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import type { TTSPort, TTSCapabilities, TTSOptions, TTSResult, VoiceInfo } from "../../ports/tts.js";
import { BaseTTSAdapter } from "./base.js";

export interface PiperConfig {
  voicesDir?: string;
  defaultVoice?: string;
  sampleRate?: number;
  lengthScale?: number;
  noiseScale?: number;
  noiseW?: number;
}

const DEFAULT_VOICES_DIR = join(homedir(), ".local/share/piper/voices");
const DEFAULT_VOICE = "en_US-lessac-high";

// Voice catalog (subset - full list at https://rhasspy.github.io/piper-samples/)
const PIPER_VOICE_CATALOG: Record<string, { gender: "male" | "female"; quality: string }> = {
  "en_US-lessac-high": { gender: "female", quality: "high" },
  "en_US-lessac-medium": { gender: "female", quality: "medium" },
  "en_US-libritts_r-medium": { gender: "neutral", quality: "medium" },
  "en_US-ryan-high": { gender: "male", quality: "high" },
  "en_US-amy-medium": { gender: "female", quality: "medium" },
  "en_GB-alan-medium": { gender: "male", quality: "medium" },
  "en_GB-jenny_dioco-medium": { gender: "female", quality: "medium" },
  // Add more as needed
};

export class PiperAdapter extends BaseTTSAdapter {
  private voicesDir: string;
  private defaultVoice: string;
  private sampleRate: number;
  private lengthScale: number;
  private noiseScale: number;
  private noiseW: number;

  constructor(config: PiperConfig = {}) {
    super(config);
    this.voicesDir = config.voicesDir || DEFAULT_VOICES_DIR;
    this.defaultVoice = config.defaultVoice || DEFAULT_VOICE;
    this.sampleRate = config.sampleRate || 22050;
    this.lengthScale = config.lengthScale || 1.0;
    this.noiseScale = config.noiseScale || 0.667;
    this.noiseW = config.noiseW || 0.8;
  }

  name(): string {
    return "piper";
  }

  capabilities(): TTSCapabilities {
    return {
      voices: [],  // Populated via listVoices()
      streaming: false,
      voiceCloning: false,
      ssml: false,
      emotions: false,
      local: true,
      costPerChar: 0,  // Free
      maxTextLength: 10000,
      supportedFormats: ["wav"],
    };
  }

  async isAvailable(): Promise<boolean> {
    try {
      // Check if piper command exists
      const result = await this.execCommand("piper --version");
      return result.includes("piper");
    } catch {
      return false;
    }
  }

  private async execCommand(cmd: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const proc = spawn("sh", ["-c", cmd]);
      let stdout = "";
      let stderr = "";

      proc.stdout.on("data", (data) => { stdout += data; });
      proc.stderr.on("data", (data) => { stderr += data; });

      proc.on("close", (code) => {
        if (code === 0) resolve(stdout);
        else reject(new Error(stderr || `Exit code ${code}`));
      });
    });
  }

  async synthesize(text: string, options: TTSOptions): Promise<TTSResult> {
    const startTime = Date.now();
    const voiceId = options.voiceId || this.defaultVoice;
    const modelPath = join(this.voicesDir, `${voiceId}.onnx`);

    if (!existsSync(modelPath)) {
      throw new Error(`Piper voice not found: ${voiceId}. Run downloadVoice() first.`);
    }

    // Adjust speed if specified
    const lengthScale = options.speed ? 1.0 / options.speed : this.lengthScale;

    // Create temp output file
    const outputPath = `/tmp/piper-${Date.now()}.wav`;

    // Run piper
    const cmd = `echo "${text.replace(/"/g, '\\"')}" | piper \\
      --model "${modelPath}" \\
      --output_file "${outputPath}" \\
      --length_scale ${lengthScale} \\
      --noise_scale ${this.noiseScale} \\
      --noise_w ${this.noiseW}`;

    await this.execCommand(cmd);

    // Read output file
    const audioBuffer = Buffer.from(await Bun.file(outputPath).arrayBuffer());

    // Clean up
    await Bun.write(outputPath, "").then(() => {});  // Delete

    // Estimate duration (WAV at 22050Hz, 16-bit mono)
    const headerSize = 44;
    const bytesPerSample = 2;
    const numSamples = (audioBuffer.length - headerSize) / bytesPerSample;
    const durationMs = (numSamples / this.sampleRate) * 1000;

    return {
      audio: audioBuffer,
      durationMs,
      format: "wav",
      processingTimeMs: Date.now() - startTime,
      charCount: text.length,
    };
  }

  async listVoices(): Promise<VoiceInfo[]> {
    const voices: VoiceInfo[] = [];

    // List installed voices
    if (existsSync(this.voicesDir)) {
      const files = readdirSync(this.voicesDir);
      for (const file of files) {
        if (file.endsWith(".onnx")) {
          const voiceId = file.replace(".onnx", "");
          const catalog = PIPER_VOICE_CATALOG[voiceId];

          voices.push({
            id: voiceId,
            name: voiceId.replace(/-/g, " ").replace(/_/g, " "),
            gender: catalog?.gender || "neutral",
            language: voiceId.split("-")[0].replace("_", "-"),  // en_US -> en-US
            languageCode: voiceId.split("-")[0].split("_")[0],  // en_US -> en
            description: `Piper ${catalog?.quality || "medium"} quality voice`,
          });
        }
      }
    }

    return voices;
  }

  async downloadVoice(voiceId: string): Promise<void> {
    // Parse voice ID: en_US-lessac-high -> en/en_US/lessac/high
    const parts = voiceId.split("-");
    const lang = parts[0];  // en_US
    const langShort = lang.split("_")[0];  // en
    const name = parts[1];  // lessac
    const quality = parts[2] || "medium";  // high

    const baseUrl = "https://huggingface.co/rhasspy/piper-voices/resolve/main";
    const modelUrl = `${baseUrl}/${langShort}/${lang}/${name}/${quality}/${voiceId}.onnx`;
    const configUrl = `${modelUrl}.json`;

    const modelPath = join(this.voicesDir, `${voiceId}.onnx`);
    const configPath = join(this.voicesDir, `${voiceId}.onnx.json`);

    // Download model
    console.log(`Downloading ${voiceId}...`);
    await this.execCommand(`mkdir -p "${this.voicesDir}"`);
    await this.execCommand(`wget -q -O "${modelPath}" "${modelUrl}"`);
    await this.execCommand(`wget -q -O "${configPath}" "${configUrl}"`);
    console.log(`Downloaded ${voiceId}`);
  }

  async getInstalledVoices(): Promise<string[]> {
    if (!existsSync(this.voicesDir)) return [];

    return readdirSync(this.voicesDir)
      .filter(f => f.endsWith(".onnx"))
      .map(f => f.replace(".onnx", ""));
  }
}

export function createPiperAdapter(config?: PiperConfig): PiperAdapter {
  return new PiperAdapter(config);
}
```

---

## Voice Downloads

### Recommended Voices

```bash
# High quality voices to pre-install
voices=(
  "en_US-lessac-high"      # Female, professional
  "en_US-ryan-high"        # Male, clear
  "en_GB-jenny_dioco-medium"  # British female
  "en_GB-alan-medium"      # British male
)

for voice in "${voices[@]}"; do
  python -c "
from plugins.voice.src.adapters.tts.piper import PiperAdapter
adapter = PiperAdapter()
adapter.downloadVoice('$voice')
"
done
```

### Voice Selection Guide

| Voice | Gender | Accent | Quality | Best For |
|-------|--------|--------|---------|----------|
| en_US-lessac-high | Female | American | High | Default, narration |
| en_US-ryan-high | Male | American | High | Agent voices |
| en_GB-jenny_dioco | Female | British | Medium | Variety |
| en_GB-alan | Male | British | Medium | Agent voices |

---

## Testing Requirements

### Unit Tests

```typescript
// plugins/voice/specs/02-piper-tts/tests/unit.test.ts

describe("PiperAdapter", () => {
  test("name returns piper", () => {
    const adapter = new PiperAdapter();
    expect(adapter.name()).toBe("piper");
  });

  test("capabilities indicates local and no cloning", () => {
    const caps = new PiperAdapter().capabilities();
    expect(caps.local).toBe(true);
    expect(caps.voiceCloning).toBe(false);
    expect(caps.costPerChar).toBe(0);
  });

  test("isAvailable checks piper command", async () => {
    const adapter = new PiperAdapter();
    const available = await adapter.isAvailable();
    // True if piper is installed
    expect(typeof available).toBe("boolean");
  });
});
```

### Integration Tests

```typescript
// plugins/voice/specs/02-piper-tts/tests/integration.test.ts

describe("Piper Integration", () => {
  test("synthesizes speech", async () => {
    const adapter = new PiperAdapter();
    const result = await adapter.synthesize("Hello world", {
      voiceId: "en_US-lessac-high"
    });

    expect(result.audio.length).toBeGreaterThan(1000);
    expect(result.format).toBe("wav");
  });

  test("latency under 500ms for short text", async () => {
    const adapter = new PiperAdapter();
    const result = await adapter.synthesize("Hello.", {});
    expect(result.processingTimeMs).toBeLessThan(500);
  });

  test("speed adjustment works", async () => {
    const adapter = new PiperAdapter();

    const normal = await adapter.synthesize("Test", { speed: 1.0 });
    const fast = await adapter.synthesize("Test", { speed: 1.5 });

    // Fast should have shorter duration
    expect(fast.durationMs).toBeLessThan(normal.durationMs);
  });

  test("lists installed voices", async () => {
    const adapter = new PiperAdapter();
    const voices = await adapter.listVoices();

    expect(Array.isArray(voices)).toBe(true);
    if (voices.length > 0) {
      expect(voices[0]).toHaveProperty("id");
      expect(voices[0]).toHaveProperty("name");
    }
  });
});
```

### Performance Benchmarks

```typescript
// plugins/voice/specs/02-piper-tts/tests/benchmark.test.ts

describe("Piper Performance", () => {
  const benchmarks = [
    { text: "Hello.", maxMs: 300 },
    { text: "This is a test sentence.", maxMs: 400 },
    { text: "This is a longer paragraph that should still be fast because Piper uses ONNX.", maxMs: 600 },
  ];

  for (const { text, maxMs } of benchmarks) {
    test(`"${text.slice(0, 20)}..." under ${maxMs}ms`, async () => {
      const adapter = new PiperAdapter();
      const result = await adapter.synthesize(text, {});
      expect(result.processingTimeMs).toBeLessThan(maxMs);
    });
  }
});
```

---

## Integration Points

### Factory Registration

```typescript
// In index.ts
const BACKEND_PRIORITY = {
  "huggingface-xtts": 100,
  "piper": 90,  // Second priority - fast fallback
  // ...
};

case "piper":
  adapter = createPiperAdapter(backendConfig);
  break;
```

### Voice Identity Mapping

```json
// .claude/voice/agents/haiku.json
{
  "backend": "piper",
  "voiceId": "en_US-lessac-high",
  "settings": {
    "speed": 1.1
  }
}
```

---

## Success Criteria

1. [ ] Synthesizes speech with <500ms latency
2. [ ] Supports at least 4 different voices
3. [ ] Voice download works from HuggingFace
4. [ ] Speed adjustment (0.5-2.0) works correctly
5. [ ] Integrates with TTS factory
6. [ ] All tests pass

---

## Deliverables

```
plugins/voice/specs/02-piper-tts/
├── SPEC.md                    # This file
├── src/
│   └── piper.ts              # TypeScript adapter
├── tests/
│   ├── unit.test.ts
│   ├── integration.test.ts
│   └── benchmark.test.ts
├── scripts/
│   └── download-voices.sh    # Voice installation script
└── README.md                 # Usage documentation
```
