#!/usr/bin/env python3
"""
Skill Store - SQLite + FTS5 storage for Claude Code skills.

Provides:
- Skill cataloguing with full-text search
- Skill relationship tracking (requires, extends, complements, conflicts_with, part_of)
- Optional embeddings for semantic search (via Ollama)
- Content deduplication via SHA-256 hashing

Usage:
    from skill_store import SkillStore

    store = SkillStore("skills.db")
    store.index_skill(skill_data)
    results = store.search("pdf processing")
"""

import hashlib
import json
import re
import sqlite3
from dataclasses import dataclass, field, asdict
from datetime import datetime
from pathlib import Path
from typing import Optional


@dataclass
class Skill:
    """Represents a Claude Code skill."""

    name: str
    description: str
    source_url: str = ""
    source_type: str = "local"  # local, github, buildwithclaude
    repository: str = ""
    path: str = ""
    version: str = ""
    content: str = ""
    content_hash: str = ""
    indexed_at: str = ""

    # Frontmatter fields
    allowed_tools: list[str] = field(default_factory=list)
    model: str = ""
    user_invocable: bool = False

    # Metadata
    tags: list[str] = field(default_factory=list)
    author: str = ""
    license: str = ""

    def __post_init__(self):
        if not self.content_hash and self.content:
            self.content_hash = self._compute_hash(self.content)
        if not self.indexed_at:
            self.indexed_at = datetime.utcnow().isoformat()

    @staticmethod
    def _compute_hash(content: str) -> str:
        """Compute SHA-256 hash of normalized content."""
        normalized = content.lower().strip()
        return hashlib.sha256(normalized.encode()).hexdigest()


@dataclass
class SkillRelationship:
    """Represents a relationship between two skills."""

    from_skill: str
    to_skill: str
    relationship: str  # requires, extends, conflicts_with, complements, part_of


