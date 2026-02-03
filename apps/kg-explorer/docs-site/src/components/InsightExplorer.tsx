import React, { useState } from "react";
import clsx from "clsx";

interface Insight {
  id: string;
  type: string;
  title: string;
  description: string;
  confidence: number;
}

const SAMPLE_INSIGHTS: Insight[] = [
  {
    id: "1",
    type: "cluster",
    title: "Attention Mechanism Cluster",
    description: "5 related concepts detected around attention mechanisms",
    confidence: 0.92,
  },
  {
    id: "2",
    type: "gap",
    title: "Missing Paper Reference",
    description: '"Attention Is All You Need" cited but no Paper node exists',
    confidence: 0.95,
  },
  {
    id: "3",
    type: "conflict",
    title: "Output Format Debate",
    description: "Speakers disagree on JSON vs structured outputs",
    confidence: 0.87,
  },
  {
    id: "4",
    type: "trend",
    title: "MCP Protocol Rising",
    description: "Model Context Protocol mentions increased 340%",
    confidence: 0.89,
  },
];

const TYPE_CONFIG: Record<string, { icon: string; color: string }> = {
  cluster: { icon: "O", color: "#7c3aed" },
  gap: { icon: "?", color: "#d97706" },
  conflict: { icon: "!", color: "#dc2626" },
  trend: { icon: "^", color: "#059669" },
};

export default function InsightExplorer({ className }: { className?: string }): JSX.Element {
  const [filter, setFilter] = useState("all");

  const filtered = filter === "all"
    ? SAMPLE_INSIGHTS
    : SAMPLE_INSIGHTS.filter((i) => i.type === filter);

  return (
    <div className={clsx("insight-explorer", className)}>
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem", flexWrap: "wrap" }}>
        <button
          onClick={() => setFilter("all")}
          style={{
            padding: "0.375rem 0.75rem",
            border: "1px solid var(--ifm-color-emphasis-300)",
            borderRadius: "9999px",
            fontSize: "0.75rem",
            cursor: "pointer",
            backgroundColor: filter === "all" ? "var(--ifm-color-primary)" : "transparent",
            color: filter === "all" ? "white" : "var(--ifm-color-emphasis-700)",
          }}
        >
          All ({SAMPLE_INSIGHTS.length})
        </button>
        {Object.entries(TYPE_CONFIG).map(([type, config]) => (
          <button
            key={type}
            onClick={() => setFilter(type)}
            style={{
              padding: "0.375rem 0.75rem",
              border: "1px solid var(--ifm-color-emphasis-300)",
              borderRadius: "9999px",
              fontSize: "0.75rem",
              cursor: "pointer",
              backgroundColor: filter === type ? config.color : "transparent",
              color: filter === type ? "white" : "var(--ifm-color-emphasis-700)",
            }}
          >
            {config.icon} {type}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        {filtered.map((insight) => {
          const config = TYPE_CONFIG[insight.type];
          return (
            <div
              key={insight.id}
              style={{
                padding: "1rem",
                border: "1px solid var(--ifm-color-emphasis-300)",
                borderRadius: "8px",
                borderLeft: `4px solid ${config.color}`,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <span style={{ fontSize: "0.75rem", fontWeight: 600, color: config.color }}>
                    {insight.type.toUpperCase()}
                  </span>
                  <h4 style={{ margin: "0.25rem 0", fontSize: "1rem" }}>{insight.title}</h4>
                  <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--ifm-color-emphasis-600)" }}>
                    {insight.description}
                  </p>
                </div>
                <span style={{ fontSize: "0.75rem", color: "var(--ifm-color-emphasis-500)" }}>
                  {Math.round(insight.confidence * 100)}%
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
