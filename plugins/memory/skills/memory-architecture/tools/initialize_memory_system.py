#!/usr/bin/env python3
"""
Memory System Initializer

Sets up the three-tier memory system with production embedding providers
and creates the pipeline for ingesting Claude Code logs.

Usage:
    python initialize_memory_system.py check          # Check system readiness
    python initialize_memory_system.py init           # Initialize memory system
    python initialize_memory_system.py ingest <dir>   # Ingest logs from directory
    python initialize_memory_system.py status         # Show system status
"""

import os
import sys
import json
import subprocess
from pathlib import Path
from datetime import datetime
from typing import Dict, Any, Optional, List
from dataclasses import dataclass


# Configuration
DEFAULT_CONFIG = {
    "embedding": {
        "provider": "ollama",  # ollama, openai, or sentence-transformers
        "model": "all-minilm",  # all-minilm (fastest), bge-m3 (best), qwen3 (frontier)
        "ollama_url": "http://localhost:11434",
        "dimensions": 384,  # Matches all-minilm default
    },
    "storage": {
        "base_path": ".claude/memory",
        "hot_tier": "hot",
        "warm_tier": "warm.db",
        "cold_tier": "cold",
    },
    "tiers": {
        "hot_max_entries": 100,
        "hot_ttl_hours": 24,
        "warm_ttl_days": 7,
        "similarity_threshold": 0.4,
    },
    "extraction": {
        "min_importance": 0.3,
        "batch_size": 100,
    }
}


@dataclass
class SystemStatus:
    ollama_available: bool
    ollama_models: List[str]
    chromadb_available: bool
    sqlite_available: bool
    storage_initialized: bool
    config_valid: bool
    messages: List[str]


def get_repo_root() -> Path:
    """Find the git repository root."""
    result = subprocess.run(
        ['git', 'rev-parse', '--show-toplevel'],
        capture_output=True,
        text=True
    )
    if result.returncode == 0:
        return Path(result.stdout.strip())
    return Path.cwd()


def get_config_path() -> Path:
    """Get the memory system configuration path."""
    return get_repo_root() / ".claude" / "memory" / "config.json"


def load_config() -> Dict[str, Any]:
    """Load or create configuration."""
    config_path = get_config_path()
    if config_path.exists():
        with open(config_path, 'r') as f:
            return json.load(f)
    return DEFAULT_CONFIG.copy()


def save_config(config: Dict[str, Any]) -> None:
    """Save configuration."""
    config_path = get_config_path()
    config_path.parent.mkdir(parents=True, exist_ok=True)
    with open(config_path, 'w') as f:
        json.dump(config, f, indent=2)


def check_ollama() -> tuple[bool, List[str]]:
    """Check if Ollama is available and list models."""
    try:
        result = subprocess.run(
            ['ollama', 'list'],
            capture_output=True,
            text=True,
            timeout=5
        )
        if result.returncode == 0:
            lines = result.stdout.strip().split('\n')[1:]  # Skip header
            models = [line.split()[0] for line in lines if line.strip()]
            return True, models
        return False, []
    except (subprocess.TimeoutExpired, FileNotFoundError):
        return False, []


def check_chromadb() -> bool:
    """Check if ChromaDB is importable."""
    try:
        import chromadb
        return True
    except ImportError:
        return False


def check_system() -> SystemStatus:
    """Comprehensive system check."""
    messages = []

    # Check Ollama
    ollama_available, ollama_models = check_ollama()
    if ollama_available:
        messages.append(f"✓ Ollama available with {len(ollama_models)} models")
        if 'all-minilm' not in str(ollama_models):
            messages.append("  → Consider: ollama pull all-minilm")
    else:
        messages.append("✗ Ollama not available")
        messages.append("  → Install: curl -fsSL https://ollama.com/install.sh | sh")

    # Check ChromaDB
    chromadb_available = check_chromadb()
    if chromadb_available:
        messages.append("✓ ChromaDB available")
    else:
        messages.append("✗ ChromaDB not installed")
        messages.append("  → Install: pip install chromadb")

    # SQLite is always available in Python
    sqlite_available = True
    messages.append("✓ SQLite available (built-in)")

    # Check storage
    config = load_config()
    base_path = get_repo_root() / config['storage']['base_path']
    storage_initialized = base_path.exists()
    if storage_initialized:
        messages.append(f"✓ Storage initialized at {base_path}")
    else:
        messages.append(f"○ Storage not initialized (will create at {base_path})")

    # Check config validity
    config_path = get_config_path()
    config_valid = config_path.exists()
    if config_valid:
        messages.append(f"✓ Config file exists at {config_path}")
    else:
        messages.append("○ Config file not created (will use defaults)")

    return SystemStatus(
        ollama_available=ollama_available,
        ollama_models=ollama_models,
        chromadb_available=chromadb_available,
        sqlite_available=sqlite_available,
        storage_initialized=storage_initialized,
        config_valid=config_valid,
        messages=messages
    )


