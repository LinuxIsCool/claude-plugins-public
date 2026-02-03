# PostgreSQL Vector Search with pgvector

## Purpose

pgvector brings vector similarity search to PostgreSQL, allowing you to combine vector search with the full power of SQL - transactions, joins, JSONB filtering, and existing infrastructure. This cookbook covers installation, indexing strategies, and production patterns.

## Variables

```yaml
PGVECTOR_VERSION: "0.6.0"
EMBEDDING_DIM: 384
EMBEDDING_DIM_LARGE: 1536
MAX_DIMENSIONS: 2000

# Index Parameters
IVFFLAT_LISTS: "sqrt(n)"        # Number of lists for IVF
IVFFLAT_PROBES: 10              # Lists to search
HNSW_M: 16                      # Connections per node
HNSW_EF_CONSTRUCTION: 64        # Build quality
```

## Instructions

### Installation

```sql
-- Enable the extension (requires superuser or extension create permission)
CREATE EXTENSION IF NOT EXISTS vector;

-- Verify installation
SELECT * FROM pg_extension WHERE extname = 'vector';
```

```bash
# For managed PostgreSQL (varies by provider):
# - Supabase: Enabled by default
# - AWS RDS: Available in RDS for PostgreSQL 15.2+
# - Azure: Available in Flexible Server
# - Neon: Enabled by default

# For self-hosted:
# Ubuntu/Debian
sudo apt install postgresql-15-pgvector

# macOS with Homebrew
brew install pgvector

# From source
git clone https://github.com/pgvector/pgvector.git
cd pgvector
make && sudo make install
```

### Python Client Setup

```bash
pip install psycopg2-binary pgvector sqlalchemy
```

## Code Examples

### Basic Table Schema

```sql
-- Create table with vector column
CREATE TABLE documents (
    id SERIAL PRIMARY KEY,
    content TEXT NOT NULL,
    embedding vector(384),  -- Match your embedding dimensions
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for fast search (choose one)
-- Option 1: IVFFlat - faster build, good for most cases
CREATE INDEX ON documents USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Option 2: HNSW - better recall, slower build
CREATE INDEX ON documents USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Create index on metadata for filtered queries
CREATE INDEX ON documents USING gin (metadata);

-- Create full-text search index
CREATE INDEX ON documents USING gin (to_tsvector('english', content));
```

### Distance Operators

```sql
-- pgvector supports three distance operators:

-- 1. L2 (Euclidean) distance: <->
SELECT *, embedding <-> '[0.1, 0.2, ...]' as distance
FROM documents
ORDER BY embedding <-> '[0.1, 0.2, ...]'
LIMIT 10;

-- 2. Cosine distance: <=>
-- (1 - cosine_similarity, so lower is more similar)
SELECT *, 1 - (embedding <=> '[0.1, 0.2, ...]') as similarity
FROM documents
ORDER BY embedding <=> '[0.1, 0.2, ...]'
LIMIT 10;

-- 3. Inner product: <#>
-- (negative inner product, so lower is more similar for normalized vectors)
SELECT *, (embedding <#> '[0.1, 0.2, ...]') * -1 as score
FROM documents
ORDER BY embedding <#> '[0.1, 0.2, ...]'
LIMIT 10;
```

### Python Integration with psycopg2

