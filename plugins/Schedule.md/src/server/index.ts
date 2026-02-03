/**
 * Schedule.md HTTP Server
 *
 * Serves the web interface and provides REST API + WebSocket for real-time sync
 */

import { watch } from "node:fs";
import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { Schedule } from "../core/schedule";
import type { CreateBlockInput, EditBlockInput, BlockFilter, DayOfWeek } from "../types";
import {
  listCalendars,
  syncGoogleCalendar,
  startPeriodicSync,
  stopPeriodicSync,
  getSyncStatus,
} from "../integrations/google-calendar";

// Get the web directory (relative to this file)
const WEB_DIR = join(dirname(import.meta.dir), "web");

interface ServerOptions {
  port: number;
  scheduleDir: string;
}

export async function startServer(options: ServerOptions) {
  const { port, scheduleDir } = options;

  // Initialize schedule
  const schedule = new Schedule(scheduleDir);
  await schedule.init();

  // Track connected WebSocket clients
  const wsClients = new Set<WebSocket>();

  // Broadcast to all connected clients
  function broadcast(event: { type: string; data?: unknown }) {
    const message = JSON.stringify(event);
    for (const client of wsClients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    }
  }

  // Watch for file changes and broadcast updates
  const blocksDir = join(scheduleDir, "blocks");
  try {
    watch(blocksDir, { recursive: true }, async (eventType, filename) => {
      if (filename?.endsWith(".md")) {
        await schedule.reload();
        broadcast({ type: "blocks-updated" });
      }
    });
  } catch {
    // Directory might not exist yet
  }

  // Watch config changes
  const configPath = join(scheduleDir, "config.json");
  try {
    watch(configPath, async () => {
      await schedule.reload();
      broadcast({ type: "config-updated" });
    });
  } catch {
    // Config might not exist yet
  }

  // Hot reload: watch web source files and rebuild on changes
  let rebuildTimeout: ReturnType<typeof setTimeout> | null = null;

  const triggerRebuild = async () => {
    try {
      console.log("[hot-reload] Rebuilding web bundle...");
      const result = await Bun.build({
        entrypoints: [join(WEB_DIR, "index.tsx")],
        outdir: join(WEB_DIR, "dist"),
        minify: false,
        sourcemap: "inline",
        external: [],
      });

      if (!result.success) {
        console.error("[hot-reload] Build failed:", result.logs);
        return;
      }

      console.log("[hot-reload] Build successful, reloading clients...");
      broadcast({ type: "reload" });
    } catch (error) {
      console.error("[hot-reload] Build error:", error);
    }
  };

  const debouncedRebuild = () => {
    if (rebuildTimeout) clearTimeout(rebuildTimeout);
    rebuildTimeout = setTimeout(triggerRebuild, 300);
  };

  try {
    watch(WEB_DIR, { recursive: true }, (eventType, filename) => {
      // Only rebuild for source files, not dist output
      if (filename?.match(/\.(tsx?|css|html)$/) && !filename.includes("dist")) {
        console.log(`[hot-reload] File changed: ${filename}`);
        debouncedRebuild();
      }
    });
    console.log(`[hot-reload] Watching ${WEB_DIR} for changes`);
  } catch {
    console.warn("[hot-reload] Could not enable hot reload for web sources");
  }

  // Build the web bundle
  const webBundle = await Bun.build({
    entrypoints: [join(WEB_DIR, "index.tsx")],
    outdir: join(WEB_DIR, "dist"),
    minify: false,
    sourcemap: "inline",
    external: [],
  });

  if (!webBundle.success) {
    console.error("Failed to build web bundle:", webBundle.logs);
    throw new Error("Web build failed");
  }

  // Create Bun server
  const server = Bun.serve({
    port,
    async fetch(req, server) {
      const url = new URL(req.url);
      const path = url.pathname;

      // Handle WebSocket upgrade
      if (path === "/ws") {
        const upgraded = server.upgrade(req);
        if (upgraded) return undefined;
        return new Response("WebSocket upgrade failed", { status: 400 });
      }

      // API routes
      if (path.startsWith("/api/")) {
        return handleApiRequest(req, schedule, path.slice(5));
      }

      // Serve static files
      return handleStaticRequest(path);
    },
    websocket: {
      open(ws) {
        wsClients.add(ws as unknown as WebSocket);
        (ws as unknown as WebSocket).send(JSON.stringify({ type: "connected" }));
      },
      close(ws) {
        wsClients.delete(ws as unknown as WebSocket);
      },
      message() {
        // Currently no client-to-server messages needed
      },
    },
  });

  console.log(`Schedule.md server running at http://localhost:${port}`);

  // Start Google Calendar sync if configured
  const config = schedule.getConfig();
  if (
    config.integrations?.googleCalendar?.enabled &&
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET &&
    process.env.GOOGLE_REFRESH_TOKEN
  ) {
    const gcalConfig = config.integrations.googleCalendar;
    const calendarIds = (gcalConfig.calendars || [])
      .map((cal) => cal.id)
      .filter(Boolean);
    if (calendarIds.length > 0) {
      startPeriodicSync(scheduleDir, calendarIds, 30);
    }
  }

  return server;
}

