/**
 * Catalog Loader
 *
 * Loads curated YAML catalogs and merges them into a unified catalog structure.
 */

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import type {
  Catalog,
  CatalogEntry,
  PluginComponent,
  PluginSource,
} from "./schema.js";
import { getCuratedDataPath, getSourcesPath } from "../paths.js";

/**
 * Load sources configuration
 */
export function loadSources(): PluginSource[] {
  const sourcesPath = getSourcesPath();
  if (!existsSync(sourcesPath)) {
    console.warn(`Sources file not found: ${sourcesPath}`);
    return [];
  }

  const content = readFileSync(sourcesPath, "utf-8");
  const data = parseYaml(content);

  return (data.sources || []).map((s: Record<string, unknown>) => ({
    id: s.id as string,
    name: s.name as string,
    repoUrl: s.repoUrl as string,
    description: s.description as string,
    pluginsPath: s.pluginsPath as string,
    enabled: s.enabled !== false,
    lastFetched: s.lastFetched as string | undefined,
  }));
}

/**
 * Load a single curated catalog file
 */
export function loadCuratedCatalog(filename: string): CatalogEntry[] {
  const filepath = getCuratedDataPath(filename);
  if (!existsSync(filepath)) {
    console.warn(`Curated catalog not found: ${filepath}`);
    return [];
  }

  const content = readFileSync(filepath, "utf-8");
  const data = parseYaml(content);
  const source = data.source as string;
  const entries: CatalogEntry[] = [];

  // Process agents
  if (data.agents) {
    for (const agent of data.agents as Record<string, unknown>[]) {
      entries.push({
        id: `${source}/agents/${agent.name}`,
        source,
        name: agent.name as string,
        version: "1.0.0",
        description: agent.description as string,
        author: { name: source.split("-")[0] },
        keywords: (agent.capabilities as string[]) || [],
        components: [
          {
            type: "agent",
            name: agent.name as string,
            description: agent.description as string,
          },
        ],
        repoUrl: `https://github.com/${source.replace("-", "/")}/tree/main/agents`,
        pluginPath: `agents/${agent.name}`,
        lastUpdated: data.lastUpdated as string,
        capabilities: (agent.capabilities as string[]) || [],
      });
    }
  }

  // Process commands
  if (data.commands) {
    for (const cmd of data.commands as Record<string, unknown>[]) {
      entries.push({
        id: `${source}/commands/${cmd.name}`,
        source,
        name: cmd.name as string,
        version: "1.0.0",
        description: cmd.description as string,
        author: { name: source.split("-")[0] },
        keywords: (cmd.capabilities as string[]) || [],
        components: [
          {
            type: "command",
            name: cmd.name as string,
            description: cmd.description as string,
          },
        ],
        repoUrl: `https://github.com/${source.replace("-", "/")}/tree/main/commands`,
        pluginPath: `commands/${cmd.name}`,
        lastUpdated: data.lastUpdated as string,
        capabilities: (cmd.capabilities as string[]) || [],
      });
    }
  }

  // Process plugins (jeremylongshore format)
  if (data.plugins) {
    for (const plugin of data.plugins as Record<string, unknown>[]) {
      entries.push({
        id: `${source}/plugins/${plugin.name}`,
        source,
        name: plugin.name as string,
        version: (plugin.version as string) || "1.0.0",
        description: plugin.description as string,
        author: { name: source.split("-")[0] },
        keywords: (plugin.capabilities as string[]) || [],
        components: [
          {
            type: "skill",
            name: plugin.name as string,
            description: plugin.description as string,
          },
        ],
        repoUrl: `https://github.com/${source.replace("-", "/")}/tree/main/plugins`,
        pluginPath: `plugins/${plugin.name}`,
        lastUpdated: data.lastUpdated as string,
        capabilities: (plugin.capabilities as string[]) || [],
      });
    }
  }

  // Process MCP servers
  if (data.mcpServers) {
    for (const mcp of data.mcpServers as Record<string, unknown>[]) {
      entries.push({
        id: `${source}/mcp/${mcp.name}`,
        source,
        name: mcp.name as string,
        version: "1.0.0",
        description: mcp.description as string,
        author: { name: source.split("-")[0] },
        keywords: (mcp.capabilities as string[]) || [],
        components: [
          {
            type: "mcp-server",
            name: mcp.name as string,
            description: mcp.description as string,
          },
        ],
        repoUrl: `https://github.com/${source.replace("-", "/")}/tree/main/mcp`,
        pluginPath: `mcp/${mcp.name}`,
        lastUpdated: data.lastUpdated as string,
        capabilities: (mcp.capabilities as string[]) || [],
      });
    }
  }

  // Process hooks
  if (data.hooks) {
    for (const hook of data.hooks as Record<string, unknown>[]) {
      entries.push({
        id: `${source}/hooks/${hook.name}`,
        source,
        name: hook.name as string,
        version: "1.0.0",
        description: hook.description as string,
        author: { name: source.split("-")[0] },
        keywords: (hook.capabilities as string[]) || [],
        components: [
          {
            type: "hook",
            name: hook.name as string,
            description: hook.description as string,
          },
        ],
        repoUrl: `https://github.com/${source.replace("-", "/")}/tree/main/hooks`,
        pluginPath: `hooks/${hook.name}`,
        lastUpdated: data.lastUpdated as string,
        capabilities: (hook.capabilities as string[]) || [],
      });
    }
  }

  return entries;
}

