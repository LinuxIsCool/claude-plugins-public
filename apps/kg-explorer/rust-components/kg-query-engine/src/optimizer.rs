//! Query plan optimization.
//!
//! Implements various optimization strategies:
//! - Predicate pushdown
//! - Constant folding
//! - Join reordering
//! - Redundant operation elimination

use crate::ast::*;
use crate::planner::{ExecutionPlan, PlanNode};
use crate::{QueryError, Result};

/// Query optimizer that transforms execution plans.
#[derive(Debug, Default)]
pub struct QueryOptimizer {
    /// Maximum optimization iterations
    max_iterations: usize,
}

impl QueryOptimizer {
    #[must_use]
    pub fn new() -> Self {
        Self {
            max_iterations: 10,
        }
    }

    /// Optimize an execution plan.
    pub fn optimize(&self, mut plan: ExecutionPlan) -> Result<ExecutionPlan> {
        for _ in 0..self.max_iterations {
            let optimized = self.optimize_once(plan.root.clone())?;
            if optimized == plan.root {
                break;
            }
            plan.root = optimized;
        }

        // Estimate costs
        plan.estimated_cost = self.estimate_cost(&plan.root);
        plan.estimated_rows = self.estimate_rows(&plan.root);

        Ok(plan)
    }

    fn optimize_once(&self, node: PlanNode) -> Result<PlanNode> {
        // Apply optimizations in order
        let node = self.fold_constants(node)?;
        let node = self.push_down_predicates(node)?;
        let node = self.eliminate_redundant(node)?;
        let node = self.reorder_joins(node)?;
        Ok(node)
    }

    /// Fold constant expressions.
    fn fold_constants(&self, node: PlanNode) -> Result<PlanNode> {
        match node {
            PlanNode::Filter { input, predicate } => {
                let folded_predicate = self.fold_expr(predicate);

                // If predicate is always true, eliminate filter
                if let Expr::Literal(Literal::Boolean(true)) = &folded_predicate {
                    return self.fold_constants(*input);
                }

                // If predicate is always false, return empty result
                if let Expr::Literal(Literal::Boolean(false)) = &folded_predicate {
                    return Ok(PlanNode::EmptyResult);
                }

                Ok(PlanNode::Filter {
                    input: Box::new(self.fold_constants(*input)?),
                    predicate: folded_predicate,
                })
            }
            PlanNode::Project { input, items } => Ok(PlanNode::Project {
                input: Box::new(self.fold_constants(*input)?),
                items: items
                    .into_iter()
                    .map(|(e, n)| (self.fold_expr(e), n))
                    .collect(),
            }),
            PlanNode::Sort { input, items } => Ok(PlanNode::Sort {
                input: Box::new(self.fold_constants(*input)?),
                items: items
                    .into_iter()
                    .map(|(e, asc)| (self.fold_expr(e), asc))
                    .collect(),
            }),
            PlanNode::Limit { input, count } => Ok(PlanNode::Limit {
                input: Box::new(self.fold_constants(*input)?),
                count,
            }),
            PlanNode::Skip { input, count } => Ok(PlanNode::Skip {
                input: Box::new(self.fold_constants(*input)?),
                count,
            }),
            PlanNode::Expand {
                input,
                from_variable,
                edge_variable,
                to_variable,
                rel_types,
                direction,
                min_hops,
                max_hops,
            } => Ok(PlanNode::Expand {
                input: Box::new(self.fold_constants(*input)?),
                from_variable,
                edge_variable,
                to_variable,
                rel_types,
                direction,
                min_hops,
                max_hops,
            }),
            PlanNode::HashJoin { left, right, on } => Ok(PlanNode::HashJoin {
                left: Box::new(self.fold_constants(*left)?),
                right: Box::new(self.fold_constants(*right)?),
                on,
            }),
            PlanNode::NestedLoopJoin {
                outer,
                inner,
                condition,
            } => Ok(PlanNode::NestedLoopJoin {
                outer: Box::new(self.fold_constants(*outer)?),
                inner: Box::new(self.fold_constants(*inner)?),
                condition: condition.map(|c| self.fold_expr(c)),
            }),
            other => Ok(other),
        }
    }

