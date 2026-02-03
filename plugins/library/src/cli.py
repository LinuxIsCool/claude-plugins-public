#!/usr/bin/env python3
"""CLI entry point for the library plugin."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

# Add src to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from lib import (
    Library,
    ResourceType,
    initialize_storage,
    import_resources,
    export_resources,
    get_migration_stats,
)


def cmd_init(args: argparse.Namespace) -> int:
    """Initialize the library storage."""
    base_path = Path(args.path) if args.path else None
    path = initialize_storage(base_path)
    print(f"Initialized library storage at: {path}")
    return 0


def cmd_stats(args: argparse.Namespace) -> int:
    """Show library statistics."""
    lib = Library()
    stats = get_migration_stats(lib)

    print("# Library Statistics\n")
    print(f"**Total Resources**: {stats['total_resources']}")
    print("\n## By Type")
    for rtype, count in sorted(stats["by_type"].items()):
        print(f"- {rtype}: {count}")

    print("\n## Cache")
    cache = stats["cache"]
    print(f"- Objects: {cache['object_count']}")
    print(f"- URLs: {cache['url_count']}")
    print(f"- Size: {cache['total_size_human']}")

    print("\n## Citations")
    citations = stats["citations"]
    print(f"- Total: {citations['total']}")
    print(f"- Unique sources: {citations['unique_sources']}")
    print(f"- Unique targets: {citations['unique_targets']}")

    return 0


def cmd_import(args: argparse.Namespace) -> int:
    """Import resources from a file."""
    lib = Library()

    try:
        imported = import_resources(
            source=args.file,
            lib=lib,
            format=args.format,
        )
        print(f"Imported {len(imported)} resources from {args.file}")

        if args.verbose:
            for r in imported:
                print(f"  - {r.title or r.source}")

        return 0
    except FileNotFoundError as e:
        print(f"Error: {e}", file=sys.stderr)
        return 1
    except ValueError as e:
        print(f"Error: {e}", file=sys.stderr)
        return 1


def cmd_export(args: argparse.Namespace) -> int:
    """Export resources to a file."""
    lib = Library()

    # Get resources (optionally filtered)
    if args.type:
        rtype = ResourceType(args.type)
        resources = list(lib.iter_resources(rtype))
    elif args.query:
        resources = lib.search(args.query)
    else:
        resources = list(lib.iter_resources())

    if not resources:
        print("No resources to export", file=sys.stderr)
        return 1

    output = export_resources(resources, format=args.format)

    if args.output:
        Path(args.output).write_text(output)
        print(f"Exported {len(resources)} resources to {args.output}")
    else:
        print(output)

    return 0


def cmd_search(args: argparse.Namespace) -> int:
    """Search the library."""
    lib = Library()

    if args.hybrid:
        results = lib.hybrid_search(args.query, limit=args.limit)
        for resource, scores in results:
            print(f"## [{resource.title or 'Untitled'}]({resource.source})")
            print(f"Type: {resource.type.value} | Score: {scores['final']:.3f}")
            if resource.description:
                print(f"> {resource.description[:200]}...")
            print()
    else:
        results = lib.search(args.query, limit=args.limit)
        for resource in results:
            print(f"- [{resource.title or 'Untitled'}]({resource.source})")
            if resource.description:
                print(f"  {resource.description[:100]}...")

    return 0


def cmd_add(args: argparse.Namespace) -> int:
    """Add a resource to the library."""
    lib = Library()

    resource = lib.add_resource(
        url=args.url,
        title=args.title or "",
        description=args.description or "",
        discovered_by=args.source or "cli",
    )

    if resource:
        print(f"Added: {resource.title or resource.source}")
        print(f"  Type: {resource.type.value}")
        print(f"  ID: {resource.identifier[:16]}...")
        return 0
    else:
        print(f"Resource already exists: {args.url}", file=sys.stderr)
        return 1


def cmd_get(args: argparse.Namespace) -> int:
    """Get a resource by URL."""
    lib = Library()

    resource = lib.get_by_url(args.url)
    if not resource:
        print(f"Resource not found: {args.url}", file=sys.stderr)
        return 1

    if args.json:
        print(json.dumps(resource.to_dict(), indent=2))
    else:
        print(f"# {resource.title or 'Untitled'}")
        print(f"\n**URL**: {resource.source}")
        print(f"**Type**: {resource.type.value}")
        if resource.creator:
            print(f"**Authors**: {', '.join(resource.creator)}")
        if resource.date:
            print(f"**Date**: {resource.date}")
        if resource.description:
            print(f"\n> {resource.description}")
        if resource.subject:
            print(f"\n**Tags**: {', '.join(resource.subject)}")

    return 0


def main() -> int:
    """Main CLI entry point."""
    parser = argparse.ArgumentParser(
        description="Library plugin CLI for resource management"
    )
    subparsers = parser.add_subparsers(dest="command", help="Commands")

    # init
    init_parser = subparsers.add_parser("init", help="Initialize library storage")
    init_parser.add_argument("--path", help="Custom storage path")
    init_parser.set_defaults(func=cmd_init)

    # stats
    stats_parser = subparsers.add_parser("stats", help="Show library statistics")
    stats_parser.set_defaults(func=cmd_stats)

    # import
    import_parser = subparsers.add_parser("import", help="Import resources from file")
    import_parser.add_argument("file", help="File to import from")
    import_parser.add_argument(
        "--format",
        choices=["jsonl", "markdown", "bookmarks", "bibtex", "urls"],
        help="Force specific import format",
    )
    import_parser.add_argument("-v", "--verbose", action="store_true", help="Verbose output")
    import_parser.set_defaults(func=cmd_import)

    # export
    export_parser = subparsers.add_parser("export", help="Export resources to file")
    export_parser.add_argument(
        "--format",
        choices=["bibtex", "csl-json", "markdown", "markdown-list", "markdown-table"],
        default="bibtex",
        help="Export format",
    )
    export_parser.add_argument("--type", help="Filter by resource type")
    export_parser.add_argument("--query", help="Filter by search query")
    export_parser.add_argument("-o", "--output", help="Output file")
    export_parser.set_defaults(func=cmd_export)

    # search
    search_parser = subparsers.add_parser("search", help="Search the library")
    search_parser.add_argument("query", help="Search query")
    search_parser.add_argument("--limit", type=int, default=10, help="Max results")
    search_parser.add_argument("--hybrid", action="store_true", help="Use hybrid search with citation ranking")
    search_parser.set_defaults(func=cmd_search)

    # add
    add_parser = subparsers.add_parser("add", help="Add a resource")
    add_parser.add_argument("url", help="Resource URL")
    add_parser.add_argument("--title", help="Resource title")
    add_parser.add_argument("--description", help="Resource description")
    add_parser.add_argument("--source", help="Discovery source")
    add_parser.set_defaults(func=cmd_add)

    # get
    get_parser = subparsers.add_parser("get", help="Get resource by URL")
    get_parser.add_argument("url", help="Resource URL")
    get_parser.add_argument("--json", action="store_true", help="Output as JSON")
    get_parser.set_defaults(func=cmd_get)

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        return 1

    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
