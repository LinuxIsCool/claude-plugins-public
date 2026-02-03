/**
 * Test script for YouTube queue system
 */

import { createYouTubeQueue } from "./src/infrastructure/youtube-queue.js";

async function main() {
  console.log("Creating YouTube queue...");
  const queue = createYouTubeQueue();

  console.log("\n1. Subscribing to IndyDevDan channel...");
  try {
    const result = await queue.subscribe("@IndyDevDan", {
      name: "IndyDevDan",
      priority: "high",
    });

    console.log("Subscribed:", {
      channel: result.channel.name,
      url: result.channel.url,
      priority: result.channel.priority,
      videos_queued: result.videosQueued,
    });
  } catch (error) {
    console.error("Failed to subscribe:", error);
  }

  console.log("\n2. Checking queue status...");
  const status = queue.getStatus();
  console.log("Status:", JSON.stringify(status, null, 2));

  console.log("\n3. Getting pending videos (first 5)...");
  const pending = queue.getQueueItems({ status: "pending", limit: 5 });
  for (const video of pending) {
    console.log(`  - ${video.upload_date}: ${video.title.slice(0, 60)}...`);
  }

  console.log("\n4. Processing first batch of 3 videos...");
  try {
    const processResult = await queue.processQueue({ mode: "auto" }, 3);
    console.log("Process result:", JSON.stringify(processResult, null, 2));
  } catch (error) {
    console.error("Processing failed:", error);
  }

  console.log("\n5. Final status...");
  const finalStatus = queue.getStatus();
  console.log("Final status:", JSON.stringify(finalStatus, null, 2));
}

main().catch(console.error);
