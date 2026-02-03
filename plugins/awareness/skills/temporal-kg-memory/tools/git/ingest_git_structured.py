#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# dependencies = [
#     "falkordb",
# ]
# ///
"""
Structured Git History Ingestion: Parse git log directly into a temporal knowledge graph.

NO LLM REQUIRED - uses the inherent structure of git.

The git log provides structured data:
- Commit hash and parent hashes (DAG structure)
- Timestamps (temporal dimension)
- Authors (attribution)
- Messages (intent signals)
- File changes (modifications)

Graph Schema:
- (:Commit) - individual commits with metadata
- (:File) - files tracked in the repository
- (:Author) - people/entities who committed

Relationships:
- [:FOLLOWED_BY] - Commit parent chain (temporal sequence)
- [:MODIFIED] - Commit modified File (with change_type: A/M/D/R)
- [:AUTHORED_BY] - Commit authored by Author

Usage:
    uv run ingest_git_structured.py [repo_path]

Default: Current directory
"""

import subprocess
import sys
from datetime import datetime
from pathlib import Path
from falkordb import FalkorDB


def create_schema(g):
    """Create indices for efficient querying."""
    indices = [
        "CREATE INDEX FOR (c:Commit) ON (c.hash)",
        "CREATE INDEX FOR (c:Commit) ON (c.short_hash)",
        "CREATE INDEX FOR (c:Commit) ON (c.timestamp)",
        "CREATE INDEX FOR (f:File) ON (f.path)",
        "CREATE INDEX FOR (a:Author) ON (a.email)",
    ]
    for idx in indices:
        try:
            g.query(idx)
        except Exception:
            pass  # Index may already exist


def run_git_command(cmd: list[str], cwd: Path) -> str:
    """Run a git command and return output."""
    result = subprocess.run(
        cmd,
        cwd=cwd,
        capture_output=True,
        text=True
    )
    if result.returncode != 0:
        raise RuntimeError(f"Git command failed: {result.stderr}")
    return result.stdout


def parse_git_log(repo_path: Path) -> list[dict]:
    """Parse git log into structured commit data."""
    # Format: hash|parents|timestamp|author_name|author_email|subject
    # %H = full hash, %P = parent hashes, %ai = author date ISO, %an = author name, %ae = author email, %s = subject
    format_str = "%H|%P|%ai|%an|%ae|%s"

    output = run_git_command(
        ["git", "log", f"--format={format_str}", "--reverse"],
        repo_path
    )

    commits = []
    for line in output.strip().split('\n'):
        if not line:
            continue
        parts = line.split('|', 5)
        if len(parts) < 6:
            continue

        hash_full, parents, timestamp, author_name, author_email, subject = parts

        commits.append({
            'hash': hash_full,
            'short_hash': hash_full[:7],
            'parents': parents.split() if parents else [],
            'timestamp': timestamp,
            'author_name': author_name,
            'author_email': author_email,
            'subject': subject,
        })

    return commits


def get_commit_stats(repo_path: Path, commit_hash: str) -> dict:
    """Get file change statistics for a commit."""
    try:
        output = run_git_command(
            ["git", "show", "--numstat", "--format=", commit_hash],
            repo_path
        )
    except RuntimeError:
        return {'files': [], 'insertions': 0, 'deletions': 0}

    files = []
    total_insertions = 0
    total_deletions = 0

    for line in output.strip().split('\n'):
        if not line:
            continue
        parts = line.split('\t')
        if len(parts) < 3:
            continue

        insertions, deletions, filepath = parts

        # Handle binary files (shown as -)
        ins = int(insertions) if insertions != '-' else 0
        dels = int(deletions) if deletions != '-' else 0

        files.append({
            'path': filepath,
            'insertions': ins,
            'deletions': dels,
        })
        total_insertions += ins
        total_deletions += dels

    return {
        'files': files,
        'insertions': total_insertions,
        'deletions': total_deletions,
    }


def get_commit_files_with_status(repo_path: Path, commit_hash: str) -> list[dict]:
    """Get files changed with their status (A/M/D/R)."""
    try:
        output = run_git_command(
            ["git", "show", "--name-status", "--format=", commit_hash],
            repo_path
        )
    except RuntimeError:
        return []

    files = []
    for line in output.strip().split('\n'):
        if not line:
            continue
        parts = line.split('\t')
        if len(parts) < 2:
            continue

        status = parts[0][0]  # First char: A, M, D, R, C, etc.
        filepath = parts[-1]  # Last part is always the (new) filepath

        # For renames, capture both old and new paths
        old_path = None
        if status == 'R' and len(parts) >= 3:
            old_path = parts[1]
            filepath = parts[2]

        files.append({
            'status': status,
            'path': filepath,
            'old_path': old_path,
        })

    return files


