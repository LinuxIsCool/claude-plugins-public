/**
 * Transcript Store
 *
 * Event-sourced storage following the messages plugin pattern.
 * Append-only JSONL events with content-addressed storage.
 *
 * Storage structure:
 * .claude/transcripts/
 * ├── store/
 * │   ├── events/              # Append-only JSONL (source of truth)
 * │   │   └── YYYY/MM/DD/
 * │   │       └── events.jsonl
 * │   └── content/             # Content-addressed files
 * │       └── XX/              # First 2 chars of ID (after prefix)
 * │           └── {tid}.md
 * ├── speakers/                # Speaker profiles
 * │   └── {spk_id}.json
 * ├── entities/                # Entity database
 * │   └── {ent_id}.json
 * └── search/
 *     └── index.db             # SQLite FTS5
 */

import { join } from "path";
import { existsSync, mkdirSync, appendFileSync, readFileSync, readdirSync, statSync, writeFileSync } from "fs";
import { generateTID, generateSpeakerID, generateEntityID, generateUtteranceID } from "./tid.js";
import type {
  Transcript,
  TranscriptInput,
  TranscriptSummary,
  TID,
} from "../domain/entities/transcript.js";
import type {
  Speaker,
  SpeakerInput,
  SpeakerID,
  SpeakerSummary,
} from "../domain/entities/speaker.js";
import type {
  Entity,
  EntityInput,
  EntityID,
} from "../domain/entities/entity.js";
import type {
  Event,
  TranscriptCreatedEvent,
  SpeakerCreatedEvent,
  EntityCreatedEvent,
} from "../domain/events/index.js";
import { getClaudePath } from "../../../../lib/paths.js";

/**
 * Get the transcript store base path (anchored to repo root)
 */
function getDefaultBasePath(): string {
  return getClaudePath("transcripts");
}

/**
 * Transcript Store - Core data access layer
 */
export class TranscriptStore {
  private basePath: string;

  constructor(basePath?: string) {
    this.basePath = basePath ?? getDefaultBasePath();
    this.ensureDirectories();
  }

  // ===========================================================================
  // Directory Management
  // ===========================================================================

  private ensureDirectories(): void {
    const dirs = [
      "store/events",
      "store/content",
      "speakers",
      "entities",
      "search",
    ];

    for (const dir of dirs) {
      const path = join(this.basePath, dir);
      if (!existsSync(path)) {
        mkdirSync(path, { recursive: true });
      }
    }
  }

