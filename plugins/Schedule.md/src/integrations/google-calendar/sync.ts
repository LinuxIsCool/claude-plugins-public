/**
 * Google Calendar Sync Service
 *
 * Handles synchronization of Google Calendar events to schedule blocks.
 * Events are synced as markdown files with source: "google-calendar".
 */

import { readdir, readFile, writeFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import type { ScheduleBlock, DayOfWeek } from "../../types";
import { getStateDir } from "../../utils/xdg";
import { getGoogleCalendarClient } from "./client";
import type {
  GoogleCalendarEvent,
  SyncResult,
  SyncState,
  CalendarInfo,
} from "./types";
import { serializeBlockToMarkdown } from "../../markdown/serializer";

const DAYS_OF_WEEK: DayOfWeek[] = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

// Sync state
let syncInterval: ReturnType<typeof setInterval> | null = null;
let lastSyncTime: Date | null = null;
let syncStatus: "idle" | "syncing" | "error" = "idle";
let syncError: string | null = null;
let cachedCalendars: CalendarInfo[] = [];
let syncInProgress = false; // Guard against concurrent syncs

/**
 * Get current sync status
 */
export function getSyncStatus() {
  return {
    status: syncStatus,
    lastSync: lastSyncTime?.toISOString() || null,
    error: syncError,
    calendars: cachedCalendars,
  };
}

/**
 * List available calendars
 */
export async function listCalendars(): Promise<CalendarInfo[]> {
  const client = getGoogleCalendarClient();

  if (!client.isInitialized()) {
    await client.initialize();
  }

  cachedCalendars = await client.listCalendars();
  return cachedCalendars;
}

/**
 * Sync Google Calendar events to schedule blocks
 */
export async function syncGoogleCalendar(
  scheduleDir: string,
  calendarIds: string[],
  lookAheadDays: number = 30
): Promise<SyncResult[]> {
  if (calendarIds.length === 0) {
    return [];
  }

  // Guard against concurrent syncs
  if (syncInProgress) {
    console.log("Sync already in progress, skipping");
    return [];
  }

  syncInProgress = true;
  syncStatus = "syncing";
  syncError = null;

  const results: SyncResult[] = [];
  const client = getGoogleCalendarClient();

  try {
    if (!client.isInitialized()) {
      await client.initialize();
    }

    // Ensure we have calendar info (including colors) before syncing
    if (cachedCalendars.length === 0) {
      cachedCalendars = await client.listCalendars();
    }

    // Fetch events from all calendars
    const events = await client.fetchEvents(calendarIds, lookAheadDays);

    // Group events by calendar
    const eventsByCalendar = new Map<string, GoogleCalendarEvent[]>();
    for (const event of events) {
      const calEvents = eventsByCalendar.get(event.calendarId) || [];
      calEvents.push(event);
      eventsByCalendar.set(event.calendarId, calEvents);
    }

    // Get existing calendar blocks to track deletions
    const existingBlocks = await loadExistingCalendarBlocks(scheduleDir);
    const processedExternalIds = new Set<string>();

    // Process each calendar
    for (const calendarId of calendarIds) {
      const calendarEvents = eventsByCalendar.get(calendarId) || [];
      // Handle "primary" alias - look up by id OR by primary flag
      const calendarInfo = cachedCalendars.find((c) =>
        c.id === calendarId || (calendarId === "primary" && c.primary)
      );
      const calendarName = calendarInfo?.summary || calendarId;

      const result: SyncResult = {
        success: true,
        calendarId,
        calendarName,
        fetched: calendarEvents.length,
        created: 0,
        updated: 0,
        deleted: 0,
        errors: [],
        syncedAt: new Date().toISOString(),
      };

      for (const event of calendarEvents) {
        try {
          const block = eventToBlock(event, calendarInfo?.backgroundColor);
          const existingBlock = existingBlocks.find(
            (b) => b.externalId === event.id
          );

          if (existingBlock) {
            // Update if changed
            const hasChanges = blockNeedsUpdate(existingBlock, block);
            if (hasChanges) {
              await saveCalendarBlock(scheduleDir, block);
              result.updated++;
            }
          } else {
            // Create new
            await saveCalendarBlock(scheduleDir, block);
            result.created++;
          }

          processedExternalIds.add(event.id);
        } catch (error) {
          result.errors.push(
            `Event ${event.id}: ${error instanceof Error ? error.message : "Unknown error"}`
          );
        }
      }

      results.push(result);
    }

    // Delete blocks that no longer exist in Google Calendar
    for (const block of existingBlocks) {
      if (block.externalId && !processedExternalIds.has(block.externalId)) {
        // Only delete if the calendar is in our sync list
        if (calendarIds.includes(block.calendarId || "")) {
          await deleteCalendarBlock(scheduleDir, block.id);
          // Find the appropriate result and increment deleted count
          const result = results.find(
            (r) => r.calendarId === block.calendarId
          );
          if (result) {
            result.deleted++;
          }
        }
      }
    }

    // Save sync state
    await saveSyncState(calendarIds);

    syncStatus = "idle";
    lastSyncTime = new Date();
  } catch (error) {
    syncStatus = "error";
    syncError = error instanceof Error ? error.message : "Unknown error";

    results.push({
      success: false,
      calendarId: "all",
      calendarName: "All Calendars",
      fetched: 0,
      created: 0,
      updated: 0,
      deleted: 0,
      errors: [syncError],
      syncedAt: new Date().toISOString(),
    });
  } finally {
    syncInProgress = false;
  }

  return results;
}

/**
 * Start periodic sync
 */
export function startPeriodicSync(
  scheduleDir: string,
  calendarIds: string[],
  intervalMinutes: number = 30
): void {
  // Stop existing interval if any
  stopPeriodicSync();

  // Do initial sync
  syncGoogleCalendar(scheduleDir, calendarIds).catch((err) => {
    console.error("Initial Google Calendar sync failed:", err);
  });

  // Set up periodic sync
  syncInterval = setInterval(
    () => {
      syncGoogleCalendar(scheduleDir, calendarIds).catch((err) => {
        console.error("Periodic Google Calendar sync failed:", err);
      });
    },
    intervalMinutes * 60 * 1000
  );

  console.log(
    `Google Calendar sync started (every ${intervalMinutes} minutes)`
  );
}

/**
 * Stop periodic sync
 */
export function stopPeriodicSync(): void {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
    console.log("Google Calendar sync stopped");
  }
}

