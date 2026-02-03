---
description: List open browser tabs from Brave
argument-hint: "[--format json|text]"
---

# /tabs Command

Extract and display open tabs from Brave browser.

## Usage

```
/tabs              # JSON output
/tabs --format text  # Human-readable
```

## What It Does

1. Auto-detects Brave installation (Flatpak or native)
2. Reads the most recent session file
3. Extracts all URLs
4. Outputs in requested format

## Implementation

Run this command:

```bash
python3 plugins/browser/tools/brave-tabs.py $ARGUMENTS
```

## After Running

Present the results to the user. For JSON output, summarize:
- Total tab count
- Top domains by frequency
- Sample of interesting URLs

For text output, display directly.

## Follow-up Actions

Offer to:
- Save URLs to a file
- Find duplicate tabs
- Group by domain
- Search for specific domains

## Error Handling

If the command fails, explain:
- Browser not found: Check Brave is installed
- No session files: Start Brave and open tabs
- Parse errors: Try restarting Brave