    fn fold_expr(&self, expr: Expr) -> Expr {
        match expr {
            Expr::Binary { left, op, right } => {
                let left = self.fold_expr(*left);
                let right = self.fold_expr(*right);

                // Try to evaluate constant expressions
                if let (Expr::Literal(l), Expr::Literal(r)) = (&left, &right) {
                    if let Some(result) = self.eval_binary(l, op, r) {
                        return Expr::Literal(result);
                    }
                }

                // Algebraic simplifications
                match (&left, op, &right) {
                    // x AND true = x
                    (x, BinaryOp::And, Expr::Literal(Literal::Boolean(true))) => x.clone(),
                    (Expr::Literal(Literal::Boolean(true)), BinaryOp::And, x) => x.clone(),
                    // x AND false = false
                    (_, BinaryOp::And, Expr::Literal(Literal::Boolean(false)))
                    | (Expr::Literal(Literal::Boolean(false)), BinaryOp::And, _) => {
                        Expr::Literal(Literal::Boolean(false))
                    }
                    // x OR true = true
                    (_, BinaryOp::Or, Expr::Literal(Literal::Boolean(true)))
                    | (Expr::Literal(Literal::Boolean(true)), BinaryOp::Or, _) => {
                        Expr::Literal(Literal::Boolean(true))
                    }
                    // x OR false = x
                    (x, BinaryOp::Or, Expr::Literal(Literal::Boolean(false))) => x.clone(),
                    (Expr::Literal(Literal::Boolean(false)), BinaryOp::Or, x) => x.clone(),
                    // x + 0 = x, x - 0 = x
                    (x, BinaryOp::Add | BinaryOp::Sub, Expr::Literal(Literal::Integer(0))) => {
                        x.clone()
                    }
                    // x * 1 = x, x / 1 = x
                    (x, BinaryOp::Mul | BinaryOp::Div, Expr::Literal(Literal::Integer(1))) => {
                        x.clone()
                    }
                    // x * 0 = 0
                    (_, BinaryOp::Mul, Expr::Literal(Literal::Integer(0)))
                    | (Expr::Literal(Literal::Integer(0)), BinaryOp::Mul, _) => {
                        Expr::Literal(Literal::Integer(0))
                    }
                    _ => Expr::Binary {
                        left: Box::new(left),
                        op,
                        right: Box::new(right),
                    },
                }
            }
            Expr::Unary { op, expr } => {
                let expr = self.fold_expr(*expr);

                match (&op, &expr) {
                    (UnaryOp::Not, Expr::Literal(Literal::Boolean(b))) => {
                        Expr::Literal(Literal::Boolean(!b))
                    }
                    (UnaryOp::Neg, Expr::Literal(Literal::Integer(n))) => {
                        Expr::Literal(Literal::Integer(-n))
                    }
                    (UnaryOp::Neg, Expr::Literal(Literal::Float(n))) => {
                        Expr::Literal(Literal::Float(-n))
                    }
                    // Double negation elimination
                    (UnaryOp::Not, Expr::Unary { op: UnaryOp::Not, expr: inner }) => *inner.clone(),
                    (UnaryOp::Neg, Expr::Unary { op: UnaryOp::Neg, expr: inner }) => *inner.clone(),
                    _ => Expr::Unary {
                        op,
                        expr: Box::new(expr),
                    },
                }
            }
            Expr::FunctionCall { name, args } => Expr::FunctionCall {
                name,
                args: args.into_iter().map(|a| self.fold_expr(a)).collect(),
            },
            Expr::List(items) => Expr::List(items.into_iter().map(|i| self.fold_expr(i)).collect()),
            Expr::Property { expr, name } => Expr::Property {
                expr: Box::new(self.fold_expr(*expr)),
                name,
            },
            Expr::Index { expr, index } => Expr::Index {
                expr: Box::new(self.fold_expr(*expr)),
                index: Box::new(self.fold_expr(*index)),
            },
            other => other,
        }
    }