```python
"""
Direct PostgreSQL integration with psycopg2.
"""
import psycopg2
from psycopg2.extras import Json, execute_values
import numpy as np
from typing import List, Dict, Any, Optional


class PgVectorStore:
    """PostgreSQL vector store with pgvector."""

    def __init__(
        self,
        connection_string: str,
        table_name: str = "documents",
        dimension: int = 384
    ):
        self.connection_string = connection_string
        self.table_name = table_name
        self.dimension = dimension
        self._conn = None

    @property
    def conn(self):
        """Lazy connection with auto-reconnect."""
        if self._conn is None or self._conn.closed:
            self._conn = psycopg2.connect(self.connection_string)
            # Register vector type
            from pgvector.psycopg2 import register_vector
            register_vector(self._conn)
        return self._conn

    def create_table(self, index_type: str = "hnsw"):
        """Create table and indexes."""
        with self.conn.cursor() as cur:
            # Ensure extension exists
            cur.execute("CREATE EXTENSION IF NOT EXISTS vector")

            # Create table
            cur.execute(f"""
                CREATE TABLE IF NOT EXISTS {self.table_name} (
                    id TEXT PRIMARY KEY,
                    content TEXT NOT NULL,
                    embedding vector({self.dimension}),
                    metadata JSONB DEFAULT '{{}}',
                    created_at TIMESTAMPTZ DEFAULT NOW()
                )
            """)

            # Create vector index
            if index_type == "hnsw":
                cur.execute(f"""
                    CREATE INDEX IF NOT EXISTS {self.table_name}_embedding_idx
                    ON {self.table_name}
                    USING hnsw (embedding vector_cosine_ops)
                    WITH (m = 16, ef_construction = 64)
                """)
            elif index_type == "ivfflat":
                cur.execute(f"""
                    CREATE INDEX IF NOT EXISTS {self.table_name}_embedding_idx
                    ON {self.table_name}
                    USING ivfflat (embedding vector_cosine_ops)
                    WITH (lists = 100)
                """)

            # Create metadata index
            cur.execute(f"""
                CREATE INDEX IF NOT EXISTS {self.table_name}_metadata_idx
                ON {self.table_name}
                USING gin (metadata)
            """)

            self.conn.commit()

    def add(
        self,
        ids: List[str],
        contents: List[str],
        embeddings: List[List[float]],
        metadatas: List[Dict] = None
    ):
        """Add documents with embeddings."""
        if metadatas is None:
            metadatas = [{} for _ in ids]

        with self.conn.cursor() as cur:
            data = [
                (id_, content, embedding, Json(metadata))
                for id_, content, embedding, metadata
                in zip(ids, contents, embeddings, metadatas)
            ]

            execute_values(
                cur,
                f"""
                INSERT INTO {self.table_name} (id, content, embedding, metadata)
                VALUES %s
                ON CONFLICT (id) DO UPDATE SET
                    content = EXCLUDED.content,
                    embedding = EXCLUDED.embedding,
                    metadata = EXCLUDED.metadata
                """,
                data,
                template="(%s, %s, %s::vector, %s)"
            )

            self.conn.commit()

    def search(
        self,
        embedding: List[float],
        k: int = 10,
        filter: Dict = None,
        include_content: bool = True
    ) -> List[Dict]:
        """Search for similar documents."""
        with self.conn.cursor() as cur:
            # Build filter clause
            filter_clause = ""
            filter_params = []

            if filter:
                conditions = []
                for key, value in filter.items():
                    if isinstance(value, dict):
                        # Handle operators like {"$gt": 5}
                        for op, val in value.items():
                            if op == "$gt":
                                conditions.append(f"(metadata->>%s)::numeric > %s")
                            elif op == "$gte":
                                conditions.append(f"(metadata->>%s)::numeric >= %s")
                            elif op == "$lt":
                                conditions.append(f"(metadata->>%s)::numeric < %s")
                            elif op == "$lte":
                                conditions.append(f"(metadata->>%s)::numeric <= %s")
                            elif op == "$ne":
                                conditions.append(f"metadata->>%s != %s")
                            elif op == "$in":
                                conditions.append(f"metadata->>%s = ANY(%s)")
                            filter_params.extend([key, val])
                    else:
                        conditions.append(f"metadata->>%s = %s")
                        filter_params.extend([key, str(value)])

                if conditions:
                    filter_clause = "WHERE " + " AND ".join(conditions)

            # Build query
            columns = "id, metadata, 1 - (embedding <=> %s::vector) as similarity"
            if include_content:
                columns = "id, content, metadata, 1 - (embedding <=> %s::vector) as similarity"

            query = f"""
                SELECT {columns}
                FROM {self.table_name}
                {filter_clause}
                ORDER BY embedding <=> %s::vector
                LIMIT %s
            """

            params = [embedding] + filter_params + [embedding, k]
            cur.execute(query, params)

            results = []
            for row in cur.fetchall():
                if include_content:
                    results.append({
                        "id": row[0],
                        "content": row[1],
                        "metadata": row[2],
                        "similarity": float(row[3])
                    })
                else:
                    results.append({
                        "id": row[0],
                        "metadata": row[1],
                        "similarity": float(row[2])
                    })

            return results

    def delete(self, ids: List[str]):
        """Delete documents by ID."""
        with self.conn.cursor() as cur:
            cur.execute(
                f"DELETE FROM {self.table_name} WHERE id = ANY(%s)",
                (ids,)
            )
            self.conn.commit()

    def close(self):
        """Close database connection."""
        if self._conn:
            self._conn.close()
            self._conn = None


# Usage
store = PgVectorStore(
    connection_string="postgresql://user:pass@localhost:5432/mydb",
    dimension=384
)
store.create_table(index_type="hnsw")

# Add documents
store.add(
    ids=["doc1", "doc2"],
    contents=["First document", "Second document"],
    embeddings=[[0.1] * 384, [0.2] * 384],
    metadatas=[{"source": "web"}, {"source": "file"}]
)

# Search
results = store.search(
    embedding=[0.15] * 384,
    k=5,
    filter={"source": "web"}
)
```

