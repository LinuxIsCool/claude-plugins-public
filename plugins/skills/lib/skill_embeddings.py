#!/usr/bin/env python3
"""
Skill Embeddings - Semantic search for Claude Code skills via Ollama.

Uses nomic-embed-text (768 dimensions) for embedding skill descriptions
and content. Supports semantic similarity search with optional RRF fusion
with FTS5 keyword search.

Requirements:
    - Ollama running locally (ollama serve)
    - nomic-embed-text model (ollama pull nomic-embed-text)

Usage:
    from skill_embeddings import SkillEmbeddings
    from skill_store import SkillStore

    store = SkillStore("skills.db")
    embeddings = SkillEmbeddings(store)

    # Generate embeddings for all skills
    embeddings.embed_all()

    # Semantic search
    results = embeddings.semantic_search("process PDF files")

    # Hybrid search (FTS5 + embeddings with RRF)
    results = embeddings.hybrid_search("extract text from documents")
"""

import json
import sqlite3
import struct
from datetime import datetime
from pathlib import Path
from typing import Optional
import urllib.request
import urllib.error

from skill_store import SkillStore, Skill


# Default Ollama settings
OLLAMA_HOST = "http://localhost:11434"
EMBED_MODEL = "nomic-embed-text"
EMBED_DIM = 768


class SkillEmbeddings:
    """Semantic search for skills using Ollama embeddings."""

    def __init__(
        self,
        store: SkillStore,
        ollama_host: str = OLLAMA_HOST,
        model: str = EMBED_MODEL
    ):
        """Initialize embeddings manager.

        Args:
            store: SkillStore instance
            ollama_host: Ollama API host
            model: Embedding model name
        """
        self.store = store
        self.ollama_host = ollama_host
        self.model = model

    def _get_embedding(self, text: str) -> Optional[list[float]]:
        """Get embedding vector from Ollama.

        Args:
            text: Text to embed

        Returns:
            Embedding vector or None if failed
        """
        url = f"{self.ollama_host}/api/embeddings"
        data = json.dumps({
            "model": self.model,
            "prompt": text
        }).encode()

        req = urllib.request.Request(
            url,
            data=data,
            headers={"Content-Type": "application/json"}
        )

        try:
            with urllib.request.urlopen(req, timeout=30) as response:
                result = json.loads(response.read())
                return result.get("embedding")
        except (urllib.error.URLError, json.JSONDecodeError, TimeoutError) as e:
            print(f"Embedding error: {e}")
            return None

    def _pack_embedding(self, embedding: list[float]) -> bytes:
        """Pack embedding vector as binary blob.

        Args:
            embedding: List of floats

        Returns:
            Binary blob
        """
        return struct.pack(f"{len(embedding)}f", *embedding)

    def _unpack_embedding(self, blob: bytes) -> list[float]:
        """Unpack embedding vector from binary blob.

        Args:
            blob: Binary blob

        Returns:
            List of floats
        """
        count = len(blob) // 4  # 4 bytes per float
        return list(struct.unpack(f"{count}f", blob))

    def _cosine_similarity(self, a: list[float], b: list[float]) -> float:
        """Compute cosine similarity between two vectors.

        Args:
            a: First vector
            b: Second vector

        Returns:
            Similarity score (0-1)
        """
        dot = sum(x * y for x, y in zip(a, b))
        norm_a = sum(x * x for x in a) ** 0.5
        norm_b = sum(x * x for x in b) ** 0.5
        return dot / (norm_a * norm_b) if norm_a and norm_b else 0.0

    def embed_skill(self, skill_name: str) -> bool:
        """Generate and store embedding for a skill.

        Args:
            skill_name: Name of the skill

        Returns:
            True if successful
        """
        skill = self.store.get_skill(skill_name)
        if not skill:
            return False

        # Create embedding text from description + content summary
        embed_text = f"{skill.name}\n{skill.description}"
        if skill.content:
            # Include first 1000 chars of content for richer embedding
            embed_text += f"\n{skill.content[:1000]}"

        embedding = self._get_embedding(embed_text)
        if not embedding:
            return False

        cursor = self.store.conn.cursor()
        cursor.execute("""
            INSERT OR REPLACE INTO skill_embeddings (skill_name, embedding, model, created_at)
            VALUES (?, ?, ?, ?)
        """, (
            skill_name,
            self._pack_embedding(embedding),
            self.model,
            datetime.utcnow().isoformat()
        ))
        self.store.conn.commit()
        return True

    def embed_all(self, batch_size: int = 10) -> dict:
        """Generate embeddings for all skills without them.

        Args:
            batch_size: Logging frequency

        Returns:
            Stats dictionary
        """
        cursor = self.store.conn.cursor()

        # Find skills without embeddings
        cursor.execute("""
            SELECT s.name FROM skills s
            LEFT JOIN skill_embeddings e ON s.name = e.skill_name
            WHERE e.skill_name IS NULL
        """)
        skill_names = [row[0] for row in cursor.fetchall()]

        success = 0
        failed = 0

        for i, name in enumerate(skill_names):
            if self.embed_skill(name):
                success += 1
            else:
                failed += 1

            if (i + 1) % batch_size == 0:
                print(f"Processed {i + 1}/{len(skill_names)} skills...")

        return {
            "total": len(skill_names),
            "success": success,
            "failed": failed
        }

    def semantic_search(
        self,
        query: str,
        limit: int = 20,
        threshold: float = 0.5
    ) -> list[tuple[Skill, float]]:
        """Search skills by semantic similarity.

        Args:
            query: Search query
            limit: Maximum results
            threshold: Minimum similarity score

        Returns:
            List of (skill, score) tuples
        """
        query_embedding = self._get_embedding(query)
        if not query_embedding:
            return []

        cursor = self.store.conn.cursor()
        cursor.execute("""
            SELECT s.*, e.embedding
            FROM skills s
            JOIN skill_embeddings e ON s.name = e.skill_name
        """)

        results = []
        for row in cursor.fetchall():
            embedding = self._unpack_embedding(row["embedding"])
            score = self._cosine_similarity(query_embedding, embedding)

            if score >= threshold:
                skill = self.store._row_to_skill(row)
                results.append((skill, score))

        # Sort by score descending
        results.sort(key=lambda x: x[1], reverse=True)
        return results[:limit]

    def hybrid_search(
        self,
        query: str,
        limit: int = 20,
        fts_weight: float = 0.4,
        semantic_weight: float = 0.6
    ) -> list[tuple[Skill, float]]:
        """Hybrid search using FTS5 + embeddings with RRF fusion.

        Reciprocal Rank Fusion (RRF) combines rankings from multiple
        retrieval methods for better results.

        Args:
            query: Search query
            limit: Maximum results
            fts_weight: Weight for FTS5 results
            semantic_weight: Weight for semantic results

        Returns:
            List of (skill, score) tuples
        """
        # Get FTS5 results
        fts_results = self.store.search(query, limit=limit * 2)

        # Get semantic results
        semantic_results = self.semantic_search(query, limit=limit * 2, threshold=0.3)

        # RRF fusion
        rrf_scores: dict[str, float] = {}
        k = 60  # RRF constant

        # Add FTS scores
        for rank, skill in enumerate(fts_results):
            rrf_scores[skill.name] = rrf_scores.get(skill.name, 0) + \
                fts_weight * (1 / (k + rank + 1))

        # Add semantic scores
        for rank, (skill, _) in enumerate(semantic_results):
            rrf_scores[skill.name] = rrf_scores.get(skill.name, 0) + \
                semantic_weight * (1 / (k + rank + 1))

        # Build result list
        all_skills = {s.name: s for s in fts_results}
        all_skills.update({s.name: s for s, _ in semantic_results})

        results = [
            (all_skills[name], score)
            for name, score in sorted(rrf_scores.items(), key=lambda x: x[1], reverse=True)
        ]

        return results[:limit]

    def find_similar(
        self,
        skill_name: str,
        limit: int = 10,
        threshold: float = 0.7
    ) -> list[tuple[Skill, float]]:
        """Find skills similar to a given skill.

        Args:
            skill_name: Name of the reference skill
            limit: Maximum results
            threshold: Minimum similarity score

        Returns:
            List of (skill, score) tuples
        """
        cursor = self.store.conn.cursor()
        cursor.execute(
            "SELECT embedding FROM skill_embeddings WHERE skill_name = ?",
            (skill_name,)
        )
        row = cursor.fetchone()

        if not row:
            return []

        reference_embedding = self._unpack_embedding(row["embedding"])

        cursor.execute("""
            SELECT s.*, e.embedding
            FROM skills s
            JOIN skill_embeddings e ON s.name = e.skill_name
            WHERE s.name != ?
        """, (skill_name,))

        results = []
        for row in cursor.fetchall():
            embedding = self._unpack_embedding(row["embedding"])
            score = self._cosine_similarity(reference_embedding, embedding)

            if score >= threshold:
                skill = self.store._row_to_skill(row)
                results.append((skill, score))

        results.sort(key=lambda x: x[1], reverse=True)
        return results[:limit]


