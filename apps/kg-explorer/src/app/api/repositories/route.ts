import { NextRequest, NextResponse } from "next/server";
import {
  repositories,
  searchRepositories,
  getRepositoriesByTier,
  getRepositoriesByImpact,
  getRepositoriesByFrontier,
  getRepositoriesByLanguage,
  TIERS,
  IMPACTS,
  FRONTIERS,
} from "@/data/repositories";
import type { ApiResponse, Repository, Tier, SingularityImpact, ResearchFrontier } from "@/lib/types";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  // Parse query parameters
  const query = searchParams.get("q");
  const tier = searchParams.get("tier") as Tier | null;
  const impact = searchParams.get("impact") as SingularityImpact | null;
  const frontier = searchParams.get("frontier") as ResearchFrontier | null;
  const language = searchParams.get("language");
  const page = parseInt(searchParams.get("page") || "1", 10);
  const pageSize = Math.min(parseInt(searchParams.get("pageSize") || "50", 10), 100);

  let filteredRepos: Repository[] = [...repositories];

  // Apply filters
  if (query) {
    filteredRepos = searchRepositories(query);
  }

  if (tier && TIERS.includes(tier)) {
    filteredRepos = filteredRepos.filter((r) => r.tier === tier);
  }

  if (impact && IMPACTS.includes(impact)) {
    filteredRepos = filteredRepos.filter((r) => r.singularityImpact === impact);
  }

  if (frontier && FRONTIERS.includes(frontier)) {
    if (frontier === "General") {
      filteredRepos = filteredRepos.filter((r) => !r.researchFrontier);
    } else {
      filteredRepos = filteredRepos.filter((r) => r.researchFrontier === frontier);
    }
  }

  if (language) {
    filteredRepos = filteredRepos.filter(
      (r) => r.language?.toLowerCase() === language.toLowerCase()
    );
  }

  // Paginate
  const total = filteredRepos.length;
  const start = (page - 1) * pageSize;
  const paginatedRepos = filteredRepos.slice(start, start + pageSize);

  const response: ApiResponse<Repository[]> = {
    success: true,
    data: paginatedRepos,
    meta: {
      total,
      page,
      pageSize,
    },
  };

  return NextResponse.json(response);
}

export async function POST(request: NextRequest) {
  // In a real app, this would create a new repository entry
  // For this demo, we just return an error
  return NextResponse.json(
    {
      success: false,
      error: "Repository creation is not supported in demo mode",
    },
    { status: 403 }
  );
}
