//! Benchmarks for temporal operations.
//!
//! Run with: cargo bench --package kg-temporal
//!
//! ## Expected Performance vs TypeScript
//!
//! | Operation | TypeScript | Rust | Speedup |
//! |-----------|------------|------|---------|
//! | Insert (10K records) | ~100ms | ~5ms | 20x |
//! | Point query | ~1ms | ~10us | 100x |
//! | Range query | ~10ms | ~0.5ms | 20x |
//! | Time-travel | ~5ms | ~0.2ms | 25x |

use criterion::{black_box, criterion_group, criterion_main, BenchmarkId, Criterion, Throughput};
use chrono::{DateTime, Duration, Utc};
use kg_temporal::*;

fn benchmark_store_insert(c: &mut Criterion) {
    let sizes = [1000, 10000, 100000];

    let mut group = c.benchmark_group("temporal_store_insert");

    for size in sizes {
        group.throughput(Throughput::Elements(size as u64));

        group.bench_with_input(BenchmarkId::new("insert", size), &size, |b, &size| {
            b.iter(|| {
                let mut store = BiTemporalStore::new();
                let now = Utc::now();

                for i in 0..size {
                    let valid_time = TimeRange::new(
                        now - Duration::days(30),
                        DateTime::<Utc>::MAX_UTC,
                    );
                    store.insert(i as u64, format!("Entity {}", i), valid_time);
                }

                black_box(store)
            })
        });
    }

    group.finish();
}

fn benchmark_store_queries(c: &mut Criterion) {
    let sizes = [1000, 10000, 100000];

    let mut group = c.benchmark_group("temporal_store_queries");

    for size in sizes {
        // Pre-populate store
        let mut store = BiTemporalStore::new();
        let now = Utc::now();

        for i in 0..size {
            let valid_time = TimeRange::new(
                now - Duration::days(30 + (i % 60) as i64),
                now + Duration::days((i % 365) as i64),
            );
            store.insert(i as u64, format!("Entity {}", i), valid_time);
        }

        group.throughput(Throughput::Elements(1));

        // Point-in-time query
        group.bench_with_input(BenchmarkId::new("get_current", size), &store, |b, s| {
            b.iter(|| s.get_current(black_box((size / 2) as u64)))
        });

        // Time-travel query
        group.bench_with_input(BenchmarkId::new("get_at", size), &store, |b, s| {
            let past = now - Duration::days(15);
            b.iter(|| s.get_at(black_box((size / 2) as u64), black_box(past), black_box(now)))
        });

        // Snapshot query
        group.bench_with_input(BenchmarkId::new("snapshot", size), &store, |b, s| {
            b.iter(|| s.snapshot(black_box(now), black_box(now)))
        });

        // Range query
        group.bench_with_input(BenchmarkId::new("range_query", size), &store, |b, s| {
            let range = TimeRange::new(now - Duration::days(10), now + Duration::days(10));
            b.iter(|| s.range_query(black_box(range)))
        });
    }

    group.finish();
}

fn benchmark_interval_tree(c: &mut Criterion) {
    let sizes = [1000, 10000, 100000];

    let mut group = c.benchmark_group("interval_tree");

    for size in sizes {
        // Pre-populate tree
        let mut tree = index::IntervalTree::new();
        let now = Utc::now();

        for i in 0..size {
            let start = now - Duration::days(30 + (i % 60) as i64);
            let end = start + Duration::days((i % 30) as i64 + 1);
            let range = TimeRange::new(start, end);
            tree.insert(range, i as u64);
        }

        group.throughput(Throughput::Elements(1));

        // Point query
        group.bench_with_input(BenchmarkId::new("query_point", size), &tree, |b, t| {
            let query_time = now - Duration::days(15);
            b.iter(|| t.query_point(black_box(query_time)))
        });

        // Range query
        group.bench_with_input(BenchmarkId::new("query_range", size), &tree, |b, t| {
            let range = TimeRange::new(now - Duration::days(10), now);
            b.iter(|| t.query_range(black_box(range)))
        });
    }

    group.finish();
}

fn benchmark_time_series_index(c: &mut Criterion) {
    let sizes = [10000, 100000];

    let mut group = c.benchmark_group("time_series_index");

    for size in sizes {
        // Pre-populate index
        let mut index = index::TimeSeriesIndex::new(3600); // 1-hour buckets
        let now = Utc::now();

        for i in 0..size {
            let timestamp = now - Duration::seconds((i * 60) as i64);
            index.insert(timestamp, i as f64);
        }

        group.throughput(Throughput::Elements(1));

        // Range query
        group.bench_with_input(BenchmarkId::new("query_range", size), &index, |b, idx| {
            let start = now - Duration::hours(24);
            let end = now;
            b.iter(|| idx.query_range(black_box(start), black_box(end)))
        });

        // Latest before
        group.bench_with_input(BenchmarkId::new("get_latest_before", size), &index, |b, idx| {
            b.iter(|| idx.get_latest_before(black_box(now)))
        });
    }

    group.finish();
}

fn benchmark_aggregation(c: &mut Criterion) {
    let sizes = [1000, 10000];

    let mut group = c.benchmark_group("temporal_aggregation");

    for size in sizes {
        let now = Utc::now();
        let data: Vec<(DateTime<Utc>, f64)> = (0..size)
            .map(|i| {
                let timestamp = now - Duration::minutes(i as i64);
                (timestamp, (i as f64) * 1.5)
            })
            .collect();

        let range = TimeRange::new(now - Duration::hours(24), now);

        group.throughput(Throughput::Elements(size as u64));

        // Tumbling window aggregation
        group.bench_with_input(BenchmarkId::new("tumbling_sum", size), &data, |b, d| {
            b.iter(|| {
                temporal_aggregate(
                    black_box(d),
                    range,
                    TimeWindow::Tumbling(Duration::hours(1)),
                    AggregateFunction::Sum,
                )
            })
        });

        // Sliding window aggregation
        group.bench_with_input(BenchmarkId::new("sliding_avg", size), &data, |b, d| {
            b.iter(|| {
                temporal_aggregate(
                    black_box(d),
                    range,
                    TimeWindow::Sliding {
                        size: Duration::hours(2),
                        slide: Duration::minutes(30),
                    },
                    AggregateFunction::Avg,
                )
            })
        });
    }

    group.finish();
}

fn benchmark_moving_average(c: &mut Criterion) {
    let sizes = [1000, 10000];

    let mut group = c.benchmark_group("moving_average");

    for size in sizes {
        let values: Vec<f64> = (0..size).map(|i| (i as f64) * 1.5).collect();

        group.throughput(Throughput::Elements(size as u64));

        group.bench_with_input(BenchmarkId::new("simple_ma", size), &values, |b, v| {
            b.iter(|| {
                let mut ma = aggregation::MovingAverage::new(100);
                for &val in v {
                    black_box(ma.add(val));
                }
            })
        });

        group.bench_with_input(BenchmarkId::new("exponential_ma", size), &values, |b, v| {
            b.iter(|| {
                let mut ema = aggregation::ExponentialMovingAverage::new(0.1);
                for &val in v {
                    black_box(ema.add(val));
                }
            })
        });
    }

    group.finish();
}

criterion_group!(
    benches,
    benchmark_store_insert,
    benchmark_store_queries,
    benchmark_interval_tree,
    benchmark_time_series_index,
    benchmark_aggregation,
    benchmark_moving_average,
);

criterion_main!(benches);
