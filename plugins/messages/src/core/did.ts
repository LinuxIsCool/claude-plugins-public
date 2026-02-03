/**
 * Decentralized Identifier (DID) Utilities
 *
 * Implements did:key method with Ed25519 keys.
 * DIDs provide portable, cryptographic identity across platforms.
 *
 * Format: did:key:z + base58(multicodec_prefix + public_key)
 *
 * The "z" prefix indicates base58btc encoding (multibase).
 * The multicodec prefix (0xed01) indicates Ed25519 public key.
 */

import { generateKeyPairSync, sign, verify, createPublicKey, createPrivateKey } from "crypto";
import * as ed from "@noble/ed25519";
import { sha256 as nobleSha256, sha512 } from "@noble/hashes/sha2";
import { base58Encode, base58Decode } from "./cid";
import type { DID } from "../types";

// Configure @noble/ed25519 to use @noble/hashes for SHA-512
// This is required because noble-ed25519 doesn't bundle a hash implementation
ed.etc.sha512Sync = (...m) => sha512(ed.etc.concatBytes(...m));

// Multicodec prefix for Ed25519 public key
const MULTICODEC_ED25519_PUB = new Uint8Array([0xed, 0x01]);

/**
 * Convert raw 32-byte Ed25519 private key to PKCS8 DER format
 *
 * This allows @noble/ed25519 generated keys to work with Node.js crypto signing.
 *
 * PKCS8 structure for Ed25519:
 * - Header: ASN.1 sequence wrapping
 * - OID: 1.3.101.112 (Ed25519)
 * - Private key: OCTET STRING containing the 32-byte seed
 */
function privateKeyToPKCS8(privateKey: Uint8Array): Uint8Array {
  if (privateKey.length !== 32) {
    throw new Error("Ed25519 private key must be 32 bytes");
  }

  // PKCS8 wrapper for Ed25519 (fixed ASN.1 structure)
  const pkcs8Prefix = new Uint8Array([
    0x30, 0x2e, // SEQUENCE (46 bytes total)
    0x02, 0x01, 0x00, // INTEGER version = 0
    0x30, 0x05, // SEQUENCE (5 bytes) - algorithm identifier
    0x06, 0x03, 0x2b, 0x65, 0x70, // OID 1.3.101.112 (Ed25519)
    0x04, 0x22, // OCTET STRING (34 bytes)
    0x04, 0x20, // OCTET STRING (32 bytes) - the actual key
  ]);

  const pkcs8Key = new Uint8Array(pkcs8Prefix.length + privateKey.length);
  pkcs8Key.set(pkcs8Prefix, 0);
  pkcs8Key.set(privateKey, pkcs8Prefix.length);

  return pkcs8Key;
}

/**
 * DID Key pair with signing capabilities
 */
export interface DIDKeyPair {
  did: DID;
  publicKey: Uint8Array;
  privateKey: Uint8Array;
}

/**
 * Generate a new DID with Ed25519 keypair
 *
 * Returns a DID in the format: did:key:z...
 * Along with the raw public and private key bytes.
 */
export function generateDID(): DIDKeyPair {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");

  // Export keys to raw format
  // SPKI format for Ed25519 has 12 bytes header, key is last 32 bytes
  const pubKeyDer = publicKey.export({ type: "spki", format: "der" });
  const pubKeyRaw = new Uint8Array(pubKeyDer.slice(-32));

  // PKCS8 format for Ed25519 - we store the full DER for signing
  const privKeyDer = privateKey.export({ type: "pkcs8", format: "der" });

  // Build multicodec key: prefix + public key
  const multicodecKey = new Uint8Array(MULTICODEC_ED25519_PUB.length + pubKeyRaw.length);
  multicodecKey.set(MULTICODEC_ED25519_PUB, 0);
  multicodecKey.set(pubKeyRaw, MULTICODEC_ED25519_PUB.length);

  // Encode with multibase (z = base58btc)
  const did = `did:key:z${base58Encode(multicodecKey)}` as DID;

  return {
    did,
    publicKey: pubKeyRaw,
    privateKey: new Uint8Array(privKeyDer),
  };
}

/**
 * Extract public key from a did:key DID
 */
