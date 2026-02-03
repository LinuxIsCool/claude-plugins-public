# Universal Resource Library - Implementation Roadmap

*Created: 2026-01-05*
*Companion to: design.md*

---

## Quick Start: What to Build First

Based on professional citation management systems and library science principles, here's the pragmatic path from your current library structure to a comprehensive resource management system.

---

## Phase 0: Current State Assessment

### What Exists Today

```
.claude/library/
├── README.md                 # Overview and philosophy ✓
├── index.md                  # Statistics and navigation ✓
├── catalog.md                # Resource listing ✓
├── citations.json            # Machine-readable citations ✓
├── MANIFEST.md               # Complete manifest ✓
└── urls/
    ├── by-domain/            # 6 domain files ✓
    │   ├── github.com.md
    │   ├── claude.com.md
    │   ├── pypi.org.md
    │   └── code.claude.com.md
    └── by-topic/             # 6 topic files ✓
        ├── agent-development.md
        ├── documentation.md
        ├── knowledge-graphs.md
        ├── python.md
        ├── security.md
```

### What's Working
- URL cataloguing from session logs
- Domain-based organization
- Topic clustering
- Citation tracking (basic)
- Access count statistics

### Gaps to Address
- No content caching (all fetches are external)
- No deduplication (same URL could be catalogued multiple times)
- Limited metadata (mostly just URL, domain, session refs)
- No academic papers, books, or multimedia
- No FRBR work-expression-manifestation hierarchy
- No authority control
- Manual cataloguing only (no API)

---

## Phase 1: Foundation (Priority: Critical)

### 1.1 Content-Addressed Cache System

**Goal**: Implement Git-like content storage to enable deduplication and versioning.

**Files to Create**:
```
.claude/library/.cache/
├── objects/
│   └── {first-2-hash-chars}/
│       └── {remaining-hash}/
│           ├── content
│           └── metadata.yaml
├── index/
│   └── cache-index.db        # SQLite: URL→hash, hash→path
└── config.yaml               # Cache configuration
```

**Implementation**:
```python
# .claude/library/tools/cache.py
import hashlib
from pathlib import Path

class ContentAddressedCache:
    def __init__(self, base_path: Path):
        self.base = base_path
        self.objects = base_path / "objects"
        self.objects.mkdir(parents=True, exist_ok=True)

    def hash_content(self, content: bytes) -> str:
        return hashlib.sha256(content).hexdigest()

    def object_path(self, content_hash: str) -> Path:
        return self.objects / content_hash[:2] / content_hash[2:]

    def store(self, content: bytes, metadata: dict) -> str:
        content_hash = self.hash_content(content)
        obj_path = self.object_path(content_hash)

        if obj_path.exists():
            return content_hash  # Already cached

        obj_path.mkdir(parents=True, exist_ok=True)
        (obj_path / "content").write_bytes(content)
        (obj_path / "metadata.yaml").write_text(yaml.dump(metadata))

        return content_hash

    def retrieve(self, content_hash: str) -> tuple[bytes, dict]:
        obj_path = self.object_path(content_hash)
        content = (obj_path / "content").read_bytes()
        metadata = yaml.safe_load((obj_path / "metadata.yaml").read_text())
        return content, metadata

    def has_object(self, content_hash: str) -> bool:
        return self.object_path(content_hash).exists()
```

**Success Criteria**:
- [ ] Cache can store arbitrary content
- [ ] Same content stored once (deduplication)
- [ ] Fast lookup by hash
- [ ] Metadata tracked per object

**Estimated Time**: 2-3 days

### 1.2 Core Schema Implementation

**Goal**: Define YAML schemas for all resource types.

**Files to Create**:
```
.claude/library/schemas/
├── core.yaml              # Dublin Core base
├── paper.yaml             # Academic papers
├── book.yaml              # Books
├── film.yaml              # Films/TV
├── image.yaml             # Images/art
├── url.yaml               # Web resources
└── dataset.yaml           # Datasets
```

