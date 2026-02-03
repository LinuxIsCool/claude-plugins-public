/**
 * Schedule.md - Public API exports
 */

export { Schedule } from "./core/schedule";
export { startServer } from "./server";

export type {
  ScheduleBlock,
  ScheduleConfig,
  CreateBlockInput,
  EditBlockInput,
  BlockFilter,
  ScheduleSummary,
  BlockConflict,
  FreeSlot,
  DayOfWeek,
  CategoryId,
  Category,
  TimeString,
  BlockSource,
  RecurrenceType,
} from "./types";

export {
  DEFAULT_CONFIG,
  DEFAULT_CATEGORIES,
  DAYS_OF_WEEK,
} from "./types";
