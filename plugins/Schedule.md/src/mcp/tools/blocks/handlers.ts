/**
 * MCP tool handlers for schedule blocks
 */

import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { Schedule } from "../../../core/schedule";
import type {
  CreateBlockInput,
  EditBlockInput,
  BlockFilter,
  DayOfWeek,
  ScheduleBlock,
} from "../../../types";
import { formatTimeDisplay, capitalize, formatDuration, getDurationMinutes } from "../../../utils/time";

/**
 * Format a block for display in tool results
 */
function formatBlock(block: ScheduleBlock, verbose: boolean = false): string {
  const lines: string[] = [];
  const duration = getDurationMinutes(block.startTime, block.endTime);

  lines.push(`**${block.title}** (${block.id})`);
  lines.push(`- ${capitalize(block.day)} ${formatTimeDisplay(block.startTime)} - ${formatTimeDisplay(block.endTime)} (${formatDuration(duration)})`);
  lines.push(`- Category: ${block.category}`);

  if (block.location) {
    lines.push(`- Location: ${block.location}`);
  }

  if (verbose) {
    if (block.description) {
      lines.push(`- Description: ${block.description}`);
    }
    if (block.tags.length > 0) {
      lines.push(`- Tags: ${block.tags.join(", ")}`);
    }
    lines.push(`- Source: ${block.source}`);
    lines.push(`- Recurring: ${block.recurring}`);
  }

  return lines.join("\n");
}

export class BlockHandlers {
  constructor(private schedule: Schedule) {}

