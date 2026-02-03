import React, { useState, useCallback } from "react";
import clsx from "clsx";

interface QueryPlaygroundProps {
  defaultQuery?: string;
  className?: string;
}

interface QueryResult {
  columns: string[];
  rows: unknown[][];
}

const SAMPLE_RESULTS: QueryResult = {
  columns: ["c.name", "c.summary"],
  rows: [
    ["AI Agents", "Autonomous systems that can perceive and act"],
    ["Knowledge Graphs", "Structured representations of information"],
    ["RAG", "Retrieval Augmented Generation technique"],
    ["Transformers", "Neural network architecture using attention"],
    ["Chain-of-Thought", "Prompting technique for step-by-step reasoning"],
  ],
};

export default function QueryPlayground({
  defaultQuery = `MATCH (c:Concept)
RETURN c.name, c.summary
LIMIT 5`,
  className,
}: QueryPlaygroundProps): JSX.Element {
  const [query, setQuery] = useState(defaultQuery);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const executeQuery = useCallback(async () => {
    setIsLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 500));
    setResult(SAMPLE_RESULTS);
    setIsLoading(false);
  }, []);

  return (
    <div className={clsx("query-playground", className)}>
      <div
        style={{
          border: "1px solid var(--ifm-color-emphasis-300)",
          borderRadius: "8px",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            backgroundColor: "var(--ifm-code-background)",
            padding: "0.75rem",
            borderBottom: "1px solid var(--ifm-color-emphasis-300)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
            <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--ifm-color-emphasis-700)" }}>
              Cypher Query
            </span>
            <span style={{ fontSize: "0.75rem", color: "var(--ifm-color-emphasis-500)" }}>
              Demo mode
            </span>
          </div>
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{
              width: "100%",
              minHeight: "100px",
              padding: "0.75rem",
              fontFamily: "var(--ifm-font-family-monospace)",
              fontSize: "0.875rem",
              backgroundColor: "var(--ifm-background-color)",
              color: "var(--ifm-font-color-base)",
              border: "1px solid var(--ifm-color-emphasis-300)",
              borderRadius: "4px",
              resize: "vertical",
            }}
          />
          <button
            onClick={executeQuery}
            disabled={isLoading}
            style={{
              marginTop: "0.5rem",
              padding: "0.5rem 1rem",
              backgroundColor: "var(--ifm-color-primary)",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: isLoading ? "not-allowed" : "pointer",
            }}
          >
            {isLoading ? "Executing..." : "Execute Query"}
          </button>
        </div>

        <div style={{ backgroundColor: "var(--ifm-background-surface-color)", minHeight: "150px" }}>
          {result ? (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
              <thead>
                <tr style={{ backgroundColor: "var(--ifm-color-emphasis-100)" }}>
                  {result.columns.map((col, i) => (
                    <th key={i} style={{ padding: "0.75rem", textAlign: "left", fontWeight: 600 }}>
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.rows.map((row, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid var(--ifm-color-emphasis-200)" }}>
                    {row.map((cell, j) => (
                      <td key={j} style={{ padding: "0.75rem" }}>{String(cell)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={{ padding: "2rem", textAlign: "center", color: "var(--ifm-color-emphasis-500)" }}>
              Click Execute to see results (demo data)
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
