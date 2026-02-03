/**
 * Transcription Service
 *
 * Integrates transcription and diarization to produce speaker-attributed transcripts.
 * Combines faster-whisper for speech-to-text with pyannote for speaker identification.
 */

import type { AudioInput } from "../domain/values/media-source.js";
import type { Utterance } from "../domain/entities/utterance.js";
import type { TranscriptionOptions } from "../ports/transcription.js";
import type { DiarizationResult, DiarizationOptions, DiarizationSegment } from "../ports/diarization.js";
import { transcriptionFactory } from "../adapters/transcription/index.js";
import { getDiarizationFactory } from "../adapters/diarization/index.js";

/**
 * Speaker-attributed utterance (extends base Utterance with speaker info)
 */
export interface AttributedUtterance extends Utterance {
  speaker: {
    id: string;
    name: string;
    confidence?: number;
  };
}

/**
 * Full transcription result with speaker attribution
 */
export interface SpeakerAttributedTranscript {
  utterances: AttributedUtterance[];
  speakers: Array<{
    id: string;
    label: string;
    segment_count: number;
    total_duration_ms: number;
  }>;
  language: string;
  language_confidence?: number;
  duration_ms: number;
  processing_time_ms: number;
  model: string;
  diarization_model: string;

  /**
   * Speaker embeddings from diarization (256-dim Float32Array).
   * Used for voice fingerprinting and cross-meeting speaker identification.
   * Only present if diarization was performed with embedding extraction.
   */
  embeddings?: Record<string, Float32Array>;
}

/**
 * Service options
 */
export interface TranscriptionServiceOptions {
  transcription?: TranscriptionOptions;
  diarization?: DiarizationOptions;
  transcriptionBackend?: string;
  skipDiarization?: boolean;
}

/**
 * Assign speaker labels to utterances based on time overlap
 */
function assignSpeakers(
  utterances: Utterance[],
  diarization: DiarizationResult
): AttributedUtterance[] {
  return utterances.map((utterance, index) => {
    // Find the diarization segment with maximum overlap
    const utteranceStart = utterance.start_ms;
    const utteranceEnd = utterance.end_ms;
    const utteranceMid = (utteranceStart + utteranceEnd) / 2;

    let bestSegment: DiarizationSegment | null = null;
    let maxOverlap = 0;

    for (const segment of diarization.segments) {
      // Calculate overlap
      const overlapStart = Math.max(utteranceStart, segment.start_ms);
      const overlapEnd = Math.min(utteranceEnd, segment.end_ms);
      const overlap = Math.max(0, overlapEnd - overlapStart);

      if (overlap > maxOverlap) {
        maxOverlap = overlap;
        bestSegment = segment;
      }
    }

    // If no overlap found, find the closest segment to the utterance midpoint
    if (!bestSegment) {
      let minDistance = Infinity;
      for (const segment of diarization.segments) {
        const segmentMid = (segment.start_ms + segment.end_ms) / 2;
        const distance = Math.abs(utteranceMid - segmentMid);
        if (distance < minDistance) {
          minDistance = distance;
          bestSegment = segment;
        }
      }
    }

    const speakerLabel = bestSegment?.speaker_label || "SPEAKER_UNKNOWN";
    const speakerId = `spk_${speakerLabel.toLowerCase().replace("speaker_", "")}`;

    return {
      ...utterance,
      id: `ut_${String(index).padStart(4, "0")}`,
      speaker: {
        id: speakerId,
        name: speakerLabel,
        confidence: bestSegment?.confidence,
      },
    };
  });
}

/**
 * Calculate per-speaker statistics
 */
function calculateSpeakerStats(
  utterances: AttributedUtterance[],
  diarization: DiarizationResult
): SpeakerAttributedTranscript["speakers"] {
  const speakerMap = new Map<string, {
    label: string;
    segment_count: number;
    total_duration_ms: number;
  }>();

  // Initialize from diarization labels
  for (const label of diarization.speaker_labels) {
    const id = `spk_${label.toLowerCase().replace("speaker_", "")}`;
    speakerMap.set(id, {
      label,
      segment_count: 0,
      total_duration_ms: 0,
    });
  }

  // Count from utterances
  for (const utterance of utterances) {
    const stats = speakerMap.get(utterance.speaker.id);
    if (stats) {
      stats.segment_count++;
      stats.total_duration_ms += utterance.duration_ms;
    }
  }

  return Array.from(speakerMap.entries()).map(([id, stats]) => ({
    id,
    ...stats,
  }));
}

/**
 * Transcription Service
 */
