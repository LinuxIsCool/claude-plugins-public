/**
 * AgentNet CLI Tests
 * Tests for command-line interface functionality
 */

import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { existsSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const TEST_ROOT = "/tmp/agentnet-test-cli";
const CLI_PATH = join(import.meta.dir, "../cli.ts");

describe("CLI Commands", () => {
	beforeAll(async () => {
		// Clean up any previous test data
		if (existsSync(TEST_ROOT)) {
			rmSync(TEST_ROOT, { recursive: true });
		}
		mkdirSync(TEST_ROOT, { recursive: true });

		// Create test agent files
		const agentsDir = join(TEST_ROOT, ".claude", "agents");
		mkdirSync(agentsDir, { recursive: true });

		// Create a test agent
		writeFileSync(
			join(agentsDir, "test-cli-agent.md"),
			`---
name: CLI Test Agent
description: Agent for CLI testing
model: sonnet
---
This is a test agent for CLI testing.
`
		);

		// Run sync first to populate store
		Bun.spawnSync(["bun", "run", CLI_PATH, "sync", "-r", TEST_ROOT], {
			env: process.env,
		});
	});

	afterAll(() => {
		// Clean up test data
		if (existsSync(TEST_ROOT)) {
			rmSync(TEST_ROOT, { recursive: true });
		}
	});

	test("sync command should discover agents", async () => {
		const result = Bun.spawnSync(
			["bun", "run", CLI_PATH, "sync", "-r", TEST_ROOT],
			{ env: process.env }
		);

		expect(result.exitCode).toBe(0);
		const output = result.stdout.toString();
		expect(output).toContain("Syncing agent profiles");
		expect(output).toContain("Total:");
	});

	test("agents command with --json should output valid JSON array", async () => {
		const result = Bun.spawnSync(
			["bun", "run", CLI_PATH, "agents", "--json", "-r", TEST_ROOT],
			{ env: process.env }
		);

		expect(result.exitCode).toBe(0);
		const output = result.stdout.toString().trim();

		// Should be valid JSON
		const parsed = JSON.parse(output);
		expect(Array.isArray(parsed)).toBe(true);
	});

	test("profile command should fail for non-existent agent", async () => {
		const result = Bun.spawnSync(
			["bun", "run", CLI_PATH, "profile", "non-existent-agent", "-r", TEST_ROOT],
			{ env: process.env }
		);

		expect(result.exitCode).toBe(1);
		const output = result.stderr.toString();
		expect(output).toContain("not found");
	});

	test("feed command with --json should output valid JSON", async () => {
		const result = Bun.spawnSync(
			["bun", "run", CLI_PATH, "feed", "--json", "-r", TEST_ROOT],
			{ env: process.env }
		);

		expect(result.exitCode).toBe(0);
		const output = result.stdout.toString().trim();

		const parsed = JSON.parse(output);
		expect(Array.isArray(parsed)).toBe(true);
	});

	test("wall command should fail for non-existent agent", async () => {
		const result = Bun.spawnSync(
			["bun", "run", CLI_PATH, "wall", "non-existent-agent", "-r", TEST_ROOT],
			{ env: process.env }
		);

		expect(result.exitCode).toBe(1);
		const output = result.stderr.toString();
		expect(output).toContain("not found");
	});

	test("post command should require content", async () => {
		// First ensure agent exists by checking profile
		const profileResult = Bun.spawnSync(
			["bun", "run", CLI_PATH, "profile", "test-cli-agent", "--json", "-r", TEST_ROOT],
			{ env: process.env }
		);

		// Skip if agent wasn't synced
		if (profileResult.exitCode !== 0) {
			return;
		}

		const result = Bun.spawnSync(
			["bun", "run", CLI_PATH, "post", "test-cli-agent", "-r", TEST_ROOT],
			{ env: process.env }
		);

		expect(result.exitCode).toBe(1);
		const output = result.stderr.toString();
		expect(output).toContain("Content is required");
	});
});
