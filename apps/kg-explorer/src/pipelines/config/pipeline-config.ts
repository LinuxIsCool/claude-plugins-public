/**
 * @fileoverview Central pipeline configuration
 * @module kg-explorer/pipelines/config/pipeline-config
 *
 * Provides centralized configuration for:
 * - Source configurations and rate limits
 * - Batch sizes and retry policies
 * - Backend connection settings
 * - Monitoring thresholds
 */

import { RetryPolicy, SourceType, EmbeddingModel } from "../types";
import { DEFAULT_GITHUB_CONFIG } from "../extractors/github-extractor";
import { DEFAULT_NPM_CONFIG } from "../extractors/npm-extractor";
import { DEFAULT_PYPI_CONFIG } from "../extractors/pypi-extractor";
import { DEFAULT_ARXIV_CONFIG } from "../extractors/arxiv-extractor";
import { DEFAULT_WEB_CONFIG } from "../extractors/web-extractor";
import { DEFAULT_NEO4J_CONFIG } from "../loaders/neo4j-loader";
import { DEFAULT_TYPEDB_CONFIG } from "../loaders/typedb-loader";
import { DEFAULT_JSON_CONFIG } from "../loaders/json-loader";
import { DEFAULT_ORCHESTRATOR_CONFIG } from "../orchestrator";
import { DEFAULT_METRICS_CONFIG } from "../monitors/pipeline-metrics";
import { DEFAULT_QUALITY_CONFIG } from "../monitors/data-quality-monitor";
import { DEFAULT_FRESHNESS_CONFIG } from "../monitors/freshness-monitor";

// ============================================================================
// Environment Configuration
// ============================================================================

export type Environment = "development" | "staging" | "production";

export interface EnvironmentConfig {
  /** Current environment */
  readonly environment: Environment;
  /** Enable debug logging */
  readonly debug: boolean;
  /** Log level */
  readonly logLevel: "error" | "warn" | "info" | "debug";
  /** Enable dry run mode */
  readonly dryRun: boolean;
}

export const DEFAULT_ENVIRONMENT_CONFIG: EnvironmentConfig = {
  environment: "development",
  debug: true,
  logLevel: "info",
  dryRun: false,
};

// ============================================================================
// Source Configuration
// ============================================================================

export interface SourceConfig {
  /** Enable this source */
  readonly enabled: boolean;
  /** API token or authentication */
  readonly apiToken?: string;
  /** Custom base URL */
  readonly baseUrl?: string;
  /** Rate limit (requests per second) */
  readonly rateLimitPerSecond: number;
  /** Request timeout (ms) */
  readonly timeoutMs: number;
  /** Retry policy */
  readonly retryPolicy: RetryPolicy;
  /** Additional headers */
  readonly headers?: Record<string, string>;
}

export interface AllSourcesConfig {
  readonly github: SourceConfig;
  readonly npm: SourceConfig;
  readonly pypi: SourceConfig;
  readonly arxiv: SourceConfig;
  readonly web: SourceConfig;
}

export const DEFAULT_SOURCES_CONFIG: AllSourcesConfig = {
  github: {
    enabled: true,
    baseUrl: DEFAULT_GITHUB_CONFIG.baseUrl,
    rateLimitPerSecond: DEFAULT_GITHUB_CONFIG.rateLimitPerSecond,
    timeoutMs: DEFAULT_GITHUB_CONFIG.timeoutMs,
    retryPolicy: {
      maxAttempts: 3,
      initialDelayMs: 1000,
      maxDelayMs: 30000,
      backoffMultiplier: 2,
      retryableErrors: ["network", "rate_limit", "timeout"],
    },
  },
  npm: {
    enabled: true,
    baseUrl: DEFAULT_NPM_CONFIG.baseUrl,
    rateLimitPerSecond: DEFAULT_NPM_CONFIG.rateLimitPerSecond,
    timeoutMs: DEFAULT_NPM_CONFIG.timeoutMs,
    retryPolicy: {
      maxAttempts: 3,
      initialDelayMs: 1000,
      maxDelayMs: 30000,
      backoffMultiplier: 2,
      retryableErrors: ["network", "rate_limit", "timeout"],
    },
  },
  pypi: {
    enabled: true,
    baseUrl: DEFAULT_PYPI_CONFIG.baseUrl,
    rateLimitPerSecond: DEFAULT_PYPI_CONFIG.rateLimitPerSecond,
    timeoutMs: DEFAULT_PYPI_CONFIG.timeoutMs,
    retryPolicy: {
      maxAttempts: 3,
      initialDelayMs: 1000,
      maxDelayMs: 30000,
      backoffMultiplier: 2,
      retryableErrors: ["network", "rate_limit", "timeout"],
    },
  },
  arxiv: {
    enabled: true,
    baseUrl: DEFAULT_ARXIV_CONFIG.baseUrl,
    rateLimitPerSecond: DEFAULT_ARXIV_CONFIG.rateLimitPerSecond,
    timeoutMs: DEFAULT_ARXIV_CONFIG.timeoutMs,
    retryPolicy: {
      maxAttempts: 3,
      initialDelayMs: 3000, // ArXiv requires longer delays
      maxDelayMs: 60000,
      backoffMultiplier: 2,
      retryableErrors: ["network", "rate_limit", "timeout"],
    },
  },
  web: {
    enabled: true,
    rateLimitPerSecond: DEFAULT_WEB_CONFIG.rateLimitPerSecond,
    timeoutMs: DEFAULT_WEB_CONFIG.timeoutMs,
    retryPolicy: {
      maxAttempts: 2,
      initialDelayMs: 1000,
      maxDelayMs: 10000,
      backoffMultiplier: 2,
      retryableErrors: ["network", "timeout"],
    },
  },
};

