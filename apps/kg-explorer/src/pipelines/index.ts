/**
 * @fileoverview ETL Pipeline module - main exports
 * @module kg-explorer/pipelines
 *
 * Comprehensive ETL pipeline for knowledge graph ingestion:
 *
 * Components:
 * - Extractors: GitHub, NPM, PyPI, ArXiv, Web
 * - Transformers: Entity, Relationship, Embedding, Temporal, Deduplication
 * - Loaders: Neo4j, TypeDB, JSON, Batch
 * - Orchestrator: DAG execution, retry logic, progress tracking
 * - Monitors: Metrics, Data Quality, Freshness
 *
 * Example usage:
 * ```typescript
 * import {
 *   createOrchestrator,
 *   buildPipelineDAG,
 *   createGitHubExtractor,
 *   createEntityTransformer,
 *   createJsonLoader,
 *   getDevelopmentConfig,
 * } from '@/pipelines';
 *
 * // Create extractors
 * const github = createGitHubExtractor({ apiToken: process.env.GITHUB_TOKEN });
 *
 * // Create orchestrator
 * const orchestrator = createOrchestrator();
 *
 * // Register handlers
 * orchestrator.registerHandler('extract-github', async (input, ctx) => {
 *   // extraction logic
 * });
 *
 * // Build DAG
 * const dag = buildPipelineDAG()
 *   .setName('github-ingestion')
 *   .addStage({ name: 'Extract', handler: 'extract-github', ... })
 *   .build();
 *
 * // Execute
 * const result = await orchestrator.execute(dag);
 * ```
 */

// ============================================================================
// Types
// ============================================================================

export * from "./types";

// ============================================================================
// Extractors
// ============================================================================

export {
  // Base
  BaseExtractor,
  BaseExtractorConfig,
  DEFAULT_BASE_CONFIG,
  RateLimiter,
  RequestCache,
  createSourceIdFromUrl,
  normalizeUrl,

  // GitHub
  GitHubExtractor,
  GitHubExtractorConfig,
  GitHubExtractedData,
  GitHubRepository,
  GitHubUser,
  GitHubContributor,
  GitHubDependencies,
  DEFAULT_GITHUB_CONFIG,
  createGitHubExtractor,

  // NPM
  NpmExtractor,
  NpmExtractorConfig,
  NpmExtractedData,
  NpmPackage,
  NpmVersion,
  NpmDownloads,
  DEFAULT_NPM_CONFIG,
  createNpmExtractor,

  // PyPI
  PyPIExtractor,
  PyPIExtractorConfig,
  PyPIExtractedData,
  PyPIPackage,
  PyPIDownloads,
  ParsedDependency,
  DEFAULT_PYPI_CONFIG,
  createPyPIExtractor,

  // ArXiv
  ArXivExtractor,
  ArXivExtractorConfig,
  ArXivExtractedData,
  ArXivEntry,
  ArXivAuthor,
  ArXivCategory,
  DEFAULT_ARXIV_CONFIG,
  createArXivExtractor,

  // Web
  WebExtractor,
  WebExtractorConfig,
  WebExtractedData,
  WebMetadata,
  WebContent,
  WebLink,
  StructuredDataItem,
  DEFAULT_WEB_CONFIG,
  createWebExtractor,
} from "./extractors";

// ============================================================================
// Transformers
// ============================================================================

export {
  // Entity
  EntityTransformer,
  EntityTransformResult,
  RawData,
  createEntityTransformer,

  // Relationship
  RelationshipTransformer,
  RelationshipTransformResult,
  RelationshipRule,
  InferenceContext,
  createRelationshipTransformer,

  // Embedding
  EmbeddingTransformer,
  EmbeddingTransformResult,
  EmbeddingConfig,
  EmbeddingProvider,
  OpenAIEmbeddingProvider,
  LocalEmbeddingProvider,
  DEFAULT_EMBEDDING_CONFIG,
  createEmbeddingTransformer,
  createOpenAIEmbeddingProvider,
  createLocalEmbeddingProvider,

  // Temporal
  TemporalTransformer,
  TemporalConfig,
  TemporalEntity,
  TemporalTransformInput,
  TemporalTransformResult,
  VersionChain,
  VersionInfo,
  TemporalQuery,
  DEFAULT_TEMPORAL_CONFIG,
  createTemporalTransformer,
  filterEntitiesByTime,
  getEntityAsOf,

  // Deduplication
  DeduplicationTransformer,
  DeduplicationConfig,
  DeduplicationInput,
  DeduplicationResult,
  DuplicatePair,
  DEFAULT_DEDUPLICATION_CONFIG,
  createDeduplicationTransformer,
} from "./transformers";

