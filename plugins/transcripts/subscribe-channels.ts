import { getYouTubeQueue } from "./src/infrastructure/youtube-queue.js";

const channels = [
  { url: "https://www.youtube.com/@aiDotEngineer", name: "AI Engineer", priority: "high" as const },
  { url: "https://www.youtube.com/@veritasium", name: "Veritasium", priority: "medium" as const },
  { url: "https://www.youtube.com/@parttimelarry", name: "Part Time Larry", priority: "medium" as const },
  { url: "https://www.youtube.com/@MachineLearningStreetTalk", name: "ML Street Talk", priority: "high" as const },
  { url: "https://www.youtube.com/@amiithinks", name: "Amii", priority: "medium" as const },
  { url: "https://www.youtube.com/@PhysicsExplainedVideos", name: "Physics Explained", priority: "low" as const },
  { url: "https://www.youtube.com/@WelchLabsVideo", name: "Welch Labs", priority: "medium" as const },
  { url: "https://www.youtube.com/@RL-conference", name: "RL Conference", priority: "high" as const },
  { url: "https://www.youtube.com/@anthropic-ai", name: "Anthropic", priority: "high" as const },
  { url: "https://www.youtube.com/@DeepRLCourse", name: "Deep RL Course", priority: "high" as const },
  { url: "https://www.youtube.com/@3blue1brown", name: "3Blue1Brown", priority: "medium" as const },
  { url: "https://www.youtube.com/@t3dotgg", name: "Theo", priority: "medium" as const },
  { url: "https://www.youtube.com/@TwoMinutePapers", name: "Two Minute Papers", priority: "medium" as const },
  { url: "https://www.youtube.com/@ColeMedin", name: "Cole Medin", priority: "high" as const },
  { url: "https://www.youtube.com/@devopstoolbox", name: "DevOps Toolbox", priority: "low" as const },
  { url: "https://www.youtube.com/@LangChain", name: "LangChain", priority: "high" as const },
  { url: "https://www.youtube.com/@cascadiajs", name: "CascadiaJS", priority: "low" as const },
  { url: "https://www.youtube.com/@FalkorDB", name: "FalkorDB", priority: "high" as const },
];

async function main() {
  const queue = getYouTubeQueue();

  console.log(`Subscribing to ${channels.length} channels...\n`);

  let totalQueued = 0;
  const results: Array<{ name: string; videos: number; error?: string }> = [];

  for (const channel of channels) {
    process.stdout.write(`${channel.name}... `);
    try {
      const result = await queue.subscribe(channel.url, {
        name: channel.name,
        priority: channel.priority,
      });
      console.log(`${result.videosQueued} videos queued`);
      totalQueued += result.videosQueued;
      results.push({ name: channel.name, videos: result.videosQueued });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.log(`FAILED: ${msg.slice(0, 50)}`);
      results.push({ name: channel.name, videos: 0, error: msg });
    }
  }

  console.log("\n" + "=".repeat(50));
  console.log(`Total channels: ${channels.length}`);
  console.log(`Total videos queued: ${totalQueued}`);
  console.log("=".repeat(50));

  const status = queue.getStatus();
  console.log("\nQueue Status:");
  console.log(JSON.stringify(status, null, 2));
}

main().catch(console.error);
