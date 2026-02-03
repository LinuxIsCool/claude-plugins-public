/**
 * Schedule.md Type Definitions
 */

// Days of the week
export type DayOfWeek =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

export const DAYS_OF_WEEK: DayOfWeek[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

// Category type - any string allowed, config.json defines available categories
export type CategoryId = string;

export interface Category {
  id: string;
  label: string;
  color: string;
}

// Minimal defaults for new projects - users customize via config.json
export const DEFAULT_CATEGORIES: Record<string, Category> = {
  work: { id: "work", label: "Work", color: "#3b82f6" },
  personal: { id: "personal", label: "Personal", color: "#f97316" },
};

// Source of the schedule block
export type BlockSource = "manual" | "google-calendar" | "yoga-studio";

// Recurrence pattern
export type RecurrenceType = "none" | "weekly";

// Time in HH:MM format (24-hour)
export type TimeString = string;

/**
 * Schedule Block - The core data structure
 */
export interface ScheduleBlock {
  id: string;
  title: string;
  category: CategoryId;
  color?: string; // Override category color
  day: DayOfWeek;
  startTime: TimeString;
  endTime: TimeString;
  location?: string;
  description?: string;
  notes?: string;
  recurring: RecurrenceType;
  tags: string[];
  source: BlockSource;
  externalId?: string; // ID from external source (Google Calendar, etc.)
  calendarId?: string; // For Google Calendar events, which calendar it belongs to
  eventDate?: string; // ISO date string (YYYY-MM-DD) for date-specific events like Google Calendar
  createdAt: string;
  updatedAt: string;
}

/**
 * Block frontmatter as stored in markdown
 */
export interface BlockFrontmatter {
  id: string;
  title: string;
  category: CategoryId;
  color?: string;
  day: DayOfWeek;
  startTime: TimeString;
  endTime: TimeString;
  location?: string;
  recurring?: RecurrenceType;
  tags?: string[];
  source?: BlockSource;
  externalId?: string;
  calendarId?: string;
  eventDate?: string;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Input for creating a new block
 */
export interface CreateBlockInput {
  title: string;
  category: CategoryId;
  day: DayOfWeek;
  startTime: TimeString;
  endTime: TimeString;
  location?: string;
  description?: string;
  notes?: string;
  recurring?: RecurrenceType;
  tags?: string[];
  color?: string;
}

/**
 * Input for editing a block
 */
export interface EditBlockInput {
  title?: string;
  category?: CategoryId;
  day?: DayOfWeek;
  startTime?: TimeString;
  endTime?: TimeString;
  location?: string;
  description?: string;
  notes?: string;
  recurring?: RecurrenceType;
  tags?: string[];
  color?: string;
}

/**
 * Schedule configuration
 */
export interface CalendarConfig {
  id: string;
  name: string;
  enabled?: boolean;
}

export interface ScheduleConfig {
  projectName: string;
  weekStartsOn: DayOfWeek;
  dayStartHour: number;
  dayEndHour: number;
  timeSlotMinutes: number;
  defaultPort: number;
  categories: Record<string, Category>;
  integrations: {
    googleCalendar: {
      enabled: boolean;
      clientId?: string;
      refreshToken?: string;
      calendars?: CalendarConfig[];
    };
    yogaStudio: {
      enabled: boolean;
      url?: string;
    };
  };
}

export const DEFAULT_CONFIG: ScheduleConfig = {
  projectName: "My Schedule",
  weekStartsOn: "monday",
  dayStartHour: 6,
  dayEndHour: 22,
  timeSlotMinutes: 30,
  defaultPort: 6421,
  categories: DEFAULT_CATEGORIES,
  integrations: {
    googleCalendar: { enabled: false },
    yogaStudio: { enabled: false },
  },
};

/**
 * Filter options for listing blocks
 */
export interface BlockFilter {
  day?: DayOfWeek;
  category?: CategoryId;
  source?: BlockSource;
  tags?: string[];
}

/**
 * Schedule summary statistics
 */
export interface ScheduleSummary {
  totalBlocks: number;
  totalHours: number;
  hoursByCategory: Record<CategoryId, number>;
  hoursByDay: Record<DayOfWeek, number>;
  blocksByDay: Record<DayOfWeek, ScheduleBlock[]>;
}

/**
 * Time slot for detecting conflicts
 */
export interface TimeSlot {
  day: DayOfWeek;
  startMinutes: number; // Minutes from midnight
  endMinutes: number;
}

/**
 * Conflict between two blocks
 */
export interface BlockConflict {
  block1: ScheduleBlock;
  block2: ScheduleBlock;
  overlapMinutes: number;
}

/**
 * Free time window
 */
export interface FreeSlot {
  day: DayOfWeek;
  startTime: TimeString;
  endTime: TimeString;
  durationMinutes: number;
}

/**
 * WebSocket event types
 */
export type WSEventType = "blocks-updated" | "config-updated" | "connected" | "reload";

export interface WSEvent {
  type: WSEventType;
  data?: unknown;
}

/**
 * API response wrapper
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
