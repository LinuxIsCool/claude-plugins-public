#!/usr/bin/env bun
/**
 * Schedule.md MCP Server
 *
 * Provides schedule management tools via Model Context Protocol
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  type Tool,
} from "@modelcontextprotocol/sdk/types.js";

// Load environment variables from repo root .env (shared infrastructure)
import { loadEnvFromRepoRoot } from "../../../../lib/paths";
loadEnvFromRepoRoot();

import { Schedule } from "../core/schedule";
import { BlockHandlers } from "./tools/blocks/handlers";
import {
  getBlockCreateSchema,
  getBlockEditSchema,
  blockListSchema,
  blockViewSchema,
  blockDeleteSchema,
  blockSearchSchema,
  scheduleSummarySchema,
  freeSlotsSchema,
  scheduleInitSchema,
} from "./tools/blocks/schemas";
import {
  syncGoogleCalendar,
  startPeriodicSync,
  stopPeriodicSync,
  listCalendars,
  getSyncStatus,
} from "../integrations/google-calendar";

// Get schedule root from environment or current directory
const SCHEDULE_ROOT = process.env.SCHEDULE_ROOT || process.cwd();

async function main() {
  // Initialize schedule
  let schedule: Schedule | null = null;

  try {
    schedule = await Schedule.find(SCHEDULE_ROOT);
  } catch (err) {
    console.error("Warning: Could not find schedule:", err);
  }

  // Initialize Google Calendar sync if enabled
  if (schedule) {
    const config = schedule.getConfig();
    const gcalConfig = (config as any).integrations?.googleCalendar;

    if (gcalConfig?.enabled) {
      const enabledCalendars = gcalConfig.calendars
        ?.filter((c: any) => c.enabled)
        ?.map((c: any) => c.id) || [];

      if (enabledCalendars.length > 0) {
        console.error(`Google Calendar sync enabled for ${enabledCalendars.length} calendars`);

        // Start periodic sync (every 30 minutes by default)
        const syncInterval = gcalConfig.syncIntervalMinutes || 30;
        const scheduleDir = schedule.getScheduleDir();

        startPeriodicSync(scheduleDir, enabledCalendars, syncInterval);

        // Graceful shutdown
        process.on("SIGINT", () => {
          stopPeriodicSync();
          process.exit(0);
        });
        process.on("SIGTERM", () => {
          stopPeriodicSync();
          process.exit(0);
        });
      }
    }
  }

  // Create MCP server
  const server = new Server(
    {
      name: "schedule",
      version: "0.1.0",
    },
    {
      capabilities: {
        tools: {},
        resources: {},
      },
    }
  );

  // Tool handlers (only available if schedule is initialized)
  let blockHandlers: BlockHandlers | null = null;
  if (schedule) {
    blockHandlers = new BlockHandlers(schedule);
  }

  // Register tools
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    const config = schedule?.getConfig();

    const tools: Tool[] = [
      {
        name: "block_create",
        description: "Create a new schedule block. Specify day, time range, category, and optional details.",
        inputSchema: getBlockCreateSchema(config),
      },
      {
        name: "block_list",
        description: "List all schedule blocks with optional filtering by day, category, or source.",
        inputSchema: blockListSchema,
      },
      {
        name: "block_view",
        description: "View detailed information about a specific schedule block.",
        inputSchema: blockViewSchema,
      },
      {
        name: "block_edit",
        description: "Edit an existing schedule block. Provide the block ID and fields to update.",
        inputSchema: getBlockEditSchema(config),
      },
      {
        name: "block_delete",
        description: "Delete a schedule block by its ID.",
        inputSchema: blockDeleteSchema,
      },
      {
        name: "block_search",
        description: "Search schedule blocks by text. Matches title, category, location, description, and tags.",
        inputSchema: blockSearchSchema,
      },
      {
        name: "schedule_summary",
        description: "Get a summary of the weekly schedule including hours by category and day.",
        inputSchema: scheduleSummarySchema,
      },
      {
        name: "free_slots",
        description: "Find free time slots in the schedule. Optionally filter by day and minimum duration.",
        inputSchema: freeSlotsSchema,
      },
      // Google Calendar tools
      {
        name: "gcal_sync",
        description: "Manually trigger Google Calendar sync. Fetches events from configured calendars and creates/updates blocks.",
        inputSchema: {
          type: "object",
          properties: {
            lookAheadDays: {
              type: "number",
              description: "Number of days to look ahead (default: 30)",
              default: 30,
            },
          },
        },
      },
      {
        name: "gcal_status",
        description: "Get Google Calendar sync status including last sync time, errors, and configured calendars.",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "gcal_list_calendars",
        description: "List all available Google Calendars from your account.",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
    ];

    // Add init tool if schedule not found
    if (!schedule) {
      tools.unshift({
        name: "schedule_init",
        description: "Initialize a new schedule in the current directory. Required before using other schedule tools.",
        inputSchema: scheduleInitSchema,
      });
    }

    return { tools };
  });

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    // Handle init specially
    if (name === "schedule_init") {
      try {
        const projectName = (args as { projectName?: string })?.projectName || "My Schedule";
        schedule = await Schedule.create(SCHEDULE_ROOT, projectName);
        blockHandlers = new BlockHandlers(schedule);

        return {
          content: [
            {
              type: "text",
              text: `Initialized schedule "${projectName}" in ${SCHEDULE_ROOT}/schedule\n\nYou can now create schedule blocks using the block_create tool.`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error initializing schedule: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }

    // All other tools require initialized schedule
    if (!blockHandlers) {
      return {
        content: [
          {
            type: "text",
            text: "Schedule not initialized. Please run schedule_init first.",
          },
        ],
        isError: true,
      };
    }

    switch (name) {
      case "block_create":
        return blockHandlers.createBlock(args as Parameters<BlockHandlers["createBlock"]>[0]);

      case "block_list":
        return blockHandlers.listBlocks(args as Parameters<BlockHandlers["listBlocks"]>[0]);

      case "block_view":
        return blockHandlers.viewBlock(args as Parameters<BlockHandlers["viewBlock"]>[0]);

      case "block_edit":
        return blockHandlers.editBlock(args as Parameters<BlockHandlers["editBlock"]>[0]);

      case "block_delete":
        return blockHandlers.deleteBlock(args as Parameters<BlockHandlers["deleteBlock"]>[0]);

      case "block_search":
        return blockHandlers.searchBlocks(args as Parameters<BlockHandlers["searchBlocks"]>[0]);

      case "schedule_summary":
        return blockHandlers.getSummary(args as Parameters<BlockHandlers["getSummary"]>[0]);

      case "free_slots":
        return blockHandlers.findFreeSlots(args as Parameters<BlockHandlers["findFreeSlots"]>[0]);

      // Google Calendar handlers
      case "gcal_sync": {
        try {
          const config = schedule!.getConfig();
          const gcalConfig = (config as any).integrations?.googleCalendar;

          if (!gcalConfig?.enabled) {
            return {
              content: [{ type: "text", text: "Google Calendar integration is not enabled in config.json" }],
              isError: true,
            };
          }

          const enabledCalendars = gcalConfig.calendars
            ?.filter((c: any) => c.enabled)
            ?.map((c: any) => c.id) || [];

          if (enabledCalendars.length === 0) {
            return {
              content: [{ type: "text", text: "No calendars enabled for sync in config.json" }],
              isError: true,
            };
          }

          const lookAheadDays = (args as any)?.lookAheadDays || 30;
          const scheduleDir = schedule!.getScheduleDir();
          const results = await syncGoogleCalendar(scheduleDir, enabledCalendars, lookAheadDays);

          // Reload schedule to pick up new blocks
          await schedule!.reload();

          const summary = results.map((r) =>
            `${r.calendarName}: ${r.fetched} fetched, ${r.created} created, ${r.updated} updated, ${r.deleted} deleted${r.errors.length > 0 ? ` (${r.errors.length} errors)` : ""}`
          ).join("\n");

          return {
            content: [{ type: "text", text: `Google Calendar sync completed:\n\n${summary}` }],
          };
        } catch (error) {
          return {
            content: [{ type: "text", text: `Google Calendar sync failed: ${error instanceof Error ? error.message : String(error)}` }],
            isError: true,
          };
        }
      }

      case "gcal_status": {
        const status = getSyncStatus();
        const config = schedule!.getConfig();
        const gcalConfig = (config as any).integrations?.googleCalendar;

        let text = `**Google Calendar Sync Status**\n\n`;
        text += `Status: ${status.status}\n`;
        text += `Last Sync: ${status.lastSync || "Never"}\n`;
        text += `Integration Enabled: ${gcalConfig?.enabled ? "Yes" : "No"}\n`;

        if (status.error) {
          text += `Error: ${status.error}\n`;
        }

        if (gcalConfig?.calendars?.length > 0) {
          text += `\n**Configured Calendars (${gcalConfig.calendars.length}):**\n`;
          for (const cal of gcalConfig.calendars) {
            text += `- ${cal.name || cal.id} (${cal.enabled ? "enabled" : "disabled"})\n`;
          }
        }

        return { content: [{ type: "text", text }] };
      }

      case "gcal_list_calendars": {
        try {
          const calendars = await listCalendars();

          let text = `**Available Google Calendars (${calendars.length}):**\n\n`;
          for (const cal of calendars) {
            text += `- **${cal.summary}**${cal.primary ? " (Primary)" : ""}\n`;
            text += `  ID: \`${cal.id}\`\n`;
            if (cal.description) text += `  Description: ${cal.description}\n`;
            text += `  Access: ${cal.accessRole}\n\n`;
          }

          return { content: [{ type: "text", text }] };
        } catch (error) {
          return {
            content: [{ type: "text", text: `Failed to list calendars: ${error instanceof Error ? error.message : String(error)}` }],
            isError: true,
          };
        }
      }

      default:
        return {
          content: [
            {
              type: "text",
              text: `Unknown tool: ${name}`,
            },
          ],
          isError: true,
        };
    }
  });

  // Register resources
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    const resources = [
      {
        uri: "schedule://workflow/overview",
        name: "Schedule Workflow Guide",
        description: "How to effectively manage your schedule with Claude",
        mimeType: "text/markdown",
      },
    ];

    if (!schedule) {
      resources.unshift({
        uri: "schedule://init-required",
        name: "Initialization Required",
        description: "Instructions for initializing a schedule",
        mimeType: "text/markdown",
      });
    }

    return { resources };
  });

  // Handle resource reads
  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;

    if (uri === "schedule://init-required") {
      return {
        contents: [
          {
            uri,
            mimeType: "text/markdown",
            text: `# Schedule Not Initialized

No schedule found in the current directory. To get started:

1. Use the \`schedule_init\` tool to create a new schedule
2. Optionally provide a project name

Example:
\`\`\`
schedule_init({ projectName: "My Weekly Schedule" })
\`\`\`

This will create a \`schedule/\` directory with:
- \`config.json\` - Schedule configuration
- \`blocks/\` - Your schedule blocks as markdown files
`,
          },
        ],
      };
    }

    if (uri === "schedule://workflow/overview") {
      return {
        contents: [
          {
            uri,
            mimeType: "text/markdown",
            text: `# Schedule.md Workflow Guide

## Overview

Schedule.md is a markdown-native weekly schedule manager. Each schedule block is stored as a markdown file with YAML frontmatter.

## Available Tools

### Creating Blocks
\`block_create\` - Add a new block to your schedule
- Required: title, category, day, startTime, endTime
- Optional: location, description, recurring, tags

### Managing Blocks
- \`block_list\` - View all blocks, optionally filtered
- \`block_view\` - See details of a specific block
- \`block_edit\` - Update an existing block
- \`block_delete\` - Remove a block

### Analysis
- \`schedule_summary\` - Get weekly statistics
- \`block_search\` - Find blocks by text
- \`free_slots\` - Find available time windows

## Categories

Default categories (each has a color):
- yoga (green)
- work (blue)
- class (purple)
- personal (orange)
- meeting (red)
- blocked (gray)

## Time Format

Use 24-hour format: "09:00", "14:30", "17:00"

## Examples

**Add morning yoga:**
\`block_create({ title: "Morning Yoga", category: "yoga", day: "monday", startTime: "09:00", endTime: "10:00" })\`

**Check Tuesday's schedule:**
\`block_list({ day: "tuesday" })\`

**Find free time:**
\`free_slots({ minDuration: 60 })\`
`,
          },
        ],
      };
    }

    return {
      contents: [
        {
          uri,
          mimeType: "text/plain",
          text: `Resource not found: ${uri}`,
        },
      ],
    };
  });

  // Start server with stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error("Schedule MCP server started");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