**Example Schema** (schemas/paper.yaml):
```yaml
# Academic Paper Schema
# Extends: core.yaml

type: paper
required_fields:
  - identifier    # DOI or arXiv ID
  - title
  - creator       # Authors
  - date          # Publication date
  - type          # "paper"

optional_fields:
  - doi
  - arxiv_id
  - pmid
  - journal
  - volume
  - issue
  - pages
  - abstract
  - citations_count
  - peer_reviewed
  - pdf_url

field_definitions:
  doi:
    type: string
    pattern: "^10\\.\\d+/.+$"
    description: "Digital Object Identifier"

  arxiv_id:
    type: string
    pattern: "^\\d{4}\\.\\d{4,5}(v\\d+)?$"
    description: "arXiv identifier"

  creator:
    type: array
    items:
      type: object
      properties:
        family: string
        given: string
        orcid: string  # Optional ORCID
```

**Success Criteria**:
- [ ] All resource types have schemas
- [ ] Schemas validate with JSON Schema or similar
- [ ] Clear documentation for each field

**Estimated Time**: 2 days

### 1.3 Resource CRUD API

**Goal**: Python API for adding, retrieving, updating resources.

**File to Create**: `.claude/library/tools/library.py`

```python
class Library:
    def __init__(self, base_path: Path):
        self.base = base_path
        self.cache = ContentAddressedCache(base_path / ".cache")
        self.resources = base_path / "resources"

    def add_url(
        self,
        url: str,
        title: str = None,
        topics: list[str] = None,
        context: str = None,
        fetch_content: bool = True
    ) -> Resource:
        """Add a URL resource to the library."""

        # Check if already exists
        existing = self.find_by_url(url)
        if existing:
            return self._update_access(existing)

        # Fetch content if requested
        content_hash = None
        if fetch_content:
            content = self._fetch_url(url)
            content_hash = self.cache.store(content, {
                "url": url,
                "fetched": datetime.now().isoformat()
            })

        # Extract metadata
        domain = urlparse(url).netloc
        if title is None:
            title = self._extract_title(content) if fetch_content else url

        # Create resource record
        resource = Resource(
            resource_id=self._generate_id(),
            type="url",
            identifier=url,
            title=title,
            domain=domain,
            topics=topics or [],
            content_hash=content_hash,
            fetched=datetime.now().isoformat(),
            access_count=1,
            catalogued_by="librarian"
        )

        # Save to canonical location
        self._save_resource(resource, f"urls/by-hash/{resource.resource_id}.yaml")

        # Create faceted views (symlinks or references)
        self._add_to_domain_index(resource, domain)
        for topic in topics or []:
            self._add_to_topic_index(resource, topic)

        return resource

    def add_paper(
        self,
        doi: str = None,
        arxiv_id: str = None,
        pdf_url: str = None,
        auto_fetch_metadata: bool = True
    ) -> Resource:
        """Add an academic paper to the library."""

        # Normalize identifier
        if doi:
            identifier = f"doi:{doi}"
        elif arxiv_id:
            identifier = f"arxiv:{arxiv_id}"
        else:
            raise ValueError("Must provide DOI or arXiv ID")

        # Check if already exists
        existing = self.find_by_identifier(identifier)
        if existing:
            return self._update_access(existing)

        # Auto-fetch metadata from CrossRef/arXiv
        metadata = {}
        if auto_fetch_metadata:
            if doi:
                metadata = self._fetch_crossref_metadata(doi)
            elif arxiv_id:
                metadata = self._fetch_arxiv_metadata(arxiv_id)

        # Fetch PDF if URL provided
        content_hash = None
        if pdf_url:
            content = self._fetch_url(pdf_url)
            content_hash = self.cache.store(content, {
                "url": pdf_url,
                "type": "application/pdf",
                "fetched": datetime.now().isoformat()
            })

        # Create resource record
        resource = Resource(
            resource_id=self._generate_id(),
            type="paper",
            identifier=identifier,
            doi=doi,
            arxiv_id=arxiv_id,
            title=metadata.get("title"),
            creator=metadata.get("authors", []),
            date=metadata.get("published"),
            journal=metadata.get("journal"),
            abstract=metadata.get("abstract"),
            content_hash=content_hash,
            catalogued=datetime.now().isoformat(),
            catalogued_by="librarian"
        )

        # Save to canonical location
        canon_path = f"papers/by-doi/{doi.replace('/', '_')}.yaml" if doi else \
                     f"papers/by-arxiv/{arxiv_id}.yaml"
        self._save_resource(resource, canon_path)

        # Create faceted views
        if metadata.get("authors"):
            first_author = metadata["authors"][0].get("family", "unknown")
            self._add_to_author_index(resource, first_author)

        return resource

    def has_resource(self, url: str = None, identifier: str = None) -> bool:
        """Check if resource already exists."""
        if url:
            return self.find_by_url(url) is not None
        if identifier:
            return self.find_by_identifier(identifier) is not None
        return False

    def search(
        self,
        query: str = None,
        filters: dict = None
    ) -> list[Resource]:
        """Search the library."""
        # Implementation: full-text search across metadata
        pass

    def add_citation(
        self,
        resource: Resource,
        cited_by: str,
        context: str = None
    ):
        """Track that a resource was cited."""
        citation = Citation(
            citing_document=cited_by,
            timestamp=datetime.now().isoformat(),
            context=context
        )
        resource.cited_by.append(citation)
        self._save_resource(resource)
```

