/**
 * GitHub Fetcher for Observatory Plugin
 *
 * Fetches and parses SKILL.md files from external GitHub repositories.
 * Handles rate limiting, caching, and incremental updates.
 */

import { parse as parseYaml } from "yaml";
import type {
  SkillEntry,
  GitHubTreeNode,
  CapabilityCategory,
  CAPABILITY_CATEGORIES,
} from "../catalog/schema.js";

const GITHUB_API_BASE = "https://api.github.com";
const RATE_LIMIT_DELAY_MS = 100; // 100ms between requests (10 req/sec max)
const REQUEST_TIMEOUT_MS = 30000; // 30 second timeout

/**
 * GitHub API response for repository tree
 */
interface TreeResponse {
  sha: string;
  url: string;
  tree: GitHubTreeNode[];
  truncated: boolean;
}

/**
 * GitHub API response for file content
 */
interface ContentResponse {
  name: string;
  path: string;
  sha: string;
  size: number;
  content: string;
  encoding: "base64";
}

/**
 * Fetcher configuration
 */
export interface FetcherConfig {
  /** GitHub personal access token (optional, increases rate limit) */
  token?: string;
  /** Source ID for catalog entries */
  sourceId?: string;
  /** Enable verbose logging */
  verbose?: boolean;
}

/**
 * GitHub repository fetcher for SKILL.md files
 */
export class GitHubFetcher {
  private token: string | undefined;
  private sourceId: string;
  private verbose: boolean;
  private lastRequestTime = 0;
  private requestCount = 0;

  constructor(config: FetcherConfig = {}) {
    this.token = config.token ?? process.env.GITHUB_TOKEN;
    this.sourceId = config.sourceId ?? "jeremylongshore-plugins";
    this.verbose = config.verbose ?? false;
  }

  /**
   * Fetch full repository tree
   */
  async fetchRepoTree(
    owner: string,
    repo: string,
    branch: string = "main"
  ): Promise<GitHubTreeNode[]> {
    const url = `${GITHUB_API_BASE}/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`;
    const response = await this.githubRequest<TreeResponse>(url);

    if (response.truncated) {
      this.log("Warning: Repository tree was truncated (>100k files)");
    }

    return response.tree;
  }

  /**
   * Fetch raw file content from GitHub
   */
  async fetchFileContent(
    owner: string,
    repo: string,
    path: string
  ): Promise<string> {
    const url = `${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`;
    const response = await this.githubRequest<ContentResponse>(url);

    // Decode base64 content
    return Buffer.from(response.content, "base64").toString("utf-8");
  }

  /**
   * Scan plugins directory for all SKILL.md files and parse them
   */
  async scanPluginsDirectory(
    owner: string,
    repo: string
  ): Promise<SkillEntry[]> {
    this.log(`Fetching repository tree for ${owner}/${repo}...`);
    const tree = await this.fetchRepoTree(owner, repo);

    // Find all SKILL.md files matching the pattern:
    // plugins/{plugin}/skills/{skill}/SKILL.md
    const skillFiles = tree.filter(
      (node) =>
        node.type === "blob" &&
        node.path.match(/^plugins\/[^/]+\/skills\/[^/]+\/SKILL\.md$/)
    );

    this.log(`Found ${skillFiles.length} SKILL.md files`);

    // Also find subskills directories to enumerate subskill names
    const subskillDirs = tree.filter(
      (node) =>
        node.type === "tree" &&
        node.path.match(/^plugins\/[^/]+\/skills\/[^/]+\/subskills$/)
    );

    // Build a map of skill path -> subskill names
    const subskillMap = new Map<string, string[]>();
    for (const dir of subskillDirs) {
      // Find all .md files in this subskills directory
      const parentPath = dir.path.replace("/subskills", "");
      const subskillFiles = tree.filter(
        (node) =>
          node.type === "blob" &&
          node.path.startsWith(dir.path + "/") &&
          node.path.endsWith(".md")
      );
      const subskillNames = subskillFiles.map((f) =>
        f.path.split("/").pop()?.replace(".md", "") ?? ""
      );
      subskillMap.set(parentPath, subskillNames);
    }

    // Fetch and parse each SKILL.md
    const skills: SkillEntry[] = [];
    let processed = 0;

    for (const file of skillFiles) {
      try {
        const content = await this.fetchFileContent(owner, repo, file.path);
        const metadata = this.extractSkillMetadata(
          content,
          file.path,
          file.sha,
          subskillMap.get(file.path.replace("/SKILL.md", "")) ?? []
        );
        skills.push(metadata);
        processed++;

        if (processed % 50 === 0) {
          this.log(`Processed ${processed}/${skillFiles.length} skills...`);
        }
      } catch (error) {
        this.log(
          `Warning: Failed to fetch ${file.path}: ${error instanceof Error ? error.message : "Unknown error"}`
        );
      }
    }

    this.log(
      `Successfully indexed ${skills.length} skills (${this.requestCount} API requests)`
    );
    return skills;
  }

