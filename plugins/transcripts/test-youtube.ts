/**
 * Quick test script for YouTube adapter
 */

import { ingestVideo, getVideoInfo, listChannelVideos } from "./src/adapters/ingestion/youtube.js";

async function test() {
  console.log("Testing YouTube adapter...\n");

  // Test 1: Get video info
  console.log("1. Getting video info...");
  const info = await getVideoInfo("3kgx0YxCriM");
  console.log("Title:", info.title);
  console.log("Channel:", info.channel);
  console.log("Duration:", info.duration_seconds, "seconds");
  console.log("Has captions:", info.has_captions);
  console.log("");

  // Test 2: Ingest with captions
  console.log("2. Ingesting transcript (captions mode)...");
  const result = await ingestVideo("3kgx0YxCriM", { mode: "captions", language: "en" });
  console.log("Source:", result.source);
  console.log("Caption count:", result.captions.length);
  console.log("Sample captions:");
  result.captions.slice(0, 5).forEach((c, i) => {
    console.log(`  [${Math.floor(c.start_ms/1000)}s] ${c.text.slice(0, 80)}...`);
  });
  console.log("");

  // Test 3: List channel videos
  console.log("3. Listing IndyDevDan channel videos...");
  const videos = await listChannelVideos("@indydevdan", { limit: 5 });
  console.log("Found", videos.length, "videos:");
  videos.forEach(v => {
    console.log(`  - ${v.id}: ${v.title.slice(0, 50)}...`);
  });

  console.log("\n✓ All tests passed!");
}

test().catch(console.error);
