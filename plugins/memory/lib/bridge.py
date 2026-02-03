#!/usr/bin/env python3
"""
Memory Bridge - Connects hooks to production memory system.

This bridge provides a thin adapter layer that:
1. Lazily initializes the production MemoryTierManager
2. Falls back gracefully to JSONL mode if initialization fails
3. Provides a simple interface for hooks (capture, get_context)
4. Handles all error conditions silently (hooks must never crash)

Usage:
    from plugins.memory.lib.bridge import MemoryBridge

    bridge = MemoryBridge()
    bridge.capture("Observation text", importance=0.7)
    context = bridge.get_context("User prompt")
"""

import fcntl
import hashlib
import json
import os
import sys
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional, Dict, Any, List

# Add skills tools to path for production imports
_lib_dir = Path(__file__).parent
_plugin_dir = _lib_dir.parent
_tools_dir = _plugin_dir / "skills" / "memory-architecture" / "tools"
if str(_tools_dir) not in sys.path:
    sys.path.insert(0, str(_tools_dir))

from paths import get_memory_path, ensure_memory_dirs


class MemoryBridge:
    """
    Bridge adapter between hooks and production memory system.

    Implements graceful degradation: uses production MemoryTierManager when
    available, falls back to simple JSONL storage otherwise.
    """

    _instance: Optional["MemoryBridge"] = None
    _manager: Optional[Any] = None
    _initialized: bool = False
    _mode: str = "unknown"  # "production", "legacy", or "disabled"

    def __new__(cls) -> "MemoryBridge":
        """Singleton pattern - one bridge instance per process."""
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self):
        """Initialize the bridge (only runs once due to singleton)."""
        if self._initialized:
            return

        self._initialized = True
        self._memory_dir = ensure_memory_dirs()
        self._mode = self._detect_mode()

        if self._mode == "production":
            self._init_production()

    def _detect_mode(self) -> str:
        """Detect which mode to operate in."""
        # Check for explicit mode override
        mode_env = os.getenv("MEMORY_MODE", "auto")
        if mode_env == "legacy":
            return "legacy"
        if mode_env == "disabled":
            return "disabled"

        # Check if production system is initialized
        config_file = self._memory_dir / "config.json"
        warm_db = self._memory_dir / "warm.db"

        if config_file.exists() and warm_db.exists():
            return "production"

        return "legacy"

    def _init_production(self) -> bool:
        """Initialize the production MemoryTierManager."""
        try:
            from memory_tier_manager import MemoryTierManager
            self._manager = MemoryTierManager(str(self._memory_dir))
            return True
        except ImportError as e:
            self._mode = "legacy"
            return False
        except Exception as e:
            self._mode = "legacy"
            return False

    @property
    def mode(self) -> str:
        """Return current operating mode."""
        return self._mode

    @property
    def is_production(self) -> bool:
        """Check if running in production mode."""
        return self._mode == "production" and self._manager is not None

    def capture(
        self,
        content: str,
        importance: float = 0.5,
        source: str = "observation",
        metadata: Optional[Dict[str, Any]] = None
    ) -> Optional[str]:
        """
        Capture an observation to memory.

        Args:
            content: The observation text to store
            importance: 0.0-1.0 importance score (affects tier placement)
            source: Source identifier (e.g., "tool:Edit", "response")
            metadata: Optional additional metadata

        Returns:
            Memory ID if stored, None otherwise
        """
        if self._mode == "disabled":
            return None

        if self.is_production:
            try:
                return self._manager.capture(
                    content=content,
                    importance=importance,
                    source=source,
                    metadata=metadata or {}
                )
            except Exception:
                pass  # Fall through to legacy

        # Legacy mode: append to JSONL
        return self._capture_legacy(content, importance, source, metadata)

    def _capture_legacy(
        self,
        content: str,
        importance: float,
        source: str,
        metadata: Optional[Dict[str, Any]]
    ) -> Optional[str]:
        """Legacy capture to JSONL files."""
        observation = {
            "content": content,
            "importance": importance,
            "source": source,
            "metadata": metadata or {},
            "timestamp": datetime.now().isoformat(),
            "hash": hashlib.sha256(content.encode()).hexdigest()[:16]
        }

        # Hot cache (always) - with file locking for concurrent safety
        hot_file = self._memory_dir / "hot_cache.jsonl"
        try:
            with open(hot_file, "a") as f:
                fcntl.flock(f.fileno(), fcntl.LOCK_EX)
                try:
                    json.dump(observation, f)
                    f.write("\n")
                finally:
                    fcntl.flock(f.fileno(), fcntl.LOCK_UN)
        except OSError:
            pass

        # Warm index (for later processing) - with file locking
        warm_file = self._memory_dir / "warm_index.jsonl"
        try:
            with open(warm_file, "a") as f:
                fcntl.flock(f.fileno(), fcntl.LOCK_EX)
                try:
                    json.dump(observation, f)
                    f.write("\n")
                finally:
                    fcntl.flock(f.fileno(), fcntl.LOCK_UN)
        except OSError:
            pass

        return observation["hash"]

    def get_context(self, prompt: str, max_tokens: int = 1000) -> str:
        """
        Get context for a prompt from memory.

        Args:
            prompt: The user's prompt to find context for
            max_tokens: Maximum context size (approximate)

        Returns:
            Formatted context string or empty string
        """
        if self._mode == "disabled":
            return ""

        if self.is_production:
            try:
                return self._manager.get_context_for_prompt(prompt, max_tokens)
            except Exception:
                pass  # Fall through to legacy

        # Legacy mode: load from JSONL
        return self._get_context_legacy(prompt)

    def _get_context_legacy(self, prompt: str) -> str:
        """Legacy context retrieval from JSONL."""
        parts = []

        # Hot memory (always inject)
        hot_memories = self._load_hot_legacy()
        if hot_memories:
            parts.append("[RECENT CONTEXT]")
            for i, mem in enumerate(hot_memories[:5], 1):
                content = mem.get("content", "")[:500]
                parts.append(f"[{i}] {content}")
            parts.append("")

        # Warm memory (triggered)
        if self._should_trigger_warm(prompt):
            warm_memories = self._search_warm_legacy(prompt)
            if warm_memories:
                parts.append("[RELATED CONTEXT]")
                for i, mem in enumerate(warm_memories[:2], 1):
                    content = mem.get("content", "")[:300]
                    score = mem.get("score", 0)
                    parts.append(f"[{i}] (relevance: {score:.2f}) {content}")
                parts.append("")

        if parts:
            parts.append("[END MEMORY CONTEXT]")
            return "\n".join(parts)

        return ""

    def _load_hot_legacy(self) -> List[Dict]:
        """Load hot memory from JSONL."""
        hot_file = self._memory_dir / "hot_cache.jsonl"
        if not hot_file.exists():
            return []

        cutoff = datetime.now() - timedelta(hours=24)
        memories = []

        try:
            for line in hot_file.read_text().strip().split("\n"):
                if not line:
                    continue
                memory = json.loads(line)
                try:
                    timestamp = datetime.fromisoformat(memory.get("timestamp", ""))
                    if timestamp > cutoff:
                        memories.append(memory)
                except (ValueError, TypeError):
                    continue
        except (json.JSONDecodeError, OSError):
            pass

        memories.sort(key=lambda x: x.get("timestamp", ""), reverse=True)
        return memories[:5]

    def _should_trigger_warm(self, prompt: str) -> bool:
        """Check if warm memory should be triggered."""
        prompt_lower = prompt.lower()

        triggers = [
            "?" in prompt,
            len(prompt.split()) > 10,
            any(ext in prompt for ext in [".py", ".js", ".ts", ".md", ".json"]),
            any(word in prompt_lower for word in [
                "why", "how", "previous", "earlier", "remember",
                "yesterday", "last week", "before", "what did"
            ])
        ]

        return any(triggers)

    def _search_warm_legacy(self, prompt: str) -> List[Dict]:
        """Search warm memory using keyword matching."""
        warm_file = self._memory_dir / "warm_index.jsonl"
        if not warm_file.exists():
            return []

        prompt_words = set(prompt.lower().split())
        results = []
        cutoff = datetime.now() - timedelta(days=7)

        try:
            for line in warm_file.read_text().strip().split("\n"):
                if not line:
                    continue
                memory = json.loads(line)

                try:
                    timestamp = datetime.fromisoformat(memory.get("timestamp", ""))
                    if timestamp < cutoff:
                        continue
                except (ValueError, TypeError):
                    continue

                content_words = set(memory.get("content", "").lower().split())
                overlap = len(prompt_words & content_words)

                if overlap > 2:
                    memory["score"] = overlap / max(len(prompt_words), 1)
                    results.append(memory)
        except (json.JSONDecodeError, OSError):
            pass

        results.sort(key=lambda x: x.get("score", 0), reverse=True)
        return results[:2]

    def run_maintenance(self) -> Dict[str, Any]:
        """Run maintenance tasks (cleanup, archival)."""
        if self.is_production:
            try:
                return self._manager.run_maintenance()
            except Exception as e:
                return {"error": str(e), "mode": self._mode}

        return {"mode": self._mode, "note": "No maintenance in legacy mode"}

    def get_stats(self) -> Dict[str, Any]:
        """Get memory system statistics."""
        stats = {
            "mode": self._mode,
            "memory_dir": str(self._memory_dir),
        }

        if self.is_production:
            try:
                manager_stats = self._manager.run_maintenance()
                stats.update(manager_stats)
            except Exception:
                pass

        # Legacy stats
        hot_file = self._memory_dir / "hot_cache.jsonl"
        warm_file = self._memory_dir / "warm_index.jsonl"

        if hot_file.exists():
            try:
                lines = hot_file.read_text().strip().split("\n")
                stats["hot_entries_legacy"] = len([l for l in lines if l])
            except OSError:
                pass

        if warm_file.exists():
            try:
                lines = warm_file.read_text().strip().split("\n")
                stats["warm_entries_legacy"] = len([l for l in lines if l])
            except OSError:
                pass

        return stats


