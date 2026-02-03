#!/usr/bin/env python3
"""
Agentmemory CLI Client

A command-line interface for agentmemory operations. Provides a convenient wrapper
for common memory operations including CRUD, search, import/export, and maintenance.

Usage:
    python agentmemory_client.py <command> [options]

Commands:
    create      Create a new memory
    search      Search memories semantically
    get         Get memories from a category
    update      Update an existing memory
    delete      Delete a memory
    export      Export memories to JSON
    import      Import memories from JSON
    stats       Show memory statistics
    wipe        Wipe a category or all memories

Examples:
    # Create a memory
    python agentmemory_client.py create facts "Python was created by Guido van Rossum" --topic programming

    # Search memories
    python agentmemory_client.py search facts "programming languages" --n 5

    # Export all memories
    python agentmemory_client.py export --output memories.json

    # Get category statistics
    python agentmemory_client.py stats
"""

import argparse
import json
import sys
import os
from typing import Optional, List, Dict, Any

# Ensure agentmemory is available
try:
    from agentmemory import (
        create_memory,
        create_unique_memory,
        get_memory,
        get_memories,
        search_memory,
        update_memory,
        delete_memory,
        delete_memories,
        delete_similar_memories,
        count_memories,
        wipe_category,
        wipe_all_memories,
        export_memory_to_json,
        export_memory_to_file,
        import_json_to_memory,
        import_file_to_memory,
        cluster,
    )
    from agentmemory.client import get_client
except ImportError:
    print("Error: agentmemory is not installed. Install it with: pip install agentmemory")
    sys.exit(1)


