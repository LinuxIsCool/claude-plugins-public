/**
 * TimeBlock component - displays a single schedule block in the grid
 */

import React from "react";
import type { ScheduleBlock, ScheduleConfig } from "../../types";
import { timeToMinutes, formatTimeDisplay, getDurationMinutes, formatDuration } from "../../utils/time";

interface BlockLayout {
  column: number;
  totalColumns: number;
}

interface TimeBlockProps {
  block: ScheduleBlock;
  config: ScheduleConfig;
  dayStartHour: number;
  hourHeight: number;
  onClick?: (block: ScheduleBlock) => void;
  layout?: BlockLayout;
  hidden?: boolean;
}

export function TimeBlock({
  block,
  config,
  dayStartHour,
  hourHeight,
  onClick,
  layout,
  hidden,
}: TimeBlockProps) {
  // Calculate position and height
  const startMinutes = timeToMinutes(block.startTime);
  const endMinutes = timeToMinutes(block.endTime);
  const dayStartMinutes = dayStartHour * 60;

  const top = ((startMinutes - dayStartMinutes) / 60) * hourHeight;
  const height = ((endMinutes - startMinutes) / 60) * hourHeight;

  // Is this a Google Calendar event?
  const isCalendarEvent = block.source === "google-calendar";

  // Get color from category or block override (use original Google Calendar colors)
  const category = config.categories[block.category];
  const color = block.color || category?.color || "#6b7280";

  // Duration for tooltip
  const duration = getDurationMinutes(block.startTime, block.endTime);

  // Calculate horizontal position based on layout (for overlapping blocks)
  let leftStyle: string;
  let widthStyle: string;

  if (layout && layout.totalColumns > 1) {
    // Side-by-side layout: divide width by number of columns
    const columnWidth = 100 / layout.totalColumns;
    const gapPx = 2; // Small gap between columns
    leftStyle = `calc(${layout.column * columnWidth}% + ${gapPx}px)`;
    widthStyle = `calc(${columnWidth}% - ${gapPx * 2}px)`;
  } else {
    // Single column: use default margins
    leftStyle = "4px";
    widthStyle = "calc(100% - 8px)";
  }

  // Full opacity for all blocks - calendar events distinguished by dashed border
  const opacity = 1;

  return (
    <div
      className="time-block"
      style={{
        position: "absolute",
        top: `${top}px`,
        left: leftStyle,
        width: widthStyle,
        height: `${Math.max(height - 2, 20)}px`,
        backgroundColor: color,
        borderRadius: "4px",
        padding: "4px 6px",
        cursor: "pointer",
        overflow: "hidden",
        fontSize: "12px",
        color: "#fff",
        boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
        transition: "transform 0.1s, box-shadow 0.1s",
        opacity,
        // Dashed border for calendar events to make them visually distinct
        border: isCalendarEvent ? "1px dashed rgba(255,255,255,0.5)" : "none",
        boxSizing: "border-box",
        // Hidden blocks still occupy space for layout stability
        visibility: hidden ? "hidden" : "visible",
      }}
      onClick={() => onClick?.(block)}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "scale(1.02)";
        e.currentTarget.style.boxShadow = "0 4px 8px rgba(0,0,0,0.3)";
        e.currentTarget.style.zIndex = "10";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "scale(1)";
        e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.2)";
        e.currentTarget.style.zIndex = "1";
      }}
      title={`${block.title}\n${formatTimeDisplay(block.startTime)} - ${formatTimeDisplay(block.endTime)}\n${formatDuration(duration)}${block.location ? `\n${block.location}` : ""}`}
    >
      <div
        style={{
          fontWeight: 600,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {block.title}
      </div>
      {height > 40 && (
        <div
          style={{
            fontSize: "10px",
            opacity: 0.9,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {formatTimeDisplay(block.startTime)} - {formatTimeDisplay(block.endTime)}
        </div>
      )}
      {height > 60 && block.location && (
        <div
          style={{
            fontSize: "10px",
            opacity: 0.8,
            marginTop: "2px",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {block.location}
        </div>
      )}
    </div>
  );
}