**Success Criteria**:
- [ ] Can add URLs, papers, books
- [ ] Duplicate detection works
- [ ] Content cached automatically
- [ ] Metadata validated against schema

**Estimated Time**: 4-5 days

---

## Phase 2: Migration and Enrichment (Priority: High)

### 2.1 Migrate Existing URL Data

**Goal**: Convert current flat markdown files to new schema with content caching.

**Script**: `.claude/library/tools/migrate_urls.py`

```python
def migrate_existing_urls():
    """Migrate from old format to new schema."""
    lib = Library(Path("

    # Read existing citations.json
    citations = json.loads((lib.base / "citations.json").read_text())

    for url, metadata in citations.items():
        print(f"Migrating: {url}")

        # Infer topic from domain or existing categorization
        topics = infer_topics(url, metadata)

        # Add to new system
        try:
            resource = lib.add_url(
                url=url,
                topics=topics,
                fetch_content=True,  # Cache content now
                context=f"Migrated from legacy system. "
                        f"First seen: {metadata.get('first_seen')}"
            )
            print(f"  ✓ Added as {resource.resource_id}")
        except Exception as e:
            print(f"  ✗ Error: {e}")

    # Archive old files
    shutil.move(lib.base / "citations.json", lib.base / "citations.json.legacy")
```

**Success Criteria**:
- [ ] All 88 URLs migrated
- [ ] Content cached for reachable URLs
- [ ] Topics preserved/enhanced
- [ ] Access counts preserved
- [ ] Old files archived, not deleted

**Estimated Time**: 1 day

### 2.2 Enrich with Missing Metadata

**Goal**: Enhance URL resources with titles, descriptions, OpenGraph data.

```python
def enrich_url_metadata(resource: Resource):
    """Extract rich metadata from cached HTML."""
    if resource.content_hash:
        content, _ = lib.cache.retrieve(resource.content_hash)
        html = content.decode('utf-8')

        # Extract <title>
        if not resource.title:
            title_match = re.search(r'<title>(.*?)</title>', html, re.IGNORECASE)
            if title_match:
                resource.title = title_match.group(1).strip()

        # Extract OpenGraph metadata
        og_title = extract_meta_tag(html, 'og:title')
        og_description = extract_meta_tag(html, 'og:description')
        og_image = extract_meta_tag(html, 'og:image')

        if og_title:
            resource.metadata['og_title'] = og_title
        if og_description:
            resource.description = og_description
        if og_image:
            resource.metadata['thumbnail'] = og_image

    return resource
```

**Success Criteria**:
- [ ] All URLs have titles
- [ ] Descriptions added where available
- [ ] Thumbnails captured for visualization

**Estimated Time**: 1 day

---

## Phase 3: Academic Paper Support (Priority: High)

### 3.1 DOI and arXiv Integration

**Files to Create**:
- `.claude/library/tools/integrations/crossref.py`
- `.claude/library/tools/integrations/arxiv.py`

