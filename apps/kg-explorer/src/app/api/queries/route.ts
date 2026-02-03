import { NextRequest, NextResponse } from "next/server";
import { repositories } from "@/data/repositories";
import type { ApiResponse, QueryResult, QueryLanguage } from "@/lib/types";

// Simulate query execution
function executeSimulatedQuery(query: string, language: QueryLanguage): QueryResult {
  const lowerQuery = query.toLowerCase();
  let results: object[] = [];

  // Parse query to determine what to return
  if (lowerQuery.includes("critical") || lowerQuery.includes("singularityimpact")) {
    results = repositories
      .filter((r) => r.singularityImpact === "Critical")
      .map((r) => ({
        name: r.name,
        description: r.description,
        tier: r.tier,
        impact: r.singularityImpact,
      }));
  } else if (lowerQuery.includes("agent memory") || lowerQuery.includes("agent_memory")) {
    results = repositories
      .filter((r) => r.researchFrontier === "Agent Memory")
      .map((r) => ({
        name: r.name,
        relevance: r.singularityRelevance,
        impact: r.singularityImpact,
      }));
  } else if (lowerQuery.includes("tier 2") || lowerQuery.includes("rag")) {
    results = repositories
      .filter((r) => r.tier === "Tier 2: RAG + Knowledge Graphs")
      .map((r) => ({
        name: r.name,
        description: r.description,
        impact: r.singularityImpact,
      }));
  } else if (lowerQuery.includes("python")) {
    results = repositories
      .filter((r) => r.language === "Python")
      .map((r) => ({
        name: r.name,
        description: r.description,
        tier: r.tier,
      }));
  } else if (lowerQuery.includes("count") || lowerQuery.includes("group")) {
    // Aggregation query
    const tierCounts: Record<string, number> = {};
    for (const repo of repositories) {
      tierCounts[repo.tier] = (tierCounts[repo.tier] || 0) + 1;
    }
    results = Object.entries(tierCounts).map(([tier, count]) => ({
      tier,
      count,
    }));
  } else {
    // Default: return sample
    results = repositories.slice(0, 10).map((r) => ({
      name: r.name,
      description: r.description,
      tier: r.tier,
    }));
  }

  return {
    success: true,
    data: results,
    rowCount: results.length,
    executionTime: Math.round(100 + Math.random() * 400),
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, language } = body as {
      query: string;
      language: QueryLanguage;
    };

    if (!query || !language) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing query or language parameter",
        },
        { status: 400 }
      );
    }

    // Simulate execution delay
    await new Promise((resolve) => setTimeout(resolve, 200 + Math.random() * 300));

    const result = executeSimulatedQuery(query, language);

    const response: ApiResponse<QueryResult> = {
      success: true,
      data: result,
    };

    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Query execution failed",
      },
      { status: 500 }
    );
  }
}

// Get cataloged queries
export async function GET(request: NextRequest) {
  // Return sample cataloged queries
  const catalogedQueries = [
    {
      id: "q1",
      name: "Critical Impact Repos",
      description: "Find all repositories with Critical singularity impact",
      language: "cypher",
      query: `MATCH (r:Repository {singularityImpact: "Critical"})
RETURN r.name, r.description, r.tier`,
      naturalLanguage: "Show me all repositories with Critical singularity impact",
      createdAt: new Date(Date.now() - 86400000).toISOString(),
      tags: ["critical", "impact"],
      executionCount: 12,
    },
    {
      id: "q2",
      name: "Agent Memory Stack",
      description: "Repositories focused on agent memory systems",
      language: "cypher",
      query: `MATCH (r:Repository)
WHERE r.researchFrontier = "Agent Memory"
RETURN r.name, r.singularityRelevance`,
      naturalLanguage: "Find all agent memory repositories",
      createdAt: new Date(Date.now() - 172800000).toISOString(),
      tags: ["agents", "memory"],
      executionCount: 8,
    },
  ];

  return NextResponse.json({
    success: true,
    data: catalogedQueries,
  });
}
