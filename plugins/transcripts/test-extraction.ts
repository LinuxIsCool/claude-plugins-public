import { createHeadlessClaudeExtractor } from "./src/adapters/extraction/headless-claude.js";
import { getCachedTranscript } from "./src/adapters/ingestion/youtube.js";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import { homedir } from "os";

async function main() {
  const extractor = createHeadlessClaudeExtractor("haiku");

  console.log("Checking availability...");
  const available = await extractor.isAvailable();
  console.log(`Claude available: ${available}`);

  if (!available) {
    console.error("Claude CLI not found!");
    return;
  }

  // Get first cached transcript
  const cacheDir = join(homedir(), ".claude", "transcripts", "youtube-cache");
  const files = readdirSync(cacheDir).filter((f) => f.endsWith(".json"));

  if (files.length === 0) {
    console.error("No cached transcripts found!");
    return;
  }

  // Read first transcript
  const filePath = join(cacheDir, files[0]);
  const rawData = JSON.parse(readFileSync(filePath, "utf-8"));
  const data = rawData.captions || rawData; // Handle both formats

  console.log(`\nAnalyzing: ${files[0]}`);
  console.log(`Captions: ${data.length} segments`);

  // Combine captions into clean text
  // YouTube captions often have overlapping/repeated segments, so we need smarter dedup
  const allText = data.map((c: any) => c.text?.trim()).filter(Boolean).join(" ");

  // Remove repeated phrases (YouTube's caption format often duplicates)
  const words = allText.split(/\s+/);
  const cleanedWords: string[] = [];
  for (let i = 0; i < words.length; i++) {
    // Skip if this word and next 2 match a sequence we just added
    if (i < words.length - 2 && cleanedWords.length >= 3) {
      const lastThree = cleanedWords.slice(-3).join(" ");
      const nextThree = words.slice(i, i + 3).join(" ");
      if (lastThree === nextThree) {
        i += 2; // Skip the repeated sequence
        continue;
      }
    }
    cleanedWords.push(words[i]);
  }

  // Take first ~3000 chars for extraction
  const text = cleanedWords.join(" ").slice(0, 3000);

  console.log(`Text length: ${text.length} chars`);
  console.log(`\nFirst 300 chars:\n${text.slice(0, 300)}...\n`);

  console.log("Extracting entities (this may take ~30s)...\n");
  const result = await extractor.extract(text);

  console.log("=== EXTRACTION RESULTS ===\n");

  console.log(`Entities (${result.entities.length}):`);
  for (const e of result.entities.slice(0, 10)) {
    console.log(`  [${e.type}] ${e.normalized_name} (${e.confidence.toFixed(2)})`);
  }

  console.log(`\nRelationships (${result.relationships.length}):`);
  for (const r of result.relationships.slice(0, 5)) {
    console.log(`  ${r.subject.text} --${r.predicate}--> ${r.object.text}`);
  }

  console.log(`\nTopics (${result.topics.length}):`);
  for (const t of result.topics) {
    console.log(`  ${t.name}: ${t.keywords.join(", ")}`);
  }

  if (result.summary) {
    console.log(`\nSummary:\n  ${result.summary}`);
  }

  console.log(`\nProcessing time: ${result.processing_time_ms}ms`);

  // Test belief extraction
  console.log("\n=== BELIEF EXTRACTION ===\n");
  const beliefs = await extractor.extractBeliefs(text);
  console.log(`Beliefs (${beliefs.length}):`);
  for (const b of beliefs.slice(0, 5)) {
    console.log(`  [${b.category}] "${b.statement}" (${b.confidence.toFixed(2)})`);
    console.log(`    Evidence: ${b.evidence}`);
  }
}

main().catch(console.error);
