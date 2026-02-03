/**
 * Google Calendar API Client
 *
 * Handles authentication and API calls to Google Calendar.
 * Uses OAuth2 with refresh token from environment variables.
 */

import { google, calendar_v3 } from "googleapis";
import type { CalendarInfo, GoogleCalendarEvent } from "./types";

export class GoogleCalendarClient {
  private calendar: calendar_v3.Calendar | null = null;
  private initialized = false;

  /**
   * Initialize the client with OAuth2 credentials from environment
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

    if (!clientId || !clientSecret || !refreshToken) {
      throw new Error(
        "Missing Google Calendar credentials. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REFRESH_TOKEN in .env"
      );
    }

    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);

    oauth2Client.setCredentials({
      refresh_token: refreshToken,
    });

    // Force token refresh to verify credentials
    try {
      await oauth2Client.getAccessToken();
    } catch (error) {
      throw new Error(
        `Failed to authenticate with Google Calendar: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }

    this.calendar = google.calendar({ version: "v3", auth: oauth2Client });
    this.initialized = true;
  }

  /**
   * List all calendars the user has access to
   */
  async listCalendars(): Promise<CalendarInfo[]> {
    if (!this.calendar) {
      throw new Error("Client not initialized. Call initialize() first.");
    }

    const response = await this.calendar.calendarList.list();
    const items = response.data.items || [];

    return items.map((item) => ({
      id: item.id || "",
      summary: item.summary || "Untitled Calendar",
      description: item.description || undefined,
      backgroundColor: item.backgroundColor || undefined,
      primary: item.primary || false,
      selected: item.selected ?? true, // Default to true if not specified
      accessRole: (item.accessRole as CalendarInfo["accessRole"]) || "reader",
    }));
  }

  /**
   * Fetch events from specified calendars
   */
  async fetchEvents(
    calendarIds: string[],
    daysAhead: number = 30
  ): Promise<GoogleCalendarEvent[]> {
    if (!this.calendar) {
      throw new Error("Client not initialized. Call initialize() first.");
    }

    const now = new Date();
    // Start from beginning of current week (7 days ago) to include past events this week
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    weekStart.setHours(0, 0, 0, 0);
    const timeMin = weekStart.toISOString();
    const timeMax = new Date(
      now.getTime() + daysAhead * 24 * 60 * 60 * 1000
    ).toISOString();

    const allEvents: GoogleCalendarEvent[] = [];

    for (const calendarId of calendarIds) {
      try {
        const response = await this.calendar.events.list({
          calendarId,
          timeMin,
          timeMax,
          singleEvents: true, // Expand recurring events
          orderBy: "startTime",
          maxResults: 250,
        });

        const items = response.data.items || [];

        for (const item of items) {
          // Skip cancelled events
          if (item.status === "cancelled") continue;

          const event = this.parseEvent(item, calendarId);
          if (event) {
            allEvents.push(event);
          }
        }
      } catch (error) {
        console.warn(
          `Failed to fetch events from calendar ${calendarId}:`,
          error instanceof Error ? error.message : error
        );
      }
    }

    return allEvents;
  }

  /**
   * Parse a Google Calendar event into our format
   */
  private parseEvent(
    item: calendar_v3.Schema$Event,
    calendarId: string
  ): GoogleCalendarEvent | null {
    // Must have an ID
    if (!item.id) return null;

    // Parse start time
    let start: Date;
    let allDay = false;

    if (item.start?.dateTime) {
      start = new Date(item.start.dateTime);
    } else if (item.start?.date) {
      start = new Date(item.start.date);
      allDay = true;
    } else {
      return null; // No start time
    }

    // Parse end time
    let end: Date;

    if (item.end?.dateTime) {
      end = new Date(item.end.dateTime);
    } else if (item.end?.date) {
      end = new Date(item.end.date);
    } else {
      // Default to 1 hour
      end = new Date(start.getTime() + 60 * 60 * 1000);
    }

    return {
      id: item.id,
      calendarId,
      summary: item.summary || "(No title)",
      description: item.description || undefined,
      location: item.location || undefined,
      start,
      end,
      allDay,
      recurring: !!item.recurringEventId,
      status: (item.status as GoogleCalendarEvent["status"]) || "confirmed",
      htmlLink: item.htmlLink || undefined,
    };
  }

  /**
   * Check if the client is ready
   */
  isInitialized(): boolean {
    return this.initialized;
  }
}

// Singleton instance
let clientInstance: GoogleCalendarClient | null = null;

export function getGoogleCalendarClient(): GoogleCalendarClient {
  if (!clientInstance) {
    clientInstance = new GoogleCalendarClient();
  }
  return clientInstance;
}