// ============================================================================
// Loaders
// ============================================================================

export {
  // Base
  BaseLoader,
  BaseLoaderConfig,
  DEFAULT_LOADER_CONFIG,
  LoadItem,
  LoadBatch,
  batchItems,
  mergeBatchResults,

  // Neo4j
  Neo4jLoader,
  Neo4jLoaderConfig,
  DEFAULT_NEO4J_CONFIG,
  createNeo4jLoader,

  // TypeDB
  TypeDBLoader,
  TypeDBLoaderConfig,
  DEFAULT_TYPEDB_CONFIG,
  createTypeDBLoader,

  // JSON
  JsonLoader,
  JsonLoaderConfig,
  DEFAULT_JSON_CONFIG,
  createJsonLoader,

  // Batch
  BatchLoader,
  BatchLoaderConfig,
  BatchProgress,
  DEFAULT_BATCH_CONFIG,
  createBatchLoader,
  buildBatchLoader,
  BatchLoaderBuilder,
} from "./loaders";

// ============================================================================
// Orchestrator
// ============================================================================

export {
  PipelineOrchestrator,
  OrchestratorConfig,
  DEFAULT_ORCHESTRATOR_CONFIG,
  StageHandler,
  StageContext,
  createOrchestrator,
  PipelineDAGBuilder,
  buildPipelineDAG,
} from "./orchestrator";

// ============================================================================
// Monitors
// ============================================================================

export {
  // Metrics
  PipelineMetricsCollector,
  MetricsConfig,
  DEFAULT_METRICS_CONFIG,
  createMetricsCollector,

  // Data Quality
  DataQualityMonitor,
  QualityConfig,
  QualityRuleConfig,
  QualityReport,
  QualitySummary,
  QualityViolation,
  EntityQualityReport,
  RelationshipQualityReport,
  MissingFieldReport,
  ValidationRule,
  ValidationContext,
  DEFAULT_QUALITY_CONFIG,
  createDataQualityMonitor,

  // Freshness
  FreshnessMonitor,
  FreshnessConfig,
  FreshnessThreshold,
  FreshnessReport,
  FreshnessSummary,
  StaleDataReport,
  TypeFreshnessStats,
  SourceFreshnessStats,
  RefreshQueueItem,
  RefreshScheduler,
  RefreshSchedulerConfig,
  DEFAULT_FRESHNESS_CONFIG,
  createFreshnessMonitor,
  createRefreshScheduler,
} from "./monitors";

// ============================================================================
// Configuration
// ============================================================================

export {
  // Types
  Environment,
  EnvironmentConfig,
  SourceConfig,
  AllSourcesConfig,
  BackendConfig,
  AllBackendsConfig,
  ProcessingConfig,
  TransformationConfig,
  MonitoringConfig,
  PipelineConfiguration,
  ConfigValidationResult,

  // Defaults
  DEFAULT_ENVIRONMENT_CONFIG,
  DEFAULT_SOURCES_CONFIG,
  DEFAULT_BACKENDS_CONFIG,
  DEFAULT_PROCESSING_CONFIG,
  DEFAULT_TRANSFORMATION_CONFIG,
  DEFAULT_MONITORING_CONFIG,
  DEFAULT_PIPELINE_CONFIG,

  // Builder
  PipelineConfigBuilder,
  createPipelineConfig,

  // Presets
  getDevelopmentConfig,
  getProductionConfig,

  // Validation
  validateConfig,
} from "./config";
