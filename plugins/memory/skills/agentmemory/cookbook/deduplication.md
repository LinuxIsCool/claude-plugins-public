# Deduplication Cookbook

Preventing duplicate memories using create_unique_memory and similarity thresholds.

## Purpose

Provide comprehensive guidance on preventing duplicate content in agent memory. This cookbook covers the `create_unique_memory` function, similarity threshold tuning, novel memory tracking, duplicate detection, and memory consolidation strategies.

## Variables

```yaml
DEFAULT_SIMILARITY_THRESHOLD: 0.95
STRICT_THRESHOLD: 0.98
LOOSE_THRESHOLD: 0.85
NOVEL_MARKER: "True"
NON_NOVEL_MARKER: "False"
```

## Instructions

1. Understand similarity vs distance metrics
2. Choose appropriate thresholds for your use case
3. Implement deduplication at insertion time
4. Set up periodic duplicate detection for maintenance

---

## Understanding create_unique_memory

The `create_unique_memory` function checks for similar existing memories before insertion.

### How It Works

```python
from agentmemory import create_unique_memory

# Internally, create_unique_memory:
# 1. Searches for existing memories with similarity > threshold
# 2. If no similar memory found: creates with metadata {"novel": "True"}
# 3. If similar memory found: creates with {"novel": "False", "related_to": <id>}

# Example
create_unique_memory(
    category="facts",
    content="The capital of France is Paris",
    metadata={"topic": "geography"},
    similarity=0.95  # Only create if nothing is >95% similar
)
```

### Memory States After Insertion

```python
# Novel memory (no similar content found)
{
    "document": "The capital of France is Paris",
    "metadata": {
        "topic": "geography",
        "novel": "True",
        "created_at": 1705000000.0,
        "updated_at": 1705000000.0
    }
}

# Non-novel memory (similar content exists)
{
    "document": "Paris is the capital of France",
    "metadata": {
        "topic": "geography",
        "novel": "False",
        "related_to": "original_memory_id",
        "related_document": "The capital of France is Paris",
        "created_at": 1705000000.0,
        "updated_at": 1705000000.0
    }
}
```

---

## Similarity Threshold Selection

### Distance to Similarity Conversion

```python
# Agentmemory uses cosine distance
# similarity = 1.0 - distance
# max_distance = 1.0 - similarity_threshold

# Examples:
# similarity=0.95 → max_distance=0.05 (very strict)
# similarity=0.85 → max_distance=0.15 (moderate)
# similarity=0.70 → max_distance=0.30 (loose)
```

### Threshold Guidelines

| Use Case | Threshold | Description |
|----------|-----------|-------------|
| Exact match prevention | 0.98+ | Near-identical text only |
| Semantic duplicates | 0.90-0.95 | Same meaning, different words |
| Topic duplicates | 0.80-0.90 | Same topic area |
| Related content | 0.70-0.80 | Loosely related |

### Threshold Examples

```python
from agentmemory import create_unique_memory

# Strict: Only prevents near-identical content
# "The Eiffel Tower is in Paris" vs "The Eiffel Tower is in Paris, France"
create_unique_memory(
    category="facts",
    content="The Eiffel Tower is in Paris",
    similarity=0.98
)

# Moderate: Prevents semantic duplicates
# "Python was created by Guido van Rossum" vs
# "Guido van Rossum created the Python programming language"
create_unique_memory(
    category="facts",
    content="Python was created by Guido van Rossum",
    similarity=0.90
)

# Loose: Prevents topic duplicates
# "Machine learning is a subset of AI" vs
# "ML is a branch of artificial intelligence"
create_unique_memory(
    category="facts",
    content="Machine learning is a subset of AI",
    similarity=0.80
)
```

---

## Basic Deduplication Patterns

### Simple Deduplicated Insertion

