# Knowledge Base Cookbook

Building and managing a knowledge base with agentmemory.

## Purpose

Provide comprehensive guidance on implementing a knowledge base for storing facts, documentation, and structured information. This cookbook covers document ingestion, hierarchical organization, fact management, and retrieval-augmented generation (RAG) patterns.

## Variables

```yaml
CATEGORY_FACTS: facts
CATEGORY_DOCUMENTS: documents
CATEGORY_CHUNKS: document_chunks
CATEGORY_ENTITIES: entities
CHUNK_SIZE: 500
CHUNK_OVERLAP: 50
SIMILARITY_THRESHOLD: 0.75
```

## Instructions

1. Design your knowledge base schema
2. Implement document ingestion pipeline
3. Set up retrieval patterns for queries
4. Configure maintenance routines

---

## Basic Fact Storage

### Store Simple Facts

```python
from agentmemory import create_memory, create_unique_memory
import time

def store_fact(
    fact: str,
    topic: str,
    source: str = None,
    confidence: float = 1.0,
    metadata: dict = None
):
    """Store a fact in the knowledge base."""
    fact_metadata = {
        "topic": topic,
        "confidence": confidence,
        "created_at": time.time(),
        "fact_type": "atomic"
    }

    if source:
        fact_metadata["source"] = source

    if metadata:
        fact_metadata.update(metadata)

    return create_memory(
        category="facts",
        text=fact,
        metadata=fact_metadata
    )

def store_unique_fact(
    fact: str,
    topic: str,
    similarity_threshold: float = 0.90,
    **kwargs
):
    """Store fact only if not already known (or similar)."""
    return create_unique_memory(
        category="facts",
        content=fact,
        metadata={
            "topic": topic,
            **kwargs
        },
        similarity=similarity_threshold
    )

# Usage
store_fact(
    "Python was created by Guido van Rossum in 1991",
    topic="programming",
    source="wikipedia",
    confidence=0.99
)

store_unique_fact(
    "The Eiffel Tower is located in Paris, France",
    topic="landmarks",
    similarity_threshold=0.85
)
```

### Store Structured Facts

```python
from agentmemory import create_memory
import json

def store_entity_fact(
    entity: str,
    attribute: str,
    value: str,
    source: str = None,
    valid_from: str = None,
    valid_to: str = None
):
    """Store a fact about an entity with temporal validity."""
    # Natural language representation for semantic search
    fact_text = f"{entity}: {attribute} is {value}"

    metadata = {
        "entity": entity,
        "attribute": attribute,
        "value": value,
        "fact_type": "entity_attribute"
    }

    if source:
        metadata["source"] = source

    if valid_from:
        metadata["valid_from"] = valid_from

    if valid_to:
        metadata["valid_to"] = valid_to

    return create_memory(
        category="entity_facts",
        text=fact_text,
        metadata=metadata
    )

# Usage
store_entity_fact(
    entity="Apple Inc",
    attribute="CEO",
    value="Tim Cook",
    valid_from="2011-08-24"
)

store_entity_fact(
    entity="Mount Everest",
    attribute="height",
    value="8,849 meters",
    source="Nepal Survey Department 2020"
)
```

### Store Relationships

```python
from agentmemory import create_memory

def store_relationship(
    subject: str,
    predicate: str,
    obj: str,
    bidirectional: bool = False,
    metadata: dict = None
):
    """Store a relationship between entities."""
    # Natural language for semantic search
    relation_text = f"{subject} {predicate} {obj}"

    rel_metadata = {
        "subject": subject,
        "predicate": predicate,
        "object": obj,
        "fact_type": "relationship"
    }

    if metadata:
        rel_metadata.update(metadata)

    # Store forward relationship
    create_memory(
        category="relationships",
        text=relation_text,
        metadata=rel_metadata
    )

    # Optionally store reverse relationship
    if bidirectional:
        reverse_predicates = {
            "is parent of": "is child of",
            "created": "was created by",
            "owns": "is owned by",
            "contains": "is contained in"
        }

        reverse_pred = reverse_predicates.get(predicate, f"has {predicate} relation with")
        reverse_text = f"{obj} {reverse_pred} {subject}"

        create_memory(
            category="relationships",
            text=reverse_text,
            metadata={
                "subject": obj,
                "predicate": reverse_pred,
                "object": subject,
                "fact_type": "relationship",
                "is_reverse": "True"
            }
        )

# Usage
store_relationship(
    "Python",
    "was created by",
    "Guido van Rossum",
    bidirectional=True
)
```

