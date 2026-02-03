---
name: yoga-scheduler
description: Plan yoga classes from studio schedules. Learns preferences, fetches schedules automatically, suggests classes. Use for any yoga-related scheduling request.
allowed-tools: Read, Write, Bash, Glob, Grep
---

# Yoga Scheduler Skill

An intelligent yoga scheduling assistant that learns preferences and fetches studio schedules automatically.

## Quick Commands (Progressive Disclosure)

| User Says | Action |
|-----------|--------|
| "yoga" / "my yoga" | Show current yoga blocks + quick suggestions |
| "what's available" | Fetch fresh schedule, show today/tomorrow |
| "plan my week" | Full week fetch + preference matching |
| "my usual" | Add recurring classes based on learned pattern |
| "try something new" | Suggest classes outside normal pattern |

## Cache & Data Paths (XDG Standard)

```
CACHE_DIR = ${XDG_CACHE_HOME:-~/.cache}/schedule-md/yoga/
  ├── ember-schedule.png     # Latest screenshot
  ├── ember-schedule.txt     # Extracted text
  ├── ember-schedule.json    # Parsed classes
  └── fetch-metadata.json    # Timestamps, success rates

DATA_DIR = schedule/blocks/  # Workspace-local (portable)
SITE_PROFILES = skills/yoga-scheduler/sites/  # Shareable config
```

Always use XDG cache for fetched content, never /tmp.

## User Preference Profile

**Current user preferences** (learned from conversation):

```yaml
frequency: 3-5x/week
preferredTimes:
  ideal: "16:00-19:00"  # 4-7pm evening
  acceptable: "16:00-20:00"  # up to 8pm
preferredStyles:
  - { name: "Powerflow", weight: 5 }
  - { name: "Flow", weight: 4 }
  - { name: "Slow Flow", weight: 3 }
  - { name: "Hatha", weight: 3 }
  - { name: "Yin", weight: 2 }
  - { name: "Restorative", weight: 2 }
preferredInstructors:
  - { name: "David", weight: 5 }
  - { name: "Justin", weight: 5 }
  - { name: "Chandra", weight: 3 }
anchorClasses:
  - { day: "saturday", time: "10:30", class: "Powerflow", instructor: "David" }
avoidTimes:
  - "07:00-12:00"  # Work hours Mon-Fri
weeklyPattern:
  - { day: "monday", type: "powerflow", time: "evening" }
  - { day: "tuesday", type: "powerflow", time: "evening" }
  - { day: "friday", type: "powerflow", time: "evening" }
  - { day: "saturday", type: "powerflow", time: "10:30", fixed: true }
```

## Fetch Strategy (Antifragile Cascade)

### What Works for Ember Studios (Wix)

**Primary: Screenshot + Visual Reading**
```bash
# Ensure cache directory exists
mkdir -p "${XDG_CACHE_HOME:-$HOME/.cache}/schedule-md/yoga"
CACHE_DIR="${XDG_CACHE_HOME:-$HOME/.cache}/schedule-md/yoga"

# Fetch with playwright (run from directory with playwright installed)
cd /tmp && node -e "
const { chromium } = require('playwright');
const fs = require('fs');
const cacheDir = process.env.CACHE_DIR || '/tmp';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1400, height: 1200 });
  await page.goto('https://example.com/schedule');
  await page.waitForTimeout(6000);

  await page.screenshot({
    path: cacheDir + '/ember-schedule.png',
    fullPage: true
  });

  const text = await page.evaluate(() => document.body.innerText);
  fs.writeFileSync(cacheDir + '/ember-schedule.txt', text);

  // Save metadata
  fs.writeFileSync(cacheDir + '/fetch-metadata.json', JSON.stringify({
    timestamp: new Date().toISOString(),
    success: true,
    method: 'playwright-screenshot'
  }, null, 2));

  await browser.close();
  console.log('Fetched to ' + cacheDir);
})();
"
```

Then read the screenshot visually:
```
Read file: ~/.cache/schedule-md/yoga/ember-schedule.png
```

### Week Navigation (WORKING)

The Wix calendar can be navigated using the `data-hook` selector:

```javascript
// Navigate to next week
await page.click('[data-hook="next-arrow"]');
await page.waitForTimeout(3000);

// Navigate to previous week
await page.click('[data-hook="prev-arrow"]');
await page.waitForTimeout(3000);

// Click on a specific day (by day number)
await page.click('text="15"');  // Click on day 15
await page.waitForTimeout(2000);
```

**Key discovery**: The navigation arrows have `aria-label="Show next week"` and `data-hook="next-arrow"`. Use `data-hook` as the reliable selector.

### Known Limitations (Wix Calendar)

