import { describe, expect, test } from "bun:test";
import {
  parseBlockMarkdown,
  extractIdFromFilename,
  generateFilename,
} from "./parser";
import type { ScheduleBlock } from "../types";

describe("parseBlockMarkdown", () => {
  const validFrontmatter = `---
id: test-123
title: Morning Yoga
category: yoga
day: monday
startTime: "09:00"
endTime: "10:00"
---`;

  test("parses valid block with minimal fields", () => {
    const block = parseBlockMarkdown(validFrontmatter, "test.md");
    expect(block.id).toBe("test-123");
    expect(block.title).toBe("Morning Yoga");
    expect(block.category).toBe("yoga");
    expect(block.day).toBe("monday");
    expect(block.startTime).toBe("09:00");
    expect(block.endTime).toBe("10:00");
    expect(block.recurring).toBe("weekly");
    expect(block.source).toBe("manual");
    expect(block.tags).toEqual([]);
  });

  test("parses block with all optional fields", () => {
    const content = `---
id: full-block
title: Team Meeting
category: work
day: tuesday
startTime: "14:00"
endTime: "15:30"
location: Conference Room A
recurring: weekly
tags:
  - standup
  - team
source: manual
color: "#ff0000"
---

This is the meeting description.

## Notes

Remember to bring the report.
`;
    const block = parseBlockMarkdown(content, "test.md");
    expect(block.location).toBe("Conference Room A");
    expect(block.tags).toEqual(["standup", "team"]);
    expect(block.color).toBe("#ff0000");
    expect(block.description).toBe("This is the meeting description.");
    expect(block.notes).toBe("Remember to bring the report.");
  });

  test("throws on missing id", () => {
    const content = `---
title: Test
category: work
day: monday
startTime: "09:00"
endTime: "10:00"
---`;
    expect(() => parseBlockMarkdown(content, "test.md")).toThrow("Missing required field 'id'");
  });

  test("throws on missing title", () => {
    const content = `---
id: test-123
category: work
day: monday
startTime: "09:00"
endTime: "10:00"
---`;
    expect(() => parseBlockMarkdown(content, "test.md")).toThrow("Missing required field 'title'");
  });

  test("throws on missing day", () => {
    const content = `---
id: test-123
title: Test
category: work
startTime: "09:00"
endTime: "10:00"
---`;
    expect(() => parseBlockMarkdown(content, "test.md")).toThrow("Missing required field 'day'");
  });

  test("throws on invalid day", () => {
    const content = `---
id: test-123
title: Test
category: work
day: notaday
startTime: "09:00"
endTime: "10:00"
---`;
    expect(() => parseBlockMarkdown(content, "test.md")).toThrow("Invalid day 'notaday'");
  });

  test("normalizes day to lowercase", () => {
    const content = `---
id: test-123
title: Test
category: work
day: MONDAY
startTime: "09:00"
endTime: "10:00"
---`;
    const block = parseBlockMarkdown(content, "test.md");
    expect(block.day).toBe("monday");
  });

  test("accepts all valid days", () => {
    const days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;
    for (const day of days) {
      const content = `---
id: test-${day}
title: Test
category: work
day: ${day}
startTime: "09:00"
endTime: "10:00"
---`;
      const block = parseBlockMarkdown(content, "test.md");
      expect(block.day).toBe(day);
    }
  });

  test("accepts all valid sources", () => {
    const sources = ["manual", "google-calendar", "yoga-studio"] as const;
    for (const source of sources) {
      const content = `---
id: test-${source}
title: Test
category: work
day: monday
startTime: "09:00"
endTime: "10:00"
source: ${source}
---`;
      const block = parseBlockMarkdown(content, "test.md");
      expect(block.source).toBe(source);
    }
  });

  test("throws on invalid source", () => {
    const content = `---
id: test-123
title: Test
category: work
day: monday
startTime: "09:00"
endTime: "10:00"
source: invalid-source
---`;
    expect(() => parseBlockMarkdown(content, "test.md")).toThrow("Invalid source 'invalid-source'");
  });
});

describe("extractIdFromFilename", () => {
  test("extracts id from standard format", () => {
    expect(extractIdFromFilename("abc123 - Morning Yoga.md")).toBe("abc123");
  });

  test("handles id-only format", () => {
    expect(extractIdFromFilename("abc123.md")).toBe("abc123");
  });

  test("handles complex titles", () => {
    expect(extractIdFromFilename("xyz789 - Team Meeting - Weekly.md")).toBe("xyz789");
  });

  test("trims whitespace", () => {
    expect(extractIdFromFilename("  abc123   -   Title.md")).toBe("abc123");
  });
});

describe("generateFilename", () => {
  const baseBlock: ScheduleBlock = {
    id: "test-123",
    title: "Morning Yoga",
    category: "yoga",
    day: "monday",
    startTime: "09:00",
    endTime: "10:00",
    recurring: "weekly",
    tags: [],
    source: "manual",
    createdAt: "2024-01-01",
    updatedAt: "2024-01-01",
  };

  test("generates standard filename", () => {
    const filename = generateFilename(baseBlock);
    expect(filename).toBe("test-123 - morning-yoga.md");
  });

  test("sanitizes special characters", () => {
    const block = { ...baseBlock, title: "Team Meeting @ 3pm!" };
    const filename = generateFilename(block);
    expect(filename).toBe("test-123 - team-meeting-3pm.md");
  });

  test("removes leading/trailing hyphens", () => {
    const block = { ...baseBlock, title: "---Test---" };
    const filename = generateFilename(block);
    expect(filename).toBe("test-123 - test.md");
  });

  test("truncates long titles", () => {
    const block = { ...baseBlock, title: "A".repeat(100) };
    const filename = generateFilename(block);
    // 50 chars max for title portion + id + " - " + ".md"
    expect(filename.length).toBeLessThanOrEqual(50 + 8 + 4 + 3);
  });

  test("handles uppercase titles", () => {
    const block = { ...baseBlock, title: "UPPERCASE TITLE" };
    const filename = generateFilename(block);
    expect(filename).toBe("test-123 - uppercase-title.md");
  });
});