```python
# crossref.py
import requests

class CrossRefClient:
    BASE_URL = "https://api.crossref.org/works"

    def fetch_metadata(self, doi: str) -> dict:
        """Fetch paper metadata from CrossRef API."""
        url = f"{self.BASE_URL}/{doi}"
        response = requests.get(url, headers={"User-Agent": "LibrarianBot/1.0"})
        response.raise_for_status()

        data = response.json()['message']

        return {
            "title": data.get("title", [""])[0],
            "authors": [
                {
                    "family": author.get("family"),
                    "given": author.get("given"),
                    "orcid": author.get("ORCID", "").replace("http://orcid.org/", "")
                }
                for author in data.get("author", [])
            ],
            "journal": data.get("container-title", [""])[0],
            "published": self._parse_date(data.get("published")),
            "volume": data.get("volume"),
            "issue": data.get("issue"),
            "pages": data.get("page"),
            "doi": data.get("DOI"),
            "abstract": data.get("abstract"),
            "citations_count": data.get("is-referenced-by-count", 0)
        }

    def _parse_date(self, date_parts) -> str:
        """Convert CrossRef date format to ISO8601."""
        if not date_parts or "date-parts" not in date_parts:
            return None
        parts = date_parts["date-parts"][0]
        return f"{parts[0]:04d}-{parts[1]:02d}-{parts[2]:02d}" if len(parts) == 3 else \
               f"{parts[0]:04d}-{parts[1]:02d}" if len(parts) == 2 else \
               f"{parts[0]:04d}"
```

**Success Criteria**:
- [ ] Can fetch metadata from DOI
- [ ] Can fetch metadata from arXiv ID
- [ ] Author names normalized
- [ ] Abstracts captured
- [ ] Citation counts tracked

**Estimated Time**: 2 days

### 3.2 BibTeX Export

**File**: `.claude/library/tools/export/bibtex.py`

```python
class BibTeXExporter:
    def export_resource(self, resource: Resource) -> str:
        """Convert a resource to BibTeX entry."""

        if resource.type == "paper":
            return self._export_paper(resource)
        elif resource.type == "book":
            return self._export_book(resource)
        # ... other types

    def _export_paper(self, resource: Resource) -> str:
        """Export paper as @article or @inproceedings."""

        # Generate citation key: firstauthor-year
        first_author = resource.creator[0].get("family", "unknown") if resource.creator else "unknown"
        year = resource.date[:4] if resource.date else "nodate"
        cite_key = f"{first_author.lower()}-{year}"

        # Format authors
        authors = " and ".join([
            f"{a.get('family', '')}, {a.get('given', '')}"
            for a in resource.creator
        ])

        entry_type = "@article" if resource.journal else "@misc"

        fields = [
            f"  author = {{{authors}}}",
            f"  title = {{{resource.title}}}",
            f"  year = {{{year}}}",
        ]

        if resource.doi:
            fields.append(f"  doi = {{{resource.doi}}}")
        if resource.journal:
            fields.append(f"  journal = {{{resource.journal}}}")
        if resource.volume:
            fields.append(f"  volume = {{{resource.volume}}}")
        if resource.pages:
            fields.append(f"  pages = {{{resource.pages}}}")

        return f"{entry_type}{{{cite_key},\n" + ",\n".join(fields) + "\n}"

    def export_collection(self, resources: list[Resource], output_path: Path):
        """Export multiple resources to .bib file."""
        with output_path.open('w') as f:
            for resource in resources:
                f.write(self.export_resource(resource))
                f.write("\n\n")
```

**Success Criteria**:
- [ ] Valid BibTeX output
- [ ] All papers exportable
- [ ] Can generate complete.bib for entire library
- [ ] Citation keys unique and stable

**Estimated Time**: 2 days

---

## Phase 4: Multimedia Support (Priority: Medium)

### 4.1 Book Metadata (ISBN)

**Integration**: Use Open Library API or Google Books API

```python
class OpenLibraryClient:
    def fetch_by_isbn(self, isbn: str) -> dict:
        url = f"https://openlibrary.org/api/books?bibkeys=ISBN:{isbn}&format=json&jscmd=data"
        response = requests.get(url)
        data = response.json()

        if not data:
            raise ValueError(f"ISBN not found: {isbn}")

        book_data = data[f"ISBN:{isbn}"]

        return {
            "title": book_data.get("title"),
            "authors": [a["name"] for a in book_data.get("authors", [])],
            "publisher": book_data.get("publishers", [{}])[0].get("name"),
            "published": book_data.get("publish_date"),
            "pages": book_data.get("number_of_pages"),
            "isbn": isbn,
            "cover_url": book_data.get("cover", {}).get("large"),
            "subjects": book_data.get("subjects", [])
        }
```

