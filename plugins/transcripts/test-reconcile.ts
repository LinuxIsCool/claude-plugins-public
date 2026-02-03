import { getYouTubeQueue } from "./src/infrastructure/youtube-queue.js";

const queue = getYouTubeQueue();

console.log("Before reconciliation:");
const beforeStatus = queue.getStatus();
console.log(`  Pending: ${beforeStatus.queue.pending}`);
console.log(`  Completed: ${beforeStatus.queue.completed}`);
console.log(`  Total ingested: ${beforeStatus.state.total_ingested}`);

console.log("\nRunning reconciliation...");
const result = queue.reconcileWithCache();

console.log(`\nReconciled ${result.reconciled} videos:`);
for (const video of result.videos) {
  console.log(`  - ${video.title.slice(0, 60)}`);
}

console.log("\nAfter reconciliation:");
const afterStatus = queue.getStatus();
console.log(`  Pending: ${afterStatus.queue.pending}`);
console.log(`  Completed: ${afterStatus.queue.completed}`);
console.log(`  Total ingested: ${afterStatus.state.total_ingested}`);