  /**
   * Fetch only changed skills since last scan (incremental update)
   */
  async fetchChangedSkills(
    owner: string,
    repo: string,
    existingShas: Map<string, string>
  ): Promise<{ added: SkillEntry[]; updated: SkillEntry[]; removed: string[] }> {
    const tree = await this.fetchRepoTree(owner, repo);

    const skillFiles = tree.filter(
      (node) =>
        node.type === "blob" &&
        node.path.match(/^plugins\/[^/]+\/skills\/[^/]+\/SKILL\.md$/)
    );

    // Build subskill map
    const subskillDirs = tree.filter(
      (node) =>
        node.type === "tree" &&
        node.path.match(/^plugins\/[^/]+\/skills\/[^/]+\/subskills$/)
    );
    const subskillMap = new Map<string, string[]>();
    for (const dir of subskillDirs) {
      const parentPath = dir.path.replace("/subskills", "");
      const subskillFiles = tree.filter(
        (node) =>
          node.type === "blob" &&
          node.path.startsWith(dir.path + "/") &&
          node.path.endsWith(".md")
      );
      subskillMap.set(
        parentPath,
        subskillFiles.map((f) => f.path.split("/").pop()?.replace(".md", "") ?? "")
      );
    }

    const added: SkillEntry[] = [];
    const updated: SkillEntry[] = [];
    const currentPaths = new Set<string>();

    for (const file of skillFiles) {
      currentPaths.add(file.path);
      const existingSha = existingShas.get(file.path);

      if (!existingSha) {
        // New skill
        try {
          const content = await this.fetchFileContent(owner, repo, file.path);
          const metadata = this.extractSkillMetadata(
            content,
            file.path,
            file.sha,
            subskillMap.get(file.path.replace("/SKILL.md", "")) ?? []
          );
          added.push(metadata);
        } catch (error) {
          this.log(`Warning: Failed to fetch new skill ${file.path}`);
        }
      } else if (existingSha !== file.sha) {
        // Updated skill
        try {
          const content = await this.fetchFileContent(owner, repo, file.path);
          const metadata = this.extractSkillMetadata(
            content,
            file.path,
            file.sha,
            subskillMap.get(file.path.replace("/SKILL.md", "")) ?? []
          );
          updated.push(metadata);
        } catch (error) {
          this.log(`Warning: Failed to fetch updated skill ${file.path}`);
        }
      }
      // Unchanged skills are skipped
    }

    // Find removed skills
    const removed: string[] = [];
    for (const existingPath of existingShas.keys()) {
      if (!currentPaths.has(existingPath)) {
        removed.push(existingPath);
      }
    }

    return { added, updated, removed };
  }

  /**
   * Extract skill metadata from SKILL.md content
   */
  private extractSkillMetadata(
    content: string,
    path: string,
    sha: string,
    subskills: string[]
  ): SkillEntry {
    // Parse YAML frontmatter (between --- delimiters)
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!frontmatterMatch) {
      throw new Error(`No frontmatter found in ${path}`);
    }

    const frontmatter = parseYaml(frontmatterMatch[1]) as Record<string, unknown>;

    // Extract plugin and skill name from path
    // e.g., "plugins/awareness/skills/awareness/SKILL.md"
    const pathParts = path.split("/");
    const pluginName = pathParts[1];
    const skillName = pathParts[3];

    // Parse allowed-tools (handles both string and array formats)
    const allowedTools = this.parseAllowedTools(
      frontmatter["allowed-tools"] as string | string[] | undefined
    );

    // Extract description
    const description =
      typeof frontmatter.description === "string"
        ? frontmatter.description.trim()
        : "";

    // Infer capabilities from description and keywords
    const capabilities = this.inferCapabilities(description, allowedTools);

