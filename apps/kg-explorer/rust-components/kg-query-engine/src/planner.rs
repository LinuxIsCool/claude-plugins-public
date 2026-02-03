//! Query planning: transforms AST into execution plans.
//!
//! The planner converts parsed queries into logical execution plans
//! that can be optimized and executed.

use crate::ast::*;
use crate::{QueryError, Result};
use serde::{Deserialize, Serialize};

/// A logical execution plan for a query.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionPlan {
    pub root: PlanNode,
    pub estimated_cost: f64,
    pub estimated_rows: usize,
    pub required_indexes: Vec<IndexRequirement>,
}

/// Requirements for indexes to execute efficiently.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IndexRequirement {
    pub label: String,
    pub property: String,
    pub index_type: IndexType,
}

/// Types of indexes.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum IndexType {
    BTree,
    Hash,
    Fulltext,
    Vector,
}

/// Nodes in the execution plan tree.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum PlanNode {
    /// Scan all nodes with optional label filter
    NodeScan {
        variable: String,
        label: Option<String>,
    },

    /// Scan all edges with optional type filter
    EdgeScan {
        variable: String,
        rel_type: Option<String>,
    },

    /// Index-based node lookup
    IndexSeek {
        variable: String,
        label: String,
        property: String,
        value: Expr,
    },

    /// Expand from nodes along edges
    Expand {
        input: Box<PlanNode>,
        from_variable: String,
        edge_variable: Option<String>,
        to_variable: String,
        rel_types: Vec<String>,
        direction: Direction,
        min_hops: u32,
        max_hops: Option<u32>,
    },

    /// Filter rows based on predicate
    Filter {
        input: Box<PlanNode>,
        predicate: Expr,
    },

    /// Project specific columns
    Project {
        input: Box<PlanNode>,
        items: Vec<(Expr, String)>,
    },

    /// Sort rows
    Sort {
        input: Box<PlanNode>,
        items: Vec<(Expr, bool)>, // (expr, ascending)
    },

    /// Limit number of rows
    Limit {
        input: Box<PlanNode>,
        count: u64,
    },

    /// Skip rows
    Skip {
        input: Box<PlanNode>,
        count: u64,
    },

    /// Distinct rows
    Distinct {
        input: Box<PlanNode>,
        columns: Vec<String>,
    },

    /// Aggregate rows
    Aggregate {
        input: Box<PlanNode>,
        group_by: Vec<Expr>,
        aggregates: Vec<(AggregateOp, Expr, String)>,
    },

    /// Join two inputs
    HashJoin {
        left: Box<PlanNode>,
        right: Box<PlanNode>,
        on: Vec<(String, String)>,
    },

    /// Nested loop join
    NestedLoopJoin {
        outer: Box<PlanNode>,
        inner: Box<PlanNode>,
        condition: Option<Expr>,
    },

    /// Union of two inputs
    Union {
        left: Box<PlanNode>,
        right: Box<PlanNode>,
        all: bool,
    },

    /// Apply operator (correlated subquery)
    Apply {
        outer: Box<PlanNode>,
        inner: Box<PlanNode>,
        mode: ApplyMode,
    },

    /// Create nodes/edges
    Create {
        input: Box<PlanNode>,
        pattern: Pattern,
    },

    /// Set properties
    SetProperty {
        input: Box<PlanNode>,
        items: Vec<(Expr, Expr)>,
    },

    /// Delete nodes/edges
    Delete {
        input: Box<PlanNode>,
        items: Vec<Expr>,
        detach: bool,
    },

    /// Empty result (optimization result)
    EmptyResult,

    /// Single row with no columns
    SingleRow,
}

/// Aggregate operations.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum AggregateOp {
    Count,
    Sum,
    Avg,
    Min,
    Max,
    Collect,
    First,
    Last,
}

/// Apply modes for correlated subqueries.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ApplyMode {
    Cross,
    Optional,
    Semi,
    AntiSemi,
}

/// Query planner that transforms AST into execution plans.
#[derive(Debug, Default)]
pub struct QueryPlanner {
    // Planner configuration
}

impl QueryPlanner {
    #[must_use]
    pub fn new() -> Self {
        Self::default()
    }

    /// Plan a query, producing an execution plan.
    pub fn plan(&self, query: &Query) -> Result<ExecutionPlan> {
        let mut plan = PlanNode::SingleRow;
        let mut required_indexes = Vec::new();

        for clause in &query.clauses {
            plan = self.plan_clause(clause, plan, &mut required_indexes)?;
        }

        Ok(ExecutionPlan {
            root: plan,
            estimated_cost: 0.0,
            estimated_rows: 0,
            required_indexes,
        })
    }