/**
 * Convert a Google Calendar event to a ScheduleBlock
 */
function eventToBlock(
  event: GoogleCalendarEvent,
  calendarColor?: string
): ScheduleBlock {
  const dayIndex = event.start.getDay();
  const day = DAYS_OF_WEEK[dayIndex];

  // Format time as HH:MM
  const formatTime = (date: Date): string => {
    const hours = date.getHours().toString().padStart(2, "0");
    const minutes = date.getMinutes().toString().padStart(2, "0");
    return `${hours}:${minutes}`;
  };

  // Handle all-day events
  let startTime: string;
  let endTime: string;

  if (event.allDay) {
    // All-day events span the whole day
    startTime = "00:00";
    endTime = "23:59";
  } else {
    startTime = formatTime(event.start);
    endTime = formatTime(event.end);
  }

  // Generate a deterministic ID using a hash of the event ID
  // This preserves uniqueness without truncation
  const hashCode = (str: string): string => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
  };
  const blockId = `gcal-${hashCode(event.id)}`;

  const now = new Date().toISOString();

  // Format event date as YYYY-MM-DD for filtering by week
  const eventDate = event.start.toISOString().split("T")[0];

  return {
    id: blockId,
    title: event.summary,
    category: "personal", // Default category for calendar events
    color: calendarColor,
    day,
    startTime,
    endTime,
    location: event.location,
    description: event.description,
    recurring: event.recurring ? "weekly" : "none",
    tags: ["google-calendar"],
    source: "google-calendar",
    externalId: event.id,
    calendarId: event.calendarId,
    eventDate,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Check if a block needs to be updated
 */
function blockNeedsUpdate(
  existing: ScheduleBlock,
  incoming: ScheduleBlock
): boolean {
  return (
    existing.title !== incoming.title ||
    existing.day !== incoming.day ||
    existing.startTime !== incoming.startTime ||
    existing.endTime !== incoming.endTime ||
    existing.location !== incoming.location ||
    existing.description !== incoming.description ||
    existing.eventDate !== incoming.eventDate ||
    existing.color !== incoming.color
  );
}

/**
 * Load existing calendar blocks from schedule directory
 */
async function loadExistingCalendarBlocks(
  scheduleDir: string
): Promise<ScheduleBlock[]> {
  const blocksDir = join(scheduleDir, "blocks");
  const blocks: ScheduleBlock[] = [];

  try {
    const files = await readdir(blocksDir);

    for (const file of files) {
      if (!file.startsWith("gcal-") || !file.endsWith(".md")) continue;

      const filePath = join(blocksDir, file);
      try {
        const content = await readFile(filePath, "utf-8");
        const { parseBlockMarkdown } = await import("../../markdown/parser");
        const block = parseBlockMarkdown(content, filePath);
        if (block.source === "google-calendar") {
          blocks.push(block);
        }
      } catch {
        // Skip files that can't be parsed
      }
    }
  } catch {
    // Blocks directory might not exist
  }

  return blocks;
}

/**
 * Save a calendar block to the schedule directory
 */
async function saveCalendarBlock(
  scheduleDir: string,
  block: ScheduleBlock
): Promise<void> {
  const blocksDir = join(scheduleDir, "blocks");
  const { mkdir } = await import("node:fs/promises");
  await mkdir(blocksDir, { recursive: true });

  // Sanitize title for filename
  const sanitizedTitle = block.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 30);

  const filename = `${block.id} - ${sanitizedTitle}.md`;
  const filePath = join(blocksDir, filename);
  const content = serializeBlockToMarkdown(block);

  await writeFile(filePath, content, "utf-8");
}

/**
 * Delete a calendar block
 */
async function deleteCalendarBlock(
  scheduleDir: string,
  blockId: string
): Promise<void> {
  const blocksDir = join(scheduleDir, "blocks");

  try {
    const files = await readdir(blocksDir);

    for (const file of files) {
      if (file.startsWith(blockId)) {
        await unlink(join(blocksDir, file));
        break;
      }
    }
  } catch {
    // File might not exist
  }
}

/**
 * Save sync state to disk
 */
async function saveSyncState(calendarIds: string[]): Promise<void> {
  const stateDir = getStateDir("google-calendar");
  const statePath = join(stateDir, "sync-state.json");

  const state: SyncState = {
    lastSync: new Date().toISOString(),
    calendars: {},
  };

  for (const calendarId of calendarIds) {
    state.calendars[calendarId] = {
      lastSync: new Date().toISOString(),
      eventCount: 0, // TODO: track actual count
    };
  }

  await writeFile(statePath, JSON.stringify(state, null, 2), "utf-8");
}

/**
 * Load sync state from disk
 */
export async function loadSyncState(): Promise<SyncState | null> {
  const stateDir = getStateDir("google-calendar");
  const statePath = join(stateDir, "sync-state.json");

  try {
    const content = await readFile(statePath, "utf-8");
    return JSON.parse(content) as SyncState;
  } catch {
    return null;
  }
}
