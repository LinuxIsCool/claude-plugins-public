#!/usr/bin/env bun
/**
 * Schedule.md CLI
 *
 * Command-line interface for schedule management
 */

import { Command } from "commander";
import { Schedule } from "./core/schedule";
import { startServer } from "./server";
import { findScheduleRoot } from "./file-system/operations";
import { formatTimeDisplay, capitalize, formatDuration, getDurationMinutes } from "./utils/time";
import type { DayOfWeek } from "./types";

const program = new Command();

program
  .name("schedule")
  .description("A markdown-native weekly schedule manager")
  .version("0.1.0");

// Init command
program
  .command("init")
  .description("Initialize a new schedule in the current directory")
  .option("-n, --name <name>", "Project name", "My Schedule")
  .action(async (options) => {
    const cwd = process.cwd();

    // Check if already initialized
    const existing = await findScheduleRoot(cwd);
    if (existing) {
      console.log(`Schedule already exists at: ${existing}`);
      return;
    }

    const schedule = await Schedule.create(cwd, options.name);
    console.log(`Initialized schedule "${options.name}" at ${schedule.getScheduleDir()}`);
    console.log("\nNext steps:");
    console.log("  schedule serve    - Start the web interface");
    console.log("  schedule list     - List schedule blocks");
  });

// Serve command
program
  .command("serve")
  .description("Start the web interface")
  .option("-p, --port <port>", "Port number", "6421")
  .option("--no-open", "Don't open browser automatically")
  .action(async (options) => {
    const scheduleDir = await findScheduleRoot(process.cwd());
    if (!scheduleDir) {
      console.error("No schedule found. Run 'schedule init' first.");
      process.exit(1);
    }

    const port = parseInt(options.port, 10);

    await startServer({
      port,
      scheduleDir,
    });

    const url = `http://localhost:${port}`;
    console.log(`\nOpen ${url} in your browser`);

    // Open browser
    if (options.open) {
      const { exec } = await import("child_process");
      const openCommand =
        process.platform === "darwin"
          ? "open"
          : process.platform === "win32"
          ? "start"
          : "xdg-open";
      exec(`${openCommand} ${url}`);
    }
  });

// List command
program
  .command("list")
  .description("List schedule blocks")
  .option("-d, --day <day>", "Filter by day")
  .option("-c, --category <category>", "Filter by category")
  .action(async (options) => {
    const scheduleDir = await findScheduleRoot(process.cwd());
    if (!scheduleDir) {
      console.error("No schedule found. Run 'schedule init' first.");
      process.exit(1);
    }

    const schedule = new Schedule(scheduleDir);
    await schedule.init();

    const filter: { day?: DayOfWeek; category?: string } = {};
    if (options.day) filter.day = options.day as DayOfWeek;
    if (options.category) filter.category = options.category;

    const blocks = await schedule.listBlocks(filter);

    if (blocks.length === 0) {
      console.log("No blocks found.");
      return;
    }

    // Group by day
    const days: DayOfWeek[] = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
    const byDay: Record<string, typeof blocks> = {};

    for (const block of blocks) {
      if (!byDay[block.day]) byDay[block.day] = [];
      byDay[block.day].push(block);
    }

    console.log(`\nFound ${blocks.length} block(s):\n`);

    for (const day of days) {
      const dayBlocks = byDay[day];
      if (!dayBlocks) continue;

      console.log(`${capitalize(day)}`);
      console.log("─".repeat(40));

      for (const block of dayBlocks) {
        const duration = getDurationMinutes(block.startTime, block.endTime);
        console.log(
          `  ${formatTimeDisplay(block.startTime)} - ${formatTimeDisplay(block.endTime)}  ${block.title} (${block.category})`
        );
        if (block.location) {
          console.log(`    Location: ${block.location}`);
        }
      }
      console.log();
    }
  });

// Summary command
program
  .command("summary")
  .description("Show weekly schedule summary")
  .action(async () => {
    const scheduleDir = await findScheduleRoot(process.cwd());
    if (!scheduleDir) {
      console.error("No schedule found. Run 'schedule init' first.");
      process.exit(1);
    }

    const schedule = new Schedule(scheduleDir);
    await schedule.init();

    const config = schedule.getConfig();
    const summary = await schedule.getSummary();

    console.log(`\n${config.projectName} - Weekly Summary`);
    console.log("═".repeat(40));
    console.log(`Total Blocks: ${summary.totalBlocks}`);
    console.log(`Total Hours: ${summary.totalHours.toFixed(1)}\n`);

    console.log("Hours by Category:");
    console.log("─".repeat(40));
    for (const [category, hours] of Object.entries(summary.hoursByCategory)) {
      const pct = ((hours / summary.totalHours) * 100).toFixed(0);
      const bar = "█".repeat(Math.round(hours));
      console.log(`  ${capitalize(category).padEnd(12)} ${bar} ${hours.toFixed(1)}h (${pct}%)`);
    }

    console.log("\nHours by Day:");
    console.log("─".repeat(40));
    const days: DayOfWeek[] = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
    for (const day of days) {
      const hours = summary.hoursByDay[day];
      if (hours > 0) {
        const bar = "█".repeat(Math.round(hours));
        console.log(`  ${capitalize(day).padEnd(12)} ${bar} ${hours.toFixed(1)}h`);
      }
    }
  });

// MCP command
program
  .command("mcp")
  .description("Start MCP server for Claude integration")
  .argument("[action]", "Action (start)", "start")
  .action(async (action) => {
    if (action === "start") {
      // Import and run MCP server
      await import("./mcp/server");
    } else {
      console.error(`Unknown action: ${action}`);
      process.exit(1);
    }
  });

// Parse arguments
program.parse();
