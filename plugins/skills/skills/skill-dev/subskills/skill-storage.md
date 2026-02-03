# Skill Storage Infrastructure

SQLite + FTS5 storage with optional embeddings for skill cataloguing and search.

## Components

### skill_store.py

Core storage module with:
- SQLite database with WAL mode
- FTS5 full-text search
- Skill relationship tracking
- Content deduplication via SHA-256

```python
from skill_store import SkillStore, Skill

store = SkillStore("skills.db")

# Index a skill
skill = Skill(
    name="pdf-processor",
    description="Processes PDF files to extract text",
    source_type="local",
    content="..."
)
store.index_skill(skill)

# Search
results = store.search("pdf processing")
for skill in results:
    print(f"{skill.name}: {skill.description}")

# Relationships
from skill_store import SkillRelationship
store.add_relationship(SkillRelationship(
    from_skill="advanced-pdf",
    to_skill="pdf-processor",
    relationship="extends"
))
```

### skill_embeddings.py

Semantic search via Ollama embeddings:
- nomic-embed-text (768 dimensions)
- Cosine similarity search
- Hybrid search with RRF fusion

```python
from skill_embeddings import SkillEmbeddings

embeddings = SkillEmbeddings(store)

# Generate embeddings
embeddings.embed_all()

# Semantic search
results = embeddings.semantic_search("extract text from documents")
for skill, score in results:
    print(f"{score:.3f} {skill.name}")

# Hybrid search (FTS5 + embeddings)
results = embeddings.hybrid_search("process PDF files")
```

### skill_crawler.py

Discovery and indexing:
- Local directory crawling
- GitHub repository indexing
- GitHub search integration (via gh CLI)

```python
from skill_crawler import SkillCrawler

crawler = SkillCrawler(store)

# Crawl local skills
stats = crawler.crawl_directory("/project/.claude/skills")

# Crawl cloned repo
stats = crawler.crawl_repository(
    "/tmp/repos/user-repo",
    "https://github.com/user/repo"
)

# GitHub search
stats = crawler.crawl_github_search("filename:SKILL.md")
```

## Database Schema

### skills table
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | Primary key |
| name | TEXT | Unique skill name |
| description | TEXT | Skill description |
| source_url | TEXT | Origin URL |
| source_type | TEXT | local/github/buildwithclaude |
| repository | TEXT | GitHub repo if applicable |
| path | TEXT | Path within source |
| version | TEXT | Semver version |
| content | TEXT | Full SKILL.md content |
| content_hash | TEXT | SHA-256 for deduplication |
| indexed_at | TEXT | ISO timestamp |
| allowed_tools | TEXT | JSON array |
| model | TEXT | Preferred model |
| user_invocable | INTEGER | Boolean flag |
| tags | TEXT | JSON array |
| author | TEXT | Author name |
| license | TEXT | License identifier |

### skills_fts table (FTS5)
Virtual table indexing name, description, content, tags for full-text search.

### skill_relationships table
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | Primary key |
| from_skill | TEXT | Source skill name |
| to_skill | TEXT | Target skill name |
| relationship | TEXT | requires/extends/complements/conflicts_with/part_of |

### skill_embeddings table
| Column | Type | Description |
|--------|------|-------------|
| skill_name | TEXT | Primary key |
| embedding | BLOB | Packed float array |
| model | TEXT | Embedding model used |
| created_at | TEXT | ISO timestamp |

## CLI Usage

```bash
# Index local directory
python skill_store.py index /path/to/SKILL.md

# Search skills
python skill_store.py search "pdf processing"

# List all skills
python skill_store.py list

# Get stats
python skill_store.py stats

# Generate embeddings (requires Ollama)
python skill_embeddings.py embed-all

# Semantic search
python skill_embeddings.py search "extract text"

# Hybrid search
python skill_embeddings.py hybrid "document processing"

# Find similar skills
python skill_embeddings.py similar pdf-processor

# Crawl directory
python skill_crawler.py crawl /path/to/project

# Crawl GitHub repo
python skill_crawler.py repo /path/to/clone https://github.com/user/repo

# Search GitHub
python skill_crawler.py github "filename:SKILL.md"
```

## Requirements

**Core (no external dependencies):**
- Python 3.10+
- sqlite3 (stdlib)

**For embeddings:**
- Ollama running locally (`ollama serve`)
- nomic-embed-text model (`ollama pull nomic-embed-text`)

**For GitHub crawling:**
- gh CLI (`https://cli.github.com/`)
- GitHub authentication (`gh auth login`)

## Location

Storage files are in:
```
plugins/skills/lib/
├── skill_store.py      # Core storage
├── skill_embeddings.py # Semantic search
└── skill_crawler.py    # Discovery
```

Database default location: `skills.db` in current directory.