**Success Criteria**:
- [ ] Can add books by ISBN
- [ ] Metadata auto-fetched
- [ ] Cover images cached

**Estimated Time**: 2 days

### 4.2 Film/TV Metadata (IMDb/TMDb)

**Integration**: Use The Movie Database (TMDb) API (free, well-documented)

```python
class TMDbClient:
    BASE_URL = "https://api.themoviedb.org/3"

    def __init__(self, api_key: str):
        self.api_key = api_key

    def search_movie(self, title: str, year: int = None) -> list[dict]:
        params = {
            "api_key": self.api_key,
            "query": title,
            "year": year
        }
        response = requests.get(f"{self.BASE_URL}/search/movie", params=params)
        return response.json()["results"]

    def fetch_movie_details(self, tmdb_id: int) -> dict:
        url = f"{self.BASE_URL}/movie/{tmdb_id}"
        params = {"api_key": self.api_key}
        response = requests.get(url, params=params)
        data = response.json()

        return {
            "title": data.get("title"),
            "release_date": data.get("release_date"),
            "runtime": data.get("runtime"),
            "genres": [g["name"] for g in data.get("genres", [])],
            "directors": self._fetch_directors(tmdb_id),
            "cast": self._fetch_cast(tmdb_id, limit=10),
            "overview": data.get("overview"),
            "poster_url": f"https://image.tmdb.org/t/p/w500{data.get('poster_path')}",
            "imdb_id": data.get("imdb_id")
        }
```

**Success Criteria**:
- [ ] Can add films by title or IMDb ID
- [ ] Metadata auto-fetched
- [ ] Posters cached
- [ ] TV series support (seasons/episodes)

**Estimated Time**: 3 days

### 4.3 Image Cataloguing

```python
def add_image(
    self,
    url: str = None,
    file_path: Path = None,
    artist: str = None,
    title: str = None,
    medium: str = None,
    generate_thumbnail: bool = True
) -> Resource:
    """Add an image/artwork to the library."""

    # Load image
    if url:
        content = self._fetch_url(url)
    else:
        content = file_path.read_bytes()

    # Store original
    content_hash = self.cache.store(content, {"type": "image"})

    # Generate thumbnail
    thumbnail_hash = None
    if generate_thumbnail:
        thumbnail = self._generate_thumbnail(content, max_size=400)
        thumbnail_hash = self.cache.store(thumbnail, {"type": "image/thumbnail"})

    # Extract dominant colors
    colors = self._extract_color_palette(content)

    # Create resource
    resource = Resource(
        resource_id=self._generate_id(),
        type="image",
        title=title,
        creator=[{"name": artist}] if artist else [],
        medium=medium,
        content_hash=content_hash,
        metadata={
            "thumbnail_hash": thumbnail_hash,
            "colors": colors,
            "dimensions": self._get_image_dimensions(content)
        }
    )

    self._save_resource(resource, f"images/by-hash/{resource.resource_id}.yaml")

    return resource
```

**Success Criteria**:
- [ ] Can add images from URL or file
- [ ] Thumbnails auto-generated
- [ ] Color palette extracted
- [ ] Metadata includes dimensions, format

**Estimated Time**: 2 days

---

## Phase 5: Advanced Features (Priority: Medium-Low)

### 5.1 FRBR Work-Expression-Manifestation

**Goal**: Cluster related resources (e.g., translations, editions, formats).

