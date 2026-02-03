import { describe, expect, test } from "bun:test";
import {
  timeToMinutes,
  minutesToTime,
  getDurationMinutes,
  formatDuration,
  isValidTime,
  normalizeTime,
  timesOverlap,
  getOverlapMinutes,
  formatTimeDisplay,
  getDayIndex,
  getDayFromIndex,
  capitalize,
} from "./time";

describe("timeToMinutes", () => {
  test("converts midnight", () => {
    expect(timeToMinutes("00:00")).toBe(0);
  });

  test("converts noon", () => {
    expect(timeToMinutes("12:00")).toBe(720);
  });

  test("converts with minutes", () => {
    expect(timeToMinutes("09:30")).toBe(570);
    expect(timeToMinutes("17:45")).toBe(1065);
  });

  test("converts end of day", () => {
    expect(timeToMinutes("23:59")).toBe(1439);
  });
});

describe("minutesToTime", () => {
  test("converts 0 to midnight", () => {
    expect(minutesToTime(0)).toBe("00:00");
  });

  test("converts 720 to noon", () => {
    expect(minutesToTime(720)).toBe("12:00");
  });

  test("pads single digits", () => {
    expect(minutesToTime(65)).toBe("01:05");
  });
});

describe("getDurationMinutes", () => {
  test("calculates 1 hour", () => {
    expect(getDurationMinutes("09:00", "10:00")).toBe(60);
  });

  test("calculates partial hours", () => {
    expect(getDurationMinutes("13:30", "14:45")).toBe(75);
  });

  test("calculates multi-hour", () => {
    expect(getDurationMinutes("07:00", "12:00")).toBe(300);
  });
});

describe("formatDuration", () => {
  test("formats minutes only", () => {
    expect(formatDuration(30)).toBe("30m");
  });

  test("formats hours only", () => {
    expect(formatDuration(120)).toBe("2h");
  });

  test("formats hours and minutes", () => {
    expect(formatDuration(90)).toBe("1h 30m");
    expect(formatDuration(75)).toBe("1h 15m");
  });
});

describe("isValidTime", () => {
  test("accepts valid times", () => {
    expect(isValidTime("00:00")).toBe(true);
    expect(isValidTime("09:30")).toBe(true);
    expect(isValidTime("23:59")).toBe(true);
  });

  test("rejects invalid times", () => {
    expect(isValidTime("24:00")).toBe(false);
    expect(isValidTime("12:60")).toBe(false);
    expect(isValidTime("invalid")).toBe(false);
    expect(isValidTime("")).toBe(false);
  });
});

describe("normalizeTime", () => {
  test("pads single digit hours", () => {
    expect(normalizeTime("9:00")).toBe("09:00");
  });

  test("preserves double digit hours", () => {
    expect(normalizeTime("12:30")).toBe("12:30");
  });
});

describe("timesOverlap", () => {
  test("detects overlap", () => {
    expect(timesOverlap("09:00", "10:00", "09:30", "10:30")).toBe(true);
  });

  test("detects no overlap - adjacent", () => {
    expect(timesOverlap("09:00", "10:00", "10:00", "11:00")).toBe(false);
  });

  test("detects no overlap - separate", () => {
    expect(timesOverlap("09:00", "10:00", "14:00", "15:00")).toBe(false);
  });

  test("detects containment", () => {
    expect(timesOverlap("09:00", "12:00", "10:00", "11:00")).toBe(true);
  });
});

describe("getOverlapMinutes", () => {
  test("calculates partial overlap", () => {
    expect(getOverlapMinutes("09:00", "10:00", "09:30", "10:30")).toBe(30);
  });

  test("returns 0 for no overlap", () => {
    expect(getOverlapMinutes("09:00", "10:00", "14:00", "15:00")).toBe(0);
  });

  test("calculates full containment", () => {
    expect(getOverlapMinutes("09:00", "12:00", "10:00", "11:00")).toBe(60);
  });
});

describe("formatTimeDisplay", () => {
  test("formats AM times", () => {
    expect(formatTimeDisplay("09:30")).toBe("9:30 AM");
  });

  test("formats PM times", () => {
    expect(formatTimeDisplay("17:30")).toBe("5:30 PM");
  });

  test("formats noon", () => {
    expect(formatTimeDisplay("12:00")).toBe("12:00 PM");
  });

  test("formats midnight", () => {
    expect(formatTimeDisplay("00:00")).toBe("12:00 AM");
  });
});

describe("getDayIndex / getDayFromIndex", () => {
  test("monday is 0", () => {
    expect(getDayIndex("monday")).toBe(0);
    expect(getDayFromIndex(0)).toBe("monday");
  });

  test("sunday is 6", () => {
    expect(getDayIndex("sunday")).toBe(6);
    expect(getDayFromIndex(6)).toBe("sunday");
  });

  test("roundtrip all days", () => {
    const days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;
    for (const day of days) {
      expect(getDayFromIndex(getDayIndex(day))).toBe(day);
    }
  });
});

describe("capitalize", () => {
  test("capitalizes lowercase", () => {
    expect(capitalize("monday")).toBe("Monday");
  });

  test("preserves already capitalized", () => {
    expect(capitalize("Monday")).toBe("Monday");
  });
});