    fn eval_binary(&self, left: &Literal, op: BinaryOp, right: &Literal) -> Option<Literal> {
        match (left, op, right) {
            // Integer arithmetic
            (Literal::Integer(a), BinaryOp::Add, Literal::Integer(b)) => {
                Some(Literal::Integer(a + b))
            }
            (Literal::Integer(a), BinaryOp::Sub, Literal::Integer(b)) => {
                Some(Literal::Integer(a - b))
            }
            (Literal::Integer(a), BinaryOp::Mul, Literal::Integer(b)) => {
                Some(Literal::Integer(a * b))
            }
            (Literal::Integer(a), BinaryOp::Div, Literal::Integer(b)) if *b != 0 => {
                Some(Literal::Integer(a / b))
            }
            (Literal::Integer(a), BinaryOp::Mod, Literal::Integer(b)) if *b != 0 => {
                Some(Literal::Integer(a % b))
            }

            // Float arithmetic
            (Literal::Float(a), BinaryOp::Add, Literal::Float(b)) => Some(Literal::Float(a + b)),
            (Literal::Float(a), BinaryOp::Sub, Literal::Float(b)) => Some(Literal::Float(a - b)),
            (Literal::Float(a), BinaryOp::Mul, Literal::Float(b)) => Some(Literal::Float(a * b)),
            (Literal::Float(a), BinaryOp::Div, Literal::Float(b)) if *b != 0.0 => {
                Some(Literal::Float(a / b))
            }

            // Comparisons
            (Literal::Integer(a), BinaryOp::Eq, Literal::Integer(b)) => {
                Some(Literal::Boolean(a == b))
            }
            (Literal::Integer(a), BinaryOp::Ne, Literal::Integer(b)) => {
                Some(Literal::Boolean(a != b))
            }
            (Literal::Integer(a), BinaryOp::Lt, Literal::Integer(b)) => {
                Some(Literal::Boolean(a < b))
            }
            (Literal::Integer(a), BinaryOp::Le, Literal::Integer(b)) => {
                Some(Literal::Boolean(a <= b))
            }
            (Literal::Integer(a), BinaryOp::Gt, Literal::Integer(b)) => {
                Some(Literal::Boolean(a > b))
            }
            (Literal::Integer(a), BinaryOp::Ge, Literal::Integer(b)) => {
                Some(Literal::Boolean(a >= b))
            }

            // String comparisons
            (Literal::String(a), BinaryOp::Eq, Literal::String(b)) => {
                Some(Literal::Boolean(a == b))
            }
            (Literal::String(a), BinaryOp::Ne, Literal::String(b)) => {
                Some(Literal::Boolean(a != b))
            }
            (Literal::String(a), BinaryOp::Contains, Literal::String(b)) => {
                Some(Literal::Boolean(a.contains(b.as_str())))
            }
            (Literal::String(a), BinaryOp::StartsWith, Literal::String(b)) => {
                Some(Literal::Boolean(a.starts_with(b.as_str())))
            }
            (Literal::String(a), BinaryOp::EndsWith, Literal::String(b)) => {
                Some(Literal::Boolean(a.ends_with(b.as_str())))
            }

            // Boolean operations
            (Literal::Boolean(a), BinaryOp::And, Literal::Boolean(b)) => {
                Some(Literal::Boolean(*a && *b))
            }
            (Literal::Boolean(a), BinaryOp::Or, Literal::Boolean(b)) => {
                Some(Literal::Boolean(*a || *b))
            }
            (Literal::Boolean(a), BinaryOp::Xor, Literal::Boolean(b)) => {
                Some(Literal::Boolean(*a ^ *b))
            }

            _ => None,
        }
    }

