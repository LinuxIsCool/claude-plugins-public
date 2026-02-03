/**
 * Time utility functions
 */

import type { TimeString, DayOfWeek, DAYS_OF_WEEK } from "../types";

/**
 * Parse HH:MM time string to minutes from midnight
 */
export function timeToMinutes(time: TimeString): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

/**
 * Convert minutes from midnight to HH:MM format
 */
export function minutesToTime(minutes: number): TimeString {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;
}

/**
 * Calculate duration in minutes between two times
 */
export function getDurationMinutes(startTime: TimeString, endTime: TimeString): number {
  return timeToMinutes(endTime) - timeToMinutes(startTime);
}

/**
 * Format duration in minutes to human-readable string
 */
export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

/**
 * Check if a time string is valid HH:MM format
 */
export function isValidTime(time: string): boolean {
  const regex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
  return regex.test(time);
}

/**
 * Normalize time to HH:MM format (e.g., "9:00" -> "09:00")
 */
export function normalizeTime(time: string): TimeString {
  const [hours, minutes] = time.split(":").map(Number);
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
}

/**
 * Check if two time ranges overlap
 */
export function timesOverlap(
  start1: TimeString,
  end1: TimeString,
  start2: TimeString,
  end2: TimeString
): boolean {
  const s1 = timeToMinutes(start1);
  const e1 = timeToMinutes(end1);
  const s2 = timeToMinutes(start2);
  const e2 = timeToMinutes(end2);
  return s1 < e2 && s2 < e1;
}

/**
 * Calculate overlap in minutes between two time ranges
 */
export function getOverlapMinutes(
  start1: TimeString,
  end1: TimeString,
  start2: TimeString,
  end2: TimeString
): number {
  const s1 = timeToMinutes(start1);
  const e1 = timeToMinutes(end1);
  const s2 = timeToMinutes(start2);
  const e2 = timeToMinutes(end2);

  const overlapStart = Math.max(s1, s2);
  const overlapEnd = Math.min(e1, e2);

  return Math.max(0, overlapEnd - overlapStart);
}

/**
 * Format time for display (12-hour format with AM/PM)
 */
export function formatTimeDisplay(time: TimeString): string {
  const [hours, minutes] = time.split(":").map(Number);
  const period = hours >= 12 ? "PM" : "AM";
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${minutes.toString().padStart(2, "0")} ${period}`;
}

/**
 * Get day index (0 = Monday, 6 = Sunday)
 */
export function getDayIndex(day: DayOfWeek): number {
  const days: DayOfWeek[] = [
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
  ];
  return days.indexOf(day);
}

/**
 * Get day name from index
 */
export function getDayFromIndex(index: number): DayOfWeek {
  const days: DayOfWeek[] = [
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
  ];
  return days[index];
}

/**
 * Capitalize first letter
 */
export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Get the dates for the current week based on weekStartsOn config
 * Returns a map of DayOfWeek -> Date
 */
export function getWeekDates(weekStartsOn: DayOfWeek = "monday"): Map<DayOfWeek, Date> {
  const today = new Date();
  const currentDayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, ...

  // Map DayOfWeek to JS Date day index (0 = Sunday)
  const dayToJsIndex: Record<DayOfWeek, number> = {
    sunday: 0,
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6,
  };

  // Order of days starting from weekStartsOn
  const orderedDays: DayOfWeek[] = [
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
  ];

  // Calculate the start of the week
  const weekStartJsIndex = dayToJsIndex[weekStartsOn];
  let daysToSubtract = currentDayOfWeek - weekStartJsIndex;
  if (daysToSubtract < 0) daysToSubtract += 7;

  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - daysToSubtract);
  weekStart.setHours(0, 0, 0, 0);

  // Build the map
  const result = new Map<DayOfWeek, Date>();
  for (let i = 0; i < 7; i++) {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + i);
    result.set(orderedDays[i], date);
  }

  return result;
}

/**
 * Check if a date string (YYYY-MM-DD) is in the current week
 */
export function isDateInCurrentWeek(
  dateStr: string,
  weekStartsOn: DayOfWeek = "monday"
): boolean {
  const weekDates = getWeekDates(weekStartsOn);
  const targetDate = new Date(dateStr + "T00:00:00");

  // Get the first and last date of the week
  const dates = Array.from(weekDates.values());
  const weekStartDate = dates[0];
  const weekEndDate = dates[6];

  // Set to end of the last day
  const weekEnd = new Date(weekEndDate);
  weekEnd.setHours(23, 59, 59, 999);

  return targetDate >= weekStartDate && targetDate <= weekEnd;
}

/**
 * Format date as "Dec 17"
 */
export function formatDateShort(date: Date): string {
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
  ];
  return `${months[date.getMonth()]} ${date.getDate()}`;
}
