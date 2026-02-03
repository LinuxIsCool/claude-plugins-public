import { NextRequest } from "next/server";
import { repositories, computeStatistics } from "@/data/repositories";
import type { Insight } from "@/lib/types";

// Streaming insight generation
export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();
  const stats = computeStatistics();

  // Generate a random insight
  const insightTypes: Insight["type"][] = ["discovery", "trend", "recommendation", "warning"];
  const randomType = insightTypes[Math.floor(Math.random() * insightTypes.length)];

  const insightData = generateRandomInsight(randomType, stats);

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Stream the content character by character with delays
        const content = insightData.content;
        const chunkSize = 5; // Characters per chunk

        for (let i = 0; i < content.length; i += chunkSize) {
          const chunk = content.slice(i, i + chunkSize);

          const data = JSON.stringify({
            type: "chunk",
            content: chunk,
          });

          controller.enqueue(encoder.encode(`data: ${data}\n\n`));

          // Random delay between chunks for natural feel
          await new Promise((resolve) =>
            setTimeout(resolve, 20 + Math.random() * 30)
          );
        }

        // Send the complete insight
        const insight: Insight = {
          id: `insight-stream-${Date.now()}`,
          title: insightData.title,
          content: insightData.content,
          type: randomType,
          confidence: 0.8 + Math.random() * 0.15,
          relatedRepos: insightData.relatedRepos,
          createdAt: new Date().toISOString(),
        };

        const completeData = JSON.stringify({
          type: "insight",
          insight,
        });

        controller.enqueue(encoder.encode(`data: ${completeData}\n\n`));
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

function generateRandomInsight(
  type: Insight["type"],
  stats: ReturnType<typeof computeStatistics>
): {
  title: string;
  content: string;
  relatedRepos: string[];
} {
  const criticalRepos = repositories
    .filter((r) => r.singularityImpact === "Critical")
    .map((r) => r.name);
  const agentMemoryRepos = repositories
    .filter((r) => r.researchFrontier === "Agent Memory")
    .map((r) => r.name);

  const templates = {
    discovery: [
      {
        title: "Hidden Pattern: Embedding-Memory Bridge",
        content: `Cross-referencing Tier 3 (Embedding) and Tier 2 (RAG+KG) repositories reveals an underexplored connection. Combining PyKEEN's 30+ embedding models with graphiti's temporal capabilities could enable time-aware knowledge retrieval at scale.`,
        relatedRepos: ["pykeen", "graphiti", "graphrag"],
      },
      {
        title: "Unexpected Correlation: Visualization and Adoption",
        content: `Repositories with strong visualization components show 3x higher community adoption. The ${stats.byTier["Tier 6: Visualization & Exploration"]} visualization tools represent a force multiplier for KG ecosystem growth.`,
        relatedRepos: ["react-force-graph", "cytoscape", "xyflow"],
      },
    ],
    trend: [
      {
        title: "Accelerating: Agent Memory Infrastructure",
        content: `The ${agentMemoryRepos.length} agent memory repositories show exponential commit activity growth. Key players ${agentMemoryRepos.slice(0, 3).join(", ")} are converging on common memory management patterns.`,
        relatedRepos: agentMemoryRepos.slice(0, 4),
      },
      {
        title: "Rising: Multi-modal Knowledge Graphs",
        content: `Multi-modal KG repositories are showing increasing integration with vision models. This convergence could enable grounded knowledge acquisition from visual data, accelerating the knowledge accumulation loop.`,
        relatedRepos: ["cognee", "KG-MM-Survey"],
      },
    ],
    recommendation: [
      {
        title: "Priority Integration: TypeDB + Agent Frameworks",
        content: `Combining TypeDB's strong typing with BabyAGI's task-driven architecture could enable formally verified agent reasoning. This integration pathway shows high potential for recursive self-improvement.`,
        relatedRepos: ["typedb", "babyagi", "cognee"],
      },
      {
        title: "Suggested Focus: Temporal Reasoning Gap",
        content: `Only ${stats.byFrontier["Temporal KGs"] || 0} repositories focus on temporal KGs. Given the importance of temporal reasoning for causal understanding, increasing investment here could yield outsized returns.`,
        relatedRepos: ["graphiti", "pytorch_geometric_temporal"],
      },
    ],
    warning: [
      {
        title: "Concentration Risk: Critical Infrastructure",
        content: `${criticalRepos.length} repositories are marked as Critical impact, but ${criticalRepos.slice(0, 2).join(" and ")} show signs of maintainer burnout. Community investment in these projects is essential for ecosystem resilience.`,
        relatedRepos: criticalRepos.slice(0, 4),
      },
      {
        title: "Potential Bottleneck: Scale Limitations",
        content: `Current Python-dominant tooling may face scale limitations. Only ${stats.byLanguage["C++"] || 0 + (stats.byLanguage["Rust"] || 0)} repositories use high-performance languages. Consider bridge patterns for scale-critical paths.`,
        relatedRepos: ["dgraph", "nebula", "tugraph-db"],
      },
    ],
  };

  const options = templates[type];
  return options[Math.floor(Math.random() * options.length)];
}
