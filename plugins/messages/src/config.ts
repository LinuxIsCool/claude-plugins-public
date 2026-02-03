/**
 * Messages Plugin Configuration
 *
 * Provides absolute paths anchored to the git repository root.
 * Uses the shared lib/paths.ts utility for consistent path resolution.
 */

import { getClaudePath, getRepoRoot } from "../../../lib/paths";
export { getRepoRoot };

/**
 * Get the messages base path (always at repo root)
 */
export function getMessagesBasePath(): string {
  return getClaudePath("messages");
}

/**
 * Get the search database path
 */
export function getSearchDbPath(): string {
  return getClaudePath("messages/search/index.db");
}

/**
 * Get the embeddings database path
 */
export function getEmbeddingsDbPath(): string {
  return getClaudePath("messages/search/embeddings.db");
}

/**
 * Get the entities database path
 */
export function getEntitiesDbPath(): string {
  return getClaudePath("messages/entities/index.db");
}

/**
 * Get the analytics database path (same as search for now)
 */
export function getAnalyticsDbPath(): string {
  return getSearchDbPath();
}

// Export paths object for convenience
export const paths = {
  get base() { return getMessagesBasePath(); },
  get searchDb() { return getSearchDbPath(); },
  get embeddingsDb() { return getEmbeddingsDbPath(); },
  get entitiesDb() { return getEntitiesDbPath(); },
  get analyticsDb() { return getAnalyticsDbPath(); },
};