class AgentMemoryClient:
    """CLI wrapper for agentmemory operations."""

    def __init__(self, verbose: bool = False):
        self.verbose = verbose

    def log(self, message: str):
        """Log message if verbose mode is enabled."""
        if self.verbose:
            print(f"[INFO] {message}", file=sys.stderr)

    # ==================== CREATE OPERATIONS ====================

    def create(
        self,
        category: str,
        text: str,
        metadata: Optional[Dict] = None,
        id: Optional[str] = None,
        unique: bool = False,
        similarity: float = 0.95
    ) -> Dict[str, Any]:
        """Create a new memory."""
        metadata = metadata or {}

        self.log(f"Creating memory in category '{category}'")

        if unique:
            result = create_unique_memory(
                category=category,
                content=text,
                metadata=metadata,
                similarity=similarity
            )
            return {"status": "created", "id": result, "unique": True}
        else:
            result = create_memory(
                category=category,
                text=text,
                metadata=metadata,
                id=id
            )
            return {"status": "created", "id": result}

    # ==================== READ OPERATIONS ====================

    def get_by_id(
        self,
        category: str,
        id: str,
        include_embeddings: bool = False
    ) -> Optional[Dict]:
        """Get a specific memory by ID."""
        self.log(f"Getting memory '{id}' from category '{category}'")
        return get_memory(category, id, include_embeddings=include_embeddings)

    def get_all(
        self,
        category: str,
        n_results: int = 20,
        sort_order: str = "desc",
        filter_metadata: Optional[Dict] = None,
        contains_text: Optional[str] = None,
        include_embeddings: bool = False,
        novel_only: bool = False
    ) -> List[Dict]:
        """Get memories from a category."""
        self.log(f"Getting memories from category '{category}'")
        return get_memories(
            category=category,
            n_results=n_results,
            sort_order=sort_order,
            filter_metadata=filter_metadata,
            contains_text=contains_text,
            include_embeddings=include_embeddings,
            novel=novel_only
        )

    def search(
        self,
        category: str,
        query: str,
        n_results: int = 5,
        filter_metadata: Optional[Dict] = None,
        contains_text: Optional[str] = None,
        max_distance: Optional[float] = None,
        min_distance: Optional[float] = None,
        include_embeddings: bool = False,
        novel_only: bool = False
    ) -> List[Dict]:
        """Search memories semantically."""
        self.log(f"Searching in category '{category}' for: {query}")
        return search_memory(
            category=category,
            search_text=query,
            n_results=n_results,
            filter_metadata=filter_metadata,
            contains_text=contains_text,
            max_distance=max_distance,
            min_distance=min_distance,
            include_embeddings=include_embeddings,
            novel=novel_only
        )

    # ==================== UPDATE OPERATIONS ====================

    def update(
        self,
        category: str,
        id: str,
        text: Optional[str] = None,
        metadata: Optional[Dict] = None
    ) -> Dict[str, Any]:
        """Update an existing memory."""
        self.log(f"Updating memory '{id}' in category '{category}'")

        if text is None and metadata is None:
            return {"status": "error", "message": "Must provide text or metadata"}

        update_memory(category, id, text=text, metadata=metadata)
        return {"status": "updated", "id": id}

    # ==================== DELETE OPERATIONS ====================

    def delete(self, category: str, id: str) -> Dict[str, Any]:
        """Delete a specific memory."""
        self.log(f"Deleting memory '{id}' from category '{category}'")
        delete_memory(category, id)
        return {"status": "deleted", "id": id}

    def delete_by_content(
        self,
        category: str,
        document: Optional[str] = None,
        metadata: Optional[Dict] = None
    ) -> Dict[str, Any]:
        """Delete memories by content or metadata match."""
        self.log(f"Deleting memories from category '{category}'")
        delete_memories(category, document=document, metadata=metadata)
        return {"status": "deleted", "category": category}

    def delete_similar(
        self,
        category: str,
        content: str,
        similarity_threshold: float = 0.95
    ) -> Dict[str, Any]:
        """Delete memories similar to given content."""
        self.log(f"Deleting similar memories from category '{category}'")
        result = delete_similar_memories(
            category=category,
            content=content,
            similarity_threshold=similarity_threshold
        )
        return {"status": "deleted", "found_similar": result}

    def wipe(self, category: Optional[str] = None, confirm: bool = False) -> Dict[str, Any]:
        """Wipe a category or all memories."""
        if not confirm:
            return {"status": "error", "message": "Must confirm with --confirm flag"}

        if category:
            self.log(f"Wiping category '{category}'")
            wipe_category(category)
            return {"status": "wiped", "category": category}
        else:
            self.log("Wiping ALL memories")
            wipe_all_memories()
            return {"status": "wiped", "scope": "all"}

    # ==================== EXPORT/IMPORT OPERATIONS ====================

    def export(
        self,
        output_path: Optional[str] = None,
        include_embeddings: bool = False
    ) -> Dict[str, Any]:
        """Export memories to JSON."""
        if output_path:
            self.log(f"Exporting memories to '{output_path}'")
            export_memory_to_file(output_path, include_embeddings=include_embeddings)
            return {"status": "exported", "path": output_path}
        else:
            self.log("Exporting memories to JSON")
            data = export_memory_to_json(include_embeddings=include_embeddings)
            return {"status": "exported", "data": data}

    def import_memories(
        self,
        input_path: str,
        replace: bool = False
    ) -> Dict[str, Any]:
        """Import memories from JSON file."""
        self.log(f"Importing memories from '{input_path}'")
        import_file_to_memory(input_path, replace=replace)
        return {"status": "imported", "path": input_path, "replaced": replace}

    # ==================== UTILITY OPERATIONS ====================

    def count(self, category: str, novel_only: bool = False) -> int:
        """Count memories in a category."""
        return count_memories(category, novel=novel_only)

    def stats(self) -> Dict[str, Any]:
        """Get statistics about all categories."""
        client = get_client()
        collections = client.list_collections()

        stats = {
            "total_memories": 0,
            "categories": {}
        }

        for collection in collections:
            count = count_memories(collection.name)
            stats["categories"][collection.name] = count
            stats["total_memories"] += count

        return stats

    def list_categories(self) -> List[str]:
        """List all memory categories."""
        client = get_client()
        collections = client.list_collections()
        return [c.name for c in collections]

    def cluster_memories(
        self,
        category: str,
        epsilon: float = 0.1,
        min_samples: int = 2,
        filter_metadata: Optional[Dict] = None,
        novel_only: bool = False
    ) -> Dict[str, Any]:
        """Cluster memories using DBSCAN."""
        self.log(f"Clustering memories in category '{category}'")
        cluster(
            epsilon=epsilon,
            min_samples=min_samples,
            category=category,
            filter_metadata=filter_metadata,
            novel=novel_only
        )
        return {"status": "clustered", "category": category}


def parse_metadata(metadata_str: str) -> Dict:
    """Parse metadata from JSON string or key=value pairs."""
    if not metadata_str:
        return {}

    # Try JSON first
    try:
        return json.loads(metadata_str)
    except json.JSONDecodeError:
        pass

    # Parse key=value pairs
    metadata = {}
    for pair in metadata_str.split(","):
        if "=" in pair:
            key, value = pair.split("=", 1)
            metadata[key.strip()] = value.strip()

    return metadata


