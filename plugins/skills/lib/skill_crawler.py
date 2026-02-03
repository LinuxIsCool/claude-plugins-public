#!/usr/bin/env python3
"""
Skill Crawler - Discover and index Claude Code skills from various sources.

Supports:
- Local directories (.claude/skills/, plugins/*/skills/)
- Cloned GitHub repositories
- GitHub search (via gh CLI)

Usage:
    from skill_crawler import SkillCrawler
    from skill_store import SkillStore

    store = SkillStore("skills.db")
    crawler = SkillCrawler(store)

    # Index local skills
    crawler.crawl_directory("/path/to/project")

    # Index a cloned repo
    crawler.crawl_repository("/path/to/repo", "github.com/user/repo")
"""

import json
import os
import subprocess
from datetime import datetime
from pathlib import Path
from typing import Generator, Optional

from skill_store import SkillStore, Skill, SkillRelationship, parse_skill_file


class SkillCrawler:
    """Crawl and index Claude Code skills from various sources."""

    def __init__(self, store: SkillStore):
        """Initialize the crawler.

        Args:
            store: SkillStore instance for indexing
        """
        self.store = store

    def find_skill_files(self, root: Path) -> Generator[Path, None, None]:
        """Find all SKILL.md files under a root directory.

        Args:
            root: Root directory to search

        Yields:
            Paths to SKILL.md files
        """
        for skill_md in root.rglob("SKILL.md"):
            yield skill_md

    def crawl_directory(
        self,
        directory: str | Path,
        source_type: str = "local"
    ) -> dict:
        """Crawl a directory for skills.

        Args:
            directory: Directory to crawl
            source_type: Source type label

        Returns:
            Stats dictionary
        """
        root = Path(directory)
        if not root.exists():
            return {"error": f"Directory not found: {directory}"}

        stats = {
            "found": 0,
            "indexed": 0,
            "failed": 0,
            "skills": []
        }

        for skill_path in self.find_skill_files(root):
            stats["found"] += 1

            try:
                skill = parse_skill_file(skill_path)
                if skill:
                    skill.source_type = source_type
                    skill.path = str(skill_path.relative_to(root))
                    self.store.index_skill(skill)
                    stats["indexed"] += 1
                    stats["skills"].append(skill.name)
                else:
                    stats["failed"] += 1
            except Exception as e:
                print(f"Error processing {skill_path}: {e}")
                stats["failed"] += 1

        return stats

    def crawl_repository(
        self,
        repo_path: str | Path,
        repo_url: str = ""
    ) -> dict:
        """Crawl a cloned repository for skills.

        Args:
            repo_path: Path to cloned repository
            repo_url: Original repository URL

        Returns:
            Stats dictionary
        """
        root = Path(repo_path)
        if not root.exists():
            return {"error": f"Repository not found: {repo_path}"}

        # Extract repo name from URL or path
        if repo_url:
            repository = repo_url.replace("https://github.com/", "").replace(".git", "")
        else:
            repository = root.name

        stats = {
            "repository": repository,
            "found": 0,
            "indexed": 0,
            "failed": 0,
            "skills": []
        }

        for skill_path in self.find_skill_files(root):
            stats["found"] += 1

            try:
                skill = parse_skill_file(skill_path)
                if skill:
                    skill.source_type = "github"
                    skill.repository = repository
                    skill.source_url = f"https://github.com/{repository}/blob/main/{skill_path.relative_to(root)}"
                    skill.path = str(skill_path.relative_to(root))
                    self.store.index_skill(skill)
                    stats["indexed"] += 1
                    stats["skills"].append(skill.name)
                else:
                    stats["failed"] += 1
            except Exception as e:
                print(f"Error processing {skill_path}: {e}")
                stats["failed"] += 1

        return stats

    def crawl_github_search(
        self,
        query: str = "filename:SKILL.md",
        max_repos: int = 10
    ) -> dict:
        """Search GitHub for skills using gh CLI.

        Requires: gh CLI installed and authenticated

        Args:
            query: GitHub code search query
            max_repos: Maximum repositories to process

        Returns:
            Stats dictionary
        """
        stats = {
            "searched": True,
            "repos_found": 0,
            "skills_indexed": 0,
            "errors": []
        }

        try:
            # Search for repositories with SKILL.md files
            result = subprocess.run(
                ["gh", "search", "code", query, "--json", "path,repository", "--limit", "100"],
                capture_output=True,
                text=True,
                timeout=60
            )

            if result.returncode != 0:
                stats["errors"].append(f"gh search failed: {result.stderr}")
                return stats

            results = json.loads(result.stdout)

            # Get unique repositories
            repos = {}
            for r in results:
                repo_name = r.get("repository", {}).get("nameWithOwner", "")
                if repo_name and repo_name not in repos:
                    repos[repo_name] = r.get("path", "")

            stats["repos_found"] = len(repos)

            # Process each repo (clone, index, cleanup)
            for repo_name in list(repos.keys())[:max_repos]:
                clone_dir = Path(f"/tmp/skill-crawler/{repo_name.replace('/', '_')}")

                try:
                    # Shallow clone
                    clone_dir.parent.mkdir(parents=True, exist_ok=True)
                    subprocess.run(
                        ["git", "clone", "--depth", "1", f"https://github.com/{repo_name}.git", str(clone_dir)],
                        capture_output=True,
                        timeout=120
                    )

                    # Crawl
                    repo_stats = self.crawl_repository(clone_dir, f"https://github.com/{repo_name}")
                    stats["skills_indexed"] += repo_stats.get("indexed", 0)

                except subprocess.TimeoutExpired:
                    stats["errors"].append(f"Timeout cloning {repo_name}")
                except Exception as e:
                    stats["errors"].append(f"Error processing {repo_name}: {e}")
                finally:
                    # Cleanup
                    if clone_dir.exists():
                        subprocess.run(["rm", "-rf", str(clone_dir)], capture_output=True)

        except FileNotFoundError:
            stats["errors"].append("gh CLI not found. Install: https://cli.github.com/")
        except json.JSONDecodeError as e:
            stats["errors"].append(f"JSON parse error: {e}")

        return stats

    def extract_relationships(self, skill_content: str) -> list[dict]:
        """Extract relationships from skill content.

        Looks for patterns like:
        - "requires: skill-name"
        - "extends: skill-name"
        - "Prerequisites: skill-a, skill-b"

        Args:
            skill_content: Skill file content

        Returns:
            List of relationship dictionaries
        """
        relationships = []

        # Simple pattern matching for relationships
        import re

        # Match "requires: skill-name" in frontmatter
        requires_match = re.search(r'^requires:\s*(.+)$', skill_content, re.MULTILINE)
        if requires_match:
            for skill in requires_match.group(1).split(','):
                skill = skill.strip().strip('"\'')
                if skill:
                    relationships.append({
                        "relationship": "requires",
                        "to_skill": skill
                    })

        # Match "extends: skill-name"
        extends_match = re.search(r'^extends:\s*(.+)$', skill_content, re.MULTILINE)
        if extends_match:
            for skill in extends_match.group(1).split(','):
                skill = skill.strip().strip('"\'')
                if skill:
                    relationships.append({
                        "relationship": "extends",
                        "to_skill": skill
                    })

        # Match "Prerequisites: skill-a, skill-b" in content
        prereq_match = re.search(r'Prerequisites?:\s*(.+?)(?:\n|$)', skill_content, re.IGNORECASE)
        if prereq_match:
            for skill in prereq_match.group(1).split(','):
                skill = skill.strip().strip('"\'').strip('`')
                # Filter out non-skill text
                if skill and not any(c in skill for c in [' ', ':', '.']):
                    relationships.append({
                        "relationship": "requires",
                        "to_skill": skill
                    })

        return relationships

    def index_with_relationships(self, skill_path: Path) -> Optional[Skill]:
        """Index a skill and extract its relationships.

        Args:
            skill_path: Path to SKILL.md file

        Returns:
            Indexed skill or None
        """
        skill = parse_skill_file(skill_path)
        if not skill:
            return None

        # Index the skill
        self.store.index_skill(skill)

        # Extract and store relationships
        rels = self.extract_relationships(skill.content)
        for rel in rels:
            self.store.add_relationship(SkillRelationship(
                from_skill=skill.name,
                to_skill=rel["to_skill"],
                relationship=rel["relationship"]
            ))

        return skill


