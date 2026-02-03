/**
 * ElevenLabs TTS Adapter
 *
 * High-quality cloud TTS using ElevenLabs API.
 * Supports voice cloning, multiple voices, and emotional expression.
 */

import type { TTSCapabilities, TTSOptions, TTSResult, VoiceInfo } from "../../ports/tts.js";
import { BaseTTSAdapter, getEnvVar } from "./base.js";

/**
 * ElevenLabs configuration
 */
export interface ElevenLabsConfig {
  apiKey?: string;
  defaultVoiceId?: string;
  defaultModel?: string;
}

/**
 * ElevenLabs model options
 */
export const ELEVENLABS_MODELS = {
  turbo_v2_5: "eleven_turbo_v2_5",     // Fastest, cost-effective
  multilingual_v2: "eleven_multilingual_v2", // Best quality, 29 languages
  flash_v2_5: "eleven_flash_v2_5",     // Lowest latency
  english_v1: "eleven_monolingual_v1", // Legacy English
} as const;

/**
 * Common ElevenLabs voices
 */
export const ELEVENLABS_VOICES = {
  adam: "pNInz6obpgDQGcFmaJgB",         // Male, deep
  rachel: "21m00Tcm4TlvDq8ikWAM",        // Female, professional
  domi: "AZnzlk1XvdvUeBnXmlld",          // Female, conversational
  elli: "MF3mGyEYCl7XYWbV9V6O",          // Female, young
  antoni: "ErXwobaYiN019PkySvjV",        // Male, warm
  josh: "TxGEqnHWrfWFTfGW9XjX",          // Male, deep, narrative
  arnold: "VR6AewLTigWG4xSOukaG",        // Male, strong
  sam: "yoZ06aMxZJJ28mfd3POQ",           // Male, relaxed
  fin: "D38z5RcWu1voky8WS1ja",           // Male, Irish
  sarah: "EXAVITQu4vr4xnSDxMaL",         // Female, soft
} as const;

/**
 * ElevenLabs TTS Adapter
 */
export class ElevenLabsAdapter extends BaseTTSAdapter {
  private apiKey: string | undefined;
  private defaultVoiceId: string;
  private defaultModel: string;
  private cachedVoices: VoiceInfo[] | null = null;

  constructor(config: ElevenLabsConfig = {}) {
    super(config);
    this.apiKey = config.apiKey || getEnvVar("ELEVENLABS_API_KEY");
    this.defaultVoiceId = config.defaultVoiceId || ELEVENLABS_VOICES.rachel;
    this.defaultModel = config.defaultModel || ELEVENLABS_MODELS.turbo_v2_5;
  }

  name(): string {
    return "elevenlabs";
  }

  capabilities(): TTSCapabilities {
    return {
      voices: [],  // Populated via listVoices()
      streaming: true,
      voiceCloning: true,
      ssml: false,  // ElevenLabs uses its own markup
      emotions: true,
      local: false,
      costPerChar: 0.00030,  // ~$0.30 per 1K chars
      maxTextLength: 5000,
      supportedFormats: ["mp3", "pcm"],
    };
  }

  async isAvailable(): Promise<boolean> {
    return !!this.apiKey;
  }

  async synthesize(text: string, options: TTSOptions): Promise<TTSResult> {
    if (!this.apiKey) {
      throw new Error("ElevenLabs API key not configured");
    }

    const startTime = Date.now();
    const voiceId = options.voiceId || this.defaultVoiceId;
    const model = options.model || this.defaultModel;

    const voiceSettings: Record<string, unknown> = {
      stability: options.stability ?? 0.5,
      similarity_boost: options.similarityBoost ?? 0.75,
    };

    if (options.style !== undefined) {
      voiceSettings.style = options.style;
    }
    if (options.useSpeakerBoost !== undefined) {
      voiceSettings.use_speaker_boost = options.useSpeakerBoost;
    }

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "xi-api-key": this.apiKey,
        },
        body: JSON.stringify({
          text,
          model_id: model,
          voice_settings: voiceSettings,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`ElevenLabs API error: ${response.status} - ${error}`);
    }

    const audioBuffer = Buffer.from(await response.arrayBuffer());
    const processingTimeMs = Date.now() - startTime;

    // Estimate duration (rough calculation for MP3)
    // MP3 at 128kbps: 1 second = ~16KB
    const estimatedDurationMs = (audioBuffer.length / 16000) * 1000;

    return {
      audio: audioBuffer,
      durationMs: estimatedDurationMs,
      format: "mp3",
      processingTimeMs,
      charCount: text.length,
    };
  }

  async *synthesizeStream(
    text: string,
    options: TTSOptions
  ): AsyncGenerator<Buffer> {
    if (!this.apiKey) {
      throw new Error("ElevenLabs API key not configured");
    }

    const voiceId = options.voiceId || this.defaultVoiceId;
    const model = options.model || this.defaultModel;

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "xi-api-key": this.apiKey,
        },
        body: JSON.stringify({
          text,
          model_id: model,
          voice_settings: {
            stability: options.stability ?? 0.5,
            similarity_boost: options.similarityBoost ?? 0.75,
          },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`ElevenLabs streaming error: ${response.status} - ${error}`);
    }

    if (!response.body) {
      throw new Error("No response body");
    }

    const reader = response.body.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        yield Buffer.from(value);
      }
    } finally {
      reader.releaseLock();
    }
  }

  async listVoices(): Promise<VoiceInfo[]> {
    if (this.cachedVoices) {
      return this.cachedVoices;
    }

    if (!this.apiKey) {
      // Return default voices without API
      return Object.entries(ELEVENLABS_VOICES).map(([name, id]) => ({
        id,
        name: name.charAt(0).toUpperCase() + name.slice(1),
        gender: ["rachel", "domi", "elli", "sarah"].includes(name) ? "female" as const : "male" as const,
        language: "English",
        languageCode: "en",
      }));
    }

    const response = await fetch("https://api.elevenlabs.io/v1/voices", {
      headers: { "xi-api-key": this.apiKey },
    });

    if (!response.ok) {
      throw new Error(`Failed to list voices: ${response.status}`);
    }

    const data = await response.json() as { voices: Array<{
      voice_id: string;
      name: string;
      labels?: { gender?: string };
      preview_url?: string;
      description?: string;
    }> };

    this.cachedVoices = data.voices.map((v) => ({
      id: v.voice_id,
      name: v.name,
      gender: (v.labels?.gender as "male" | "female" | "neutral") || "neutral",
      language: "English",
      languageCode: "en",
      previewUrl: v.preview_url,
      description: v.description,
    }));

    return this.cachedVoices;
  }
}

/**
 * Factory function
 */
export function createElevenLabsAdapter(config?: ElevenLabsConfig): ElevenLabsAdapter {
  return new ElevenLabsAdapter(config);
}
