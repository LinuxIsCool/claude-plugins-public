# Knowledge Graph Rust Components

High-performance Rust components for the knowledge graph system, providing 10-100x speedup over TypeScript implementations for critical paths.

## Components

### kg-query-engine

Fast query parsing, planning, and execution.

**Features:**
- Zero-copy tokenization with streaming lexer
- Recursive descent parser with predictive parsing
- Query optimization (predicate pushdown, constant folding, join reordering)
- Parallel query execution with work-stealing
- WASM compilation for browser use

**Performance Targets:**
| Operation | TypeScript | Rust | Speedup |
|-----------|------------|------|---------|
| Parse simple query | ~1ms | ~10us | 100x |
| Parse complex query | ~5ms | ~50us | 100x |
| Query planning | ~10ms | ~0.5ms | 20x |
| Filter execution (10K rows) | ~50ms | ~2ms | 25x |

### kg-embeddings

High-performance similarity search and vector operations.

**Features:**
- SIMD-optimized distance calculations (AVX2, SSE4.1)
- Cosine, Euclidean, Manhattan, and dot product metrics
- HNSW index for approximate nearest neighbor search
- Scalar and product quantization for memory efficiency
- Memory-mapped storage for large datasets
- Parallel batch operations with Rayon

**Performance Targets:**
| Operation | TypeScript | Rust (scalar) | Rust (SIMD) | Speedup |
|-----------|------------|---------------|-------------|---------|
| Cosine distance (384-dim) | ~5us | ~0.5us | ~0.1us | 10-50x |
| Batch distances (1K vectors) | ~5ms | ~0.5ms | ~0.1ms | 10-50x |
| HNSW search (1M vectors, k=10) | ~50ms | ~5ms | ~1ms | 10-50x |

### kg-graph-ops

Graph algorithms optimized for knowledge graphs.

**Features:**
- PageRank and centrality metrics (degree, betweenness, closeness, eigenvector)
- Community detection (Louvain, Label Propagation)
- Path finding (Dijkstra, A*, bidirectional search, k-shortest paths)
- Subgraph matching with VF2 algorithm variant
- Graph compression with varint and delta encoding

**Performance Targets:**
| Operation | TypeScript | Rust | Speedup |
|-----------|------------|------|---------|
| PageRank (10K nodes, 20 iterations) | ~200ms | ~10ms | 20x |
| Dijkstra (10K nodes) | ~50ms | ~2ms | 25x |
| Louvain communities (10K nodes) | ~500ms | ~25ms | 20x |
| Subgraph matching (1K patterns) | ~100ms | ~5ms | 20x |

### kg-temporal

Bi-temporal indexing for versioned knowledge graphs.

**Features:**
- Bi-temporal index structure (valid time + transaction time)
- Interval tree for efficient range queries
- Time-travel queries (as-of, between, during)
- Temporal aggregations (tumbling, sliding, session windows)
- Moving average calculators (simple, exponential)
- Version history compression

**Performance Targets:**
| Operation | TypeScript | Rust | Speedup |
|-----------|------------|------|---------|
| Insert (10K records) | ~100ms | ~5ms | 20x |
| Point query | ~1ms | ~10us | 100x |
| Range query (10K records) | ~10ms | ~0.5ms | 20x |
| Snapshot query | ~5ms | ~0.2ms | 25x |

## Building

### Prerequisites

- Rust 1.75+ (edition 2024)
- wasm-pack (for WASM builds)

### Native Build

```bash
# Build all components
cargo build --release

# Run tests
cargo test --all

# Run benchmarks
cargo bench --all
```

### WASM Build

```bash
# Build for web
wasm-pack build --target web kg-query-engine --features wasm
wasm-pack build --target web kg-embeddings --features wasm
wasm-pack build --target web kg-graph-ops --features wasm
wasm-pack build --target web kg-temporal --features wasm

# Build for Node.js
wasm-pack build --target nodejs kg-embeddings --features wasm
```

## Usage

### From TypeScript/JavaScript

```typescript
import init, { WasmQueryEngine } from 'kg-query-engine';

await init();
const engine = new WasmQueryEngine();
const ast = engine.parse("MATCH (n:Person) RETURN n");
```

```typescript
import init, { WasmEmbeddings } from 'kg-embeddings';

await init();
const embeddings = new WasmEmbeddings(384);
embeddings.add(1n, new Float32Array([0.1, 0.2, ...]));
embeddings.build_index();
const results = embeddings.search(new Float32Array([...]), 10);
```