def detect_claude_assisted(subject: str, body: str = "") -> bool:
    """Detect if commit was Claude-assisted."""
    indicators = [
        "Co-Authored-By: Claude",
        "Generated with Claude",
        "claude-opus",
        "claude-sonnet",
    ]
    full_text = f"{subject} {body}".lower()
    return any(ind.lower() in full_text for ind in indicators)


def compute_quality_scores(commit: dict) -> dict:
    """Compute basic quality scores for a commit."""
    subject = commit.get('subject', '')
    insertions = commit.get('insertions', 0)
    deletions = commit.get('deletions', 0)
    files_changed = commit.get('files_changed', 0)

    # Integrity score (convention adherence)
    integrity = 0.0

    # Conventional commit prefix?
    prefixes = ['feat', 'fix', 'chore', 'docs', 'style', 'refactor', 'test', 'perf', 'ci', 'build']
    if any(subject.lower().startswith(f"{p}:") or subject.lower().startswith(f"{p}(") for p in prefixes):
        integrity += 0.25

    # Meaningful message (>10 chars, not just "update" or "fix")?
    if len(subject) > 20:
        integrity += 0.25
    elif len(subject) > 10:
        integrity += 0.15

    # Subject line < 72 chars (convention)?
    if len(subject) <= 72:
        integrity += 0.25

    # Not a merge commit (typically more intentional)?
    if not subject.lower().startswith('merge'):
        integrity += 0.25

    # Contribution score (value added, with diminishing returns)
    import math

    lines_changed = insertions + deletions
    if lines_changed == 0:
        contribution = 0.0
    else:
        # Logarithmic scale with diminishing returns
        contribution = min(1.0, math.log10(lines_changed + 1) / 3)  # ~1.0 at 1000 lines

    # Bonus for balanced changes (not just deletions or additions)
    if insertions > 0 and deletions > 0:
        balance = min(insertions, deletions) / max(insertions, deletions)
        contribution = contribution * (0.8 + 0.2 * balance)  # Up to 20% bonus

    # Complexity score (change scope)
    if files_changed == 0:
        complexity = 0.0
    else:
        # More files = more complex, with diminishing returns
        complexity = min(1.0, math.log10(files_changed + 1) / 1.5)  # ~1.0 at 30 files

    return {
        'integrity': round(integrity, 2),
        'contribution': round(contribution, 2),
        'complexity': round(complexity, 2),
    }


