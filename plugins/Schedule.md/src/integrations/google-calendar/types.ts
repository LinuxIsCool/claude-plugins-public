/**
 * Google Calendar Integration Types
 */

export interface CalendarInfo {
  id: string;
  summary: string;
  description?: string;
  backgroundColor?: string;
  primary: boolean;
  selected: boolean; // Whether calendar is visible/selected in user's Google Calendar
  accessRole: "owner" | "writer" | "reader" | "freeBusyReader";
}

export interface GoogleCalendarEvent {
  id: string;
  calendarId: string;
  summary: string;
  description?: string;
  location?: string;
  start: Date;
  end: Date;
  allDay: boolean;
  recurring: boolean;
  status: "confirmed" | "tentative" | "cancelled";
  htmlLink?: string;
}

export interface SyncResult {
  success: boolean;
  calendarId: string;
  calendarName: string;
  fetched: number;
  created: number;
  updated: number;
  deleted: number;
  errors: string[];
  syncedAt: string;
}

export interface SyncState {
  lastSync: string | null;
  calendars: Record<
    string,
    {
      lastSync: string;
      eventCount: number;
    }
  >;
}

export interface GoogleCalendarConfig {
  enabled: boolean;
  clientId?: string;
  clientSecret?: string;
  refreshToken?: string;
  calendars: string[]; // Calendar IDs to sync
  syncIntervalMinutes: number;
  lookAheadDays: number;
}