def main():
    """CLI entry point."""
    import sys

    store = SkillStore("skills.db")
    crawler = SkillCrawler(store)

    if len(sys.argv) < 2:
        print("Usage: skill_crawler.py <command> [args]")
        print("")
        print("Commands:")
        print("  crawl <directory>     Crawl a local directory")
        print("  repo <path> [url]     Crawl a cloned repository")
        print("  github [query]        Search GitHub for skills")
        print("  stats                 Show crawl statistics")
        sys.exit(1)

    command = sys.argv[1]

    if command == "crawl" and len(sys.argv) > 2:
        directory = sys.argv[2]
        stats = crawler.crawl_directory(directory)
        print(json.dumps(stats, indent=2))

    elif command == "repo" and len(sys.argv) > 2:
        repo_path = sys.argv[2]
        repo_url = sys.argv[3] if len(sys.argv) > 3 else ""
        stats = crawler.crawl_repository(repo_path, repo_url)
        print(json.dumps(stats, indent=2))

    elif command == "github":
        query = " ".join(sys.argv[2:]) if len(sys.argv) > 2 else "filename:SKILL.md"
        stats = crawler.crawl_github_search(query)
        print(json.dumps(stats, indent=2))

    elif command == "stats":
        stats = store.get_stats()
        print(json.dumps(stats, indent=2))

    else:
        print(f"Unknown command: {command}")
        sys.exit(1)

    store.close()


if __name__ == "__main__":
    main()
