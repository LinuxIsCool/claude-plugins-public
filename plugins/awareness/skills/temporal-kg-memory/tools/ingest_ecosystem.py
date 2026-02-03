#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = ["falkordb>=1.0.0", "pyyaml>=6.0"]
# ///
"""Ingest ecosystem entities into FalkorDB.

Extends the temporal knowledge graph with:
- Planning documents
- Git commits
- Agent definitions
- Skill definitions
- ToM dimensions

Usage:
    uv run ingest_ecosystem.py planning    # Ingest planning docs
    uv run ingest_ecosystem.py commits     # Ingest git commits
    uv run ingest_ecosystem.py agents      # Ingest agents
    uv run ingest_ecosystem.py skills      # Ingest skills
    uv run ingest_ecosystem.py tom         # Ingest ToM dimensions
    uv run ingest_ecosystem.py all         # Ingest everything
    uv run ingest_ecosystem.py stats       # Show graph statistics
"""

import argparse
import json
import re
import subprocess
import sys
from datetime import datetime
from pathlib import Path

import yaml
from falkordb import FalkorDB


# Configuration
FALKORDB_HOST = "localhost"
FALKORDB_PORT = 6380
GRAPH_NAME = "claude_ecosystem"

# Paths relative to repo root
REPO_ROOT = Path(__file__).resolve().parents[5]
PLANNING_DIR = REPO_ROOT / ".claude" / "planning"
AGENTS_DIR = REPO_ROOT / ".claude" / "agents"
CONDUCTOR_DIR = REPO_ROOT / ".claude" / "conductor"
PLUGINS_DIR = REPO_ROOT / "plugins"


def get_graph():
    """Connect to FalkorDB and return graph."""
    db = FalkorDB(host=FALKORDB_HOST, port=FALKORDB_PORT)
    return db.select_graph(GRAPH_NAME)


def parse_frontmatter(content: str) -> tuple[dict, str]:
    """Parse YAML frontmatter from markdown file."""
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


def ingest_planning_docs(graph) -> int:
    """Ingest all planning documents."""
    print(f"\n=== Ingesting Planning Documents from {PLANNING_DIR} ===")

    if not PLANNING_DIR.exists():
        print(f"Planning directory not found: {PLANNING_DIR}")
        return 0

    count = 0
    for md_file in sorted(PLANNING_DIR.glob("*.md")):
        try:
            content = md_file.read_text()
            frontmatter, body = parse_frontmatter(content)

            # Extract metadata
            doc_id = md_file.stem
            title = frontmatter.get("title", md_file.stem.replace("-", " ").title())
            created = frontmatter.get("created", md_file.stat().st_mtime)

            # Get first heading as title if not in frontmatter
            if title == md_file.stem.replace("-", " ").title():
                heading_match = re.search(r"^#\s+(.+)$", body, re.MULTILINE)
                if heading_match:
                    title = heading_match.group(1)

            word_count = len(body.split())

            # Create node
            query = """
            MERGE (d:PlanningDoc {id: $id})
            SET d.path = $path,
                d.title = $title,
                d.word_count = $word_count,
                d.created = $created,
                d.content_preview = $preview
            RETURN d
            """
            graph.query(query, {
                "id": doc_id,
                "path": str(md_file.relative_to(REPO_ROOT)),
                "title": title,
                "word_count": word_count,
                "created": str(created),
                "preview": body[:500]
            })
            count += 1
            print(f"  + {doc_id}: {title} ({word_count} words)")

        except Exception as e:
            print(f"  ! Error processing {md_file}: {e}")

    print(f"\nIngested {count} planning documents")
    return count


def ingest_commits(graph, limit: int = 200) -> int:
    """Ingest git commits."""
    print(f"\n=== Ingesting Git Commits (limit: {limit}) ===")

    try:
        # Get commit data
        result = subprocess.run(
            ["git", "log", f"-{limit}",
             "--format=%H|%h|%ai|%an|%s",
             "--no-merges"],
            cwd=REPO_ROOT,
            capture_output=True,
            text=True,
            timeout=30
        )

        if result.returncode != 0:
            print(f"Git error: {result.stderr}")
            return 0

        count = 0
        for line in result.stdout.strip().split("\n"):
            if not line:
                continue

            parts = line.split("|", 4)
            if len(parts) < 5:
                continue

            full_hash, short_hash, timestamp, author, message = parts

            # Get files changed (simplified)
            files_result = subprocess.run(
                ["git", "diff-tree", "--no-commit-id", "--name-only", "-r", full_hash],
                cwd=REPO_ROOT,
                capture_output=True,
                text=True,
                timeout=10
            )
            files = files_result.stdout.strip().split("\n") if files_result.stdout else []
            files_changed = len([f for f in files if f])

            # Create node
            query = """
            MERGE (c:Commit {hash: $hash})
            SET c.short_hash = $short_hash,
                c.timestamp = $timestamp,
                c.author = $author,
                c.message = $message,
                c.files_changed = $files_changed
            RETURN c
            """
            graph.query(query, {
                "hash": full_hash,
                "short_hash": short_hash,
                "timestamp": timestamp,
                "author": author,
                "message": message,
                "files_changed": files_changed
            })
            count += 1

        print(f"Ingested {count} commits")
        return count

    except Exception as e:
        print(f"Error ingesting commits: {e}")
        return 0


