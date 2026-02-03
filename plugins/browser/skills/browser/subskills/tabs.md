# Tabs Sub-Skill

Extract and work with open browser tabs.

## Basic Extraction

```bash
# JSON output (default)
python3 plugins/browser/tools/brave-tabs.py

# Human-readable text
python3 plugins/browser/tools/brave-tabs.py --format text
```

## Output Structure

### JSON Format

```json
[
  {
    "url": "https://example.com/page?param=value",
    "domain": "example.com"
  },
  {
    "url": "https://github.com/user/repo/blob/main/file.py",
    "domain": "github.com"
  }
]
```

### Text Format

```
Found 25 tabs:

  example.com
    https://example.com/page?param=value
  github.com
    https://github.com/user/repo/blob/main/file.py
```

## Common Workflows

### Get Tab Count

```bash
python3 plugins/browser/tools/brave-tabs.py | jq 'length'
```

### List All URLs (One Per Line)

```bash
python3 plugins/browser/tools/brave-tabs.py | jq -r '.[].url'
```

### List All Domains

```bash
python3 plugins/browser/tools/brave-tabs.py | jq -r '.[].domain' | sort -u
```

### Count Tabs by Domain

```bash
python3 plugins/browser/tools/brave-tabs.py | jq -r '.[].domain' | sort | uniq -c | sort -rn
```

### Find Specific Domains

```bash
# GitHub tabs only
python3 plugins/browser/tools/brave-tabs.py | jq -r '.[] | select(.domain == "github.com") | .url'

# All Google properties
python3 plugins/browser/tools/brave-tabs.py | jq -r '.[] | select(.domain | contains("google")) | .url'
```

### Find Duplicate URLs

```bash
python3 plugins/browser/tools/brave-tabs.py | jq -r '.[].url' | sort | uniq -d
```

### Save to File

```bash
# JSON
python3 plugins/browser/tools/brave-tabs.py > /tmp/tabs.json

# URLs only
python3 plugins/browser/tools/brave-tabs.py | jq -r '.[].url' > /tmp/urls.txt
```

## Auto-Detection

The script checks browser locations in this order:

1. **Brave Flatpak**: `~/.var/app/com.brave.Browser/config/BraveSoftware/Brave-Browser/Default/Sessions/`
2. **Brave Native**: `~/.config/BraveSoftware/Brave-Browser/Default/Sessions/`

It uses the first location that exists.

## Session Files

Brave stores session data in files like:
- `Session_13414201708285664`
- `Tabs_13414178424143763`

The script uses the most recent `Session_*` file by modification time.

## Error Handling

| Error | Cause | Solution |
|-------|-------|----------|
| "Brave browser not found" | No Brave installation detected | Install Brave or check paths |
| "No session files found" | Sessions directory empty | Start Brave and open some tabs |
| Empty output | Session file couldn't be parsed | Restart Brave, try again |

## Limitations

- **Brave only**: Chrome/Firefox not yet supported
- **Current session**: Only reads most recent session file
- **No titles**: Tab titles not reliably extractable from SNSS format
- **No window info**: Can't determine which tabs are in which window

## Future Enhancements

Planned improvements:
- `--all` flag to scan all session files
- `--historical` to track tabs over time
- URL intelligence (categorization, slug parsing)
- Tab title extraction via Bookmarks file cross-reference
