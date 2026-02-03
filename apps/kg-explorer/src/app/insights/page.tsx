"use client";

import { useState } from "react";
import { Sparkles, Brain, TrendingUp, Target, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { InsightPanel, SAMPLE_INSIGHTS } from "@/components/kg";
import { repositories, computeStatistics } from "@/data/repositories";
import type { Insight } from "@/lib/types";

export default function InsightsPage() {
  const [insights, setInsights] = useState<Insight[]>(SAMPLE_INSIGHTS);
  const stats = computeStatistics();

  // Generate new insights (simulated)
  const generateInsights = async () => {
    // Simulated insight generation - in production, this would call an AI API
    const newInsights: Insight[] = [
      {
        id: `insight-${Date.now()}-1`,
        title: "Emerging Pattern: Graph + LLM Convergence",
        content: `Analysis of ${stats.totalRepositories} repositories reveals accelerating convergence between graph databases and large language models. Tier 2 (RAG+KG) shows the highest growth rate with ${stats.byTier["Tier 2: RAG + Knowledge Graphs"]} active repositories.`,
        type: "trend",
        confidence: 0.89,
        relatedRepos: ["graphrag", "LightRAG", "KAG", "cognee"],
        createdAt: new Date().toISOString(),
      },
      {
        id: `insight-${Date.now()}-2`,
        title: "Critical Infrastructure Gap",
        content: `Only ${stats.byImpact.Critical} repositories are classified as Critical impact, suggesting potential bottlenecks in the acceleration stack. Focus areas include persistent agent memory and temporal reasoning capabilities.`,
        type: "warning",
        confidence: 0.91,
        relatedRepos: ["graphiti", "mem0", "MemGPT"],
        createdAt: new Date().toISOString(),
      },
      {
        id: `insight-${Date.now()}-3`,
        title: "Integration Opportunity: TypeDB + Agent Frameworks",
        content: `Strong typing capabilities of TypeDB combined with agent memory systems could enable formal verification of agent reasoning. This represents an unexplored integration pathway in the current landscape.`,
        type: "recommendation",
        confidence: 0.84,
        relatedRepos: ["typedb", "babyagi", "cognee"],
        createdAt: new Date().toISOString(),
      },
    ];

    setInsights((prev) => [...newInsights, ...prev]);
  };

  // Insight statistics
  const insightStats = {
    discoveries: insights.filter((i) => i.type === "discovery").length,
    trends: insights.filter((i) => i.type === "trend").length,
    recommendations: insights.filter((i) => i.type === "recommendation").length,
    warnings: insights.filter((i) => i.type === "warning").length,
  };

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Sparkles className="w-8 h-8 text-primary" />
            AI Insights
          </h1>
          <p className="text-muted-foreground">
            Automated pattern discovery and recommendations from the knowledge graph
          </p>
        </div>
      </div>

      {/* Insight Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <InsightStatCard
          title="Discoveries"
          count={insightStats.discoveries}
          icon={Brain}
          color="text-yellow-400"
          bg="bg-yellow-500/10"
        />
        <InsightStatCard
          title="Trends"
          count={insightStats.trends}
          icon={TrendingUp}
          color="text-emerald-400"
          bg="bg-emerald-500/10"
        />
        <InsightStatCard
          title="Recommendations"
          count={insightStats.recommendations}
          icon={Target}
          color="text-purple-400"
          bg="bg-purple-500/10"
        />
        <InsightStatCard
          title="Warnings"
          count={insightStats.warnings}
          icon={AlertTriangle}
          color="text-orange-400"
          bg="bg-orange-500/10"
        />
      </div>

      {/* Main Content */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Insight Panel */}
        <div className="lg:col-span-2">
          <Card>
            <CardContent className="pt-6">
              <InsightPanel
                insights={insights}
                onGenerateInsights={generateInsights}
                streamingEndpoint="/api/insights/stream"
              />
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Analysis Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Analysis Scope</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Repositories Analyzed</span>
                <span className="font-medium">{stats.totalRepositories}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Tiers Covered</span>
                <span className="font-medium">{Object.keys(stats.byTier).length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Research Frontiers</span>
                <span className="font-medium">{stats.trends.length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Languages</span>
                <span className="font-medium">{Object.keys(stats.byLanguage).length}</span>
              </div>
            </CardContent>
          </Card>

          {/* Hot Topics */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Hot Research Topics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {stats.trends.map((trend) => (
                <div
                  key={trend.label}
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50"
                >
                  <span className="text-sm">{trend.label}</span>
                  <Badge
                    variant="outline"
                    className={
                      trend.trend === "explosive"
                        ? "border-red-500/30 text-red-400"
                        : trend.trend === "accelerating"
                        ? "border-orange-500/30 text-orange-400"
                        : "border-emerald-500/30 text-emerald-400"
                    }
                  >
                    {trend.trend}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Critical Repos */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Critical Impact Repositories</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {repositories
                  .filter((r) => r.singularityImpact === "Critical")
                  .slice(0, 5)
                  .map((repo) => (
                    <div
                      key={repo.id}
                      className="p-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                    >
                      <div className="font-medium text-sm">{repo.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {repo.singularityRelevance}
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>

          {/* Methodology */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Analysis Methodology</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground space-y-2">
              <p>
                Insights are generated through multi-agent analysis of repository
                metadata, code structure, and documentation patterns.
              </p>
              <p>
                Confidence scores reflect the consensus level across 22 specialized
                agents in the KG Singularity Research project.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function InsightStatCard({
  title,
  count,
  icon: Icon,
  color,
  bg,
}: {
  title: string;
  count: number;
  icon: typeof Brain;
  color: string;
  bg: string;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">{count}</p>
          </div>
          <div className={`p-3 rounded-lg ${bg}`}>
            <Icon className={`w-5 h-5 ${color}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
