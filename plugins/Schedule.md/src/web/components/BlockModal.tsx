/**
 * BlockModal component - displays block details in a modal
 */

import React from "react";
import type { ScheduleBlock, ScheduleConfig } from "../../types";
import {
  formatTimeDisplay,
  capitalize,
  getDurationMinutes,
  formatDuration,
} from "../../utils/time";

interface BlockModalProps {
  block: ScheduleBlock;
  config: ScheduleConfig;
  onClose: () => void;
}

export function BlockModal({ block, config, onClose }: BlockModalProps) {
  const category = config.categories[block.category];
  const color = block.color || category?.color || "#6b7280";
  const duration = getDurationMinutes(block.startTime, block.endTime);

  return (
    <div
      className="modal-overlay"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
      }}
      onClick={onClose}
    >
      <div
        className="modal-content"
        style={{
          backgroundColor: "#fff",
          borderRadius: "8px",
          width: "400px",
          maxWidth: "90vw",
          maxHeight: "80vh",
          overflow: "auto",
          boxShadow: "0 20px 40px rgba(0,0,0,0.3)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with color bar */}
        <div
          style={{
            backgroundColor: color,
            padding: "16px 20px",
            color: "#fff",
          }}
        >
          <h2
            style={{
              fontSize: "18px",
              fontWeight: 600,
              margin: 0,
            }}
          >
            {block.title}
          </h2>
          <div
            style={{
              fontSize: "13px",
              opacity: 0.9,
              marginTop: "4px",
            }}
          >
            {capitalize(block.day)} {formatTimeDisplay(block.startTime)} -{" "}
            {formatTimeDisplay(block.endTime)}
          </div>
        </div>

        {/* Details */}
        <div style={{ padding: "16px 20px" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "100px 1fr",
              gap: "8px 12px",
              fontSize: "14px",
            }}
          >
            <div style={{ color: "#6b7280" }}>Category</div>
            <div style={{ fontWeight: 500 }}>
              {category?.label || block.category}
            </div>

            <div style={{ color: "#6b7280" }}>Duration</div>
            <div style={{ fontWeight: 500 }}>{formatDuration(duration)}</div>

            {block.location && (
              <>
                <div style={{ color: "#6b7280" }}>Location</div>
                <div style={{ fontWeight: 500 }}>{block.location}</div>
              </>
            )}

            <div style={{ color: "#6b7280" }}>Recurring</div>
            <div style={{ fontWeight: 500 }}>
              {block.recurring === "weekly" ? "Weekly" : "One-time"}
            </div>

            <div style={{ color: "#6b7280" }}>Source</div>
            <div style={{ fontWeight: 500 }}>{block.source}</div>

            {block.tags.length > 0 && (
              <>
                <div style={{ color: "#6b7280" }}>Tags</div>
                <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                  {block.tags.map((tag) => (
                    <span
                      key={tag}
                      style={{
                        backgroundColor: "#e5e7eb",
                        padding: "2px 8px",
                        borderRadius: "4px",
                        fontSize: "12px",
                      }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>

          {block.description && (
            <div style={{ marginTop: "16px" }}>
              <div
                style={{
                  color: "#6b7280",
                  fontSize: "12px",
                  marginBottom: "4px",
                }}
              >
                Description
              </div>
              <div style={{ fontSize: "14px", lineHeight: 1.5 }}>
                {block.description}
              </div>
            </div>
          )}

          {block.notes && (
            <div style={{ marginTop: "16px" }}>
              <div
                style={{
                  color: "#6b7280",
                  fontSize: "12px",
                  marginBottom: "4px",
                }}
              >
                Notes
              </div>
              <div
                style={{
                  fontSize: "14px",
                  lineHeight: 1.5,
                  backgroundColor: "#f9fafb",
                  padding: "8px 12px",
                  borderRadius: "4px",
                  whiteSpace: "pre-wrap",
                }}
              >
                {block.notes}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "12px 20px",
            borderTop: "1px solid #e5e7eb",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ fontSize: "11px", color: "#9ca3af" }}>
            ID: {block.id}
          </div>
          <button
            onClick={onClose}
            style={{
              padding: "6px 16px",
              backgroundColor: "#f3f4f6",
              border: "none",
              borderRadius: "4px",
              fontSize: "13px",
              cursor: "pointer",
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
