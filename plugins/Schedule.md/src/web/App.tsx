/**
 * Schedule.md - Main React Application
 */

import React, { useState, useEffect, useCallback, useMemo } from "react";
import type { ScheduleBlock, ScheduleConfig, ScheduleSummary } from "../types";
import { Header } from "./components/Header";
import { WeekView } from "./components/WeekView";
import { BlockModal } from "./components/BlockModal";
import { SettingsPanel } from "./components/SettingsPanel";
import { api, ws } from "./lib/api";
import { isDateInCurrentWeek } from "../utils/time";

// Load preferences from localStorage
const PREFS_KEY = "schedule-md:calendar-preferences";

interface CalendarPreferences {
  showGoogleCalendar: boolean;
  selectedCalendars: string[];
}

function loadPreferences(): CalendarPreferences {
  try {
    const stored = localStorage.getItem(PREFS_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    // Ignore parse errors
  }
  return { showGoogleCalendar: true, selectedCalendars: [] };
}

function savePreferences(prefs: CalendarPreferences): void {
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
}

export function App() {
  const [config, setConfig] = useState<ScheduleConfig | null>(null);
  const [blocks, setBlocks] = useState<ScheduleBlock[]>([]);
  const [summary, setSummary] = useState<ScheduleSummary | null>(null);
  const [selectedBlock, setSelectedBlock] = useState<ScheduleBlock | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Calendar visibility preferences
  const [showGoogleCalendar, setShowGoogleCalendar] = useState(() =>
    loadPreferences().showGoogleCalendar
  );
  const [selectedCalendars, setSelectedCalendars] = useState<string[]>(() =>
    loadPreferences().selectedCalendars
  );

  // Settings panel state
  const [settingsPanelOpen, setSettingsPanelOpen] = useState(false);

  // Load initial data
  const loadData = useCallback(async () => {
    try {
      setError(null);
      const [configData, blocksData, summaryData] = await Promise.all([
        api.getConfig(),
        api.listBlocks(),
        api.getSummary(),
      ]);
      setConfig(configData);
      setBlocks(blocksData);
      setSummary(summaryData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load schedule");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();

    // Connect WebSocket for real-time updates
    ws.connect();

    const unsubBlocks = ws.on("blocks-updated", () => {
      loadData();
    });

    const unsubConfig = ws.on("config-updated", () => {
      loadData();
    });

    const unsubReload = ws.on("reload", () => {
      window.location.reload();
    });

    return () => {
      unsubBlocks();
      unsubConfig();
      unsubReload();
      ws.disconnect();
    };
  }, [loadData]);

  // Handle block click
  const handleBlockClick = useCallback((block: ScheduleBlock) => {
    setSelectedBlock(block);
  }, []);

  // Close modal
  const handleCloseModal = useCallback(() => {
    setSelectedBlock(null);
  }, []);

  // Calendar toggle handlers
  const handleToggleGoogleCalendar = useCallback(() => {
    setShowGoogleCalendar((prev) => {
      const newValue = !prev;
      savePreferences({ showGoogleCalendar: newValue, selectedCalendars });
      return newValue;
    });
  }, [selectedCalendars]);

  const handleSelectedCalendarsChange = useCallback(
    (ids: string[]) => {
      setSelectedCalendars(ids);
      savePreferences({ showGoogleCalendar, selectedCalendars: ids });
    },
    [showGoogleCalendar]
  );

  // Filter blocks to current week (for layout stability)
  // This includes all blocks that COULD be displayed, regardless of calendar toggle
  const currentWeekBlocks = useMemo(() => {
    const weekStartsOn = config?.weekStartsOn || "monday";

    return blocks.filter((block) => {
      // Always include non-google-calendar blocks
      if (block.source !== "google-calendar") {
        return true;
      }

      // Filter Google Calendar events to current week only
      // This prevents duplicates from recurring events spanning multiple weeks
      if (block.eventDate && !isDateInCurrentWeek(block.eventDate, weekStartsOn)) {
        return false;
      }

      return true;
    });
  }, [blocks, config?.weekStartsOn]);

  // Determine which blocks are currently visible (affected by calendar toggle)
  const visibleBlockIds = useMemo(() => {
    const ids = new Set<string>();

    for (const block of currentWeekBlocks) {
      // Manual blocks are always visible
      if (block.source !== "google-calendar") {
        ids.add(block.id);
        continue;
      }

      // Google Calendar blocks depend on toggle state
      if (!showGoogleCalendar) {
        continue;
      }

      // If specific calendars are selected, check calendar ID
      if (selectedCalendars.length > 0) {
        if (block.calendarId && selectedCalendars.includes(block.calendarId)) {
          ids.add(block.id);
        }
        continue;
      }

      // Show all calendar blocks if no specific selection
      ids.add(block.id);
    }

    return ids;
  }, [currentWeekBlocks, showGoogleCalendar, selectedCalendars]);

  // Loading state
  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          fontSize: "16px",
          color: "#6b7280",
        }}
      >
        Loading schedule...
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          gap: "16px",
        }}
      >
        <div style={{ fontSize: "16px", color: "#dc2626" }}>{error}</div>
        <button
          onClick={loadData}
          style={{
            padding: "8px 16px",
            backgroundColor: "#3b82f6",
            color: "#fff",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        backgroundColor: "#f9fafb",
      }}
    >
      <Header
        config={config}
        summary={summary}
        onOpenSettings={() => setSettingsPanelOpen(true)}
      />

      <main style={{ flex: 1, overflow: "hidden", padding: "16px" }}>
        <div
          style={{
            height: "100%",
            backgroundColor: "#fff",
            borderRadius: "8px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
            overflow: "hidden",
          }}
        >
          {config && (
            <WeekView
              blocks={currentWeekBlocks}
              visibleBlockIds={visibleBlockIds}
              config={config}
              onBlockClick={handleBlockClick}
            />
          )}
        </div>
      </main>

      {/* Block details modal */}
      {selectedBlock && config && (
        <BlockModal
          block={selectedBlock}
          config={config}
          onClose={handleCloseModal}
        />
      )}

      {/* Settings panel */}
      <SettingsPanel
        isOpen={settingsPanelOpen}
        onClose={() => setSettingsPanelOpen(false)}
        showGoogleCalendar={showGoogleCalendar}
        onToggleGoogleCalendar={handleToggleGoogleCalendar}
        selectedCalendars={selectedCalendars}
        onSelectedCalendarsChange={handleSelectedCalendarsChange}
        enabledCalendars={
          (config?.integrations?.googleCalendar?.calendars || []).map(
            (c) => c.id
          )
        }
      />
    </div>
  );
}