def format_output(data: Any, output_format: str = "json") -> str:
    """Format output data."""
    if output_format == "json":
        return json.dumps(data, indent=2, default=str)
    elif output_format == "compact":
        return json.dumps(data, separators=(",", ":"), default=str)
    elif output_format == "text":
        if isinstance(data, list):
            lines = []
            for item in data:
                if isinstance(item, dict):
                    doc = item.get("document", item.get("text", str(item)))
                    id_ = item.get("id", "")
                    dist = item.get("distance", "")
                    if dist:
                        lines.append(f"[{id_}] ({1-dist:.2%}) {doc}")
                    else:
                        lines.append(f"[{id_}] {doc}")
                else:
                    lines.append(str(item))
            return "\n".join(lines)
        elif isinstance(data, dict):
            return "\n".join(f"{k}: {v}" for k, v in data.items())
        return str(data)
    return str(data)


def main():
    parser = argparse.ArgumentParser(
        description="Agentmemory CLI Client",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s create facts "Python is a programming language" --topic programming
  %(prog)s search facts "programming" --n 5
  %(prog)s get facts --n 10
  %(prog)s update facts memory_id --text "Updated content"
  %(prog)s delete facts memory_id
  %(prog)s export --output backup.json
  %(prog)s import backup.json
  %(prog)s stats
  %(prog)s wipe facts --confirm
        """
    )

    parser.add_argument("-v", "--verbose", action="store_true", help="Verbose output")
    parser.add_argument("-f", "--format", choices=["json", "compact", "text"], default="json",
                        help="Output format (default: json)")

    subparsers = parser.add_subparsers(dest="command", help="Commands")

    # CREATE command
    create_parser = subparsers.add_parser("create", help="Create a new memory")
    create_parser.add_argument("category", help="Memory category")
    create_parser.add_argument("text", help="Memory content")
    create_parser.add_argument("--id", help="Custom memory ID")
    create_parser.add_argument("--metadata", "-m", help="Metadata as JSON or key=value,key2=value2")
    create_parser.add_argument("--topic", help="Topic metadata (shortcut)")
    create_parser.add_argument("--source", help="Source metadata (shortcut)")
    create_parser.add_argument("--unique", "-u", action="store_true", help="Use create_unique_memory")
    create_parser.add_argument("--similarity", type=float, default=0.95,
                               help="Similarity threshold for unique (default: 0.95)")

    # SEARCH command
    search_parser = subparsers.add_parser("search", help="Search memories semantically")
    search_parser.add_argument("category", help="Memory category")
    search_parser.add_argument("query", help="Search query")
    search_parser.add_argument("--n", "-n", type=int, default=5, help="Number of results (default: 5)")
    search_parser.add_argument("--metadata", "-m", help="Filter by metadata")
    search_parser.add_argument("--contains", help="Must contain text")
    search_parser.add_argument("--max-distance", type=float, help="Maximum distance threshold")
    search_parser.add_argument("--min-distance", type=float, help="Minimum distance threshold")
    search_parser.add_argument("--novel", action="store_true", help="Only novel memories")
    search_parser.add_argument("--embeddings", action="store_true", help="Include embeddings")

    # GET command
    get_parser = subparsers.add_parser("get", help="Get memories from a category")
    get_parser.add_argument("category", help="Memory category")
    get_parser.add_argument("--id", help="Specific memory ID")
    get_parser.add_argument("--n", "-n", type=int, default=20, help="Number of results (default: 20)")
    get_parser.add_argument("--sort", choices=["asc", "desc"], default="desc", help="Sort order")
    get_parser.add_argument("--metadata", "-m", help="Filter by metadata")
    get_parser.add_argument("--contains", help="Must contain text")
    get_parser.add_argument("--novel", action="store_true", help="Only novel memories")
    get_parser.add_argument("--embeddings", action="store_true", help="Include embeddings")

    # UPDATE command
    update_parser = subparsers.add_parser("update", help="Update an existing memory")
    update_parser.add_argument("category", help="Memory category")
    update_parser.add_argument("id", help="Memory ID")
    update_parser.add_argument("--text", "-t", help="New text content")
    update_parser.add_argument("--metadata", "-m", help="New metadata")

    # DELETE command
    delete_parser = subparsers.add_parser("delete", help="Delete a memory")
    delete_parser.add_argument("category", help="Memory category")
    delete_parser.add_argument("id", nargs="?", help="Memory ID (optional if using --similar)")
    delete_parser.add_argument("--similar", help="Delete memories similar to this content")
    delete_parser.add_argument("--similarity", type=float, default=0.95,
                               help="Similarity threshold (default: 0.95)")
    delete_parser.add_argument("--by-content", help="Delete by document content match")
    delete_parser.add_argument("--by-metadata", "-m", help="Delete by metadata match")

    # EXPORT command
    export_parser = subparsers.add_parser("export", help="Export memories to JSON")
    export_parser.add_argument("--output", "-o", help="Output file path")
    export_parser.add_argument("--embeddings", action="store_true", help="Include embeddings")

    # IMPORT command
    import_parser = subparsers.add_parser("import", help="Import memories from JSON")
    import_parser.add_argument("input", help="Input file path")
    import_parser.add_argument("--replace", action="store_true", help="Replace existing memories")

    # STATS command
    stats_parser = subparsers.add_parser("stats", help="Show memory statistics")

    # LIST command
    list_parser = subparsers.add_parser("list", help="List all categories")

    # COUNT command
    count_parser = subparsers.add_parser("count", help="Count memories in a category")
    count_parser.add_argument("category", help="Memory category")
    count_parser.add_argument("--novel", action="store_true", help="Only count novel memories")

    # WIPE command
    wipe_parser = subparsers.add_parser("wipe", help="Wipe memories (requires --confirm)")
    wipe_parser.add_argument("category", nargs="?", help="Category to wipe (all if not specified)")
    wipe_parser.add_argument("--confirm", action="store_true", help="Confirm wipe operation")

    # CLUSTER command
    cluster_parser = subparsers.add_parser("cluster", help="Cluster memories using DBSCAN")
    cluster_parser.add_argument("category", help="Memory category")
    cluster_parser.add_argument("--epsilon", "-e", type=float, default=0.1,
                                help="Distance threshold (default: 0.1)")
    cluster_parser.add_argument("--min-samples", type=int, default=2,
                                help="Minimum cluster size (default: 2)")
    cluster_parser.add_argument("--metadata", "-m", help="Filter by metadata")
    cluster_parser.add_argument("--novel", action="store_true", help="Only novel memories")

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        sys.exit(0)

    client = AgentMemoryClient(verbose=args.verbose)

    try:
        result = None

        if args.command == "create":
            metadata = parse_metadata(args.metadata) if args.metadata else {}
            if args.topic:
                metadata["topic"] = args.topic
            if args.source:
                metadata["source"] = args.source

            result = client.create(
                category=args.category,
                text=args.text,
                metadata=metadata,
                id=args.id,
                unique=args.unique,
                similarity=args.similarity
            )

        elif args.command == "search":
            filter_metadata = parse_metadata(args.metadata) if args.metadata else None
            result = client.search(
                category=args.category,
                query=args.query,
                n_results=args.n,
                filter_metadata=filter_metadata,
                contains_text=args.contains,
                max_distance=args.max_distance,
                min_distance=args.min_distance,
                include_embeddings=args.embeddings,
                novel_only=args.novel
            )

        elif args.command == "get":
            if args.id:
                result = client.get_by_id(
                    category=args.category,
                    id=args.id,
                    include_embeddings=args.embeddings
                )
            else:
                filter_metadata = parse_metadata(args.metadata) if args.metadata else None
                result = client.get_all(
                    category=args.category,
                    n_results=args.n,
                    sort_order=args.sort,
                    filter_metadata=filter_metadata,
                    contains_text=args.contains,
                    include_embeddings=args.embeddings,
                    novel_only=args.novel
                )

        elif args.command == "update":
            metadata = parse_metadata(args.metadata) if args.metadata else None
            result = client.update(
                category=args.category,
                id=args.id,
                text=args.text,
                metadata=metadata
            )

        elif args.command == "delete":
            if args.similar:
                result = client.delete_similar(
                    category=args.category,
                    content=args.similar,
                    similarity_threshold=args.similarity
                )
            elif args.by_content or args.by_metadata:
                metadata = parse_metadata(args.by_metadata) if args.by_metadata else None
                result = client.delete_by_content(
                    category=args.category,
                    document=args.by_content,
                    metadata=metadata
                )
            elif args.id:
                result = client.delete(args.category, args.id)
            else:
                print("Error: Must specify ID, --similar, --by-content, or --by-metadata")
                sys.exit(1)

        elif args.command == "export":
            result = client.export(
                output_path=args.output,
                include_embeddings=args.embeddings
            )

        elif args.command == "import":
            result = client.import_memories(
                input_path=args.input,
                replace=args.replace
            )

        elif args.command == "stats":
            result = client.stats()

        elif args.command == "list":
            result = client.list_categories()

        elif args.command == "count":
            result = {"category": args.category, "count": client.count(args.category, args.novel)}

        elif args.command == "wipe":
            result = client.wipe(category=args.category, confirm=args.confirm)

        elif args.command == "cluster":
            filter_metadata = parse_metadata(args.metadata) if args.metadata else None
            result = client.cluster_memories(
                category=args.category,
                epsilon=args.epsilon,
                min_samples=args.min_samples,
                filter_metadata=filter_metadata,
                novel_only=args.novel
            )

        if result is not None:
            print(format_output(result, args.format))

    except Exception as e:
        error_output = {"status": "error", "message": str(e)}
        print(format_output(error_output, args.format), file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