### From Rust

```rust
use kg_query_engine::{QueryEngine, QueryConfig};
use kg_embeddings::{VectorStore, HnswIndex, HnswConfig};
use kg_graph_ops::{Graph, pagerank, dijkstra};
use kg_temporal::{BiTemporalStore, TimeRange};

// Query engine
let engine = QueryEngine::new();
let query = engine.parse("MATCH (n:Person) RETURN n")?;

// Vector search
let mut store = VectorStore::new(384);
store.add(1, vec![0.1, 0.2, ...])?;
let index = HnswIndex::build(&store, HnswConfig::default())?;
let results = index.search(&query_vector, 10)?;

// Graph algorithms
let mut graph = Graph::new();
graph.add_edge(1, 2, 1.0);
let ranks = pagerank(&graph, 0.85, 20)?;
let path = dijkstra(&graph, 1, 10)?;

// Temporal queries
let mut store = BiTemporalStore::new();
store.insert(1, "Alice".to_string(), TimeRange::from_now());
let snapshot = store.snapshot(query_time, query_time);
```

## Architecture

```
rust-components/
├── Cargo.toml                 # Workspace configuration
├── kg-query-engine/
│   ├── src/
│   │   ├── lib.rs            # Public API and types
│   │   ├── ast.rs            # Abstract syntax tree
│   │   ├── parser.rs         # Tokenizer and parser
│   │   ├── planner.rs        # Query planning
│   │   ├── optimizer.rs      # Plan optimization
│   │   └── executor.rs       # Query execution
│   └── benches/
│       └── query_benchmarks.rs
├── kg-embeddings/
│   ├── src/
│   │   ├── lib.rs            # Public API
│   │   ├── distance.rs       # SIMD distance functions
│   │   ├── store.rs          # Vector storage
│   │   ├── hnsw.rs           # HNSW index
│   │   └── quantization.rs   # Compression
│   └── benches/
│       └── embedding_benchmarks.rs
├── kg-graph-ops/
│   ├── src/
│   │   ├── lib.rs            # Graph data structure
│   │   ├── centrality.rs     # PageRank, betweenness, etc.
│   │   ├── community.rs      # Louvain, label propagation
│   │   ├── pathfinding.rs    # Dijkstra, A*, bidirectional
│   │   ├── matching.rs       # Subgraph matching
│   │   └── compression.rs    # Graph serialization
│   └── benches/
│       └── graph_benchmarks.rs
└── kg-temporal/
    ├── src/
    │   ├── lib.rs            # Bi-temporal store
    │   ├── index.rs          # Interval tree, time series
    │   ├── query.rs          # Query builder
    │   ├── aggregation.rs    # Temporal aggregations
    │   └── compression.rs    # History compression
    └── benches/
        └── temporal_benchmarks.rs
```

## Feature Flags

### kg-query-engine
- `parallel` - Enable parallel query execution (default)
- `wasm` - Enable WASM bindings
- `simd` - Enable SIMD optimizations

### kg-embeddings
- `parallel` - Enable parallel batch operations (default)
- `simd` - Enable SIMD distance calculations (default)
- `wasm` - Enable WASM bindings
- `mmap` - Enable memory-mapped storage

### kg-graph-ops
- `parallel` - Enable parallel graph algorithms (default)
- `wasm` - Enable WASM bindings

### kg-temporal
- `parallel` - Enable parallel operations (default)
- `compression` - Enable LZ4/Zstd compression (default)
- `wasm` - Enable WASM bindings
- `mmap` - Enable memory-mapped storage

## Benchmarks

Run benchmarks to verify performance on your hardware:

```bash
# All benchmarks
cargo bench

# Specific component
cargo bench --package kg-embeddings

# With detailed output
cargo bench -- --verbose

# Generate HTML report
cargo bench -- --verbose
open target/criterion/report/index.html
```

## Safety

All components follow Rust's memory safety guarantees. Unsafe code is minimized and documented:

- SIMD intrinsics use `#[target_feature]` for runtime detection
- Memory-mapped files validate data on load
- FFI boundaries use proper type conversions

## Integration

These components are designed to be called from the TypeScript frontend via WASM. For server-side use, they can also be compiled as native libraries and accessed via FFI.

The WASM builds include:
- Automatic memory management
- TypeScript type definitions
- Async support for long-running operations
