/**
 * Core Schedule class - main business logic
 */

import type {
  ScheduleBlock,
  ScheduleConfig,
  CreateBlockInput,
  EditBlockInput,
  BlockFilter,
  ScheduleSummary,
  BlockConflict,
  FreeSlot,
  DayOfWeek,
  DAYS_OF_WEEK,
  DEFAULT_CONFIG,
} from "../types";
import {
  loadConfig,
  saveConfig,
  loadAllBlocks,
  loadBlockById,
  saveBlock,
  deleteBlock,
  initializeScheduleDir,
  findScheduleRoot,
} from "../file-system/operations";
import {
  timeToMinutes,
  minutesToTime,
  getDurationMinutes,
  timesOverlap,
  getOverlapMinutes,
} from "../utils/time";

const DAYS: DayOfWeek[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

/**
 * Generate a unique block ID
 */
function generateBlockId(existingIds: string[]): string {
  const existingNumbers = existingIds
    .filter((id) => id.startsWith("block-"))
    .map((id) => parseInt(id.replace("block-", ""), 10))
    .filter((n) => !isNaN(n));

  const maxNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) : 0;
  return `block-${maxNumber + 1}`;
}

export class Schedule {
  private scheduleDir: string;
  private config: ScheduleConfig | null = null;
  private blocks: Map<string, ScheduleBlock> = new Map();
  private initialized = false;

  constructor(scheduleDir: string) {
    this.scheduleDir = scheduleDir;
  }

  /**
   * Initialize or load the schedule
   */
  async init(): Promise<void> {
    if (this.initialized) return;

    // Load config
    this.config = await loadConfig(this.scheduleDir);

    // Load all blocks
    const blocks = await loadAllBlocks(this.scheduleDir);
    this.blocks.clear();
    for (const block of blocks) {
      this.blocks.set(block.id, block);
    }

    this.initialized = true;
  }

  /**
   * Create a new schedule in a directory
   */
  static async create(rootDir: string, projectName: string = "My Schedule"): Promise<Schedule> {
    await initializeScheduleDir(rootDir);

    const scheduleDir = `${rootDir}/schedule`;
    const { DEFAULT_CONFIG } = await import("../types");

    const config: ScheduleConfig = {
      ...DEFAULT_CONFIG,
      projectName,
    };

    await saveConfig(scheduleDir, config);

    const schedule = new Schedule(scheduleDir);
    await schedule.init();

    return schedule;
  }

  /**
   * Find and load an existing schedule
   */
  static async find(startDir: string = process.cwd()): Promise<Schedule | null> {
    const scheduleDir = await findScheduleRoot(startDir);
    if (!scheduleDir) return null;

    const schedule = new Schedule(scheduleDir);
    await schedule.init();

    return schedule;
  }

  /**
   * Get configuration
   */
  getConfig(): ScheduleConfig {
    if (!this.config) throw new Error("Schedule not initialized");
    return this.config;
  }

  /**
   * Update configuration
   */
  async updateConfig(updates: Partial<ScheduleConfig>): Promise<ScheduleConfig> {
    if (!this.config) throw new Error("Schedule not initialized");

    this.config = { ...this.config, ...updates };
    await saveConfig(this.scheduleDir, this.config);

    return this.config;
  }

  /**
   * Create a new block
   */
  async createBlock(input: CreateBlockInput): Promise<ScheduleBlock> {
    if (!this.initialized) await this.init();

    const existingIds = Array.from(this.blocks.keys());
    const id = generateBlockId(existingIds);
    const now = new Date().toISOString();

    const block: ScheduleBlock = {
      id,
      title: input.title,
      category: input.category,
      color: input.color,
      day: input.day,
      startTime: input.startTime,
      endTime: input.endTime,
      location: input.location,
      description: input.description,
      notes: input.notes,
      recurring: input.recurring || "weekly",
      tags: input.tags || [],
      source: "manual",
      createdAt: now,
      updatedAt: now,
    };

    // Check for conflicts
    const conflicts = this.findConflicts(block);
    if (conflicts.length > 0) {
      const conflictInfo = conflicts
        .map((c) => `"${c.block2.title}" (${c.block2.startTime}-${c.block2.endTime})`)
        .join(", ");
      console.warn(`Warning: Block conflicts with: ${conflictInfo}`);
    }

    await saveBlock(this.scheduleDir, block);
    this.blocks.set(block.id, block);

    return block;
  }

  /**
   * Get a block by ID
   */
  async getBlock(id: string): Promise<ScheduleBlock | null> {
    if (!this.initialized) await this.init();
    return this.blocks.get(id) || null;
  }

  /**
   * List all blocks with optional filtering
   */
  async listBlocks(filter?: BlockFilter): Promise<ScheduleBlock[]> {
    if (!this.initialized) await this.init();

    let blocks = Array.from(this.blocks.values());

    if (filter) {
      if (filter.day) {
        blocks = blocks.filter((b) => b.day === filter.day);
      }
      if (filter.category) {
        blocks = blocks.filter((b) => b.category === filter.category);
      }
      if (filter.source) {
        blocks = blocks.filter((b) => b.source === filter.source);
      }
      if (filter.tags && filter.tags.length > 0) {
        blocks = blocks.filter((b) => filter.tags!.some((t) => b.tags.includes(t)));
      }
    }

    // Sort by day, then start time
    return blocks.sort((a, b) => {
      const dayDiff = DAYS.indexOf(a.day) - DAYS.indexOf(b.day);
      if (dayDiff !== 0) return dayDiff;
      return timeToMinutes(a.startTime) - timeToMinutes(b.startTime);
    });
  }