    fn plan_clause(
        &self,
        clause: &Clause,
        input: PlanNode,
        indexes: &mut Vec<IndexRequirement>,
    ) -> Result<PlanNode> {
        match clause {
            Clause::Match(m) => self.plan_match(m, input, indexes),
            Clause::Where(w) => self.plan_where(w, input),
            Clause::Return(r) => self.plan_return(r, input),
            Clause::OrderBy(o) => self.plan_order_by(o, input),
            Clause::Limit(l) => Ok(PlanNode::Limit {
                input: Box::new(input),
                count: l.count,
            }),
            Clause::Skip(s) => Ok(PlanNode::Skip {
                input: Box::new(input),
                count: s.count,
            }),
            Clause::Create(c) => Ok(PlanNode::Create {
                input: Box::new(input),
                pattern: c.pattern.clone(),
            }),
            Clause::Set(s) => {
                let items = s.items.iter().map(|i| (i.target.clone(), i.value.clone())).collect();
                Ok(PlanNode::SetProperty {
                    input: Box::new(input),
                    items,
                })
            }
            Clause::Delete(d) => Ok(PlanNode::Delete {
                input: Box::new(input),
                items: d.items.clone(),
                detach: d.detach,
            }),
            Clause::With(w) => self.plan_with(w, input),
            Clause::Unwind(_u) => {
                // Unwind requires special handling
                Err(QueryError::PlanningError(
                    "UNWIND not yet implemented".to_string(),
                ))
            }
        }
    }

    fn plan_match(
        &self,
        match_clause: &MatchClause,
        input: PlanNode,
        indexes: &mut Vec<IndexRequirement>,
    ) -> Result<PlanNode> {
        let mut current = input;

        for path in &match_clause.pattern.paths {
            current = self.plan_path_pattern(path, current, indexes)?;
        }

        if match_clause.optional {
            // Wrap in Apply with Optional mode
            current = PlanNode::Apply {
                outer: Box::new(PlanNode::SingleRow),
                inner: Box::new(current),
                mode: ApplyMode::Optional,
            };
        }

        Ok(current)
    }

    fn plan_path_pattern(
        &self,
        path: &PathPattern,
        input: PlanNode,
        indexes: &mut Vec<IndexRequirement>,
    ) -> Result<PlanNode> {
        let mut current = input;
        let mut last_node_var: Option<String> = None;

        for (i, element) in path.elements.iter().enumerate() {
            match element {
                PathElement::Node(node) => {
                    if i == 0 {
                        // First node: scan
                        let var = node
                            .variable
                            .clone()
                            .unwrap_or_else(|| format!("_n{i}"));
                        let label = node.labels.first().cloned();

                        // Check if we can use an index
                        if let (Some(label), Some((prop, _value))) =
                            (label.as_ref(), node.properties.iter().next())
                        {
                            indexes.push(IndexRequirement {
                                label: label.clone(),
                                property: prop.clone(),
                                index_type: IndexType::BTree,
                            });
                        }

                        current = if matches!(current, PlanNode::SingleRow) {
                            PlanNode::NodeScan {
                                variable: var.clone(),
                                label,
                            }
                        } else {
                            // Cross product with existing input
                            PlanNode::NestedLoopJoin {
                                outer: Box::new(current),
                                inner: Box::new(PlanNode::NodeScan {
                                    variable: var.clone(),
                                    label,
                                }),
                                condition: None,
                            }
                        };

                        // Add property filters
                        if !node.properties.is_empty() {
                            let predicate = self.properties_to_predicate(&var, &node.properties);
                            current = PlanNode::Filter {
                                input: Box::new(current),
                                predicate,
                            };
                        }

                        last_node_var = Some(var);
                    } else {
                        // Subsequent nodes are handled by the preceding edge
                        last_node_var = node.variable.clone();
                    }
                }
                PathElement::Edge(edge) => {
                    let from_var = last_node_var
                        .clone()
                        .ok_or_else(|| QueryError::PlanningError("Edge without source node".to_string()))?;

                    // Get next node
                    let next_node = path.elements.get(i + 1);
                    let to_var = if let Some(PathElement::Node(n)) = next_node {
                        n.variable
                            .clone()
                            .unwrap_or_else(|| format!("_n{}", i + 1))
                    } else {
                        format!("_n{}", i + 1)
                    };

                    current = PlanNode::Expand {
                        input: Box::new(current),
                        from_variable: from_var,
                        edge_variable: edge.variable.clone(),
                        to_variable: to_var.clone(),
                        rel_types: edge.rel_types.to_vec(),
                        direction: edge.direction,
                        min_hops: edge.length.as_ref().and_then(|l| l.min).unwrap_or(1),
                        max_hops: edge.length.as_ref().and_then(|l| l.max).or(Some(1)),
                    };

                    // Add edge property filters
                    if !edge.properties.is_empty() {
                        if let Some(ref var) = edge.variable {
                            let predicate = self.properties_to_predicate(var, &edge.properties);
                            current = PlanNode::Filter {
                                input: Box::new(current),
                                predicate,
                            };
                        }
                    }

                    // Add target node property filters
                    if let Some(PathElement::Node(n)) = next_node {
                        if !n.properties.is_empty() {
                            let predicate = self.properties_to_predicate(&to_var, &n.properties);
                            current = PlanNode::Filter {
                                input: Box::new(current),
                                predicate,
                            };
                        }
                    }

                    last_node_var = Some(to_var);
                }
            }
        }

        Ok(current)
    }

