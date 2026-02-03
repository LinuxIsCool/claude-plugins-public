/**
 * Project Manager Plugin - Configuration
 *
 * Provides consistent path resolution anchored to the git repository root.
 * See lib/paths.ts for the underlying implementation.
 */

import { join } from "path";
import { existsSync, mkdirSync } from "fs";
import { getClaudePath } from "./lib/paths";
import type { ProjectsConfig, PriorityWeights } from "./types";
import { DEFAULT_PRIORITY_WEIGHTS } from "./types";

// =============================================================================
// Path Configuration
// =============================================================================

/**
 * Base directory for all project data
 */
export function getProjectsBasePath(): string {
  return getClaudePath("projects");
}

/**
 * Directory for active projects
 */
export function getActiveProjectsPath(): string {
  return join(getProjectsBasePath(), "active");
}

/**
 * Directory for opportunities (potential work)
 */
export function getOpportunitiesPath(): string {
  return join(getProjectsBasePath(), "opportunities");
}

/**
 * Directory for completed/archived projects
 */
export function getCompletedPath(): string {
  return join(getProjectsBasePath(), "completed");
}

/**
 * Directory for project templates
 */
export function getTemplatesPath(): string {
  return join(getProjectsBasePath(), "templates");
}

/**
 * Path to the config file
 */
export function getConfigPath(): string {
  return join(getProjectsBasePath(), "config.yml");
}

/**
 * Get directory path for a project based on its type and stage
 */
export function getProjectDirectory(
  type: "assignment" | "opportunity",
  stage: string
): string {
  if (stage === "closed") {
    return getCompletedPath();
  }
  return type === "opportunity" ? getOpportunitiesPath() : getActiveProjectsPath();
}

/**
 * All paths as an object for easy access
 */
export const paths = {
  get base() {
    return getProjectsBasePath();
  },
  get active() {
    return getActiveProjectsPath();
  },
  get opportunities() {
    return getOpportunitiesPath();
  },
  get completed() {
    return getCompletedPath();
  },
  get templates() {
    return getTemplatesPath();
  },
  get config() {
    return getConfigPath();
  },
};

// =============================================================================
// Directory Initialization
// =============================================================================

/**
 * Ensure all required directories exist
 */
export function ensureDirectories(): void {
  const dirs = [
    getProjectsBasePath(),
    getActiveProjectsPath(),
    getOpportunitiesPath(),
    getCompletedPath(),
    getTemplatesPath(),
  ];

  for (const dir of dirs) {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }
}

/**
 * Check if the projects directory has been initialized
 */
export function isInitialized(): boolean {
  return existsSync(getProjectsBasePath()) && existsSync(getActiveProjectsPath());
}

// =============================================================================
// Configuration Management
// =============================================================================

import { readFileSync, writeFileSync } from "fs";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";

/**
 * Default configuration
 */
export const defaultConfig: ProjectsConfig = {
  priority_weights: DEFAULT_PRIORITY_WEIGHTS,
  default_currency: "USD",
  archive_after_days: 90,
  auto_archive_closed: true,
};

/**
 * Load configuration from file or return defaults
 */
export function loadConfig(): ProjectsConfig {
  const configPath = getConfigPath();

  if (!existsSync(configPath)) {
    return defaultConfig;
  }

  try {
    const content = readFileSync(configPath, "utf-8");
    const parsed = parseYaml(content) as Partial<ProjectsConfig>;

    return {
      ...defaultConfig,
      ...parsed,
      priority_weights: {
        ...defaultConfig.priority_weights,
        ...(parsed.priority_weights || {}),
      },
    };
  } catch {
    console.error("Failed to load projects config, using defaults");
    return defaultConfig;
  }
}

/**
 * Save configuration to file
 */
export function saveConfig(config: ProjectsConfig): void {
  ensureDirectories();
  const configPath = getConfigPath();
  const content = stringifyYaml(config);
  writeFileSync(configPath, content, "utf-8");
}

/**
 * Update priority weights
 */
export function updatePriorityWeights(weights: Partial<PriorityWeights>): void {
  const config = loadConfig();
  config.priority_weights = {
    ...config.priority_weights,
    ...weights,
  };
  saveConfig(config);
}
