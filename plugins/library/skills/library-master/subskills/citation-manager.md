# Citation Manager Sub-Skill

Track provenance and citations between resources and sessions.

## Recording Citations

When a session uses a resource:

```python
from lib import Library

lib = Library()

citation = lib.add_citation(
    source_id="session-2025-12-15-abc123",
    target_url="https://arxiv.org/abs/2312.12345",
    context="Referenced for knowledge graph discussion",
    citation_type="reference",
)
```

## Citation Types

- `reference` - General citation
- `extends` - Builds upon the cited work
- `implements` - Implements concepts from cited work
- `contradicts` - Disagrees with or refutes
- `supports` - Provides evidence for

## Querying Forward Citations

Who cited this resource:

```python
# Get resource first
resource = lib.get_by_url("https://example.com")

# Get citations
citations = lib.get_citations_for(resource.identifier)
for c in citations:
    print(f"Cited by: {c.source_id}")
    print(f"Type: {c.citation_type}")
    print(f"Context: {c.context}")
```

## Querying Backward Citations

What did a session cite:

```python
citations = lib.get_citations_by("session-123")
for c in citations:
    target = lib.get_by_id(c.target_id)
    print(f"Cited: {target.title} ({target.source})")
```

## Citation Graph Structure

The citation graph is stored in `.claude/library/citations.json`:

```json
{
  "version": "1.0",
  "updated_at": "2025-12-15T10:00:00Z",
  "citation_count": 42,
  "citations": [
    {
      "source_id": "session-abc",
      "target_id": "sha256...",
      "timestamp": "2025-12-15T10:00:00Z",
      "context": "Why it was cited",
      "citation_type": "reference"
    }
  ]
}
```

## Provenance Tracing

Find the origin of an idea:

```python
def trace_provenance(lib, resource_id, depth=3):
    """Trace backwards through citations."""
    resource = lib.get_by_id(resource_id)
    if not resource:
        return []

    chain = [resource]
    for cite_id in resource.cites[:depth]:
        cited = lib.get_by_id(cite_id)
        if cited:
            chain.append(cited)

    return chain
```

## Co-Citation Analysis

Find resources often cited together:

```python
# Using the built-in citation graph
graph = lib.get_citation_graph()
co_citations = graph.get_co_citations(resource_id, limit=10)

for pair in co_citations:
    print(f"{pair.resource_b_id}: strength={pair.strength}")
    print(f"  Contexts: {pair.contexts}")
```

## Bibliographic Coupling

Find resources that cite the same references (similar research direction):

```python
graph = lib.get_citation_graph()
coupling = graph.get_bibliographic_coupling(resource_id, limit=10)

for item in coupling:
    print(f"{item['coupled_id']}: {item['strength']} shared refs")
    print(f"  Shared references: {item['shared_refs']}")
```

## Citation Importance (PageRank)

Calculate importance based on citation network:

```python
graph = lib.get_citation_graph()
pagerank = graph.pagerank()

# Top cited resources
top = sorted(pagerank.items(), key=lambda x: x[1], reverse=True)[:10]
for rid, score in top:
    resource = lib.get_by_id(rid)
    print(f"{resource.title}: PageRank={score:.4f}")
```

## Hub/Authority Analysis (HITS)

Distinguish between well-curated bibliographies (hubs) and seminal works (authorities):

```python
hits = graph.hits()

# High authority = cited by many good hubs
# High hub = cites many good authorities
for rid, scores in hits.items():
    resource = lib.get_by_id(rid)
    if scores['authority'] > 0.5:
        print(f"Authority: {resource.title} ({scores['authority']:.3f})")
    if scores['hub'] > 0.5:
        print(f"Hub: {resource.title} ({scores['hub']:.3f})")
```

## Citation Velocity

Track how quickly a resource is being cited:

```python
velocity = graph.get_citation_velocity(resource_id, window_days=30)

print(f"Total citations: {velocity['total']}")
print(f"Recent (30d): {velocity['recent']}")
print(f"Velocity: {velocity['velocity']:.4f}/day")
print(f"Acceleration: {velocity['acceleration']:.4f}")  # Positive = gaining momentum
```

## Session Citation Report

Generate citation report for a session:

```python
def session_citation_report(lib, session_id):
    citations = lib.get_citations_by(session_id)

    report = [f"# Citations for {session_id}", ""]

    by_type = {}
    for c in citations:
        by_type.setdefault(c.citation_type, []).append(c)

    for ctype, cites in by_type.items():
        report.append(f"## {ctype.title()} ({len(cites)})")
        for c in cites:
            target = lib.get_by_id(c.target_id)
            title = target.title if target else c.target_id[:8]
            report.append(f"- {title}")
            if c.context:
                report.append(f"  - {c.context}")
        report.append("")

    return "\n".join(report)
```
