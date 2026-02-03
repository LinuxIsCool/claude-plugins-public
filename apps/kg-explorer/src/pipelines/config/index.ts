/**
 * @fileoverview Configuration module exports
 * @module kg-explorer/pipelines/config
 */

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
} from "./pipeline-config";
