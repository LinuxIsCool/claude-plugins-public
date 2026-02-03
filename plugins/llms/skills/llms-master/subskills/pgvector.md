---
name: pgvector
description: Master pgvector for vector similarity search in PostgreSQL. Use when storing embeddings, semantic search, recommendation systems, or hybrid search combining vectors with SQL. Supports HNSW and IVFFlat indexes with multiple distance metrics.
allowed-tools: Read, Glob, Grep, Bash
---

# pgvector Mastery

Vector similarity search for PostgreSQL.

## Territory Map

```
resources/embeddings/pgvector/
├── src/                     # C extension source
├── sql/                     # SQL definitions
└── test/                    # Test suites
```

## Core Capabilities

- **ACID compliant** vector storage with PostgreSQL
- **Multiple vector types**: vector, halfvec, bit, sparsevec
- **Distance metrics**: L2, cosine, inner product, L1, Hamming, Jaccard
- **Index types**: HNSW (better recall), IVFFlat (faster build)
- **Full SQL integration**: JOINs, aggregations, filtering

## Vector Types

| Type | Storage | Max Dims | Use Case |
|------|---------|----------|----------|
| `vector` | 4 bytes/elem | 16,000 | General embeddings |
| `halfvec` | 2 bytes/elem | 4,000 | Memory optimization |
| `bit` | 1 bit/elem | 64,000 | Binary quantization |
| `sparsevec` | Non-zero only | unlimited | Sparse embeddings |

## Distance Operators

| Metric | Operator | Function |
|--------|----------|----------|
| L2 (Euclidean) | `<->` | `l2_distance()` |
| Cosine | `<=>` | `cosine_distance()` |
| Inner Product | `<#>` | `inner_product()` * -1 |
| L1 (Manhattan) | `<+>` | `l1_distance()` |
| Hamming | `<~>` | `hamming_distance()` |
| Jaccard | `<%>` | `jaccard_distance()` |

## Beginner Techniques

### Setup
```sql
CREATE EXTENSION vector;

CREATE TABLE documents (
  id SERIAL PRIMARY KEY,
  content TEXT,
  embedding vector(1536)
);
```

### Basic Operations
```sql
-- Insert
INSERT INTO documents (content, embedding)
VALUES ('Hello world', '[0.1, 0.2, ..., 0.5]');

-- Nearest neighbors (L2)
SELECT id, content
FROM documents
ORDER BY embedding <-> '[0.1, 0.2, ..., 0.5]'
LIMIT 5;

-- Cosine similarity
SELECT id, content,
       1 - (embedding <=> '[...]'::vector) AS similarity
FROM documents
ORDER BY similarity DESC
LIMIT 5;
```

### Create Index
```sql
-- HNSW (recommended)
CREATE INDEX ON documents USING hnsw (embedding vector_l2_ops);

-- IVFFlat (faster build)
CREATE INDEX ON documents USING ivfflat (embedding vector_l2_ops)
WITH (lists = 100);
```

## Intermediate Techniques

### Index Tuning
```sql
-- HNSW parameters
CREATE INDEX ON documents USING hnsw (embedding vector_cosine_ops)
WITH (m = 32, ef_construction = 128);

-- Query tuning
SET hnsw.ef_search = 100;  -- Higher = better recall
```

### Filtering with Index
```sql
-- Simple filter
SELECT * FROM documents
WHERE category_id = 123
ORDER BY embedding <-> '[...]'
LIMIT 5;

-- Iterative scan for filtered queries
SET hnsw.iterative_scan = relaxed_order;
```

### Half-Precision Vectors
```sql
-- 50% memory savings
CREATE TABLE docs_half (
  id SERIAL PRIMARY KEY,
  embedding halfvec(1536)
);

-- Cast between types
SELECT embedding::halfvec FROM documents;
```

## Advanced Techniques

### Hybrid Search (Vector + Full-Text)
```sql
WITH semantic AS (
  SELECT id, RANK() OVER (ORDER BY embedding <=> $1) AS rank
  FROM documents
  ORDER BY embedding <=> $1
  LIMIT 20
),
keyword AS (
  SELECT id, RANK() OVER (ORDER BY ts_rank_cd(tsv, query) DESC) AS rank
  FROM documents, plainto_tsquery('english', $2) query
  WHERE tsv @@ query
  LIMIT 20
)
SELECT COALESCE(s.id, k.id) AS id,
  COALESCE(1.0/(60+s.rank), 0) + COALESCE(1.0/(60+k.rank), 0) AS score
FROM semantic s
FULL OUTER JOIN keyword k ON s.id = k.id
ORDER BY score DESC
LIMIT 5;
```

### Binary Quantization
```sql
-- Index with binary quantization
CREATE INDEX ON documents USING hnsw (
  (binary_quantize(embedding)::bit(1536)) bit_hamming_ops
);

-- Query: fast candidate retrieval, then re-rank
SELECT * FROM (
  SELECT * FROM documents
  ORDER BY binary_quantize(embedding)::bit(1536) <~>
           binary_quantize('[...]'::vector)::bit(1536)
  LIMIT 20
)
ORDER BY embedding <=> '[...]'
LIMIT 5;
```

### Sparse Vectors
```sql
CREATE TABLE sparse_docs (
  id SERIAL PRIMARY KEY,
  embedding sparsevec(10000)
);

-- Format: {index:value,...}/dimensions
INSERT INTO sparse_docs VALUES
  (1, '{1:0.5,100:0.3,5000:0.2}/10000');
```

### Performance Optimization
```sql
-- Bulk loading
SET maintenance_work_mem = '8GB';
SET max_parallel_maintenance_workers = 7;

-- Create index AFTER loading data
CREATE INDEX CONCURRENTLY ON documents
USING hnsw (embedding vector_cosine_ops);

ANALYZE documents;
```

## Vector Operations

```sql
-- Arithmetic
SELECT '[1,2,3]'::vector + '[4,5,6]'::vector;  -- [5,7,9]
SELECT '[4,5,6]'::vector - '[1,2,3]'::vector;  -- [3,3,3]

-- Concatenation
SELECT '[1,2]'::vector || '[3,4]'::vector;     -- [1,2,3,4]

-- Normalization
SELECT l2_normalize(embedding) FROM documents;

-- Subvector
SELECT subvector(embedding, 1, 100) FROM documents;

-- Aggregation
SELECT AVG(embedding) FROM documents WHERE category = 'tech';
```

## Index Operator Classes

| Vector Type | L2 | Cosine | Inner Product | L1 |
|-------------|-----|--------|---------------|-----|
| vector | vector_l2_ops | vector_cosine_ops | vector_ip_ops | vector_l1_ops |
| halfvec | halfvec_l2_ops | halfvec_cosine_ops | halfvec_ip_ops | halfvec_l1_ops |
| sparsevec | sparsevec_l2_ops | sparsevec_cosine_ops | sparsevec_ip_ops | sparsevec_l1_ops |
| bit | bit_hamming_ops | - | - | bit_jaccard_ops |

## When to Use pgvector

- Embedding storage with ACID guarantees
- Hybrid search (vector + SQL filtering)
- Existing PostgreSQL infrastructure
- Need for JOINs, aggregations, transactions
- Production deployments with familiar tooling

## Reference Files

- Extension source: `src/vector.c`
- SQL definitions: `sql/vector.sql`
- Test examples: `test/sql/`
