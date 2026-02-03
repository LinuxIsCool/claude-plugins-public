import { listChannelVideos, ingestVideo } from "./src/adapters/ingestion/youtube.js";
import { getYouTubeQueue } from "./src/infrastructure/youtube-queue.js";

async function main() {
  console.log("Fetching 20 newest IndyDevDan videos...\n");

  const videos = await listChannelVideos("@IndyDevDan", { limit: 20 });
  // Already returns newest first from yt-dlp

  console.log("Videos to ingest:");
  for (const v of videos) {
    console.log(`  ${v.upload_date || "unknown"}: ${v.title.slice(0, 60)}`);
  }

  console.log("\nIngesting transcripts...\n");

  const queue = getYouTubeQueue();
  let succeeded = 0;
  let failed = 0;

  for (const video of videos) {
    try {
      console.log(`Processing: ${video.title.slice(0, 50)}...`);
      const result = await ingestVideo(video.id, { mode: "auto" });
      console.log(`  ✓ ${result.captions.length} captions (${result.source})`);
      succeeded++;
    } catch (error) {
      console.log(`  ✗ ${error instanceof Error ? error.message : error}`);
      failed++;

      // Check for rate limit
      const msg = String(error);
      if (msg.includes("429") || msg.includes("rate") || msg.includes("Too Many")) {
        console.log("\nRate limit detected! Stopping.");
        break;
      }
    }
  }

  console.log(`\nDone: ${succeeded} succeeded, ${failed} failed`);
}

main().catch(console.error);
