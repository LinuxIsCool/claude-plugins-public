# Resource Finder Sub-Skill

Find existing resources in the library by URL, topic, type, or other criteria.

## Finding by URL

Check the catalog for a specific URL:

```bash
# Quick check via URL index
cat .claude/library/.url_index.json | jq '.["https://example.com"]'

# Or search catalog
cat .claude/library/catalog.json | jq '.resources | to_entries[] | select(.value.source | contains("example.com"))'
```

## Finding by Type

Filter resources by type:

```bash
# All papers
cat .claude/library/catalog.json | jq '[.resources | to_entries[] | select(.value.type == "paper")]'

# All repos
cat .claude/library/catalog.json | jq '[.resources | to_entries[] | select(.value.type == "repo")]'
```

## Finding by Topic/Subject

Search in subjects:

```bash
cat .claude/library/catalog.json | jq '[.resources | to_entries[] | select(.value.subject[]? | contains("knowledge"))]'
```

## Finding by Domain

Resources from a specific domain:

```bash
cat .claude/library/catalog.json | jq '[.resources | to_entries[] | select(.value.source | contains("github.com"))]'
```

## Using Python Library

```python
from pathlib import Path
import sys
sys.path.insert(0, str(Path.cwd() / "plugins/library/src"))

from lib import Library, ResourceType

lib = Library()

# By URL
resource = lib.get_by_url("https://github.com/example/repo")

# By type
papers = list(lib.iter_resources(ResourceType.PAPER))

# Text search
results = lib.search(query="machine learning", limit=10)

# Combined filters
repos = lib.search(query="agent", resource_type=ResourceType.REPO)
```

## Finding Citations

Who cited a resource:

```python
citations = lib.get_citations_for(resource.identifier)
for c in citations:
    print(f"Cited by {c.source_id} at {c.timestamp}")
```

What a session cited:

```python
citations = lib.get_citations_by("session-123")
for c in citations:
    target = lib.get_by_id(c.target_id)
    print(f"Cited: {target.title}")
```

## Statistics

```python
stats = lib.get_stats()
print(f"Resources: {stats['resource_count']}")
print(f"By type: {stats['resources_by_type']}")
```
