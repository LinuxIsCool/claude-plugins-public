/**
 * AgentNet Agent Discovery
 * Discovers and syncs agent profiles from the registry and plugins
 */

import { existsSync, readdirSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import matter from "gray-matter";
import type { AgentProfile } from "../types/index.ts";
import { SocialStore } from "./store.ts";

/**
 * Discover agents from project-level .claude/agents/ directory
 */
async function discoverProjectAgents(rootDir: string): Promise<AgentProfile[]> {
	const agentsDir = join(rootDir, ".claude", "agents");
	if (!existsSync(agentsDir)) return [];

	const profiles: AgentProfile[] = [];
	const files = readdirSync(agentsDir).filter((f) => f.endsWith(".md"));

	for (const file of files) {
		const filePath = join(agentsDir, file);
		const content = await Bun.file(filePath).text();
		const { data: frontmatter, content: body } = matter(content);

		const id = basename(file, ".md");
		profiles.push({
			id,
			name: String(frontmatter.name || id),
			role: String(frontmatter.description || ""),
			description: body.trim() || undefined,
			model: frontmatter.model ? String(frontmatter.model) : undefined,
			source: "project",
			sourcePath: filePath,
			createdDate: new Date().toISOString(),
		});
	}

	return profiles;
}

/**
 * Discover agents from plugin directories
 */
async function discoverPluginAgents(rootDir: string): Promise<AgentProfile[]> {
	const pluginsDir = join(rootDir, "plugins");
	if (!existsSync(pluginsDir)) return [];

	const profiles: AgentProfile[] = [];
	const pluginDirs = readdirSync(pluginsDir).filter((d) => {
		const stat = statSync(join(pluginsDir, d));
		return stat.isDirectory();
	});

	for (const pluginName of pluginDirs) {
		const pluginJsonPath = join(
			pluginsDir,
			pluginName,
			".claude-plugin",
			"plugin.json"
		);
		if (!existsSync(pluginJsonPath)) continue;

		try {
			const pluginConfig = JSON.parse(
				await Bun.file(pluginJsonPath).text()
			);

			if (!pluginConfig.agents || !Array.isArray(pluginConfig.agents))
				continue;

			for (const agentPath of pluginConfig.agents) {
				const fullPath = join(pluginsDir, pluginName, agentPath);
				if (!existsSync(fullPath)) continue;

				const content = await Bun.file(fullPath).text();
				const { data: frontmatter, content: body } = matter(content);

				const id = `${pluginName}:${basename(agentPath, ".md")}`;
				profiles.push({
					id,
					name: String(frontmatter.name || basename(agentPath, ".md")),
					role: String(frontmatter.description || ""),
					description: body.trim() || undefined,
					model: frontmatter.model ? String(frontmatter.model) : undefined,
					source: "plugin",
					sourcePath: fullPath,
					createdDate: new Date().toISOString(),
				});
			}
		} catch {
			// Skip plugins with invalid configuration
		}
	}

	return profiles;
}

/**
 * Discover all agents from project and plugins
 */
export async function discoverAgents(rootDir: string): Promise<AgentProfile[]> {
	const [projectAgents, pluginAgents] = await Promise.all([
		discoverProjectAgents(rootDir),
		discoverPluginAgents(rootDir),
	]);

	return [...projectAgents, ...pluginAgents].sort((a, b) =>
		a.id.localeCompare(b.id)
	);
}

/**
 * Sync discovered agents with social store
 * - Creates profiles for new agents
 * - Updates source paths for existing agents
 * - Preserves stats for existing profiles
 */
export async function syncAgentProfiles(
	rootDir: string,
	store: SocialStore
): Promise<{
	created: string[];
	updated: string[];
	total: number;
}> {
	const discovered = await discoverAgents(rootDir);
	const existing = await store.listProfiles();
	const existingMap = new Map(existing.map((p) => [p.id, p]));

	const created: string[] = [];
	const updated: string[] = [];

	for (const agent of discovered) {
		const existing = existingMap.get(agent.id);

		if (!existing) {
			// New agent - create profile
			await store.saveProfile(agent);
			created.push(agent.id);
		} else {
			// Existing agent - update metadata, preserve stats
			const merged: AgentProfile = {
				...agent,
				createdDate: existing.createdDate,
				updatedDate: new Date().toISOString(),
				stats: existing.stats,
				preferences: existing.preferences,
			};

			// Only update if something changed
			if (
				agent.name !== existing.name ||
				agent.role !== existing.role ||
				agent.model !== existing.model ||
				agent.sourcePath !== existing.sourcePath
			) {
				await store.saveProfile(merged);
				updated.push(agent.id);
			}
		}
	}

	return {
		created,
		updated,
		total: discovered.length,
	};
}
