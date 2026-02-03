/**
 * Embeddings Module
 *
 * Local vector embeddings for semantic search.
 * Uses Ollama with nomic-embed-text model.
 */

export {
  OllamaEmbedder,
  createOllamaEmbedder,
  type EmbedderOptions,
  type EmbedResult,
  type BatchEmbedResult,
} from "./ollama";

export {
  EmbeddingStore,
  createEmbeddingStore,
  type StoredEmbedding,
  type SimilarityResult,
  type EmbeddingStats,
} from "./store";
