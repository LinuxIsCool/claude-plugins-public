---
name: browser
description: Extract open tabs from Brave browser. Auto-detects Flatpak or native install. Sub-skills (1): tabs. Use when user asks about open tabs, browser state, or wants to list URLs.
allowed-tools: Bash, Read
---

# Browser Plugin - Master Skill

Extract data from web browsers with auto-detection.

## Sub-Skills Index

| Sub-Skill | Use When | File |
|-----------|----------|------|
| **tabs** | Extract open tabs, list URLs, check browser state | `subskills/tabs.md` |

## Supported Browsers

| Browser | Status | Install Types |
|---------|--------|---------------|
| Brave | Ready | Flatpak, Native |
| Chrome | Planned | - |
| Firefox | Planned | - |

## Quick Start

```bash
# JSON output (default)
python3 plugins/browser/tools/brave-tabs.py

# Human-readable
python3 plugins/browser/tools/brave-tabs.py --format text
```

For detailed usage, jq patterns, and troubleshooting, read `subskills/tabs.md`.

## Future Enhancements

Structure supports planned features:
- Bookmarks extraction
- History search
- Chrome/Firefox support
- URL intelligence (categorization, deduplication)