/**
 * Load all curated catalogs and merge into unified catalog
 */
export function loadFullCatalog(): Catalog {
  const sources = loadSources();
  const curatedDir = getCuratedDataPath();
  const entries: Record<string, CatalogEntry> = {};

  // Load all .yaml files from curated directory
  if (existsSync(curatedDir)) {
    const files = readdirSync(curatedDir).filter((f) => f.endsWith(".yaml"));

    for (const file of files) {
      const catalogEntries = loadCuratedCatalog(file);
      for (const entry of catalogEntries) {
        entries[entry.id] = entry;
      }
    }
  }

  // Calculate stats
  const stats = {
    totalPlugins: Object.keys(entries).length,
    totalSkills: 0,
    totalCommands: 0,
    totalAgents: 0,
    bySource: {} as Record<string, number>,
  };

  for (const entry of Object.values(entries)) {
    const source = entry.source;
    stats.bySource[source] = (stats.bySource[source] || 0) + 1;

    for (const component of entry.components) {
      if (component.type === "skill") stats.totalSkills++;
      if (component.type === "command") stats.totalCommands++;
      if (component.type === "agent") stats.totalAgents++;
    }
  }

  return {
    version: "1.0",
    lastUpdated: new Date().toISOString(),
    sources,
    entries,
    stats,
  };
}

/**
 * Search catalog entries by keyword
 */
export function searchCatalog(
  catalog: Catalog,
  query: string,
  options?: {
    capabilities?: string[];
    source?: string;
    componentType?: string;
  }
): CatalogEntry[] {
  const lowerQuery = query.toLowerCase();

  return Object.values(catalog.entries)
    .filter((entry) => {
      // Text search
      const matchesQuery =
        !query ||
        entry.name.toLowerCase().includes(lowerQuery) ||
        entry.description.toLowerCase().includes(lowerQuery) ||
        entry.keywords.some((k) => k.toLowerCase().includes(lowerQuery));

      // Filter by capabilities
      const matchesCapabilities =
        !options?.capabilities ||
        options.capabilities.some((cap) => entry.capabilities.includes(cap));

      // Filter by source
      const matchesSource =
        !options?.source || entry.source === options.source;

      // Filter by component type
      const matchesType =
        !options?.componentType ||
        entry.components.some((c) => c.type === options.componentType);

      return matchesQuery && matchesCapabilities && matchesSource && matchesType;
    })
    .sort((a, b) => {
      // Score by relevance
      const scoreA = calculateRelevanceScore(a, lowerQuery);
      const scoreB = calculateRelevanceScore(b, lowerQuery);
      return scoreB - scoreA;
    });
}

function calculateRelevanceScore(entry: CatalogEntry, query: string): number {
  let score = 0;

  // Exact name match
  if (entry.name.toLowerCase() === query) score += 10;
  // Name contains query
  else if (entry.name.toLowerCase().includes(query)) score += 5;

  // Description contains query
  if (entry.description.toLowerCase().includes(query)) score += 3;

  // Keyword match
  for (const keyword of entry.keywords) {
    if (keyword.toLowerCase().includes(query)) score += 2;
  }

  return score;
}