class SkillStore:
    """SQLite-based skill storage with FTS5 search."""

    def __init__(self, db_path: str | Path):
        """Initialize the skill store.

        Args:
            db_path: Path to SQLite database file
        """
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self.conn = sqlite3.connect(str(self.db_path))
        self.conn.row_factory = sqlite3.Row
        self._init_schema()

    def _init_schema(self):
        """Initialize database schema."""
        cursor = self.conn.cursor()

        # Enable WAL mode for better concurrent performance
        cursor.execute("PRAGMA journal_mode = WAL")
        cursor.execute("PRAGMA synchronous = NORMAL")

        # Skills table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS skills (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                description TEXT NOT NULL,
                source_url TEXT,
                source_type TEXT,
                repository TEXT,
                path TEXT,
                version TEXT,
                content TEXT,
                content_hash TEXT,
                indexed_at TEXT,
                allowed_tools TEXT,
                model TEXT,
                user_invocable INTEGER DEFAULT 0,
                tags TEXT,
                author TEXT,
                license TEXT
            )
        """)

        # FTS5 virtual table for full-text search
        cursor.execute("""
            CREATE VIRTUAL TABLE IF NOT EXISTS skills_fts USING fts5(
                name,
                description,
                content,
                tags,
                content='skills',
                content_rowid='id'
            )
        """)

        # Triggers to keep FTS in sync
        cursor.execute("""
            CREATE TRIGGER IF NOT EXISTS skills_ai AFTER INSERT ON skills BEGIN
                INSERT INTO skills_fts(rowid, name, description, content, tags)
                VALUES (new.id, new.name, new.description, new.content, new.tags);
            END
        """)

        cursor.execute("""
            CREATE TRIGGER IF NOT EXISTS skills_ad AFTER DELETE ON skills BEGIN
                INSERT INTO skills_fts(skills_fts, rowid, name, description, content, tags)
                VALUES ('delete', old.id, old.name, old.description, old.content, old.tags);
            END
        """)

        cursor.execute("""
            CREATE TRIGGER IF NOT EXISTS skills_au AFTER UPDATE ON skills BEGIN
                INSERT INTO skills_fts(skills_fts, rowid, name, description, content, tags)
                VALUES ('delete', old.id, old.name, old.description, old.content, old.tags);
                INSERT INTO skills_fts(rowid, name, description, content, tags)
                VALUES (new.id, new.name, new.description, new.content, new.tags);
            END
        """)

        # Skill relationships table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS skill_relationships (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                from_skill TEXT NOT NULL,
                to_skill TEXT NOT NULL,
                relationship TEXT NOT NULL,
                UNIQUE(from_skill, to_skill, relationship),
                FOREIGN KEY (from_skill) REFERENCES skills(name) ON DELETE CASCADE,
                FOREIGN KEY (to_skill) REFERENCES skills(name) ON DELETE CASCADE
            )
        """)

        # Embeddings table (optional, for semantic search)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS skill_embeddings (
                skill_name TEXT PRIMARY KEY,
                embedding BLOB,
                model TEXT,
                created_at TEXT,
                FOREIGN KEY (skill_name) REFERENCES skills(name) ON DELETE CASCADE
            )
        """)

        # Indexes
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_skills_name ON skills(name)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_skills_source_type ON skills(source_type)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_skills_content_hash ON skills(content_hash)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_relationships_from ON skill_relationships(from_skill)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_relationships_to ON skill_relationships(to_skill)")

        self.conn.commit()

    def index_skill(self, skill: Skill) -> int:
        """Index a skill in the store.

        Args:
            skill: Skill to index

        Returns:
            ID of the indexed skill
        """
        cursor = self.conn.cursor()

        cursor.execute("""
            INSERT OR REPLACE INTO skills (
                name, description, source_url, source_type, repository, path,
                version, content, content_hash, indexed_at, allowed_tools,
                model, user_invocable, tags, author, license
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            skill.name,
            skill.description,
            skill.source_url,
            skill.source_type,
            skill.repository,
            skill.path,
            skill.version,
            skill.content,
            skill.content_hash,
            skill.indexed_at,
            json.dumps(skill.allowed_tools),
            skill.model,
            1 if skill.user_invocable else 0,
            json.dumps(skill.tags),
            skill.author,
            skill.license
        ))

        self.conn.commit()
        return cursor.lastrowid

    def get_skill(self, name: str) -> Optional[Skill]:
        """Get a skill by name.

        Args:
            name: Skill name

        Returns:
            Skill if found, None otherwise
        """
        cursor = self.conn.cursor()
        cursor.execute("SELECT * FROM skills WHERE name = ?", (name,))
        row = cursor.fetchone()

        if not row:
            return None

        return self._row_to_skill(row)

    def search(
        self,
        query: str,
        limit: int = 20,
        source_type: Optional[str] = None
    ) -> list[Skill]:
        """Search skills using FTS5.

        Args:
            query: Search query
            limit: Maximum results
            source_type: Filter by source type

        Returns:
            List of matching skills
        """
        cursor = self.conn.cursor()

        # Use FTS5 match query
        if source_type:
            cursor.execute("""
                SELECT s.* FROM skills s
                JOIN skills_fts fts ON s.id = fts.rowid
                WHERE skills_fts MATCH ? AND s.source_type = ?
                ORDER BY rank
                LIMIT ?
            """, (query, source_type, limit))
        else:
            cursor.execute("""
                SELECT s.* FROM skills s
                JOIN skills_fts fts ON s.id = fts.rowid
                WHERE skills_fts MATCH ?
                ORDER BY rank
                LIMIT ?
            """, (query, limit))

        return [self._row_to_skill(row) for row in cursor.fetchall()]

    def list_skills(
        self,
        source_type: Optional[str] = None,
        limit: int = 100,
        offset: int = 0
    ) -> list[Skill]:
        """List all skills with optional filtering.

        Args:
            source_type: Filter by source type
            limit: Maximum results
            offset: Pagination offset

        Returns:
            List of skills
        """
        cursor = self.conn.cursor()

        if source_type:
            cursor.execute("""
                SELECT * FROM skills
                WHERE source_type = ?
                ORDER BY name
                LIMIT ? OFFSET ?
            """, (source_type, limit, offset))
        else:
            cursor.execute("""
                SELECT * FROM skills
                ORDER BY name
                LIMIT ? OFFSET ?
            """, (limit, offset))

        return [self._row_to_skill(row) for row in cursor.fetchall()]

    def add_relationship(self, rel: SkillRelationship) -> bool:
        """Add a relationship between skills.

        Args:
            rel: Skill relationship

        Returns:
            True if added, False if already exists
        """
        cursor = self.conn.cursor()

        try:
            cursor.execute("""
                INSERT INTO skill_relationships (from_skill, to_skill, relationship)
                VALUES (?, ?, ?)
            """, (rel.from_skill, rel.to_skill, rel.relationship))
            self.conn.commit()
            return True
        except sqlite3.IntegrityError:
            return False

    def get_relationships(
        self,
        skill_name: str,
        relationship_type: Optional[str] = None
    ) -> list[SkillRelationship]:
        """Get relationships for a skill.

        Args:
            skill_name: Skill name
            relationship_type: Filter by relationship type

        Returns:
            List of relationships
        """
        cursor = self.conn.cursor()

        if relationship_type:
            cursor.execute("""
                SELECT * FROM skill_relationships
                WHERE (from_skill = ? OR to_skill = ?) AND relationship = ?
            """, (skill_name, skill_name, relationship_type))
        else:
            cursor.execute("""
                SELECT * FROM skill_relationships
                WHERE from_skill = ? OR to_skill = ?
            """, (skill_name, skill_name))

        return [
            SkillRelationship(
                from_skill=row["from_skill"],
                to_skill=row["to_skill"],
                relationship=row["relationship"]
            )
            for row in cursor.fetchall()
        ]

    def get_prerequisites(self, skill_name: str) -> list[str]:
        """Get skills that must be learned before this one.

        Args:
            skill_name: Skill name

        Returns:
            List of prerequisite skill names
        """
        cursor = self.conn.cursor()
        cursor.execute("""
            SELECT to_skill FROM skill_relationships
            WHERE from_skill = ? AND relationship = 'requires'
        """, (skill_name,))
        return [row["to_skill"] for row in cursor.fetchall()]

    def find_duplicates(self) -> list[tuple[str, str]]:
        """Find potential duplicate skills by content hash.

        Returns:
            List of (skill1, skill2) tuples that may be duplicates
        """
        cursor = self.conn.cursor()
        cursor.execute("""
            SELECT s1.name as name1, s2.name as name2
            FROM skills s1
            JOIN skills s2 ON s1.content_hash = s2.content_hash
            WHERE s1.id < s2.id AND s1.content_hash != ''
        """)
        return [(row["name1"], row["name2"]) for row in cursor.fetchall()]

    def get_stats(self) -> dict:
        """Get store statistics.

        Returns:
            Dictionary of statistics
        """
        cursor = self.conn.cursor()

        cursor.execute("SELECT COUNT(*) as count FROM skills")
        total = cursor.fetchone()["count"]

        cursor.execute("""
            SELECT source_type, COUNT(*) as count
            FROM skills
            GROUP BY source_type
        """)
        by_source = {row["source_type"]: row["count"] for row in cursor.fetchall()}

        cursor.execute("SELECT COUNT(*) as count FROM skill_relationships")
        relationships = cursor.fetchone()["count"]

        cursor.execute("SELECT COUNT(*) as count FROM skill_embeddings")
        embeddings = cursor.fetchone()["count"]

        return {
            "total_skills": total,
            "by_source": by_source,
            "relationships": relationships,
            "embeddings": embeddings
        }

    def delete_skill(self, name: str) -> bool:
        """Delete a skill by name.

        Args:
            name: Skill name

        Returns:
            True if deleted, False if not found
        """
        cursor = self.conn.cursor()
        cursor.execute("DELETE FROM skills WHERE name = ?", (name,))
        self.conn.commit()
        return cursor.rowcount > 0

    def close(self):
        """Close the database connection."""
        self.conn.close()

    def _row_to_skill(self, row: sqlite3.Row) -> Skill:
        """Convert a database row to a Skill object."""
        return Skill(
            name=row["name"],
            description=row["description"],
            source_url=row["source_url"] or "",
            source_type=row["source_type"] or "local",
            repository=row["repository"] or "",
            path=row["path"] or "",
            version=row["version"] or "",
            content=row["content"] or "",
            content_hash=row["content_hash"] or "",
            indexed_at=row["indexed_at"] or "",
            allowed_tools=json.loads(row["allowed_tools"] or "[]"),
            model=row["model"] or "",
            user_invocable=bool(row["user_invocable"]),
            tags=json.loads(row["tags"] or "[]"),
            author=row["author"] or "",
            license=row["license"] or ""
        )


