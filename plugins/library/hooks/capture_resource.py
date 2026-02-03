#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""
Claude Code hook to capture resources from WebFetch/WebSearch.

This hook fires on PostToolUse for WebFetch and WebSearch tools,
extracting URLs and metadata to catalog in the library.
"""

import argparse
import json
import re
import sys
from pathlib import Path


def setup_plugin_path():
    """Add plugin src/ to Python path for imports."""
    hook_file = Path(__file__).resolve()
    plugin_root = hook_file.parent.parent
    src_dir = plugin_root / "src"
    if src_dir.exists() and str(src_dir) not in sys.path:
        sys.path.insert(0, str(src_dir))


def try_extract_metadata(url: str, content: str) -> dict:
    """
    Try to extract rich metadata using extractor system.

    Returns dict of metadata fields or empty dict on failure.
    Never raises exceptions - returns {} for graceful degradation.
    """
    try:
        setup_plugin_path()
        from extractors import get_default_registry

        registry = get_default_registry()
        result = registry.extract(url, content)

        if result.success:
            return result.to_resource_kwargs()
        return {}
    except Exception:
        # Graceful fallback - extractor system unavailable
        return {}


def find_library_dir(cwd: str) -> Path:
    """Find .claude/library directory from cwd."""
    current = Path(cwd)
    for parent in [current, *current.parents]:
        claude_dir = parent / ".claude"
        if claude_dir.is_dir():
            library_dir = claude_dir / "library"
            library_dir.mkdir(parents=True, exist_ok=True)
            return library_dir
    # Fallback
    library_dir = current / ".claude" / "library"
    library_dir.mkdir(parents=True, exist_ok=True)
    return library_dir


def is_valid_url(url: str) -> bool:
    """Validate URL is real, not a template or truncated."""
    # Reject template placeholders
    if '{' in url or '}' in url:
        return False
    # Reject obviously truncated (ends mid-word or too short)
    if len(url) < 15:
        return False
    # Reject test/example URLs
    if 'example.com' in url or 'test.com' in url:
        return False
    # Must have valid TLD (at least 2 chars after last dot in domain)
    try:
        from urllib.parse import urlparse
        parsed = urlparse(url)
        if not parsed.netloc or '.' not in parsed.netloc:
            return False
        tld = parsed.netloc.split('.')[-1].split(':')[0]  # Handle port
        if len(tld) < 2:
            return False
    except Exception:
        return False
    return True


def extract_urls_from_webfetch(data: dict) -> list[dict]:
    """Extract URL and content from WebFetch response with metadata enrichment."""
    resources = []

    tool_input = data.get("tool_input", {})
    tool_response = data.get("tool_response", "")

    url = tool_input.get("url", "")
    if not url:
        return resources

    # Fast path: Extract basic title via regex
    title = ""
    if tool_response:
        # Priority 1: First markdown heading (any level)
        # Match: # Title, ## Title, ### Title etc.
        heading_match = re.search(r"^#{1,6}\s+(.+?)(?:\s*#*)?$", tool_response, re.MULTILINE)
        if heading_match:
            title = heading_match.group(1).strip()

        # Priority 2: Bold text at start (common in docs)
        if not title:
            bold_match = re.search(r"^\*\*(.+?)\*\*", tool_response, re.MULTILINE)
            if bold_match:
                title = bold_match.group(1).strip()

        # Priority 3: HTML title (if not converted)
        if not title:
            html_title = re.search(r"<title[^>]*>([^<]+)</title>", tool_response, re.IGNORECASE)
            if html_title:
                title = html_title.group(1).strip()

        # Priority 4: First non-empty line (truncated)
        if not title:
            for line in tool_response.split("\n"):
                line = line.strip()
                if line and not line.startswith(("---", "```", "<!--", "[")):
                    title = line[:100]
                    break

    # Validate URL before processing
    if not is_valid_url(url):
        return resources

    # Enrichment path: Try specialized extractors (arXiv, GitHub, DOI)
    enriched = try_extract_metadata(url, tool_response) if tool_response else {}

    resources.append({
        "url": url,
        "title": enriched.get("title", title),
        "description": enriched.get("description", ""),
        "content": tool_response,  # Full content for cache storage
        "source": "WebFetch",
        "metadata": enriched,  # Full extraction result for downstream processing
    })

    return resources


def extract_urls_from_websearch(data: dict) -> list[dict]:
    """Extract URLs from WebSearch results."""
    resources = []

    tool_response = data.get("tool_response", "")
    if not tool_response:
        return resources

    # WebSearch returns markdown with URLs
    # Pattern: [Title](URL) or just URLs
    # Only capture markdown links - bare URLs are often from code examples
    url_patterns = [
        r"\[([^\]]+)\]\((https?://[^\)]+)\)",  # Markdown links only
    ]

    seen_urls = set()
    for pattern in url_patterns:
        for match in re.finditer(pattern, tool_response):
            if len(match.groups()) == 2:
                title, url = match.groups()
            else:
                url = match.group(1)
                title = ""

            url = url.rstrip(".,;:")  # Clean trailing punctuation

            # Validate before adding
            if url not in seen_urls and is_valid_url(url):
                seen_urls.add(url)
                resources.append({
                    "url": url,
                    "title": title,
                    "content": "",  # No content for search results
                    "source": "WebSearch",
                })

    return resources


def add_to_pending_catalog(library_dir: Path, resources: list[dict], session_id: str) -> None:
    """Add resources to pending catalog for batch processing."""
    pending_file = library_dir / ".pending_resources.jsonl"

    with open(pending_file, "a") as f:
        for resource in resources:
            entry = {
                "url": resource["url"],
                "title": resource.get("title", ""),
                "description": resource.get("description", ""),
                "source": resource.get("source", ""),
                "session_id": session_id,
                "content": resource.get("content", ""),  # Full content for cache
                "metadata": resource.get("metadata", {}),  # Extracted metadata
            }
            json.dump(entry, f)
            f.write("\n")

    # Also update quick lookup index
    index_file = library_dir / ".url_index.json"
    try:
        index = json.loads(index_file.read_text()) if index_file.exists() else {}
    except (json.JSONDecodeError, OSError):
        index = {}

    for resource in resources:
        url = resource["url"]
        if url not in index:
            index[url] = {
                "first_seen": session_id,
                "title": resource.get("title", ""),
                "count": 1,
            }
        else:
            index[url]["count"] = index[url].get("count", 0) + 1

    try:
        index_file.write_text(json.dumps(index, indent=2))
    except OSError:
        pass


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--tool", required=True, choices=["WebFetch", "WebSearch"])
    args = parser.parse_args()

    # Read hook data from stdin
    try:
        data = json.loads(sys.stdin.read() or "{}")
    except json.JSONDecodeError:
        return

    if not data:
        return

    cwd = data.get("cwd", ".")
    session_id = data.get("session_id", "unknown")

    # Find library directory
    library_dir = find_library_dir(cwd)

    # Extract resources based on tool type
    if args.tool == "WebFetch":
        resources = extract_urls_from_webfetch(data)
    else:
        resources = extract_urls_from_websearch(data)

    if resources:
        add_to_pending_catalog(library_dir, resources, session_id)


if __name__ == "__main__":
    try:
        main()
    except Exception:
        # Hooks should never fail loudly
        pass
