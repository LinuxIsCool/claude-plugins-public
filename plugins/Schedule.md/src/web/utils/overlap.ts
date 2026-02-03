/**
 * Overlap Detection for Schedule Blocks
 *
 * Calculates side-by-side layout when blocks overlap.
 * Uses a greedy column assignment algorithm.
 */

import type { ScheduleBlock } from "../../types";

export interface BlockLayout {
  block: ScheduleBlock;
  column: number; // 0-indexed column position
  totalColumns: number; // Total columns needed for overlapping group
}

/**
 * Parse time string to minutes since midnight
 */
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

/**
 * Check if two blocks overlap in time
 */
function blocksOverlap(a: ScheduleBlock, b: ScheduleBlock): boolean {
  const aStart = timeToMinutes(a.startTime);
  const aEnd = timeToMinutes(a.endTime);
  const bStart = timeToMinutes(b.startTime);
  const bEnd = timeToMinutes(b.endTime);

  // Overlap if one starts before the other ends
  return aStart < bEnd && bStart < aEnd;
}

/**
 * Calculate layouts for blocks that may overlap.
 * Assigns column positions for side-by-side rendering.
 *
 * Algorithm:
 * 1. Sort blocks by start time
 * 2. For each block, find the leftmost column where it doesn't overlap
 *    with any block already in that column
 * 3. Track which blocks are in which columns
 * 4. After assignment, calculate max columns for each overlap group
 */
export function calculateBlockLayouts(blocks: ScheduleBlock[]): BlockLayout[] {
  if (blocks.length === 0) return [];
  if (blocks.length === 1) {
    return [{ block: blocks[0], column: 0, totalColumns: 1 }];
  }

  // Sort by start time, then by end time (shorter first for tie-breaking)
  const sorted = [...blocks].sort((a, b) => {
    const startDiff = timeToMinutes(a.startTime) - timeToMinutes(b.startTime);
    if (startDiff !== 0) return startDiff;
    return timeToMinutes(a.endTime) - timeToMinutes(b.endTime);
  });

  // Track column assignments: column -> blocks in that column
  const columns: ScheduleBlock[][] = [];

  // Track block -> column mapping
  const blockColumns = new Map<string, number>();

  for (const block of sorted) {
    // Find the leftmost column where this block doesn't overlap
    let placed = false;

    for (let colIndex = 0; colIndex < columns.length; colIndex++) {
      const colBlocks = columns[colIndex];

      // Check if block overlaps with any block in this column
      const hasOverlap = colBlocks.some((existing) =>
        blocksOverlap(existing, block)
      );

      if (!hasOverlap) {
        // Place in this column
        colBlocks.push(block);
        blockColumns.set(block.id, colIndex);
        placed = true;
        break;
      }
    }

    if (!placed) {
      // Need a new column
      columns.push([block]);
      blockColumns.set(block.id, columns.length - 1);
    }
  }

  // Now calculate totalColumns for each block's overlap group
  // A block's totalColumns is the max column index + 1 of all blocks it overlaps with

  const result: BlockLayout[] = [];

  for (const block of sorted) {
    const column = blockColumns.get(block.id) ?? 0;

    // Find all blocks that overlap with this one
    const overlappingBlocks = sorted.filter(
      (other) => other.id !== block.id && blocksOverlap(block, other)
    );

    // Get max column among overlapping blocks (including self)
    let maxColumn = column;
    for (const overlapping of overlappingBlocks) {
      const otherCol = blockColumns.get(overlapping.id) ?? 0;
      maxColumn = Math.max(maxColumn, otherCol);
    }

    const totalColumns = maxColumn + 1;

    result.push({
      block,
      column,
      totalColumns,
    });
  }

  return result;
}

/**
 * Group blocks by whether they overlap.
 * Returns groups of blocks that share at least one overlapping block.
 * Used for debugging/visualization.
 */
export function groupOverlappingBlocks(
  blocks: ScheduleBlock[]
): ScheduleBlock[][] {
  if (blocks.length === 0) return [];

  const groups: ScheduleBlock[][] = [];
  const assigned = new Set<string>();

  for (const block of blocks) {
    if (assigned.has(block.id)) continue;

    // Start a new group with this block
    const group: ScheduleBlock[] = [block];
    assigned.add(block.id);

    // Find all blocks that overlap with any block in the group (transitive)
    let changed = true;
    while (changed) {
      changed = false;
      for (const other of blocks) {
        if (assigned.has(other.id)) continue;

        // Check if other overlaps with any block in the group
        const overlapsWithGroup = group.some((g) => blocksOverlap(g, other));
        if (overlapsWithGroup) {
          group.push(other);
          assigned.add(other.id);
          changed = true;
        }
      }
    }

    groups.push(group);
  }

  return groups;
}
