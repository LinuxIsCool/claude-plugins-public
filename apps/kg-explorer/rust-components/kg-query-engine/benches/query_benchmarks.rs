//! Benchmarks for query engine components.
//!
//! Run with: cargo bench --package kg-query-engine

use criterion::{black_box, criterion_group, criterion_main, BenchmarkId, Criterion, Throughput};
use kg_query_engine::*;

fn benchmark_query_parsing(c: &mut Criterion) {
    let parser = QueryParser::new();

    let queries = vec![
        ("simple", "MATCH (n:Person) RETURN n"),
        (
            "with_edge",
            "MATCH (a:Person)-[:KNOWS]->(b:Person) RETURN a, b",
        ),
        (
            "with_where",
            "MATCH (n:Person) WHERE n.age > 25 AND n.name CONTAINS 'Alice' RETURN n",
        ),
        (
            "complex",
            "MATCH (p:Person)-[:WORKS_AT]->(c:Company) WHERE p.salary > 50000 ORDER BY p.name DESC LIMIT 100",
        ),
    ];

    let mut group = c.benchmark_group("query_parsing");

    for (name, query) in queries {
        group.throughput(Throughput::Bytes(query.len() as u64));
        group.bench_with_input(BenchmarkId::new("parse", name), query, |b, q| {
            b.iter(|| parser.parse(black_box(q)))
        });
    }

    group.finish();
}

fn benchmark_tokenization(c: &mut Criterion) {
    let parser = QueryParser::new();

    let query = "MATCH (a:Person {name: 'Alice', age: 30})-[:KNOWS {since: 2020}]->(b:Person) WHERE a.active = true AND b.age > 25 RETURN a.name AS name, b.name AS friend, count(*) AS count ORDER BY count DESC LIMIT 10";

    c.bench_function("tokenization", |b| {
        b.iter(|| {
            let _tokens: Vec<_> = parser.tokenize(black_box(query)).collect();
        })
    });
}

fn benchmark_optimization(c: &mut Criterion) {
    let optimizer = QueryOptimizer::new();

    // Create a test plan
    let plan = ExecutionPlan {
        root: PlanNode::Filter {
            predicate: Expr::Binary {
                left: Box::new(Expr::Property {
                    expr: Box::new(Expr::Variable("n".to_string())),
                    name: "age".to_string(),
                }),
                op: BinaryOp::Gt,
                right: Box::new(Expr::Literal(Literal::Integer(25))),
            },
            input: Box::new(PlanNode::NodeScan {
                variable: "n".to_string(),
                label: Some("Person".to_string()),
            }),
        },
        estimated_cost: 0.0,
        estimated_rows: 0,
        required_indexes: vec![],
    };

    c.bench_function("optimize_simple_plan", |b| {
        b.iter(|| optimizer.optimize(black_box(plan.clone())))
    });
}

fn benchmark_expression_evaluation(c: &mut Criterion) {
    use kg_query_engine::executor::*;
    use indexmap::IndexMap;
    use std::sync::Arc;

    let config = QueryConfig::default();
    let executor = QueryExecutor::with_config(&config);

    // Create a test row with data
    let mut bindings = IndexMap::new();
    bindings.insert(
        "x".to_string(),
        Value::Node(NodeValue {
            id: 1,
            labels: smallvec::smallvec!["Person".to_string()],
            properties: IndexMap::from([
                ("age".to_string(), Value::Int(30)),
                ("name".to_string(), Value::String("Alice".to_string())),
            ]),
        }),
    );
    let row = Row { bindings };

    let graph = InMemoryGraph::default();
    let ctx = ExecutionContext::new(Arc::new(graph));

    let expressions = vec![
        (
            "arithmetic",
            Expr::Binary {
                left: Box::new(Expr::Literal(Literal::Integer(100))),
                op: BinaryOp::Mul,
                right: Box::new(Expr::Literal(Literal::Integer(5))),
            },
        ),
        (
            "property_access",
            Expr::Property {
                expr: Box::new(Expr::Variable("x".to_string())),
                name: "age".to_string(),
            },
        ),
        (
            "comparison",
            Expr::Binary {
                left: Box::new(Expr::Property {
                    expr: Box::new(Expr::Variable("x".to_string())),
                    name: "age".to_string(),
                }),
                op: BinaryOp::Gt,
                right: Box::new(Expr::Literal(Literal::Integer(25))),
            },
        ),
    ];

    let mut group = c.benchmark_group("expression_evaluation");

    for (name, expr) in expressions {
        group.bench_with_input(BenchmarkId::new("eval", name), &expr, |b, e| {
            b.iter(|| {
                // Note: This benchmark would need the private evaluate_expr method to be public
                // For now, this is a placeholder showing the intended structure
                black_box(e);
            })
        });
    }

    group.finish();
}

criterion_group!(
    benches,
    benchmark_query_parsing,
    benchmark_tokenization,
    benchmark_optimization,
    benchmark_expression_evaluation,
);

criterion_main!(benches);