def check_ollama() -> bool:
    """Check if Ollama is running and model is available.

    Returns:
        True if Ollama is ready
    """
    try:
        req = urllib.request.Request(f"{OLLAMA_HOST}/api/tags")
        with urllib.request.urlopen(req, timeout=5) as response:
            result = json.loads(response.read())
            models = [m.get("name", "") for m in result.get("models", [])]
            return any(EMBED_MODEL in m for m in models)
    except (urllib.error.URLError, json.JSONDecodeError, TimeoutError):
        return False


if __name__ == "__main__":
    import sys

    if not check_ollama():
        print(f"Ollama not running or {EMBED_MODEL} model not available.")
        print(f"Start Ollama: ollama serve")
        print(f"Pull model: ollama pull {EMBED_MODEL}")
        sys.exit(1)

    store = SkillStore("skills.db")
    embeddings = SkillEmbeddings(store)

    if len(sys.argv) > 1:
        command = sys.argv[1]

        if command == "embed-all":
            stats = embeddings.embed_all()
            print(json.dumps(stats, indent=2))

        elif command == "search" and len(sys.argv) > 2:
            query = " ".join(sys.argv[2:])
            results = embeddings.semantic_search(query)
            for skill, score in results:
                print(f"{score:.3f} {skill.name}: {skill.description[:60]}...")

        elif command == "hybrid" and len(sys.argv) > 2:
            query = " ".join(sys.argv[2:])
            results = embeddings.hybrid_search(query)
            for skill, score in results:
                print(f"{score:.3f} {skill.name}: {skill.description[:60]}...")

        elif command == "similar" and len(sys.argv) > 2:
            skill_name = sys.argv[2]
            results = embeddings.find_similar(skill_name)
            for skill, score in results:
                print(f"{score:.3f} {skill.name}: {skill.description[:60]}...")

        else:
            print("Usage: skill_embeddings.py [embed-all|search <query>|hybrid <query>|similar <skill>]")
    else:
        print("Usage: skill_embeddings.py [embed-all|search <query>|hybrid <query>|similar <skill>]")

    store.close()