// ============================================================================
// Backend Configuration
// ============================================================================

export interface BackendConfig {
  /** Enable this backend */
  readonly enabled: boolean;
  /** Connection URI */
  readonly uri: string;
  /** Database name */
  readonly database: string;
  /** Authentication */
  readonly auth?: {
    readonly username: string;
    readonly password: string;
  };
  /** Connection pool size */
  readonly poolSize: number;
  /** Connection timeout (ms) */
  readonly connectionTimeoutMs: number;
  /** Query timeout (ms) */
  readonly queryTimeoutMs: number;
}

export interface AllBackendsConfig {
  readonly neo4j: BackendConfig;
  readonly typedb: BackendConfig;
  readonly json: {
    readonly enabled: boolean;
    readonly baseDir: string;
    readonly filePattern: "single" | "by-type" | "by-batch";
  };
}

export const DEFAULT_BACKENDS_CONFIG: AllBackendsConfig = {
  neo4j: {
    enabled: false,
    uri: DEFAULT_NEO4J_CONFIG.uri,
    database: DEFAULT_NEO4J_CONFIG.database,
    auth: DEFAULT_NEO4J_CONFIG.auth,
    poolSize: DEFAULT_NEO4J_CONFIG.poolSize,
    connectionTimeoutMs: DEFAULT_NEO4J_CONFIG.connectionTimeoutMs,
    queryTimeoutMs: DEFAULT_NEO4J_CONFIG.queryTimeoutMs,
  },
  typedb: {
    enabled: false,
    uri: DEFAULT_TYPEDB_CONFIG.address,
    database: DEFAULT_TYPEDB_CONFIG.database,
    poolSize: DEFAULT_TYPEDB_CONFIG.poolSize,
    connectionTimeoutMs: DEFAULT_TYPEDB_CONFIG.connectionTimeoutMs,
    queryTimeoutMs: DEFAULT_TYPEDB_CONFIG.queryTimeoutMs,
  },
  json: {
    enabled: true,
    baseDir: DEFAULT_JSON_CONFIG.baseDir,
    filePattern: DEFAULT_JSON_CONFIG.filePattern,
  },
};

// ============================================================================
// Processing Configuration
// ============================================================================

export interface ProcessingConfig {
  /** Default batch size */
  readonly batchSize: number;
  /** Maximum concurrent operations */
  readonly maxConcurrency: number;
  /** Enable checkpointing */
  readonly enableCheckpoints: boolean;
  /** Checkpoint interval (items) */
  readonly checkpointInterval: number;
  /** Default retry policy */
  readonly retryPolicy: RetryPolicy;
}

export const DEFAULT_PROCESSING_CONFIG: ProcessingConfig = {
  batchSize: 100,
  maxConcurrency: DEFAULT_ORCHESTRATOR_CONFIG.maxConcurrency,
  enableCheckpoints: true,
  checkpointInterval: 100,
  retryPolicy: DEFAULT_ORCHESTRATOR_CONFIG.defaultRetryPolicy,
};

// ============================================================================
// Transformation Configuration
// ============================================================================

export interface TransformationConfig {
  /** Confidence threshold for entities */
  readonly confidenceThreshold: number;
  /** Enable deduplication */
  readonly enableDeduplication: boolean;
  /** Deduplication similarity threshold */
  readonly deduplicationThreshold: number;
  /** Enable embeddings */
  readonly enableEmbeddings: boolean;
  /** Embedding model to use */
  readonly embeddingModel: EmbeddingModel;
  /** Embedding API key (for cloud providers) */
  readonly embeddingApiKey?: string;
  /** Enable temporal tracking */
  readonly enableTemporal: boolean;
}

