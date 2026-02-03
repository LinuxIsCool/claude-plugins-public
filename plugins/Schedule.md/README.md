# Schedule.md

A markdown-native weekly schedule manager with a visual web interface. Manage your schedule through Claude conversations or directly in the browser.

## Features

- **Visual Weekly Grid**: Color-coded time blocks on a weekly calendar
- **Claude Integration**: Manage your schedule through natural conversation
- **Markdown Storage**: Human-readable schedule blocks as markdown files
- **Real-time Sync**: Changes sync instantly between CLI, Claude, and web interface
- **Categories**: Organize blocks by type (yoga, work, class, personal, meeting)
- **Statistics**: Track hours spent per category and per day

## Quick Start

```bash
# Navigate to your project directory
cd my-project

# Initialize a schedule
bun run schedule init --name "My Weekly Schedule"

# Start the web interface
bun run schedule serve

# View at http://localhost:6421
```

## Usage with Claude

Once the schedule plugin is installed, you can manage your schedule through conversation:

- "Add yoga at 9am on Monday and Wednesday"
- "How does my Tuesday look?"
- "When am I free this week?"
- "How much time am I spending on work?"

## CLI Commands

```bash
# Initialize a new schedule
schedule init [--name "Project Name"]

# Start web server
schedule serve [--port 6421]

# List blocks
schedule list [--day monday] [--category yoga]

# Show summary
schedule summary

# Start MCP server (for Claude integration)
schedule mcp start
```

## Directory Structure

```
schedule/
├── config.json           # Schedule configuration
└── blocks/               # Schedule blocks as markdown
    ├── block-1 - yoga.md
    ├── block-2 - work.md
    └── ...
```

## Block Format

Each schedule block is a markdown file:

```markdown
---
id: block-1
title: Morning Yoga
category: yoga
day: monday
startTime: "09:00"
endTime: "10:00"
location: Yoga Studio
recurring: weekly
tags: [fitness, wellness]
---

# Morning Yoga

Start the week with a refreshing yoga session.

## Notes
- Bring mat and water
- Arrive 10 minutes early
```

## Categories

| Category | Color | Use For |
|----------|-------|---------|
| yoga | Green | Yoga and fitness |
| work | Blue | Work blocks |
| class | Purple | Educational classes |
| personal | Orange | Personal time |
| meeting | Red | Meetings |
| blocked | Gray | Unavailable time |

## Development

```bash
# Install dependencies
bun install

# Run development server
bun run dev

# Type check
bun run typecheck
```

## License

MIT
