/**
 * Transcript ID Generation
 *
 * Content-addressed identifiers for transcripts, speakers, and entities.
 * Follows the CID pattern from the messages plugin.
 */

import { createHash } from "crypto";

// Base58 alphabet (Bitcoin-style, no confusing characters)
const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

/**
 * Encode bytes to base58
 */
function toBase58(bytes: Uint8Array): string {
  let num = BigInt(0);
  for (const byte of bytes) {
    num = num * BigInt(256) + BigInt(byte);
  }

  let result = "";
  while (num > 0) {
    result = BASE58_ALPHABET[Number(num % BigInt(58))] + result;
    num = num / BigInt(58);
  }

  // Preserve leading zeros
  for (const byte of bytes) {
    if (byte !== 0) break;
    result = "1" + result;
  }

  return result || "1";
}

/**
 * Hash content and return truncated base58
 */
function hashToId(content: string, length = 22): string {
  const hash = createHash("sha256").update(content).digest();
  return toBase58(hash).slice(0, length);
}

/**
 * Generate Transcript ID (TID)
 *
 * Based on source checksum + created_at for deduplication.
 */
export function generateTID(source: {
  checksum?: string;
  path?: string;
  url?: string;
  created_at: number;
}): string {
  const content = JSON.stringify({
    checksum: source.checksum,
    path: source.path,
    url: source.url,
    created_at: source.created_at,
  });
  return `tx_${hashToId(content)}`;
}

/**
 * Generate Speaker ID
 *
 * Based on initial fingerprint or name for new speakers.
 */
export function generateSpeakerID(seed: {
  name?: string;
  fingerprint_hash?: string;
  created_at: number;
}): string {
  const content = JSON.stringify(seed);
  return `spk_${hashToId(content, 16)}`;
}

/**
 * Generate Entity ID
 *
 * Based on type + normalized name for deduplication.
 */
export function generateEntityID(type: string, normalizedName: string): string {
  const content = `${type}:${normalizedName.toLowerCase()}`;
  return `ent_${hashToId(content, 16)}`;
}

/**
 * Generate Utterance ID
 *
 * Sequential within a transcript.
 */
export function generateUtteranceID(transcriptId: string, index: number): string {
  return `ut_${transcriptId.slice(3, 11)}_${String(index).padStart(4, "0")}`;
}

/**
 * Validate ID format
 */
export function isValidTID(id: string): boolean {
  return /^tx_[1-9A-HJ-NP-Za-km-z]{20,24}$/.test(id);
}

export function isValidSpeakerID(id: string): boolean {
  return /^spk_[1-9A-HJ-NP-Za-km-z]{14,18}$/.test(id);
}

export function isValidEntityID(id: string): boolean {
  return /^ent_[1-9A-HJ-NP-Za-km-z]{14,18}$/.test(id);
}

export function isValidUtteranceID(id: string): boolean {
  return /^ut_[1-9A-HJ-NP-Za-km-z]{8}_\d{4}$/.test(id);
}

/**
 * Extract transcript ID from utterance ID
 */
export function extractTranscriptID(utteranceId: string): string | null {
  const match = utteranceId.match(/^ut_([1-9A-HJ-NP-Za-km-z]{8})_/);
  if (!match) return null;
  // Note: This only gives partial ID - full transcript lookup needed
  return match[1];
}