    /// Push predicates down closer to data sources.
    fn push_down_predicates(&self, node: PlanNode) -> Result<PlanNode> {
        match node {
            PlanNode::Filter {
                input,
                predicate,
            } => {
                let inner = *input;
                match inner {
                    // Push filter below project
                    PlanNode::Project { input, items } => {
                        // Check if predicate only references projected columns
                        if self.can_push_through_project(&predicate, &items) {
                            Ok(PlanNode::Project {
                                input: Box::new(PlanNode::Filter {
                                    input,
                                    predicate,
                                }),
                                items,
                            })
                        } else {
                            Ok(PlanNode::Filter {
                                input: Box::new(PlanNode::Project { input, items }),
                                predicate,
                            })
                        }
                    }
                    // Push filter below sort
                    PlanNode::Sort { input, items } => {
                        Ok(PlanNode::Sort {
                            input: Box::new(PlanNode::Filter { input, predicate }),
                            items,
                        })
                    }
                    // Merge consecutive filters
                    PlanNode::Filter {
                        input: inner_input,
                        predicate: inner_pred,
                    } => {
                        let combined = Expr::Binary {
                            left: Box::new(inner_pred),
                            op: BinaryOp::And,
                            right: Box::new(predicate),
                        };
                        self.push_down_predicates(PlanNode::Filter {
                            input: inner_input,
                            predicate: combined,
                        })
                    }
                    // Push through expand if predicate only uses source variable
                    PlanNode::Expand {
                        input,
                        from_variable,
                        edge_variable,
                        to_variable,
                        rel_types,
                        direction,
                        min_hops,
                        max_hops,
                    } => {
                        let (source_preds, other_preds) =
                            self.split_predicates(&predicate, &from_variable);

                        let mut result = if let Some(src_pred) = source_preds {
                            PlanNode::Expand {
                                input: Box::new(PlanNode::Filter {
                                    input,
                                    predicate: src_pred,
                                }),
                                from_variable,
                                edge_variable,
                                to_variable,
                                rel_types,
                                direction,
                                min_hops,
                                max_hops,
                            }
                        } else {
                            PlanNode::Expand {
                                input,
                                from_variable,
                                edge_variable,
                                to_variable,
                                rel_types,
                                direction,
                                min_hops,
                                max_hops,
                            }
                        };

                        if let Some(other_pred) = other_preds {
                            result = PlanNode::Filter {
                                input: Box::new(result),
                                predicate: other_pred,
                            };
                        }

                        Ok(result)
                    }
                    other => Ok(PlanNode::Filter {
                        input: Box::new(self.push_down_predicates(other)?),
                        predicate,
                    }),
                }
            }
            // Recursively process children
            PlanNode::Project { input, items } => Ok(PlanNode::Project {
                input: Box::new(self.push_down_predicates(*input)?),
                items,
            }),
            PlanNode::Sort { input, items } => Ok(PlanNode::Sort {
                input: Box::new(self.push_down_predicates(*input)?),
                items,
            }),
            PlanNode::Limit { input, count } => Ok(PlanNode::Limit {
                input: Box::new(self.push_down_predicates(*input)?),
                count,
            }),
            PlanNode::Skip { input, count } => Ok(PlanNode::Skip {
                input: Box::new(self.push_down_predicates(*input)?),
                count,
            }),
            PlanNode::Expand {
                input,
                from_variable,
                edge_variable,
                to_variable,
                rel_types,
                direction,
                min_hops,
                max_hops,
            } => Ok(PlanNode::Expand {
                input: Box::new(self.push_down_predicates(*input)?),
                from_variable,
                edge_variable,
                to_variable,
                rel_types,
                direction,
                min_hops,
                max_hops,
            }),
            other => Ok(other),
        }
    }

    fn can_push_through_project(&self, predicate: &Expr, _items: &[(Expr, String)]) -> bool {
        // Simple check: if predicate only uses variables, it can be pushed
        self.expr_uses_only_variables(predicate)
    }

    fn expr_uses_only_variables(&self, expr: &Expr) -> bool {
        match expr {
            Expr::Variable(_) => true,
            Expr::Literal(_) => true,
            Expr::Property { expr, .. } => self.expr_uses_only_variables(expr),
            Expr::Binary { left, right, .. } => {
                self.expr_uses_only_variables(left) && self.expr_uses_only_variables(right)
            }
            Expr::Unary { expr, .. } => self.expr_uses_only_variables(expr),
            _ => false,
        }
    }

    fn split_predicates(&self, predicate: &Expr, var: &str) -> (Option<Expr>, Option<Expr>) {
        match predicate {
            Expr::Binary {
                left,
                op: BinaryOp::And,
                right,
            } => {
                let (left_src, left_other) = self.split_predicates(left, var);
                let (right_src, right_other) = self.split_predicates(right, var);

                let source = match (left_src, right_src) {
                    (Some(l), Some(r)) => Some(Expr::Binary {
                        left: Box::new(l),
                        op: BinaryOp::And,
                        right: Box::new(r),
                    }),
                    (Some(l), None) => Some(l),
                    (None, Some(r)) => Some(r),
                    (None, None) => None,
                };

                let other = match (left_other, right_other) {
                    (Some(l), Some(r)) => Some(Expr::Binary {
                        left: Box::new(l),
                        op: BinaryOp::And,
                        right: Box::new(r),
                    }),
                    (Some(l), None) => Some(l),
                    (None, Some(r)) => Some(r),
                    (None, None) => None,
                };

                (source, other)
            }
            _ => {
                if self.expr_references_only(predicate, var) {
                    (Some(predicate.clone()), None)
                } else {
                    (None, Some(predicate.clone()))
                }
            }
        }
    }

