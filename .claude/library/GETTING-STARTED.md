# Getting Started with Universal Resource Library

*Quick start guide for implementing the resource library system*
*Created: 2026-01-05*

---

## What You Have Now

A **design document** ([design.md]( and **implementation roadmap** ([implementation-roadmap.md]( for building a professional-grade resource management system.

The design synthesizes best practices from:
- Professional citation managers (Zotero, Mendeley)
- Library science standards (Dublin Core, FRBR)
- Content-addressed storage systems (Git, IPFS)
- Academic metadata standards (BibTeX, CSL-JSON)

---

## Key Design Decisions

### 1. Metadata Architecture

**Universal Core Schema** (Dublin Core-based):
- 15 core fields work across all media types
- Type-specific extensions for papers, books, films, images
- Provenance metadata tracks discovery context and citations
- Storage metadata for content addressing and versioning

### 2. Content-Addressed Storage

Following Git's model:
- SHA-256 hash identifies content
- Identical content stored once (automatic deduplication)
- Immutable objects enable versioning
- Cache structure: `.cache/objects/{first-2-chars}/{remaining-hash}/`

### 3. FRBR Hierarchy (Work-Expression-Manifestation)

Professional libraries cluster related resources:
- **Work**: Abstract concept (e.g., "Pride and Prejudice")
- **Expression**: Language/format variant (English vs French)
- **Manifestation**: Physical form (2015 Penguin paperback)
- **Item**: Your specific copy

This enables:
- Grouping translations
- Linking formats (PDF vs HTML)
- Edition tracking
- Citation stability

### 4. Provenance and Citation Graphs

Every resource tracks:
- Where it came from (URL, DOI, ISBN)
- When it was added and by whom
- What cites it (journal entries, planning docs, sessions)
- What it cites (backward references)

Enables queries like:
- "What influenced this work?"
- "What has cited this?"
- "Show citation path between two resources"

### 5. File Organization

**Canonical + Faceted**:
- Each resource has ONE canonical location (by primary ID)
- Multiple faceted views via symlinks/references
- Example: Paper stored at `papers/by-doi/{doi}.yaml`
- Accessible also via `papers/by-author/{author}/` and `papers/by-topic/{topic}/`

---

## What to Build First

### MVP (4 weeks, Phases 1-3)

1. **Content-Addressed Cache** (Week 1)
   - Git-like object storage
   - SHA-256 hashing
   - Deduplication
   - SQLite index for fast lookup

2. **Core CRUD API** (Week 1-2)
   - Add URL, paper, book resources
   - Duplicate detection
   - Metadata validation
   - Citation tracking

3. **Academic Paper Support** (Week 2-3)
   - DOI/arXiv integration (auto-fetch metadata)
   - BibTeX export
   - PDF caching
   - Citation count tracking

4. **Migration** (Week 3)
   - Migrate 88 existing URLs
   - Enrich with titles, descriptions
   - Populate cache

5. **Integration** (Week 4)
   - Journal plugin integration (auto-cite)
   - Archivist cross-reference
   - CLI tool for manual cataloguing

---

## Architecture Highlights

### Metadata Schema Example (Paper)

```yaml
# papers/by-doi/10.1002-j.1538-7305.1948.tb01338.x.yaml
resource_id: "shannon-1948"
type: "paper"
identifier: "doi:10.1002/j.1538-7305.1948.tb01338.x"

# Universal Core (Dublin Core)
title: "A Mathematical Theory of Communication"
creator:
  - family: "Shannon"
    given: "Claude E."
    orcid: "0000-0001-2345-6789"
date: "1948-07"
publisher: "Bell System Technical Journal"
language: "en"
subject: ["information-theory", "communication", "entropy"]
description: "Foundational paper establishing information theory..."

# Paper-specific
doi: "10.1002/j.1538-7305.1948.tb01338.x"
journal: "Bell System Technical Journal"
volume: "27"
issue: "3"
pages: "379-423"
abstract: "The recent development of various methods..."
citations_count: 48523
peer_reviewed: true

# Provenance
catalogued: "2025-12-15T14:30:00Z"
catalogued_by: "librarian"
discovered_context: "Background research for entropy discussion"
cited_by:
  - citing_document: "journal-entry-2025-12-15"
    timestamp: "2025-12-15T14:35:00Z"
    context: "Referenced in daily journal"
  - citing_document: ".claude/planning/2025-12-20-information-arch.md"
    timestamp: "2025-12-20T16:00:00Z"
    context: "Cited as foundational work"

# Storage
content_hash: "abc123def456..."  # SHA-256 of PDF
cache_path: ".cache/objects/ab/c123def456.../content"
size_bytes: 2458321
versions:
  - hash: "abc123..."
    timestamp: "2025-12-15T14:30:00Z"
    source: "https://example.com/shannon.pdf"
last_verified: "2025-12-15T14:30:00Z"
```

### Python API Example

```python
from library import Library

lib = Library("

# Add a paper by DOI (auto-fetches metadata)
paper = lib.add_paper(
    doi="10.1002/j.1538-7305.1948.tb01338.x",
    auto_fetch_metadata=True
)
# Result: Metadata fetched from CrossRef, PDF cached

# Add a URL (fetches and caches content)
url_resource = lib.add_url(
    url="https://docs.anthropic.com/claude",
    topics=["documentation", "ai"],
    context="API reference for Claude"
)

# Check before fetching (cache hit)
if lib.has_resource(url="https://docs.anthropic.com/claude"):
    cached = lib.get_by_url("https://docs.anthropic.com/claude")
    print(f"Already cached: {cached.content_hash}")
else:
    cached = lib.fetch_and_cache(url)

# Track citation
lib.add_citation(
    resource=paper,
    cited_by="journal-entry-2026-01-05",
    context="Studying information theory fundamentals"
)

# Search
results = lib.search(
    query="information theory",
    filters={"type": "paper", "year_range": (1940, 1960)}
)

# Export to BibTeX
lib.export_bibtex("exports/bibtex/complete.bib")
```

### CLI Tool Example

```bash
# Add resources
librarian add paper --doi 10.1002/j.1538-7305.1948.tb01338.x
librarian add book --isbn 978-0-262-03384-8
librarian add url https://docs.anthropic.com/claude --topics "docs,ai"

# Search
librarian search "information theory" --type paper --year 1940-1960

# Show resource
librarian show shannon-1948

# Track citation
librarian cite shannon-1948 journal-entry-2026-01-05 \
  --context "Studying entropy concepts"

# Export
librarian export --format bibtex --output refs.bib

# Stats and maintenance
librarian stats
librarian verify --all
librarian deduplicate --dry-run
```

---

## Professional Standards Applied

### 1. Zotero Insights
- Multiple format support (BibTeX, RIS, CSL-JSON)
- Auto-metadata fetch from DOI/ISBN
- Extra field for non-standard metadata
- Broad vocabulary compatibility

### 2. Dublin Core
- 15 universal elements (creator, title, date, subject, etc.)
- Cross-domain applicability
- Simple yet extensible
- OAI-PMH compatible for harvesting

### 3. BibTeX Format
- 14 standard entry types (@article, @book, @inproceedings, etc.)
- Citation key convention (author-year)
- Required vs optional fields per type
- Style-independent data format

### 4. FRBR Model
- Work-expression-manifestation-item hierarchy
- User tasks: Find, Identify, Select, Obtain
- Authority control for creators/subjects
- Classical library principles (Ranganathan's Laws)

### 5. Content-Addressed Storage
- SHA-256 content hashing (Git model)
- Automatic deduplication
- Immutable objects for versioning
- IPFS-inspired distributed potential

---

## Integration Points

### With Journal Plugin
```markdown
<!-- In journal entry -->
Today I studied Shannon's paper [@shannon-1948].

<!-- Auto-expanded by librarian -->
Today I studied Shannon's paper [^1].

[^1]: Shannon, Claude E. "A Mathematical Theory of Communication."
      Bell System Technical Journal 27(3):379-423, 1948.
      doi:10.1002/j.1538-7305.1948.tb01338.x
```

### With Archivist
- Archivist: Internal artifacts (`.claude/archive/`)
- Librarian: External resources (`.claude/library/`)
- Cross-reference: Planning docs cite papers, papers stored in library

### With Knowledge Graphs
- Export citation graph to FalkorDB/Graphiti
- Cypher/SPARQL queries over relationships
- Temporal tracking (when knowledge added)

---

## Implementation Phases

| Phase | Duration | Deliverables |
|-------|----------|--------------|
| **Phase 1: Foundation** | 2 weeks | Cache, schemas, CRUD API |
| **Phase 2: Migration** | 3 days | Migrate 88 URLs, enrich metadata |
| **Phase 3: Academic** | 1 week | DOI/arXiv, BibTeX export |
| **Phase 4: Multimedia** | 1.5 weeks | Books, films, images |
| **Phase 5: Advanced** | 2 weeks | FRBR, authority, visualization |
| **Phase 6: Integration** | 1 week | Journal, archivist, KG |

**Total: ~8 weeks for complete system**

**MVP (Phases 1-3): ~4 weeks**

---

## Next Steps

### Immediate
1. Read [design.md]( - Full architectural context
2. Read [implementation-roadmap.md]( - Detailed build plan
3. Create branch: `git checkout -b feature/library-foundation`

### Week 1
1. Implement content-addressed cache (see roadmap Phase 1.1)
2. Create schema definitions (see roadmap Phase 1.2)
3. Build basic CRUD API (see roadmap Phase 1.3)

### Week 2
1. Migrate existing 88 URLs (see roadmap Phase 2.1)
2. Implement DOI/arXiv integration (see roadmap Phase 3.1)
3. Add BibTeX export (see roadmap Phase 3.2)

### Week 3
1. Build CLI tool
2. Test with real usage patterns
3. Integrate with journal plugin

### Week 4
1. Add book support (ISBN)
2. Documentation and examples
3. Deploy to main branch

---

## Key Files to Reference

### Design Documents (Just Created)
- ` - Complete architecture
- ` - Build plan
- ` - This file

### Existing Library Files
- ` - Overview
- ` - Statistics
- ` - Current data

### Agent Definition
- ` - Librarian agent spec

---

## Success Metrics

### Efficiency
- Cache hit rate: >70%
- Deduplication ratio: Average 2.5+ manifestations per work
- Zero redundant fetches for known resources

### Quality
- Metadata completeness: >90% with all required fields
- Citation coverage: >80% of external references tracked
- Accuracy: <1% broken links, <0.1% hash mismatches

### Adoption
- Agents query library before WebFetch
- Journal entries auto-cite via librarian
- Resources catalogued: 500+ by Q2 2026

---

## Questions?

Invoke the librarian agent:
```bash
# In Claude Code
/task librarian "Help me implement the content-addressed cache"
```

Or read the detailed documentation:
- Metadata schemas: See design.md Section 1
- Cache implementation: See implementation-roadmap.md Phase 1.1
- FRBR hierarchy: See design.md Section 3.1
- Integration patterns: See implementation-roadmap.md Phase 6

---

*The library awaits. Every piece of knowledge, properly sourced, efficiently stored, endlessly traceable.*

*Maintained by: The Librarian*
*Created: 2026-01-05*