  /**
   * Edit an existing block
   */
  async editBlock(id: string, updates: EditBlockInput): Promise<ScheduleBlock | null> {
    if (!this.initialized) await this.init();

    const existing = this.blocks.get(id);
    if (!existing) return null;

    const updated: ScheduleBlock = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    // Check for conflicts (excluding self)
    const conflicts = this.findConflicts(updated).filter((c) => c.block2.id !== id);
    if (conflicts.length > 0) {
      const conflictInfo = conflicts
        .map((c) => `"${c.block2.title}" (${c.block2.startTime}-${c.block2.endTime})`)
        .join(", ");
      console.warn(`Warning: Block conflicts with: ${conflictInfo}`);
    }

    await saveBlock(this.scheduleDir, updated);
    this.blocks.set(id, updated);

    return updated;
  }

  /**
   * Delete a block
   */
  async deleteBlock(id: string): Promise<boolean> {
    if (!this.initialized) await this.init();

    const success = await deleteBlock(this.scheduleDir, id);
    if (success) {
      this.blocks.delete(id);
    }

    return success;
  }

  /**
   * Search blocks by text
   */
  async searchBlocks(query: string): Promise<ScheduleBlock[]> {
    if (!this.initialized) await this.init();

    const lowerQuery = query.toLowerCase();

    return Array.from(this.blocks.values()).filter((block) => {
      return (
        block.title.toLowerCase().includes(lowerQuery) ||
        block.category.toLowerCase().includes(lowerQuery) ||
        block.location?.toLowerCase().includes(lowerQuery) ||
        block.description?.toLowerCase().includes(lowerQuery) ||
        block.tags.some((t) => t.toLowerCase().includes(lowerQuery))
      );
    });
  }

  /**
   * Get schedule summary with statistics
   */
  async getSummary(): Promise<ScheduleSummary> {
    if (!this.initialized) await this.init();

    const blocks = Array.from(this.blocks.values());

    const hoursByCategory: Record<string, number> = {};
    const hoursByDay: Record<DayOfWeek, number> = {
      monday: 0,
      tuesday: 0,
      wednesday: 0,
      thursday: 0,
      friday: 0,
      saturday: 0,
      sunday: 0,
    };
    const blocksByDay: Record<DayOfWeek, ScheduleBlock[]> = {
      monday: [],
      tuesday: [],
      wednesday: [],
      thursday: [],
      friday: [],
      saturday: [],
      sunday: [],
    };

    let totalMinutes = 0;

    for (const block of blocks) {
      const duration = getDurationMinutes(block.startTime, block.endTime);
      const hours = duration / 60;

      totalMinutes += duration;

      // By category
      hoursByCategory[block.category] = (hoursByCategory[block.category] || 0) + hours;

      // By day
      hoursByDay[block.day] += hours;
      blocksByDay[block.day].push(block);
    }

    // Sort blocks within each day
    for (const day of DAYS) {
      blocksByDay[day].sort(
        (a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime)
      );
    }

    return {
      totalBlocks: blocks.length,
      totalHours: totalMinutes / 60,
      hoursByCategory,
      hoursByDay,
      blocksByDay,
    };
  }

  /**
   * Find conflicts for a block
   */
  findConflicts(block: ScheduleBlock): BlockConflict[] {
    const conflicts: BlockConflict[] = [];

    for (const existing of this.blocks.values()) {
      if (existing.id === block.id) continue;
      if (existing.day !== block.day) continue;

      if (timesOverlap(block.startTime, block.endTime, existing.startTime, existing.endTime)) {
        conflicts.push({
          block1: block,
          block2: existing,
          overlapMinutes: getOverlapMinutes(
            block.startTime,
            block.endTime,
            existing.startTime,
            existing.endTime
          ),
        });
      }
    }

    return conflicts;
  }

  /**
   * Find free time slots
   */
  async findFreeSlots(minDurationMinutes: number = 30): Promise<FreeSlot[]> {
    if (!this.initialized) await this.init();
    if (!this.config) throw new Error("Schedule not initialized");

    const freeSlots: FreeSlot[] = [];
    const dayStartMinutes = this.config.dayStartHour * 60;
    const dayEndMinutes = this.config.dayEndHour * 60;

    for (const day of DAYS) {
      const dayBlocks = Array.from(this.blocks.values())
        .filter((b) => b.day === day)
        .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));

      let currentTime = dayStartMinutes;

      for (const block of dayBlocks) {
        const blockStart = timeToMinutes(block.startTime);

        if (blockStart > currentTime) {
          const duration = blockStart - currentTime;
          if (duration >= minDurationMinutes) {
            freeSlots.push({
              day,
              startTime: minutesToTime(currentTime),
              endTime: minutesToTime(blockStart),
              durationMinutes: duration,
            });
          }
        }

        currentTime = Math.max(currentTime, timeToMinutes(block.endTime));
      }

      // Check for free time after last block
      if (currentTime < dayEndMinutes) {
        const duration = dayEndMinutes - currentTime;
        if (duration >= minDurationMinutes) {
          freeSlots.push({
            day,
            startTime: minutesToTime(currentTime),
            endTime: minutesToTime(dayEndMinutes),
            durationMinutes: duration,
          });
        }
      }
    }

    return freeSlots;
  }

  /**
   * Reload data from disk
   */
  async reload(): Promise<void> {
    this.initialized = false;
    await this.init();
  }

  /**
   * Get schedule directory path
   */
  getScheduleDir(): string {
    return this.scheduleDir;
  }
}
