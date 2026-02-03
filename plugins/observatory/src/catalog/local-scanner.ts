/**
 * Local Plugin Scanner
 *
 * Scans the local plugins/ directory to inventory installed plugins
 * and their capabilities for gap analysis.
 */

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { LocalPluginEntry, PluginComponent } from "./schema.js";
import { getLocalPluginsPath } from "../paths.js";

/**
 * Scan a single plugin directory
 */
export function scanPlugin(pluginPath: string): LocalPluginEntry | null {
  const pluginJsonPath = join(pluginPath, ".claude-plugin", "plugin.json");

  if (!existsSync(pluginJsonPath)) {
    return null;
  }

  try {
    const pluginJson = JSON.parse(readFileSync(pluginJsonPath, "utf-8"));
    const components: PluginComponent[] = [];
    const capabilities: string[] = [];

    // Scan for skills
    const skillsDir = join(pluginPath, "skills");
    if (existsSync(skillsDir)) {
      const skillDirs = readdirSync(skillsDir, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name);

      for (const skillName of skillDirs) {
        const skillMdPath = join(skillsDir, skillName, "SKILL.md");
        if (existsSync(skillMdPath)) {
          const content = readFileSync(skillMdPath, "utf-8");
          const description = extractDescription(content);
          components.push({
            type: "skill",
            name: skillName,
            description,
            subcomponents: scanSubskills(join(skillsDir, skillName)),
          });
        }
      }
    }

    // Scan for commands
    const commandsDir = join(pluginPath, "commands");
    if (existsSync(commandsDir)) {
      const commandFiles = readdirSync(commandsDir).filter((f) =>
        f.endsWith(".md")
      );

      for (const cmdFile of commandFiles) {
        const content = readFileSync(join(commandsDir, cmdFile), "utf-8");
        const name = cmdFile.replace(".md", "");
        const description = extractDescription(content);
        components.push({
          type: "command",
          name,
          description,
        });
      }
    }

    // Scan for agents
    const agentsDir = join(pluginPath, "agents");
    if (existsSync(agentsDir)) {
      const agentFiles = readdirSync(agentsDir).filter((f) =>
        f.endsWith(".md")
      );

      for (const agentFile of agentFiles) {
        const content = readFileSync(join(agentsDir, agentFile), "utf-8");
        const name = agentFile.replace(".md", "");
        const description = extractDescription(content);
        components.push({
          type: "agent",
          name,
          description,
        });
      }
    }

    // Check for MCP server
    const mcpJsonPath = join(pluginPath, ".mcp.json");
    if (existsSync(mcpJsonPath)) {
      components.push({
        type: "mcp-server",
        name: pluginJson.name,
        description: "MCP server integration",
      });
    }

    // Scan for hooks
    if (pluginJson.hooks) {
      for (const [eventType, hookConfigs] of Object.entries(pluginJson.hooks)) {
        if (Array.isArray(hookConfigs)) {
          components.push({
            type: "hook",
            name: `${eventType}-hook`,
            description: `Hook for ${eventType} events`,
          });
        }
      }
    }

    // Infer capabilities from keywords and description
    const inferredCapabilities = inferCapabilities(
      pluginJson.keywords || [],
      pluginJson.description || "",
      components
    );
    capabilities.push(...inferredCapabilities);

    return {
      name: pluginJson.name,
      version: pluginJson.version || "0.0.0",
      description: pluginJson.description || "",
      path: pluginPath,
      components,
      capabilities,
    };
  } catch (err) {
    console.error(`Failed to scan plugin at ${pluginPath}:`, err);
    return null;
  }
}

/**
 * Scan all local plugins
 */
export function scanAllLocalPlugins(): LocalPluginEntry[] {
  const pluginsDir = getLocalPluginsPath();
  const plugins: LocalPluginEntry[] = [];

  if (!existsSync(pluginsDir)) {
    console.warn(`Plugins directory not found: ${pluginsDir}`);
    return plugins;
  }

  const entries = readdirSync(pluginsDir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const pluginPath = join(pluginsDir, entry.name);
    const plugin = scanPlugin(pluginPath);

    if (plugin) {
      plugins.push(plugin);
    }
  }

  return plugins;
}

/**
 * Extract description from markdown frontmatter or first paragraph
 */