def ingest_commits(g, commits: list[dict], repo_path: Path):
    """Ingest commits into the knowledge graph."""

    print(f"\nIngesting {len(commits)} commits...")

    # Track all files and authors
    all_authors = set()
    all_files = {}  # path -> {first_seen, last_modified, status}

    stats = {
        'commits': 0,
        'files': 0,
        'authors': 0,
        'relationships': 0,
    }

    for i, commit in enumerate(commits):
        hash_full = commit['hash']
        short_hash = commit['short_hash']

        # Get additional commit data
        file_stats = get_commit_stats(repo_path, hash_full)
        files_with_status = get_commit_files_with_status(repo_path, hash_full)

        # Enrich commit data
        commit['insertions'] = file_stats['insertions']
        commit['deletions'] = file_stats['deletions']
        commit['files_changed'] = len(files_with_status)
        commit['is_claude_assisted'] = detect_claude_assisted(commit['subject'])

        # Compute quality scores
        quality = compute_quality_scores(commit)

        # Create Commit node
        g.query("""
            MERGE (c:Commit {hash: $hash})
            SET c.short_hash = $short_hash,
                c.timestamp = $timestamp,
                c.author_name = $author_name,
                c.author_email = $author_email,
                c.subject = $subject,
                c.insertions = $insertions,
                c.deletions = $deletions,
                c.files_changed = $files_changed,
                c.is_claude_assisted = $is_claude_assisted,
                c.integrity_score = $integrity,
                c.contribution_score = $contribution,
                c.complexity_score = $complexity
        """, {
            'hash': hash_full,
            'short_hash': short_hash,
            'timestamp': commit['timestamp'],
            'author_name': commit['author_name'],
            'author_email': commit['author_email'],
            'subject': commit['subject'],
            'insertions': commit['insertions'],
            'deletions': commit['deletions'],
            'files_changed': commit['files_changed'],
            'is_claude_assisted': commit['is_claude_assisted'],
            'integrity': quality['integrity'],
            'contribution': quality['contribution'],
            'complexity': quality['complexity'],
        })
        stats['commits'] += 1

        # Create Author node and relationship
        author_email = commit['author_email']
        if author_email not in all_authors:
            g.query("""
                MERGE (a:Author {email: $email})
                SET a.name = $name
            """, {
                'email': author_email,
                'name': commit['author_name'],
            })
            all_authors.add(author_email)
            stats['authors'] += 1

        g.query("""
            MATCH (c:Commit {hash: $hash})
            MATCH (a:Author {email: $email})
            MERGE (c)-[:AUTHORED_BY]->(a)
        """, {'hash': hash_full, 'email': author_email})
        stats['relationships'] += 1

        # Create parent relationships (FOLLOWED_BY, reversed for temporal flow)
        for parent_hash in commit['parents']:
            g.query("""
                MATCH (parent:Commit {hash: $parent_hash})
                MATCH (child:Commit {hash: $child_hash})
                MERGE (parent)-[:FOLLOWED_BY]->(child)
            """, {'parent_hash': parent_hash, 'child_hash': hash_full})
            stats['relationships'] += 1

        # Process files
        for file_info in files_with_status:
            filepath = file_info['path']
            status = file_info['status']

            # Track file lifecycle
            if filepath not in all_files:
                all_files[filepath] = {
                    'first_seen': commit['timestamp'],
                    'last_modified': commit['timestamp'],
                    'status': 'active',
                }
            else:
                all_files[filepath]['last_modified'] = commit['timestamp']

            if status == 'D':
                all_files[filepath]['status'] = 'deleted'
            elif status == 'R' and file_info.get('old_path'):
                # Mark old path as renamed
                old_path = file_info['old_path']
                if old_path in all_files:
                    all_files[old_path]['status'] = 'renamed'

            # Create File node
            g.query("""
                MERGE (f:File {path: $path})
                SET f.extension = $extension,
                    f.directory = $directory
            """, {
                'path': filepath,
                'extension': Path(filepath).suffix,
                'directory': str(Path(filepath).parent),
            })

            # Create MODIFIED relationship
            g.query("""
                MATCH (c:Commit {hash: $hash})
                MATCH (f:File {path: $path})
                MERGE (c)-[r:MODIFIED]->(f)
                SET r.change_type = $status
            """, {
                'hash': hash_full,
                'path': filepath,
                'status': status,
            })
            stats['relationships'] += 1

        # Progress indicator
        if (i + 1) % 10 == 0 or i == len(commits) - 1:
            print(f"  Processed {i + 1}/{len(commits)} commits")

    # Update file lifecycle info
    for filepath, info in all_files.items():
        g.query("""
            MATCH (f:File {path: $path})
            SET f.first_seen = $first_seen,
                f.last_modified = $last_modified,
                f.status = $status
        """, {
            'path': filepath,
            'first_seen': info['first_seen'],
            'last_modified': info['last_modified'],
            'status': info['status'],
        })
        stats['files'] += 1

    return stats


