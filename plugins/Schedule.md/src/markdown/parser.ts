/**
 * Markdown parser for schedule blocks
 */

import matter from "gray-matter";
import type {
  ScheduleBlock,
  BlockFrontmatter,
  DayOfWeek,
  BlockSource,
  RecurrenceType,
  DAYS_OF_WEEK,
} from "../types";

const VALID_DAYS: DayOfWeek[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

const VALID_SOURCES: BlockSource[] = ["manual", "google-calendar", "yoga-studio"];

/**
 * Parse a markdown file content into a ScheduleBlock
 */
export function parseBlockMarkdown(content: string, filePath: string): ScheduleBlock {
  const { data, content: body } = matter(content);
  const fm = data as Partial<BlockFrontmatter>;

  // Validate required fields
  if (!fm.id) throw new Error(`Missing required field 'id' in ${filePath}`);
  if (!fm.title) throw new Error(`Missing required field 'title' in ${filePath}`);
  if (!fm.category) throw new Error(`Missing required field 'category' in ${filePath}`);
  if (!fm.day) throw new Error(`Missing required field 'day' in ${filePath}`);
  if (!fm.startTime) throw new Error(`Missing required field 'startTime' in ${filePath}`);
  if (!fm.endTime) throw new Error(`Missing required field 'endTime' in ${filePath}`);

  // Validate day
  const day = fm.day.toLowerCase() as DayOfWeek;
  if (!VALID_DAYS.includes(day)) {
    throw new Error(`Invalid day '${fm.day}' in ${filePath}. Must be one of: ${VALID_DAYS.join(", ")}`);
  }

  // Parse description and notes from body
  const { description, notes } = parseBody(body);

  // Validate source
  const source = (fm.source || "manual") as BlockSource;
  if (!VALID_SOURCES.includes(source)) {
    throw new Error(`Invalid source '${source}' in ${filePath}`);
  }

  const now = new Date().toISOString();

  return {
    id: fm.id,
    title: fm.title,
    category: fm.category,
    color: fm.color,
    day,
    startTime: fm.startTime,
    endTime: fm.endTime,
    location: fm.location,
    description,
    notes,
    recurring: (fm.recurring || "weekly") as RecurrenceType,
    tags: fm.tags || [],
    source,
    externalId: fm.externalId,
    calendarId: fm.calendarId,
    eventDate: fm.eventDate,
    createdAt: fm.createdAt || now,
    updatedAt: fm.updatedAt || now,
  };
}

/**
 * Parse the markdown body to extract description and notes sections
 */
function parseBody(body: string): { description?: string; notes?: string } {
  const trimmed = body.trim();
  if (!trimmed) return {};

  let description: string | undefined;
  let notes: string | undefined;

  // Split by ## Notes header
  const notesMatch = trimmed.match(/## Notes\s*\n([\s\S]*?)(?=##|$)/i);
  if (notesMatch) {
    notes = notesMatch[1].trim();
  }

  // Everything before ## Notes (or the whole thing if no notes) is description
  const beforeNotes = trimmed.split(/## Notes/i)[0];

  // Remove the title header (# Title) if present
  const withoutTitle = beforeNotes.replace(/^#[^#].*\n?/, "").trim();

  if (withoutTitle) {
    description = withoutTitle;
  }

  return { description, notes };
}

/**
 * Extract block ID from filename
 * Format: "block-id - Title.md" or "block-id.md"
 */
export function extractIdFromFilename(filename: string): string {
  // Remove .md extension
  const withoutExt = filename.replace(/\.md$/, "");
  // If contains " - ", take the part before it
  const parts = withoutExt.split(" - ");
  return parts[0].trim();
}

/**
 * Generate filename from block
 */
export function generateFilename(block: ScheduleBlock): string {
  const sanitizedTitle = block.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
  return `${block.id} - ${sanitizedTitle}.md`;
}
