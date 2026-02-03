# Timezone Convention

All times displayed to the user must be localized to Pacific Time.

## Configuration

| Setting | Value |
|---------|-------|
| **IANA Timezone** | `America/Los_Angeles` |
| **Display Format** | `Jan 14, 9:16 AM PST` or `Jan 14, 2026 at 9:16 AM PST` |
| **Storage Format** | Unix timestamp (ms) or ISO 8601 UTC |

## Why America/Los_Angeles

Use the IANA timezone identifier, not the abbreviation. `America/Los_Angeles` automatically handles:
- PST (Pacific Standard Time) — November to March
- PDT (Pacific Daylight Time) — March to November

Hardcoding "PST" produces incorrect times during daylight saving.

## Code Patterns

### TypeScript/JavaScript

```typescript
// Display helper
const toPacific = (ts: number) => new Date(ts).toLocaleString("en-US", {
  timeZone: "America/Los_Angeles",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hour12: true
});

// With year (for dates not in current year)
const toPacificFull = (ts: number) => new Date(ts).toLocaleString("en-US", {
  timeZone: "America/Los_Angeles",
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hour12: true
});

// Date only
const toPacificDate = (ts: number) => new Date(ts).toLocaleDateString("en-US", {
  timeZone: "America/Los_Angeles",
  weekday: "long",
  year: "numeric",
  month: "long",
  day: "numeric"
});
```

### Bash/Shell

```bash
# Using date command
TZ="America/Los_Angeles" date "+%b %d, %Y at %I:%M %p %Z"

# From Unix timestamp
TZ="America/Los_Angeles" date -d "@1736870400" "+%b %d, %I:%M %p %Z"
```

### Python

```python
from datetime import datetime
from zoneinfo import ZoneInfo

pacific = ZoneInfo("America/Los_Angeles")
dt = datetime.fromtimestamp(ts / 1000, tz=pacific)
formatted = dt.strftime("%b %d, %I:%M %p %Z")
```

## Storage vs Display

**Always store times in UTC** (Unix timestamps or ISO 8601). Convert to Pacific only on display.

```
Storage:  1736870400000 (Unix ms) or "2026-01-14T17:00:00.000Z" (ISO 8601)
Display:  "Jan 14, 9:00 AM PST"
```

This approach:
- Enables correct sorting and date math
- Avoids ambiguity during DST transitions
- Works correctly across timezones if needed later

## Contexts

| Context | Format |
|---------|--------|
| CLI output | `Jan 14, 9:16 AM PST` |
| Journal entries | `YYYY-MM-DD` in filename, full date in content |
| Log timestamps | ISO 8601 UTC in storage, Pacific in display |
| Tables/Reports | `Jan 14, 9:16 AM` (PST implied by convention) |
| Git commits | Git's default (author's local time) |

## Timezone Suffix

Include the timezone suffix (PST/PDT) when:
- Displaying times in isolation
- The context could be ambiguous
- Communicating with external parties

Omit when:
- Displaying multiple times in a table (state once in header)
- The Pacific timezone is already established in context
