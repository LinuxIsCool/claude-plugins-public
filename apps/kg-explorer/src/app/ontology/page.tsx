"use client";

import { useState, useMemo } from "react";
import { Network, ZoomIn, ZoomOut, Maximize2, Info, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GraphVisualization, generateOntologyGraph } from "@/components/kg";
import { repositories, TIERS, IMPACTS, FRONTIERS } from "@/data/repositories";
import type { OntologyNode } from "@/lib/types";

export default function OntologyPage() {
  const [selectedNode, setSelectedNode] = useState<OntologyNode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<OntologyNode | null>(null);
  const [activeView, setActiveView] = useState<"full" | "tiers" | "impact" | "frontiers">("full");

  // Generate different graph views
  const graphs = useMemo(() => {
    return {
      full: generateOntologyGraph(repositories),
      tiers: generateOntologyGraph(
        repositories.map((r) => ({
          ...r,
          singularityImpact: undefined,
          researchFrontier: undefined,
        }))
      ),
      impact: generateOntologyGraph(
        repositories
          .filter((r) => r.singularityImpact)
          .map((r) => ({
            ...r,
            tier: "", // Don't show tier connections
            researchFrontier: undefined,
          }))
      ),
      frontiers: generateOntologyGraph(
        repositories
          .filter((r) => r.researchFrontier)
          .map((r) => ({
            ...r,
            tier: "",
            singularityImpact: undefined,
          }))
      ),
    };
  }, []);

  const currentGraph = graphs[activeView];

  // Get details for selected node
  const selectedDetails = useMemo(() => {
    if (!selectedNode) return null;

    if (selectedNode.type === "repository") {
      return repositories.find((r) => r.id === selectedNode.id);
    }

    if (selectedNode.type === "tier") {
      const tierName = TIERS.find((t) =>
        t.toLowerCase().includes(selectedNode.label.toLowerCase().replace("tier ", ""))
      );
      if (tierName) {
        return {
          type: "tier",
          name: tierName,
          repos: repositories.filter((r) => r.tier === tierName),
        };
      }
    }

    if (selectedNode.type === "impact") {
      return {
        type: "impact",
        name: selectedNode.label,
        repos: repositories.filter(
          (r) => r.singularityImpact === selectedNode.label
        ),
      };
    }

    if (selectedNode.type === "frontier") {
      return {
        type: "frontier",
        name: selectedNode.label,
        repos: repositories.filter(
          (r) => r.researchFrontier === selectedNode.label
        ),
      };
    }

    return null;
  }, [selectedNode]);

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Network className="w-8 h-8 text-primary" />
            Ontology Visualization
          </h1>
          <p className="text-muted-foreground">
            Interactive force-directed graph of the knowledge graph repository ecosystem
          </p>
        </div>
      </div>

      {/* View tabs */}
      <Tabs value={activeView} onValueChange={(v) => setActiveView(v as typeof activeView)}>
        <TabsList className="grid w-full grid-cols-4 max-w-md">
          <TabsTrigger value="full">Full Graph</TabsTrigger>
          <TabsTrigger value="tiers">By Tier</TabsTrigger>
          <TabsTrigger value="impact">By Impact</TabsTrigger>
          <TabsTrigger value="frontiers">Frontiers</TabsTrigger>
        </TabsList>

        <TabsContent value={activeView} className="mt-4">
          <div className="grid lg:grid-cols-4 gap-6">
            {/* Graph visualization */}
            <div className="lg:col-span-3">
              <Card className="overflow-hidden">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">
                      {activeView === "full" && "Complete Repository Ontology"}
                      {activeView === "tiers" && "Tier-based Organization"}
                      {activeView === "impact" && "Singularity Impact Clusters"}
                      {activeView === "frontiers" && "Research Frontier Groups"}
                    </CardTitle>
                    <div className="flex items-center gap-1">
                      <Badge variant="outline">
                        {currentGraph.nodes.length} nodes
                      </Badge>
                      <Badge variant="outline">
                        {currentGraph.edges.length} edges
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <GraphVisualization
                    graph={currentGraph}
                    height={600}
                    onNodeClick={setSelectedNode}
                    onNodeHover={setHoveredNode}
                  />
                </CardContent>
              </Card>
            </div>

            {/* Details panel */}
            <div className="space-y-4">
              {/* Hovered node info */}
              {hoveredNode && (
                <Card className="border-primary/30 bg-primary/5">
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Info className="w-4 h-4 text-primary" />
                      <span className="text-sm font-medium">Hovering</span>
                    </div>
                    <p className="font-semibold">{hoveredNode.label}</p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {hoveredNode.type}
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Selected node details */}
              {selectedNode && selectedDetails ? (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center justify-between">
                      <span>Selected: {selectedNode.label}</span>
                      <Badge variant="outline" className="capitalize">
                        {selectedNode.type}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {"description" in selectedDetails ? (
                      // Repository details
                      <>
                        <p className="text-sm">{selectedDetails.description}</p>
                        <div className="p-2 bg-muted/50 rounded text-xs">
                          <strong>Singularity Relevance:</strong>
                          <br />
                          {selectedDetails.singularityRelevance}
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {selectedDetails.singularityImpact && (
                            <Badge variant="secondary">
                              {selectedDetails.singularityImpact}
                            </Badge>
                          )}
                          {selectedDetails.language && (
                            <Badge variant="outline">
                              {selectedDetails.language}
                            </Badge>
                          )}
                        </div>
                        <a
                          href={selectedDetails.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-sm text-primary hover:underline"
                        >
                          <ExternalLink className="w-3 h-3" />
                          View on GitHub
                        </a>
                      </>
                    ) : (
                      // Category details (tier, impact, frontier)
                      <>
                        <p className="text-sm font-medium">
                          {selectedDetails.name}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {selectedDetails.repos.length} repositories
                        </p>
                        <div className="max-h-48 overflow-auto space-y-1">
                          {selectedDetails.repos.slice(0, 10).map((repo) => (
                            <div
                              key={repo.id}
                              className="text-xs p-2 rounded bg-muted/30 hover:bg-muted/50"
                            >
                              {repo.name}
                            </div>
                          ))}
                          {selectedDetails.repos.length > 10 && (
                            <div className="text-xs text-muted-foreground text-center">
                              +{selectedDetails.repos.length - 10} more
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="pt-6 text-center text-muted-foreground">
                    <Network className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">
                      Click on a node to view details
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Graph statistics */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Graph Statistics</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Repositories</span>
                    <span>{currentGraph.nodes.filter((n) => n.type === "repository").length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tiers</span>
                    <span>{currentGraph.nodes.filter((n) => n.type === "tier").length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Impact Levels</span>
                    <span>{currentGraph.nodes.filter((n) => n.type === "impact").length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Frontiers</span>
                    <span>{currentGraph.nodes.filter((n) => n.type === "frontier").length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Connections</span>
                    <span>{currentGraph.edges.length}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Quick filters */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Quick Navigation</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-xs text-muted-foreground mb-2">
                    Click to focus on category
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {IMPACTS.map((impact) => (
                      <Badge
                        key={impact}
                        variant="outline"
                        className="cursor-pointer hover:bg-primary/20"
                        onClick={() =>
                          setSelectedNode({
                            id: `impact-${impact.toLowerCase()}`,
                            label: impact,
                            type: "impact",
                          })
                        }
                      >
                        {impact}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
