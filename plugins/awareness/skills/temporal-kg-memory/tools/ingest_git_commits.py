#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# dependencies = [
#     "falkordb",
# ]
# ///
"""
Ingest git commit history into FalkorDB temporal knowledge graph.

NO LLM REQUIRED - uses the inherent structure of git history.

Graph Schema:
    (:Repository {name, path})
    (:Commit {hash, short_hash, message, timestamp, author_name, author_email})
    (:Author {name, email})
    (:CommitType {type})  -- feat, fix, chore, refactor, docs, etc.

Relationships:
    [:CONTAINS_COMMIT] - Repository → Commit
    [:AUTHORED_BY] - Commit → Author
    [:PARENT_OF] - Commit → Commit (parent chain)
    [:HAS_TYPE] - Commit → CommitType

Usage:
    uv run ingest_git_commits.py [repo_path]

Example:
    uv run ingest_git_commits.py /home/user/Workspace/sandbox/marketplaces/claude
"""

import re
import subprocess
import sys
from datetime import datetime
from pathlib import Path
from falkordb import FalkorDB


def get_git_commits(repo_path: Path) -> list[dict]:
    """Extract commit history from a git repository."""
    result = subprocess.run(
        ['git', '-C', str(repo_path), 'log', '--all', '--format=%H|%h|%s|%aI|%an|%ae|%P'],
        capture_output=True,
        text=True
    )

    if result.returncode != 0:
        print(f"Error running git log: {result.stderr}")
        return []

    commits = []
    for line in result.stdout.strip().split('\n'):
        if not line:
            continue
        parts = line.split('|')
        if len(parts) >= 6:
            commits.append({
                'hash': parts[0],
                'short_hash': parts[1],
                'message': parts[2],
                'timestamp': parts[3],
                'author_name': parts[4],
                'author_email': parts[5],
                'parent_hashes': parts[6].split() if len(parts) > 6 and parts[6] else []
            })

    return commits


def parse_commit_type(message: str) -> str | None:
    """Extract conventional commit type from message."""
    # Conventional commit pattern: type(scope)?: description
    match = re.match(r'^(\w+)(?:\([^)]+\))?[!]?:', message)
    if match:
        commit_type = match.group(1).lower()
        if commit_type in ('feat', 'fix', 'chore', 'docs', 'style', 'refactor',
                          'perf', 'test', 'build', 'ci', 'revert'):
            return commit_type
    return None


def create_schema(g):
    """Create indices for efficient querying."""
    indices = [
        "CREATE INDEX FOR (r:Repository) ON (r.name)",
        "CREATE INDEX FOR (c:Commit) ON (c.hash)",
        "CREATE INDEX FOR (c:Commit) ON (c.short_hash)",
        "CREATE INDEX FOR (c:Commit) ON (c.timestamp)",
        "CREATE INDEX FOR (a:Author) ON (a.email)",
        "CREATE INDEX FOR (t:CommitType) ON (t.type)",
    ]
    for idx in indices:
        try:
            g.query(idx)
        except:
            pass


def ingest_repository(g, repo_path: Path, commits: list[dict]):
    """Ingest repository and commits into the graph."""

    repo_name = repo_path.name

    print(f"\n  Repository: {repo_name}")
    print(f"  Path: {repo_path}")
    print(f"  Commits: {len(commits)}")

    # Create Repository node
    g.query("""
        MERGE (r:Repository {name: $name})
        SET r.path = $path,
            r.commit_count = $commit_count
    """, {
        'name': repo_name,
        'path': str(repo_path),
        'commit_count': len(commits)
    })

    # Track statistics
    stats = {
        'commits': 0,
        'authors': set(),
        'types': {},
        'parent_links': 0
    }

    # First pass: Create all commits and authors
    print("\n  Creating commits...")
    for i, commit in enumerate(commits):
        # Create Author
        g.query("""
            MERGE (a:Author {email: $email})
            SET a.name = $name
        """, {
            'email': commit['author_email'],
            'name': commit['author_name']
        })
        stats['authors'].add(commit['author_email'])

        # Create Commit
        g.query("""
            MATCH (r:Repository {name: $repo_name})
            MERGE (c:Commit {hash: $hash})
            SET c.short_hash = $short_hash,
                c.message = $message,
                c.timestamp = $timestamp,
                c.author_name = $author_name,
                c.author_email = $author_email
            MERGE (r)-[:CONTAINS_COMMIT]->(c)
        """, {
            'repo_name': repo_name,
            'hash': commit['hash'],
            'short_hash': commit['short_hash'],
            'message': commit['message'],
            'timestamp': commit['timestamp'],
            'author_name': commit['author_name'],
            'author_email': commit['author_email']
        })

        # Link to Author
        g.query("""
            MATCH (c:Commit {hash: $hash})
            MATCH (a:Author {email: $email})
            MERGE (c)-[:AUTHORED_BY]->(a)
        """, {
            'hash': commit['hash'],
            'email': commit['author_email']
        })

        # Extract and link commit type
        commit_type = parse_commit_type(commit['message'])
        if commit_type:
            g.query("""
                MERGE (t:CommitType {type: $type})
                WITH t
                MATCH (c:Commit {hash: $hash})
                MERGE (c)-[:HAS_TYPE]->(t)
            """, {
                'type': commit_type,
                'hash': commit['hash']
            })
            stats['types'][commit_type] = stats['types'].get(commit_type, 0) + 1

        stats['commits'] += 1

        if (i + 1) % 10 == 0 or i == len(commits) - 1:
            print(f"    Processed {i + 1}/{len(commits)} commits")

    # Second pass: Create parent relationships
    print("\n  Creating parent links...")
    for commit in commits:
        for parent_hash in commit['parent_hashes']:
            try:
                g.query("""
                    MATCH (child:Commit {hash: $child_hash})
                    MATCH (parent:Commit {hash: $parent_hash})
                    MERGE (parent)-[:PARENT_OF]->(child)
                """, {
                    'child_hash': commit['hash'],
                    'parent_hash': parent_hash
                })
                stats['parent_links'] += 1
            except:
                pass  # Parent might be from before our history cutoff

    print(f"\n  Stats:")
    print(f"    Commits: {stats['commits']}")
    print(f"    Authors: {len(stats['authors'])}")
    print(f"    Parent links: {stats['parent_links']}")
    if stats['types']:
        print(f"    Commit types: {dict(stats['types'])}")

    return stats


