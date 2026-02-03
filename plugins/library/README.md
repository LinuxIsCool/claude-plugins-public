# Library Plugin

Universal resource library with automatic URL capture, content-addressed storage, and citation graph tracking.

## Features

- **Automatic Capture**: PostToolUse hooks capture URLs from WebFetch/WebSearch
- **Content-Addressed Storage**: SHA-256 deduplication at `.claude/library/.cache/`
- **Specialized Extractors**: arXiv, GitHub, DOI, and generic HTML parsing
- **Citation Graph**: Track provenance across sessions
- **Dublin Core Metadata**: Standard schema with type-specific extensions

## Installation

The plugin is auto-discovered from `plugins/library/`.

## Storage Layout

```
.claude/library/
├── catalog.json              # Resource catalog (primary)
├── citations.json            # Citation graph
├── .url_index.json           # Quick URL lookup
├── .pending_resources.jsonl  # Queued for processing
└── .cache/                   # Content-addressed storage (gitignored)
    ├── objects/{hash[:2]}/{hash}/
    │   ├── content
    │   ├── metadata.json
    │   └── verified
    └── index/url_to_hash.json
```

## Hooks

| Event | Hook | Description |
|-------|------|-------------|
| PostToolUse:WebFetch | capture_resource.py | Captures fetched URLs |
| PostToolUse:WebSearch | capture_resource.py | Captures search result URLs |
| SessionEnd | session_end_index.py | Processes pending into catalog |

## Agent

Use `library:librarian` for:
- Resource enrichment
- Deduplication queries
- Citation management
- Search and discovery

## Skills

Master skill: `library` with 6 sub-skills:
- resource-finder
- resource-adder
- citation-manager
- cache-manager
- extractor-developer
- library-exporter

## Python API

```python
import sys
sys.path.insert(0, 'plugins/library/src')

from lib import Library, ResourceType

lib = Library()

# Add resource
resource, is_new = lib.add_resource(
    url="https://arxiv.org/abs/2312.12345",
    title="Paper Title",
)

# Search
results = lib.search(query="machine learning", resource_type=ResourceType.PAPER)

# Check URL
if lib.has_url("https://example.com"):
    resource = lib.get_by_url("https://example.com")
```

## Extractor Priority

| Priority | Extractor | Handles |
|----------|-----------|---------|
| 90 | arxiv | arxiv.org URLs |
| 80 | github | github.com URLs |
| 70 | doi | doi.org and DOI patterns |
| 50 | generic | All HTTP(S) URLs |

## Resource Types

- `url` - Generic web pages
- `paper` - Academic papers (arXiv, DOI)
- `repo` - Code repositories
- `book` - Books (ISBN)
- `video` - Video content
- `dataset` - Data sources
- `image` - Images
