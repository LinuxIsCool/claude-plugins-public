/**
 * WeekView component - displays the full weekly calendar grid
 */

import React, { useMemo } from "react";
import type { ScheduleBlock, ScheduleConfig, DayOfWeek } from "../../types";
import { DayColumn } from "./DayColumn";
import { getWeekDates } from "../../utils/time";

interface WeekViewProps {
  blocks: ScheduleBlock[];
  visibleBlockIds: Set<string>;
  config: ScheduleConfig;
  onBlockClick?: (block: ScheduleBlock) => void;
}

const DAYS: DayOfWeek[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

const HOUR_HEIGHT = 60; // pixels per hour

export function WeekView({ blocks, visibleBlockIds, config, onBlockClick }: WeekViewProps) {
  // Calculate dates for the current week
  const weekDates = useMemo(
    () => getWeekDates(config.weekStartsOn),
    [config.weekStartsOn]
  );
  const { dayStartHour, dayEndHour } = config;
  const totalHours = dayEndHour - dayStartHour;

  // Group blocks by day
  const blocksByDay: Record<DayOfWeek, ScheduleBlock[]> = {
    monday: [],
    tuesday: [],
    wednesday: [],
    thursday: [],
    friday: [],
    saturday: [],
    sunday: [],
  };

  for (const block of blocks) {
    blocksByDay[block.day].push(block);
  }

  // Generate hour labels
  const hourLabels = [];
  for (let hour = dayStartHour; hour < dayEndHour; hour++) {
    const displayHour = hour % 12 || 12;
    const period = hour >= 12 ? "PM" : "AM";
    hourLabels.push(
      <div
        key={hour}
        style={{
          height: `${HOUR_HEIGHT}px`,
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "flex-end",
          paddingRight: "8px",
          paddingTop: "2px",
          fontSize: "11px",
          color: "#6b7280",
          borderBottom: "1px solid transparent",
        }}
      >
        {displayHour} {period}
      </div>
    );
  }

  return (
    <div
      className="week-view"
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflow: "hidden",
      }}
    >
      {/* Scrollable content */}
      <div
        style={{
          flex: 1,
          display: "flex",
          overflow: "auto",
        }}
      >
        {/* Time labels column */}
        <div
          style={{
            width: "60px",
            flexShrink: 0,
            borderRight: "1px solid #e5e7eb",
            backgroundColor: "#f9fafb",
          }}
        >
          {/* Header spacer */}
          <div
            style={{
              position: "sticky",
              top: 0,
              height: "37px",
              backgroundColor: "#f9fafb",
              borderBottom: "1px solid #e5e7eb",
              zIndex: 5,
            }}
          />
          {/* Hour labels */}
          <div>{hourLabels}</div>
        </div>

        {/* Day columns */}
        {DAYS.map((day) => (
          <DayColumn
            key={day}
            day={day}
            date={weekDates.get(day)}
            blocks={blocksByDay[day]}
            visibleBlockIds={visibleBlockIds}
            config={config}
            hourHeight={HOUR_HEIGHT}
            onBlockClick={onBlockClick}
          />
        ))}
      </div>
    </div>
  );
}
