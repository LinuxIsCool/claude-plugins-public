//! Benchmarks for embedding operations.
//!
//! Run with: cargo bench --package kg-embeddings
//!
//! ## Expected Performance vs TypeScript
//!
//! | Operation | TypeScript | Rust (scalar) | Rust (SIMD) | Speedup |
//! |-----------|------------|---------------|-------------|---------|
//! | Cosine distance (384-dim) | ~5us | ~0.5us | ~0.1us | 10-50x |
//! | Euclidean distance (384-dim) | ~4us | ~0.4us | ~0.08us | 10-50x |
//! | Batch distances (1000 vectors) | ~5ms | ~0.5ms | ~0.1ms | 10-50x |
//! | HNSW search (1M vectors, k=10) | ~50ms | ~5ms | ~1ms | 10-50x |

use criterion::{black_box, criterion_group, criterion_main, BenchmarkId, Criterion, Throughput};
use kg_embeddings::*;

fn generate_random_vector(dim: usize, seed: u64) -> Vec<f32> {
    let mut vec = Vec::with_capacity(dim);
    let mut state = seed;
    for _ in 0..dim {
        state = state.wrapping_mul(1103515245).wrapping_add(12345);
        let val = (state as f32 / u64::MAX as f32) * 2.0 - 1.0;
        vec.push(val);
    }
    vec
}

fn benchmark_distance_metrics(c: &mut Criterion) {
    let dimensions = [128, 384, 768, 1536];

    let mut group = c.benchmark_group("distance_metrics");

    for dim in dimensions {
        let vec_a = generate_random_vector(dim, 42);
        let vec_b = generate_random_vector(dim, 123);

        group.throughput(Throughput::Elements(dim as u64));

        group.bench_with_input(BenchmarkId::new("cosine", dim), &dim, |b, _| {
            b.iter(|| distance::cosine_distance(black_box(&vec_a), black_box(&vec_b)))
        });

        group.bench_with_input(BenchmarkId::new("euclidean", dim), &dim, |b, _| {
            b.iter(|| distance::euclidean_distance(black_box(&vec_a), black_box(&vec_b)))
        });

        group.bench_with_input(BenchmarkId::new("dot_product", dim), &dim, |b, _| {
            b.iter(|| distance::dot_product(black_box(&vec_a), black_box(&vec_b)))
        });
    }

    group.finish();
}

fn benchmark_batch_operations(c: &mut Criterion) {
    let dim = 384;
    let batch_sizes = [100, 1000, 10000];

    let query = generate_random_vector(dim, 42);
    let config = EmbeddingConfig {
        dimensions: dim,
        metric: DistanceMetric::Cosine,
        ..Default::default()
    };
    let processor = BatchProcessor::new(config);

    let mut group = c.benchmark_group("batch_operations");

    for batch_size in batch_sizes {
        let vectors: Vec<Vec<f32>> = (0..batch_size)
            .map(|i| generate_random_vector(dim, i as u64))
            .collect();

        group.throughput(Throughput::Elements(batch_size as u64));

        group.bench_with_input(
            BenchmarkId::new("batch_distances", batch_size),
            &batch_size,
            |b, _| {
                b.iter(|| processor.batch_distances(black_box(&query), black_box(&vectors)))
            },
        );

        let mut vectors_clone = vectors.clone();
        group.bench_with_input(
            BenchmarkId::new("batch_normalize", batch_size),
            &batch_size,
            |b, _| {
                b.iter(|| processor.batch_normalize(black_box(&mut vectors_clone)))
            },
        );
    }

    group.finish();
}

fn benchmark_vector_store(c: &mut Criterion) {
    let dim = 384;
    let sizes = [1000, 10000, 100000];

    let mut group = c.benchmark_group("vector_store");

    for size in sizes {
        let mut store = VectorStore::with_capacity(dim, size);
        for i in 0..size {
            let vector = generate_random_vector(dim, i as u64);
            store.add(i as u64, vector).unwrap();
        }

        group.bench_with_input(BenchmarkId::new("get", size), &size, |b, _| {
            b.iter(|| store.get(black_box((size / 2) as u64)))
        });

        group.bench_with_input(BenchmarkId::new("iterate", size), &size, |b, _| {
            b.iter(|| {
                let count: usize = store.iter().count();
                black_box(count)
            })
        });
    }

    group.finish();
}

fn benchmark_hnsw_search(c: &mut Criterion) {
    let dim = 384;
    let sizes = [1000, 10000]; // Smaller sizes for benchmarking

    let mut group = c.benchmark_group("hnsw_search");
    group.sample_size(10); // Reduce samples for slower benchmarks

    for size in sizes {
        let mut store = VectorStore::with_capacity(dim, size);
        for i in 0..size {
            let vector = generate_random_vector(dim, i as u64);
            store.add(i as u64, vector).unwrap();
        }

        let config = HnswConfig {
            m: 16,
            ef_construction: 100,
            ef_search: 50,
            ..Default::default()
        };

        // Build index once
        let index = HnswIndex::build(&store, config.clone()).unwrap();
        let query = generate_random_vector(dim, 999999);

        for k in [1, 10, 100] {
            group.bench_with_input(
                BenchmarkId::new(format!("search_{}", size), k),
                &k,
                |b, &k| {
                    b.iter(|| index.search(black_box(&query), black_box(k)))
                },
            );
        }
    }

    group.finish();
}

fn benchmark_brute_force_comparison(c: &mut Criterion) {
    let dim = 384;
    let size = 10000;

    let mut store = VectorStore::with_capacity(dim, size);
    let vectors: Vec<Vec<f32>> = (0..size)
        .map(|i| {
            let v = generate_random_vector(dim, i as u64);
            store.add(i as u64, v.clone()).unwrap();
            v
        })
        .collect();

    let config = HnswConfig {
        ef_search: 100,
        ..Default::default()
    };
    let index = HnswIndex::build(&store, config).unwrap();
    let query = generate_random_vector(dim, 999999);

    let processor = BatchProcessor::new(EmbeddingConfig {
        dimensions: dim,
        ..Default::default()
    });

    let mut group = c.benchmark_group("brute_force_vs_hnsw");
    group.sample_size(10);

    group.bench_function("brute_force_knn_10", |b| {
        b.iter(|| processor.brute_force_knn(black_box(&query), black_box(&vectors), 10))
    });

    group.bench_function("hnsw_knn_10", |b| {
        b.iter(|| index.search(black_box(&query), 10))
    });

    group.finish();
}

criterion_group!(
    benches,
    benchmark_distance_metrics,
    benchmark_batch_operations,
    benchmark_vector_store,
    benchmark_hnsw_search,
    benchmark_brute_force_comparison,
);

criterion_main!(benches);