/**
 * Handle API requests
 */
async function handleApiRequest(
  req: Request,
  schedule: Schedule,
  path: string
): Promise<Response> {
  const method = req.method;

  try {
    // GET /api/config
    if (path === "config" && method === "GET") {
      const config = schedule.getConfig();
      return json(config);
    }

    // PATCH /api/config
    if (path === "config" && method === "PATCH") {
      const updates = await req.json();
      const config = await schedule.updateConfig(updates);
      return json(config);
    }

    // GET /api/blocks
    if (path === "blocks" && method === "GET") {
      const url = new URL(req.url);
      const filter: BlockFilter = {};
      if (url.searchParams.has("day")) {
        filter.day = url.searchParams.get("day") as DayOfWeek;
      }
      if (url.searchParams.has("category")) {
        filter.category = url.searchParams.get("category")!;
      }
      if (url.searchParams.has("source")) {
        filter.source = url.searchParams.get("source") as "manual" | "google-calendar" | "yoga-studio";
      }
      const blocks = await schedule.listBlocks(filter);
      return json(blocks);
    }

    // POST /api/blocks
    if (path === "blocks" && method === "POST") {
      const input = (await req.json()) as CreateBlockInput;
      const block = await schedule.createBlock(input);
      return json(block, 201);
    }

    // GET /api/blocks/:id
    const blockMatch = path.match(/^blocks\/([^/]+)$/);
    if (blockMatch && method === "GET") {
      const id = decodeURIComponent(blockMatch[1]);
      const block = await schedule.getBlock(id);
      if (!block) {
        return json({ error: "Block not found" }, 404);
      }
      return json(block);
    }

    // PATCH /api/blocks/:id
    if (blockMatch && method === "PATCH") {
      const id = decodeURIComponent(blockMatch[1]);
      const updates = (await req.json()) as EditBlockInput;
      const block = await schedule.editBlock(id, updates);
      if (!block) {
        return json({ error: "Block not found" }, 404);
      }
      return json(block);
    }

    // DELETE /api/blocks/:id
    if (blockMatch && method === "DELETE") {
      const id = decodeURIComponent(blockMatch[1]);
      const success = await schedule.deleteBlock(id);
      if (!success) {
        return json({ error: "Block not found" }, 404);
      }
      return json({ success: true });
    }

    // GET /api/summary
    if (path === "summary" && method === "GET") {
      const summary = await schedule.getSummary();
      return json(summary);
    }

    // === Google Calendar API ===

    // GET /api/google-calendar/status
    if (path === "google-calendar/status" && method === "GET") {
      const status = getSyncStatus();
      return json(status);
    }

    // GET /api/google-calendar/calendars
    if (path === "google-calendar/calendars" && method === "GET") {
      try {
        const calendars = await listCalendars();
        return json(calendars);
      } catch (error) {
        return json(
          { error: error instanceof Error ? error.message : "Failed to fetch calendars" },
          500
        );
      }
    }

    // POST /api/google-calendar/auto-setup
    // Fetches all calendars from Google and enables those that are selected
    if (path === "google-calendar/auto-setup" && method === "POST") {
      try {
        const calendars = await listCalendars();

        // Filter to calendars that are selected in Google Calendar
        const selectedCalendars = calendars.filter((cal) => cal.selected);

        if (selectedCalendars.length === 0) {
          return json({ error: "No calendars are selected in your Google Calendar" }, 400);
        }

        // Create config objects with Google Calendar colors and names
        const calendarConfigs = selectedCalendars.map((cal) => ({
          id: cal.id,
          name: cal.summary,
          enabled: true,
          color: cal.backgroundColor,
        }));

        // Update config with all selected calendars
        const config = schedule.getConfig();
        const updatedConfig = await schedule.updateConfig({
          integrations: {
            ...config.integrations,
            googleCalendar: {
              ...config.integrations.googleCalendar,
              enabled: true,
              calendars: calendarConfigs,
            },
          },
        });

        // Start sync with new calendars
        const calendarIds = selectedCalendars.map((cal) => cal.id);
        startPeriodicSync(schedule.getScheduleDir(), calendarIds, 30);

        // Trigger immediate sync
        const results = await syncGoogleCalendar(
          schedule.getScheduleDir(),
          calendarIds,
          30
        );

        await schedule.reload();

        return json({
          success: true,
          calendars: calendarConfigs,
          syncResults: results,
        });
      } catch (error) {
        return json(
          { error: error instanceof Error ? error.message : "Auto-setup failed" },
          500
        );
      }
    }

    // POST /api/google-calendar/sync
    if (path === "google-calendar/sync" && method === "POST") {
      try {
        const config = schedule.getConfig();
        const calendarIds = (config.integrations?.googleCalendar?.calendars || [])
          .map((cal) => cal.id)
          .filter(Boolean);

        if (calendarIds.length === 0) {
          return json({ error: "No calendars configured for sync" }, 400);
        }

        const results = await syncGoogleCalendar(
          schedule.getScheduleDir(),
          calendarIds,
          30
        );

        // Reload schedule to pick up new blocks
        await schedule.reload();

        return json(results);
      } catch (error) {
        return json(
          { error: error instanceof Error ? error.message : "Sync failed" },
          500
        );
      }
    }

    // POST /api/google-calendar/enable
    if (path === "google-calendar/enable" && method === "POST") {
      const body = await req.json();
      const calendarIds = body.calendars as string[];

      if (!calendarIds || calendarIds.length === 0) {
        return json({ error: "No calendars specified" }, 400);
      }

      // Convert string IDs to CalendarConfig objects
      const calendarConfigs = calendarIds.map((id) => ({
        id,
        name: id === "primary" ? "Primary Calendar" : id,
        enabled: true,
      }));

      // Update config with enabled calendars
      const config = schedule.getConfig();
      const updatedConfig = await schedule.updateConfig({
        integrations: {
          ...config.integrations,
          googleCalendar: {
            ...config.integrations.googleCalendar,
            enabled: true,
            calendars: calendarConfigs,
          },
        },
      });

      // Start sync with new calendars
      startPeriodicSync(schedule.getScheduleDir(), calendarIds, 30);

      return json({ success: true, config: updatedConfig.integrations.googleCalendar });
    }

    // POST /api/google-calendar/disable
    if (path === "google-calendar/disable" && method === "POST") {
      stopPeriodicSync();

      // Update config
      const config = schedule.getConfig();
      const updatedConfig = await schedule.updateConfig({
        integrations: {
          ...config.integrations,
          googleCalendar: {
            ...config.integrations.googleCalendar,
            enabled: false,
          },
        },
      });

      return json({ success: true, config: updatedConfig.integrations.googleCalendar });
    }

    // Not found
    return json({ error: "Not found" }, 404);
  } catch (error) {
    console.error("API error:", error);
    return json(
      { error: error instanceof Error ? error.message : "Internal error" },
      500
    );
  }
}