    fn properties_to_predicate(
        &self,
        var: &str,
        properties: &indexmap::IndexMap<String, Expr>,
    ) -> Expr {
        let mut predicates: Vec<Expr> = properties
            .iter()
            .map(|(prop, value)| Expr::Binary {
                left: Box::new(Expr::Property {
                    expr: Box::new(Expr::Variable(var.to_string())),
                    name: prop.clone(),
                }),
                op: BinaryOp::Eq,
                right: Box::new(value.clone()),
            })
            .collect();

        if predicates.len() == 1 {
            predicates.remove(0)
        } else {
            predicates
                .into_iter()
                .reduce(|acc, pred| Expr::Binary {
                    left: Box::new(acc),
                    op: BinaryOp::And,
                    right: Box::new(pred),
                })
                .unwrap_or(Expr::Literal(Literal::Boolean(true)))
        }
    }

    fn plan_where(&self, where_clause: &WhereClause, input: PlanNode) -> Result<PlanNode> {
        Ok(PlanNode::Filter {
            input: Box::new(input),
            predicate: where_clause.predicate.clone(),
        })
    }

    fn plan_return(&self, return_clause: &ReturnClause, input: PlanNode) -> Result<PlanNode> {
        let items: Vec<(Expr, String)> = return_clause
            .items
            .iter()
            .enumerate()
            .map(|(i, item)| {
                let alias = item
                    .alias
                    .clone()
                    .unwrap_or_else(|| self.expr_to_name(&item.expr, i));
                (item.expr.clone(), alias)
            })
            .collect();

        let plan = PlanNode::Project {
            input: Box::new(input),
            items,
        };

        if return_clause.distinct {
            let columns = return_clause
                .items
                .iter()
                .enumerate()
                .map(|(i, item)| {
                    item.alias
                        .clone()
                        .unwrap_or_else(|| self.expr_to_name(&item.expr, i))
                })
                .collect();
            Ok(PlanNode::Distinct {
                input: Box::new(plan),
                columns,
            })
        } else {
            Ok(plan)
        }
    }

    fn plan_order_by(&self, order_clause: &OrderByClause, input: PlanNode) -> Result<PlanNode> {
        let items = order_clause
            .items
            .iter()
            .map(|item| (item.expr.clone(), item.ascending))
            .collect();

        Ok(PlanNode::Sort {
            input: Box::new(input),
            items,
        })
    }

    fn plan_with(&self, with_clause: &WithClause, input: PlanNode) -> Result<PlanNode> {
        let items: Vec<(Expr, String)> = with_clause
            .items
            .iter()
            .enumerate()
            .map(|(i, item)| {
                let alias = item
                    .alias
                    .clone()
                    .unwrap_or_else(|| self.expr_to_name(&item.expr, i));
                (item.expr.clone(), alias)
            })
            .collect();

        let plan = PlanNode::Project {
            input: Box::new(input),
            items,
        };

        if with_clause.distinct {
            let columns = with_clause
                .items
                .iter()
                .enumerate()
                .map(|(i, item)| {
                    item.alias
                        .clone()
                        .unwrap_or_else(|| self.expr_to_name(&item.expr, i))
                })
                .collect();
            Ok(PlanNode::Distinct {
                input: Box::new(plan),
                columns,
            })
        } else {
            Ok(plan)
        }
    }

    fn expr_to_name(&self, expr: &Expr, index: usize) -> String {
        match expr {
            Expr::Variable(name) => name.clone(),
            Expr::Property { name, .. } => name.clone(),
            Expr::FunctionCall { name, .. } => name.clone(),
            _ => format!("_col{index}"),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::parser::QueryParser;

    #[test]
    fn test_simple_plan() {
        let parser = QueryParser::new();
        let planner = QueryPlanner::new();

        let query = parser.parse("MATCH (n:Person) RETURN n").unwrap();
        let plan = planner.plan(&query).unwrap();

        assert!(matches!(plan.root, PlanNode::Project { .. }));
    }

    #[test]
    fn test_filter_plan() {
        let parser = QueryParser::new();
        let planner = QueryPlanner::new();

        let query = parser
            .parse("MATCH (n:Person) WHERE n.age > 25 RETURN n")
            .unwrap();
        let plan = planner.plan(&query).unwrap();

        // Should have a filter in the plan
        fn has_filter(node: &PlanNode) -> bool {
            match node {
                PlanNode::Filter { .. } => true,
                PlanNode::Project { input, .. } => has_filter(input),
                PlanNode::Sort { input, .. } => has_filter(input),
                PlanNode::Limit { input, .. } => has_filter(input),
                _ => false,
            }
        }

        assert!(has_filter(&plan.root));
    }
}