def ingest_agents(graph) -> int:
    """Ingest agent definitions."""
    print(f"\n=== Ingesting Agent Definitions ===")

    count = 0

    # Project-level agents
    if AGENTS_DIR.exists():
        for md_file in sorted(AGENTS_DIR.glob("*.md")):
            count += ingest_agent_file(graph, md_file, "project")

    # Plugin agents
    for plugin_dir in PLUGINS_DIR.iterdir():
        if not plugin_dir.is_dir():
            continue

        agents_dir = plugin_dir / "agents"
        if agents_dir.exists():
            for md_file in agents_dir.glob("*.md"):
                count += ingest_agent_file(graph, md_file, plugin_dir.name)

    print(f"\nIngested {count} agents")
    return count


def ingest_agent_file(graph, md_file: Path, source: str) -> int:
    """Ingest a single agent file."""
    try:
        content = md_file.read_text()
        frontmatter, body = parse_frontmatter(content)

        agent_id = f"{source}:{md_file.stem}" if source != "project" else md_file.stem
        name = frontmatter.get("name", md_file.stem)
        description = frontmatter.get("description", "")
        model = frontmatter.get("model", "sonnet")
        tools = frontmatter.get("tools", "")

        query = """
        MERGE (a:Agent {id: $id})
        SET a.name = $name,
            a.path = $path,
            a.description = $description,
            a.model = $model,
            a.tools = $tools,
            a.source = $source
        RETURN a
        """
        graph.query(query, {
            "id": agent_id,
            "name": name,
            "path": str(md_file.relative_to(REPO_ROOT)),
            "description": description,
            "model": model,
            "tools": tools,
            "source": source
        })
        print(f"  + {agent_id}: {name}")
        return 1

    except Exception as e:
        print(f"  ! Error processing {md_file}: {e}")
        return 0


def ingest_skills(graph) -> int:
    """Ingest skill definitions."""
    print(f"\n=== Ingesting Skill Definitions ===")

    count = 0
    for plugin_dir in PLUGINS_DIR.iterdir():
        if not plugin_dir.is_dir():
            continue

        skills_dir = plugin_dir / "skills"
        if not skills_dir.exists():
            continue

        for skill_file in skills_dir.rglob("SKILL.md"):
            count += ingest_skill_file(graph, skill_file, plugin_dir.name)

        # Also check for subskills
        for subskill_file in skills_dir.rglob("subskills/*.md"):
            count += ingest_skill_file(graph, subskill_file, plugin_dir.name, is_subskill=True)

    print(f"\nIngested {count} skills")
    return count


def ingest_skill_file(graph, md_file: Path, plugin: str, is_subskill: bool = False) -> int:
    """Ingest a single skill file."""
    try:
        content = md_file.read_text()
        frontmatter, body = parse_frontmatter(content)

        name = frontmatter.get("name", md_file.stem)
        skill_id = f"{plugin}:{name}"
        description = frontmatter.get("description", "")
        allowed_tools = frontmatter.get("allowed-tools", "")

        query = """
        MERGE (s:Skill {id: $id})
        SET s.name = $name,
            s.path = $path,
            s.description = $description,
            s.allowed_tools = $tools,
            s.plugin = $plugin,
            s.is_subskill = $is_subskill
        RETURN s
        """
        graph.query(query, {
            "id": skill_id,
            "name": name,
            "path": str(md_file.relative_to(REPO_ROOT)),
            "description": description,
            "tools": allowed_tools,
            "plugin": plugin,
            "is_subskill": is_subskill
        })

        if not is_subskill:
            print(f"  + {skill_id}: {name}")
        return 1

    except Exception as e:
        print(f"  ! Error processing {md_file}: {e}")
        return 0