```python
from agentmemory import create_unique_memory

def add_fact_if_new(
    fact: str,
    topic: str,
    similarity_threshold: float = 0.90
) -> dict:
    """Add fact only if sufficiently different from existing facts."""
    result = create_unique_memory(
        category="facts",
        content=fact,
        metadata={"topic": topic},
        similarity=similarity_threshold
    )

    # Check if it was marked as novel
    from agentmemory import get_memories

    # Get the most recently created memory
    memories = get_memories(
        category="facts",
        n_results=1,
        sort_order="desc"
    )

    if memories:
        is_novel = memories[0]["metadata"].get("novel") == "True"
        return {
            "created": True,
            "is_novel": is_novel,
            "related_to": memories[0]["metadata"].get("related_to")
        }

    return {"created": True, "is_novel": True}
```

### Batch Deduplicated Insertion

```python
from agentmemory import create_unique_memory, search_memory

def add_facts_deduplicated(
    facts: list,
    category: str = "facts",
    threshold: float = 0.90
) -> dict:
    """Add multiple facts with deduplication."""
    results = {
        "added": 0,
        "duplicates": 0,
        "details": []
    }

    for fact in facts:
        text = fact if isinstance(fact, str) else fact["text"]
        metadata = {} if isinstance(fact, str) else fact.get("metadata", {})

        # Check for existing similar memory
        existing = search_memory(
            category=category,
            search_text=text,
            n_results=1,
            max_distance=1.0 - threshold
        )

        if existing:
            results["duplicates"] += 1
            results["details"].append({
                "text": text[:50] + "...",
                "status": "duplicate",
                "similar_to": existing[0]["id"]
            })
        else:
            create_unique_memory(
                category=category,
                content=text,
                metadata=metadata,
                similarity=threshold
            )
            results["added"] += 1
            results["details"].append({
                "text": text[:50] + "...",
                "status": "added"
            })

    return results

# Usage
facts = [
    "Python is a programming language",
    "Python is a popular programming language",  # Likely duplicate
    "JavaScript runs in browsers",
    "JS executes in web browsers"  # Likely duplicate
]

result = add_facts_deduplicated(facts, threshold=0.85)
print(f"Added: {result['added']}, Duplicates: {result['duplicates']}")
```

---

## Advanced Deduplication

### Category-Aware Deduplication

```python
from agentmemory import create_unique_memory, search_memory

def add_with_category_dedup(
    content: str,
    category: str,
    metadata: dict = None,
    cross_category: list = None,
    threshold: float = 0.90
) -> dict:
    """
    Add memory with optional cross-category deduplication.

    Args:
        cross_category: List of additional categories to check for duplicates
    """
    metadata = metadata or {}
    categories_to_check = [category] + (cross_category or [])

    # Check all relevant categories
    for check_cat in categories_to_check:
        existing = search_memory(
            category=check_cat,
            search_text=content,
            n_results=1,
            max_distance=1.0 - threshold
        )

        if existing:
            return {
                "created": False,
                "duplicate_in": check_cat,
                "similar_to": existing[0]["id"],
                "similarity": 1.0 - existing[0]["distance"]
            }

    # No duplicates found, create the memory
    create_unique_memory(
        category=category,
        content=content,
        metadata=metadata,
        similarity=threshold
    )

    return {"created": True, "category": category}

# Usage: Check both "facts" and "learned_facts" for duplicates
result = add_with_category_dedup(
    content="Water boils at 100 degrees Celsius",
    category="facts",
    cross_category=["learned_facts", "user_facts"],
    threshold=0.90
)
```

### Time-Windowed Deduplication

