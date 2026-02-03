import { NextRequest, NextResponse } from "next/server";
import { repositories, computeStatistics } from "@/data/repositories";
import type { ApiResponse, Insight } from "@/lib/types";

// Generate insights based on repository analysis
function generateInsight(index: number): Insight {
  const stats = computeStatistics();
  const criticalRepos = repositories.filter((r) => r.singularityImpact === "Critical");
  const agentMemoryRepos = repositories.filter((r) => r.researchFrontier === "Agent Memory");
  const temporalRepos = repositories.filter((r) => r.researchFrontier === "Temporal KGs");

  const insightTemplates: Omit<Insight, "id" | "createdAt">[] = [
    {
      title: "Agent Memory Convergence",
      content: `Analysis reveals ${agentMemoryRepos.length} repositories focusing on agent memory systems. This represents a critical path to AI self-improvement through persistent knowledge accumulation.`,
      type: "trend",
      confidence: 0.92,
      relatedRepos: agentMemoryRepos.slice(0, 4).map((r) => r.name),
    },
    {
      title: "Temporal Knowledge Gap",
      content: `Only ${temporalRepos.length} repositories address temporal reasoning, despite its importance for causal understanding. This represents an underserved area with high acceleration potential.`,
      type: "discovery",
      confidence: 0.87,
      relatedRepos: temporalRepos.map((r) => r.name),
    },
    {
      title: "Integration Recommendation: Graph + LLM",
      content: `Tier 2 (RAG+KG) shows the highest innovation density with ${stats.byTier["Tier 2: RAG + Knowledge Graphs"]} repositories. Prioritize integrations that combine structured knowledge with language model capabilities.`,
      type: "recommendation",
      confidence: 0.89,
      relatedRepos: ["graphrag", "LightRAG", "cognee", "KAG"],
    },
    {
      title: "Critical Infrastructure Dependencies",
      content: `${criticalRepos.length} repositories are classified as Critical impact. Disruption to any of these could significantly slow singularity acceleration. Consider redundancy strategies.`,
      type: "warning",
      confidence: 0.94,
      relatedRepos: criticalRepos.map((r) => r.name),
    },
    {
      title: "Neuro-Symbolic Emergence",
      content: `TypeDB and KAG represent convergence of symbolic AI with neural approaches. This hybrid paradigm could enable verifiable reasoning at scale.`,
      type: "trend",
      confidence: 0.85,
      relatedRepos: ["typedb", "KAG", "graphiti"],
    },
    {
      title: "Python Ecosystem Lock-in",
      content: `${stats.byLanguage["Python"] || 0} of ${stats.totalRepositories} repositories use Python. While enabling rapid development, this creates performance ceilings that may require Rust/C++ bridges for scale.`,
      type: "warning",
      confidence: 0.91,
      relatedRepos: ["dgl", "pytorch_geometric", "pykeen"],
    },
  ];

  const template = insightTemplates[index % insightTemplates.length];

  return {
    ...template,
    id: `insight-${Date.now()}-${index}`,
    createdAt: new Date().toISOString(),
  };
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const count = Math.min(parseInt(searchParams.get("count") || "4", 10), 20);

  const insights: Insight[] = [];
  for (let i = 0; i < count; i++) {
    insights.push(generateInsight(i));
  }

  const response: ApiResponse<Insight[]> = {
    success: true,
    data: insights,
  };

  return NextResponse.json(response);
}

export async function POST(request: NextRequest) {
  // Trigger insight generation
  try {
    const body = await request.json();
    const { action } = body as { action: string };

    if (action === "generate") {
      // Generate 3 new insights
      const insights: Insight[] = [];
      for (let i = 0; i < 3; i++) {
        insights.push(generateInsight(Math.floor(Math.random() * 6)));
      }

      return NextResponse.json({
        success: true,
        data: insights,
      });
    }

    return NextResponse.json(
      {
        success: false,
        error: "Unknown action",
      },
      { status: 400 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Insight generation failed",
      },
      { status: 500 }
    );
  }
}
