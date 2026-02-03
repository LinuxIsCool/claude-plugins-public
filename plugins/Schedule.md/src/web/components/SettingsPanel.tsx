/**
 * SettingsPanel component - slide-in panel for configuration options
 */

import React, { useState, useEffect, useCallback } from "react";
import { api } from "../lib/api";

interface CalendarInfo {
  id: string;
  summary: string;
  description?: string;
  backgroundColor?: string;
  primary: boolean;
  selected: boolean;
}

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  showGoogleCalendar: boolean;
  onToggleGoogleCalendar: () => void;
  selectedCalendars: string[];
  onSelectedCalendarsChange: (ids: string[]) => void;
  enabledCalendars: string[];
}

export function SettingsPanel({
  isOpen,
  onClose,
  showGoogleCalendar,
  onToggleGoogleCalendar,
  selectedCalendars,
  onSelectedCalendarsChange,
  enabledCalendars,
}: SettingsPanelProps) {
  const [calendars, setCalendars] = useState<CalendarInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);

  // Fetch calendars when panel opens (always, not just when enabled)
  useEffect(() => {
    if (isOpen) {
      loadCalendars();
    }
  }, [isOpen]);

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
    setError(null);
    try {
      await api.syncGoogleCalendar();
      const status = await api.getGoogleCalendarStatus();
      setLastSync(status.lastSync);
      // Reload calendars to show any changes
      await loadCalendars();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Sync failed";
      setError(errorMsg);
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

  // Auto-setup handler - fetches all calendars from Google and enables selected ones
  const handleAutoSetup = useCallback(async () => {
    setSyncing(true);
    setError(null);
    try {
      const result = await api.autoSetupGoogleCalendar();
      if (result.success) {
        // Reload the page to pick up new config
        window.location.reload();
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Auto-setup failed";
      setError(errorMsg);
      console.error("Auto-setup failed:", err);
    } finally {
      setSyncing(false);
    }
  }, []);

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

  // Show all calendars from Google, indicate which are enabled
  const displayCalendars = calendars;

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.3)",
            zIndex: 40,
          }}
          onClick={onClose}
        />
      )}

      {/* Panel */}
      <div
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          width: "320px",
          backgroundColor: "#fff",
          boxShadow: "-4px 0 16px rgba(0, 0, 0, 0.1)",
          transform: isOpen ? "translateX(0)" : "translateX(100%)",
          transition: "transform 0.3s ease-in-out",
          zIndex: 50,
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 20px",
            borderBottom: "1px solid #e5e7eb",
          }}
        >
          <h2
            style={{
              fontSize: "18px",
              fontWeight: 600,
              color: "#111827",
              margin: 0,
            }}
          >
            Settings
          </h2>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              fontSize: "20px",
              cursor: "pointer",
              color: "#6b7280",
              padding: "4px",
              lineHeight: 1,
            }}
            title="Close"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div
          style={{
            flex: 1,
            overflow: "auto",
            padding: "20px",
          }}
        >
          {/* Google Calendar Section */}
          <section>
              <h3
                style={{
                  fontSize: "12px",
                  fontWeight: 600,
                  color: "#6b7280",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  marginBottom: "12px",
                }}
              >
                Google Calendar
              </h3>

              {/* Master toggle */}
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  cursor: "pointer",
                  padding: "8px 0",
                }}
              >
                <input
                  type="checkbox"
                  checked={showGoogleCalendar}
                  onChange={onToggleGoogleCalendar}
                  style={{ cursor: "pointer", width: "16px", height: "16px" }}
                />
                <span style={{ fontSize: "14px", color: "#374151" }}>
                  Show Calendar Events
                </span>
              </label>

              {/* Calendar list */}
              {showGoogleCalendar && (
                <div
                  style={{
                    marginTop: "12px",
                    marginLeft: "26px",
                    borderLeft: "2px solid #e5e7eb",
                    paddingLeft: "12px",
                  }}
                >
                  {loading && (
                    <div style={{ fontSize: "13px", color: "#6b7280" }}>
                      Loading calendars...
                    </div>
                  )}

                  {error && (
                    <div style={{ fontSize: "13px", color: "#dc2626" }}>
                      {error}
                    </div>
                  )}

                  {!loading && !error && enabledCalendars.length === 0 && (
                    <div style={{ textAlign: "center", padding: "12px 0" }}>
                      <div style={{ fontSize: "13px", color: "#6b7280", marginBottom: "12px" }}>
                        No calendars configured yet
                      </div>
                      <button
                        onClick={handleAutoSetup}
                        disabled={syncing}
                        style={{
                          padding: "10px 20px",
                          fontSize: "13px",
                          backgroundColor: syncing ? "#e5e7eb" : "#10b981",
                          color: syncing ? "#6b7280" : "#fff",
                          border: "none",
                          borderRadius: "6px",
                          cursor: syncing ? "not-allowed" : "pointer",
                          fontWeight: 500,
                        }}
                      >
                        {syncing ? "Setting up..." : "Import from Google Calendar"}
                      </button>
                      <div style={{ fontSize: "11px", color: "#9ca3af", marginTop: "8px" }}>
                        Imports all selected calendars from your Google account
                      </div>
                    </div>
                  )}

                  {displayCalendars.map((cal) => (
                    <label
                      key={cal.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        padding: "6px 0",
                        cursor: "pointer",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={
                          selectedCalendars.length === 0 ||
                          selectedCalendars.includes(cal.id)
                        }
                        onChange={() => handleCalendarToggle(cal.id)}
                        style={{ cursor: "pointer" }}
                      />
                      <span
                        style={{
                          width: "12px",
                          height: "12px",
                          borderRadius: "2px",
                          backgroundColor: cal.backgroundColor || "#4285f4",
                          flexShrink: 0,
                        }}
                      />
                      <span
                        style={{
                          fontSize: "13px",
                          color: "#374151",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {cal.summary}
                        {cal.primary && (
                          <span
                            style={{
                              color: "#9ca3af",
                              marginLeft: "4px",
                              fontSize: "11px",
                            }}
                          >
                            (Primary)
                          </span>
                        )}
                      </span>
                    </label>
                  ))}
                </div>
              )}

              {/* Sync controls */}
              {showGoogleCalendar && (
                <div
                  style={{
                    marginTop: "16px",
                    padding: "12px",
                    backgroundColor: "#f9fafb",
                    borderRadius: "6px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontSize: "12px",
                          color: "#6b7280",
                        }}
                      >
                        Last synced
                      </div>
                      <div
                        style={{
                          fontSize: "14px",
                          color: "#374151",
                          fontWeight: 500,
                        }}
                      >
                        {formatLastSync(lastSync)}
                      </div>
                    </div>
                    <button
                      onClick={handleSync}
                      disabled={syncing}
                      style={{
                        padding: "8px 16px",
                        fontSize: "13px",
                        backgroundColor: syncing ? "#e5e7eb" : "#3b82f6",
                        color: syncing ? "#6b7280" : "#fff",
                        border: "none",
                        borderRadius: "6px",
                        cursor: syncing ? "not-allowed" : "pointer",
                        fontWeight: 500,
                      }}
                    >
                      {syncing ? "Syncing..." : "Sync Now"}
                    </button>
                  </div>
                </div>
              )}
            </section>
        </div>
      </div>
    </>
  );
}
