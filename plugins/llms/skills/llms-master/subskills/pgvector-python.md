---
name: pgvector-python
description: Master pgvector-python for vector operations in Python with Django, SQLAlchemy, SQLModel, Psycopg, asyncpg, and Peewee. Use when integrating pgvector with Python applications, building RAG systems, or implementing semantic search with ORMs.
allowed-tools: Read, Glob, Grep, Bash
---

# pgvector-python Mastery

Python client for pgvector with ORM support.

## Territory Map

```
resources/embeddings/pgvector-python/
├── pgvector/
│   ├── django/          # Django ORM integration
│   ├── sqlalchemy/      # SQLAlchemy integration
│   ├── psycopg/         # Psycopg 3 driver
│   ├── psycopg2/        # Psycopg 2 driver
│   ├── asyncpg/         # Async driver
│   ├── pg8000/          # Pure Python driver
│   └── peewee/          # Peewee ORM
└── tests/               # Test suites for each ORM
```

## Supported Frameworks

| Framework | Vector Types | Distance Functions | Indexes |
|-----------|--------------|-------------------|---------|
| Django | VectorField, HalfVectorField, BitField, SparseVectorField | L2, Cosine, IP, L1, Hamming, Jaccard | HnswIndex, IvfflatIndex |
| SQLAlchemy | VECTOR, HALFVEC, BIT, SPARSEVEC | Column methods | Index with postgresql_using |
| SQLModel | Same as SQLAlchemy | Same as SQLAlchemy | Same as SQLAlchemy |
| Psycopg 3 | register_vector() | Operators in SQL | SQL-based |
| asyncpg | register_vector() | Operators in SQL | SQL-based |
| Peewee | VectorField, etc. | Field methods | SQL-based |

## Django Integration

### Setup
```python
# migration
from pgvector.django import VectorExtension

class Migration(migrations.Migration):
    operations = [VectorExtension()]

# model
from pgvector.django import VectorField, HalfVectorField

class Document(models.Model):
    content = models.TextField()
    embedding = VectorField(dimensions=1536)
```

### Queries
```python
from pgvector.django import L2Distance, CosineDistance

# Nearest neighbors
Document.objects.order_by(
    L2Distance('embedding', query_embedding)
)[:5]

# With annotation
Document.objects.annotate(
    distance=CosineDistance('embedding', query_embedding)
).order_by('distance')[:5]
```

### Indexes
```python
from pgvector.django import HnswIndex

class Document(models.Model):
    embedding = VectorField(dimensions=1536)

    class Meta:
        indexes = [
            HnswIndex(
                name='embedding_hnsw',
                fields=['embedding'],
                m=16,
                ef_construction=64,
                opclasses=['vector_cosine_ops']
            )
        ]
```

## SQLAlchemy Integration

### Setup
```python
from pgvector.sqlalchemy import VECTOR, HALFVEC

class Document(Base):
    __tablename__ = 'documents'
    id = Column(Integer, primary_key=True)
    embedding = mapped_column(VECTOR(1536))
```

### Queries
```python
from sqlalchemy import select

# Nearest neighbors
session.scalars(
    select(Document)
    .order_by(Document.embedding.cosine_distance(query_embedding))
    .limit(5)
)

# With distance threshold
session.scalars(
    select(Document)
    .where(Document.embedding.cosine_distance(query_embedding) < 0.5)
)
```

### Indexes
```python
from sqlalchemy import Index

index = Index(
    'embedding_hnsw',
    Document.embedding,
    postgresql_using='hnsw',
    postgresql_with={'m': 16, 'ef_construction': 64},
    postgresql_ops={'embedding': 'vector_cosine_ops'}
)
index.create(engine)
```

## Psycopg 3 (Direct Driver)

### Setup
```python
import psycopg
from pgvector.psycopg import register_vector

conn = psycopg.connect('dbname=mydb')
conn.execute('CREATE EXTENSION IF NOT EXISTS vector')
register_vector(conn)
```

### Queries
```python
import numpy as np

embedding = np.array([0.1, 0.2, ...])

# Insert
conn.execute(
    'INSERT INTO documents (embedding) VALUES (%s)',
    (embedding,)
)

# Query
results = conn.execute(
    'SELECT * FROM documents ORDER BY embedding <=> %s LIMIT 5',
    (embedding,)
).fetchall()
```

### Bulk Loading (COPY)
```python
cur = conn.cursor()
with cur.copy('COPY documents (embedding) FROM STDIN WITH (FORMAT BINARY)') as copy:
    copy.set_types(['vector'])
    for embedding in embeddings:
        copy.write_row([embedding])
```

## asyncpg (Async Driver)

```python
import asyncpg
from pgvector.asyncpg import register_vector

conn = await asyncpg.connect('postgresql://localhost/mydb')
await conn.execute('CREATE EXTENSION IF NOT EXISTS vector')
await register_vector(conn)

# Query
results = await conn.fetch(
    'SELECT * FROM documents ORDER BY embedding <=> $1 LIMIT 5',
    embedding
)
```

## Hybrid Search (RRF Pattern)

```python
sql = """
WITH semantic AS (
    SELECT id, RANK() OVER (ORDER BY embedding <=> %(emb)s) AS rank
    FROM documents
    ORDER BY embedding <=> %(emb)s
    LIMIT 20
),
keyword AS (
    SELECT id, RANK() OVER (ORDER BY ts_rank_cd(tsv, query) DESC) AS rank
    FROM documents, plainto_tsquery('english', %(q)s) query
    WHERE tsv @@ query
    LIMIT 20
)
SELECT COALESCE(s.id, k.id) AS id,
    COALESCE(1.0/(60+s.rank), 0) + COALESCE(1.0/(60+k.rank), 0) AS score
FROM semantic s
FULL OUTER JOIN keyword k ON s.id = k.id
ORDER BY score DESC
LIMIT 5
"""

results = conn.execute(sql, {'emb': embedding, 'q': query}).fetchall()
```

## Distance Functions

| ORM | L2 | Cosine | Inner Product | L1 |
|-----|-----|--------|---------------|-----|
| Django | L2Distance | CosineDistance | MaxInnerProduct | L1Distance |
| SQLAlchemy | .l2_distance() | .cosine_distance() | .max_inner_product() | .l1_distance() |
| SQL | `<->` | `<=>` | `<#>` | `<+>` |

## Best Practices

### Performance
```python
# Bulk load before indexing
# 1. COPY data
# 2. Create index after loading

conn.execute("SET maintenance_work_mem = '8GB'")
conn.execute('CREATE INDEX ON documents USING hnsw (embedding vector_cosine_ops)')
conn.execute('ANALYZE documents')
```

### Text Preprocessing
```python
# Always normalize text before embedding
text = text.replace("\n", " ")
```

### Batch Embedding
```python
# Embed in batches of 2048 max
embeddings = model.encode(texts[:2048])
```

## When to Use pgvector-python

- Python applications with PostgreSQL
- Django/FastAPI/Flask with vector search
- Existing ORM-based applications
- Production RAG systems
- Hybrid search (semantic + keyword)

## Reference Files

- Django: `pgvector/django/`
- SQLAlchemy: `pgvector/sqlalchemy/`
- Psycopg 3: `pgvector/psycopg/`
- asyncpg: `pgvector/asyncpg/`
