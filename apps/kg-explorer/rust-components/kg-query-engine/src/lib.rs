//! High-performance query engine for knowledge graphs.
//!
//! This crate provides fast query parsing, planning, optimization, and execution
//! with WASM compilation support for browser use.
//!
//! # Features
//!
//! - **Zero-copy tokenization** with streaming lexer
//! - **Recursive descent parser** with predictive parsing
//! - **Query optimization** (predicate pushdown, constant folding, join reordering)
//! - **Parallel query execution** with work-stealing
//! - **WASM compilation** for browser use
//!
//! # Performance Targets
//!
//! | Operation | TypeScript | Rust | Speedup |
//! |-----------|------------|------|---------|
//! | Parse simple query | ~1ms | ~10us | 100x |
//! | Parse complex query | ~5ms | ~50us | 100x |
//! | Query planning | ~10ms | ~0.5ms | 20x |
//! | Filter execution (10K rows) | ~50ms | ~2ms | 25x |

#![warn(clippy::all, clippy::pedantic)]
#![allow(clippy::module_name_repetitions)]

pub mod ast;
pub mod executor;
pub mod optimizer;
pub mod parser;
pub mod planner;

use indexmap::IndexMap;
use serde::{Deserialize, Serialize};
use smallvec::SmallVec;
use thiserror::Error;

#[cfg(feature = "wasm")]
use wasm_bindgen::prelude::*;

// Re-exports for public API
pub use ast::{BinaryOp, Expr, Literal, Query, UnaryOp};
pub use executor::{ExecutionContext, InMemoryGraph, QueryConfig, QueryExecutor, Row, Value};
pub use optimizer::QueryOptimizer;
pub use parser::QueryParser;
pub use planner::{ExecutionPlan, PlanNode, QueryPlanner};

/// Errors that can occur during query processing.
#[derive(Debug, Error)]
pub enum QueryError {
    #[error("Parse error at position {position}: {message}")]
    ParseError { position: usize, message: String },

    #[error("Planning error: {0}")]
    PlanningError(String),

    #[error("Optimization error: {0}")]
    OptimizationError(String),

    #[error("Execution error: {0}")]
    ExecutionError(String),

    #[error("Type error: expected {expected}, found {found}")]
    TypeError { expected: String, found: String },

    #[error("Unknown variable: {0}")]
    UnknownVariable(String),

    #[error("Unknown function: {0}")]
    UnknownFunction(String),

    #[error("Invalid operation: {0}")]
    InvalidOperation(String),
}

pub type Result<T> = std::result::Result<T, QueryError>;

/// A complete query engine combining parsing, planning, optimization, and execution.
#[derive(Debug, Default)]
pub struct QueryEngine {
    parser: QueryParser,
    planner: QueryPlanner,
    optimizer: QueryOptimizer,
}

impl QueryEngine {
    /// Create a new query engine with default configuration.
    #[must_use]
    pub fn new() -> Self {
        Self::default()
    }

    /// Parse a query string into an AST.
    ///
    /// # Errors
    ///
    /// Returns `QueryError::ParseError` if the query syntax is invalid.
    pub fn parse(&self, query: &str) -> Result<Query> {
        self.parser.parse(query)
    }

    /// Plan and optimize a query for execution.
    ///
    /// # Errors
    ///
    /// Returns an error if planning or optimization fails.
    pub fn plan(&self, query: &Query) -> Result<ExecutionPlan> {
        let plan = self.planner.plan(query)?;
        self.optimizer.optimize(plan)
    }

    /// Parse, plan, and optimize a query string.
    ///
    /// # Errors
    ///
    /// Returns an error if any stage fails.
    pub fn compile(&self, query: &str) -> Result<ExecutionPlan> {
        let ast = self.parse(query)?;
        self.plan(&ast)
    }
}

/// Node value representation for query results.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct NodeValue {
    pub id: u64,
    pub labels: SmallVec<[String; 2]>,
    pub properties: IndexMap<String, Value>,
}

/// Edge value representation for query results.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct EdgeValue {
    pub id: u64,
    pub rel_type: String,
    pub source: u64,
    pub target: u64,
    pub properties: IndexMap<String, Value>,
}

// WASM bindings
#[cfg(feature = "wasm")]
#[wasm_bindgen]
pub struct WasmQueryEngine {
    inner: QueryEngine,
}

#[cfg(feature = "wasm")]
#[wasm_bindgen]
impl WasmQueryEngine {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Self {
            inner: QueryEngine::new(),
        }
    }

    /// Parse a query string and return the AST as JSON.
    #[wasm_bindgen]
    pub fn parse(&self, query: &str) -> std::result::Result<String, String> {
        self.inner
            .parse(query)
            .map(|ast| serde_json::to_string(&ast).unwrap_or_default())
            .map_err(|e| e.to_string())
    }

    /// Compile a query and return the execution plan as JSON.
    #[wasm_bindgen]
    pub fn compile(&self, query: &str) -> std::result::Result<String, String> {
        self.inner
            .compile(query)
            .map(|plan| serde_json::to_string(&plan).unwrap_or_default())
            .map_err(|e| e.to_string())
    }
}

#[cfg(feature = "wasm")]
impl Default for WasmQueryEngine {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_simple_query_parse() {
        let engine = QueryEngine::new();
        let result = engine.parse("MATCH (n:Person) RETURN n");
        assert!(result.is_ok());
    }

    #[test]
    fn test_query_with_where() {
        let engine = QueryEngine::new();
        let result = engine.parse("MATCH (n:Person) WHERE n.age > 25 RETURN n");
        assert!(result.is_ok());
    }

    #[test]
    fn test_query_compile() {
        let engine = QueryEngine::new();
        let result = engine.compile("MATCH (n:Person) RETURN n");
        assert!(result.is_ok());
    }
}
