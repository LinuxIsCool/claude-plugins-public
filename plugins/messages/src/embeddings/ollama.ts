/**
 * Ollama Embeddings Client
 *
 * HTTP client for generating embeddings via local Ollama instance.
 * Uses nomic-embed-text model (768 dimensions) with L2 normalization.
 */

export interface EmbedderOptions {
  baseUrl?: string;
  model?: string;
  timeout?: number;
}

export interface EmbedResult {
  embedding: Float32Array;
  model: string;
}

export interface BatchEmbedResult {
  embeddings: Map<string, Float32Array>;
  model: string;
  errors: Map<string, Error>;
}

const DEFAULT_BASE_URL = "http://localhost:11434";
const DEFAULT_MODEL = "nomic-embed-text";
const DEFAULT_TIMEOUT = 30000;

/**
 * Ollama Embeddings Client
 *
 * Generates vector embeddings using a local Ollama instance.
 */
export class OllamaEmbedder {
  private baseUrl: string;
  private model: string;
  private timeout: number;

  constructor(options: EmbedderOptions = {}) {
    this.baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
    this.model = options.model ?? DEFAULT_MODEL;
    this.timeout = options.timeout ?? DEFAULT_TIMEOUT;
  }

  /**
   * Check if Ollama is available and the model is loaded
   */
  async isAvailable(): Promise<{ available: boolean; modelLoaded: boolean; error?: string }> {
    try {
      // Check if Ollama is running
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        return { available: false, modelLoaded: false, error: `HTTP ${response.status}` };
      }

      const data = (await response.json()) as { models?: Array<{ name: string }> };
      const models = data.models ?? [];

      // Check if our model is available
      const modelLoaded = models.some(
        (m) => m.name === this.model || m.name === `${this.model}:latest`
      );

      return { available: true, modelLoaded };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { available: false, modelLoaded: false, error: message };
    }
  }

  /**
   * Get embedding dimensions for the current model
   */
  getDimensions(): number {
    // nomic-embed-text uses 768 dimensions
    if (this.model.includes("nomic-embed-text")) {
      return 768;
    }
    // mxbai-embed-large uses 1024 dimensions
    if (this.model.includes("mxbai-embed")) {
      return 1024;
    }
    // Default assumption
    return 768;
  }

  /**
   * Generate embedding for a single text
   */
  async embed(text: string): Promise<EmbedResult> {
    const response = await fetch(`${this.baseUrl}/api/embeddings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.model,
        prompt: text,
      }),
      signal: AbortSignal.timeout(this.timeout),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ollama API error: ${response.status} - ${errorText}`);
    }

    const data = (await response.json()) as { embedding: number[] };

    // Convert to Float32Array and normalize
    const embedding = this.normalize(new Float32Array(data.embedding));

    return { embedding, model: this.model };
  }

  /**
   * Generate embeddings for multiple texts in batch
   *
   * @param texts Map of id -> text to embed
   * @param onProgress Optional progress callback
   */
  async embedBatch(
    texts: Map<string, string>,
    onProgress?: (completed: number, total: number) => void
  ): Promise<BatchEmbedResult> {
    const embeddings = new Map<string, Float32Array>();
    const errors = new Map<string, Error>();
    const total = texts.size;
    let completed = 0;

    // Process sequentially to avoid overwhelming Ollama
    for (const [id, text] of texts) {
      try {
        const result = await this.embed(text);
        embeddings.set(id, result.embedding);
      } catch (error) {
        errors.set(id, error instanceof Error ? error : new Error(String(error)));
      }

      completed++;
      if (onProgress) {
        onProgress(completed, total);
      }
    }

    return { embeddings, model: this.model, errors };
  }

  /**
   * Generate embeddings for an array of texts
   * Returns embeddings in the same order as input
   */
  async embedArray(
    texts: string[],
    onProgress?: (completed: number, total: number) => void
  ): Promise<{ embeddings: Float32Array[]; errors: Array<{ index: number; error: Error }> }> {
    const embeddings: Float32Array[] = [];
    const errors: Array<{ index: number; error: Error }> = [];
    const total = texts.length;

    for (let i = 0; i < texts.length; i++) {
      try {
        const result = await this.embed(texts[i]);
        embeddings.push(result.embedding);
      } catch (error) {
        errors.push({
          index: i,
          error: error instanceof Error ? error : new Error(String(error)),
        });
        // Push empty embedding to maintain index alignment
        embeddings.push(new Float32Array(this.getDimensions()));
      }

      if (onProgress) {
        onProgress(i + 1, total);
      }
    }

    return { embeddings, errors };
  }

  /**
   * L2 normalize a vector for cosine similarity
   */
  private normalize(embedding: Float32Array): Float32Array {
    let norm = 0;
    for (let i = 0; i < embedding.length; i++) {
      norm += embedding[i] * embedding[i];
    }
    norm = Math.sqrt(norm);

    if (norm > 0) {
      for (let i = 0; i < embedding.length; i++) {
        embedding[i] = embedding[i] / norm;
      }
    }

    return embedding;
  }

  /**
   * Get model name
   */
  getModel(): string {
    return this.model;
  }
}

/**
 * Create an Ollama embedder instance
 */
export function createOllamaEmbedder(options?: EmbedderOptions): OllamaEmbedder {
  return new OllamaEmbedder(options);
}