def parse_skill_file(skill_path: Path) -> Optional[Skill]:
    """Parse a SKILL.md file into a Skill object.

    Args:
        skill_path: Path to SKILL.md file

    Returns:
        Skill object or None if parsing fails
    """
    content = skill_path.read_text()

    # Extract YAML frontmatter
    frontmatter_match = re.match(r'^---\n(.*?)\n---\n', content, re.DOTALL)
    if not frontmatter_match:
        return None

    frontmatter_text = frontmatter_match.group(1)
    body = content[frontmatter_match.end():]

    # Simple YAML parsing (for common fields)
    frontmatter = {}
    for line in frontmatter_text.split('\n'):
        if ':' in line:
            key, value = line.split(':', 1)
            key = key.strip()
            value = value.strip()

            # Handle quoted strings
            if value.startswith('"') and value.endswith('"'):
                value = value[1:-1]
            elif value.startswith("'") and value.endswith("'"):
                value = value[1:-1]

            # Handle lists
            if value.startswith('[') and value.endswith(']'):
                value = [v.strip().strip('"\'') for v in value[1:-1].split(',')]

            frontmatter[key] = value

    name = frontmatter.get('name', skill_path.parent.name)
    description = frontmatter.get('description', '')

    if not name or not description:
        return None

    return Skill(
        name=name,
        description=description,
        path=str(skill_path),
        content=content,
        allowed_tools=frontmatter.get('allowed-tools', []) if isinstance(frontmatter.get('allowed-tools'), list) else [],
        model=frontmatter.get('model', ''),
        user_invocable=frontmatter.get('user-invocable', 'false').lower() == 'true' if isinstance(frontmatter.get('user-invocable'), str) else False,
        version=frontmatter.get('version', ''),
        author=frontmatter.get('author', ''),
        license=frontmatter.get('license', ''),
        tags=frontmatter.get('tags', []) if isinstance(frontmatter.get('tags'), list) else []
    )


if __name__ == "__main__":
    # Example usage
    import sys

    store = SkillStore("skills.db")

    if len(sys.argv) > 1:
        command = sys.argv[1]

        if command == "stats":
            stats = store.get_stats()
            print(json.dumps(stats, indent=2))

        elif command == "search" and len(sys.argv) > 2:
            query = " ".join(sys.argv[2:])
            results = store.search(query)
            for skill in results:
                print(f"{skill.name}: {skill.description[:80]}...")

        elif command == "index" and len(sys.argv) > 2:
            path = Path(sys.argv[2])
            if path.exists():
                skill = parse_skill_file(path)
                if skill:
                    store.index_skill(skill)
                    print(f"Indexed: {skill.name}")
                else:
                    print(f"Failed to parse: {path}")
            else:
                print(f"File not found: {path}")

        elif command == "list":
            skills = store.list_skills()
            for skill in skills:
                print(f"{skill.name}: {skill.description[:60]}...")

        else:
            print("Usage: skill_store.py [stats|search <query>|index <path>|list]")
    else:
        print("Usage: skill_store.py [stats|search <query>|index <path>|list]")

    store.close()
