#!/usr/bin/env bun
/**
 * Skills Catalog CLI
 *
 * Command-line interface for indexing, searching, and exploring
 * skills from external GitHub repositories.
 *
 * Usage:
 *   bun run skills index [--full|--incremental]
 *   bun run skills search <query>
 *   bun run skills plugin <name>
 *   bun run skills show <skill-id>
 *   bun run skills stats
 *   bun run skills plugins
 */

import { SkillsDatabase } from "../catalog/skills-db.js";
import { GitHubFetcher } from "../fetchers/github-fetcher.js";
import type { SkillRecord } from "../catalog/schema.js";

// Default source repository
const DEFAULT_OWNER = "jeremylongshore";
const DEFAULT_REPO = "claude-code-plugins-plus-skills";

/**
 * Format skill record for display
 */
function formatSkill(skill: SkillRecord, verbose: boolean = false): string {
  const lines: string[] = [];

  lines.push(`\x1b[1m${skill.pluginName}/${skill.skillName}\x1b[0m`);
  lines.push(`  ID: ${skill.id}`);

  if (skill.description) {
    const desc =
      skill.description.length > 100
        ? skill.description.slice(0, 100) + "..."
        : skill.description;
    lines.push(`  Description: ${desc}`);
  }

  if (verbose) {
    if (skill.allowedTools.length > 0) {
      lines.push(`  Tools: ${skill.allowedTools.join(", ")}`);
    }
    if (skill.subskills.length > 0) {
      lines.push(`  Subskills: ${skill.subskills.join(", ")}`);
    }
    if (skill.capabilities.length > 0) {
      lines.push(`  Capabilities: ${skill.capabilities.join(", ")}`);
    }
    lines.push(`  Path: ${skill.skillPath}`);
    lines.push(`  Last indexed: ${skill.lastIndexed}`);
  }

  return lines.join("\n");
}

/**
 * Index command - fetch and index skills from GitHub
 */
async function indexCommand(args: string[]): Promise<void> {
  const isIncremental = args.includes("--incremental");
  const isVerbose = args.includes("--verbose") || args.includes("-v");

  const db = new SkillsDatabase();
  const fetcher = new GitHubFetcher({ verbose: isVerbose });

  console.log(
    `\x1b[36mIndexing skills from ${DEFAULT_OWNER}/${DEFAULT_REPO}...\x1b[0m\n`
  );

  try {
    if (isIncremental) {
      // Incremental update - only fetch changed skills
      const existingShas = db.getAllPathsAndShas();
      console.log(`Found ${existingShas.size} existing skills in database`);

      const changes = await fetcher.fetchChangedSkills(
        DEFAULT_OWNER,
        DEFAULT_REPO,
        existingShas
      );

      console.log(`\nChanges detected:`);
      console.log(`  Added: ${changes.added.length}`);
      console.log(`  Updated: ${changes.updated.length}`);
      console.log(`  Removed: ${changes.removed.length}`);

      // Apply changes
      if (changes.added.length > 0) {
        db.bulkInsert(changes.added);
      }
      if (changes.updated.length > 0) {
        db.bulkInsert(changes.updated);
      }
      for (const path of changes.removed) {
        db.deleteByPath(path);
      }

      db.markIndexed("last_incremental_scan");
    } else {
      // Full scan - fetch all skills
      const skills = await fetcher.scanPluginsDirectory(
        DEFAULT_OWNER,
        DEFAULT_REPO
      );

      console.log(`\nInserting ${skills.length} skills into database...`);

      // Clear existing data for this source and insert new
      db.deleteBySource("jeremylongshore-plugins");
      db.bulkInsert(skills);

      db.markIndexed("last_full_scan");
    }

    // Optimize database after bulk operations
    db.optimize();

    const stats = db.getStats();
    console.log(`\n\x1b[32mIndexing complete!\x1b[0m`);
    console.log(`Total skills: ${stats.totalSkills}`);
    console.log(`Total plugins: ${stats.totalPlugins}`);
    console.log(`API requests: ${fetcher.getRequestCount()}`);
  } catch (error) {
    console.error(
      `\x1b[31mError:\x1b[0m ${error instanceof Error ? error.message : "Unknown error"}`
    );
    process.exit(1);
  } finally {
    db.close();
  }
}

/**
 * Search command - search skills by query
 */
