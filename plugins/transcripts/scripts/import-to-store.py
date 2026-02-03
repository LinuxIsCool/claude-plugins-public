#!/usr/bin/env python3
"""
Import processed transcripts into the plugin store

Reads JSON files from staging and writes to the event-sourced store:
- Events: .claude/transcripts/store/events/YYYY/MM/DD/events.jsonl
- Content: .claude/transcripts/store/content/XX/{tid}.md
"""

import json
import os
import sys
from pathlib import Path
from datetime import datetime


def format_timestamp(ms: int) -> str:
    """Format milliseconds as MM:SS or HH:MM:SS"""
    seconds = ms // 1000
    minutes = seconds // 60
    hours = minutes // 60

    s = seconds % 60
    m = minutes % 60

    if hours > 0:
        return f"{hours}:{m:02d}:{s:02d}"
    return f"{m}:{s:02d}"


def import_transcript(json_path: str, store_base: str) -> dict:
    """Import a single transcript JSON to the store"""

    with open(json_path) as f:
        data = json.load(f)

    tid = data["id"]
    created_at = data["created_at"]

    # Create event
    event = {
        "ts": datetime.fromtimestamp(created_at / 1000).isoformat(),
        "op": "transcript.created",
        "data": data,
    }

    # Write event to daily log
    dt = datetime.fromtimestamp(created_at / 1000)
    event_dir = Path(store_base) / "store/events" / str(dt.year) / f"{dt.month:02d}" / f"{dt.day:02d}"
    event_dir.mkdir(parents=True, exist_ok=True)

    event_file = event_dir / "events.jsonl"
    with open(event_file, "a") as f:
        f.write(json.dumps(event) + "\n")

    # Write content file (markdown)
    prefix = tid[3:5]  # Characters after "tx_"
    content_dir = Path(store_base) / "store/content" / prefix
    content_dir.mkdir(parents=True, exist_ok=True)

    content_file = content_dir / f"{tid}.md"

    # Build markdown
    frontmatter = {
        "id": tid,
        "title": data.get("title", f"Transcript {tid}"),
        "status": data.get("status", "complete"),
        "created_at": created_at,
        "updated_at": data.get("updated_at", created_at),
        "speaker_count": len(set(u["speaker"]["id"] for u in data["utterances"])),
        "utterance_count": len(data["utterances"]),
        "duration_ms": data["source"]["audio"]["duration_ms"],
        "filename": data["source"].get("filename"),
    }

    yaml_lines = []
    for key, value in frontmatter.items():
        if value is None:
            continue
        if isinstance(value, str):
            if ":" in value or "#" in value or "\n" in value:
                yaml_lines.append(f'{key}: "{value}"')
            else:
                yaml_lines.append(f"{key}: {value}")
        else:
            yaml_lines.append(f"{key}: {json.dumps(value)}")

    # Build body
    body_lines = []
    for utt in data["utterances"]:
        ts = format_timestamp(utt["start_ms"])
        speaker = utt["speaker"]["name"]
        text = utt["text"]
        body_lines.append(f"**[{ts}] {speaker}:** {text}")
        body_lines.append("")

    content = f"""---
{chr(10).join(yaml_lines)}
---

# {frontmatter['title']}

{chr(10).join(body_lines)}
"""

    with open(content_file, "w") as f:
        f.write(content)

    return {
        "id": tid,
        "title": data.get("title"),
        "event_file": str(event_file),
        "content_file": str(content_file),
        "utterances": len(data["utterances"]),
        "duration_min": data["source"]["audio"]["duration_ms"] / 1000 / 60,
    }


def main():
    import argparse

    parser = argparse.ArgumentParser(description="Import transcripts to plugin store")
    parser.add_argument("json_files", nargs="+", help="JSON files to import")
    parser.add_argument("--store", default=".claude/transcripts", help="Store base path")

    args = parser.parse_args()

    # Resolve store path (should be in repo root)
    store_base = Path(args.store).resolve()
    if not store_base.is_absolute():
        # Try to find repo root
        cwd = Path.cwd()
        while cwd != cwd.parent:
            if (cwd / ".git").exists():
                store_base = cwd / args.store
                break
            cwd = cwd.parent

    print(f"Store base: {store_base}")
    print(f"Importing {len(args.json_files)} transcripts...\n")

    results = []
    for json_file in args.json_files:
        print(f"Importing: {json_file}")
        try:
            result = import_transcript(json_file, str(store_base))
            results.append(result)
            print(f"  -> {result['id']}: {result['utterances']} utterances, {result['duration_min']:.1f} min")
        except Exception as e:
            print(f"  ERROR: {e}")

    print(f"\nImported {len(results)} transcripts")
    print(f"Events: {store_base}/store/events/")
    print(f"Content: {store_base}/store/content/")


if __name__ == "__main__":
    main()