```yaml
# Example: FRBR hierarchy
work:
  work_id: "shannon-information-theory"
  title: "A Mathematical Theory of Communication"
  creator: [{family: "Shannon", given: "Claude E."}]
  date: "1948"

  expressions:
    - expression_id: "shannon-1948-english-original"
      language: "en"
      type: "original"

      manifestations:
        - manifestation_id: "shannon-1948-bell-journal"
          format: "journal-article"
          publisher: "Bell System Technical Journal"
          identifier: "doi:10.1002/j.1538-7305.1948.tb01338.x"

        - manifestation_id: "shannon-1948-pdf-scan"
          format: "application/pdf"
          identifier: "url:https://example.com/shannon.pdf"
          content_hash: "abc123..."

    - expression_id: "shannon-1948-russian"
      language: "ru"
      type: "translation"

      manifestations:
        - manifestation_id: "shannon-1953-soviet-journal"
          format: "journal-article"
          publisher: "Soviet Journal of Communications"
```

**Implementation Approach**:
1. Start with flat resources
2. Gradually identify duplicates/variants
3. Promote to FRBR hierarchy when variants detected

**Success Criteria**:
- [ ] Can cluster related works
- [ ] Language variants linked
- [ ] Format variants (PDF vs HTML) linked
- [ ] Edition tracking for books

**Estimated Time**: 5 days

### 5.2 Authority Control

**Goal**: Normalize creator names, subjects, publishers.

**Files**:
```
.claude/library/authorities/
├── creators.yaml
├── subjects.yaml
└── publishers.yaml
```

```yaml
# creators.yaml
- canonical: "Shannon, Claude E."
  variants:
    - "Claude Shannon"
    - "C. E. Shannon"
    - "Shannon, C.E."
  orcid: "0000-0001-2345-6789"
  birth: "1916"
  death: "2001"
  affiliations:
    - "Bell Labs"
    - "MIT"

- canonical: "Turing, Alan M."
  variants:
    - "Alan Turing"
    - "A. M. Turing"
  orcid: "0000-0002-3456-7890"
```

**Success Criteria**:
- [ ] Author name variants normalized
- [ ] Subject headings controlled
- [ ] Publisher names canonical

**Estimated Time**: 3 days

### 5.3 Citation Graph Visualization

**Goal**: D3.js or Cytoscape.js visualization of citation network.

**Output**: `.claude/library/visualizations/citation-graph.html`

**Features**:
- Nodes: Resources
- Edges: Citations
- Color by type (paper, book, URL)
- Size by citation count
- Interactive filtering by topic/year

**Success Criteria**:
- [ ] Interactive HTML visualization
- [ ] Can explore citation chains
- [ ] Identifies most-cited resources
- [ ] Reveals citation clusters

**Estimated Time**: 3-4 days

---

## Phase 6: Integration (Priority: High)

### 6.1 Journal Integration

**Goal**: Auto-link citations in journal entries.

```markdown
<!-- Journal entry with citation -->
Today I read Shannon's seminal paper on information theory [@shannon-1948].

<!-- Auto-expanded by librarian -->
Today I read Shannon's seminal paper on information theory [^1].

[^1]: Shannon, Claude E. "A Mathematical Theory of Communication."
      Bell System Technical Journal 27(3):379-423, 1948.
      doi:10.1002/j.1538-7305.1948.tb01338.x
      [Cached](library://shannon-1948)
```

**Implementation**:
- Journal plugin calls librarian for citation resolution
- Librarian returns formatted citation + local link
- Citation recorded in `cited_by` field

**Success Criteria**:
- [ ] Citations in journal auto-resolved
- [ ] Formatted references appended
- [ ] Bidirectional links (journal ↔ library)

**Estimated Time**: 2 days

### 6.2 Archivist Cross-Reference

**Goal**: Link internal artifacts with external resources.

```yaml
# Example: Internal planning doc cites external paper
artifact:
  path: ".claude/planning/2025-12-20-information-architecture.md"
  type: "planning-document"
  external_references:
    - resource_id: "shannon-1948"
      citation_context: "Foundational work for entropy concepts"
    - resource_id: "turing-1936"
      citation_context: "Computability theory background"
```

**Success Criteria**:
- [ ] Archivist aware of external citations
- [ ] Librarian tracks which artifacts cite which resources
- [ ] Combined provenance graph

**Estimated Time**: 2 days

### 6.3 Knowledge Graph Export

**Goal**: Export citation graph to FalkorDB/Graphiti.

