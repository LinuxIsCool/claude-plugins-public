/**
 * Messages Plugin
 *
 * Universal messaging backbone with content-addressed storage and DID-based identity.
 */

// Types
export * from "./types";

// Core
export { generateCID, verifyCID, base58Encode, base58Decode, canonicalize } from "./core/cid";
export {
  generateDID,
  extractPublicKey,
  signWithDID,
  verifyDIDSignature,
  isValidDID,
  didFromPublicKey,
  exportDIDKeyPair,
  importDIDKeyPair,
} from "./core/did";
export { MessageStore, createStore } from "./core/store";

// Search
export { SearchIndex, createSearchIndex } from "./search";

// Adapters
export { importTelegramExport, countTelegramExport } from "./adapters/telegram";
export { importLogging, countLoggingEvents, getDefaultLogsDir } from "./adapters/logging";
