/**
 * Domain Events
 *
 * Event sourcing events for the transcript plugin.
 * All state changes are represented as immutable events.
 */

import type { Transcript, TranscriptStatus, TID } from "../entities/transcript.js";
import type { Speaker, SpeakerID, VoiceFingerprint, SpeakerFact } from "../entities/speaker.js";
import type { Entity, EntityID, EntityMention, EntityRelationship } from "../entities/entity.js";
import type { Utterance } from "../entities/utterance.js";

/**
 * Base event structure
 */
export interface DomainEvent<T extends string = string, D = unknown> {
  ts: string;                   // ISO 8601 timestamp
  op: T;                        // Event type
  data: D;                      // Event payload
  correlation_id?: string;      // For tracing related events
}

// =============================================================================
// Transcript Events
// =============================================================================

export interface TranscriptCreatedEvent extends DomainEvent<"transcript.created", Transcript> {
  op: "transcript.created";
}

export interface TranscriptStatusChangedEvent extends DomainEvent<"transcript.status_changed", {
  id: TID;
  old_status: TranscriptStatus;
  new_status: TranscriptStatus;
  error?: string;
}> {
  op: "transcript.status_changed";
}

export interface TranscriptUtterancesAddedEvent extends DomainEvent<"transcript.utterances_added", {
  transcript_id: TID;
  utterances: Utterance[];
}> {
  op: "transcript.utterances_added";
}

export interface TranscriptDeletedEvent extends DomainEvent<"transcript.deleted", {
  id: TID;
  reason?: string;
}> {
  op: "transcript.deleted";
}

// =============================================================================
// Speaker Events
// =============================================================================

export interface SpeakerCreatedEvent extends DomainEvent<"speaker.created", Speaker> {
  op: "speaker.created";
}

export interface SpeakerUpdatedEvent extends DomainEvent<"speaker.updated", {
  id: SpeakerID;
  changes: Partial<Speaker>;
}> {
  op: "speaker.updated";
}

export interface SpeakerFingerprintAddedEvent extends DomainEvent<"speaker.fingerprint_added", {
  speaker_id: SpeakerID;
  fingerprint: Omit<VoiceFingerprint, "embedding"> & { embedding_base64: string };
}> {
  op: "speaker.fingerprint_added";
}

export interface SpeakerLinkedEvent extends DomainEvent<"speaker.linked", {
  speaker_id: SpeakerID;
  platform: string;
  external_id: string;
  handle?: string;
}> {
  op: "speaker.linked";
}

export interface SpeakerFactAddedEvent extends DomainEvent<"speaker.fact_added", {
  speaker_id: SpeakerID;
  fact: SpeakerFact;
}> {
  op: "speaker.fact_added";
}

export interface SpeakerMergedEvent extends DomainEvent<"speaker.merged", {
  source_id: SpeakerID;
  target_id: SpeakerID;
  reason?: string;
}> {
  op: "speaker.merged";
}

// =============================================================================
// Entity Events
// =============================================================================

export interface EntityCreatedEvent extends DomainEvent<"entity.created", Entity> {
  op: "entity.created";
}

export interface EntityMentionAddedEvent extends DomainEvent<"entity.mention_added", {
  entity_id: EntityID;
  mention: EntityMention;
}> {
  op: "entity.mention_added";
}

export interface EntityRelationshipAddedEvent extends DomainEvent<"entity.relationship_added", {
  relationship: EntityRelationship;
}> {
  op: "entity.relationship_added";
}

export interface EntityUpdatedEvent extends DomainEvent<"entity.updated", {
  id: EntityID;
  changes: Partial<Entity>;
}> {
  op: "entity.updated";
}

// =============================================================================
// Union Types
// =============================================================================

export type TranscriptEvent =
  | TranscriptCreatedEvent
  | TranscriptStatusChangedEvent
  | TranscriptUtterancesAddedEvent
  | TranscriptDeletedEvent;

export type SpeakerEvent =
  | SpeakerCreatedEvent
  | SpeakerUpdatedEvent
  | SpeakerFingerprintAddedEvent
  | SpeakerLinkedEvent
  | SpeakerFactAddedEvent
  | SpeakerMergedEvent;

export type EntityEvent =
  | EntityCreatedEvent
  | EntityMentionAddedEvent
  | EntityRelationshipAddedEvent
  | EntityUpdatedEvent;

export type Event = TranscriptEvent | SpeakerEvent | EntityEvent;

/**
 * Event type discriminator
 */
export type EventType = Event["op"];
