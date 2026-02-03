/**
 * Transcript Workflow Service
 *
 * Orchestrates the full transcription pipeline:
 * 1. Transcribe audio with speaker diarization
 * 2. Store transcript to event-sourced store
 * 3. Index for full-text search
 * 4. Create/update speaker fingerprints
 *
 * This is the primary entry point for processing new audio.
 */

import type { AudioInput, MediaSource } from "../domain/values/media-source.js";
import type { Transcript, TranscriptInput, TID } from "../domain/entities/transcript.js";
import type { Speaker, SpeakerInput, VoiceFingerprint } from "../domain/entities/speaker.js";
import {
  TranscriptionService,
  type SpeakerAttributedTranscript,
  type TranscriptionServiceOptions,
} from "./transcription-service.js";
import { TranscriptStore } from "../infrastructure/store.js";
import { TranscriptSearchIndex } from "../infrastructure/search.js";

/**
 * Cosine similarity between two embeddings
 */
function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) {
    throw new Error(`Embedding dimension mismatch: ${a.length} vs ${b.length}`);
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) {
    throw new Error("Invalid embedding: zero vector detected (indicates corrupted data)");
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Workflow options
 */
export interface TranscriptWorkflowOptions {
  /** Transcription options */
  transcription?: TranscriptionServiceOptions;

  /** Skip storing to transcript store */
  skipStore?: boolean;

  /** Skip indexing for search */
  skipIndex?: boolean;

  /** Skip speaker fingerprinting */
  skipFingerprint?: boolean;

  /** Cosine similarity threshold for speaker matching (default: 0.75) */
  fingerprintThreshold?: number;

  /** Optional title for the transcript */
  title?: string;

  /** Optional source metadata to override detection */
  sourceMetadata?: Partial<MediaSource>;
}

/**
 * Workflow result
 */
export interface TranscriptWorkflowResult {
  transcript: Transcript;
  speakers: Speaker[];
  indexed: boolean;
  fingerprintMatches: Array<{
    speakerLabel: string;
    matchedSpeakerId?: string;
    newSpeakerId?: string;
    similarity?: number;
  }>;
  processingTimeMs: number;
}

/**
 * Transcript Workflow Service
 */
export class TranscriptWorkflow {
  private transcriptionService: TranscriptionService;
  private store: TranscriptStore;
  private searchIndex: TranscriptSearchIndex;

  constructor(
    transcriptionService?: TranscriptionService,
    store?: TranscriptStore,
    searchIndex?: TranscriptSearchIndex
  ) {
    this.transcriptionService = transcriptionService ?? new TranscriptionService();
    this.store = store ?? new TranscriptStore();
    this.searchIndex = searchIndex ?? new TranscriptSearchIndex();
  }

  /**
   * Process audio through the full pipeline
   */
  async process(
    input: AudioInput,
    options: TranscriptWorkflowOptions = {}
  ): Promise<TranscriptWorkflowResult> {
    const startTime = Date.now();
    const fingerprintMatches: TranscriptWorkflowResult["fingerprintMatches"] = [];
    const speakers: Speaker[] = [];

    // Step 1: Transcribe with speaker attribution
    const attributed = await this.transcriptionService.transcribe(
      input,
      options.transcription
    );

    // Step 2: Convert to TranscriptInput
    const transcriptInput = this.convertToTranscriptInput(
      attributed,
      input,
      options
    );

    // Step 3: Store transcript
    let transcript: Transcript;
    if (options.skipStore) {
      // Create a minimal transcript object without storing
      transcript = {
        ...transcriptInput,
        id: `tx_temp_${Date.now()}` as TID,
        status: "complete",
        created_at: Date.now(),
        updated_at: Date.now(),
      };
    } else {
      transcript = await this.store.createTranscript(transcriptInput);
    }

    // Step 4: Index for search
    let indexed = false;
    if (!options.skipIndex) {
      try {
        this.searchIndex.index(transcript);
        indexed = true;
      } catch (error) {
        console.error("Failed to index transcript:", error);
      }
    }

    // Step 5: Process speaker fingerprints
    if (!options.skipFingerprint && attributed.embeddings) {
      const results = await this.processSpeakerFingerprints(
        transcript,
        attributed.embeddings,
        options.fingerprintThreshold ?? 0.75
      );
      fingerprintMatches.push(...results.matches);
      speakers.push(...results.speakers);
    }

    return {
      transcript,
      speakers,
      indexed,
      fingerprintMatches,
      processingTimeMs: Date.now() - startTime,
    };
  }

  /**
   * Convert TranscriptionService output to TranscriptInput
   */
  private convertToTranscriptInput(
    attributed: SpeakerAttributedTranscript,
    input: AudioInput,
    options: TranscriptWorkflowOptions
  ): TranscriptInput {
    // Build utterances with computed duration
    const utterances = attributed.utterances.map((u, i) => ({
      id: `ut_${String(i).padStart(4, "0")}`,
      index: i,
      speaker: {
        id: u.speaker.id,
        name: u.speaker.name,
        confidence: u.speaker.confidence,
      },
      text: u.text,
      start_ms: u.start_ms,
      end_ms: u.end_ms,
      duration_ms: u.end_ms - u.start_ms,
      confidence: {
        transcription: attributed.language_confidence,
        speaker: u.speaker.confidence,
      },
      language: attributed.language,
    }));

    // Build source metadata
    const source: MediaSource = {
      mode: input.type === "file" ? "file" : input.type === "url" ? "url" : "stream",
      type: options.sourceMetadata?.type ?? "audio",
      path: input.type === "file" ? input.path : undefined,
      url: input.type === "url" ? input.url : undefined,
      filename: input.type === "file"
        ? input.path.split("/").pop()
        : options.sourceMetadata?.filename,
      audio: {
        format: options.sourceMetadata?.audio?.format ?? "unknown",
        sample_rate: options.sourceMetadata?.audio?.sample_rate,
        channels: options.sourceMetadata?.audio?.channels,
        duration_ms: attributed.duration_ms,
      },
      ...options.sourceMetadata,
    };

    // Compute full text
    const fullText = attributed.utterances.map((u) => u.text).join(" ");

    return {
      source,
      title: options.title,
      utterances,
      full_text: fullText,
      status: "complete",
      processing: {
        backend: attributed.model,
        model: attributed.model,
        language: attributed.language,
        duration_ms: attributed.processing_time_ms,
        confidence: attributed.language_confidence,
      },
    };
  }

  /**
   * Process speaker fingerprints from embeddings
   */
  private async processSpeakerFingerprints(
    transcript: Transcript,
    embeddings: Record<string, Float32Array>,
    threshold: number
  ): Promise<{
    speakers: Speaker[];
    matches: TranscriptWorkflowResult["fingerprintMatches"];
  }> {
    const speakers: Speaker[] = [];
    const matches: TranscriptWorkflowResult["fingerprintMatches"] = [];

    // Get existing speakers with fingerprints for matching
    const existingSpeakers = await this.store.getSpeakersWithFingerprints();

    for (const [speakerLabel, embedding] of Object.entries(embeddings)) {
      // Try to match against existing fingerprints
      let bestMatch: { speaker: Speaker; similarity: number } | null = null;

      for (const existingSpeaker of existingSpeakers) {
        for (const fingerprint of existingSpeaker.fingerprints) {
          const similarity = cosineSimilarity(embedding, fingerprint.embedding);
          if (similarity >= threshold) {
            if (!bestMatch || similarity > bestMatch.similarity) {
              bestMatch = { speaker: existingSpeaker, similarity };
            }
          }
        }
      }

      if (bestMatch) {
        // Found a match - record it
        matches.push({
          speakerLabel,
          matchedSpeakerId: bestMatch.speaker.id,
          similarity: bestMatch.similarity,
        });
        speakers.push(bestMatch.speaker);
      } else {
        // No match - create anonymous speaker with fingerprint
        const fingerprint: VoiceFingerprint = {
          embedding,
          model: "pyannote-speaker-diarization-3.1",
          created_at: Date.now(),
          sample_duration_ms: transcript.source.audio.duration_ms ?? 0,
          quality_score: 0.8, // Default quality score
        };

        const speakerInput: SpeakerInput = {
          name: speakerLabel, // Use SPEAKER_00 etc as name initially
          aliases: [],
          fingerprints: [fingerprint],
          identities: [],
          facts: [],
        };

        const newSpeaker = await this.store.createSpeaker(speakerInput);
        matches.push({
          speakerLabel,
          newSpeakerId: newSpeaker.id,
        });
        speakers.push(newSpeaker);
      }
    }

    return { speakers, matches };
  }

  /**
   * Get the search index for direct queries
   */
  getSearchIndex(): TranscriptSearchIndex {
    return this.searchIndex;
  }

  /**
   * Get the store for direct access
   */
  getStore(): TranscriptStore {
    return this.store;
  }
}

/**
 * Singleton workflow instance
 */
let workflowInstance: TranscriptWorkflow | null = null;

/**
 * Get the transcript workflow service
 */
export function getTranscriptWorkflow(): TranscriptWorkflow {
  if (!workflowInstance) {
    workflowInstance = new TranscriptWorkflow();
  }
  return workflowInstance;
}