```python
from agentmemory import create_memory, search_memory, get_memories
import time

def add_with_time_window(
    content: str,
    category: str,
    window_hours: int = 24,
    threshold: float = 0.90,
    metadata: dict = None
) -> dict:
    """
    Only deduplicate against memories created within time window.
    Useful for allowing periodic re-learning of facts.
    """
    metadata = metadata or {}
    window_start = time.time() - (window_hours * 3600)

    # Search for similar content
    similar = search_memory(
        category=category,
        search_text=content,
        n_results=10,
        max_distance=1.0 - threshold
    )

    # Filter by time window
    recent_similar = [
        m for m in similar
        if m["metadata"].get("created_at", 0) > window_start
    ]

    if recent_similar:
        return {
            "created": False,
            "reason": "recent_duplicate",
            "similar_to": recent_similar[0]["id"],
            "age_hours": (time.time() - recent_similar[0]["metadata"]["created_at"]) / 3600
        }

    # Create new memory
    create_memory(
        category=category,
        text=content,
        metadata=metadata
    )

    return {"created": True, "within_window": window_hours}
```

### Source-Aware Deduplication

```python
from agentmemory import create_unique_memory, search_memory

def add_from_source(
    content: str,
    category: str,
    source: str,
    allow_same_source: bool = False,
    threshold: float = 0.90
) -> dict:
    """
    Deduplicate based on source.
    Optionally allow duplicates from the same source (for updates).
    """
    # Search for similar content
    similar = search_memory(
        category=category,
        search_text=content,
        n_results=5,
        max_distance=1.0 - threshold
    )

    for match in similar:
        match_source = match["metadata"].get("source")

        if match_source == source and allow_same_source:
            # Same source - this is an update, allow it
            continue

        # Different source or same source not allowed
        return {
            "created": False,
            "reason": "duplicate",
            "similar_to": match["id"],
            "existing_source": match_source,
            "your_source": source
        }

    create_unique_memory(
        category=category,
        content=content,
        metadata={"source": source},
        similarity=threshold
    )

    return {"created": True, "source": source}
```

---

## Duplicate Detection

### Find All Duplicates

```python
from agentmemory import get_memories, search_memory

def find_duplicates(
    category: str,
    threshold: float = 0.90,
    max_check: int = 1000
) -> list:
    """Find all duplicate pairs in a category."""
    memories = get_memories(
        category=category,
        n_results=max_check,
        include_embeddings=False
    )

    duplicates = []
    checked_pairs = set()

    for memory in memories:
        # Search for similar memories
        similar = search_memory(
            category=category,
            search_text=memory["document"],
            n_results=10,
            max_distance=1.0 - threshold
        )

        for match in similar:
            if match["id"] == memory["id"]:
                continue

            # Create sorted pair to avoid duplicate pairs
            pair = tuple(sorted([memory["id"], match["id"]]))
            if pair in checked_pairs:
                continue

            checked_pairs.add(pair)
            duplicates.append({
                "id_1": memory["id"],
                "text_1": memory["document"],
                "id_2": match["id"],
                "text_2": match["document"],
                "similarity": 1.0 - match["distance"]
            })

    return duplicates

# Usage
duplicates = find_duplicates("facts", threshold=0.85)
for dup in duplicates[:5]:
    print(f"Similarity: {dup['similarity']:.2%}")
    print(f"  1: {dup['text_1'][:60]}...")
    print(f"  2: {dup['text_2'][:60]}...")
    print()
```

### Duplicate Report

```python
from agentmemory import get_memories, search_memory, count_memories

def generate_duplicate_report(
    category: str,
    thresholds: list = None
) -> dict:
    """Generate a comprehensive duplicate report."""
    thresholds = thresholds or [0.95, 0.90, 0.85, 0.80]

    total = count_memories(category)

    report = {
        "category": category,
        "total_memories": total,
        "threshold_analysis": {}
    }

    for threshold in thresholds:
        duplicates = find_duplicates(category, threshold)

        # Count unique memories involved in duplicates
        unique_ids = set()
        for d in duplicates:
            unique_ids.add(d["id_1"])
            unique_ids.add(d["id_2"])

        report["threshold_analysis"][threshold] = {
            "duplicate_pairs": len(duplicates),
            "memories_involved": len(unique_ids),
            "percentage": (len(unique_ids) / total * 100) if total > 0 else 0
        }

    return report

# Usage
report = generate_duplicate_report("facts")
print(f"Category: {report['category']}")
print(f"Total memories: {report['total_memories']}")
for threshold, data in report["threshold_analysis"].items():
    print(f"\nThreshold {threshold:.0%}:")
    print(f"  Duplicate pairs: {data['duplicate_pairs']}")
    print(f"  Memories involved: {data['memories_involved']}")
    print(f"  Percentage: {data['percentage']:.1f}%")
```

