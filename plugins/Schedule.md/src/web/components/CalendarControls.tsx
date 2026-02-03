/**
 * CalendarControls component - toggles and controls for Google Calendar overlay
 */

import React, { useState, useEffect, useCallback } from "react";
import { api } from "../lib/api";

interface CalendarInfo {
  id: string;
  summary: string;
  description?: string;
  backgroundColor?: string;
  primary: boolean;
}

interface CalendarControlsProps {
  showGoogleCalendar: boolean;
  onToggleGoogleCalendar: () => void;
  selectedCalendars: string[];
  onSelectedCalendarsChange: (ids: string[]) => void;
  enabledCalendars: string[];
}

export function CalendarControls({
  showGoogleCalendar,
  onToggleGoogleCalendar,
  selectedCalendars,
  onSelectedCalendarsChange,
  enabledCalendars,
}: CalendarControlsProps) {
  const [calendars, setCalendars] = useState<CalendarInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // Fetch calendars on mount
  useEffect(() => {
    loadCalendars();
  }, []);

  const loadCalendars = async () => {
    setLoading(true);
    setError(null);
    try {
      const cals = await api.listGoogleCalendars();
      setCalendars(cals);

      // Also get sync status
      const status = await api.getGoogleCalendarStatus();
      setLastSync(status.lastSync);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load calendars");
    } finally {
      setLoading(false);
    }
  };

  const handleSync = useCallback(async () => {
    setSyncing(true);
    try {
      await api.syncGoogleCalendar();
      const status = await api.getGoogleCalendarStatus();
      setLastSync(status.lastSync);
    } catch (err) {
      console.error("Sync failed:", err);
    } finally {
      setSyncing(false);
    }
  }, []);

  const handleCalendarToggle = useCallback(
    (calendarId: string) => {
      const isSelected = selectedCalendars.includes(calendarId);
      if (isSelected) {
        onSelectedCalendarsChange(
          selectedCalendars.filter((id) => id !== calendarId)
        );
      } else {
        onSelectedCalendarsChange([...selectedCalendars, calendarId]);
      }
    },
    [selectedCalendars, onSelectedCalendarsChange]
  );

  // Format relative time
  const formatLastSync = (isoString: string | null): string => {
    if (!isoString) return "Never";
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  };

  // Only show if we have enabled calendars configured
  if (enabledCalendars.length === 0) {
    return null;
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "12px",
        fontSize: "13px",
      }}
    >
      {/* Toggle Google Calendar visibility */}
      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          cursor: "pointer",
          userSelect: "none",
        }}
      >
        <input
          type="checkbox"
          checked={showGoogleCalendar}
          onChange={onToggleGoogleCalendar}
          style={{ cursor: "pointer" }}
        />
        <span style={{ color: "#374151" }}>Calendar</span>
      </label>

      {/* Calendar selector dropdown */}
      {showGoogleCalendar && calendars.length > 0 && (
        <div style={{ position: "relative" }}>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "4px",
              padding: "4px 8px",
              fontSize: "12px",
              backgroundColor: "#f3f4f6",
              border: "1px solid #d1d5db",
              borderRadius: "4px",
              cursor: "pointer",
              color: "#374151",
            }}
          >
            {selectedCalendars.length === 0
              ? "Select calendars"
              : `${selectedCalendars.length} calendar${selectedCalendars.length > 1 ? "s" : ""}`}
            <span style={{ fontSize: "10px" }}>
              {dropdownOpen ? "\u25B2" : "\u25BC"}
            </span>
          </button>

          {dropdownOpen && (
            <div
              style={{
                position: "absolute",
                top: "100%",
                left: 0,
                marginTop: "4px",
                minWidth: "200px",
                backgroundColor: "#fff",
                border: "1px solid #d1d5db",
                borderRadius: "4px",
                boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
                zIndex: 100,
              }}
            >
              {calendars
                .filter((cal) => enabledCalendars.includes(cal.id))
                .map((cal) => (
                  <label
                    key={cal.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      padding: "8px 12px",
                      cursor: "pointer",
                      borderBottom: "1px solid #f3f4f6",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = "#f9fafb";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = "#fff";
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedCalendars.includes(cal.id)}
                      onChange={() => handleCalendarToggle(cal.id)}
                      style={{ cursor: "pointer" }}
                    />
                    <span
                      style={{
                        width: "10px",
                        height: "10px",
                        borderRadius: "2px",
                        backgroundColor: cal.backgroundColor || "#4285f4",
                        flexShrink: 0,
                      }}
                    />
                    <span
                      style={{
                        fontSize: "12px",
                        color: "#374151",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {cal.summary}
                      {cal.primary && (
                        <span style={{ color: "#9ca3af", marginLeft: "4px" }}>
                          (Primary)
                        </span>
                      )}
                    </span>
                  </label>
                ))}
            </div>
          )}
        </div>
      )}

      {/* Sync button */}
      {showGoogleCalendar && (
        <button
          onClick={handleSync}
          disabled={syncing}
          title={`Last sync: ${formatLastSync(lastSync)}`}
          style={{
            padding: "4px 8px",
            fontSize: "12px",
            backgroundColor: syncing ? "#e5e7eb" : "#f3f4f6",
            border: "1px solid #d1d5db",
            borderRadius: "4px",
            cursor: syncing ? "not-allowed" : "pointer",
            color: "#374151",
          }}
        >
          {syncing ? "Syncing..." : "\u21BB"}
        </button>
      )}

      {/* Error indicator */}
      {error && (
        <span
          style={{ color: "#dc2626", fontSize: "11px" }}
          title={error}
        >
          Error
        </span>
      )}
    </div>
  );
}
