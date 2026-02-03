# Library Exporter Sub-Skill

Export library resources to standard citation formats.

## Quick Export

Use the built-in `export_resources()` function for common formats:

```python
from lib import Library, export_resources, ExportOptions

lib = Library()
resources = list(lib.iter_resources())

# BibTeX
bibtex = export_resources(resources, format="bibtex")

# CSL-JSON (for Zotero/Mendeley)
csl_json = export_resources(resources, format="csl-json")

# Markdown catalog
markdown = export_resources(resources, format="markdown")

# Markdown list
md_list = export_resources(resources, format="markdown-list")

# Markdown table
md_table = export_resources(resources, format="markdown-table")

# Academic bibliography
bibliography = export_resources(resources, format="markdown-bibliography")
```

## Export Options

Customize exports with `ExportOptions`:

```python
from lib import ExportOptions

options = ExportOptions(
    include_abstract=True,      # Include descriptions/abstracts
    include_keywords=True,      # Include subject tags
    include_access_info=False,  # Include access counts/dates
    max_authors=10,             # Truncate author list
    date_format="%Y-%m-%d",     # Date formatting
)

bibtex = export_resources(resources, format="bibtex", options=options)
```

## BibTeX Export

Detailed BibTeX control:

```python
from lib import BibTeXExporter, Library, ResourceType

lib = Library()
exporter = BibTeXExporter()

# Single resource
resource = lib.get_by_url("https://arxiv.org/abs/2312.12345")
entry = exporter.export_resource(resource)
print(entry)
# @article{smith_2023_knowledge,
#   title = {Knowledge Graph Construction},
#   author = {Smith, John and Jones, Alice},
#   year = {2023},
#   eprint = {2312.12345},
#   archiveprefix = {arXiv},
#   url = {https://arxiv.org/abs/2312.12345},
#   abstract = {...}
# }

# All papers
papers = list(lib.iter_resources(ResourceType.PAPER))
bibtex = exporter.export_all(papers)

# Save to file
Path("references.bib").write_text(bibtex)
```

### BibTeX Entry Types

| Resource Type | BibTeX Entry |
|---------------|--------------|
| paper | @article |
| repo | @software |
| book | @book |
| url | @misc |
| video | @misc |
| dataset | @dataset |

## CSL-JSON Export

For Zotero, Mendeley, and Citation.js:

```python
from lib import CSLJSONExporter, Library

lib = Library()
exporter = CSLJSONExporter()

# Export all resources
resources = list(lib.iter_resources())
csl_json = exporter.export_all(resources)

# Save for Zotero import
Path("library.json").write_text(csl_json)
```

### CSL-JSON Types

| Resource Type | CSL Type |
|---------------|----------|
| paper | article |
| repo | software |
| book | book |
| url | webpage |
| video | motion_picture |
| dataset | dataset |

## Markdown Export

Multiple markdown styles:

```python
from lib import MarkdownExporter, Library

lib = Library()
exporter = MarkdownExporter()
resources = list(lib.iter_resources())

# Full catalog with sections
catalog = exporter.export_catalog(resources, title="My Library", include_stats=True)

# Simple bullet list
simple_list = exporter.export_list(resources)

# Table format
table = exporter.export_table(resources)

# Academic bibliography style
bibliography = exporter.export_bibliography(resources, style="apa")
```

### Catalog Output Example

```markdown
# My Library

**Total Resources**: 42
**Generated**: 2026-01-05T12:00:00Z

## Summary

- **paper**: 15
- **repo**: 20
- **url**: 7

## Paper (15)

### [Knowledge Graph Construction](https://arxiv.org/abs/2312.12345)
**Authors**: John Smith, Alice Jones | **Date**: 2023-12-15

> A comprehensive survey of knowledge graph construction methods...

**Tags**: `knowledge-graphs` `nlp` `survey`
**arXiv**: 2312.12345
```

## Filter Before Export

Export subsets of the library:

```python
from lib import Library, ResourceType, export_resources

lib = Library()

# Only papers
papers = list(lib.iter_resources(ResourceType.PAPER))
bibtex = export_resources(papers, format="bibtex")

# Search results
results = lib.search("knowledge graphs")
markdown = export_resources(results, format="markdown-list")

# Top-cited resources (via hybrid search)
top_results = lib.hybrid_search("machine learning", limit=20)
top_resources = [r for r, _ in top_results]
top_bibtex = export_resources(top_resources, format="bibtex")
```

