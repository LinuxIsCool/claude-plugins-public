//! Abstract Syntax Tree definitions for the query language.
//!
//! This module defines the AST nodes used to represent parsed queries.
//! The AST closely mirrors Cypher query structure.

use indexmap::IndexMap;
use serde::{Deserialize, Serialize};
use smallvec::SmallVec;

/// A complete query consisting of clauses.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Query {
    pub clauses: Vec<Clause>,
}

/// Individual clauses that make up a query.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum Clause {
    Match(MatchClause),
    Where(WhereClause),
    Return(ReturnClause),
    OrderBy(OrderByClause),
    Limit(LimitClause),
    Skip(SkipClause),
    Create(CreateClause),
    Set(SetClause),
    Delete(DeleteClause),
    With(WithClause),
    Unwind(UnwindClause),
}

/// MATCH clause for pattern matching.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct MatchClause {
    pub pattern: Pattern,
    pub optional: bool,
}

/// WHERE clause for filtering.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct WhereClause {
    pub predicate: Expr,
}

/// RETURN clause for specifying output.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ReturnClause {
    pub items: Vec<ReturnItem>,
    pub distinct: bool,
}

/// A single item in a RETURN clause.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ReturnItem {
    pub expr: Expr,
    pub alias: Option<String>,
}

/// ORDER BY clause for sorting results.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct OrderByClause {
    pub items: Vec<OrderItem>,
}

/// A single ordering specification.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct OrderItem {
    pub expr: Expr,
    pub ascending: bool,
}

/// LIMIT clause for restricting result count.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct LimitClause {
    pub count: u64,
}

/// SKIP clause for pagination.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct SkipClause {
    pub count: u64,
}

/// CREATE clause for creating nodes/edges.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct CreateClause {
    pub pattern: Pattern,
}

/// SET clause for updating properties.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct SetClause {
    pub items: Vec<SetItem>,
}

/// A single SET operation.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct SetItem {
    pub target: Expr,
    pub value: Expr,
}

/// DELETE clause for removing nodes/edges.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct DeleteClause {
    pub items: Vec<Expr>,
    pub detach: bool,
}

/// WITH clause for query chaining.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct WithClause {
    pub items: Vec<ReturnItem>,
    pub distinct: bool,
}

/// UNWIND clause for list expansion.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct UnwindClause {
    pub expr: Expr,
    pub alias: String,
}

/// A graph pattern consisting of path patterns.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Pattern {
    pub paths: Vec<PathPattern>,
}

/// A path pattern: sequence of nodes and edges.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct PathPattern {
    pub elements: Vec<PathElement>,
}

/// An element in a path: either a node or an edge.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "kind")]
pub enum PathElement {
    Node(NodePattern),
    Edge(EdgePattern),
}

/// A node pattern for matching.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct NodePattern {
    pub variable: Option<String>,
    pub labels: SmallVec<[String; 2]>,
    pub properties: IndexMap<String, Expr>,
}

/// An edge pattern for matching.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct EdgePattern {
    pub variable: Option<String>,
    pub rel_types: SmallVec<[String; 2]>,
    pub properties: IndexMap<String, Expr>,
    pub direction: Direction,
    pub length: Option<LengthSpec>,
}

/// Edge direction.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum Direction {
    Outgoing,
    Incoming,
    Both,
}

/// Variable-length path specification.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct LengthSpec {
    pub min: Option<u32>,
    pub max: Option<u32>,
}

/// Expression node in the AST.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum Expr {
    /// A literal value
    Literal(Literal),
    /// A variable reference
    Variable(String),
    /// A parameter reference ($param)
    Parameter(String),
    /// Property access (expr.property)
    Property { expr: Box<Expr>, name: String },
    /// Index access (expr[index])
    Index { expr: Box<Expr>, index: Box<Expr> },
    /// Binary operation
    Binary {
        left: Box<Expr>,
        op: BinaryOp,
        right: Box<Expr>,
    },
    /// Unary operation
    Unary { op: UnaryOp, expr: Box<Expr> },
    /// Function call
    FunctionCall { name: String, args: Vec<Expr> },
    /// CASE expression
    Case {
        operand: Option<Box<Expr>>,
        when_clauses: Vec<(Expr, Expr)>,
        else_clause: Option<Box<Expr>>,
    },
    /// List literal [a, b, c]
    List(Vec<Expr>),
    /// Map literal {a: 1, b: 2}
    Map(IndexMap<String, Expr>),
    /// Pattern comprehension
    PatternComprehension {
        pattern: Pattern,
        where_clause: Option<Box<Expr>>,
        projection: Box<Expr>,
    },
    /// List comprehension [x IN list | expr]
    ListComprehension {
        variable: String,
        list: Box<Expr>,
        filter: Option<Box<Expr>>,
        projection: Box<Expr>,
    },
    /// EXISTS subquery
    Exists { pattern: Pattern },
    /// COUNT subquery
    Count { pattern: Pattern },
}

/// Literal values.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "kind", content = "value")]
pub enum Literal {
    Null,
    Boolean(bool),
    Integer(i64),
    Float(f64),
    String(String),
}

/// Binary operators.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum BinaryOp {
    // Comparison
    Eq,
    Ne,
    Lt,
    Le,
    Gt,
    Ge,
    // Logical
    And,
    Or,
    Xor,
    // Arithmetic
    Add,
    Sub,
    Mul,
    Div,
    Mod,
    Pow,
    // String
    Contains,
    StartsWith,
    EndsWith,
    Matches,
    // Collection
    In,
    // Null-safe
    IsNull,
    IsNotNull,
}

/// Unary operators.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum UnaryOp {
    Not,
    Neg,
    Pos,
}

impl Default for NodePattern {
    fn default() -> Self {
        Self {
            variable: None,
            labels: SmallVec::new(),
            properties: IndexMap::new(),
        }
    }
}

impl Default for EdgePattern {
    fn default() -> Self {
        Self {
            variable: None,
            rel_types: SmallVec::new(),
            properties: IndexMap::new(),
            direction: Direction::Both,
            length: None,
        }
    }
}

impl BinaryOp {
    /// Check if this is a comparison operator.
    #[must_use]
    pub const fn is_comparison(&self) -> bool {
        matches!(
            self,
            Self::Eq | Self::Ne | Self::Lt | Self::Le | Self::Gt | Self::Ge
        )
    }

    /// Check if this is a logical operator.
    #[must_use]
    pub const fn is_logical(&self) -> bool {
        matches!(self, Self::And | Self::Or | Self::Xor)
    }

    /// Check if this is an arithmetic operator.
    #[must_use]
    pub const fn is_arithmetic(&self) -> bool {
        matches!(
            self,
            Self::Add | Self::Sub | Self::Mul | Self::Div | Self::Mod | Self::Pow
        )
    }

    /// Get operator precedence (higher = binds tighter).
    #[must_use]
    pub const fn precedence(&self) -> u8 {
        match self {
            Self::Or => 1,
            Self::Xor => 2,
            Self::And => 3,
            Self::Eq | Self::Ne | Self::Lt | Self::Le | Self::Gt | Self::Ge => 4,
            Self::In | Self::Contains | Self::StartsWith | Self::EndsWith | Self::Matches => 5,
            Self::IsNull | Self::IsNotNull => 6,
            Self::Add | Self::Sub => 7,
            Self::Mul | Self::Div | Self::Mod => 8,
            Self::Pow => 9,
        }
    }
}