### SQLAlchemy Integration

```python
"""
SQLAlchemy ORM integration with pgvector.
"""
from sqlalchemy import create_engine, Column, String, Text, DateTime, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import declarative_base, sessionmaker
from pgvector.sqlalchemy import Vector
from datetime import datetime
from typing import List, Dict, Any


Base = declarative_base()


class Document(Base):
    """Document model with vector embedding."""

    __tablename__ = "documents"

    id = Column(String, primary_key=True)
    content = Column(Text, nullable=False)
    embedding = Column(Vector(384))
    metadata = Column(JSONB, default={})
    created_at = Column(DateTime, default=datetime.utcnow)

    def to_dict(self) -> Dict:
        return {
            "id": self.id,
            "content": self.content,
            "metadata": self.metadata,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }


class SQLAlchemyVectorStore:
    """Vector store using SQLAlchemy ORM."""

    def __init__(self, connection_string: str):
        self.engine = create_engine(connection_string)
        self.Session = sessionmaker(bind=self.engine)

        # Create tables
        Base.metadata.create_all(self.engine)

        # Create indexes
        self._create_indexes()

    def _create_indexes(self):
        """Create vector and metadata indexes."""
        with self.engine.connect() as conn:
            conn.execute("""
                CREATE INDEX IF NOT EXISTS documents_embedding_idx
                ON documents
                USING hnsw (embedding vector_cosine_ops)
            """)
            conn.execute("""
                CREATE INDEX IF NOT EXISTS documents_metadata_idx
                ON documents
                USING gin (metadata)
            """)
            conn.commit()

    def add(self, documents: List[Document]):
        """Add documents to the store."""
        with self.Session() as session:
            for doc in documents:
                session.merge(doc)  # Upsert
            session.commit()

    def search(
        self,
        embedding: List[float],
        k: int = 10,
        metadata_filter: Dict = None
    ) -> List[Dict]:
        """Search for similar documents."""
        with self.Session() as session:
            # Base query with similarity
            query = session.query(
                Document,
                (1 - Document.embedding.cosine_distance(embedding)).label("similarity")
            )

            # Apply metadata filters
            if metadata_filter:
                for key, value in metadata_filter.items():
                    query = query.filter(
                        Document.metadata[key].astext == str(value)
                    )

            # Order by similarity and limit
            results = (
                query
                .order_by(Document.embedding.cosine_distance(embedding))
                .limit(k)
                .all()
            )

            return [
                {**doc.to_dict(), "similarity": float(sim)}
                for doc, sim in results
            ]


# Usage
store = SQLAlchemyVectorStore("postgresql://user:pass@localhost:5432/mydb")

# Add documents
docs = [
    Document(
        id="doc1",
        content="First document",
        embedding=[0.1] * 384,
        metadata={"source": "web"}
    ),
    Document(
        id="doc2",
        content="Second document",
        embedding=[0.2] * 384,
        metadata={"source": "file"}
    )
]
store.add(docs)

# Search
results = store.search(
    embedding=[0.15] * 384,
    k=5,
    metadata_filter={"source": "web"}
)
```

### Advanced Queries

```sql
-- Hybrid search: vector + full-text
WITH vector_results AS (
    SELECT id, content, metadata,
           1 - (embedding <=> $1::vector) as vector_score
    FROM documents
    ORDER BY embedding <=> $1::vector
    LIMIT 20
),
fts_results AS (
    SELECT id, content, metadata,
           ts_rank(to_tsvector('english', content), plainto_tsquery('english', $2)) as fts_score
    FROM documents
    WHERE to_tsvector('english', content) @@ plainto_tsquery('english', $2)
    LIMIT 20
)
SELECT
    COALESCE(v.id, f.id) as id,
    COALESCE(v.content, f.content) as content,
    COALESCE(v.metadata, f.metadata) as metadata,
    COALESCE(v.vector_score, 0) * 0.7 + COALESCE(f.fts_score, 0) * 0.3 as combined_score
FROM vector_results v
FULL OUTER JOIN fts_results f ON v.id = f.id
ORDER BY combined_score DESC
LIMIT 10;

-- Time-bounded search
SELECT *, 1 - (embedding <=> $1::vector) as similarity
FROM documents
WHERE created_at > NOW() - INTERVAL '7 days'
  AND metadata->>'source' = 'chat'
ORDER BY embedding <=> $1::vector
LIMIT 10;

-- Search with distance threshold
SELECT *, 1 - (embedding <=> $1::vector) as similarity
FROM documents
WHERE (embedding <=> $1::vector) < 0.3  -- Max cosine distance
ORDER BY embedding <=> $1::vector
LIMIT 10;

-- Batch search (multiple queries)
SELECT DISTINCT ON (query_id)
    q.query_id,
    d.id,
    d.content,
    1 - (d.embedding <=> q.embedding) as similarity
FROM (
    SELECT 1 as query_id, $1::vector as embedding
    UNION ALL
    SELECT 2 as query_id, $2::vector as embedding
    UNION ALL
    SELECT 3 as query_id, $3::vector as embedding
) q
CROSS JOIN LATERAL (
    SELECT id, content, embedding
    FROM documents
    ORDER BY embedding <=> q.embedding
    LIMIT 5
) d
ORDER BY query_id, similarity DESC;

-- Aggregated similarity for document clusters
SELECT
    metadata->>'topic' as topic,
    COUNT(*) as doc_count,
    AVG(1 - (embedding <=> $1::vector)) as avg_similarity,
    MAX(1 - (embedding <=> $1::vector)) as max_similarity
FROM documents
GROUP BY metadata->>'topic'
HAVING AVG(1 - (embedding <=> $1::vector)) > 0.5
ORDER BY avg_similarity DESC;
```