---

## Duplicate Resolution

### Merge Duplicates

```python
from agentmemory import get_memory, update_memory, delete_memory

def merge_duplicates(
    keep_id: str,
    remove_ids: list,
    category: str,
    merge_strategy: str = "keep_metadata"
) -> dict:
    """
    Merge duplicate memories into one.

    Args:
        merge_strategy:
            "keep_metadata": Preserve metadata from kept memory
            "merge_metadata": Combine metadata from all memories
            "newest_metadata": Use metadata from most recent memory
    """
    keep_memory = get_memory(category, keep_id)

    if not keep_memory:
        return {"error": f"Memory {keep_id} not found"}

    merged_metadata = keep_memory["metadata"].copy()
    removed = []

    for remove_id in remove_ids:
        remove_memory = get_memory(category, remove_id)

        if not remove_memory:
            continue

        if merge_strategy == "merge_metadata":
            # Combine metadata (existing values take precedence)
            for key, value in remove_memory["metadata"].items():
                if key not in merged_metadata:
                    merged_metadata[key] = value

        elif merge_strategy == "newest_metadata":
            # Use newer metadata
            if remove_memory["metadata"].get("created_at", 0) > \
               merged_metadata.get("created_at", 0):
                merged_metadata = remove_memory["metadata"].copy()

        # Delete the duplicate
        delete_memory(category, remove_id)
        removed.append(remove_id)

    # Update kept memory with merged metadata
    if merge_strategy in ["merge_metadata", "newest_metadata"]:
        update_memory(category, keep_id, metadata=merged_metadata)

    return {
        "kept": keep_id,
        "removed": removed,
        "merge_strategy": merge_strategy
    }
```

### Auto-Resolve Duplicates

```python
from agentmemory import get_memory, delete_memory

def auto_resolve_duplicates(
    duplicates: list,
    category: str,
    strategy: str = "keep_older"
) -> dict:
    """
    Automatically resolve duplicate pairs.

    Args:
        strategy:
            "keep_older": Keep the memory created first
            "keep_newer": Keep the memory created last
            "keep_longer": Keep the longer document
            "keep_shorter": Keep the shorter document
    """
    resolved = 0
    errors = []

    for dup in duplicates:
        mem1 = get_memory(category, dup["id_1"])
        mem2 = get_memory(category, dup["id_2"])

        if not mem1 or not mem2:
            errors.append(f"Memory not found: {dup['id_1']} or {dup['id_2']}")
            continue

        # Determine which to keep
        keep_id, delete_id = None, None

        if strategy == "keep_older":
            time1 = mem1["metadata"].get("created_at", 0)
            time2 = mem2["metadata"].get("created_at", 0)
            if time1 <= time2:
                keep_id, delete_id = dup["id_1"], dup["id_2"]
            else:
                keep_id, delete_id = dup["id_2"], dup["id_1"]

        elif strategy == "keep_newer":
            time1 = mem1["metadata"].get("created_at", 0)
            time2 = mem2["metadata"].get("created_at", 0)
            if time1 >= time2:
                keep_id, delete_id = dup["id_1"], dup["id_2"]
            else:
                keep_id, delete_id = dup["id_2"], dup["id_1"]

        elif strategy == "keep_longer":
            if len(mem1["document"]) >= len(mem2["document"]):
                keep_id, delete_id = dup["id_1"], dup["id_2"]
            else:
                keep_id, delete_id = dup["id_2"], dup["id_1"]

        elif strategy == "keep_shorter":
            if len(mem1["document"]) <= len(mem2["document"]):
                keep_id, delete_id = dup["id_1"], dup["id_2"]
            else:
                keep_id, delete_id = dup["id_2"], dup["id_1"]

        delete_memory(category, delete_id)
        resolved += 1

    return {
        "resolved": resolved,
        "errors": errors,
        "strategy": strategy
    }
```

