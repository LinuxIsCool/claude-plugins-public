#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = ["hipporag>=0.1.0", "pyyaml>=6.0"]
# ///
"""
Index awareness sub-skills into HippoRAG for multi-hop retrieval.

This demonstrates HippoRAG's distinctive capability: discovering learning paths
through Personalized PageRank traversal of the knowledge graph.

Usage:
    uv run hipporag_skills.py index      # Index all sub-skills
    uv run hipporag_skills.py query "what to learn after docs-reader"
    uv run hipporag_skills.py stats      # Show graph statistics
    uv run hipporag_skills.py test       # Run proof-of-concept queries

Prerequisites:
    - Ollama running: ollama serve
    - Models pulled: ollama pull llama3.2:3b && ollama pull nomic-embed-text
"""

import argparse
import sys
from datetime import datetime
from pathlib import Path

import yaml


# Configuration
REPO_ROOT = Path(__file__).resolve().parents[5]
SKILLS_DIR = REPO_ROOT / "plugins" / "awareness" / "skills" / "awareness" / "subskills"
HIPPORAG_DIR = REPO_ROOT / ".claude" / "hipporag" / "awareness-skills"

# Local LLM config via Ollama's OpenAI-compatible API
# HippoRAG only recognizes: GritLM, NV-Embed-v2, contriever, text-embedding
# We use "text-embedding" in the name to trigger OpenAIEmbeddingModel
# and point the base_url to Ollama's /v1 endpoint
LLM_MODEL = "llama3.2"  # Maps to Ollama model (llama3.2:latest)
EMBEDDING_MODEL = "text-embedding-nomic"  # Triggers OpenAI adapter
OLLAMA_URL = "http://localhost:11434/v1"  # OpenAI-compatible endpoint


def parse_skill_frontmatter(content: str) -> tuple[dict, str]:
    """Parse YAML frontmatter from skill markdown file."""
    if content.startswith("---"):
        parts = content.split("---", 2)
        if len(parts) >= 3:
            try:
                frontmatter = yaml.safe_load(parts[1])
                body = parts[2].strip()
                return frontmatter or {}, body
            except yaml.YAMLError:
                pass
    return {}, content


def load_subskills() -> list[dict]:
    """Load all awareness sub-skills."""
    skills = []

    if not SKILLS_DIR.exists():
        print(f"Skills directory not found: {SKILLS_DIR}")
        return skills

    for md_file in sorted(SKILLS_DIR.glob("*.md")):
        content = md_file.read_text()
        frontmatter, body = parse_skill_frontmatter(content)

        skill = {
            "id": md_file.stem,
            "name": frontmatter.get("name", md_file.stem),
            "description": frontmatter.get("description", ""),
            "allowed_tools": frontmatter.get("allowed-tools", ""),
            "body": body,
            "path": str(md_file.relative_to(REPO_ROOT)),
        }
        skills.append(skill)

    return skills


def get_hipporag():
    """Initialize HippoRAG with Ollama's OpenAI-compatible API."""
    from hipporag import HippoRAG

    HIPPORAG_DIR.mkdir(parents=True, exist_ok=True)

    return HippoRAG(
        save_dir=str(HIPPORAG_DIR),
        llm_model_name=LLM_MODEL,
        llm_base_url=OLLAMA_URL,
        embedding_model_name=EMBEDDING_MODEL,
        embedding_base_url=OLLAMA_URL,
    )


def index_skills(hipporag, skills: list[dict]) -> int:
    """Index skills into HippoRAG."""
    documents = []

    for skill in skills:
        # Create a rich document that captures skill relationships
        doc = f"""# {skill['name']}

{skill['description']}

## Tools
{skill['allowed_tools']}

## Content
{skill['body'][:3000]}
"""
        documents.append(doc)
        print(f"  + {skill['id']}: {skill['name']}")

    # Index all documents
    hipporag.index(docs=documents)

    return len(documents)


def query_skills(hipporag, query: str, num_results: int = 5) -> list:
    """Query the skill graph using HippoRAG's PPR retrieval."""
    results = hipporag.retrieve(queries=[query], num_to_retrieve=num_results)
    return results[0] if results else []