    fn expr_references_only(&self, expr: &Expr, var: &str) -> bool {
        match expr {
            Expr::Variable(v) => v == var,
            Expr::Literal(_) => true,
            Expr::Property { expr, .. } => self.expr_references_only(expr, var),
            Expr::Binary { left, right, .. } => {
                self.expr_references_only(left, var) && self.expr_references_only(right, var)
            }
            Expr::Unary { expr, .. } => self.expr_references_only(expr, var),
            _ => false,
        }
    }

    /// Eliminate redundant operations.
    fn eliminate_redundant(&self, node: PlanNode) -> Result<PlanNode> {
        match node {
            // Skip 0 is identity
            PlanNode::Skip { input, count: 0 } => self.eliminate_redundant(*input),
            // Distinct after distinct is redundant
            PlanNode::Distinct {
                input,
                columns,
            } => {
                let inner = self.eliminate_redundant(*input)?;
                if matches!(inner, PlanNode::Distinct { .. }) {
                    Ok(inner)
                } else {
                    Ok(PlanNode::Distinct {
                        input: Box::new(inner),
                        columns,
                    })
                }
            }
            // Limit 0 produces empty result
            PlanNode::Limit { count: 0, .. } => Ok(PlanNode::EmptyResult),
            // Recursively process children
            PlanNode::Filter { input, predicate } => Ok(PlanNode::Filter {
                input: Box::new(self.eliminate_redundant(*input)?),
                predicate,
            }),
            PlanNode::Project { input, items } => Ok(PlanNode::Project {
                input: Box::new(self.eliminate_redundant(*input)?),
                items,
            }),
            PlanNode::Sort { input, items } => Ok(PlanNode::Sort {
                input: Box::new(self.eliminate_redundant(*input)?),
                items,
            }),
            PlanNode::Limit { input, count } => Ok(PlanNode::Limit {
                input: Box::new(self.eliminate_redundant(*input)?),
                count,
            }),
            PlanNode::Skip { input, count } => Ok(PlanNode::Skip {
                input: Box::new(self.eliminate_redundant(*input)?),
                count,
            }),
            other => Ok(other),
        }
    }

    /// Reorder joins for better performance.
    fn reorder_joins(&self, node: PlanNode) -> Result<PlanNode> {
        // Basic join reordering: prefer smaller tables on build side
        // This is a simplified implementation
        match node {
            PlanNode::HashJoin { left, right, on } => {
                let left = self.reorder_joins(*left)?;
                let right = self.reorder_joins(*right)?;

                let left_cost = self.estimate_rows(&left);
                let right_cost = self.estimate_rows(&right);

                // Put smaller input on the right (build side)
                if left_cost < right_cost {
                    let swapped_on = on.into_iter().map(|(l, r)| (r, l)).collect();
                    Ok(PlanNode::HashJoin {
                        left: Box::new(right),
                        right: Box::new(left),
                        on: swapped_on,
                    })
                } else {
                    Ok(PlanNode::HashJoin {
                        left: Box::new(left),
                        right: Box::new(right),
                        on,
                    })
                }
            }
            // Recursively process children
            PlanNode::Filter { input, predicate } => Ok(PlanNode::Filter {
                input: Box::new(self.reorder_joins(*input)?),
                predicate,
            }),
            PlanNode::Project { input, items } => Ok(PlanNode::Project {
                input: Box::new(self.reorder_joins(*input)?),
                items,
            }),
            other => Ok(other),
        }
    }

    fn estimate_cost(&self, node: &PlanNode) -> f64 {
        match node {
            PlanNode::EmptyResult => 0.0,
            PlanNode::SingleRow => 1.0,
            PlanNode::NodeScan { label, .. } => {
                if label.is_some() {
                    100.0
                } else {
                    1000.0
                }
            }
            PlanNode::EdgeScan { rel_type, .. } => {
                if rel_type.is_some() {
                    200.0
                } else {
                    2000.0
                }
            }
            PlanNode::IndexSeek { .. } => 10.0,
            PlanNode::Filter { input, .. } => self.estimate_cost(input) * 1.1,
            PlanNode::Project { input, .. } => self.estimate_cost(input) * 1.05,
            PlanNode::Sort { input, .. } => {
                let n = self.estimate_rows(input) as f64;
                self.estimate_cost(input) + n * n.log2()
            }
            PlanNode::Limit { input, .. } => self.estimate_cost(input),
            PlanNode::Skip { input, .. } => self.estimate_cost(input),
            PlanNode::Expand { input, .. } => self.estimate_cost(input) * 10.0,
            PlanNode::HashJoin { left, right, .. } => {
                self.estimate_cost(left) + self.estimate_cost(right) * 2.0
            }
            PlanNode::NestedLoopJoin { outer, inner, .. } => {
                self.estimate_cost(outer) * self.estimate_cost(inner)
            }
            _ => 100.0,
        }
    }