export class TranscriptionService {
  /**
   * Transcribe audio with speaker attribution
   */
  async transcribe(
    input: AudioInput,
    options?: TranscriptionServiceOptions
  ): Promise<SpeakerAttributedTranscript> {
    const startTime = Date.now();

    // Get adapters
    const transcriber = transcriptionFactory.create(options?.transcriptionBackend || "faster-whisper");
    const diarizer = getDiarizationFactory().default();

    // Check availability
    const [transcriberAvailable, diarizerAvailable] = await Promise.all([
      transcriber.isAvailable(),
      options?.skipDiarization ? Promise.resolve(false) : diarizer.isAvailable(),
    ]);

    if (!transcriberAvailable) {
      throw new Error(`Transcription backend '${transcriber.name()}' is not available`);
    }

    // Run transcription and diarization in parallel
    const transcriptionPromise = transcriber.transcribe(input, options?.transcription);
    const diarizationPromise = diarizerAvailable
      ? diarizer.diarize(input, options?.diarization)
      : Promise.resolve(null);

    const [transcription, diarization] = await Promise.all([
      transcriptionPromise,
      diarizationPromise,
    ]);

    // Attribute speakers if diarization available
    let attributedUtterances: AttributedUtterance[];
    let speakers: SpeakerAttributedTranscript["speakers"];

    if (diarization) {
      attributedUtterances = assignSpeakers(transcription.utterances, diarization);
      speakers = calculateSpeakerStats(attributedUtterances, diarization);
    } else {
      // No diarization - single unknown speaker
      attributedUtterances = transcription.utterances.map((u, i) => ({
        ...u,
        id: `ut_${String(i).padStart(4, "0")}`,
        speaker: {
          id: "spk_unknown",
          name: "Speaker",
        },
      }));
      speakers = [{
        id: "spk_unknown",
        label: "Speaker",
        segment_count: transcription.utterances.length,
        total_duration_ms: transcription.duration_ms,
      }];
    }

    const totalTime = Date.now() - startTime;

    return {
      utterances: attributedUtterances,
      speakers,
      language: transcription.language,
      language_confidence: transcription.language_confidence,
      duration_ms: transcription.duration_ms,
      processing_time_ms: totalTime,
      model: transcription.model || transcriber.name(),
      diarization_model: diarization ? diarizer.name() : "none",
      embeddings: diarization?.embeddings,
    };
  }

  /**
   * Format transcript as readable text
   */
  formatAsText(transcript: SpeakerAttributedTranscript): string {
    const lines: string[] = [];

    // Header
    lines.push(`# Transcript`);
    lines.push(`Language: ${transcript.language}`);
    lines.push(`Duration: ${formatDuration(transcript.duration_ms)}`);
    lines.push(`Speakers: ${transcript.speakers.length}`);
    lines.push(``);

    // Speaker summary
    lines.push(`## Speakers`);
    for (const speaker of transcript.speakers) {
      const pct = Math.round((speaker.total_duration_ms / transcript.duration_ms) * 100);
      lines.push(`- ${speaker.label}: ${speaker.segment_count} segments (${pct}% of time)`);
    }
    lines.push(``);

    // Transcript
    lines.push(`## Transcript`);
    lines.push(``);

    let lastSpeaker = "";
    for (const utterance of transcript.utterances) {
      const timestamp = formatTimestamp(utterance.start_ms);
      const speaker = utterance.speaker.name;

      if (speaker !== lastSpeaker) {
        lines.push(``);
        lines.push(`**${speaker}** [${timestamp}]`);
        lastSpeaker = speaker;
      }

      lines.push(utterance.text);
    }

    return lines.join("\n");
  }

  /**
   * Format transcript as SRT subtitles
   */
  formatAsSRT(transcript: SpeakerAttributedTranscript): string {
    const lines: string[] = [];

    for (let i = 0; i < transcript.utterances.length; i++) {
      const utterance = transcript.utterances[i];
      const startTime = formatSRTTime(utterance.start_ms);
      const endTime = formatSRTTime(utterance.end_ms);

      lines.push(`${i + 1}`);
      lines.push(`${startTime} --> ${endTime}`);
      lines.push(`[${utterance.speaker.name}] ${utterance.text}`);
      lines.push(``);
    }

    return lines.join("\n");
  }
}

/**
 * Format milliseconds as HH:MM:SS
 */
function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/**
 * Format milliseconds as MM:SS timestamp
 */
function formatTimestamp(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/**
 * Format milliseconds as SRT time (HH:MM:SS,mmm)
 */
function formatSRTTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const millis = ms % 1000;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")},${String(millis).padStart(3, "0")}`;
}

/**
 * Singleton service instance
 */
let serviceInstance: TranscriptionService | null = null;

/**
 * Get the transcription service
 */
export function getTranscriptionService(): TranscriptionService {
  if (!serviceInstance) {
    serviceInstance = new TranscriptionService();
  }
  return serviceInstance;
}
