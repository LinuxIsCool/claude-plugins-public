#!/usr/bin/env bun
/**
 * Import SMS messages from Samsung Android backup
 *
 * Usage:
 *   bun scripts/import-samsung-backup.ts /path/to/extracted/backup
 */

import { createStore } from "../src/core/store";
import { createSearchIndex } from "../src/search/index";
import {
  importSamsungBackup,
  countSamsungBackupMessages,
} from "../src/adapters/samsung-backup";

async function main() {
  const backupPath = process.argv[2] || "/tmp/sms_extracted";

  console.log("Samsung SMS Backup Import");
  console.log("=========================");
  console.log(`Backup path: ${backupPath}`);
  console.log("");

  // Count first
  console.log("Counting messages...");
  const counts = await countSamsungBackupMessages({ path: backupPath });
  console.log(`  Files: ${counts.files}`);
  console.log(`  Messages: ${counts.messages}`);
  console.log(`  Unique contacts: ${counts.uniqueAddresses}`);
  if (counts.dateRange.earliest && counts.dateRange.latest) {
    console.log(
      `  Date range: ${counts.dateRange.earliest.toISOString().split("T")[0]} ` +
        `to ${counts.dateRange.latest.toISOString().split("T")[0]}`
    );
  }
  console.log("");

  // Initialize store and search
  const store = createStore();
  const search = createSearchIndex();

  console.log("Importing messages...");
  const startTime = Date.now();
  const messages: unknown[] = [];

  // Import all messages
  const generator = importSamsungBackup(store, { path: backupPath });
  let result = await generator.next();

  while (!result.done) {
    messages.push(result.value);
    result = await generator.next();
  }

  const stats = result.value;
  const importTime = Date.now() - startTime;

  console.log("");
  console.log("Import Statistics:");
  console.log(`  Messages imported: ${stats.messages}`);
  console.log(`  Conversations: ${stats.conversations}`);
  console.log(`  Accounts: ${stats.accounts}`);
  console.log(`  Skipped: ${stats.skipped}`);
  console.log(`  Errors: ${stats.errors}`);
  console.log(`  Import time: ${(importTime / 1000).toFixed(1)}s`);
  console.log(
    `  Speed: ${Math.round((stats.messages / importTime) * 1000)} messages/sec`
  );

  // Index for search
  console.log("");
  console.log("Indexing for search...");
  const indexStart = Date.now();
  for (const msg of messages) {
    search.index(msg as Parameters<typeof search.index>[0]);
  }
  const indexTime = Date.now() - indexStart;
  console.log(`  Indexed ${messages.length} messages in ${indexTime}ms`);

  console.log("");
  console.log("Done!");
}

main().catch(console.error);
