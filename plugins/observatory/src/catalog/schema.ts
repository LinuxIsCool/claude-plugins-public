/**
 * TypeScript schemas for Plugin Observatory catalog
 *
 * These interfaces define the structure of catalog entries,
 * both for external plugins and local capability inventory.
 */

/**
 * Component types in a plugin
 */
export type ComponentType = "skill" | "command" | "agent" | "hook" | "mcp-server";

/**
 * Source marketplace/repository
 */
export interface PluginSource {
  id: string;
  name: string;
  repoUrl: string;
  description: string;
  pluginsPath: string;
  enabled: boolean;
  lastFetched?: string;
}

/**
 * Author information
 */
export interface Author {
  name: string;
  github?: string;
  url?: string;
}

/**
 * Individual component within a plugin
 */
export interface PluginComponent {
  type: ComponentType;
  name: string;
  description: string;
  /** For skills: subskill names */
  subcomponents?: string[];
}

/**
 * Catalog entry for an external plugin
 */
export interface CatalogEntry {
  /** Unique identifier: {source}/{plugin-name} */
  id: string;
  /** Source marketplace ID */
  source: string;
  /** Plugin name */
  name: string;
  /** Semantic version */
  version: string;
  /** Human-readable description */
  description: string;
  /** Author information */
  author: Author;
  /** Searchable keywords/tags */
  keywords: string[];
  /** Components provided by this plugin */
  components: PluginComponent[];
  /** Repository URL */
  repoUrl: string;
  /** Path within repository */
  pluginPath: string;
  /** When this entry was last updated */
  lastUpdated: string;
  /** Capability categories this plugin addresses */
  capabilities: string[];
}

/**
 * Local plugin entry (scanned from plugins/)
 */
export interface LocalPluginEntry {
  /** Plugin name (directory name) */
  name: string;
  /** Version from plugin.json */
  version: string;
  /** Description from plugin.json */
  description: string;
  /** Filesystem path */
  path: string;
  /** Components discovered */
  components: PluginComponent[];
  /** Inferred capabilities */
  capabilities: string[];
}

/**
 * Gap analysis result
 */
export interface CapabilityGap {
  /** Capability category */
  capability: string;
  /** Whether local plugins provide this */
  localCoverage: boolean;
  /** Local plugins that partially cover this */
  localPlugins: string[];
  /** External plugins that provide this */
  externalPlugins: CatalogEntry[];
  /** Priority score (0-100) based on coverage gap */
  priorityScore: number;
}

/**
 * Complete catalog structure
 */
export interface Catalog {
  /** Catalog version */
  version: string;
  /** When catalog was last updated */
  lastUpdated: string;
  /** Configured sources */
  sources: PluginSource[];
  /** All catalog entries by ID */
  entries: Record<string, CatalogEntry>;
  /** Statistics */
  stats: {
    totalPlugins: number;
    totalSkills: number;
    totalCommands: number;
    totalAgents: number;
    bySource: Record<string, number>;
  };
}

/**
 * Gap analysis report
 */
export interface GapReport {
  /** When analysis was run */
  generatedAt: string;
  /** Number of local plugins scanned */
  localPluginCount: number;
  /** Number of external plugins in catalog */
  externalPluginCount: number;
  /** Identified gaps sorted by priority */
  gaps: CapabilityGap[];
  /** Capabilities fully covered locally */
  coveredCapabilities: string[];
  /** Top recommendations */
  recommendations: {
    capability: string;
    topPlugin: CatalogEntry;
    reason: string;
  }[];
}

/**
 * Capability categories for classification
 */
export const CAPABILITY_CATEGORIES = [
  // Development & Architecture
  "backend-development",
  "frontend-development",
  "mobile-development",
  "api-design",
  "database-management",
  "devops-cicd",

  // Languages
  "python",
  "typescript",
  "javascript",
  "rust",
  "go",
  "java",
  "ruby",
  "php",
  "c-cpp",

  // Quality & Security
  "code-review",
  "testing",
  "security-audit",
  "performance-optimization",
  "debugging",

  // AI & Data
  "ai-ml",
  "data-engineering",
  "llm-tooling",
  "embeddings",
  "rag",

  // Business & Productivity
  "project-management",
  "documentation",
  "communication",
  "scheduling",
  "finance",

  // Infrastructure
  "cloud-infrastructure",
  "containerization",
  "monitoring",
  "networking",

  // Specialized
  "blockchain-web3",
  "game-development",
  "research",
  "accessibility",

  // Agent Infrastructure
  "agent-memory",
  "context-management",
  "knowledge-graph",
] as const;

export type CapabilityCategory = (typeof CAPABILITY_CATEGORIES)[number];

// ============================================================================
// Individual Skill Catalog Types (for 739-skill indexing)
// ============================================================================

/**
 * Individual skill entry from SKILL.md parsing
 */
export interface SkillEntry {
  /** Unique ID: {source}/{plugin}/{skill} */
  id: string;
  /** Source repository ID */
  source: string;
  /** Parent plugin directory name */
  pluginName: string;
  /** Skill name from frontmatter */
  skillName: string;
  /** Path to SKILL.md in repository */
  skillPath: string;
  /** Description from frontmatter */
  description: string;
  /** Allowed tools from frontmatter */
  allowedTools: string[];
  /** Subskill names from subskills/ directory */
  subskills: string[];
  /** Git SHA for change detection */
  gitSha: string;
  /** ISO timestamp of last indexing */
  lastIndexed: string;
  /** Inferred capability tags */
  capabilities: CapabilityCategory[];
}

/**
 * Database record extends SkillEntry with rowid
 */
export interface SkillRecord extends SkillEntry {
  rowid: number;
}

/**
 * Search options for skill queries
 */
export interface SkillSearchOptions {
  /** Filter by plugin name */
  plugin?: string;
  /** Filter by allowed tools */
  tools?: string[];
  /** Filter by capabilities */
  capabilities?: CapabilityCategory[];
  /** Maximum results */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
}

/**
 * Skill catalog statistics
 */
export interface SkillCatalogStats {
  totalSkills: number;
  totalPlugins: number;
  lastFullScan: string | null;
  lastIncrementalScan: string | null;
  byPlugin: Record<string, number>;
  byTool: Record<string, number>;
}

/**
 * GitHub API tree node
 */
export interface GitHubTreeNode {
  path: string;
  mode: string;
  type: "blob" | "tree";
  sha: string;
  size?: number;
  url: string;
}
