/**
 * Content Identifier (CID) Generation
 *
 * Creates content-addressed identifiers using SHA-256 + base58 encoding.
 * CIDs are deterministic: same content always produces same ID.
 *
 * Format: "msg_" + base58(sha256(canonical_json))
 */

import { createHash } from "crypto";
import type { MessageInput } from "../types";

// Base58 alphabet (Bitcoin style - no 0, O, I, l to avoid confusion)
const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

/**
 * Encode bytes to base58 string
 */
export function base58Encode(bytes: Uint8Array): string {
  // Convert bytes to BigInt
  let num = BigInt(0);
  for (const byte of bytes) {
    num = num * BigInt(256) + BigInt(byte);
  }

  // Convert to base58
  let result = "";
  while (num > 0n) {
    const remainder = Number(num % 58n);
    result = BASE58_ALPHABET[remainder] + result;
    num = num / 58n;
  }

  // Add leading zeros (represented as '1' in base58)
  for (const byte of bytes) {
    if (byte === 0) {
      result = "1" + result;
    } else {
      break;
    }
  }

  return result || "1";
}

/**
 * Decode base58 string to bytes
 */
export function base58Decode(str: string): Uint8Array {
  let num = BigInt(0);

  for (const char of str) {
    const index = BASE58_ALPHABET.indexOf(char);
    if (index === -1) {
      throw new Error(`Invalid base58 character: ${char}`);
    }
    num = num * 58n + BigInt(index);
  }

  // Convert BigInt to bytes
  const bytes: number[] = [];
  while (num > 0n) {
    bytes.unshift(Number(num % 256n));
    num = num / 256n;
  }

  // Add leading zeros
  for (const char of str) {
    if (char === "1") {
      bytes.unshift(0);
    } else {
      break;
    }
  }

  return new Uint8Array(bytes);
}

/**
 * Canonicalize an object for consistent hashing
 *
 * Sorts keys alphabetically and stringifies consistently.
 * This ensures the same data always produces the same hash.
 */
export function canonicalize(obj: unknown): string {
  if (obj === null || obj === undefined) {
    return JSON.stringify(obj);
  }

  if (typeof obj !== "object") {
    return JSON.stringify(obj);
  }

  if (Array.isArray(obj)) {
    return "[" + obj.map(canonicalize).join(",") + "]";
  }

  const keys = Object.keys(obj as Record<string, unknown>).sort();
  const pairs = keys.map((k) => {
    const value = (obj as Record<string, unknown>)[k];
    return `${JSON.stringify(k)}:${canonicalize(value)}`;
  });

  return "{" + pairs.join(",") + "}";
}

/**
 * Generate SHA-256 hash of content
 */
export function sha256(content: string): Uint8Array {
  return new Uint8Array(createHash("sha256").update(content).digest());
}

/**
 * Generate CID for a message
 *
 * The CID is derived from:
 * - content: The message body
 * - kind: Message type number
 * - created_at: Original creation timestamp
 * - account_id: Author's account ID
 *
 * This ensures the same message always gets the same ID,
 * but different timestamps or authors produce different IDs.
 *
 * Uses full SHA-256 hash (no truncation) to preserve content-addressing guarantees.
 */
export function generateCID(input: MessageInput): string {
  const payload = canonicalize({
    content: input.content,
    kind: input.kind,
    created_at: input.created_at,
    account_id: input.account_id,
  });

  const hash = sha256(payload);
  const encoded = base58Encode(hash);

  // Use full hash - no truncation to preserve collision resistance
  return "msg_" + encoded;
}

/**
 * Verify that a CID matches its content
 */
export function verifyCID(cid: string, input: MessageInput): boolean {
  return cid === generateCID(input);
}

/**
 * Generate CID from raw content string (for simple use cases)
 */
export function generateContentCID(content: string): string {
  const hash = sha256(content);
  const encoded = base58Encode(hash);
  return "cid_" + encoded;
}

/**
 * Check if a string is a valid CID format
 *
 * Validates structure only (prefix + base58 characters).
 * For content verification, use verifyCID().
 */
export function isValidCID(str: string): boolean {
  if (!str.startsWith("msg_") && !str.startsWith("cid_")) {
    return false;
  }

  const encoded = str.slice(4);
  // SHA-256 produces 32 bytes, base58 encoded is typically 43-44 chars
  // Allow some variance for leading zeros
  if (encoded.length < 40 || encoded.length > 50) {
    return false;
  }

  // Check all characters are valid base58
  for (const char of encoded) {
    if (!BASE58_ALPHABET.includes(char)) {
      return false;
    }
  }

  return true;
}
