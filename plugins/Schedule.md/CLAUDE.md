# Schedule.md - Agent Instructions

You are working with Schedule.md, a markdown-native weekly schedule manager. This system helps users manage their weekly schedules through color-coded time blocks.

## Overview

Schedule.md stores schedule blocks as markdown files with YAML frontmatter. Each block represents a time slot in the user's weekly schedule (e.g., yoga class, work hours, meetings).

## Available MCP Tools

When the schedule MCP server is running, you have access to these tools:

### Creating Blocks
- `block_create` - Create a new schedule block
  - Required: title, category, day, startTime, endTime
  - Optional: location, description, recurring, tags

### Managing Blocks
- `block_list` - List all blocks, optionally filtered by day/category/source
- `block_view` - View detailed information about a specific block
- `block_edit` - Update an existing block (provide id and fields to change)
- `block_delete` - Remove a block by its ID

### Analysis
- `schedule_summary` - Get weekly statistics (total hours, hours by category/day)
- `block_search` - Find blocks by text (matches title, category, location, tags)
- `free_slots` - Find available time windows in the schedule

### Initialization
- `schedule_init` - Initialize a new schedule (only if not already initialized)

## Categories

Default categories with their colors:
- `yoga` - Green (#22c55e) - Yoga and fitness classes
- `work` - Blue (#3b82f6) - Work-related blocks
- `class` - Purple (#8b5cf6) - Educational classes
- `personal` - Orange (#f97316) - Personal time and errands
- `meeting` - Red (#ef4444) - Meetings and appointments
- `blocked` - Gray (#6b7280) - Unavailable/reserved time

## Time Format

Always use 24-hour format for times: "09:00", "14:30", "17:00"

## Best Practices

1. **When creating blocks**: Always confirm the day, start time, and end time with the user if unclear
2. **Conflicts**: The system will warn about overlapping blocks - mention this to the user
3. **Weekly view**: Remind users they can see their schedule visually at http://localhost:6421 when the server is running
4. **Natural language**: Parse natural time expressions:
   - "morning yoga at 9" → startTime: "09:00"
   - "3pm meeting" → startTime: "15:00"
   - "lunch at noon" → startTime: "12:00"

## Example Interactions

**User**: "Add yoga at 9am on Monday and Wednesday"
```
Use block_create twice:
1. title: "Yoga", category: "yoga", day: "monday", startTime: "09:00", endTime: "10:00"
2. title: "Yoga", category: "yoga", day: "wednesday", startTime: "09:00", endTime: "10:00"
```

**User**: "How does my Tuesday look?"
```
Use block_list with day: "tuesday" to show all Tuesday blocks
```

**User**: "When am I free this week?"
```
Use free_slots to find available time windows
```

**User**: "How much time am I spending on yoga?"
```
Use schedule_summary to get hours by category
```

## File Storage

- Schedule configuration: `schedule/config.json`
- Schedule blocks: `schedule/blocks/*.md`

Each block file contains YAML frontmatter with metadata and optional markdown content for notes.

## Web Interface

The web interface shows:
- Weekly grid with all 7 days
- Color-coded blocks positioned by time
- Click blocks to see details
- Real-time updates via WebSocket

Start the web server with: `schedule serve` or via the serve command.

## Skills

### yoga-scheduler
Helps plan yoga classes from studio schedules. Capabilities:
- **Fetch schedules** automatically using Playwright browser automation
- **Learn preferences** from existing yoga blocks (instructor, time, style)
- **Suggest classes** ranked by match to user's patterns
- **Add to schedule** interactively

Configure your studio URL in the yoga-scheduler skill settings.

### web-scraper (Playwright)
Browser automation for dynamic websites. Use when WebFetch fails on JS-heavy sites.

Key Playwright MCP tools:
- `browser_navigate` - Go to URL
- `browser_wait_for` - Wait for content/time
- `browser_snapshot` - Get accessible text content
- `browser_take_screenshot` - Capture visual image
- `browser_evaluate` - Run JavaScript
- `browser_close` - Close browser

Typical workflow:
```
1. browser_navigate to URL
2. browser_wait_for time: 3000-5000 (let JS load)
3. browser_snapshot (get text) or browser_take_screenshot (get image)
4. browser_close
```

## Preference Learning

The yoga-scheduler learns from existing blocks:
- Read yoga blocks → extract patterns (instructors, times, styles)
- Match new classes against patterns
- New blocks encode choices (instructor in title/tags)

Over time, the schedule itself becomes the preference database.
