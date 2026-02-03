#!/usr/bin/env python3
"""
Extract open tabs from Brave browser session files.

Auto-detects Flatpak or native installation.
Outputs JSON (default) or text format.

Usage:
    python3 brave-tabs.py [--format json|text]
"""

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Optional


def detect_brave_path() -> Optional[Path]:
    """Detect Brave browser profile path.

    Checks in order:
    1. Flatpak installation (~/.var/app/com.brave.Browser/)
    2. Native installation (~/.config/BraveSoftware/)

    Returns:
        Path to the Default profile directory, or None if not found.
    """
    home = Path.home()

    # Check Flatpak first (user likely chose this intentionally)
    flatpak = home / ".var/app/com.brave.Browser/config/BraveSoftware/Brave-Browser/Default"
    if flatpak.exists():
        return flatpak

    # Check native install
    native = home / ".config/BraveSoftware/Brave-Browser/Default"
    if native.exists():
        return native

    return None


def safe_mtime(file_path: Path) -> float:
    """Get file modification time, handling race conditions."""
    try:
        return file_path.stat().st_mtime
    except OSError:
        return 0.0


def find_session_files(profile_path: Path) -> list[Path]:
    """Find Session files in profile directory.

    Session files are in the Sessions/ subdirectory with names like:
    - Session_13414201708285664
    - Tabs_13414178424143763

    Returns files sorted by modification time (newest first).
    """
    sessions_dir = profile_path / "Sessions"
    if not sessions_dir.exists():
        return []

    session_files = list(sessions_dir.glob("Session_*"))
    return sorted(session_files, key=safe_mtime, reverse=True)


def parse_session(file_path: Path) -> list[str]:
    """Parse Brave session file to extract URLs.

    Session files use Chromium's SNSS format (binary protocol buffers).
    We use simple regex scanning to extract URLs from the binary data.

    Args:
        file_path: Path to a Session_* file

    Returns:
        List of unique URLs found in the session.
    """
    urls = []

    try:
        with open(file_path, 'rb') as f:
            content = f.read()

        # Scan for URL patterns in binary data
        # RFC 3986 compliant: scheme + valid URL characters
        url_pattern = rb'https?://[a-zA-Z0-9._~:/?#\[\]@!$&\'()*+,;=%=-]+'

        matches = re.findall(url_pattern, content)
        for match in matches:
            try:
                url = match.decode('utf-8', errors='ignore')
                # Filter out very short URLs (noise)
                if len(url) > 10:
                    urls.append(url)
            except Exception:
                continue

    except PermissionError:
        print(f"Permission denied: {file_path.name}. Close Brave and try again.", file=sys.stderr)
    except IOError as e:
        print(f"Cannot read {file_path.name}: {e}", file=sys.stderr)
    except Exception as e:
        print(f"Error parsing {file_path.name}: {e}", file=sys.stderr)

    return urls


def deduplicate_urls(urls: list[str]) -> list[str]:
    """Remove duplicate URLs while preserving order."""
    seen = set()
    unique = []

    for url in urls:
        if url not in seen:
            seen.add(url)
            unique.append(url)

    return unique


def extract_domain(url: str) -> str:
    """Extract domain from URL for display."""
    try:
        # Simple extraction: split on / and take the third part
        parts = url.split('/')
        if len(parts) >= 3:
            return parts[2]
    except Exception:
        pass
    return url


def format_json(urls: list[str]) -> str:
    """Format URLs as JSON array with metadata."""
    tabs = []
    for url in urls:
        tabs.append({
            "url": url,
            "domain": extract_domain(url)
        })
    return json.dumps(tabs, indent=2)


def format_text(urls: list[str]) -> str:
    """Format URLs as human-readable text."""
    if not urls:
        return "No tabs found."

    lines = [f"Found {len(urls)} tabs:\n"]
    for url in urls:
        domain = extract_domain(url)
        lines.append(f"  {domain}")
        lines.append(f"    {url}")

    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(
        description='Extract open tabs from Brave browser'
    )
    parser.add_argument(
        '--format',
        choices=['json', 'text'],
        default='json',
        help='Output format (default: json)'
    )
    args = parser.parse_args()

    # Detect Brave installation
    profile = detect_brave_path()
    if not profile:
        print("Brave browser not found.", file=sys.stderr)
        print("Checked:", file=sys.stderr)
        print("  - Flatpak: ~/.var/app/com.brave.Browser/config/...", file=sys.stderr)
        print("  - Native:  ~/.config/BraveSoftware/...", file=sys.stderr)

        if args.format == 'json':
            print("[]")
        sys.exit(0)

    # Find session files
    session_files = find_session_files(profile)
    if not session_files:
        print("No session files found.", file=sys.stderr)
        print(f"Sessions directory: {profile / 'Sessions'}", file=sys.stderr)

        if args.format == 'json':
            print("[]")
        sys.exit(0)

    # Parse all session files (use most recent by default)
    # Could add --all flag to parse all sessions
    all_urls = []
    for session_file in session_files[:1]:  # Just most recent
        urls = parse_session(session_file)
        all_urls.extend(urls)

    # Deduplicate
    unique_urls = deduplicate_urls(all_urls)

    # Output
    if args.format == 'json':
        print(format_json(unique_urls))
    else:
        print(format_text(unique_urls))


if __name__ == '__main__':
    main()