export function extractPublicKey(did: DID): Uint8Array {
  if (!did.startsWith("did:key:z")) {
    throw new Error("Only did:key method with base58btc (z) encoding is supported");
  }

  // Remove "did:key:z" prefix and decode
  const encoded = did.slice(9);
  const decoded = base58Decode(encoded);

  // Verify multicodec prefix
  if (decoded[0] !== 0xed || decoded[1] !== 0x01) {
    throw new Error("Invalid multicodec prefix - expected Ed25519 public key (0xed01)");
  }

  // Return raw public key (without prefix)
  return decoded.slice(2);
}

/**
 * Sign content with a DID private key
 *
 * Returns base58-encoded signature.
 */
export function signWithDID(content: string, privateKey: Uint8Array): string {
  const privKeyObj = createPrivateKey({
    key: Buffer.from(privateKey),
    format: "der",
    type: "pkcs8",
  });

  const signature = sign(null, Buffer.from(content), privKeyObj);
  return base58Encode(new Uint8Array(signature));
}

/**
 * Verify a signature against a DID
 */
export function verifyDIDSignature(did: DID, content: string, signature: string): boolean {
  try {
    const publicKey = extractPublicKey(did);

    // Reconstruct SPKI format for verification
    // Ed25519 SPKI header
    const spkiHeader = new Uint8Array([
      0x30, 0x2a, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x03, 0x21, 0x00,
    ]);
    const spkiKey = new Uint8Array(spkiHeader.length + publicKey.length);
    spkiKey.set(spkiHeader, 0);
    spkiKey.set(publicKey, spkiHeader.length);

    const pubKeyObj = createPublicKey({
      key: Buffer.from(spkiKey),
      format: "der",
      type: "spki",
    });

    const sigBytes = base58Decode(signature);
    return verify(null, Buffer.from(content), pubKeyObj, Buffer.from(sigBytes));
  } catch {
    return false;
  }
}

/**
 * Check if a string is a valid did:key format
 */
export function isValidDID(str: string): boolean {
  if (!str.startsWith("did:key:z")) {
    return false;
  }

  try {
    extractPublicKey(str as DID);
    return true;
  } catch {
    return false;
  }
}

/**
 * Export DID keypair for storage
 */
export function exportDIDKeyPair(keypair: DIDKeyPair): { did: string; privateKey: string } {
  return {
    did: keypair.did,
    privateKey: base58Encode(keypair.privateKey),
  };
}

/**
 * Import DID keypair from storage
 */
export function importDIDKeyPair(data: { did: string; privateKey: string }): DIDKeyPair {
  const privateKey = base58Decode(data.privateKey);
  const publicKey = extractPublicKey(data.did as DID);

  return {
    did: data.did as DID,
    publicKey,
    privateKey,
  };
}

/**
 * Generate a deterministic DID from a seed
 *
 * Uses SHA-256 to convert arbitrary string seeds to 32-byte Ed25519 private keys.
 * Same seed always produces the same DID - useful for linking platform accounts.
 *
 * @param seed - Any string (e.g., "telegram:@username", "email:user@domain.com")
 * @returns DIDKeyPair with deterministic keys
 *
 * Security note: Less secure than random generation. Use for derived identities only
 * (linking platform accounts to DIDs). For primary identities, use generateDID().
 */
export function deriveDID(seed: string): DIDKeyPair {
  // Convert seed to 32-byte private key using SHA-256
  // Any 32-byte value is a valid Ed25519 private key (RFC 8032)
  const privateKeyRaw = nobleSha256(new TextEncoder().encode(seed));

  // Generate deterministic public key using @noble/ed25519
  const publicKeyRaw = ed.getPublicKey(privateKeyRaw);

  // Convert private key to PKCS8 DER format for Node.js crypto compatibility
  const privateKeyDer = privateKeyToPKCS8(privateKeyRaw);

  // Build DID from public key using existing helper
  const did = didFromPublicKey(publicKeyRaw);

  return {
    did,
    publicKey: publicKeyRaw,
    privateKey: privateKeyDer,
  };
}

/**
 * Create a DID from an existing public key
 */
export function didFromPublicKey(publicKey: Uint8Array): DID {
  if (publicKey.length !== 32) {
    throw new Error("Ed25519 public key must be 32 bytes");
  }

  const multicodecKey = new Uint8Array(MULTICODEC_ED25519_PUB.length + publicKey.length);
  multicodecKey.set(MULTICODEC_ED25519_PUB, 0);
  multicodecKey.set(publicKey, MULTICODEC_ED25519_PUB.length);

  return `did:key:z${base58Encode(multicodecKey)}` as DID;
}
