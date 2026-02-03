# Ecosystem Skill Discovery

Finding and analyzing skills across GitHub and registries.

## Discovery Sources

### 1. BuildWithClaude Registry
- **URL**: https://www.buildwithclaude.com/skills
- **Content**: Curated community skills
- **Access**: Web interface, no API

### 2. BuildWithClaude Plugins
- **URL**: https://www.buildwithclaude.com/plugins
- **Content**: 6,800+ plugins with skills
- **Access**: Web interface

### 3. GitHub Repositories

**High-Value Repositories:**

| Repository | Content |
|------------|---------|
| `disler/fork-repository-skill` | Fork terminal pattern |
| `disler/claude-code-hooks-multi-agent-observability` | Hooks + observability |
| `jeremylongshore/claude-code-plugins-plus-skills` | 270+ plugins, 739 skills |
| `anthropics/skills` | Official examples (if available) |

### 4. GitHub Search Patterns

```bash
# Search for skill repositories
gh search repos "claude skill" --json name,url,description

# Search for SKILL.md files
gh search code "filename:SKILL.md" --json path,repository

# Search for claude/skills directories
gh search code "path:.claude/skills" --json path,repository
```

## Discovery Workflow

### Step 1: Identify Sources

1. Check BuildWithClaude registry for curated skills
2. Search GitHub for `filename:SKILL.md`
3. Explore known plugin repositories
4. Check community Discord/forums

### Step 2: Evaluate Quality

**Quality Signals:**

| Signal | Good | Bad |
|--------|------|-----|
| Description | Specific, includes triggers | Vague, generic |
| Examples | 2-3 concrete with I/O | None or abstract |
| Structure | Clear sections | Wall of text |
| Maintenance | Recent updates | Years stale |
| Stars/Usage | Active community | No activity |

### Step 3: Clone and Analyze

```bash
# Shallow clone for analysis
git clone --depth 1 https://github.com/user/repo.git

# Find all skills
find . -name "SKILL.md" -type f

# Analyze skill structure
for skill in $(find . -name "SKILL.md"); do
    echo "=== $skill ==="
    head -30 "$skill"
done
```

### Step 4: Catalog Patterns

Document notable patterns:
- Directory structure
- Frontmatter fields used
- Instruction organization
- Resource organization

## GitHub Search Techniques

### Find Skills by Capability

```bash
# PDF processing skills
gh search code "pdf" filename:SKILL.md --json path,repository

# Code review skills
gh search code "code review" filename:SKILL.md --json path,repository

# Git-related skills
gh search code "git commit" filename:SKILL.md --json path,repository
```

### Find by Structure

```bash
# Skills with scripts
gh search code "scripts/" path:.claude/skills --json path,repository

# Skills with cookbook
gh search code "cookbook/" path:.claude/skills --json path,repository

# Skills with allowed-tools
gh search code "allowed-tools:" filename:SKILL.md --json path,repository
```

### Find Plugin Skills

```bash
# Plugin skill directories
gh search code "skills/" path:plugins --json path,repository

# Plugin manifests
gh search code "skills" filename:plugin.json --json path,repository
```

## Cataloging Skills

### Database Schema

```sql
CREATE TABLE skills (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    source_url TEXT,
    source_type TEXT,  -- 'github', 'buildwithclaude', 'local'
    repository TEXT,
    path TEXT,
    version TEXT,
    indexed_at TEXT,
    content_hash TEXT
);

CREATE TABLE skill_relationships (
    from_skill TEXT,
    to_skill TEXT,
    relationship TEXT,  -- 'requires', 'extends', 'complements'
    PRIMARY KEY (from_skill, to_skill, relationship)
);
```

### Indexing Process

1. **Fetch**: Clone repo or fetch skill file
2. **Parse**: Extract frontmatter and content
3. **Hash**: Generate content hash for deduplication
4. **Store**: Insert into catalog database
5. **Analyze**: Extract relationships and keywords

## Deduplication

### Exact Match
```python
def content_hash(skill_content):
    normalized = skill_content.lower().strip()
    return hashlib.sha256(normalized.encode()).hexdigest()
```

### Semantic Similarity
For near-duplicates, use embeddings:
1. Embed skill descriptions
2. Compute cosine similarity
3. Flag pairs above 0.95 threshold
4. Manual review for confirmation

## Building a Skill Index

### Requirements

1. **Crawl** repositories and registries
2. **Parse** SKILL.md files
3. **Store** in searchable database
4. **Update** periodically

### Implementation Options

**Option A: SQLite + FTS5**
- Simple, single-file database
- Full-text search built in
- Good for <10,000 skills

**Option B: PostgreSQL + pgvector**
- Scalable for large collections
- Vector similarity search
- Good for semantic discovery

### Search Interface

```python
def search_skills(query: str, filters: dict = None):
    """Search skill catalog."""
    # FTS5 keyword search
    keyword_results = db.execute("""
        SELECT * FROM skills_fts
        WHERE skills_fts MATCH ?
        LIMIT 20
    """, [query])

    # Optional: semantic search
    embedding = embed(query)
    semantic_results = vector_search(embedding, k=20)

    # Combine with RRF
    return fuse_results(keyword_results, semantic_results)
```

## Ecosystem Metrics

Track ecosystem health:

- **Total skills**: Count across all sources
- **Active repositories**: Repos with recent updates
- **Category distribution**: Skills by type
- **Quality scores**: Based on structure/examples
- **Relationship density**: How interconnected

## Resources

- **GitHub CLI**: https://cli.github.com/
- **BuildWithClaude**: https://buildwithclaude.com
- **Skill Standards**: `subskills/community-patterns.md`
