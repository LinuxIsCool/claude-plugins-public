/**
 * Header component for Schedule.md
 */

import React from "react";
import type { ScheduleConfig, ScheduleSummary } from "../../types";

interface HeaderProps {
  config: ScheduleConfig | null;
  summary: ScheduleSummary | null;
  onOpenSettings: () => void;
}

export function Header({
  config,
  summary,
  onOpenSettings,
}: HeaderProps) {
  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "12px 20px",
        backgroundColor: "#fff",
        borderBottom: "1px solid #e5e7eb",
        boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
      }}
    >
      {/* Title */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <h1
          style={{
            fontSize: "20px",
            fontWeight: 700,
            color: "#111827",
            margin: 0,
          }}
        >
          {config?.projectName || "Schedule.md"}
        </h1>
      </div>

      {/* Stats + Settings */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "24px",
        }}
      >
        {/* Stats */}
        {summary && (
          <div
            style={{
              display: "flex",
              gap: "20px",
              fontSize: "13px",
              color: "#6b7280",
            }}
          >
            <div>
              <span style={{ fontWeight: 600, color: "#374151" }}>
                {summary.totalBlocks}
              </span>{" "}
              blocks
            </div>
            <div>
              <span style={{ fontWeight: 600, color: "#374151" }}>
                {summary.totalHours.toFixed(1)}
              </span>{" "}
              hours/week
            </div>
          </div>
        )}

        {/* Settings button */}
        <button
          onClick={onOpenSettings}
          title="Settings"
          style={{
            background: "none",
            border: "1px solid #e5e7eb",
            borderRadius: "6px",
            padding: "6px 10px",
            cursor: "pointer",
            color: "#6b7280",
            fontSize: "16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          ⚙
        </button>
      </div>

      {/* Legend - sorted by hours descending */}
      {config && summary && (
        <div
          style={{
            display: "flex",
            gap: "14px",
            fontSize: "11px",
          }}
        >
          {Object.entries(config.categories)
            .map(([id, category]) => ({
              id,
              category,
              hours: summary.hoursByCategory[id] || 0,
            }))
            .filter((item) => item.hours > 0)
            .sort((a, b) => b.hours - a.hours)
            .map(({ id, category, hours }) => (
              <div
                key={id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                <div
                  style={{
                    width: "12px",
                    height: "12px",
                    borderRadius: "2px",
                    backgroundColor: category.color,
                  }}
                />
                <span style={{ color: "#6b7280" }}>
                  {category.label}{" "}
                  <span style={{ fontWeight: 600, color: "#374151" }}>
                    {hours.toFixed(1)}h
                  </span>
                </span>
              </div>
            ))}
        </div>
      )}
    </header>
  );
}
