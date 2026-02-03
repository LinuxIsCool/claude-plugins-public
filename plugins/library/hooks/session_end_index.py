#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""
SessionEnd hook to process pending resources into the library catalog.

This hook processes the .pending_resources.jsonl file accumulated during
the session and updates the catalog using the Library API with content-addressed
storage. Falls back to simple catalog if Library unavailable.
"""

import json
import sys
from datetime import datetime
from pathlib import Path


def setup_plugin_path():
    """Add plugin src/ to Python path for imports."""
    hook_file = Path(__file__).resolve()
    plugin_root = hook_file.parent.parent
    src_dir = plugin_root / "src"
    if src_dir.exists() and str(src_dir) not in sys.path:
        sys.path.insert(0, str(src_dir))


def find_library_dir(cwd: str) -> Path:
    """Find .claude/library directory from cwd."""
    current = Path(cwd)
    for parent in [current, *current.parents]:
        claude_dir = parent / ".claude"
        if claude_dir.is_dir():
            return claude_dir / "library"
    return current / ".claude" / "library"


def process_with_library_api(library_dir: Path, session_id: str) -> int:
    """Process pending resources using Library API with content-addressed cache."""
    pending_file = library_dir / ".pending_resources.jsonl"
    catalog_file = library_dir / "catalog.json"

    if not pending_file.exists():
        return 0

    # Record catalog modification time before processing
    catalog_mtime_before = catalog_file.stat().st_mtime if catalog_file.exists() else None

    setup_plugin_path()
    from lib.core import Library

    library = Library(library_dir)
    processed_count = 0
    processing_succeeded = False

    try:
        with open(pending_file) as f:
            for line in f:
                if not line.strip():
                    continue
                try:
                    resource = json.loads(line)
                    url = resource.get("url", "")
                    if not url:
                        continue

                    # Convert content to bytes for cache storage
                    content_str = resource.get("content", "")
                    content_bytes = content_str.encode("utf-8") if content_str else None

                    # Extract metadata
                    metadata = resource.get("metadata", {})
                    title = resource.get("title", "")
                    description = resource.get("description", "") or metadata.get("description", "")

                    # Filter out None values from metadata
                    filtered_metadata = {k: v for k, v in metadata.items() if v is not None}

                    # Add to library with content-addressed storage
                    # Prefix session_id for consistent provenance format
                    provenance = f"session:{session_id}" if session_id != "unknown" else "unknown"
                    _, is_new = library.add_resource(
                        url=url,
                        content=content_bytes,
                        title=title,
                        description=description,
                        discovered_by=provenance,
                        **filtered_metadata,
                    )

                    if is_new:
                        processed_count += 1

                except json.JSONDecodeError:
                    continue

        # Verify catalog was actually updated before deleting pending file
        catalog_mtime_after = catalog_file.stat().st_mtime if catalog_file.exists() else None
        if catalog_mtime_after is not None and (catalog_mtime_before is None or catalog_mtime_after > catalog_mtime_before):
            processing_succeeded = True

    except OSError:
        return 0

    # Only clear pending file if processing confirmed successful
    if processing_succeeded:
        try:
            pending_file.unlink()
        except OSError:
            pass

    # Optimize search index if any resources were processed
    if processed_count > 0:
        optimize_search_index(library)

    return processed_count


def optimize_search_index(library: "Library") -> None:
    """
    Optimize FTS5 search index after batch processing.

    This runs FTS5's optimize command to merge segments and VACUUM
    to reclaim space. Only called when new resources were added.
    """
    try:
        index = library.get_search_index()
        index.optimize()
    except Exception:
        # Non-critical - index will still work, just suboptimally
        pass


def process_with_simple_catalog(library_dir: Path, session_id: str) -> int:
    """Fallback: Process pending resources into simple catalog.json."""
    pending_file = library_dir / ".pending_resources.jsonl"
    catalog_file = library_dir / "catalog.json"

    if not pending_file.exists():
        return 0

    # Load existing catalog
    try:
        catalog = json.loads(catalog_file.read_text()) if catalog_file.exists() else {}
    except (json.JSONDecodeError, OSError):
        catalog = {}

    if "resources" not in catalog:
        catalog["resources"] = {}

    # Process pending resources
    processed_count = 0
    try:
        with open(pending_file) as f:
            for line in f:
                if not line.strip():
                    continue
                try:
                    resource = json.loads(line)
                    url = resource.get("url", "")
                    if not url:
                        continue

                    # Generate identifier from URL (fallback - not content-based)
                    import hashlib
                    identifier = hashlib.sha256(url.encode()).hexdigest()

                    if identifier in catalog["resources"]:
                        # Update existing
                        existing = catalog["resources"][identifier]
                        existing["access_count"] = existing.get("access_count", 0) + 1
                        existing["last_accessed"] = datetime.utcnow().isoformat() + "Z"
                    else:
                        # Add new
                        # Use consistent provenance format
                        resource_session = resource.get("session_id", session_id)
                        provenance = f"session:{resource_session}" if resource_session != "unknown" else "unknown"
                        catalog["resources"][identifier] = {
                            "identifier": identifier,
                            "source": url,
                            "title": resource.get("title", ""),
                            "description": resource.get("description", ""),
                            "type": infer_type(url),
                            "fetched_at": datetime.utcnow().isoformat() + "Z",
                            "last_accessed": datetime.utcnow().isoformat() + "Z",
                            "access_count": 1,
                            "discovered_by": provenance,
                        }
                        processed_count += 1

                except json.JSONDecodeError:
                    continue
    except OSError:
        return 0

    # Update catalog metadata
    catalog["version"] = "1.0"
    catalog["updated_at"] = datetime.utcnow().isoformat() + "Z"
    catalog["resource_count"] = len(catalog["resources"])

    # Save catalog and only clear pending file if save succeeded
    catalog_saved = False
    try:
        catalog_file.write_text(json.dumps(catalog, indent=2))
        catalog_saved = True
    except OSError:
        pass

    # Only clear pending file if catalog was successfully saved
    if catalog_saved:
        try:
            pending_file.unlink()
        except OSError:
            pass

    return processed_count


def infer_type(url: str) -> str:
    """Infer resource type from URL."""
    url_lower = url.lower()

    if "arxiv.org" in url_lower:
        return "paper"
    if "doi.org" in url_lower or "/doi/" in url_lower:
        return "paper"
    if "github.com" in url_lower or "gitlab.com" in url_lower:
        return "repo"
    if "youtube.com" in url_lower or "vimeo.com" in url_lower:
        return "video"
    if "kaggle.com" in url_lower or "huggingface.co/datasets" in url_lower:
        return "dataset"

    return "url"


def main():
    # Read hook data from stdin
    try:
        data = json.loads(sys.stdin.read() or "{}")
    except json.JSONDecodeError:
        return

    cwd = data.get("cwd", ".")
    session_id = data.get("session_id", "unknown")

    library_dir = find_library_dir(cwd)

    if not library_dir.exists():
        return

    # Try Library API first, fall back to simple catalog
    try:
        process_with_library_api(library_dir, session_id)
    except Exception:
        # Fallback to simple catalog for backward compatibility
        try:
            process_with_simple_catalog(library_dir, session_id)
        except Exception:
            # Silent failure - hooks should never crash
            pass


if __name__ == "__main__":
    try:
        main()
    except Exception:
        # Hooks should never fail loudly
        pass