def show_stats(hipporag):
    """Show HippoRAG graph statistics."""
    print("\n=== HippoRAG Awareness Skills Statistics ===\n")

    # Get basic stats from the graph
    try:
        # HippoRAG stores data in its internal graph
        # Check if we can access graph stats
        if hasattr(hipporag, 'graph') and hipporag.graph:
            graph = hipporag.graph

            # Try to get node count
            if hasattr(graph, 'query'):
                result = graph.query("MATCH (n) RETURN labels(n)[0] as label, count(n) as c")
                if result.result_set:
                    for row in result.result_set:
                        print(f"  {row[0]}: {row[1]} nodes")
        else:
            print("  Graph stats not directly accessible")
            print(f"  Storage directory: {HIPPORAG_DIR}")

            # List files in storage
            if HIPPORAG_DIR.exists():
                files = list(HIPPORAG_DIR.iterdir())
                print(f"  Files: {len(files)}")
                for f in files[:10]:
                    print(f"    - {f.name}")
    except Exception as e:
        print(f"  Error getting stats: {e}")


def run_test_queries(hipporag):
    """Run proof-of-concept queries demonstrating multi-hop retrieval."""
    print("\n" + "=" * 60)
    print("HippoRAG Multi-Hop Query Test")
    print("=" * 60)

    test_queries = [
        # Multi-hop: what to learn after a specific skill
        "What should I learn after mastering docs-reader?",

        # Associative: find related concepts
        "What skills are related to plugin development?",

        # Entity-centric: everything about a concept
        "Tell me everything about creating agents",

        # Relationship: how concepts connect
        "How does skill creation relate to resource studying?",
    ]

    for query in test_queries:
        print(f"\n--- Query: {query} ---\n")

        try:
            results = query_skills(hipporag, query, num_results=3)

            if results:
                print(f"Found {len(results)} relevant passages:")
                for i, result in enumerate(results, 1):
                    # HippoRAG returns passage objects
                    passage = str(result)[:200] if result else "No content"
                    print(f"\n  [{i}] {passage}...")
            else:
                print("  No results found")

        except Exception as e:
            print(f"  Query error: {e}")


def cmd_index():
    """Index command."""
    print("=" * 60)
    print("Indexing Awareness Sub-Skills into HippoRAG")
    print("=" * 60)

    # Load skills
    print("\n[1] Loading sub-skills from:", SKILLS_DIR)
    skills = load_subskills()
    print(f"    Found {len(skills)} sub-skills")

    if not skills:
        print("No skills to index")
        return

    # Initialize HippoRAG
    print("\n[2] Initializing HippoRAG...")
    print(f"    LLM: {LLM_MODEL}")
    print(f"    Embeddings: {EMBEDDING_MODEL} (via OpenAI adapter)")
    print(f"    Base URL: {OLLAMA_URL}")
    print(f"    Storage: {HIPPORAG_DIR}")

    try:
        hipporag = get_hipporag()
    except Exception as e:
        print(f"\nError initializing HippoRAG: {e}")
        print("\nMake sure:")
        print("  1. Ollama is running: ollama serve")
        print("  2. Models are pulled: ollama pull llama3.2:3b && ollama pull nomic-embed-text")
        sys.exit(1)

    # Index skills
    print("\n[3] Indexing skills...")
    indexed = index_skills(hipporag, skills)

    print(f"\n[OK] Indexed {indexed} skills into HippoRAG")
    print(f"    Storage: {HIPPORAG_DIR}")


def cmd_query(query: str):
    """Query command."""
    print(f"Query: {query}\n")

    try:
        hipporag = get_hipporag()
        results = query_skills(hipporag, query)

        if results:
            print(f"Found {len(results)} results:\n")
            for i, result in enumerate(results, 1):
                print(f"[{i}] {str(result)[:500]}\n")
        else:
            print("No results found")

    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)


def cmd_stats():
    """Stats command."""
    try:
        hipporag = get_hipporag()
        show_stats(hipporag)
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)


def cmd_test():
    """Test command."""
    print("=" * 60)
    print("HippoRAG Awareness Skills - Proof of Concept")
    print("=" * 60)

    try:
        hipporag = get_hipporag()
        run_test_queries(hipporag)
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)


def main():
    parser = argparse.ArgumentParser(
        description="Index awareness sub-skills into HippoRAG for multi-hop retrieval"
    )
    subparsers = parser.add_subparsers(dest="command", help="Commands")

    # Index command
    subparsers.add_parser("index", help="Index all awareness sub-skills")

    # Query command
    query_parser = subparsers.add_parser("query", help="Query the skill graph")
    query_parser.add_argument("query", type=str, help="Query string")

    # Stats command
    subparsers.add_parser("stats", help="Show graph statistics")

    # Test command
    subparsers.add_parser("test", help="Run proof-of-concept queries")

    args = parser.parse_args()

    if args.command == "index":
        cmd_index()
    elif args.command == "query":
        cmd_query(args.query)
    elif args.command == "stats":
        cmd_stats()
    elif args.command == "test":
        cmd_test()
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