def query_examples(g):
    """Show example queries on the git graph."""

    print("\n" + "=" * 60)
    print("EXAMPLE QUERIES")
    print("=" * 60)

    # 1. Commit timeline
    print("\n--- Commit Timeline ---")
    result = g.query("""
        MATCH (c:Commit)
        RETURN c.short_hash as hash, c.timestamp as time, c.subject as subject
        ORDER BY c.timestamp
        LIMIT 10
    """)
    for row in result.result_set:
        print(f"  {row[0]} | {row[1][:19]} | {row[2][:50]}...")

    # 2. Quality scores
    print("\n--- Quality Scores (Best Integrity) ---")
    result = g.query("""
        MATCH (c:Commit)
        RETURN c.short_hash as hash,
               c.integrity_score as integrity,
               c.contribution_score as contribution,
               c.subject as subject
        ORDER BY c.integrity_score DESC
        LIMIT 5
    """)
    for row in result.result_set:
        print(f"  {row[0]} | I:{row[1]:.2f} C:{row[2]:.2f} | {row[3][:40]}...")

    # 3. Most active files
    print("\n--- Most Modified Files ---")
    result = g.query("""
        MATCH (c:Commit)-[:MODIFIED]->(f:File)
        RETURN f.path as file, count(c) as modifications
        ORDER BY modifications DESC
        LIMIT 5
    """)
    for row in result.result_set:
        print(f"  {row[1]}x | {row[0]}")

    # 4. Author stats
    print("\n--- Author Statistics ---")
    result = g.query("""
        MATCH (c:Commit)-[:AUTHORED_BY]->(a:Author)
        RETURN a.name as author,
               count(c) as commits,
               sum(c.insertions) as insertions,
               sum(c.deletions) as deletions
    """)
    for row in result.result_set:
        print(f"  {row[0]}: {row[1]} commits, +{row[2]}/-{row[3]}")

    # 5. Commit chain (DAG structure)
    print("\n--- Commit Chain (last 5) ---")
    result = g.query("""
        MATCH (c:Commit)
        WHERE NOT (c)-[:FOLLOWED_BY]->()
        MATCH path = (c)<-[:FOLLOWED_BY*0..4]-(prev)
        RETURN prev.short_hash as hash, prev.subject as subject
        ORDER BY prev.timestamp DESC
        LIMIT 5
    """)
    for row in result.result_set:
        print(f"  {row[0]} | {row[1][:50]}...")

    # 6. Graph statistics
    print("\n--- Graph Statistics ---")
    result = g.query("MATCH (n) RETURN labels(n)[0] as label, count(n) as count ORDER BY count DESC")
    for row in result.result_set:
        print(f"  {row[0]}: {row[1]}")

    result = g.query("MATCH ()-[r]->() RETURN type(r) as type, count(r) as count ORDER BY count DESC")
    print("\n  Relationships:")
    for row in result.result_set:
        print(f"    {row[0]}: {row[1]}")


def main():
    print("=" * 60)
    print("GIT HISTORY STRUCTURED INGESTION")
    print("Temporal Knowledge Graph over Git")
    print("=" * 60)

    # Determine repository path
    if len(sys.argv) > 1:
        repo_path = Path(sys.argv[1])
    else:
        repo_path = Path("/home/user/Workspace/sandbox/marketplaces/claude")

    print(f"\nRepository: {repo_path}")

    if not (repo_path / ".git").exists():
        print(f"Error: Not a git repository: {repo_path}")
        sys.exit(1)

    # Connect to FalkorDB
    print("\nConnecting to FalkorDB...")
    try:
        db = FalkorDB(host='localhost', port=6380)
        g = db.select_graph('git_history')
    except Exception as e:
        print(f"Error: Could not connect to FalkorDB: {e}")
        print("Start with: docker run -p 6380:6379 -p 3001:3000 -v falkordb_data:/data -d falkordb/falkordb")
        sys.exit(1)

    print("[OK] Connected to FalkorDB (graph: git_history)")

    # Option to clear existing data
    print("\nClearing existing git_history graph...")
    try:
        g.query("MATCH (n) DETACH DELETE n")
    except Exception:
        pass

    # Create schema
    create_schema(g)

    # Parse git log
    print("\nParsing git log...")
    commits = parse_git_log(repo_path)
    print(f"Found {len(commits)} commits")

    if not commits:
        print("No commits found!")
        sys.exit(1)

    # Show timeline
    first = commits[0]
    last = commits[-1]
    print(f"Timeline: {first['timestamp'][:10]} to {last['timestamp'][:10]}")

    # Ingest commits
    stats = ingest_commits(g, commits, repo_path)

    print("\n--- Ingestion Summary ---")
    print(f"  Commits: {stats['commits']}")
    print(f"  Files: {stats['files']}")
    print(f"  Authors: {stats['authors']}")
    print(f"  Relationships: {stats['relationships']}")

    # Run example queries
    query_examples(g)

    print("\n" + "=" * 60)
    print("COMPLETE")
    print("=" * 60)
    print(f"\nView graph: http://localhost:3001")
    print(f"Select graph: git_history")
    print(f"\nUseful queries:")
    print("  # Timeline")
    print("  MATCH (c:Commit) RETURN c.short_hash, c.timestamp, c.subject ORDER BY c.timestamp")
    print("")
    print("  # Quality trend")
    print("  MATCH (c:Commit) RETURN date(c.timestamp), avg(c.integrity_score) ORDER BY date(c.timestamp)")
    print("")
    print("  # File history")
    print("  MATCH (c:Commit)-[:MODIFIED]->(f:File {path: 'CLAUDE.md'}) RETURN c ORDER BY c.timestamp")


if __name__ == '__main__':
    main()
