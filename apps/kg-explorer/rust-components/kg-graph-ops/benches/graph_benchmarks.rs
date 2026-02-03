//! Benchmarks for graph operations.
//!
//! Run with: cargo bench --package kg-graph-ops
//!
//! ## Expected Performance vs TypeScript
//!
//! | Operation | TypeScript | Rust | Speedup |
//! |-----------|------------|------|---------|
//! | PageRank (10K nodes) | ~200ms | ~10ms | 20x |
//! | Dijkstra (10K nodes) | ~50ms | ~2ms | 25x |
//! | Community detection | ~500ms | ~25ms | 20x |
//! | Subgraph matching | ~100ms | ~5ms | 20x |

use criterion::{black_box, criterion_group, criterion_main, BenchmarkId, Criterion, Throughput};
use kg_graph_ops::*;

fn generate_random_graph(num_nodes: usize, avg_degree: usize, seed: u64) -> Graph {
    let mut graph = Graph::new();
    let mut state = seed;

    // Add edges
    for source in 0..num_nodes {
        let num_edges = avg_degree;
        for _ in 0..num_edges {
            state = state.wrapping_mul(1103515245).wrapping_add(12345);
            let target = (state as usize) % num_nodes;

            if source != target {
                let weight = ((state % 100) as f64) / 100.0 + 0.1;
                graph.add_edge(source as u64, target as u64, weight);
            }
        }
    }

    graph
}

fn benchmark_pagerank(c: &mut Criterion) {
    let sizes = [100, 1000, 10000];

    let mut group = c.benchmark_group("pagerank");

    for size in sizes {
        let graph = generate_random_graph(size, 10, 42);

        group.throughput(Throughput::Elements(size as u64));

        group.bench_with_input(BenchmarkId::new("iterations_10", size), &graph, |b, g| {
            b.iter(|| pagerank(black_box(g), 0.85, 10))
        });

        group.bench_with_input(BenchmarkId::new("iterations_20", size), &graph, |b, g| {
            b.iter(|| pagerank(black_box(g), 0.85, 20))
        });
    }

    group.finish();
}

fn benchmark_dijkstra(c: &mut Criterion) {
    let sizes = [100, 1000, 10000];

    let mut group = c.benchmark_group("dijkstra");

    for size in sizes {
        let graph = generate_random_graph(size, 10, 42);

        group.throughput(Throughput::Elements(size as u64));

        // Find path between first and last node
        group.bench_with_input(BenchmarkId::new("path", size), &graph, |b, g| {
            b.iter(|| dijkstra(black_box(g), 0, (size - 1) as u64))
        });
    }

    group.finish();
}

fn benchmark_bidirectional_dijkstra(c: &mut Criterion) {
    let sizes = [1000, 10000];

    let mut group = c.benchmark_group("bidirectional_dijkstra");
    group.sample_size(10);

    for size in sizes {
        let graph = generate_random_graph(size, 10, 42);

        group.bench_with_input(BenchmarkId::new("path", size), &graph, |b, g| {
            b.iter(|| bidirectional_dijkstra(black_box(g), 0, (size - 1) as u64))
        });
    }

    group.finish();
}

fn benchmark_dijkstra_vs_bidirectional(c: &mut Criterion) {
    let size = 10000;
    let graph = generate_random_graph(size, 10, 42);

    let mut group = c.benchmark_group("dijkstra_comparison");
    group.sample_size(10);

    group.bench_function("unidirectional", |b| {
        b.iter(|| dijkstra(black_box(&graph), 0, 9999))
    });

    group.bench_function("bidirectional", |b| {
        b.iter(|| bidirectional_dijkstra(black_box(&graph), 0, 9999))
    });

    group.finish();
}

fn benchmark_community_detection(c: &mut Criterion) {
    let sizes = [100, 1000, 5000];

    let mut group = c.benchmark_group("community_detection");
    group.sample_size(10);

    for size in sizes {
        // Create graph with community structure
        let graph = generate_community_graph(size, 4, 42);

        group.throughput(Throughput::Elements(size as u64));

        group.bench_with_input(BenchmarkId::new("louvain", size), &graph, |b, g| {
            b.iter(|| louvain_communities(black_box(g)))
        });

        group.bench_with_input(BenchmarkId::new("label_propagation", size), &graph, |b, g| {
            b.iter(|| label_propagation(black_box(g)))
        });
    }

    group.finish();
}

fn generate_community_graph(num_nodes: usize, num_communities: usize, seed: u64) -> Graph {
    let mut graph = Graph::undirected();
    let community_size = num_nodes / num_communities;
    let mut state = seed;

    // Dense intra-community edges
    for community in 0..num_communities {
        let start = community * community_size;
        let end = start + community_size;

        for i in start..end {
            for j in (i + 1)..end {
                state = state.wrapping_mul(1103515245).wrapping_add(12345);
                if (state % 100) < 30 {
                    // 30% edge probability within community
                    graph.add_edge(i as u64, j as u64, 1.0);
                }
            }
        }
    }

    // Sparse inter-community edges
    for i in 0..num_nodes {
        state = state.wrapping_mul(1103515245).wrapping_add(12345);
        let j = (state as usize) % num_nodes;
        let community_i = i / community_size;
        let community_j = j / community_size;

        if community_i != community_j && (state % 1000) < 5 {
            // 0.5% edge probability between communities
            graph.add_edge(i as u64, j as u64, 0.1);
        }
    }

    graph
}

fn benchmark_centrality(c: &mut Criterion) {
    let sizes = [100, 500, 1000];

    let mut group = c.benchmark_group("centrality");
    group.sample_size(10);

    for size in sizes {
        let graph = generate_random_graph(size, 10, 42);

        group.throughput(Throughput::Elements(size as u64));

        group.bench_with_input(BenchmarkId::new("degree", size), &graph, |b, g| {
            b.iter(|| degree_centrality(black_box(g)))
        });

        // Betweenness and closeness are O(n*m), so use smaller sizes
        if size <= 500 {
            group.bench_with_input(BenchmarkId::new("betweenness", size), &graph, |b, g| {
                b.iter(|| betweenness_centrality(black_box(g)))
            });

            group.bench_with_input(BenchmarkId::new("closeness", size), &graph, |b, g| {
                b.iter(|| closeness_centrality(black_box(g)))
            });
        }
    }

    group.finish();
}

fn benchmark_graph_compression(c: &mut Criterion) {
    let sizes = [1000, 10000];

    let mut group = c.benchmark_group("graph_compression");

    for size in sizes {
        let graph = generate_random_graph(size, 10, 42);

        group.bench_with_input(BenchmarkId::new("compress_varint", size), &graph, |b, g| {
            let compressor = GraphCompressor::new(CompressionFormat::VarInt);
            b.iter(|| compressor.compress(black_box(g)))
        });

        group.bench_with_input(BenchmarkId::new("compress_delta", size), &graph, |b, g| {
            let compressor = GraphCompressor::new(CompressionFormat::Delta);
            b.iter(|| compressor.compress(black_box(g)))
        });
    }

    group.finish();
}

criterion_group!(
    benches,
    benchmark_pagerank,
    benchmark_dijkstra,
    benchmark_bidirectional_dijkstra,
    benchmark_dijkstra_vs_bidirectional,
    benchmark_community_detection,
    benchmark_centrality,
    benchmark_graph_compression,
);

criterion_main!(benches);