def initialize_system(config: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Initialize the memory system."""
    if config is None:
        config = load_config()

    repo_root = get_repo_root()
    base_path = repo_root / config['storage']['base_path']

    results = {
        "success": True,
        "actions": [],
        "errors": []
    }

    # Create directory structure
    try:
        base_path.mkdir(parents=True, exist_ok=True)
        (base_path / config['storage']['hot_tier']).mkdir(exist_ok=True)
        (base_path / config['storage']['cold_tier']).mkdir(exist_ok=True)
        results['actions'].append(f"Created directory structure at {base_path}")
    except Exception as e:
        results['errors'].append(f"Failed to create directories: {e}")
        results['success'] = False

    # Initialize SQLite warm tier database
    try:
        import sqlite3
        warm_db_path = base_path / config['storage']['warm_tier']
        conn = sqlite3.connect(warm_db_path)
        cursor = conn.cursor()

        # Create memories table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS memories (
                id TEXT PRIMARY KEY,
                content TEXT NOT NULL,
                embedding BLOB,
                importance REAL DEFAULT 0.5,
                created_at TEXT NOT NULL,
                last_accessed TEXT,
                access_count INTEGER DEFAULT 0,
                source TEXT,
                session_id TEXT,
                entity_type TEXT,
                metadata TEXT
            )
        ''')

        # Create FTS5 virtual table for full-text search
        cursor.execute('''
            CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
                content,
                content='memories',
                content_rowid='rowid'
            )
        ''')

        # Create triggers to keep FTS in sync
        cursor.execute('''
            CREATE TRIGGER IF NOT EXISTS memories_ai AFTER INSERT ON memories BEGIN
                INSERT INTO memories_fts(rowid, content)
                VALUES (new.rowid, new.content);
            END
        ''')

        cursor.execute('''
            CREATE TRIGGER IF NOT EXISTS memories_ad AFTER DELETE ON memories BEGIN
                INSERT INTO memories_fts(memories_fts, rowid, content)
                VALUES('delete', old.rowid, old.content);
            END
        ''')

        cursor.execute('''
            CREATE TRIGGER IF NOT EXISTS memories_au AFTER UPDATE ON memories BEGIN
                INSERT INTO memories_fts(memories_fts, rowid, content)
                VALUES('delete', old.rowid, old.content);
                INSERT INTO memories_fts(rowid, content)
                VALUES (new.rowid, new.content);
            END
        ''')

        # Create indices
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_memories_created ON memories(created_at)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_memories_importance ON memories(importance)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_memories_session ON memories(session_id)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_memories_type ON memories(entity_type)')

        conn.commit()
        conn.close()
        results['actions'].append(f"Initialized SQLite database at {warm_db_path}")
    except Exception as e:
        results['errors'].append(f"Failed to initialize SQLite: {e}")
        results['success'] = False

    # Save config
    try:
        save_config(config)
        results['actions'].append(f"Saved configuration to {get_config_path()}")
    except Exception as e:
        results['errors'].append(f"Failed to save config: {e}")

    return results


def ingest_logs(log_dir: Path, config: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Ingest logs from a directory into the memory system."""
    if config is None:
        config = load_config()

    # Import the extractor (assuming it's in the same directory)
    script_dir = Path(__file__).parent
    sys.path.insert(0, str(script_dir))

    try:
        from log_entity_extractor import LogEntityExtractor, ExtractedEntity
    except ImportError:
        return {
            "success": False,
            "error": "log_entity_extractor.py not found in the same directory"
        }

    repo_root = get_repo_root()
    base_path = repo_root / config['storage']['base_path']

    results = {
        "success": True,
        "files_processed": 0,
        "entities_extracted": 0,
        "entities_stored": 0,
        "by_type": {},
        "errors": []
    }

    # Initialize extractor
    extractor = LogEntityExtractor(min_importance=config['extraction']['min_importance'])

    # Find all JSONL files
    log_path = Path(log_dir)
    if not log_path.is_absolute():
        log_path = repo_root / log_path

    jsonl_files = list(log_path.rglob('*.jsonl'))
    print(f"Found {len(jsonl_files)} JSONL files to process")

    # Connect to warm tier database
    import sqlite3
    from datetime import datetime
    import hashlib

    warm_db_path = base_path / config['storage']['warm_tier']
    conn = sqlite3.connect(warm_db_path)
    cursor = conn.cursor()

    batch = []
    batch_size = config['extraction']['batch_size']

    for filepath in jsonl_files:
        try:
            for entity in extractor.extract_from_file(filepath):
                results['entities_extracted'] += 1
                results['by_type'][entity.entity_type] = results['by_type'].get(entity.entity_type, 0) + 1

                # Create a unique ID based on content hash
                entity_id = hashlib.sha256(
                    f"{entity.content}{entity.timestamp}{entity.source_line}".encode()
                ).hexdigest()[:16]

                batch.append((
                    entity_id,
                    entity.content,
                    None,  # embedding (to be added later)
                    entity.importance,
                    entity.timestamp or datetime.now().isoformat(),
                    None,  # last_accessed
                    0,  # access_count
                    entity.source_file,
                    entity.session_id,
                    entity.entity_type,
                    json.dumps(entity.metadata)
                ))

                # Batch insert
                if len(batch) >= batch_size:
                    try:
                        cursor.executemany('''
                            INSERT OR IGNORE INTO memories
                            (id, content, embedding, importance, created_at, last_accessed,
                             access_count, source, session_id, entity_type, metadata)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        ''', batch)
                        conn.commit()
                        results['entities_stored'] += cursor.rowcount
                    except Exception as e:
                        results['errors'].append(f"Batch insert error: {e}")
                    batch = []

            results['files_processed'] += 1
            if results['files_processed'] % 50 == 0:
                print(f"  Processed {results['files_processed']}/{len(jsonl_files)} files...")

        except Exception as e:
            results['errors'].append(f"Error processing {filepath}: {e}")

    # Insert remaining batch
    if batch:
        try:
            cursor.executemany('''
                INSERT OR IGNORE INTO memories
                (id, content, embedding, importance, created_at, last_accessed,
                 access_count, source, session_id, entity_type, metadata)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', batch)
            conn.commit()
            results['entities_stored'] += cursor.rowcount
        except Exception as e:
            results['errors'].append(f"Final batch insert error: {e}")

    conn.close()
    return results


def show_status() -> Dict[str, Any]:
    """Show current memory system status."""
    config = load_config()
    repo_root = get_repo_root()
    base_path = repo_root / config['storage']['base_path']

    status = {
        "initialized": base_path.exists(),
        "config_path": str(get_config_path()),
        "storage_path": str(base_path),
    }

    if base_path.exists():
        # Check warm tier
        warm_db_path = base_path / config['storage']['warm_tier']
        if warm_db_path.exists():
            import sqlite3
            conn = sqlite3.connect(warm_db_path)
            cursor = conn.cursor()

            cursor.execute('SELECT COUNT(*) FROM memories')
            total = cursor.fetchone()[0]

            cursor.execute('SELECT entity_type, COUNT(*) FROM memories GROUP BY entity_type')
            by_type = dict(cursor.fetchall())

            cursor.execute('SELECT COUNT(*) FROM memories WHERE embedding IS NOT NULL')
            with_embeddings = cursor.fetchone()[0]

            cursor.execute('SELECT MIN(created_at), MAX(created_at) FROM memories')
            date_range = cursor.fetchone()

            conn.close()

            status['warm_tier'] = {
                'total_memories': total,
                'by_type': by_type,
                'with_embeddings': with_embeddings,
                'date_range': date_range,
                'db_size_mb': round(warm_db_path.stat().st_size / 1024 / 1024, 2)
            }

        # Check hot tier
        hot_path = base_path / config['storage']['hot_tier']
        if hot_path.exists():
            hot_files = list(hot_path.glob('*.json'))
            status['hot_tier'] = {
                'files': len(hot_files)
            }

        # Check cold tier
        cold_path = base_path / config['storage']['cold_tier']
        if cold_path.exists():
            cold_files = list(cold_path.glob('*.jsonl'))
            status['cold_tier'] = {
                'archive_files': len(cold_files)
            }

    return status


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    command = sys.argv[1]

    if command == 'check':
        status = check_system()
        print("\nMemory System Readiness Check")
        print("=" * 40)
        for msg in status.messages:
            print(msg)

        ready = status.ollama_available and status.chromadb_available
        print("\n" + ("✓ System ready for initialization" if ready else "✗ Address issues above before initializing"))

    elif command == 'init':
        print("Initializing memory system...")
        result = initialize_system()

        if result['success']:
            print("\n✓ Memory system initialized successfully")
            for action in result['actions']:
                print(f"  {action}")
        else:
            print("\n✗ Initialization failed")
            for error in result['errors']:
                print(f"  ERROR: {error}")

    elif command == 'ingest':
        if len(sys.argv) < 3:
            print("Usage: python initialize_memory_system.py ingest <log_directory>")
            sys.exit(1)

        log_dir = sys.argv[2]
        print(f"Ingesting logs from {log_dir}...")

        result = ingest_logs(Path(log_dir))

        print(f"\nIngestion Complete")
        print(f"=" * 40)
        print(f"Files processed: {result['files_processed']}")
        print(f"Entities extracted: {result['entities_extracted']}")
        print(f"Entities stored: {result['entities_stored']}")
        print(f"\nBy type:")
        for t, c in sorted(result.get('by_type', {}).items(), key=lambda x: -x[1]):
            print(f"  {t}: {c}")

        if result.get('errors'):
            print(f"\nErrors ({len(result['errors'])}):")
            for e in result['errors'][:5]:
                print(f"  {e}")

    elif command == 'status':
        status = show_status()
        print("\nMemory System Status")
        print("=" * 40)
        print(json.dumps(status, indent=2, default=str))

    else:
        print(f"Unknown command: {command}")
        print(__doc__)
        sys.exit(1)


if __name__ == '__main__':
    main()