    return {
      id: `${this.sourceId}/${pluginName}/${skillName}`,
      source: this.sourceId,
      pluginName,
      skillName,
      skillPath: path,
      description,
      allowedTools,
      subskills,
      gitSha: sha,
      lastIndexed: new Date().toISOString(),
      capabilities,
    };
  }

  /**
   * Parse allowed-tools field (handles comma-separated string or array)
   */
  private parseAllowedTools(tools: string | string[] | undefined): string[] {
    if (!tools) return [];
    if (Array.isArray(tools)) return tools.map((t) => t.trim());
    return tools.split(",").map((t) => t.trim());
  }

  /**
   * Infer capability categories from description and tools
   */
  private inferCapabilities(
    description: string,
    tools: string[]
  ): CapabilityCategory[] {
    const capabilities = new Set<CapabilityCategory>();
    const lowerDesc = description.toLowerCase();

    // Keyword-based inference
    const keywordMap: Record<string, CapabilityCategory[]> = {
      // Development
      backend: ["backend-development"],
      api: ["api-design", "backend-development"],
      frontend: ["frontend-development"],
      react: ["frontend-development"],
      vue: ["frontend-development"],
      mobile: ["mobile-development"],
      database: ["database-management"],
      sql: ["database-management"],
      cicd: ["devops-cicd"],
      deploy: ["devops-cicd"],
      pipeline: ["devops-cicd"],

      // Languages
      python: ["python"],
      typescript: ["typescript"],
      javascript: ["javascript"],
      rust: ["rust"],
      golang: ["go"],
      java: ["java"],
      ruby: ["ruby"],
      php: ["php"],

      // Quality
      review: ["code-review"],
      test: ["testing"],
      security: ["security-audit"],
      audit: ["security-audit"],
      performance: ["performance-optimization"],
      debug: ["debugging"],

      // AI
      "ai ": ["ai-ml"],
      "ml ": ["ai-ml"],
      machine: ["ai-ml"],
      llm: ["llm-tooling"],
      embed: ["embeddings"],
      rag: ["rag"],
      retrieval: ["rag"],

      // Business
      project: ["project-management"],
      document: ["documentation"],
      schedule: ["scheduling"],
      finance: ["finance"],

      // Infrastructure
      cloud: ["cloud-infrastructure"],
      aws: ["cloud-infrastructure"],
      docker: ["containerization"],
      kubernetes: ["containerization"],
      monitor: ["monitoring"],

      // Specialized
      blockchain: ["blockchain-web3"],
      web3: ["blockchain-web3"],
      game: ["game-development"],
      research: ["research"],
      accessibility: ["accessibility"],

      // Agent Infrastructure
      memory: ["agent-memory"],
      "long-term": ["agent-memory"],
      "long term": ["agent-memory"],
      persistent: ["agent-memory", "context-management"],
      context: ["context-management"],
      "knowledge graph": ["knowledge-graph"],
      "knowledge base": ["knowledge-graph"],
      semantic: ["knowledge-graph", "embeddings"],
      recall: ["agent-memory"],
      session: ["context-management"],
    };

    for (const [keyword, caps] of Object.entries(keywordMap)) {
      if (lowerDesc.includes(keyword)) {
        caps.forEach((c) => capabilities.add(c));
      }
    }

    // Tool-based inference
    if (tools.includes("WebFetch") || tools.includes("WebSearch")) {
      capabilities.add("research");
    }

    return Array.from(capabilities);
  }

  /**
   * Rate-limited GitHub API request with retry logic
   */
  private async githubRequest<T>(url: string, retries = 3): Promise<T> {
    // Rate limiting
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest < RATE_LIMIT_DELAY_MS) {
      await new Promise((resolve) =>
        setTimeout(resolve, RATE_LIMIT_DELAY_MS - timeSinceLastRequest)
      );
    }
    this.lastRequestTime = Date.now();
    this.requestCount++;

    // Build headers
    const headers: Record<string, string> = {
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "claude-code-observatory/1.0",
    };

    if (this.token) {
      headers["Authorization"] = `Bearer ${this.token}`;
    }

    // Make request with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Handle rate limiting
      if (response.status === 403) {
        const rateLimitRemaining = response.headers.get("X-RateLimit-Remaining");
        const rateLimitReset = response.headers.get("X-RateLimit-Reset");

        if (rateLimitRemaining === "0" && rateLimitReset) {
          const resetTime = parseInt(rateLimitReset) * 1000;
          const waitTime = resetTime - Date.now();
          if (waitTime > 0 && waitTime < 3600000) {
            // Max 1 hour wait
            this.log(
              `Rate limit exceeded, waiting ${Math.ceil(waitTime / 1000)}s...`
            );
            await new Promise((resolve) => setTimeout(resolve, waitTime + 1000));
            return this.githubRequest<T>(url, retries);
          }
        }
        throw new Error(
          `GitHub API rate limit exceeded. Add GITHUB_TOKEN to .env for higher limits.`
        );
      }

      if (!response.ok) {
        throw new Error(
          `GitHub API error: ${response.status} ${response.statusText}`
        );
      }

      return (await response.json()) as T;
    } catch (error) {
      clearTimeout(timeoutId);

      if (retries > 0 && error instanceof Error) {
        if (
          error.name === "AbortError" ||
          error.message.includes("network") ||
          error.message.includes("ECONNRESET")
        ) {
          this.log(`Request failed, retrying (${retries} attempts left)...`);
          await new Promise((resolve) => setTimeout(resolve, 1000));
          return this.githubRequest<T>(url, retries - 1);
        }
      }

      throw error;
    }
  }

  /**
   * Log message if verbose mode is enabled
   */
  private log(message: string): void {
    if (this.verbose) {
      console.log(`[GitHubFetcher] ${message}`);
    }
  }

  /**
   * Get current request count
   */
  getRequestCount(): number {
    return this.requestCount;
  }

  /**
   * Reset request counter
   */
  resetRequestCount(): void {
    this.requestCount = 0;
  }
}