---

## Document Ingestion

### Chunk Documents

```python
from agentmemory import create_memory
import hashlib
import re

def chunk_text(
    text: str,
    chunk_size: int = 500,
    overlap: int = 50,
    separator: str = "\n\n"
) -> list:
    """Split text into overlapping chunks."""
    # First split by separator (paragraphs)
    paragraphs = text.split(separator)

    chunks = []
    current_chunk = []
    current_size = 0

    for para in paragraphs:
        para_size = len(para.split())

        if current_size + para_size > chunk_size and current_chunk:
            # Save current chunk
            chunk_text = separator.join(current_chunk)
            chunks.append(chunk_text)

            # Keep overlap
            overlap_text = []
            overlap_size = 0
            for p in reversed(current_chunk):
                p_size = len(p.split())
                if overlap_size + p_size <= overlap:
                    overlap_text.insert(0, p)
                    overlap_size += p_size
                else:
                    break

            current_chunk = overlap_text
            current_size = overlap_size

        current_chunk.append(para)
        current_size += para_size

    # Don't forget last chunk
    if current_chunk:
        chunks.append(separator.join(current_chunk))

    return chunks

def ingest_document(
    title: str,
    content: str,
    source: str = None,
    doc_type: str = "text",
    chunk_size: int = 500,
    chunk_overlap: int = 50,
    additional_metadata: dict = None
) -> dict:
    """Ingest a document into the knowledge base."""
    import time

    # Generate document ID
    doc_id = hashlib.md5(f"{title}_{content[:100]}".encode()).hexdigest()[:12]

    # Store document metadata
    doc_metadata = {
        "doc_id": doc_id,
        "title": title,
        "doc_type": doc_type,
        "ingested_at": time.time(),
        "chunk_count": 0
    }

    if source:
        doc_metadata["source"] = source

    if additional_metadata:
        doc_metadata.update(additional_metadata)

    # Chunk the document
    chunks = chunk_text(content, chunk_size, chunk_overlap)
    doc_metadata["chunk_count"] = len(chunks)

    # Store document record
    create_memory(
        category="documents",
        text=f"{title}\n\n{content[:500]}...",  # Store preview
        metadata=doc_metadata,
        id=doc_id
    )

    # Store chunks
    for i, chunk in enumerate(chunks):
        chunk_metadata = {
            "doc_id": doc_id,
            "doc_title": title,
            "chunk_index": i,
            "total_chunks": len(chunks),
            "chunk_type": "content"
        }

        if source:
            chunk_metadata["source"] = source

        chunk_id = f"{doc_id}_chunk_{i:04d}"

        create_memory(
            category="document_chunks",
            text=chunk,
            metadata=chunk_metadata,
            id=chunk_id
        )

    return {
        "doc_id": doc_id,
        "chunk_count": len(chunks),
        "title": title
    }
```

### Ingest with Sections