### Index Maintenance

```sql
-- Check index size and usage
SELECT
    indexrelname as index_name,
    pg_size_pretty(pg_relation_size(indexrelid)) as size,
    idx_scan as index_scans
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
AND tablename = 'documents';

-- Rebuild index after many updates/deletes
REINDEX INDEX CONCURRENTLY documents_embedding_idx;

-- Analyze table for query planner
ANALYZE documents;

-- Set HNSW search parameter for session
SET hnsw.ef_search = 100;  -- Higher = better recall

-- Set IVFFlat probes for session
SET ivfflat.probes = 20;  -- Higher = better recall
```

## Performance Characteristics

### Index Comparison (1M vectors, 384 dimensions)

| Index | Build Time | Query Time | Memory | Recall@10 |
|-------|------------|------------|--------|-----------|
| No index | N/A | 800ms | ~1.5GB | 100% |
| IVFFlat (lists=1000) | 2min | 5ms | ~1.6GB | 90% |
| HNSW (m=16) | 15min | 1ms | ~2.5GB | 98% |

### Scaling Guidelines

```
Dataset Size        Index Recommendation        Notes
------------        --------------------        -----
< 100K              IVFFlat (lists=100)         Fast build, good recall
100K - 1M           IVFFlat (lists=1000)        Balance build/query
100K - 1M           HNSW (m=16)                 Best recall, slower build
> 1M                Partitioned + IVFFlat       Horizontal scaling
```

### Query Performance Tips

```sql
-- 1. Use covering indexes for filtered queries
CREATE INDEX ON documents (metadata->>'source', embedding vector_cosine_ops)
WHERE metadata->>'source' IS NOT NULL;

-- 2. Partial indexes for common filters
CREATE INDEX ON documents USING hnsw (embedding vector_cosine_ops)
WHERE metadata->>'active' = 'true';

-- 3. Use EXPLAIN ANALYZE to verify index usage
EXPLAIN ANALYZE
SELECT * FROM documents
ORDER BY embedding <=> '[0.1, 0.2, ...]'::vector
LIMIT 10;

-- Look for "Index Scan using documents_embedding_idx" in output
```

## When to Use This Pattern

**pgvector excels at:**
- Existing PostgreSQL infrastructure
- Need for ACID transactions
- Complex queries with JOINs
- Hybrid search (vector + metadata + full-text)
- When you need a single database for everything

**Consider alternatives when:**
- Pure vector search at massive scale (use FAISS or Milvus)
- Need real-time index updates (pgvector reindex can be slow)
- Limited PostgreSQL expertise (ChromaDB is simpler)
- Need horizontal scaling beyond single node (use Qdrant cluster)

## Production Deployment

### Connection Pooling

```python
from sqlalchemy import create_engine
from sqlalchemy.pool import QueuePool

engine = create_engine(
    "postgresql://user:pass@localhost:5432/mydb",
    poolclass=QueuePool,
    pool_size=5,
    max_overflow=10,
    pool_timeout=30,
    pool_recycle=1800
)
```

### Monitoring Queries

```sql
-- Find slow vector queries
SELECT
    query,
    calls,
    mean_exec_time,
    total_exec_time
FROM pg_stat_statements
WHERE query LIKE '%<=>%' OR query LIKE '%<->%'
ORDER BY total_exec_time DESC
LIMIT 10;

-- Enable pg_stat_statements if not already
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
```

## Related Cookbooks

- `quickstart.md` - Getting started basics
- `hybrid-search.md` - Combining vector + full-text
- `metadata-filtering.md` - Advanced filter patterns
- `index-tuning.md` - Optimizing HNSW/IVF parameters
