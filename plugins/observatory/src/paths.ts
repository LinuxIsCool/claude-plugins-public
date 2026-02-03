/**
 * Path utilities for Observatory plugin
 *
 * Uses lib/paths.ts pattern to anchor all data to git root,
 * preventing data fragmentation when run from different directories.
 */

import { getClaudePath, getRepoPath } from "../../../lib/paths.js";
import { join } from "node:path";

/**
 * Get path within .claude/observatory/
 */
export function getObservatoryPath(subpath: string = ""): string {
  const base = getClaudePath("observatory");
  return subpath ? join(base, subpath) : base;
}

/**
 * Get path to catalog data
 */
export function getCatalogPath(subpath: string = ""): string {
  return getObservatoryPath(subpath ? `catalog/${subpath}` : "catalog");
}

/**
 * Get path to analysis outputs
 */
export function getAnalysisPath(subpath: string = ""): string {
  return getObservatoryPath(subpath ? `analysis/${subpath}` : "analysis");
}

/**
 * Get path to local plugins directory
 */
export function getLocalPluginsPath(): string {
  return getRepoPath("plugins");
}

/**
 * Get path to curated catalog data (within plugin)
 */
export function getCuratedDataPath(filename: string = ""): string {
  const pluginRoot = getRepoPath("plugins/observatory");
  const dataDir = join(pluginRoot, "data", "curated");
  return filename ? join(dataDir, filename) : dataDir;
}

/**
 * Get path to sources config
 */
export function getSourcesPath(): string {
  return getRepoPath("plugins/observatory/data/sources.yaml");
}

/**
 * Get path to skills SQLite database
 */
export function getSkillsDbPath(): string {
  return getObservatoryPath("catalog/skills.db");
}

/**
 * Get path to GitHub API cache directory
 */
export function getGitHubCachePath(): string {
  return getObservatoryPath("cache/github");
}
