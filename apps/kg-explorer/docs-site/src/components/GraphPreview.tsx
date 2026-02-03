import React, { useEffect, useRef, useState } from "react";
import clsx from "clsx";

interface GraphNode {
  id: string;
  name: string;
  type: string;
  val?: number;
}

interface GraphLink {
  source: string;
  target: string;
  type: string;
}

interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

interface GraphPreviewProps {
  title?: string;
  description?: string;
  data?: GraphData;
  height?: number;
  className?: string;
}

const SAMPLE_DATA: GraphData = {
  nodes: [
    { id: "speaker1", name: "Dan Shipper", type: "Speaker", val: 10 },
    { id: "concept1", name: "AI Agents", type: "Concept", val: 8 },
    { id: "concept2", name: "Knowledge Graphs", type: "Concept", val: 7 },
    { id: "concept3", name: "RAG", type: "Concept", val: 6 },
    { id: "belief1", name: "Agents need guardrails", type: "Belief", val: 4 },
  ],
  links: [
    { source: "speaker1", target: "concept1", type: "DISCUSSES" },
    { source: "speaker1", target: "concept2", type: "DISCUSSES" },
    { source: "speaker1", target: "belief1", type: "BELIEVES" },
    { source: "concept1", target: "concept2", type: "RELATED_TO" },
    { source: "concept2", target: "concept3", type: "BUILDS_ON" },
  ],
};

const NODE_COLORS: Record<string, string> = {
  Speaker: "#4f46e5",
  Concept: "#059669",
  Belief: "#d97706",
  Technique: "#7c3aed",
};

export default function GraphPreview({
  title,
  description,
  data = SAMPLE_DATA,
  height = 400,
  className,
}: GraphPreviewProps): JSX.Element {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  return (
    <div className={clsx("graph-preview", className)}>
      {title && <h4 style={{ marginBottom: "0.5rem" }}>{title}</h4>}
      {description && (
        <p style={{ marginBottom: "1rem", color: "var(--ifm-color-emphasis-600)" }}>
          {description}
        </p>
      )}
      <div
        style={{
          height,
          backgroundColor: "var(--ifm-background-surface-color)",
          borderRadius: "8px",
          border: "1px solid var(--ifm-color-emphasis-300)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <p style={{ color: "var(--ifm-color-emphasis-500)" }}>
          {isClient ? "Interactive graph visualization (requires react-force-graph-2d)" : "Loading..."}
        </p>
      </div>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "1rem",
          marginTop: "0.75rem",
          fontSize: "0.875rem",
        }}
      >
        {Object.entries(NODE_COLORS).map(([type, color]) => (
          <div key={type} style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
            <div
              style={{
                width: "12px",
                height: "12px",
                borderRadius: "50%",
                backgroundColor: color,
              }}
            />
            <span style={{ color: "var(--ifm-color-emphasis-700)" }}>{type}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