function extractDescription(content: string): string {
  // Try to extract from frontmatter
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (frontmatterMatch) {
    const frontmatter = frontmatterMatch[1];
    const descMatch = frontmatter.match(/description:\s*(.+)/);
    if (descMatch) {
      return descMatch[1].trim().replace(/^["']|["']$/g, "");
    }
  }

  // Fall back to first non-empty line after frontmatter
  const lines = content.split("\n");
  let inFrontmatter = false;

  for (const line of lines) {
    if (line === "---") {
      inFrontmatter = !inFrontmatter;
      continue;
    }
    if (inFrontmatter) continue;

    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      return trimmed.slice(0, 200);
    }
  }

  return "";
}

/**
 * Scan subskills directory
 */
function scanSubskills(skillDir: string): string[] {
  const subskillsDir = join(skillDir, "subskills");
  if (!existsSync(subskillsDir)) return [];

  return readdirSync(subskillsDir)
    .filter((f) => f.endsWith(".md"))
    .map((f) => f.replace(".md", ""));
}

/**
 * Infer capabilities from keywords and description
 */
function inferCapabilities(
  keywords: string[],
  description: string,
  components: PluginComponent[]
): string[] {
  const capabilities: Set<string> = new Set();
  const text = [...keywords, description].join(" ").toLowerCase();

  // Capability inference rules
  const rules: [string[], string][] = [
    // Development
    [["backend", "api", "rest", "server"], "backend-development"],
    [["frontend", "react", "vue", "ui", "css"], "frontend-development"],
    [["mobile", "ios", "android", "react native"], "mobile-development"],
    [["database", "sql", "postgres", "mysql", "mongodb"], "database-management"],
    [["devops", "ci/cd", "deploy", "pipeline", "github actions"], "devops-cicd"],

    // Languages
    [["python", "django", "flask", "fastapi"], "python"],
    [["typescript", "javascript", "node", "npm"], "typescript"],
    [["rust", "cargo"], "rust"],
    [["go", "golang"], "go"],
    [["java", "spring", "maven"], "java"],

    // Quality
    [["test", "testing", "jest", "pytest", "unit test"], "testing"],
    [["security", "vulnerability", "audit", "owasp"], "security-audit"],
    [["review", "lint", "quality"], "code-review"],
    [["debug", "trace", "error"], "debugging"],
    [["performance", "optimize", "profile", "benchmark"], "performance-optimization"],

    // AI/Data
    [["ai", "ml", "machine learning", "neural"], "ai-ml"],
    [["llm", "gpt", "claude", "gemini", "prompt"], "llm-tooling"],
    [["embedding", "vector", "semantic"], "embeddings"],
    [["rag", "retrieval", "knowledge"], "rag"],
    [["data", "etl", "pipeline", "warehouse"], "data-engineering"],

    // Business
    [["project", "task", "kanban", "agile"], "project-management"],
    [["document", "doc", "markdown", "readme"], "documentation"],
    [["schedule", "calendar", "time"], "scheduling"],
    [["finance", "payment", "invoice", "billing"], "finance"],

    // Infrastructure
    [["cloud", "aws", "azure", "gcp", "terraform"], "cloud-infrastructure"],
    [["docker", "kubernetes", "container"], "containerization"],
    [["monitor", "metric", "alert", "log"], "monitoring"],

    // Specialized
    [["blockchain", "web3", "crypto", "solidity"], "blockchain-web3"],
    [["game", "unity", "unreal"], "game-development"],
    [["research", "paper", "arxiv", "scholar"], "research"],
    [["accessibility", "a11y", "wcag", "aria"], "accessibility"],
  ];

  for (const [patterns, capability] of rules) {
    if (patterns.some((p) => text.includes(p))) {
      capabilities.add(capability);
    }
  }

  // Also infer from component types
  for (const component of components) {
    if (component.type === "mcp-server") {
      capabilities.add("backend-development");
    }
  }

  return Array.from(capabilities);
}

/**
 * Get local capability summary
 */
export function getLocalCapabilitySummary(): {
  plugins: string[];
  capabilities: Record<string, string[]>;
  componentCounts: Record<string, number>;
} {
  const plugins = scanAllLocalPlugins();
  const capabilityMap: Record<string, string[]> = {};
  const componentCounts = {
    skills: 0,
    commands: 0,
    agents: 0,
    hooks: 0,
    "mcp-servers": 0,
  };

  for (const plugin of plugins) {
    for (const capability of plugin.capabilities) {
      if (!capabilityMap[capability]) {
        capabilityMap[capability] = [];
      }
      capabilityMap[capability].push(plugin.name);
    }

    for (const component of plugin.components) {
      const key =
        component.type === "mcp-server"
          ? "mcp-servers"
          : `${component.type}s`;
      if (key in componentCounts) {
        componentCounts[key as keyof typeof componentCounts]++;
      }
    }
  }

  return {
    plugins: plugins.map((p) => p.name),
    capabilities: capabilityMap,
    componentCounts,
  };
}
