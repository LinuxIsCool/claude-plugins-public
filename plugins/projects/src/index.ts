/**
 * Projects Plugin - Public API
 *
 * This module exports the core functionality for programmatic use.
 */

// Types
export * from "./types";

// Store
export { store, createMarkdownStore } from "./store";

// Priority
export {
  calculatePriority,
  createDefaultContext,
  sortByPriority,
  getUrgentProjects,
} from "./priority/calculator";

// Config
export {
  paths,
  ensureDirectories,
  isInitialized,
  loadConfig,
  saveConfig,
  updatePriorityWeights,
} from "./config";
