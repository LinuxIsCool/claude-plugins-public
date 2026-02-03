/**
 * Pyttsx3 TTS Adapter
 *
 * Local offline TTS using pyttsx3 Python library.
 * Universal fallback that works without API keys.
 */

import { spawn } from "child_process";
import { writeFile, unlink } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import type { TTSCapabilities, TTSOptions, TTSResult, VoiceInfo } from "../../ports/tts.js";
import { BaseTTSAdapter } from "./base.js";

/**
 * Pyttsx3 configuration
 */
export interface Pyttsx3Config {
  pythonPath?: string;
  rate?: number;     // Words per minute (default: 150)
  volume?: number;   // 0.0 - 1.0 (default: 1.0)
}

/**
 * Inline Python script for TTS synthesis
 */
const PYTTSX3_SCRIPT = `
import sys
import json
import pyttsx3

def synthesize(text, voice_id=None, rate=150, volume=1.0, output_path=None):
    engine = pyttsx3.init()

    # Set properties
    engine.setProperty('rate', rate)
    engine.setProperty('volume', volume)

    # Set voice if specified
    if voice_id:
        engine.setProperty('voice', voice_id)

    if output_path:
        # Save to file
        engine.save_to_file(text, output_path)
        engine.runAndWait()
        return {"status": "saved", "path": output_path}
    else:
        # Speak directly
        engine.say(text)
        engine.runAndWait()
        return {"status": "spoken"}

def list_voices():
    engine = pyttsx3.init()
    voices = []
    for voice in engine.getProperty('voices'):
        voices.append({
            "id": voice.id,
            "name": voice.name,
            "languages": voice.languages,
            "gender": getattr(voice, 'gender', 'neutral'),
        })
    return voices

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--action", required=True, choices=["speak", "list"])
    parser.add_argument("--text", default="")
    parser.add_argument("--voice", default=None)
    parser.add_argument("--rate", type=int, default=150)
    parser.add_argument("--volume", type=float, default=1.0)
    parser.add_argument("--output", default=None)
    args = parser.parse_args()

    if args.action == "list":
        print(json.dumps(list_voices()))
    elif args.action == "speak":
        result = synthesize(
            args.text,
            voice_id=args.voice,
            rate=args.rate,
            volume=args.volume,
            output_path=args.output
        )
        print(json.dumps(result))
`;

/**
 * Pyttsx3 TTS Adapter
 */
export class Pyttsx3Adapter extends BaseTTSAdapter {
  private pythonPath: string;
  private defaultRate: number;
  private defaultVolume: number;
  private cachedVoices: VoiceInfo[] | null = null;

  constructor(config: Pyttsx3Config = {}) {
    super(config);
    this.pythonPath = config.pythonPath || "python3";
    this.defaultRate = config.rate || 150;
    this.defaultVolume = config.volume || 1.0;
  }

  name(): string {
    return "pyttsx3";
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
      supportedFormats: ["wav"],
    };
  }

  async isAvailable(): Promise<boolean> {
    return new Promise((resolve) => {
      const proc = spawn(this.pythonPath, ["-c", "import pyttsx3; print('ok')"]);
      proc.on("error", () => resolve(false));
      proc.on("close", (code) => resolve(code === 0));
    });
  }

  async synthesize(text: string, options: TTSOptions): Promise<TTSResult> {
    const startTime = Date.now();

    // Create temp file for output
    const outputPath = join(tmpdir(), `voice-${Date.now()}.wav`);

    // Calculate rate from speed option (1.0 = 150 wpm)
    const rate = Math.round(this.defaultRate * (options.speed || 1.0));
    const volume = this.defaultVolume;

    // Run Python script
    const result = await this.runPythonScript([
      "--action", "speak",
      "--text", text,
      "--rate", rate.toString(),
      "--volume", volume.toString(),
      "--output", outputPath,
      ...(options.voiceId ? ["--voice", options.voiceId] : []),
    ]);

    if (result.status !== "saved") {
      throw new Error("pyttsx3 synthesis failed");
    }

    // Read the generated audio file
    const { readFile } = await import("fs/promises");
    const audio = await readFile(outputPath);

    // Clean up temp file
    await unlink(outputPath).catch(() => {});

    const processingTimeMs = Date.now() - startTime;

    // Estimate duration from WAV file size
    // WAV at 16-bit 22050Hz mono: 1 second = ~44KB
    const estimatedDurationMs = (audio.length / 44000) * 1000;

    return {
      audio,
      durationMs: estimatedDurationMs,
      format: "wav",
      processingTimeMs,
      charCount: text.length,
    };
  }

  async listVoices(): Promise<VoiceInfo[]> {
    if (this.cachedVoices) {
      return this.cachedVoices;
    }

    try {
      const result = await this.runPythonScript(["--action", "list"]);

      this.cachedVoices = (result as Array<{
        id: string;
        name: string;
        gender?: string;
        languages?: string[];
      }>).map((v) => ({
        id: v.id,
        name: v.name,
        gender: (v.gender as "male" | "female" | "neutral") || "neutral",
        language: v.languages?.[0] || "Unknown",
        languageCode: "en",
      }));

      return this.cachedVoices;
    } catch {
      return [];
    }
  }

  /**
   * Play audio directly through speakers (bypasses file)
   */
  async speakDirect(text: string, options: TTSOptions): Promise<void> {
    const rate = Math.round(this.defaultRate * (options.speed || 1.0));

    await this.runPythonScript([
      "--action", "speak",
      "--text", text,
      "--rate", rate.toString(),
      "--volume", this.defaultVolume.toString(),
      ...(options.voiceId ? ["--voice", options.voiceId] : []),
    ]);
  }

  private runPythonScript(args: string[]): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const proc = spawn(this.pythonPath, ["-c", PYTTSX3_SCRIPT, ...args]);

      let stdout = "";
      let stderr = "";

      proc.stdout.on("data", (data) => {
        stdout += data.toString();
      });

      proc.stderr.on("data", (data) => {
        stderr += data.toString();
      });

      proc.on("error", (error) => {
        reject(new Error(`Failed to run Python: ${error.message}`));
      });

      proc.on("close", (code) => {
        if (code === 0) {
          try {
            resolve(JSON.parse(stdout.trim()));
          } catch {
            resolve({ status: "ok", output: stdout });
          }
        } else {
          reject(new Error(`Python exited with code ${code}: ${stderr}`));
        }
      });
    });
  }
}

/**
 * Factory function
 */
export function createPyttsx3Adapter(config?: Pyttsx3Config): Pyttsx3Adapter {
  return new Pyttsx3Adapter(config);
}
