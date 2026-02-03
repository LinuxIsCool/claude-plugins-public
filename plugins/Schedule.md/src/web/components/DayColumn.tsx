/**
 * DayColumn component - displays a single day in the weekly grid
 */

import React, { useMemo } from "react";
import type { ScheduleBlock, ScheduleConfig, DayOfWeek } from "../../types";
import { TimeBlock } from "./TimeBlock";
import { capitalize, formatDateShort } from "../../utils/time";
import { calculateBlockLayouts } from "../utils/overlap";

interface DayColumnProps {
  day: DayOfWeek;
  date?: Date;
  blocks: ScheduleBlock[];
  visibleBlockIds: Set<string>;
  config: ScheduleConfig;
  hourHeight: number;
  onBlockClick?: (block: ScheduleBlock) => void;
}

export function DayColumn({
  day,
  date,
  blocks,
  visibleBlockIds,
  config,
  hourHeight,
  onBlockClick,
}: DayColumnProps) {
  const { dayStartHour, dayEndHour } = config;
  const totalHours = dayEndHour - dayStartHour;
  const columnHeight = totalHours * hourHeight;

  // Generate hour grid lines
  const hourLines = [];
  for (let i = 0; i <= totalHours; i++) {
    hourLines.push(
      <div
        key={i}
        style={{
          position: "absolute",
          top: `${i * hourHeight}px`,
          left: 0,
          right: 0,
          height: "1px",
          backgroundColor: i === 0 ? "transparent" : "#e5e7eb",
        }}
      />
    );
  }

  // Check if today
  const today = new Date();
  const dayIndex = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const isToday = dayIndex[today.getDay()] === day;

  // Current time indicator
  const [currentTime, setCurrentTime] = React.useState(new Date());
  React.useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 60000); // Update every minute
    return () => clearInterval(interval);
  }, []);

  const currentHour = currentTime.getHours();
  const currentMinute = currentTime.getMinutes();
  const currentTimePosition = ((currentHour - dayStartHour) + currentMinute / 60) * hourHeight;
  const showTimeLine = isToday && currentHour >= dayStartHour && currentHour < dayEndHour;

  return (
    <div
      className="day-column"
      style={{
        flex: 1,
        minWidth: "120px",
        borderRight: "1px solid #e5e7eb",
        position: "relative",
      }}
    >
      {/* Day header */}
      <div
        style={{
          position: "sticky",
          top: 0,
          backgroundColor: isToday ? "#dbeafe" : "#f9fafb",
          borderBottom: "1px solid #e5e7eb",
          padding: "6px 8px",
          textAlign: "center",
          zIndex: 5,
        }}
      >
        <div
          style={{
            fontWeight: 600,
            fontSize: "14px",
            color: isToday ? "#1d4ed8" : "#374151",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "4px",
          }}
        >
          {capitalize(day)}
          {isToday && (
            <span
              style={{
                display: "inline-block",
                width: "6px",
                height: "6px",
                backgroundColor: "#1d4ed8",
                borderRadius: "50%",
              }}
            />
          )}
        </div>
        {date && (
          <div
            style={{
              fontSize: "11px",
              color: isToday ? "#3b82f6" : "#9ca3af",
              marginTop: "2px",
            }}
          >
            {formatDateShort(date)}
          </div>
        )}
      </div>

      {/* Time grid */}
      <div
        style={{
          position: "relative",
          height: `${columnHeight}px`,
          backgroundColor: isToday ? "#f0f9ff" : "#fff",
        }}
      >
        {hourLines}

        {/* Current time indicator */}
        {showTimeLine && (
          <div
            style={{
              position: "absolute",
              top: `${currentTimePosition}px`,
              left: 0,
              right: 0,
              height: "2px",
              backgroundColor: "#ef4444",
              zIndex: 20,
              pointerEvents: "none",
            }}
          >
            <div
              style={{
                position: "absolute",
                left: "-5px",
                top: "-4px",
                width: "10px",
                height: "10px",
                backgroundColor: "#ef4444",
                borderRadius: "50%",
              }}
            />
          </div>
        )}

        {/* Blocks with overlap layout */}
        {useMemo(() => {
          const layouts = calculateBlockLayouts(blocks);
          return layouts.map(({ block, column, totalColumns }) => (
            <TimeBlock
              key={block.id}
              block={block}
              config={config}
              dayStartHour={dayStartHour}
              hourHeight={hourHeight}
              onClick={onBlockClick}
              layout={{ column, totalColumns }}
              hidden={!visibleBlockIds.has(block.id)}
            />
          ));
        }, [blocks, config, dayStartHour, hourHeight, onBlockClick, visibleBlockIds])}
      </div>
    </div>
  );
}