/**
 * Handle static file requests
 */
async function handleStaticRequest(path: string): Promise<Response> {
  // Default to index.html
  if (path === "/" || path === "/index.html") {
    const html = await readFile(join(WEB_DIR, "index.html"), "utf-8");
    return new Response(html, {
      headers: { "Content-Type": "text/html" },
    });
  }

  // Serve bundled JS (no-cache for development)
  if (path === "/index.js") {
    try {
      const js = await readFile(join(WEB_DIR, "dist", "index.js"), "utf-8");
      return new Response(js, {
        headers: {
          "Content-Type": "application/javascript",
          "Cache-Control": "no-cache, no-store, must-revalidate",
          "Pragma": "no-cache",
          "Expires": "0",
        },
      });
    } catch {
      return new Response("Not found", { status: 404 });
    }
  }

  // Serve favicon (SVG emoji)
  if (path === "/favicon.ico" || path === "/favicon.svg") {
    try {
      const svg = await readFile(join(WEB_DIR, "favicon.svg"), "utf-8");
      return new Response(svg, {
        headers: { "Content-Type": "image/svg+xml" },
      });
    } catch {
      return new Response("Not found", { status: 404 });
    }
  }

  // Other static files
  try {
    const file = Bun.file(join(WEB_DIR, path));
    return new Response(file);
  } catch {
    return new Response("Not found", { status: 404 });
  }
}

/**
 * JSON response helper
 */
function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
