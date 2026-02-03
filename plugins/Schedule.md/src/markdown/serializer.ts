/**
 * Markdown serializer for schedule blocks
 */

import type { ScheduleBlock, BlockFrontmatter } from "../types";

/**
 * Serialize a ScheduleBlock to markdown format
 */
export function serializeBlockToMarkdown(block: ScheduleBlock): string {
  const frontmatter = buildFrontmatter(block);
  const body = buildBody(block);

  return `---\n${frontmatter}---\n\n${body}`;
}

/**
 * Build YAML frontmatter from block
 */
function buildFrontmatter(block: ScheduleBlock): string {
  const lines: string[] = [];

  lines.push(`id: ${block.id}`);
  lines.push(`title: "${escapeYamlString(block.title)}"`);
  lines.push(`category: ${block.category}`);

  if (block.color) {
    lines.push(`color: "${block.color}"`);
  }

  lines.push(`day: ${block.day}`);
  lines.push(`startTime: "${block.startTime}"`);
  lines.push(`endTime: "${block.endTime}"`);

  if (block.location) {
    lines.push(`location: "${escapeYamlString(block.location)}"`);
  }

  lines.push(`recurring: ${block.recurring}`);

  if (block.tags.length > 0) {
    lines.push(`tags: [${block.tags.map(t => `"${escapeYamlString(t)}"`).join(", ")}]`);
  }

  lines.push(`source: ${block.source}`);

  if (block.externalId) {
    lines.push(`externalId: "${block.externalId}"`);
  }

  if (block.calendarId) {
    lines.push(`calendarId: "${block.calendarId}"`);
  }

  if (block.eventDate) {
    lines.push(`eventDate: "${block.eventDate}"`);
  }

  lines.push(`createdAt: "${block.createdAt}"`);
  lines.push(`updatedAt: "${block.updatedAt}"`);

  return lines.join("\n") + "\n";
}

/**
 * Build markdown body from block
 */
function buildBody(block: ScheduleBlock): string {
  const sections: string[] = [];

  // Title
  sections.push(`# ${block.title}`);

  // Description
  if (block.description) {
    sections.push("");
    sections.push(block.description);
  }

  // Notes section
  if (block.notes) {
    sections.push("");
    sections.push("## Notes");
    sections.push("");
    sections.push(block.notes);
  }

  return sections.join("\n") + "\n";
}

/**
 * Escape special characters in YAML strings
 */
function escapeYamlString(str: string): string {
  return str
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n");
}

/**
 * Update only specific fields in existing markdown content
 */
export function updateBlockMarkdown(
  existingContent: string,
  updates: Partial<ScheduleBlock>
): string {
  // Parse existing
  const matter = require("gray-matter");
  const { data, content: body } = matter(existingContent);

  // Apply updates to frontmatter
  const updatedData = { ...data };

  if (updates.title !== undefined) updatedData.title = updates.title;
  if (updates.category !== undefined) updatedData.category = updates.category;
  if (updates.color !== undefined) updatedData.color = updates.color;
  if (updates.day !== undefined) updatedData.day = updates.day;
  if (updates.startTime !== undefined) updatedData.startTime = updates.startTime;
  if (updates.endTime !== undefined) updatedData.endTime = updates.endTime;
  if (updates.location !== undefined) updatedData.location = updates.location;
  if (updates.recurring !== undefined) updatedData.recurring = updates.recurring;
  if (updates.tags !== undefined) updatedData.tags = updates.tags;

  // Update timestamp
  updatedData.updatedAt = new Date().toISOString();

  // Rebuild markdown
  const block: ScheduleBlock = {
    id: updatedData.id,
    title: updatedData.title,
    category: updatedData.category,
    color: updatedData.color,
    day: updatedData.day,
    startTime: updatedData.startTime,
    endTime: updatedData.endTime,
    location: updatedData.location,
    description: updates.description,
    notes: updates.notes,
    recurring: updatedData.recurring || "weekly",
    tags: updatedData.tags || [],
    source: updatedData.source || "manual",
    externalId: updatedData.externalId,
    calendarId: updatedData.calendarId,
    createdAt: updatedData.createdAt,
    updatedAt: updatedData.updatedAt,
  };

  return serializeBlockToMarkdown(block);
}