function searchCommand(args: string[]): void {
  const query = args.filter((a) => !a.startsWith("-")).join(" ");
  const isVerbose = args.includes("--verbose") || args.includes("-v");
  const limit = parseInt(
    args.find((a) => a.startsWith("--limit="))?.split("=")[1] ?? "20"
  );

  if (!query) {
    console.error("Usage: skills search <query>");
    process.exit(1);
  }

  const db = new SkillsDatabase();

  try {
    const results = db.search(query, { limit });

    if (results.length === 0) {
      console.log(`No skills found matching "${query}"`);
      return;
    }

    console.log(
      `\x1b[36mFound ${results.length} skills matching "${query}":\x1b[0m\n`
    );

    for (const skill of results) {
      console.log(formatSkill(skill, isVerbose));
      console.log("");
    }
  } finally {
    db.close();
  }
}

/**
 * Plugin command - list skills in a plugin
 */
function pluginCommand(args: string[]): void {
  const pluginName = args.find((a) => !a.startsWith("-"));
  const isVerbose = args.includes("--verbose") || args.includes("-v");

  if (!pluginName) {
    console.error("Usage: skills plugin <name>");
    process.exit(1);
  }

  const db = new SkillsDatabase();

  try {
    const skills = db.getByPlugin(pluginName);

    if (skills.length === 0) {
      console.log(`No skills found in plugin "${pluginName}"`);
      console.log("\nAvailable plugins:");
      const plugins = db.getPluginNames();
      for (const p of plugins.slice(0, 20)) {
        console.log(`  ${p}`);
      }
      if (plugins.length > 20) {
        console.log(`  ... and ${plugins.length - 20} more`);
      }
      return;
    }

    console.log(
      `\x1b[36mSkills in plugin "${pluginName}" (${skills.length}):\x1b[0m\n`
    );

    for (const skill of skills) {
      console.log(formatSkill(skill, isVerbose));
      console.log("");
    }
  } finally {
    db.close();
  }
}

/**
 * Show command - show skill details
 */
function showCommand(args: string[]): void {
  const skillId = args.find((a) => !a.startsWith("-"));

  if (!skillId) {
    console.error("Usage: skills show <skill-id>");
    process.exit(1);
  }

  const db = new SkillsDatabase();

  try {
    // Try by ID first, then by path
    let skill = db.getById(skillId);
    if (!skill) {
      skill = db.getByPath(skillId);
    }

    if (!skill) {
      console.log(`Skill not found: ${skillId}`);
      return;
    }

    console.log(`\x1b[1m${skill.pluginName}/${skill.skillName}\x1b[0m`);
    console.log(`${"─".repeat(60)}`);
    console.log(`ID:           ${skill.id}`);
    console.log(`Source:       ${skill.source}`);
    console.log(`Plugin:       ${skill.pluginName}`);
    console.log(`Skill:        ${skill.skillName}`);
    console.log(`Path:         ${skill.skillPath}`);
    console.log(`${"─".repeat(60)}`);

    if (skill.description) {
      console.log(`\nDescription:\n  ${skill.description}`);
    }

    if (skill.allowedTools.length > 0) {
      console.log(`\nAllowed Tools:\n  ${skill.allowedTools.join(", ")}`);
    }

    if (skill.subskills.length > 0) {
      console.log(`\nSubskills:\n  ${skill.subskills.join(", ")}`);
    }

    if (skill.capabilities.length > 0) {
      console.log(`\nCapabilities:\n  ${skill.capabilities.join(", ")}`);
    }

    console.log(`\nMetadata:`);
    console.log(`  Git SHA:      ${skill.gitSha}`);
    console.log(`  Last indexed: ${skill.lastIndexed}`);
  } finally {
    db.close();
  }
}

/**
 * Stats command - show catalog statistics
 */
