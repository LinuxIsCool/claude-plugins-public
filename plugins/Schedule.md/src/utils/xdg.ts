/**
 * XDG Base Directory Specification utilities
 *
 * Provides standardized paths for cache, data, config, and state
 * following the XDG specification for Unix-like systems.
 *
 * https://specifications.freedesktop.org/basedir-spec/basedir-spec-latest.html
 */

import { existsSync, mkdirSync } from "fs";
import { join } from "path";
import { homedir } from "os";

const APP_NAME = "schedule-md";

/**
 * Get XDG base directories with fallbacks
 */
export function getXdgPaths() {
  const home = homedir();

  return {
    // User-specific cached data (can be deleted without data loss)
    cache: process.env.XDG_CACHE_HOME || join(home, ".cache"),

    // User-specific data files (persistent)
    data: process.env.XDG_DATA_HOME || join(home, ".local", "share"),

    // User-specific configuration files
    config: process.env.XDG_CONFIG_HOME || join(home, ".config"),

    // User-specific state data (logs, history, recently used)
    state: process.env.XDG_STATE_HOME || join(home, ".local", "state"),

    // User-specific runtime files (sockets, named pipes)
    runtime: process.env.XDG_RUNTIME_DIR || join("/tmp", `runtime-${process.getuid?.() || 1000}`),
  };
}

/**
 * Get application-specific directories
 */
export function getAppPaths() {
  const xdg = getXdgPaths();

  return {
    cache: join(xdg.cache, APP_NAME),
    data: join(xdg.data, APP_NAME),
    config: join(xdg.config, APP_NAME),
    state: join(xdg.state, APP_NAME),
  };
}

/**
 * Get paths for a specific subsystem (e.g., "yoga", "calendar")
 */
export function getSubsystemPaths(subsystem: string) {
  const app = getAppPaths();

  return {
    cache: join(app.cache, subsystem),
    data: join(app.data, subsystem),
    config: join(app.config, subsystem),
    state: join(app.state, subsystem),
  };
}

/**
 * Ensure a directory exists, creating it if necessary
 */
export function ensureDir(dir: string): string {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return dir;
}

/**
 * Get and ensure cache directory for a subsystem
 */
export function getCacheDir(subsystem?: string): string {
  const paths = subsystem ? getSubsystemPaths(subsystem) : getAppPaths();
  return ensureDir(paths.cache);
}

/**
 * Get and ensure data directory for a subsystem
 */
export function getDataDir(subsystem?: string): string {
  const paths = subsystem ? getSubsystemPaths(subsystem) : getAppPaths();
  return ensureDir(paths.data);
}

/**
 * Get and ensure config directory for a subsystem
 */
export function getConfigDir(subsystem?: string): string {
  const paths = subsystem ? getSubsystemPaths(subsystem) : getAppPaths();
  return ensureDir(paths.config);
}

/**
 * Get and ensure state directory for a subsystem
 */
export function getStateDir(subsystem?: string): string {
  const paths = subsystem ? getSubsystemPaths(subsystem) : getAppPaths();
  return ensureDir(paths.state);
}

// Example usage for yoga-scheduler:
// const yogaCache = getCacheDir("yoga");
// → ~/.cache/schedule-md/yoga/
//
// Files to store:
// - ${yogaCache}/ember-schedule.png     (fetched screenshots)
// - ${yogaCache}/ember-schedule.txt     (extracted text)
// - ${yogaCache}/fetch-metadata.json    (timestamps)