**Cypher Example**:
```cypher
// Create resource nodes
CREATE (s:Resource:Paper {
  id: "shannon-1948",
  title: "A Mathematical Theory of Communication",
  year: 1948
})

CREATE (t:Resource:Paper {
  id: "turing-1936",
  title: "On Computable Numbers",
  year: 1936
})

// Create citation edge
CREATE (s)-[:CITES {
  relationship: "builds_on",
  added: datetime()
}]->(t)

// Create session access edges
CREATE (session:Session {id: "2025-12-15-14-30"})
CREATE (session)-[:ACCESSED {
  timestamp: datetime(),
  agent: "librarian"
}]->(s)
```

**Success Criteria**:
- [ ] Can export entire library to graph DB
- [ ] Temporal edges track access history
- [ ] SPARQL/Cypher queries work

**Estimated Time**: 3 days

---

## Development Tools

### CLI Tool

```bash
# librarian - Main CLI interface
librarian add url https://example.com --topics "agent-dev"
librarian add paper --doi 10.1002/j.1538-7305.1948.tb01338.x
librarian add book --isbn 978-0-262-03384-8
librarian add film --title "Blade Runner" --year 1982

librarian search "information theory" --type paper --year 1940-1960
librarian show shannon-1948
librarian cite shannon-1948 journal-entry-2025-12-15

librarian export --format bibtex --output refs.bib
librarian stats
librarian verify --all
librarian deduplicate --dry-run
```

### Python API

```python
from library import Library

lib = Library()

# Add resources
paper = lib.add_paper(doi="10.1002/j.1538-7305.1948.tb01338.x")
book = lib.add_book(isbn="978-0-262-03384-8")

# Search
results = lib.search("information theory", filters={"type": "paper"})

# Citations
lib.add_citation(paper, cited_by="journal-entry-2025-12-15")

# Export
lib.export_bibtex("refs.bib")
```

---

## Testing Strategy

### Unit Tests
- Cache operations (store, retrieve, dedup)
- Schema validation
- Resource CRUD
- Citation tracking

### Integration Tests
- API integrations (CrossRef, arXiv, TMDb)
- Export formats (BibTeX, CSL-JSON)
- Search functionality

### End-to-End Tests
- Add paper → fetch metadata → cache PDF → export BibTeX
- Detect duplicate → link manifestations
- Citation tracking across sessions

---

## Maintenance Plan

### Daily
- Integrity checks (hash verification)
- Freshness policy enforcement (re-fetch stale URLs)
- Broken link detection

### Weekly
- Statistics update (top resources, citation trends)
- Duplicate detection scan
- Metadata enrichment (fetch missing abstracts, etc.)

### Monthly
- Archive old cache objects (if unreferenced for 6+ months)
- Authority control updates
- Schema version migrations

---

## Success Metrics

### Quantitative
- Resources catalogued: Target 500+ by Q2 2026
- Cache hit rate: >70%
- Deduplication ratio: Average 2+ manifestations per work
- API response time: <100ms for lookups

### Qualitative
- Agents use librarian before WebFetch
- Journal entries cite via librarian
- Zero duplicate fetches for known resources
- Rich metadata for >90% of resources

---

## Timeline Summary

| Phase | Duration | Priority | Key Deliverables |
|-------|----------|----------|------------------|
| Phase 1: Foundation | 2 weeks | Critical | Cache, schemas, CRUD API |
| Phase 2: Migration | 3 days | High | Existing URLs migrated, enriched |
| Phase 3: Academic | 1 week | High | DOI/arXiv integration, BibTeX export |
| Phase 4: Multimedia | 1.5 weeks | Medium | Books, films, images |
| Phase 5: Advanced | 2 weeks | Medium-Low | FRBR, authority control, viz |
| Phase 6: Integration | 1 week | High | Journal, archivist, KG export |

**Total: ~8 weeks for complete system**

**MVP (Phases 1-3): ~4 weeks**

---

## Next Immediate Actions

1. **Read design.md** for full architectural context
2. **Create Phase 1 branch**: `git checkout -b feature/library-foundation`
3. **Implement cache system** (2-3 days)
4. **Test with 10 URLs** from existing library
5. **Iterate on API design** based on real usage
6. **Share progress** in journal entries

---

*This roadmap will evolve. Version history in Git. Questions? Ask the librarian.*