# Module-level singleton for easy access
_bridge: Optional[MemoryBridge] = None


def get_bridge() -> MemoryBridge:
    """Get or create the singleton bridge instance."""
    global _bridge
    if _bridge is None:
        _bridge = MemoryBridge()
    return _bridge


if __name__ == "__main__":
    import sys

    bridge = get_bridge()

    if len(sys.argv) > 1:
        command = sys.argv[1]

        if command == "stats":
            print(json.dumps(bridge.get_stats(), indent=2))

        elif command == "capture" and len(sys.argv) > 2:
            content = " ".join(sys.argv[2:])
            mem_id = bridge.capture(content, importance=0.5)
            print(f"Captured: {mem_id}")

        elif command == "context" and len(sys.argv) > 2:
            prompt = " ".join(sys.argv[2:])
            context = bridge.get_context(prompt)
            print(context or "(no context)")

        elif command == "mode":
            print(f"Mode: {bridge.mode}")
            print(f"Production: {bridge.is_production}")

        else:
            print("Usage: bridge.py [stats|capture <text>|context <prompt>|mode]")
    else:
        print(f"Memory Bridge v0.1.0")
        print(f"Mode: {bridge.mode}")
        print(f"Stats: {json.dumps(bridge.get_stats(), indent=2)}")