## Citation Graph Export (DOT)

Export citation graph for visualization:

```python
def export_citation_graph_dot(lib):
    """Export citation graph as Graphviz DOT format."""
    lines = ["digraph citations {", "  rankdir=LR;", "  node [shape=box];"]

    # Add nodes
    for r in lib.iter_resources():
        label = (r.title or r.identifier)[:30].replace('"', '\\"')
        color = {
            "paper": "lightblue",
            "repo": "lightgreen",
            "url": "lightyellow",
        }.get(r.type.value, "white")
        lines.append(f'  "{r.identifier[:8]}" [label="{label}" fillcolor="{color}" style="filled"];')

    # Add edges
    for c in lib._citations:
        style = "solid" if c.citation_type == "reference" else "dashed"
        lines.append(f'  "{c.source_id[:8]}" -> "{c.target_id[:8]}" [style="{style}"];')

    lines.append("}")
    return "\n".join(lines)

# Generate and save
dot = export_citation_graph_dot(lib)
Path("citations.dot").write_text(dot)
# Render with: dot -Tpng citations.dot -o citations.png
```

## Domain and Topic Reports

```python
from collections import defaultdict
from urllib.parse import urlparse

def export_by_domain(lib):
    """Group resources by domain."""
    by_domain = defaultdict(list)
    for r in lib.iter_resources():
        domain = urlparse(r.source).netloc
        by_domain[domain].append(r)

    lines = ["# Resources by Domain", ""]
    for domain, resources in sorted(by_domain.items(), key=lambda x: -len(x[1])):
        lines.append(f"## {domain} ({len(resources)})")
        for r in sorted(resources, key=lambda x: x.title or x.source):
            lines.append(f"- [{r.title or 'Untitled'}]({r.source})")
        lines.append("")
    return "\n".join(lines)

def export_by_topic(lib):
    """Group resources by subject tags."""
    by_topic = defaultdict(list)
    for r in lib.iter_resources():
        for topic in r.subject:
            by_topic[topic].append(r)

    lines = ["# Resources by Topic", ""]
    for topic, resources in sorted(by_topic.items(), key=lambda x: -len(x[1])):
        lines.append(f"## {topic} ({len(resources)})")
        for r in resources:
            lines.append(f"- [{r.title or r.source}]({r.source})")
        lines.append("")
    return "\n".join(lines)
```

## Statistics Export

```python
def export_full_stats(lib):
    """Export comprehensive library statistics."""
    stats = lib.get_stats()
    cache_stats = stats["cache"]

    # Get search index stats
    try:
        index = lib.get_search_index()
        index_stats = index.get_stats()
    except Exception:
        index_stats = {"total_indexed": 0, "index_size_human": "N/A"}

    # Get citation graph stats
    graph = lib.get_citation_graph()
    graph_stats = graph.get_stats()

    lines = [
        "# Library Statistics",
        "",
        f"**Generated**: {datetime.utcnow().isoformat()}Z",
        "",
        "## Resources",
        f"- Total: {stats['resource_count']}",
        "",
    ]

    for rtype, count in sorted(stats["resources_by_type"].items()):
        lines.append(f"- {rtype.title()}: {count}")

    lines.extend([
        "",
        "## Search Index",
        f"- Indexed: {index_stats['total_indexed']}",
        f"- Size: {index_stats['index_size_human']}",
        "",
        "## Citation Graph",
        f"- Citations: {graph_stats['total_citations']}",
        f"- Nodes: {graph_stats['unique_nodes']}",
        f"- Avg in-degree: {graph_stats['avg_in_degree']:.2f}",
        "",
        "## Cache",
        f"- Objects: {cache_stats['object_count']}",
        f"- URLs indexed: {cache_stats['url_count']}",
        f"- Total size: {cache_stats['total_size_human']}",
        f"- Dedup ratio: {cache_stats['deduplication_ratio']:.2f}x",
    ])

    return "\n".join(lines)
```