```python
from agentmemory import create_memory
import re

def parse_sections(content: str) -> list:
    """Parse document into sections based on headers."""
    # Match markdown-style headers
    header_pattern = r'^(#{1,6})\s+(.+)$'
    lines = content.split('\n')

    sections = []
    current_section = {
        "level": 0,
        "title": "Introduction",
        "content": []
    }

    for line in lines:
        match = re.match(header_pattern, line)
        if match:
            # Save previous section
            if current_section["content"]:
                current_section["content"] = '\n'.join(current_section["content"])
                sections.append(current_section)

            # Start new section
            level = len(match.group(1))
            title = match.group(2)
            current_section = {
                "level": level,
                "title": title,
                "content": []
            }
        else:
            current_section["content"].append(line)

    # Save last section
    if current_section["content"]:
        current_section["content"] = '\n'.join(current_section["content"])
        sections.append(current_section)

    return sections

def ingest_structured_document(
    title: str,
    content: str,
    source: str = None,
    chunk_size: int = 500
) -> dict:
    """Ingest document preserving section structure."""
    import time

    doc_id = hashlib.md5(f"{title}_{content[:100]}".encode()).hexdigest()[:12]

    sections = parse_sections(content)

    # Store document metadata
    doc_metadata = {
        "doc_id": doc_id,
        "title": title,
        "section_count": len(sections),
        "ingested_at": time.time()
    }

    if source:
        doc_metadata["source"] = source

    create_memory(
        category="documents",
        text=f"{title}\n\nSections: {', '.join(s['title'] for s in sections)}",
        metadata=doc_metadata,
        id=doc_id
    )

    # Store sections and their chunks
    chunk_count = 0
    for section_idx, section in enumerate(sections):
        section_content = section["content"]

        # Chunk section if too large
        if len(section_content.split()) > chunk_size:
            chunks = chunk_text(section_content, chunk_size)
        else:
            chunks = [section_content]

        for chunk_idx, chunk in enumerate(chunks):
            chunk_metadata = {
                "doc_id": doc_id,
                "doc_title": title,
                "section_title": section["title"],
                "section_level": section["level"],
                "section_index": section_idx,
                "chunk_index": chunk_idx,
                "total_section_chunks": len(chunks)
            }

            if source:
                chunk_metadata["source"] = source

            chunk_id = f"{doc_id}_s{section_idx:03d}_c{chunk_idx:03d}"

            create_memory(
                category="document_chunks",
                text=chunk,
                metadata=chunk_metadata,
                id=chunk_id
            )

            chunk_count += 1

    return {
        "doc_id": doc_id,
        "section_count": len(sections),
        "chunk_count": chunk_count
    }
```

---

## Knowledge Retrieval

### Query Knowledge Base

```python
from agentmemory import search_memory, get_memories

def query_knowledge(
    query: str,
    categories: list = None,
    n_results: int = 5,
    min_similarity: float = 0.6
) -> list:
    """Query the knowledge base across multiple categories."""
    categories = categories or ["facts", "document_chunks", "relationships"]

    all_results = []

    for category in categories:
        results = search_memory(
            category=category,
            search_text=query,
            n_results=n_results,
            max_distance=1.0 - min_similarity,
            include_embeddings=False
        )

        for result in results:
            result["source_category"] = category

        all_results.extend(results)

    # Sort by distance
    all_results.sort(key=lambda x: x["distance"])

    return all_results[:n_results]

def query_by_topic(
    query: str,
    topic: str,
    n_results: int = 5
) -> list:
    """Query knowledge filtered by topic."""
    return search_memory(
        category="facts",
        search_text=query,
        n_results=n_results,
        filter_metadata={"topic": topic},
        include_embeddings=False
    )
```

### RAG Context Builder

```python
from agentmemory import search_memory

def build_rag_context(
    query: str,
    n_chunks: int = 5,
    min_similarity: float = 0.65,
    include_sources: bool = True
) -> dict:
    """Build context for RAG from knowledge base."""
    # Search document chunks
    chunks = search_memory(
        category="document_chunks",
        search_text=query,
        n_results=n_chunks,
        max_distance=1.0 - min_similarity,
        include_embeddings=False
    )

    if not chunks:
        return {
            "context": "",
            "sources": [],
            "chunk_count": 0
        }

    # Build context string
    context_parts = []
    sources = set()

    for i, chunk in enumerate(chunks):
        doc_title = chunk["metadata"].get("doc_title", "Unknown")
        section = chunk["metadata"].get("section_title", "")

        header = f"[Source: {doc_title}"
        if section:
            header += f" - {section}"
        header += "]"

        context_parts.append(f"{header}\n{chunk['document']}")

        source = chunk["metadata"].get("source", doc_title)
        sources.add(source)

    context = "\n\n---\n\n".join(context_parts)

    return {
        "context": context,
        "sources": list(sources) if include_sources else [],
        "chunk_count": len(chunks),
        "avg_similarity": sum(1 - c["distance"] for c in chunks) / len(chunks)
    }

def answer_with_context(
    query: str,
    answer_fn,  # Function that takes (query, context) -> answer
    n_chunks: int = 5
) -> dict:
    """Answer a query using RAG pattern."""
    # Build context
    rag = build_rag_context(query, n_chunks=n_chunks)

    if not rag["context"]:
        return {
            "answer": "I don't have enough information to answer this question.",
            "sources": [],
            "confidence": 0.0
        }

    # Generate answer
    answer = answer_fn(query, rag["context"])

    return {
        "answer": answer,
        "sources": rag["sources"],
        "confidence": rag["avg_similarity"]
    }
```