def query_examples(g, repo_name: str):
    """Show example queries on the git graph."""

    print("\n" + "=" * 60)
    print("EXAMPLE QUERIES")
    print("=" * 60)

    # 1. Repository overview
    print("\n--- Repository Overview ---")
    result = g.query("""
        MATCH (r:Repository {name: $name})
        OPTIONAL MATCH (r)-[:CONTAINS_COMMIT]->(c:Commit)
        RETURN r.name, count(c) as commits
    """, {'name': repo_name})
    for row in result.result_set:
        print(f"  {row[0]}: {row[1]} commits")

    # 2. Recent commits (by timestamp)
    print("\n--- Recent Commits (last 5) ---")
    result = g.query("""
        MATCH (c:Commit)
        RETURN c.short_hash, c.message, c.timestamp
        ORDER BY c.timestamp DESC
        LIMIT 5
    """)
    for row in result.result_set:
        ts = row[2][:10] if row[2] else ''
        msg = row[1][:50] if row[1] else ''
        print(f"  {row[0]} [{ts}] {msg}...")

    # 3. Authors by commits
    print("\n--- Authors by Commits ---")
    result = g.query("""
        MATCH (a:Author)<-[:AUTHORED_BY]-(c:Commit)
        RETURN a.name, a.email, count(c) as commits
        ORDER BY commits DESC
        LIMIT 5
    """)
    for row in result.result_set:
        print(f"  {row[0]} <{row[1]}>: {row[2]} commits")

    # 4. Commit types distribution
    print("\n--- Commit Types ---")
    result = g.query("""
        MATCH (t:CommitType)<-[:HAS_TYPE]-(c:Commit)
        RETURN t.type, count(c) as count
        ORDER BY count DESC
    """)
    for row in result.result_set:
        print(f"  {row[0]}: {row[1]}")

    # 5. Timeline (oldest to newest)
    print("\n--- Timeline ---")
    result = g.query("""
        MATCH (c:Commit)
        WITH min(c.timestamp) as oldest, max(c.timestamp) as newest
        RETURN oldest, newest
    """)
    for row in result.result_set:
        print(f"  Oldest: {row[0][:19]}")
        print(f"  Newest: {row[1][:19]}")

    # 6. Graph statistics
    print("\n--- Graph Statistics ---")
    result = g.query("MATCH (n) RETURN labels(n)[0] as label, count(n) as count ORDER BY count DESC")
    for row in result.result_set:
        print(f"  {row[0]}: {row[1]} nodes")

    result = g.query("MATCH ()-[r]->() RETURN type(r) as type, count(r) as count ORDER BY count DESC")
    print("\n  Relationships:")
    for row in result.result_set:
        print(f"    {row[0]}: {row[1]}")


def main():
    print("=" * 60)
    print("GIT COMMIT INGESTION (Temporal Knowledge Graph)")
    print("=" * 60)

    # Get repository path
    if len(sys.argv) > 1:
        repo_path = Path(sys.argv[1]).resolve()
    else:
        repo_path = Path.cwd()

    print(f"\nRepository: {repo_path}")

    # Verify it's a git repo
    git_dir = repo_path / '.git'
    if not git_dir.exists():
        print(f"Error: Not a git repository: {repo_path}")
        sys.exit(1)

    # Get commits
    print("\nExtracting git history...")
    commits = get_git_commits(repo_path)
    print(f"Found {len(commits)} commits")

    if not commits:
        print("No commits found!")
        sys.exit(1)

    # Connect to FalkorDB
    print("\nConnecting to FalkorDB...")
    try:
        db = FalkorDB(host='localhost', port=6380)
        g = db.select_graph('git_history')
    except Exception as e:
        print(f"Error: Could not connect to FalkorDB: {e}")
        print("Start with: docker run -p 6380:6379 -p 3001:3000 -d falkordb/falkordb")
        sys.exit(1)

    print("[OK] Connected to FalkorDB (graph: git_history)")

    # Create schema
    create_schema(g)

    # Ingest
    print("\n--- Ingesting ---")
    ingest_repository(g, repo_path, commits)

    # Run example queries
    query_examples(g, repo_path.name)

    print("\n" + "=" * 60)
    print("COMPLETE")
    print("=" * 60)
    print(f"\nView graph: http://localhost:3001")
    print(f"Select graph: git_history")
    print(f"\nTry these queries:")
    print("  MATCH (r:Repository)-[:CONTAINS_COMMIT]->(c:Commit) RETURN r, c LIMIT 20")
    print("  MATCH path=(c1:Commit)-[:PARENT_OF*1..5]->(c2:Commit) RETURN path LIMIT 10")


if __name__ == '__main__':
    main()