  /**
   * Get path for today's event log
   */
  private getEventLogPath(date = new Date()): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    const dir = join(this.basePath, "store/events", String(year), month, day);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    return join(dir, "events.jsonl");
  }

  /**
   * Get path for a transcript content file
   */
  private getTranscriptPath(tid: TID): string {
    const prefix = tid.slice(3, 5);
    const dir = join(this.basePath, "store/content", prefix);

    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    return join(dir, `${tid}.md`);
  }

  /**
   * Get path for a speaker file
   */
  private getSpeakerPath(id: SpeakerID): string {
    return join(this.basePath, "speakers", `${id}.json`);
  }

  /**
   * Get path for an entity file
   */
  private getEntityPath(id: EntityID): string {
    return join(this.basePath, "entities", `${id}.json`);
  }

  // ===========================================================================
  // Event Log
  // ===========================================================================

  /**
   * Append an event to the log
   */
  private appendEvent(event: Event): void {
    const path = this.getEventLogPath();
    appendFileSync(path, JSON.stringify(event) + "\n");
  }

  /**
   * Iterate over all events
   */
  async *getAllEvents(): AsyncGenerator<Event> {
    const eventsDir = join(this.basePath, "store/events");

    if (!existsSync(eventsDir)) {
      return;
    }

    const years = readdirSync(eventsDir).filter((f) =>
      statSync(join(eventsDir, f)).isDirectory()
    );

    for (const year of years.sort()) {
      const yearDir = join(eventsDir, year);
      const months = readdirSync(yearDir).filter((f) =>
        statSync(join(yearDir, f)).isDirectory()
      );

      for (const month of months.sort()) {
        const monthDir = join(yearDir, month);
        const days = readdirSync(monthDir).filter((f) =>
          statSync(join(monthDir, f)).isDirectory()
        );

        for (const day of days.sort()) {
          const eventFile = join(monthDir, day, "events.jsonl");

          if (existsSync(eventFile)) {
            const content = readFileSync(eventFile, "utf-8");

            for (const line of content.trim().split("\n")) {
              if (line) {
                yield JSON.parse(line) as Event;
              }
            }
          }
        }
      }
    }
  }

  // ===========================================================================
  // Transcripts
  // ===========================================================================

  /**
   * Create a new transcript
   */
  async createTranscript(input: TranscriptInput): Promise<Transcript> {
    const id = generateTID({
      checksum: input.source.checksum,
      path: input.source.path,
      url: input.source.url,
      created_at: Date.now(),
    });

    // Generate utterance IDs
    const utterances = input.utterances.map((u, i) => ({
      ...u,
      id: generateUtteranceID(id, i),
      duration_ms: u.end_ms - u.start_ms,
    }));

    const transcript: Transcript = {
      ...input,
      id,
      utterances,
      status: input.status || "pending",
      created_at: Date.now(),
      updated_at: Date.now(),
    };

    // Write content file first
    await this.writeTranscriptFile(transcript);

    // Then append event
    const event: TranscriptCreatedEvent = {
      ts: new Date().toISOString(),
      op: "transcript.created",
      data: transcript,
    };
    this.appendEvent(event);

    return transcript;
  }

  /**
   * Write transcript as markdown content file
   */
  private async writeTranscriptFile(transcript: Transcript): Promise<void> {
    const path = this.getTranscriptPath(transcript.id);

    const frontmatter: Record<string, unknown> = {
      id: transcript.id,
      status: transcript.status,
      created_at: transcript.created_at,
      updated_at: transcript.updated_at,
      speaker_count: new Set(transcript.utterances.map((u) => u.speaker.id)).size,
      utterance_count: transcript.utterances.length,
    };

    if (transcript.title) frontmatter.title = transcript.title;
    if (transcript.source.filename) frontmatter.filename = transcript.source.filename;
    if (transcript.source.platform) frontmatter.platform = transcript.source.platform?.name;
    if (transcript.source.audio.duration_ms) {
      frontmatter.duration_ms = transcript.source.audio.duration_ms;
    }

    const yamlLines = Object.entries(frontmatter).map(([key, value]) => {
      if (typeof value === "string") {
        if (value.includes(":") || value.includes("#") || value.includes("\n")) {
          return `${key}: "${value.replace(/"/g, '\\"')}"`;
        }
        return `${key}: ${value}`;
      }
      return `${key}: ${JSON.stringify(value)}`;
    });

    // Build transcript body
    const bodyLines: string[] = [];
    for (const utterance of transcript.utterances) {
      const timestamp = formatTimestamp(utterance.start_ms);
      const speaker = utterance.speaker.name || utterance.speaker.id;
      bodyLines.push(`**[${timestamp}] ${speaker}:** ${utterance.text}`);
      bodyLines.push("");
    }

    const content = `---
${yamlLines.join("\n")}
---

# ${transcript.title || `Transcript ${transcript.id}`}

${bodyLines.join("\n")}
`;

    await Bun.write(path, content);
  }

  /**
   * Get a transcript by ID
   */
  async getTranscript(id: TID): Promise<Transcript | null> {
    for await (const event of this.getAllEvents()) {
      if (event.op === "transcript.created" && (event as TranscriptCreatedEvent).data.id === id) {
        return (event as TranscriptCreatedEvent).data;
      }
    }
    return null;
  }

  /**
   * List all transcripts
   */
  async *listTranscripts(limit?: number): AsyncGenerator<TranscriptSummary> {
    const seen = new Set<string>();
    let count = 0;
    const maxCount = limit ?? Infinity;

    for await (const event of this.getAllEvents()) {
      if (event.op === "transcript.created") {
        const transcript = (event as TranscriptCreatedEvent).data;
        if (!seen.has(transcript.id)) {
          seen.add(transcript.id);
          yield {
            id: transcript.id,
            title: transcript.title,
            source: {
              filename: transcript.source.filename,
              platform: transcript.source.platform?.name,
              duration_ms: transcript.source.audio.duration_ms,
            },
            speaker_count: new Set(transcript.utterances.map((u) => u.speaker.id)).size,
            utterance_count: transcript.utterances.length,
            status: transcript.status,
            created_at: transcript.created_at,
          };
          count++;
          if (count >= maxCount) return;
        }
      }
    }
  }

  // ===========================================================================
  // Speakers
  // ===========================================================================

  /**
   * Create a new speaker
   */
  async createSpeaker(input: SpeakerInput): Promise<Speaker> {
    const id = generateSpeakerID({
      name: input.name,
      fingerprint_hash: input.fingerprints.length > 0
        ? hashFingerprint(input.fingerprints[0].embedding)
        : undefined,
      created_at: Date.now(),
    });

    const speaker: Speaker = {
      ...input,
      id,
      stats: {
        transcript_count: 0,
        utterance_count: 0,
        total_speaking_time_ms: 0,
        ...input.stats,
      },
      created_at: Date.now(),
      updated_at: Date.now(),
    };

    // Write speaker file
    await this.writeSpeakerFile(speaker);

    // Append event
    const event: SpeakerCreatedEvent = {
      ts: new Date().toISOString(),
      op: "speaker.created",
      data: speaker,
    };
    this.appendEvent(event);

    return speaker;
  }

  /**
   * Write speaker to JSON file
   */
  private async writeSpeakerFile(speaker: Speaker): Promise<void> {
    const path = this.getSpeakerPath(speaker.id);

    // Serialize fingerprints separately (embeddings as base64)
    const serialized = {
      ...speaker,
      fingerprints: speaker.fingerprints.map((fp) => ({
        ...fp,
        embedding: Buffer.from(fp.embedding.buffer).toString("base64"),
      })),
    };

    writeFileSync(path, JSON.stringify(serialized, null, 2));
  }

  /**
   * Get a speaker by ID
   */
  async getSpeaker(id: SpeakerID): Promise<Speaker | null> {
    const path = this.getSpeakerPath(id);
    if (!existsSync(path)) return null;

    const content = readFileSync(path, "utf-8");
    const data = JSON.parse(content);

    // Deserialize fingerprints
    return {
      ...data,
      fingerprints: data.fingerprints.map((fp: any) => ({
        ...fp,
        embedding: new Float32Array(
          Buffer.from(fp.embedding, "base64").buffer
        ),
      })),
    };
  }

  /**
   * Get or create a speaker
   */
  async getOrCreateSpeaker(input: SpeakerInput): Promise<Speaker> {
    // Try to find by name first
    const existing = await this.findSpeakerByName(input.name);
    if (existing) return existing;
    return this.createSpeaker(input);
  }

  /**
   * Find speaker by name
   */
  async findSpeakerByName(name: string): Promise<Speaker | null> {
    const speakersDir = join(this.basePath, "speakers");
    if (!existsSync(speakersDir)) return null;

    const files = readdirSync(speakersDir).filter((f) => f.endsWith(".json"));
    for (const file of files) {
      const content = readFileSync(join(speakersDir, file), "utf-8");
      const data = JSON.parse(content);
      if (data.name.toLowerCase() === name.toLowerCase()) {
        return this.getSpeaker(data.id);
      }
    }
    return null;
  }

  /**
   * List all speakers
   */
  async *listSpeakers(limit?: number): AsyncGenerator<SpeakerSummary> {
    const speakersDir = join(this.basePath, "speakers");
    if (!existsSync(speakersDir)) return;

    const files = readdirSync(speakersDir).filter((f) => f.endsWith(".json"));
    let count = 0;
    const maxCount = limit ?? Infinity;

    for (const file of files) {
      if (count >= maxCount) return;

      const content = readFileSync(join(speakersDir, file), "utf-8");
      const data = JSON.parse(content);

      yield {
        id: data.id,
        name: data.name,
        avatar: data.avatar,
        transcript_count: data.stats?.transcript_count ?? 0,
        has_fingerprint: data.fingerprints?.length > 0,
        linked_platforms: data.identities?.map((i: any) => i.platform) ?? [],
      };
      count++;
    }
  }

  /**
   * Get all speakers with fingerprints (for matching)
   */
  async getSpeakersWithFingerprints(): Promise<Speaker[]> {
    const speakers: Speaker[] = [];
    for await (const summary of this.listSpeakers()) {
      if (summary.has_fingerprint) {
        const speaker = await this.getSpeaker(summary.id);
        if (speaker) speakers.push(speaker);
      }
    }
    return speakers;
  }

  // ===========================================================================
  // Entities
  // ===========================================================================

  /**
   * Create or update an entity
   */
  async upsertEntity(input: EntityInput): Promise<Entity> {
    const id = generateEntityID(input.type, input.name);
    const existing = await this.getEntity(id);

    if (existing) {
      // Merge mentions
      const entity: Entity = {
        ...existing,
        mentions: [...existing.mentions, ...(input.mentions || [])],
        mention_count: existing.mention_count + (input.mentions?.length || 0),
        relationships: [...existing.relationships, ...(input.relationships || [])],
        updated_at: Date.now(),
      };
      await this.writeEntityFile(entity);
      return entity;
    }

    const entity: Entity = {
      ...input,
      id,
      mentions: input.mentions || [],
      relationships: input.relationships || [],
      mention_count: input.mentions?.length || 0,
      created_at: Date.now(),
      updated_at: Date.now(),
    };

    await this.writeEntityFile(entity);

    const event: EntityCreatedEvent = {
      ts: new Date().toISOString(),
      op: "entity.created",
      data: entity,
    };
    this.appendEvent(event);

    return entity;
  }

  /**
   * Write entity to JSON file
   */
  private async writeEntityFile(entity: Entity): Promise<void> {
    const path = this.getEntityPath(entity.id);
    writeFileSync(path, JSON.stringify(entity, null, 2));
  }

  /**
   * Get an entity by ID
   */
  async getEntity(id: EntityID): Promise<Entity | null> {
    const path = this.getEntityPath(id);
    if (!existsSync(path)) return null;

    const content = readFileSync(path, "utf-8");
    return JSON.parse(content);
  }

  /**
   * List all entities
   */
  async *listEntities(limit?: number): AsyncGenerator<Entity> {
    const entitiesDir = join(this.basePath, "entities");
    if (!existsSync(entitiesDir)) return;

    const files = readdirSync(entitiesDir).filter((f) => f.endsWith(".json"));
    let count = 0;
    const maxCount = limit ?? Infinity;

    for (const file of files) {
      if (count >= maxCount) return;

      const content = readFileSync(join(entitiesDir, file), "utf-8");
      yield JSON.parse(content);
      count++;
    }
  }

  // ===========================================================================
  // Statistics
  // ===========================================================================

  /**
   * Get store statistics
   */
  async getStats(): Promise<{
    transcriptCount: number;
    speakerCount: number;
    entityCount: number;
    totalUtterances: number;
    totalDurationMs: number;
  }> {
    let transcriptCount = 0;
    let totalUtterances = 0;
    let totalDurationMs = 0;

    for await (const event of this.getAllEvents()) {
      if (event.op === "transcript.created") {
        transcriptCount++;
        const t = (event as TranscriptCreatedEvent).data;
        totalUtterances += t.utterances.length;
        totalDurationMs += t.source.audio.duration_ms;
      }
    }

    const speakersDir = join(this.basePath, "speakers");
    const speakerCount = existsSync(speakersDir)
      ? readdirSync(speakersDir).filter((f) => f.endsWith(".json")).length
      : 0;

    const entitiesDir = join(this.basePath, "entities");
    const entityCount = existsSync(entitiesDir)
      ? readdirSync(entitiesDir).filter((f) => f.endsWith(".json")).length
      : 0;

    return {
      transcriptCount,
      speakerCount,
      entityCount,
      totalUtterances,
      totalDurationMs,
    };
  }
}

// ===========================================================================
// Helpers
// ===========================================================================

/**
 * Format milliseconds as timestamp
 */
function formatTimestamp(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  const s = seconds % 60;
  const m = minutes % 60;

  if (hours > 0) {
    return `${hours}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Hash a fingerprint embedding for ID generation
 */
function hashFingerprint(embedding: Float32Array): string {
  const buffer = Buffer.from(embedding.buffer);
  return require("crypto").createHash("sha256").update(buffer).digest("hex").slice(0, 16);
}

/**
 * Create a store instance
 */
export function createStore(basePath?: string): TranscriptStore {
  return new TranscriptStore(basePath);
}