  async createBlock(args: {
    title: string;
    category: string;
    day: string;
    startTime: string;
    endTime: string;
    location?: string;
    description?: string;
    recurring?: string;
    tags?: string[];
  }): Promise<CallToolResult> {
    try {
      const input: CreateBlockInput = {
        title: args.title,
        category: args.category,
        day: args.day as DayOfWeek,
        startTime: args.startTime,
        endTime: args.endTime,
        location: args.location,
        description: args.description,
        recurring: (args.recurring as "none" | "weekly") || "weekly",
        tags: args.tags,
      };

      const block = await this.schedule.createBlock(input);

      // Check for conflicts
      const conflicts = this.schedule.findConflicts(block);
      let conflictWarning = "";
      if (conflicts.length > 0) {
        conflictWarning = `\n\n⚠️ Warning: This block overlaps with:\n${conflicts
          .map((c) => `- ${c.block2.title} (${c.overlapMinutes} min overlap)`)
          .join("\n")}`;
      }

      return {
        content: [
          {
            type: "text",
            text: `Created schedule block:\n\n${formatBlock(block, true)}${conflictWarning}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error creating block: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }

  async listBlocks(args: {
    day?: string;
    category?: string;
    source?: string;
  }): Promise<CallToolResult> {
    try {
      const filter: BlockFilter = {};
      if (args.day) filter.day = args.day as DayOfWeek;
      if (args.category) filter.category = args.category;
      if (args.source) filter.source = args.source as "manual" | "google-calendar" | "yoga-studio";

      const blocks = await this.schedule.listBlocks(filter);

      if (blocks.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: "No schedule blocks found matching the filter.",
            },
          ],
        };
      }

      // Group by day for better readability
      const byDay: Record<string, ScheduleBlock[]> = {};
      for (const block of blocks) {
        if (!byDay[block.day]) byDay[block.day] = [];
        byDay[block.day].push(block);
      }

      const days: DayOfWeek[] = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
      const output: string[] = [`Found ${blocks.length} block(s):\n`];

      for (const day of days) {
        const dayBlocks = byDay[day];
        if (!dayBlocks || dayBlocks.length === 0) continue;

        output.push(`\n## ${capitalize(day)}`);
        for (const block of dayBlocks) {
          output.push(`\n${formatBlock(block)}`);
        }
      }

      return {
        content: [
          {
            type: "text",
            text: output.join("\n"),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error listing blocks: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }

  async viewBlock(args: { id: string }): Promise<CallToolResult> {
    try {
      const block = await this.schedule.getBlock(args.id);

      if (!block) {
        return {
          content: [
            {
              type: "text",
              text: `Block with ID "${args.id}" not found.`,
            },
          ],
          isError: true,
        };
      }

      return {
        content: [
          {
            type: "text",
            text: formatBlock(block, true),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error viewing block: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }

  async editBlock(args: {
    id: string;
    title?: string;
    category?: string;
    day?: string;
    startTime?: string;
    endTime?: string;
    location?: string;
    description?: string;
  }): Promise<CallToolResult> {
    try {
      const updates: EditBlockInput = {};
      if (args.title) updates.title = args.title;
      if (args.category) updates.category = args.category;
      if (args.day) updates.day = args.day as DayOfWeek;
      if (args.startTime) updates.startTime = args.startTime;
      if (args.endTime) updates.endTime = args.endTime;
      if (args.location !== undefined) updates.location = args.location;
      if (args.description !== undefined) updates.description = args.description;

      const block = await this.schedule.editBlock(args.id, updates);

      if (!block) {
        return {
          content: [
            {
              type: "text",
              text: `Block with ID "${args.id}" not found.`,
            },
          ],
          isError: true,
        };
      }

      return {
        content: [
          {
            type: "text",
            text: `Updated block:\n\n${formatBlock(block, true)}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error editing block: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }

  async deleteBlock(args: { id: string }): Promise<CallToolResult> {
    try {
      const block = await this.schedule.getBlock(args.id);
      if (!block) {
        return {
          content: [
            {
              type: "text",
              text: `Block with ID "${args.id}" not found.`,
            },
          ],
          isError: true,
        };
      }

      const success = await this.schedule.deleteBlock(args.id);

      if (!success) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to delete block "${args.id}".`,
            },
          ],
          isError: true,
        };
      }

      return {
        content: [
          {
            type: "text",
            text: `Deleted block: ${block.title} (${block.id})`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error deleting block: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }

  async searchBlocks(args: { query: string }): Promise<CallToolResult> {
    try {
      const blocks = await this.schedule.searchBlocks(args.query);

      if (blocks.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `No blocks found matching "${args.query}".`,
            },
          ],
        };
      }

      const output = blocks.map((b) => formatBlock(b)).join("\n\n");

      return {
        content: [
          {
            type: "text",
            text: `Found ${blocks.length} block(s) matching "${args.query}":\n\n${output}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error searching blocks: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }

  async getSummary(args: { includeBlocks?: boolean }): Promise<CallToolResult> {
    try {
      const summary = await this.schedule.getSummary();
      const config = this.schedule.getConfig();

      const lines: string[] = [];
      lines.push(`# ${config.projectName} - Weekly Summary\n`);
      lines.push(`**Total Blocks:** ${summary.totalBlocks}`);
      lines.push(`**Total Hours:** ${summary.totalHours.toFixed(1)}\n`);

      // Hours by category
      lines.push("## Hours by Category");
      for (const [category, hours] of Object.entries(summary.hoursByCategory)) {
        const pct = ((hours / summary.totalHours) * 100).toFixed(0);
        lines.push(`- ${capitalize(category)}: ${hours.toFixed(1)}h (${pct}%)`);
      }

      // Hours by day
      lines.push("\n## Hours by Day");
      const days: DayOfWeek[] = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
      for (const day of days) {
        const hours = summary.hoursByDay[day];
        if (hours > 0) {
          lines.push(`- ${capitalize(day)}: ${hours.toFixed(1)}h`);
        }
      }

      // Optional full block list
      if (args.includeBlocks) {
        lines.push("\n## All Blocks");
        for (const day of days) {
          const dayBlocks = summary.blocksByDay[day];
          if (dayBlocks.length === 0) continue;

          lines.push(`\n### ${capitalize(day)}`);
          for (const block of dayBlocks) {
            lines.push(`- ${formatTimeDisplay(block.startTime)}-${formatTimeDisplay(block.endTime)}: ${block.title} (${block.category})`);
          }
        }
      }

      return {
        content: [
          {
            type: "text",
            text: lines.join("\n"),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error getting summary: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }

  async findFreeSlots(args: { minDuration?: number; day?: string }): Promise<CallToolResult> {
    try {
      const slots = await this.schedule.findFreeSlots(args.minDuration || 30);

      let filtered = slots;
      if (args.day) {
        filtered = slots.filter((s) => s.day === args.day);
      }

      if (filtered.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: "No free slots found matching the criteria.",
            },
          ],
        };
      }

      const days: DayOfWeek[] = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
      const byDay: Record<string, typeof filtered> = {};
      for (const slot of filtered) {
        if (!byDay[slot.day]) byDay[slot.day] = [];
        byDay[slot.day].push(slot);
      }

      const lines: string[] = [`Found ${filtered.length} free slot(s):\n`];

      for (const day of days) {
        const daySlots = byDay[day];
        if (!daySlots) continue;

        lines.push(`\n## ${capitalize(day)}`);
        for (const slot of daySlots) {
          lines.push(`- ${formatTimeDisplay(slot.startTime)} - ${formatTimeDisplay(slot.endTime)} (${formatDuration(slot.durationMinutes)})`);
        }
      }

      return {
        content: [
          {
            type: "text",
            text: lines.join("\n"),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error finding free slots: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }
}