    fn estimate_rows(&self, node: &PlanNode) -> usize {
        match node {
            PlanNode::EmptyResult => 0,
            PlanNode::SingleRow => 1,
            PlanNode::NodeScan { label, .. } => {
                if label.is_some() {
                    1000
                } else {
                    10000
                }
            }
            PlanNode::EdgeScan { rel_type, .. } => {
                if rel_type.is_some() {
                    5000
                } else {
                    50000
                }
            }
            PlanNode::IndexSeek { .. } => 10,
            PlanNode::Filter { input, .. } => self.estimate_rows(input) / 10,
            PlanNode::Project { input, .. } => self.estimate_rows(input),
            PlanNode::Sort { input, .. } => self.estimate_rows(input),
            PlanNode::Limit { input, count } => self.estimate_rows(input).min(*count as usize),
            PlanNode::Skip { input, count } => {
                self.estimate_rows(input).saturating_sub(*count as usize)
            }
            PlanNode::Distinct { input, .. } => self.estimate_rows(input) / 2,
            PlanNode::Expand { input, .. } => self.estimate_rows(input) * 5,
            PlanNode::HashJoin { left, right, .. } => {
                (self.estimate_rows(left) * self.estimate_rows(right)) / 100
            }
            PlanNode::NestedLoopJoin { outer, inner, .. } => {
                self.estimate_rows(outer) * self.estimate_rows(inner) / 10
            }
            _ => 1000,
        }
    }
}

impl PartialEq for PlanNode {
    fn eq(&self, other: &Self) -> bool {
        // Structural equality for optimization convergence detection
        match (self, other) {
            (
                PlanNode::NodeScan {
                    variable: v1,
                    label: l1,
                },
                PlanNode::NodeScan {
                    variable: v2,
                    label: l2,
                },
            ) => v1 == v2 && l1 == l2,
            (PlanNode::EmptyResult, PlanNode::EmptyResult) => true,
            (PlanNode::SingleRow, PlanNode::SingleRow) => true,
            (
                PlanNode::Filter {
                    input: i1,
                    predicate: p1,
                },
                PlanNode::Filter {
                    input: i2,
                    predicate: p2,
                },
            ) => i1 == i2 && p1 == p2,
            (
                PlanNode::Project {
                    input: i1,
                    items: it1,
                },
                PlanNode::Project {
                    input: i2,
                    items: it2,
                },
            ) => i1 == i2 && it1 == it2,
            (
                PlanNode::Limit {
                    input: i1,
                    count: c1,
                },
                PlanNode::Limit {
                    input: i2,
                    count: c2,
                },
            ) => i1 == i2 && c1 == c2,
            _ => false, // Conservative: different variants are not equal
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_constant_folding() {
        let optimizer = QueryOptimizer::new();

        let expr = Expr::Binary {
            left: Box::new(Expr::Literal(Literal::Integer(2))),
            op: BinaryOp::Add,
            right: Box::new(Expr::Literal(Literal::Integer(3))),
        };

        let folded = optimizer.fold_expr(expr);
        assert_eq!(folded, Expr::Literal(Literal::Integer(5)));
    }

    #[test]
    fn test_boolean_simplification() {
        let optimizer = QueryOptimizer::new();

        let expr = Expr::Binary {
            left: Box::new(Expr::Variable("x".to_string())),
            op: BinaryOp::And,
            right: Box::new(Expr::Literal(Literal::Boolean(true))),
        };

        let folded = optimizer.fold_expr(expr);
        assert_eq!(folded, Expr::Variable("x".to_string()));
    }

    #[test]
    fn test_filter_elimination() {
        let optimizer = QueryOptimizer::new();

        let plan = ExecutionPlan {
            root: PlanNode::Filter {
                input: Box::new(PlanNode::NodeScan {
                    variable: "n".to_string(),
                    label: Some("Person".to_string()),
                }),
                predicate: Expr::Literal(Literal::Boolean(true)),
            },
            estimated_cost: 0.0,
            estimated_rows: 0,
            required_indexes: vec![],
        };

        let optimized = optimizer.optimize(plan).unwrap();

        // Filter should be eliminated
        assert!(matches!(optimized.root, PlanNode::NodeScan { .. }));
    }
}
