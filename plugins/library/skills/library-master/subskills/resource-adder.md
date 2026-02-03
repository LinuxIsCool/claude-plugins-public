# Resource Adder Sub-Skill

Manually add resources to the library with proper metadata extraction.

## Basic Addition

Add a URL to the library:

```python
from pathlib import Path
import sys
sys.path.insert(0, str(Path.cwd() / "plugins/library/src"))

from lib import Library, ResourceType

lib = Library()

# Simple add
resource, is_new = lib.add_resource(
    url="https://example.com/page",
    title="Page Title",
    description="Description of the resource",
)
print(f"{'New' if is_new else 'Updated'}: {resource.identifier[:8]}")
```

## Adding with Content

If you have fetched content, include it for caching:

```python
content = b"<html>...</html>"

resource, is_new = lib.add_resource(
    url="https://example.com/page",
    content=content,
    title="Page Title",
)

# Content is now stored in .cache/objects/{hash}/
print(f"Content hash: {resource.content_hash[:8]}")
```

## Adding Papers

For academic papers:

```python
resource, _ = lib.add_resource(
    url="https://arxiv.org/abs/2312.12345",
    title="Paper Title: A Novel Approach",
    resource_type=ResourceType.PAPER,
    creator=["Author One", "Author Two"],
    date="2023-12-15",
    arxiv_id="2312.12345",
    subject=["machine learning", "natural language processing"],
)
```

## Adding Repositories

For GitHub/GitLab repos:

```python
resource, _ = lib.add_resource(
    url="https://github.com/owner/repo",
    title="owner/repo",
    resource_type=ResourceType.REPO,
    repo_owner="owner",
    repo_name="repo",
    repo_topics=["python", "ai", "agents"],
    license="MIT",
    description="A great repository for doing things",
)
```

## Using Extractors

Let extractors auto-fill metadata:

```python
from extractors import get_default_registry

registry = get_default_registry()
result = registry.extract(
    url="https://arxiv.org/abs/2312.12345",
    content=html_content,  # From WebFetch
)

if result.success:
    resource, _ = lib.add_resource(
        url=result.url,
        **result.to_resource_kwargs(),
    )
```

## Bulk Addition

Add multiple resources:

```python
urls = [
    "https://example.com/page1",
    "https://example.com/page2",
    "https://example.com/page3",
]

for url in urls:
    resource, is_new = lib.add_resource(url=url)
    if is_new:
        print(f"Added: {url}")
    else:
        print(f"Already exists: {url}")
```

## Setting Discovery Context

Track who discovered the resource:

```python
import os

resource, _ = lib.add_resource(
    url="https://example.com",
    discovered_by=os.environ.get("CLAUDE_SESSION_ID", "manual"),
)
```