export const DEFAULT_TRANSFORMATION_CONFIG: TransformationConfig = {
  confidenceThreshold: 0.5,
  enableDeduplication: true,
  deduplicationThreshold: 0.85,
  enableEmbeddings: false,
  embeddingModel: "local-e5",
  enableTemporal: true,
};

// ============================================================================
// Monitoring Configuration
// ============================================================================

export interface MonitoringConfig {
  /** Enable metrics collection */
  readonly enableMetrics: boolean;
  /** Metrics collection interval (ms) */
  readonly metricsIntervalMs: number;
  /** Enable data quality monitoring */
  readonly enableQualityMonitoring: boolean;
  /** Fail on quality errors */
  readonly failOnQualityErrors: boolean;
  /** Maximum allowed error rate */
  readonly maxErrorRate: number;
  /** Enable freshness monitoring */
  readonly enableFreshnessMonitoring: boolean;
  /** Default freshness threshold (hours) */
  readonly defaultFreshnessHours: number;
}

export const DEFAULT_MONITORING_CONFIG: MonitoringConfig = {
  enableMetrics: DEFAULT_METRICS_CONFIG.trackMemory,
  metricsIntervalMs: DEFAULT_METRICS_CONFIG.collectionIntervalMs,
  enableQualityMonitoring: DEFAULT_QUALITY_CONFIG.enabled,
  failOnQualityErrors: DEFAULT_QUALITY_CONFIG.failOnError,
  maxErrorRate: DEFAULT_QUALITY_CONFIG.maxErrorRate,
  enableFreshnessMonitoring: DEFAULT_FRESHNESS_CONFIG.enabled,
  defaultFreshnessHours: DEFAULT_FRESHNESS_CONFIG.defaultMaxAgeHours,
};

// ============================================================================
// Complete Pipeline Configuration
// ============================================================================

export interface PipelineConfiguration {
  readonly environment: EnvironmentConfig;
  readonly sources: AllSourcesConfig;
  readonly backends: AllBackendsConfig;
  readonly processing: ProcessingConfig;
  readonly transformation: TransformationConfig;
  readonly monitoring: MonitoringConfig;
}

export const DEFAULT_PIPELINE_CONFIG: PipelineConfiguration = {
  environment: DEFAULT_ENVIRONMENT_CONFIG,
  sources: DEFAULT_SOURCES_CONFIG,
  backends: DEFAULT_BACKENDS_CONFIG,
  processing: DEFAULT_PROCESSING_CONFIG,
  transformation: DEFAULT_TRANSFORMATION_CONFIG,
  monitoring: DEFAULT_MONITORING_CONFIG,
};

// ============================================================================
// Configuration Builder
// ============================================================================

export class PipelineConfigBuilder {
  private config: PipelineConfiguration = { ...DEFAULT_PIPELINE_CONFIG };

  setEnvironment(env: Environment): this {
    this.config = {
      ...this.config,
      environment: {
        ...this.config.environment,
        environment: env,
        debug: env === "development",
        logLevel: env === "production" ? "warn" : "info",
      },
    };
    return this;
  }

  enableSource(source: SourceType, apiToken?: string): this {
    const sourceConfig = this.config.sources[source as keyof AllSourcesConfig];
    if (sourceConfig && "enabled" in sourceConfig) {
      (this.config.sources as any)[source] = {
        ...sourceConfig,
        enabled: true,
        apiToken,
      };
    }
    return this;
  }

  disableSource(source: SourceType): this {
    const sourceConfig = this.config.sources[source as keyof AllSourcesConfig];
    if (sourceConfig && "enabled" in sourceConfig) {
      (this.config.sources as any)[source] = {
        ...sourceConfig,
        enabled: false,
      };
    }
    return this;
  }

  enableBackend(
    backend: "neo4j" | "typedb" | "json",
    connectionConfig?: Partial<BackendConfig>
  ): this {
    (this.config.backends as any)[backend] = {
      ...this.config.backends[backend],
      enabled: true,
      ...connectionConfig,
    };
    return this;
  }

  disableBackend(backend: "neo4j" | "typedb" | "json"): this {
    (this.config.backends as any)[backend] = {
      ...this.config.backends[backend],
      enabled: false,
    };
    return this;
  }

  setBatchSize(size: number): this {
    this.config = {
      ...this.config,
      processing: {
        ...this.config.processing,
        batchSize: size,
      },
    };
    return this;
  }