### Multi-Hop Retrieval

```python
from agentmemory import search_memory

def multi_hop_query(
    query: str,
    max_hops: int = 2,
    results_per_hop: int = 3
) -> list:
    """
    Perform multi-hop retrieval for complex queries.
    Each hop uses entities from previous results.
    """
    all_results = []
    seen_ids = set()
    current_queries = [query]

    for hop in range(max_hops):
        hop_results = []

        for q in current_queries:
            results = search_memory(
                category="document_chunks",
                search_text=q,
                n_results=results_per_hop,
                include_embeddings=False
            )

            for r in results:
                if r["id"] not in seen_ids:
                    r["hop"] = hop
                    hop_results.append(r)
                    seen_ids.add(r["id"])

        all_results.extend(hop_results)

        if hop < max_hops - 1:
            # Extract entities for next hop
            current_queries = extract_entities_from_results(hop_results)

            if not current_queries:
                break

    return all_results

def extract_entities_from_results(results: list) -> list:
    """Extract key entities from results for next hop."""
    # Simple extraction - in production, use NER
    entities = []

    for r in results:
        # Look for entity metadata
        entity = r["metadata"].get("entity")
        if entity:
            entities.append(entity)

        # Extract from relationships
        subject = r["metadata"].get("subject")
        obj = r["metadata"].get("object")
        if subject:
            entities.append(subject)
        if obj:
            entities.append(obj)

    return list(set(entities))[:5]  # Limit to avoid explosion
```

---

## Entity Management

### Entity Registry

```python
from agentmemory import create_memory, get_memories, search_memory, update_memory
import time

def register_entity(
    name: str,
    entity_type: str,
    description: str = None,
    aliases: list = None,
    metadata: dict = None
) -> str:
    """Register an entity in the knowledge base."""
    import hashlib

    entity_id = hashlib.md5(f"{entity_type}_{name}".encode()).hexdigest()[:10]

    entity_text = name
    if description:
        entity_text += f"\n\n{description}"

    entity_metadata = {
        "entity_id": entity_id,
        "entity_type": entity_type,
        "name": name,
        "created_at": time.time()
    }

    if aliases:
        entity_metadata["aliases"] = ",".join(aliases)

    if metadata:
        entity_metadata.update(metadata)

    create_memory(
        category="entities",
        text=entity_text,
        metadata=entity_metadata,
        id=entity_id
    )

    return entity_id

def find_entity(
    query: str,
    entity_type: str = None,
    n_results: int = 5
) -> list:
    """Find entities matching a query."""
    filter_meta = {}
    if entity_type:
        filter_meta["entity_type"] = entity_type

    return search_memory(
        category="entities",
        search_text=query,
        n_results=n_results,
        filter_metadata=filter_meta if filter_meta else None,
        include_embeddings=False
    )

def get_entity_facts(
    entity_name: str,
    n_results: int = 20
) -> list:
    """Get all facts about an entity."""
    return search_memory(
        category="entity_facts",
        search_text=entity_name,
        n_results=n_results,
        filter_metadata={"entity": entity_name},
        include_embeddings=False
    )

def get_entity_relationships(
    entity_name: str,
    as_subject: bool = True,
    as_object: bool = True
) -> list:
    """Get relationships involving an entity."""
    results = []

    if as_subject:
        subject_rels = get_memories(
            category="relationships",
            filter_metadata={"subject": entity_name},
            n_results=50,
            include_embeddings=False
        )
        results.extend(subject_rels)

    if as_object:
        object_rels = get_memories(
            category="relationships",
            filter_metadata={"object": entity_name},
            n_results=50,
            include_embeddings=False
        )
        results.extend(object_rels)

    return results
```

---

## Knowledge Maintenance

### Update Knowledge

