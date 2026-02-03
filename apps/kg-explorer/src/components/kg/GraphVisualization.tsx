"use client";

import { useRef, useCallback, useMemo, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import type { OntologyGraph, OntologyNode, OntologyEdge } from "@/lib/types";

// Dynamic import to avoid SSR issues with canvas
const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-background/50">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-muted-foreground">Loading graph visualization...</p>
      </div>
    </div>
  ),
});

interface GraphVisualizationProps {
  graph: OntologyGraph;
  onNodeClick?: (node: OntologyNode) => void;
  onNodeHover?: (node: OntologyNode | null) => void;
  height?: number;
  width?: number;
}

// Color mapping for node types
const NODE_COLORS: Record<string, string> = {
  concept: "#a855f7", // Purple - primary
  tier: "#ec4899", // Pink - accent
  repository: "#22d3ee", // Cyan - aurora
  impact: "#f59e0b", // Amber - stellar
  frontier: "#10b981", // Emerald
};

const NODE_SIZES: Record<string, number> = {
  concept: 12,
  tier: 10,
  repository: 6,
  impact: 8,
  frontier: 8,
};

export function GraphVisualization({
  graph,
  onNodeClick,
  onNodeHover,
  height = 600,
  width,
}: GraphVisualizationProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const fgRef = useRef<{ d3Force: (name: string) => unknown }>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height });
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  // Handle responsive sizing
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: width || containerRef.current.clientWidth,
          height: height,
        });
      }
    };

    updateDimensions();
    window.addEventListener("resize", updateDimensions);
    return () => window.removeEventListener("resize", updateDimensions);
  }, [width, height]);

  // Configure forces
  useEffect(() => {
    if (fgRef.current) {
      const fg = fgRef.current as { d3Force: (name: string) => { strength?: (n: number) => unknown; distance?: (n: number) => unknown } };
      fg.d3Force("charge")?.strength?.(-100);
      fg.d3Force("link")?.distance?.(80);
    }
  }, []);

  // Transform data for the graph
  const graphData = useMemo(() => {
    const nodes = graph.nodes.map((node) => ({
      id: node.id,
      label: node.label,
      type: node.type,
      color: node.color || NODE_COLORS[node.type] || "#888",
      size: node.size || NODE_SIZES[node.type] || 6,
      metadata: node.metadata,
    }));

    const links = graph.edges.map((edge) => ({
      source: edge.source,
      target: edge.target,
      label: edge.label,
      weight: edge.weight || 1,
    }));

    return { nodes, links };
  }, [graph]);

  // Define types for the force graph
  type GraphNode = {
    id: string;
    label: string;
    color: string;
    size: number;
    type: string;
    metadata?: Record<string, unknown>;
    x?: number;
    y?: number;
  };

  type GraphLink = {
    source: string | GraphNode;
    target: string | GraphNode;
    label?: string;
    weight?: number;
    color?: string;
  };

  // Node rendering - cast input to handle react-force-graph-2d's generic types
  const nodeCanvasObject = useCallback(
    (
      nodeRaw: unknown,
      ctx: CanvasRenderingContext2D,
      globalScale: number
    ) => {
      const node = nodeRaw as GraphNode;
      const label = node.label;
      const fontSize = Math.max(10 / globalScale, 3);
      const nodeSize = node.size;
      const isHovered = hoveredNode === node.id;

      // Draw glow effect for hovered nodes
      if (isHovered) {
        ctx.beginPath();
        ctx.arc(node.x || 0, node.y || 0, nodeSize + 4, 0, 2 * Math.PI);
        ctx.fillStyle = `${node.color}40`;
        ctx.fill();
      }

      // Draw node
      ctx.beginPath();
      ctx.arc(node.x || 0, node.y || 0, nodeSize, 0, 2 * Math.PI);
      ctx.fillStyle = node.color;
      ctx.fill();

      // Draw border
      ctx.strokeStyle = isHovered ? "#fff" : `${node.color}80`;
      ctx.lineWidth = isHovered ? 2 / globalScale : 1 / globalScale;
      ctx.stroke();

      // Draw label (only if zoomed in enough or hovered)
      if (globalScale > 0.5 || isHovered) {
        ctx.font = `${isHovered ? "bold " : ""}${fontSize}px Inter, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillStyle = isHovered ? "#fff" : "rgba(255, 255, 255, 0.8)";
        ctx.fillText(label, node.x || 0, (node.y || 0) + nodeSize + 2);
      }
    },
    [hoveredNode]
  );

  // Link rendering - resolved links have source/target as objects with x,y
  const linkCanvasObject = useCallback(
    (
      linkRaw: unknown,
      ctx: CanvasRenderingContext2D
    ) => {
      // Force graph resolves links so source/target become node objects
      const link = linkRaw as { source: unknown; target: unknown; color?: string };
      const start = link.source as { x: number; y: number };
      const end = link.target as { x: number; y: number };
      if (!start?.x || !end?.x) return; // Skip if not yet resolved

      // Create gradient
      const gradient = ctx.createLinearGradient(
        start.x,
        start.y,
        end.x,
        end.y
      );
      gradient.addColorStop(0, "rgba(168, 85, 247, 0.4)");
      gradient.addColorStop(0.5, "rgba(236, 72, 153, 0.3)");
      gradient.addColorStop(1, "rgba(34, 211, 238, 0.4)");

      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.strokeStyle = gradient;
      ctx.lineWidth = 1;
      ctx.stroke();
    },
    []
  );

  const handleNodeClick = useCallback(
    (nodeRaw: unknown) => {
      const node = nodeRaw as GraphNode;
      if (onNodeClick && node) {
        onNodeClick({
          id: node.id,
          label: node.label,
          type: node.type as OntologyNode["type"],
          metadata: node.metadata,
        });
      }
    },
    [onNodeClick]
  );

  const handleNodeHover = useCallback(
    (nodeRaw: unknown) => {
      const node = nodeRaw as GraphNode | null;
      setHoveredNode(node?.id || null);
      if (onNodeHover) {
        onNodeHover(
          node
            ? {
                id: node.id,
                label: node.label,
                type: node.type as OntologyNode["type"],
                metadata: node.metadata,
              }
            : null
        );
      }
    },
    [onNodeHover]
  );

  return (
    <div
      ref={containerRef}
      className="relative w-full rounded-lg overflow-hidden bg-cosmos-gradient"
      style={{ height }}
    >
      {/* Starfield overlay */}
      <div className="absolute inset-0 starfield opacity-30 pointer-events-none" />

      {/* Nebula glow effects */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-nebula-glow opacity-50 pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-stellar-burst opacity-40 pointer-events-none" />

      <ForceGraph2D
        ref={fgRef as React.RefObject<never>}
        graphData={graphData}
        width={dimensions.width}
        height={dimensions.height}
        nodeCanvasObject={nodeCanvasObject}
        linkCanvasObject={linkCanvasObject}
        onNodeClick={handleNodeClick}
        onNodeHover={handleNodeHover}
        nodeRelSize={6}
        linkDirectionalParticles={2}
        linkDirectionalParticleSpeed={0.005}
        linkDirectionalParticleWidth={2}
        d3AlphaDecay={0.02}
        d3VelocityDecay={0.3}
        cooldownTicks={100}
        backgroundColor="transparent"
        enableNodeDrag={true}
        enableZoomInteraction={true}
        enablePanInteraction={true}
      />

      {/* Legend */}
      <div className="absolute bottom-4 left-4 p-3 bg-card/80 backdrop-blur-sm rounded-lg border border-border">
        <p className="text-xs font-medium text-muted-foreground mb-2">Node Types</p>
        <div className="flex flex-wrap gap-3">
          {Object.entries(NODE_COLORS).map(([type, color]) => (
            <div key={type} className="flex items-center gap-1.5">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: color }}
              />
              <span className="text-xs capitalize">{type}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Controls hint */}
      <div className="absolute top-4 right-4 p-2 bg-card/60 backdrop-blur-sm rounded text-xs text-muted-foreground">
        Scroll to zoom | Drag to pan | Click nodes to explore
      </div>
    </div>
  );
}

// Helper to generate ontology graph from repository data
export function generateOntologyGraph(
  repositories: Array<{
    id: string;
    name: string;
    tier: string;
    singularityImpact?: string;
    researchFrontier?: string;
  }>
): OntologyGraph {
  const nodes: OntologyNode[] = [];
  const edges: OntologyEdge[] = [];
  const tierSet = new Set<string>();
  const impactSet = new Set<string>();
  const frontierSet = new Set<string>();

  // Central concept node
  nodes.push({
    id: "knowledge-graphs",
    label: "Knowledge Graphs",
    type: "concept",
    size: 20,
  });

  // Add repository nodes and collect relationships
  for (const repo of repositories) {
    // Add repository node
    nodes.push({
      id: repo.id,
      label: repo.name,
      type: "repository",
    });

    // Track tier
    tierSet.add(repo.tier);

    // Track impact
    if (repo.singularityImpact) {
      impactSet.add(repo.singularityImpact);
    }

    // Track frontier
    if (repo.researchFrontier) {
      frontierSet.add(repo.researchFrontier);
    }
  }

  // Add tier nodes
  for (const tier of tierSet) {
    const tierId = `tier-${tier.replace(/\s+/g, "-").toLowerCase()}`;
    nodes.push({
      id: tierId,
      label: tier.split(":")[0],
      type: "tier",
    });

    // Connect to central concept
    edges.push({
      id: `kg-${tierId}`,
      source: "knowledge-graphs",
      target: tierId,
    });

    // Connect repositories to their tier
    for (const repo of repositories.filter((r) => r.tier === tier)) {
      edges.push({
        id: `${tierId}-${repo.id}`,
        source: tierId,
        target: repo.id,
      });
    }
  }

  // Add impact nodes
  for (const impact of impactSet) {
    const impactId = `impact-${impact.toLowerCase()}`;
    nodes.push({
      id: impactId,
      label: impact,
      type: "impact",
    });

    // Connect to central concept
    edges.push({
      id: `kg-${impactId}`,
      source: "knowledge-graphs",
      target: impactId,
    });

    // Connect repositories to their impact level
    for (const repo of repositories.filter(
      (r) => r.singularityImpact === impact
    )) {
      edges.push({
        id: `${impactId}-${repo.id}`,
        source: impactId,
        target: repo.id,
      });
    }
  }

  // Add frontier nodes
  for (const frontier of frontierSet) {
    const frontierId = `frontier-${frontier.replace(/\s+/g, "-").toLowerCase()}`;
    nodes.push({
      id: frontierId,
      label: frontier,
      type: "frontier",
    });

    // Connect repositories to their frontier
    for (const repo of repositories.filter(
      (r) => r.researchFrontier === frontier
    )) {
      edges.push({
        id: `${frontierId}-${repo.id}`,
        source: frontierId,
        target: repo.id,
      });
    }
  }

  return { nodes, edges };
}