  setConcurrency(max: number): this {
    this.config = {
      ...this.config,
      processing: {
        ...this.config.processing,
        maxConcurrency: max,
      },
    };
    return this;
  }

  enableEmbeddings(model: EmbeddingModel, apiKey?: string): this {
    this.config = {
      ...this.config,
      transformation: {
        ...this.config.transformation,
        enableEmbeddings: true,
        embeddingModel: model,
        embeddingApiKey: apiKey,
      },
    };
    return this;
  }

  disableEmbeddings(): this {
    this.config = {
      ...this.config,
      transformation: {
        ...this.config.transformation,
        enableEmbeddings: false,
      },
    };
    return this;
  }

  enableDeduplication(threshold?: number): this {
    this.config = {
      ...this.config,
      transformation: {
        ...this.config.transformation,
        enableDeduplication: true,
        deduplicationThreshold: threshold ?? this.config.transformation.deduplicationThreshold,
      },
    };
    return this;
  }

  enableQualityMonitoring(failOnErrors?: boolean): this {
    this.config = {
      ...this.config,
      monitoring: {
        ...this.config.monitoring,
        enableQualityMonitoring: true,
        failOnQualityErrors: failOnErrors ?? this.config.monitoring.failOnQualityErrors,
      },
    };
    return this;
  }

  setRetryPolicy(policy: Partial<RetryPolicy>): this {
    this.config = {
      ...this.config,
      processing: {
        ...this.config.processing,
        retryPolicy: {
          ...this.config.processing.retryPolicy,
          ...policy,
        },
      },
    };
    return this;
  }

  build(): PipelineConfiguration {
    return this.config;
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

export function createPipelineConfig(): PipelineConfigBuilder {
  return new PipelineConfigBuilder();
}

export function getDevelopmentConfig(): PipelineConfiguration {
  return createPipelineConfig()
    .setEnvironment("development")
    .enableBackend("json")
    .disableBackend("neo4j")
    .disableBackend("typedb")
    .setBatchSize(50)
    .setConcurrency(2)
    .disableEmbeddings()
    .build();
}

export function getProductionConfig(): PipelineConfiguration {
  return createPipelineConfig()
    .setEnvironment("production")
    .enableBackend("neo4j")
    .enableBackend("json") // Keep JSON as backup
    .setBatchSize(100)
    .setConcurrency(4)
    .enableQualityMonitoring(true)
    .setRetryPolicy({
      maxAttempts: 5,
      initialDelayMs: 2000,
      maxDelayMs: 60000,
    })
    .build();
}

// ============================================================================
// Configuration Validation
// ============================================================================

export interface ConfigValidationResult {
  readonly valid: boolean;
  readonly errors: string[];
  readonly warnings: string[];
}

export function validateConfig(config: PipelineConfiguration): ConfigValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check for at least one enabled source
  const enabledSources = Object.entries(config.sources).filter(
    ([, v]) => "enabled" in v && v.enabled
  );
  if (enabledSources.length === 0) {
    warnings.push("No sources are enabled");
  }

  // Check for at least one enabled backend
  const enabledBackends = Object.entries(config.backends).filter(
    ([, v]) => v.enabled
  );
  if (enabledBackends.length === 0) {
    errors.push("At least one backend must be enabled");
  }

  // Validate batch size
  if (config.processing.batchSize < 1) {
    errors.push("Batch size must be at least 1");
  }
  if (config.processing.batchSize > 10000) {
    warnings.push("Large batch sizes may cause memory issues");
  }

  // Validate concurrency
  if (config.processing.maxConcurrency < 1) {
    errors.push("Max concurrency must be at least 1");
  }

  // Validate thresholds
  if (
    config.transformation.confidenceThreshold < 0 ||
    config.transformation.confidenceThreshold > 1
  ) {
    errors.push("Confidence threshold must be between 0 and 1");
  }

  if (
    config.transformation.deduplicationThreshold < 0 ||
    config.transformation.deduplicationThreshold > 1
  ) {
    errors.push("Deduplication threshold must be between 0 and 1");
  }

  // Check embedding configuration
  if (config.transformation.enableEmbeddings) {
    const cloudModels = ["openai-ada-002", "openai-3-small", "openai-3-large", "cohere-embed-v3", "voyage-2"];
    if (
      cloudModels.includes(config.transformation.embeddingModel) &&
      !config.transformation.embeddingApiKey
    ) {
      errors.push(`Embedding model ${config.transformation.embeddingModel} requires an API key`);
    }
  }

  // Check Neo4j configuration
  if (config.backends.neo4j.enabled) {
    if (!config.backends.neo4j.auth?.password) {
      warnings.push("Neo4j is enabled but no password is configured");
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