```python
from agentmemory import search_memory, update_memory, delete_memory

def update_fact(
    fact_id: str,
    new_text: str = None,
    new_metadata: dict = None
):
    """Update an existing fact."""
    update_memory(
        category="facts",
        id=fact_id,
        text=new_text,
        metadata=new_metadata
    )

def deprecate_fact(
    fact_id: str,
    reason: str = None,
    replacement_id: str = None
):
    """Mark a fact as deprecated."""
    import time

    metadata = {
        "status": "deprecated",
        "deprecated_at": time.time()
    }

    if reason:
        metadata["deprecation_reason"] = reason

    if replacement_id:
        metadata["replaced_by"] = replacement_id

    update_memory(
        category="facts",
        id=fact_id,
        metadata=metadata
    )

def find_and_update_fact(
    search_query: str,
    new_value: str,
    confirm: bool = True
) -> dict:
    """Find a fact by search and update it."""
    results = search_memory(
        category="facts",
        search_text=search_query,
        n_results=1
    )

    if not results:
        return {"status": "not_found"}

    fact = results[0]

    if confirm:
        return {
            "status": "found",
            "fact": fact,
            "action": "confirm_update"
        }

    update_memory(
        category="facts",
        id=fact["id"],
        text=new_value
    )

    return {
        "status": "updated",
        "old_value": fact["document"],
        "new_value": new_value
    }
```

### Quality Assurance

```python
from agentmemory import get_memories, search_memory, delete_similar_memories

def find_duplicate_facts(
    category: str = "facts",
    threshold: float = 0.92
) -> list:
    """Find potentially duplicate facts."""
    all_facts = get_memories(
        category=category,
        n_results=1000,
        include_embeddings=False
    )

    duplicates = []

    for i, fact in enumerate(all_facts):
        similar = search_memory(
            category=category,
            search_text=fact["document"],
            n_results=5,
            max_distance=1.0 - threshold
        )

        # Filter out self and already found duplicates
        dupes = [
            s for s in similar
            if s["id"] != fact["id"]
            and s["id"] not in [d["duplicate_id"] for d in duplicates]
        ]

        for dupe in dupes:
            duplicates.append({
                "original_id": fact["id"],
                "original_text": fact["document"],
                "duplicate_id": dupe["id"],
                "duplicate_text": dupe["document"],
                "similarity": 1 - dupe["distance"]
            })

    return duplicates

def consolidate_duplicates(
    duplicates: list,
    strategy: str = "keep_first"  # "keep_first" | "keep_newest" | "merge"
):
    """Remove duplicate facts based on strategy."""
    from agentmemory import delete_memory, get_memory

    for dup in duplicates:
        if strategy == "keep_first":
            delete_memory("facts", dup["duplicate_id"])
        elif strategy == "keep_newest":
            orig = get_memory("facts", dup["original_id"])
            dupe = get_memory("facts", dup["duplicate_id"])

            orig_time = orig["metadata"].get("created_at", 0)
            dupe_time = dupe["metadata"].get("created_at", 0)

            if dupe_time > orig_time:
                delete_memory("facts", dup["original_id"])
            else:
                delete_memory("facts", dup["duplicate_id"])
```

### Export/Import Knowledge

```python
from agentmemory import (
    export_memory_to_json,
    export_memory_to_file,
    import_json_to_memory,
    import_file_to_memory
)

def export_knowledge_base(
    output_path: str,
    categories: list = None,
    include_embeddings: bool = False
):
    """Export knowledge base to file."""
    if categories:
        # Export specific categories
        from agentmemory import get_memories

        data = {}
        for category in categories:
            memories = get_memories(
                category=category,
                n_results=10000,
                include_embeddings=include_embeddings
            )
            data[category] = memories

        import json
        with open(output_path, 'w') as f:
            json.dump(data, f, indent=2)
    else:
        # Export all
        export_memory_to_file(output_path, include_embeddings)

def import_knowledge_base(
    input_path: str,
    replace: bool = False
):
    """Import knowledge base from file."""
    import_file_to_memory(input_path, replace=replace)
```

---

## Complete Knowledge Base Manager