---

## Novel Memory Management

### Query Only Novel Memories

```python
from agentmemory import search_memory, get_memories

def search_novel_only(
    category: str,
    query: str,
    n_results: int = 5
) -> list:
    """Search only through novel (unique) memories."""
    return search_memory(
        category=category,
        search_text=query,
        n_results=n_results,
        novel=True
    )

def get_novel_memories(
    category: str,
    n_results: int = 100
) -> list:
    """Get all novel memories in a category."""
    return get_memories(
        category=category,
        filter_metadata={"novel": "True"},
        n_results=n_results
    )

def get_duplicate_memories(
    category: str,
    n_results: int = 100
) -> list:
    """Get all non-novel (duplicate) memories."""
    return get_memories(
        category=category,
        filter_metadata={"novel": "False"},
        n_results=n_results
    )
```

### Novel Ratio Analysis

```python
from agentmemory import count_memories, get_memories

def analyze_novelty(category: str) -> dict:
    """Analyze the novelty ratio of a category."""
    total = count_memories(category)

    if total == 0:
        return {"total": 0, "novel": 0, "duplicates": 0, "ratio": 0}

    # Count novel memories
    novel_memories = get_memories(
        category=category,
        filter_metadata={"novel": "True"},
        n_results=10000
    )

    novel_count = len(novel_memories)
    duplicate_count = total - novel_count

    return {
        "total": total,
        "novel": novel_count,
        "duplicates": duplicate_count,
        "novelty_ratio": novel_count / total if total > 0 else 0,
        "duplication_ratio": duplicate_count / total if total > 0 else 0
    }
```

---

## Clustering for Deduplication

```python
from agentmemory import cluster, get_memories, delete_memory

def cluster_and_dedupe(
    category: str,
    epsilon: float = 0.1,  # Distance threshold for clustering
    min_samples: int = 2,  # Minimum cluster size
    keep_strategy: str = "first"
) -> dict:
    """Use clustering to identify and remove duplicates."""
    # Run clustering
    cluster(
        epsilon=epsilon,
        min_samples=min_samples,
        category=category
    )

    # Get clustered memories
    memories = get_memories(
        category=category,
        n_results=10000,
        include_embeddings=False
    )

    # Group by cluster
    clusters = {}
    for mem in memories:
        cluster_id = mem["metadata"].get("cluster", "none")
        if cluster_id not in clusters:
            clusters[cluster_id] = []
        clusters[cluster_id].append(mem)

    # Process clusters (skip noise and singletons)
    removed = 0

    for cluster_id, cluster_members in clusters.items():
        if cluster_id == "noise" or len(cluster_members) <= 1:
            continue

        # Sort by strategy
        if keep_strategy == "first":
            cluster_members.sort(key=lambda x: x["metadata"].get("created_at", 0))
        elif keep_strategy == "last":
            cluster_members.sort(key=lambda x: x["metadata"].get("created_at", 0), reverse=True)
        elif keep_strategy == "longest":
            cluster_members.sort(key=lambda x: len(x["document"]), reverse=True)

        # Keep first, remove rest
        for mem in cluster_members[1:]:
            delete_memory(category, mem["id"])
            removed += 1

    return {
        "clusters_found": len([c for c in clusters if c != "noise" and len(clusters[c]) > 1]),
        "memories_removed": removed,
        "keep_strategy": keep_strategy
    }
```

---

## Complete Deduplication Manager

