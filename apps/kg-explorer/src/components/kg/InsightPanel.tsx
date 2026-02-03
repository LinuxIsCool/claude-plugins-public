"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Lightbulb,
  TrendingUp,
  AlertTriangle,
  Sparkles,
  RefreshCw,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Insight } from "@/lib/types";

interface InsightPanelProps {
  insights?: Insight[];
  onGenerateInsights?: () => Promise<void>;
  streamingEndpoint?: string;
  autoStream?: boolean;
}

// Insight type styling
const INSIGHT_STYLES: Record<
  Insight["type"],
  { icon: typeof Lightbulb; color: string; bg: string }
> = {
  discovery: {
    icon: Lightbulb,
    color: "text-yellow-400",
    bg: "bg-yellow-500/10",
  },
  trend: {
    icon: TrendingUp,
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
  },
  recommendation: {
    icon: Sparkles,
    color: "text-purple-400",
    bg: "bg-purple-500/10",
  },
  warning: {
    icon: AlertTriangle,
    color: "text-orange-400",
    bg: "bg-orange-500/10",
  },
};

function InsightCard({
  insight,
  isNew,
}: {
  insight: Insight;
  isNew?: boolean;
}) {
  const style = INSIGHT_STYLES[insight.type];
  const Icon = style.icon;

  return (
    <Card
      className={`relative overflow-hidden transition-all duration-500 ${
        isNew ? "animate-in slide-in-from-bottom-4 fade-in" : ""
      }`}
    >
      {/* Type indicator */}
      <div className={`absolute top-0 left-0 right-0 h-0.5 ${style.bg}`} />

      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded ${style.bg}`}>
              <Icon className={`w-4 h-4 ${style.color}`} />
            </div>
            <CardTitle className="text-sm">{insight.title}</CardTitle>
          </div>
          <Badge
            variant="outline"
            className="text-xs shrink-0"
            title="Confidence score"
          >
            {Math.round(insight.confidence * 100)}%
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground leading-relaxed">
          {insight.content}
        </p>

        {insight.relatedRepos.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {insight.relatedRepos.slice(0, 5).map((repo) => (
              <Badge key={repo} variant="secondary" className="text-xs">
                {repo}
              </Badge>
            ))}
            {insight.relatedRepos.length > 5 && (
              <Badge variant="secondary" className="text-xs">
                +{insight.relatedRepos.length - 5} more
              </Badge>
            )}
          </div>
        )}

        <div className="flex items-center justify-between pt-2 border-t border-border/50">
          <span className="text-xs text-muted-foreground capitalize">
            {insight.type}
          </span>
          <span className="text-xs text-muted-foreground">
            {new Date(insight.createdAt).toLocaleDateString()}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function StreamingInsightCard({ content }: { content: string }) {
  return (
    <Card className="relative overflow-hidden border-primary/30 bg-primary/5">
      <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-purple-500 via-pink-500 to-cyan-500 animate-pulse" />

      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded bg-primary/20">
            <Sparkles className="w-4 h-4 text-primary animate-pulse" />
          </div>
          <CardTitle className="text-sm">Generating Insight...</CardTitle>
        </div>
      </CardHeader>

      <CardContent>
        <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
          {content}
          <span className="inline-block w-2 h-4 bg-primary/50 ml-0.5 animate-pulse" />
        </p>
      </CardContent>
    </Card>
  );
}

export function InsightPanel({
  insights: initialInsights = [],
  onGenerateInsights,
  streamingEndpoint = "/api/insights/stream",
  autoStream = false,
}: InsightPanelProps) {
  const [insights, setInsights] = useState<Insight[]>(initialInsights);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamContent, setStreamContent] = useState("");
  const [newInsightIds, setNewInsightIds] = useState<Set<string>>(new Set());
  const abortControllerRef = useRef<AbortController | null>(null);

  // Start streaming insights
  const startStreaming = useCallback(async () => {
    if (isStreaming) return;

    setIsStreaming(true);
    setStreamContent("");

    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch(streamingEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "generate" }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) throw new Error("Failed to start streaming");

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) throw new Error("No reader available");

      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Parse SSE events
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);

            if (data === "[DONE]") {
              break;
            }

            try {
              const parsed = JSON.parse(data);

              if (parsed.type === "chunk") {
                setStreamContent((prev) => prev + parsed.content);
              } else if (parsed.type === "insight") {
                // Complete insight received
                const newInsight: Insight = parsed.insight;
                setInsights((prev) => [newInsight, ...prev]);
                setNewInsightIds((prev) => new Set(prev).add(newInsight.id));
                setStreamContent("");

                // Remove "new" status after animation
                setTimeout(() => {
                  setNewInsightIds((prev) => {
                    const updated = new Set(prev);
                    updated.delete(newInsight.id);
                    return updated;
                  });
                }, 1000);
              }
            } catch {
              // Ignore JSON parse errors for partial data
            }
          }
        }
      }
    } catch (error) {
      if ((error as Error).name !== "AbortError") {
        console.error("Streaming error:", error);
      }
    } finally {
      setIsStreaming(false);
      setStreamContent("");
    }
  }, [isStreaming, streamingEndpoint]);

  // Stop streaming
  const stopStreaming = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  // Auto-stream on mount
  useEffect(() => {
    if (autoStream && insights.length === 0) {
      startStreaming();
    }

    return () => {
      stopStreaming();
    };
  }, [autoStream, insights.length, startStreaming, stopStreaming]);

  // Generate insights (non-streaming)
  const handleGenerateInsights = async () => {
    if (onGenerateInsights) {
      await onGenerateInsights();
    } else {
      await startStreaming();
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-primary/10">
            <Sparkles className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold">AI Insights</h3>
            <p className="text-xs text-muted-foreground">
              Knowledge graph patterns and discoveries
            </p>
          </div>
        </div>

        <Button
          variant={isStreaming ? "destructive" : "default"}
          size="sm"
          onClick={isStreaming ? stopStreaming : handleGenerateInsights}
          className="gap-2"
        >
          {isStreaming ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Stop
            </>
          ) : (
            <>
              <RefreshCw className="w-4 h-4" />
              Generate
            </>
          )}
        </Button>
      </div>

      {/* Streaming indicator */}
      {isStreaming && (
        <div className="p-3 rounded-lg border border-primary/30 bg-primary/5">
          <div className="flex items-center gap-2 text-sm">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="text-primary">
              Analyzing knowledge graph patterns...
            </span>
          </div>
        </div>
      )}

      {/* Insights list */}
      <ScrollArea className="h-[500px] pr-4">
        <div className="space-y-3">
          {/* Streaming content */}
          {streamContent && <StreamingInsightCard content={streamContent} />}

          {/* Completed insights */}
          {insights.map((insight) => (
            <InsightCard
              key={insight.id}
              insight={insight}
              isNew={newInsightIds.has(insight.id)}
            />
          ))}

          {/* Empty state */}
          {insights.length === 0 && !isStreaming && !streamContent && (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted/50 flex items-center justify-center">
                <Sparkles className="w-8 h-8 text-muted-foreground" />
              </div>
              <h4 className="font-medium mb-1">No insights yet</h4>
              <p className="text-sm text-muted-foreground mb-4">
                Generate AI-powered insights from the knowledge graph
              </p>
              <Button onClick={handleGenerateInsights} className="gap-2">
                <Sparkles className="w-4 h-4" />
                Generate Insights
              </Button>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* View more */}
      {insights.length > 0 && (
        <Button variant="ghost" className="w-full gap-1 text-muted-foreground">
          View all {insights.length} insights
          <ChevronRight className="w-4 h-4" />
        </Button>
      )}
    </div>
  );
}

// Pre-generated sample insights for demo
export const SAMPLE_INSIGHTS: Insight[] = [
  {
    id: "insight-1",
    title: "Agent Memory Convergence",
    content:
      "The repositories graphiti, mem0, and MemGPT are converging toward a unified agent memory architecture. GraphRAG patterns are emerging as the dominant approach for persistent agent state management.",
    type: "trend",
    confidence: 0.92,
    relatedRepos: ["graphiti", "mem0", "MemGPT", "cognee"],
    createdAt: new Date().toISOString(),
  },
  {
    id: "insight-2",
    title: "Temporal Knowledge Gap",
    content:
      "Temporal reasoning capabilities remain underrepresented in the current repository landscape. Only 2 repositories explicitly focus on temporal KGs, creating an opportunity for new tooling.",
    type: "discovery",
    confidence: 0.87,
    relatedRepos: ["graphiti", "pytorch_geometric_temporal"],
    createdAt: new Date().toISOString(),
  },
  {
    id: "insight-3",
    title: "Neuro-symbolic Integration",
    content:
      "TypeDB and KAG represent the leading edge of neuro-symbolic integration. Combining strong typing with LLM capabilities could accelerate formal reasoning in AI systems.",
    type: "recommendation",
    confidence: 0.85,
    relatedRepos: ["typedb", "KAG", "graphrag"],
    createdAt: new Date().toISOString(),
  },
  {
    id: "insight-4",
    title: "Python Ecosystem Dominance",
    content:
      "Python dominates the KG tooling landscape with 75% of repositories. This creates tight integration potential but limits performance at extreme scale without Rust/C++ bridges.",
    type: "warning",
    confidence: 0.94,
    relatedRepos: ["dgl", "pytorch_geometric", "pykeen"],
    createdAt: new Date().toISOString(),
  },
];