```python
from agentmemory import (
    create_memory, create_unique_memory, get_memories, get_memory,
    search_memory, update_memory, delete_memory, count_memories
)
import time
import hashlib

class KnowledgeBase:
    """Complete knowledge base management."""

    def __init__(self, namespace: str = "default"):
        self.namespace = namespace
        self.categories = {
            "facts": f"{namespace}_facts",
            "documents": f"{namespace}_documents",
            "chunks": f"{namespace}_chunks",
            "entities": f"{namespace}_entities",
            "relationships": f"{namespace}_relationships"
        }

    def add_fact(
        self,
        fact: str,
        topic: str,
        source: str = None,
        deduplicate: bool = True,
        **metadata
    ) -> str:
        """Add a fact to the knowledge base."""
        fact_metadata = {
            "topic": topic,
            "created_at": time.time(),
            **metadata
        }

        if source:
            fact_metadata["source"] = source

        if deduplicate:
            return create_unique_memory(
                category=self.categories["facts"],
                content=fact,
                metadata=fact_metadata,
                similarity=0.90
            )
        else:
            return create_memory(
                category=self.categories["facts"],
                text=fact,
                metadata=fact_metadata
            )

    def add_document(
        self,
        title: str,
        content: str,
        source: str = None,
        chunk_size: int = 500,
        **metadata
    ) -> dict:
        """Add and chunk a document."""
        doc_id = hashlib.md5(f"{title}_{time.time()}".encode()).hexdigest()[:12]

        # Store document record
        doc_metadata = {
            "doc_id": doc_id,
            "title": title,
            "created_at": time.time(),
            **metadata
        }

        if source:
            doc_metadata["source"] = source

        create_memory(
            category=self.categories["documents"],
            text=f"{title}\n\n{content[:500]}...",
            metadata=doc_metadata,
            id=doc_id
        )

        # Chunk and store
        chunks = self._chunk_text(content, chunk_size)

        for i, chunk in enumerate(chunks):
            chunk_id = f"{doc_id}_c{i:04d}"
            create_memory(
                category=self.categories["chunks"],
                text=chunk,
                metadata={
                    "doc_id": doc_id,
                    "doc_title": title,
                    "chunk_index": i,
                    "source": source
                },
                id=chunk_id
            )

        return {
            "doc_id": doc_id,
            "chunk_count": len(chunks)
        }

    def query(
        self,
        query: str,
        categories: list = None,
        n_results: int = 5,
        min_similarity: float = 0.6
    ) -> list:
        """Query the knowledge base."""
        categories = categories or ["facts", "chunks"]
        all_results = []

        for cat in categories:
            category_name = self.categories.get(cat, cat)

            results = search_memory(
                category=category_name,
                search_text=query,
                n_results=n_results,
                max_distance=1.0 - min_similarity,
                include_embeddings=False
            )

            for r in results:
                r["category"] = cat

            all_results.extend(results)

        all_results.sort(key=lambda x: x["distance"])
        return all_results[:n_results]

    def get_context(
        self,
        query: str,
        n_results: int = 5,
        include_facts: bool = True,
        include_docs: bool = True
    ) -> str:
        """Get formatted context for a query."""
        categories = []
        if include_facts:
            categories.append("facts")
        if include_docs:
            categories.append("chunks")

        results = self.query(query, categories=categories, n_results=n_results)

        if not results:
            return ""

        parts = []
        for r in results:
            source = r["metadata"].get("source", r["metadata"].get("doc_title", "Unknown"))
            parts.append(f"[{source}] {r['document']}")

        return "\n\n---\n\n".join(parts)

    def stats(self) -> dict:
        """Get knowledge base statistics."""
        stats = {}

        for name, category in self.categories.items():
            try:
                count = count_memories(category)
                stats[name] = count
            except:
                stats[name] = 0

        return stats

    def _chunk_text(self, text: str, chunk_size: int) -> list:
        """Split text into chunks."""
        words = text.split()
        chunks = []

        for i in range(0, len(words), chunk_size):
            chunk = " ".join(words[i:i + chunk_size])
            chunks.append(chunk)

        return chunks


# Usage
kb = KnowledgeBase(namespace="myproject")

# Add facts
kb.add_fact(
    "Python uses indentation for code blocks",
    topic="programming",
    source="Python Documentation"
)

# Add documents
kb.add_document(
    title="Python Tutorial",
    content="Python is a versatile programming language...",
    source="docs.python.org"
)

# Query
results = kb.query("How does Python handle code structure?")

# Get context for RAG
context = kb.get_context("Python syntax")

# Check stats
print(kb.stats())
```