def ingest_tom_dimensions(graph) -> int:
    """Ingest ToM dimensions from user-model.md."""
    print(f"\n=== Ingesting ToM Dimensions ===")

    user_model_path = CONDUCTOR_DIR / "user-model.md"
    if not user_model_path.exists():
        print(f"User model not found: {user_model_path}")
        return 0

    # Define the 16 dimensions with their IDs
    dimensions = [
        ("cognitive-style", "Cognitive Style", "How they think - analytical, intuitive, visual, verbal, systematic"),
        ("decision-framework", "Decision Framework", "How they make decisions - first-principles, empirical, Bayesian, heuristic"),
        ("core-values", "Core Values & Motivations", "What they care about - building systems, quality, journaling, autonomy"),
        ("risk-tolerance", "Risk Tolerance", "Experimental vs conservative orientation"),
        ("time-horizon", "Time Horizon", "Short-term vs long-term focus"),
        ("communication-patterns", "Communication Patterns", "Language, tone, metaphors, inquiry orientation"),
        ("biases-blindspots", "Known Biases & Blind Spots", "Builder bias, depth bias, automation bias"),
        ("self-awareness", "Self-Awareness Level", "Metacognitive capacity"),
        ("adaptability", "Adaptability Score", "How quickly they pivot"),
        ("energy-patterns", "Energy Patterns", "When they work, session rhythms"),
        ("context-switching", "Context Switching", "Single-focus vs multi-threaded"),
        ("quality-intuition", "Quality Intuition", "Standards, aesthetics, quality-speed tradeoff"),
        ("trust-calibration", "Trust Calibration", "What builds and breaks trust"),
        ("learning-style", "Learning Style", "Depth vs breadth preference"),
        ("collaboration-preferences", "Collaboration Preferences", "Autonomy vs guidance"),
        ("meta-preferences", "Meta-Preferences", "How they want to be challenged")
    ]

    count = 0
    for dim_id, name, description in dimensions:
        try:
            query = """
            MERGE (d:ToMDimension {id: $id})
            SET d.name = $name,
                d.description = $description,
                d.observation_count = 0,
                d.confidence = 0.0
            RETURN d
            """
            graph.query(query, {
                "id": dim_id,
                "name": name,
                "description": description
            })
            print(f"  + {dim_id}: {name}")
            count += 1

        except Exception as e:
            print(f"  ! Error creating {dim_id}: {e}")

    print(f"\nIngested {count} ToM dimensions")
    return count


def show_stats(graph):
    """Show graph statistics."""
    print("\n=== Ecosystem Graph Statistics ===\n")

    # Node counts by label
    labels = ["PlanningDoc", "Commit", "Agent", "Skill", "ToMDimension",
              "Session", "UserMessage", "AssistantMessage"]

    total_nodes = 0
    for label in labels:
        result = graph.query(f"MATCH (n:{label}) RETURN count(n) as c")
        count = result.result_set[0][0] if result.result_set else 0
        if count > 0:
            print(f"  {label:20} {count:>5}")
            total_nodes += count

    print(f"  {'─' * 26}")
    print(f"  {'TOTAL':20} {total_nodes:>5}")

    # Relationship counts
    print("\nRelationships:")
    result = graph.query("""
        MATCH ()-[r]->()
        RETURN type(r) as type, count(r) as c
        ORDER BY c DESC
    """)
    total_rels = 0
    for row in result.result_set:
        print(f"  {row[0]:20} {row[1]:>5}")
        total_rels += row[1]
    print(f"  {'─' * 26}")
    print(f"  {'TOTAL':20} {total_rels:>5}")


def main():
    parser = argparse.ArgumentParser(description="Ingest ecosystem entities into FalkorDB")
    parser.add_argument("command", choices=["planning", "commits", "agents", "skills", "tom", "all", "stats"],
                       help="What to ingest")
    parser.add_argument("--limit", type=int, default=200,
                       help="Limit for commits (default: 200)")

    args = parser.parse_args()

    try:
        graph = get_graph()
        print(f"Connected to FalkorDB graph: {GRAPH_NAME}")
    except Exception as e:
        print(f"Failed to connect to FalkorDB: {e}")
        print("Make sure FalkorDB is running: docker run -p 6380:6379 -p 3001:3000 -d falkordb/falkordb")
        sys.exit(1)

    if args.command == "stats":
        show_stats(graph)
    elif args.command == "planning":
        ingest_planning_docs(graph)
    elif args.command == "commits":
        ingest_commits(graph, args.limit)
    elif args.command == "agents":
        ingest_agents(graph)
    elif args.command == "skills":
        ingest_skills(graph)
    elif args.command == "tom":
        ingest_tom_dimensions(graph)
    elif args.command == "all":
        ingest_planning_docs(graph)
        ingest_commits(graph, args.limit)
        ingest_agents(graph)
        ingest_skills(graph)
        ingest_tom_dimensions(graph)
        print("\n" + "=" * 50)
        show_stats(graph)


if __name__ == "__main__":
    main()