function statsCommand(): void {
  const db = new SkillsDatabase();

  try {
    const stats = db.getStats();

    console.log(`\x1b[36mSkills Catalog Statistics\x1b[0m`);
    console.log(`${"─".repeat(40)}`);
    console.log(`Total Skills:    ${stats.totalSkills}`);
    console.log(`Total Plugins:   ${stats.totalPlugins}`);
    console.log(`Last Full Scan:  ${stats.lastFullScan ?? "Never"}`);
    console.log(`Last Incremental: ${stats.lastIncrementalScan ?? "Never"}`);

    if (Object.keys(stats.byPlugin).length > 0) {
      console.log(`\n\x1b[36mSkills by Plugin (top 15):\x1b[0m`);
      const sorted = Object.entries(stats.byPlugin)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 15);

      for (const [plugin, count] of sorted) {
        console.log(`  ${plugin.padEnd(30)} ${count}`);
      }

      if (Object.keys(stats.byPlugin).length > 15) {
        console.log(
          `  ... and ${Object.keys(stats.byPlugin).length - 15} more plugins`
        );
      }
    }

    if (Object.keys(stats.byTool).length > 0) {
      console.log(`\n\x1b[36mMost Used Tools (top 10):\x1b[0m`);
      const sorted = Object.entries(stats.byTool)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

      for (const [tool, count] of sorted) {
        console.log(`  ${tool.padEnd(20)} ${count}`);
      }
    }
  } finally {
    db.close();
  }
}

/**
 * Plugins command - list all indexed plugins
 */
function pluginsCommand(): void {
  const db = new SkillsDatabase();

  try {
    const plugins = db.getPluginNames();
    const stats = db.getStats();

    console.log(`\x1b[36mIndexed Plugins (${plugins.length}):\x1b[0m\n`);

    for (const plugin of plugins) {
      const count = stats.byPlugin[plugin] ?? 0;
      console.log(`  ${plugin.padEnd(35)} ${count} skill${count !== 1 ? "s" : ""}`);
    }
  } finally {
    db.close();
  }
}

/**
 * Capability command - find skills by capability
 */
function capabilityCommand(args: string[]): void {
  const capability = args.find((a) => !a.startsWith("-"));
  const isVerbose = args.includes("--verbose") || args.includes("-v");

  if (!capability) {
    console.error("Usage: skills capability <name>");
    console.error("\nAvailable capabilities:");
    console.error(
      "  backend-development, frontend-development, api-design,"
    );
    console.error(
      "  python, typescript, javascript, rust, go, java, ruby, php,"
    );
    console.error("  testing, security-audit, debugging, ai-ml, llm-tooling,");
    console.error("  rag, documentation, cloud-infrastructure, research, ...");
    process.exit(1);
  }

  const db = new SkillsDatabase();

  try {
    const skills = db.getByCapability(capability);

    if (skills.length === 0) {
      console.log(`No skills found with capability "${capability}"`);
      return;
    }

    console.log(
      `\x1b[36mSkills with capability "${capability}" (${skills.length}):\x1b[0m\n`
    );

    for (const skill of skills) {
      console.log(formatSkill(skill, isVerbose));
      console.log("");
    }
  } finally {
    db.close();
  }
}

/**
 * Help message
 */
function showHelp(): void {
  console.log(`
\x1b[1mSkills Catalog CLI\x1b[0m

Usage: bun run skills <command> [options]

Commands:
  index [--full|--incremental]  Index skills from GitHub repository
  search <query>                Search skills by keyword
  plugin <name>                 List skills in a plugin
  show <skill-id>               Show detailed skill information
  stats                         Show catalog statistics
  plugins                       List all indexed plugins
  capability <name>             Find skills by capability

Options:
  --verbose, -v                 Show detailed output
  --limit=N                     Limit results (default: 20)

Examples:
  bun run skills index --full           Full re-index from GitHub
  bun run skills index --incremental    Update only changed skills
  bun run skills search "typescript"    Search for TypeScript skills
  bun run skills plugin all-agents      List skills in all-agents plugin
  bun run skills capability testing     Find testing-related skills
`);
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];
  const commandArgs = args.slice(1);

  switch (command) {
    case "index":
      await indexCommand(commandArgs);
      break;
    case "search":
      searchCommand(commandArgs);
      break;
    case "plugin":
      pluginCommand(commandArgs);
      break;
    case "show":
      showCommand(commandArgs);
      break;
    case "stats":
      statsCommand();
      break;
    case "plugins":
      pluginsCommand();
      break;
    case "capability":
      capabilityCommand(commandArgs);
      break;
    case "help":
    case "--help":
    case "-h":
      showHelp();
      break;
    default:
      if (command) {
        console.error(`Unknown command: ${command}`);
      }
      showHelp();
      process.exit(command ? 1 : 0);
  }
}

main().catch((error) => {
  console.error(
    `\x1b[31mFatal error:\x1b[0m ${error instanceof Error ? error.message : "Unknown error"}`
  );
  process.exit(1);
});