1. **Past days are disabled** - Cannot click on days before today
2. **Only current day shows by default** - Must click on future days to see their schedule
3. **Day buttons need visible text** - Use `text="15"` not complex selectors

### Cascade Levels

```
LEVEL 1: Cache Check (< 4 hours old)
├─ Read ~/.cache/schedule-md/yoga/ember-schedule.txt
├─ Check fetch-metadata.json timestamp
└─ If fresh → use cached data

LEVEL 2: Playwright Screenshot (PRIMARY)
├─ Navigate to URL
├─ Wait 6 seconds for Wix JS
├─ Screenshot + text extraction
├─ Read screenshot visually (Claude vision)
└─ Parse classes from what's visible

LEVEL 3: User Assistance
├─ "The schedule shows [DAY]. Want me to check a different day?"
├─ Or: "Can you share a screenshot of [DAY]?"
└─ Accept pasted schedule text or images
```

## Parsing Schedule Text

The text extraction follows this pattern:
```
Availability for [Day], [Date]

[Time] a.m./p.m.
[CLASS NAME] [emoji]
[Instructor]
[Duration]
[Registration status]
Book
```

Example parser:
```javascript
function parseEmberText(text) {
  const classes = [];
  const dayMatch = text.match(/Availability for (\w+), (\w+ \d+)/);
  const currentDay = dayMatch ? dayMatch[1].toLowerCase() : null;

  const timeRegex = /(\d{1,2}:\d{2})\s*(a\.m\.|p\.m\.)/gi;
  const lines = text.split('\n');

  // ... parse time slots, class names, instructors
  return { day: currentDay, classes };
}
```

## Matching Against Preferences

Score calculation:
```
+5: Powerflow/Flow with David or Justin
+4: Other preferred style with preferred instructor
+3: Preferred style, any instructor
+2: Evening time slot (4-7pm)
+1: Acceptable time (up to 8pm)
-5: Conflicts with work (7am-12pm Mon-Fri)
-3: Time conflict with existing block
-1: Already have yoga that day
```

## Creating Blocks

When adding a class:
```yaml
---
id: block-N
title: "Powerflow (Justin)"
category: yoga
day: friday
startTime: "17:30"
endTime: "18:30"
location: "Ember Studios"
recurring: weekly
tags: ["powerflow", "justin", "evening"]
source: yoga-studio
instructor: "Justin"
studioClassId: "powerflow-fri-530pm"
---
```

## Verified Schedule Data

From Dec 11, 2024 fetch (using week navigation):

### Current Week (Dec 7-13)
**Friday Dec 12**:
- 4:00pm MAT PILATES (Chelsea)
- **5:30pm POWER FLOW (Justin)** ← PERFECT
- 7:00pm YIN (Chelsea)

### Next Week (Dec 14-20)
**Monday Dec 15**:
- 4:00pm FLOW (Justin)
- **5:30pm POWER FLOW (David)** ← PERFECT
- 7:00pm MAT PILATES (Amanda M)
- 8:30pm RESTORE + SOUND (Amanda M)

**Tuesday Dec 16**:
- 4:00pm EMBER 60 (Jesi Rae)
- 5:30pm BOOTCAMP (Jesi Rae)
- **7:00pm FLOW (Justin)** ← Good fit (Flow not Powerflow, but Justin)

### Evening Class Patterns
- **Monday 5:30pm**: POWER FLOW (David) - recurring
- **Tuesday 7:00pm**: FLOW (Justin) - recurring
- **Friday 5:30pm**: POWER FLOW (Justin) - recurring
- **Saturday 10:30am**: POWERFLOW (David) - anchor class

## Example Conversations

### Quick Check
```
User: "yoga"

Claude: Your yoga this week:
        • Sat 10:30am Powerflow (David) - anchor
        • Fri 5:30pm Powerflow (Justin) - confirmed

        Missing Mon/Tue evening - want me to check availability?
```

### Planning Session
```
User: "plan my yoga"

Claude: Based on your pattern (3-5x/week, evening Powerflow):

        CONFIRMED:
        ✓ Fri 5:30pm Powerflow (Justin)
        ✓ Sat 10:30am Powerflow (David)

        TO CHECK:
        - Mon evening (need fresh schedule)
        - Tue evening (need fresh schedule)

        Fetching current schedule...
```

## File Structure

```
skills/yoga-scheduler/
├── SKILL.md              # This file
├── sites/
│   └── ember-studios.json
└── scripts/
    └── fetch-ember.cjs   # CommonJS for playwright
```

## Integration Points

- **Schedule MCP**: `block_create`, `block_list` for CRUD
- **Playwright**: Browser automation for Wix sites
- **Claude Vision**: Reading schedule screenshots
- **XDG Cache**: Fetched content storage
