/**
 * JSON schemas for block MCP tools
 */

import type { ScheduleConfig } from "../../../types";

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const DEFAULT_CATEGORIES = ["yoga", "work", "class", "personal", "meeting", "blocked"];

export function getBlockCreateSchema(config?: ScheduleConfig) {
  const categories = config
    ? Object.keys(config.categories)
    : DEFAULT_CATEGORIES;

  return {
    type: "object" as const,
    properties: {
      title: {
        type: "string",
        description: "Title of the schedule block",
      },
      category: {
        type: "string",
        enum: categories,
        description: "Category of the block (determines color)",
      },
      day: {
        type: "string",
        enum: DAYS,
        description: "Day of the week",
      },
      startTime: {
        type: "string",
        pattern: "^([01]?[0-9]|2[0-3]):[0-5][0-9]$",
        description: "Start time in HH:MM format (24-hour)",
      },
      endTime: {
        type: "string",
        pattern: "^([01]?[0-9]|2[0-3]):[0-5][0-9]$",
        description: "End time in HH:MM format (24-hour)",
      },
      location: {
        type: "string",
        description: "Optional location for the block",
      },
      description: {
        type: "string",
        description: "Optional description",
      },
      recurring: {
        type: "string",
        enum: ["none", "weekly"],
        default: "weekly",
        description: "Recurrence pattern",
      },
      tags: {
        type: "array",
        items: { type: "string" },
        description: "Optional tags for organization",
      },
    },
    required: ["title", "category", "day", "startTime", "endTime"],
  };
}

export const blockListSchema = {
  type: "object" as const,
  properties: {
    day: {
      type: "string",
      enum: DAYS,
      description: "Filter by day of week",
    },
    category: {
      type: "string",
      description: "Filter by category",
    },
    source: {
      type: "string",
      enum: ["manual", "google-calendar", "yoga-studio"],
      description: "Filter by source",
    },
  },
};

export const blockViewSchema = {
  type: "object" as const,
  properties: {
    id: {
      type: "string",
      description: "Block ID to view",
    },
  },
  required: ["id"],
};

export function getBlockEditSchema(config?: ScheduleConfig) {
  const categories = config
    ? Object.keys(config.categories)
    : DEFAULT_CATEGORIES;

  return {
    type: "object" as const,
    properties: {
      id: {
        type: "string",
        description: "Block ID to edit",
      },
      title: {
        type: "string",
        description: "New title",
      },
      category: {
        type: "string",
        enum: categories,
        description: "New category",
      },
      day: {
        type: "string",
        enum: DAYS,
        description: "New day of week",
      },
      startTime: {
        type: "string",
        pattern: "^([01]?[0-9]|2[0-3]):[0-5][0-9]$",
        description: "New start time",
      },
      endTime: {
        type: "string",
        pattern: "^([01]?[0-9]|2[0-3]):[0-5][0-9]$",
        description: "New end time",
      },
      location: {
        type: "string",
        description: "New location",
      },
      description: {
        type: "string",
        description: "New description",
      },
    },
    required: ["id"],
  };
}

export const blockDeleteSchema = {
  type: "object" as const,
  properties: {
    id: {
      type: "string",
      description: "Block ID to delete",
    },
  },
  required: ["id"],
};

export const blockSearchSchema = {
  type: "object" as const,
  properties: {
    query: {
      type: "string",
      description: "Search query (matches title, category, location, description, tags)",
    },
  },
  required: ["query"],
};

export const scheduleSummarySchema = {
  type: "object" as const,
  properties: {
    includeBlocks: {
      type: "boolean",
      default: false,
      description: "Include full block list in summary",
    },
  },
};

export const freeSlotsSchema = {
  type: "object" as const,
  properties: {
    minDuration: {
      type: "number",
      default: 30,
      description: "Minimum slot duration in minutes",
    },
    day: {
      type: "string",
      enum: DAYS,
      description: "Filter to specific day",
    },
  },
};

export const scheduleInitSchema = {
  type: "object" as const,
  properties: {
    projectName: {
      type: "string",
      description: "Name for your schedule",
      default: "My Schedule",
    },
  },
};
