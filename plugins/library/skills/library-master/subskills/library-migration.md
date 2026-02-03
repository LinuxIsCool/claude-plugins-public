# Library Migration Sub-Skill

Import resources from various sources and initialize library storage.

## Storage Initialization

Initialize the library storage structure:

```python
from lib import initialize_storage
from pathlib import Path

# Default location (.claude/library)
base = initialize_storage()

# Custom location
base = initialize_storage(Path("/path/to/library"))
```

Creates:
```
.claude/library/
├── catalog.json              # Resource catalog
├── citations.json            # Citation graph
├── .url_index.json           # URL to ID mapping
├── .pending_resources.jsonl  # Queue for processing
├── .index/
│   └── search.db             # SQLite FTS5 index
└── .cache/
    ├── objects/              # Content-addressed storage
    └── index/
```

## Import Formats

### Auto-Detection

```python
from lib import import_resources, Library

lib = Library()

# Format auto-detected from extension
imported = import_resources("bookmarks.json", lib)
imported = import_resources("references.bib", lib)
imported = import_resources("urls.txt", lib)
```

### JSONL Import

One resource per line:

```jsonl
{"url": "https://arxiv.org/abs/2312.12345", "title": "Paper Title"}
{"url": "https://github.com/org/repo", "tags": ["ai", "ml"]}
```

```python
imported = import_resources("resources.jsonl", lib, format="jsonl")
```

### Markdown Import

Extracts URLs and markdown links:

```python
imported = import_resources("README.md", lib, format="markdown")
```

Finds:
- Markdown links: `[title](url)`
- Bare URLs: `https://...`

### Browser Bookmarks

Chrome/Firefox export format:

```python
imported = import_resources("Bookmarks.json", lib, format="bookmarks")
```

Folder structure becomes subject tags.

### BibTeX Import

```python
imported = import_resources("references.bib", lib, format="bibtex")
```

Extracts:
- Authors from `author` field
- Year from `year` field
- Keywords from `keywords` field
- URLs from `url` or `doi`/`eprint`

### Plain URL List

One URL per line:

```python
imported = import_resources("urls.txt", lib, format="urls")
```

## URL Extraction

Extract URLs from arbitrary text:

```python
from lib import extract_urls_from_text

text = """
Check out https://arxiv.org/abs/2312.12345 for the paper.
Also see [repo](https://github.com/org/project).
"""

urls = extract_urls_from_text(text)
# ['https://arxiv.org/abs/2312.12345', 'https://github.com/org/project']
```

## Migration Statistics

```python
from lib import get_migration_stats, Library

lib = Library()
stats = get_migration_stats(lib)

print(f"Total: {stats['total_resources']}")
print(f"By type: {stats['by_type']}")
print(f"Cache objects: {stats['cache']['object_count']}")
print(f"Citations: {stats['citations']['total']}")
```

## CLI Usage

```bash
# Initialize storage
python src/cli.py init

# Import from file
python src/cli.py import bookmarks.json
python src/cli.py import --format bibtex refs.bib
python src/cli.py import -v urls.txt  # verbose

# Check stats
python src/cli.py stats

# Add single resource
python src/cli.py add https://arxiv.org/abs/2312.12345

# Export
python src/cli.py export --format bibtex -o refs.bib
```

## Batch Migration

```python
from lib import Library, import_resources
from pathlib import Path

lib = Library()

# Import from multiple sources
sources = [
    "old-bookmarks.json",
    "paper-references.bib",
    "research-urls.txt",
]

total = 0
for source in sources:
    imported = import_resources(source, lib)
    print(f"{source}: {len(imported)} resources")
    total += len(imported)

print(f"Total imported: {total}")

# Rebuild search index
index = lib.get_search_index()
index.rebuild_from_catalog(list(lib.iter_resources()))
```

## Deduplication

The library automatically deduplicates on import:

```python
# First import
imported = import_resources("urls.txt", lib)  # 100 new

# Second import (same file)
imported = import_resources("urls.txt", lib)  # 0 new (all exist)

# Overlapping file
imported = import_resources("more-urls.txt", lib)  # Only new URLs
```

## Post-Import Enrichment

After bulk import, run extractors for richer metadata:

```python
from lib import Library
from extractors import ArxivExtractor, GitHubExtractor

lib = Library()
arxiv = ArxivExtractor()
github = GitHubExtractor()

for resource in lib.iter_resources():
    if resource.type == ResourceType.PAPER and "arxiv.org" in resource.source:
        metadata = arxiv.extract(resource.source, None)
        # Update resource with extracted metadata
    elif resource.type == ResourceType.REPO:
        metadata = github.extract(resource.source, None)
```