```python
from agentmemory import (
    create_memory, create_unique_memory, get_memories, get_memory,
    search_memory, update_memory, delete_memory, count_memories
)
import time

class DeduplicationManager:
    """Complete deduplication management for agentmemory."""

    def __init__(self, category: str, default_threshold: float = 0.90):
        self.category = category
        self.default_threshold = default_threshold

    def add(
        self,
        content: str,
        metadata: dict = None,
        threshold: float = None,
        allow_duplicates: bool = False
    ) -> dict:
        """Add content with configurable deduplication."""
        threshold = threshold or self.default_threshold
        metadata = metadata or {}

        if allow_duplicates:
            mem_id = create_memory(
                category=self.category,
                text=content,
                metadata=metadata
            )
            return {"created": True, "id": mem_id, "deduplicated": False}

        # Check for duplicates
        existing = search_memory(
            category=self.category,
            search_text=content,
            n_results=1,
            max_distance=1.0 - threshold
        )

        if existing:
            return {
                "created": False,
                "reason": "duplicate",
                "similar_to": existing[0]["id"],
                "similarity": 1.0 - existing[0]["distance"]
            }

        mem_id = create_unique_memory(
            category=self.category,
            content=content,
            metadata=metadata,
            similarity=threshold
        )

        return {"created": True, "id": mem_id, "deduplicated": True}

    def find_duplicates(self, threshold: float = None) -> list:
        """Find all duplicate pairs."""
        threshold = threshold or self.default_threshold
        memories = get_memories(
            category=self.category,
            n_results=10000,
            include_embeddings=False
        )

        duplicates = []
        checked = set()

        for mem in memories:
            similar = search_memory(
                category=self.category,
                search_text=mem["document"],
                n_results=5,
                max_distance=1.0 - threshold
            )

            for match in similar:
                if match["id"] == mem["id"]:
                    continue

                pair = tuple(sorted([mem["id"], match["id"]]))
                if pair in checked:
                    continue

                checked.add(pair)
                duplicates.append({
                    "id_1": mem["id"],
                    "text_1": mem["document"],
                    "id_2": match["id"],
                    "text_2": match["document"],
                    "similarity": 1.0 - match["distance"]
                })

        return duplicates

    def resolve_duplicates(
        self,
        duplicates: list = None,
        strategy: str = "keep_older"
    ) -> dict:
        """Resolve duplicates using specified strategy."""
        if duplicates is None:
            duplicates = self.find_duplicates()

        resolved = 0
        for dup in duplicates:
            mem1 = get_memory(self.category, dup["id_1"])
            mem2 = get_memory(self.category, dup["id_2"])

            if not mem1 or not mem2:
                continue

            time1 = mem1["metadata"].get("created_at", 0)
            time2 = mem2["metadata"].get("created_at", 0)

            if strategy == "keep_older":
                delete_id = dup["id_2"] if time1 <= time2 else dup["id_1"]
            else:  # keep_newer
                delete_id = dup["id_1"] if time1 <= time2 else dup["id_2"]

            delete_memory(self.category, delete_id)
            resolved += 1

        return {"resolved": resolved, "strategy": strategy}

    def stats(self) -> dict:
        """Get deduplication statistics."""
        total = count_memories(self.category)

        novel = get_memories(
            category=self.category,
            filter_metadata={"novel": "True"},
            n_results=10000
        )

        duplicates = self.find_duplicates()

        return {
            "total_memories": total,
            "novel_count": len(novel),
            "duplicate_pairs": len(duplicates),
            "novelty_ratio": len(novel) / total if total > 0 else 0
        }


# Usage
dedup = DeduplicationManager("facts", default_threshold=0.90)

# Add with deduplication
result = dedup.add("Python is a programming language")
print(result)

# Find duplicates
duplicates = dedup.find_duplicates()
print(f"Found {len(duplicates)} duplicate pairs")

# Resolve duplicates
resolved = dedup.resolve_duplicates(strategy="keep_older")
print(f"Resolved {resolved['resolved']} duplicates")

# Check stats
stats = dedup.stats()
print(f"Novelty ratio: {stats['novelty_ratio']:.2%}")
```
