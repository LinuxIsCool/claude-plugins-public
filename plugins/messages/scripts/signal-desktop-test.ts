#!/usr/bin/env bun
/**
 * Test Signal Desktop database connection
 */

import Database from "@journeyapps/sqlcipher";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

const HOME = process.env.HOME || "";

// Flatpak Signal Desktop paths
const SIGNAL_DB_PATH = join(HOME, ".var/app/org.signal.Signal/config/Signal/sql/db.sqlite");
const SIGNAL_CONFIG_PATH = join(HOME, ".var/app/org.signal.Signal/config/Signal/config.json");

// Standard Signal Desktop paths (fallback)
const SIGNAL_DB_PATH_STD = join(HOME, ".config/Signal/sql/db.sqlite");
const SIGNAL_CONFIG_PATH_STD = join(HOME, ".config/Signal/config.json");

function getSignalPaths(): { dbPath: string; configPath: string } | null {
  if (existsSync(SIGNAL_DB_PATH) && existsSync(SIGNAL_CONFIG_PATH)) {
    return { dbPath: SIGNAL_DB_PATH, configPath: SIGNAL_CONFIG_PATH };
  }
  if (existsSync(SIGNAL_DB_PATH_STD) && existsSync(SIGNAL_CONFIG_PATH_STD)) {
    return { dbPath: SIGNAL_DB_PATH_STD, configPath: SIGNAL_CONFIG_PATH_STD };
  }
  return null;
}

async function main() {
  console.log("Signal Desktop Database Test");
  console.log("============================\n");

  const paths = getSignalPaths();
  if (!paths) {
    console.error("Error: Signal Desktop database not found");
    console.error("Checked:");
    console.error(`  - ${SIGNAL_DB_PATH}`);
    console.error(`  - ${SIGNAL_DB_PATH_STD}`);
    process.exit(1);
  }

  console.log(`Database: ${paths.dbPath}`);
  console.log(`Config: ${paths.configPath}\n`);

  // Read encryption key
  const config = JSON.parse(readFileSync(paths.configPath, "utf-8"));
  const key = config.key;

  if (!key) {
    console.error("Error: No encryption key found in config.json");
    process.exit(1);
  }

  console.log(`Key: ${key.slice(0, 8)}...\n`);

  // Open database with SQLCipher
  const db = new Database(paths.dbPath);

  // Set the encryption key
  db.pragma(`key = "x'${key}'"`);

  try {
    // Test query
    const countResult = db.prepare("SELECT COUNT(*) as count FROM messages").get() as { count: number };
    console.log(`✓ Connection successful!`);
    console.log(`  Total messages: ${countResult.count.toLocaleString()}\n`);

    // Get conversations count
    const convResult = db.prepare("SELECT COUNT(*) as count FROM conversations").get() as { count: number };
    console.log(`  Conversations: ${convResult.count.toLocaleString()}`);

    // Get date range
    const dateResult = db.prepare(`
      SELECT
        MIN(sent_at) as min_ts,
        MAX(sent_at) as max_ts
      FROM messages
      WHERE sent_at > 0
    `).get() as { min_ts: number; max_ts: number };

    if (dateResult.min_ts && dateResult.max_ts) {
      const earliest = new Date(dateResult.min_ts);
      const latest = new Date(dateResult.max_ts);
      console.log(`  Date range: ${earliest.toISOString().slice(0, 10)} to ${latest.toISOString().slice(0, 10)}`);
    }

    // List tables
    console.log("\n=== Tables ===");
    const tables = db.prepare(`
      SELECT name FROM sqlite_master
      WHERE type='table'
      ORDER BY name
    `).all() as Array<{ name: string }>;

    for (const t of tables) {
      console.log(`  ${t.name}`);
    }

    // Show messages schema
    console.log("\n=== Messages Schema ===");
    const schema = db.prepare(`
      PRAGMA table_info(messages)
    `).all() as Array<{ name: string; type: string }>;

    for (const col of schema.slice(0, 15)) {
      console.log(`  ${col.name}: ${col.type}`);
    }
    if (schema.length > 15) {
      console.log(`  ... and ${schema.length - 15} more columns`);
    }

    // Sample message
    console.log("\n=== Sample Message (most recent) ===");
    const sample = db.prepare(`
      SELECT id, conversationId, sent_at, type, body, source, sourceServiceId
      FROM messages
      WHERE body IS NOT NULL AND body != ''
      ORDER BY sent_at DESC
      LIMIT 1
    `).get() as any;

    if (sample) {
      console.log(`  ID: ${sample.id}`);
      console.log(`  Conversation: ${sample.conversationId}`);
      console.log(`  Sent: ${new Date(sample.sent_at).toISOString()}`);
      console.log(`  Type: ${sample.type}`);
      console.log(`  Body: ${sample.body?.slice(0, 80)}${sample.body?.length > 80 ? '...' : ''}`);
    }

    // Conversations schema
    console.log("\n=== Conversations Schema ===");
    const convSchema = db.prepare(`
      PRAGMA table_info(conversations)
    `).all() as Array<{ name: string; type: string }>;

    for (const col of convSchema.slice(0, 15)) {
      console.log(`  ${col.name}: ${col.type}`);
    }

  } catch (err) {
    console.error("Database error:", err);
    process.exit(1);
  } finally {
    db.close();
  }
}

main().catch(console.error);
