//! Query parser with zero-copy tokenization.
//!
//! Implements a recursive descent parser with predictive parsing
//! for the Cypher-like query language.

use crate::ast::*;
use crate::{QueryError, Result};
use indexmap::IndexMap;
use smallvec::SmallVec;
use std::iter::Peekable;
use std::str::CharIndices;

/// Token types produced by the lexer.
#[derive(Debug, Clone, PartialEq)]
pub enum Token<'a> {
    // Keywords
    Match,
    OptionalMatch,
    Where,
    Return,
    OrderBy,
    Limit,
    Skip,
    Create,
    Set,
    Delete,
    DetachDelete,
    With,
    Unwind,
    As,
    Distinct,
    And,
    Or,
    Xor,
    Not,
    In,
    Is,
    Null,
    True,
    False,
    Contains,
    StartsWith,
    EndsWith,
    Case,
    When,
    Then,
    Else,
    End,
    Exists,
    Count,
    Asc,
    Desc,

    // Identifiers and literals
    Ident(&'a str),
    Integer(i64),
    Float(f64),
    String(&'a str),
    Parameter(&'a str),

    // Punctuation
    LParen,
    RParen,
    LBracket,
    RBracket,
    LBrace,
    RBrace,
    Colon,
    Comma,
    Dot,
    Pipe,
    Arrow,      // ->
    LeftArrow,  // <-
    Dash,       // -
    DoubleDot,  // ..

    // Operators
    Eq,     // =
    EqEq,   // ==
    Ne,     // <>
    Lt,     // <
    Le,     // <=
    Gt,     // >
    Ge,     // >=
    Plus,   // +
    Minus,  // -
    Star,   // *
    Slash,  // /
    Percent, // %
    Caret,  // ^

    // Special
    Eof,
}

/// Streaming lexer for query strings.
pub struct Lexer<'a> {
    input: &'a str,
    chars: Peekable<CharIndices<'a>>,
    position: usize,
}

impl<'a> Lexer<'a> {
    pub fn new(input: &'a str) -> Self {
        Self {
            input,
            chars: input.char_indices().peekable(),
            position: 0,
        }
    }

    fn peek_char(&mut self) -> Option<char> {
        self.chars.peek().map(|&(_, c)| c)
    }

    fn next_char(&mut self) -> Option<(usize, char)> {
        let result = self.chars.next();
        if let Some((pos, _)) = result {
            self.position = pos + 1;
        }
        result
    }

    fn skip_whitespace(&mut self) {
        while let Some(c) = self.peek_char() {
            if c.is_whitespace() {
                self.next_char();
            } else if c == '/' {
                // Check for comments
                let pos = self.position;
                self.next_char();
                if self.peek_char() == Some('/') {
                    // Line comment
                    while let Some(c) = self.peek_char() {
                        if c == '\n' {
                            break;
                        }
                        self.next_char();
                    }
                } else if self.peek_char() == Some('*') {
                    // Block comment
                    self.next_char();
                    loop {
                        match self.next_char() {
                            Some((_, '*')) if self.peek_char() == Some('/') => {
                                self.next_char();
                                break;
                            }
                            None => break,
                            _ => {}
                        }
                    }
                } else {
                    // Not a comment, backtrack
                    self.chars = self.input[pos..].char_indices().peekable();
                    self.position = pos;
                    break;
                }
            } else {
                break;
            }
        }
    }

    fn read_identifier(&mut self, start: usize) -> &'a str {
        while let Some(c) = self.peek_char() {
            if c.is_alphanumeric() || c == '_' {
                self.next_char();
            } else {
                break;
            }
        }
        &self.input[start..self.position]
    }

    fn read_number(&mut self, start: usize) -> Token<'a> {
        let mut has_dot = false;
        let mut has_exp = false;

        while let Some(c) = self.peek_char() {
            if c.is_ascii_digit() {
                self.next_char();
            } else if c == '.' && !has_dot && !has_exp {
                // Check if this is really a decimal point
                let next_pos = self.position + 1;
                if next_pos < self.input.len() {
                    let next = self.input[next_pos..].chars().next();
                    if next.is_some_and(|c| c.is_ascii_digit()) {
                        has_dot = true;
                        self.next_char();
                    } else {
                        break;
                    }
                } else {
                    break;
                }
            } else if (c == 'e' || c == 'E') && !has_exp {
                has_exp = true;
                self.next_char();
                if self.peek_char() == Some('+') || self.peek_char() == Some('-') {
                    self.next_char();
                }
            } else {
                break;
            }
        }

        let text = &self.input[start..self.position];
        if has_dot || has_exp {
            Token::Float(text.parse().unwrap_or(0.0))
        } else {
            Token::Integer(text.parse().unwrap_or(0))
        }
    }

    fn read_string(&mut self, quote: char) -> Result<&'a str> {
        let start = self.position;
        loop {
            match self.next_char() {
                Some((_, c)) if c == quote => {
                    return Ok(&self.input[start..self.position - 1]);
                }
                Some((_, '\\')) => {
                    self.next_char(); // Skip escaped character
                }
                Some(_) => {}
                None => {
                    return Err(QueryError::ParseError {
                        position: start,
                        message: "Unterminated string".to_string(),
                    });
                }
            }
        }
    }

    pub fn next_token(&mut self) -> Result<Token<'a>> {
        self.skip_whitespace();

        let Some((start, c)) = self.next_char() else {
            return Ok(Token::Eof);
        };

        match c {
            '(' => Ok(Token::LParen),
            ')' => Ok(Token::RParen),
            '[' => Ok(Token::LBracket),
            ']' => Ok(Token::RBracket),
            '{' => Ok(Token::LBrace),
            '}' => Ok(Token::RBrace),
            ':' => Ok(Token::Colon),
            ',' => Ok(Token::Comma),
            '|' => Ok(Token::Pipe),
            '+' => Ok(Token::Plus),
            '*' => Ok(Token::Star),
            '/' => Ok(Token::Slash),
            '%' => Ok(Token::Percent),
            '^' => Ok(Token::Caret),
            '.' => {
                if self.peek_char() == Some('.') {
                    self.next_char();
                    Ok(Token::DoubleDot)
                } else {
                    Ok(Token::Dot)
                }
            }
            '-' => {
                if self.peek_char() == Some('>') {
                    self.next_char();
                    Ok(Token::Arrow)
                } else {
                    Ok(Token::Dash)
                }
            }
            '<' => {
                if self.peek_char() == Some('-') {
                    self.next_char();
                    Ok(Token::LeftArrow)
                } else if self.peek_char() == Some('=') {
                    self.next_char();
                    Ok(Token::Le)
                } else if self.peek_char() == Some('>') {
                    self.next_char();
                    Ok(Token::Ne)
                } else {
                    Ok(Token::Lt)
                }
            }
            '>' => {
                if self.peek_char() == Some('=') {
                    self.next_char();
                    Ok(Token::Ge)
                } else {
                    Ok(Token::Gt)
                }
            }
            '=' => {
                if self.peek_char() == Some('=') {
                    self.next_char();
                    Ok(Token::EqEq)
                } else {
                    Ok(Token::Eq)
                }
            }
            '\'' | '"' => {
                let s = self.read_string(c)?;
                Ok(Token::String(s))
            }
            '$' => {
                let ident = self.read_identifier(self.position);
                Ok(Token::Parameter(ident))
            }
            '`' => {
                let s = self.read_string('`')?;
                Ok(Token::Ident(s))
            }
            _ if c.is_alphabetic() || c == '_' => {
                let ident = self.read_identifier(start);
                Ok(Self::keyword_or_ident(ident))
            }
            _ if c.is_ascii_digit() => Ok(self.read_number(start)),
            _ => Err(QueryError::ParseError {
                position: start,
                message: format!("Unexpected character: {c}"),
            }),
        }
    }

    fn keyword_or_ident(s: &str) -> Token<'_> {
        match s.to_uppercase().as_str() {
            "MATCH" => Token::Match,
            "OPTIONAL" => Token::OptionalMatch,
            "WHERE" => Token::Where,
            "RETURN" => Token::Return,
            "ORDER" => Token::OrderBy,
            "BY" => Token::OrderBy,
            "LIMIT" => Token::Limit,
            "SKIP" => Token::Skip,
            "CREATE" => Token::Create,
            "SET" => Token::Set,
            "DELETE" => Token::Delete,
            "DETACH" => Token::DetachDelete,
            "WITH" => Token::With,
            "UNWIND" => Token::Unwind,
            "AS" => Token::As,
            "DISTINCT" => Token::Distinct,
            "AND" => Token::And,
            "OR" => Token::Or,
            "XOR" => Token::Xor,
            "NOT" => Token::Not,
            "IN" => Token::In,
            "IS" => Token::Is,
            "NULL" => Token::Null,
            "TRUE" => Token::True,
            "FALSE" => Token::False,
            "CONTAINS" => Token::Contains,
            "STARTS" => Token::StartsWith,
            "ENDS" => Token::EndsWith,
            "CASE" => Token::Case,
            "WHEN" => Token::When,
            "THEN" => Token::Then,
            "ELSE" => Token::Else,
            "END" => Token::End,
            "EXISTS" => Token::Exists,
            "COUNT" => Token::Count,
            "ASC" | "ASCENDING" => Token::Asc,
            "DESC" | "DESCENDING" => Token::Desc,
            _ => Token::Ident(s),
        }
    }
}

/// Query parser using recursive descent.
#[derive(Debug, Default)]
pub struct QueryParser {
    // Parser configuration can be added here
}

impl QueryParser {
    #[must_use]
    pub fn new() -> Self {
        Self::default()
    }

    /// Tokenize a query string into an iterator of tokens.
    pub fn tokenize<'a>(&self, query: &'a str) -> impl Iterator<Item = Token<'a>> + 'a {
        TokenIterator {
            lexer: Lexer::new(query),
            done: false,
        }
    }

    /// Parse a query string into an AST.
    pub fn parse(&self, query: &str) -> Result<Query> {
        let mut parser = Parser::new(query);
        parser.parse_query()
    }
}

struct TokenIterator<'a> {
    lexer: Lexer<'a>,
    done: bool,
}

impl<'a> Iterator for TokenIterator<'a> {
    type Item = Token<'a>;

    fn next(&mut self) -> Option<Self::Item> {
        if self.done {
            return None;
        }
        match self.lexer.next_token() {
            Ok(Token::Eof) => {
                self.done = true;
                Some(Token::Eof)
            }
            Ok(token) => Some(token),
            Err(_) => {
                self.done = true;
                None
            }
        }
    }
}

struct Parser<'a> {
    lexer: Lexer<'a>,
    current: Token<'a>,
}

impl<'a> Parser<'a> {
    fn new(input: &'a str) -> Self {
        let mut lexer = Lexer::new(input);
        let current = lexer.next_token().unwrap_or(Token::Eof);
        Self { lexer, current }
    }

    fn advance(&mut self) -> Result<Token<'a>> {
        let prev = std::mem::replace(&mut self.current, self.lexer.next_token()?);
        Ok(prev)
    }

    fn expect(&mut self, expected: Token<'_>) -> Result<()> {
        if std::mem::discriminant(&self.current) == std::mem::discriminant(&expected) {
            self.advance()?;
            Ok(())
        } else {
            Err(QueryError::ParseError {
                position: self.lexer.position,
                message: format!("Expected {expected:?}, found {:?}", self.current),
            })
        }
    }

    fn parse_query(&mut self) -> Result<Query> {
        let mut clauses = Vec::new();

        loop {
            match &self.current {
                Token::Match => clauses.push(self.parse_match()?),
                Token::OptionalMatch => clauses.push(self.parse_optional_match()?),
                Token::Where => clauses.push(self.parse_where()?),
                Token::Return => clauses.push(self.parse_return()?),
                Token::OrderBy => clauses.push(self.parse_order_by()?),
                Token::Limit => clauses.push(self.parse_limit()?),
                Token::Skip => clauses.push(self.parse_skip()?),
                Token::Create => clauses.push(self.parse_create()?),
                Token::With => clauses.push(self.parse_with()?),
                Token::Eof => break,
                _ => {
                    return Err(QueryError::ParseError {
                        position: self.lexer.position,
                        message: format!("Unexpected token: {:?}", self.current),
                    });
                }
            }
        }

        Ok(Query { clauses })
    }

    fn parse_match(&mut self) -> Result<Clause> {
        self.expect(Token::Match)?;
        let pattern = self.parse_pattern()?;
        Ok(Clause::Match(MatchClause {
            pattern,
            optional: false,
        }))
    }

    fn parse_optional_match(&mut self) -> Result<Clause> {
        self.expect(Token::OptionalMatch)?;
        self.expect(Token::Match)?;
        let pattern = self.parse_pattern()?;
        Ok(Clause::Match(MatchClause {
            pattern,
            optional: true,
        }))
    }

    fn parse_where(&mut self) -> Result<Clause> {
        self.expect(Token::Where)?;
        let predicate = self.parse_expression()?;
        Ok(Clause::Where(WhereClause { predicate }))
    }

    fn parse_return(&mut self) -> Result<Clause> {
        self.expect(Token::Return)?;
        let distinct = matches!(self.current, Token::Distinct);
        if distinct {
            self.advance()?;
        }
        let items = self.parse_return_items()?;
        Ok(Clause::Return(ReturnClause { items, distinct }))
    }

    fn parse_return_items(&mut self) -> Result<Vec<ReturnItem>> {
        let mut items = vec![self.parse_return_item()?];
        while matches!(self.current, Token::Comma) {
            self.advance()?;
            items.push(self.parse_return_item()?);
        }
        Ok(items)
    }

    fn parse_return_item(&mut self) -> Result<ReturnItem> {
        let expr = self.parse_expression()?;
        let alias = if matches!(self.current, Token::As) {
            self.advance()?;
            if let Token::Ident(name) = &self.current {
                let name = (*name).to_string();
                self.advance()?;
                Some(name)
            } else {
                return Err(QueryError::ParseError {
                    position: self.lexer.position,
                    message: "Expected identifier after AS".to_string(),
                });
            }
        } else {
            None
        };
        Ok(ReturnItem { expr, alias })
    }

    fn parse_order_by(&mut self) -> Result<Clause> {
        self.advance()?; // ORDER
        if matches!(self.current, Token::OrderBy) {
            self.advance()?; // BY
        }
        let mut items = vec![self.parse_order_item()?];
        while matches!(self.current, Token::Comma) {
            self.advance()?;
            items.push(self.parse_order_item()?);
        }
        Ok(Clause::OrderBy(OrderByClause { items }))
    }

    fn parse_order_item(&mut self) -> Result<OrderItem> {
        let expr = self.parse_expression()?;
        let ascending = if matches!(self.current, Token::Desc) {
            self.advance()?;
            false
        } else {
            if matches!(self.current, Token::Asc) {
                self.advance()?;
            }
            true
        };
        Ok(OrderItem { expr, ascending })
    }

    fn parse_limit(&mut self) -> Result<Clause> {
        self.expect(Token::Limit)?;
        if let Token::Integer(n) = self.current {
            self.advance()?;
            Ok(Clause::Limit(LimitClause { count: n as u64 }))
        } else {
            Err(QueryError::ParseError {
                position: self.lexer.position,
                message: "Expected integer after LIMIT".to_string(),
            })
        }
    }

    fn parse_skip(&mut self) -> Result<Clause> {
        self.expect(Token::Skip)?;
        if let Token::Integer(n) = self.current {
            self.advance()?;
            Ok(Clause::Skip(SkipClause { count: n as u64 }))
        } else {
            Err(QueryError::ParseError {
                position: self.lexer.position,
                message: "Expected integer after SKIP".to_string(),
            })
        }
    }

    fn parse_create(&mut self) -> Result<Clause> {
        self.expect(Token::Create)?;
        let pattern = self.parse_pattern()?;
        Ok(Clause::Create(CreateClause { pattern }))
    }

    fn parse_with(&mut self) -> Result<Clause> {
        self.expect(Token::With)?;
        let distinct = matches!(self.current, Token::Distinct);
        if distinct {
            self.advance()?;
        }
        let items = self.parse_return_items()?;
        Ok(Clause::With(WithClause { items, distinct }))
    }

    fn parse_pattern(&mut self) -> Result<Pattern> {
        let mut paths = vec![self.parse_path_pattern()?];
        while matches!(self.current, Token::Comma) {
            self.advance()?;
            paths.push(self.parse_path_pattern()?);
        }
        Ok(Pattern { paths })
    }

    fn parse_path_pattern(&mut self) -> Result<PathPattern> {
        let mut elements = Vec::new();

        // First element must be a node
        elements.push(PathElement::Node(self.parse_node_pattern()?));

        // Then alternating edges and nodes
        while self.is_edge_start() {
            elements.push(PathElement::Edge(self.parse_edge_pattern()?));
            elements.push(PathElement::Node(self.parse_node_pattern()?));
        }

        Ok(PathPattern { elements })
    }

    fn is_edge_start(&self) -> bool {
        matches!(self.current, Token::Dash | Token::LeftArrow)
    }

    fn parse_node_pattern(&mut self) -> Result<NodePattern> {
        self.expect(Token::LParen)?;

        let mut node = NodePattern::default();

        // Variable name
        if let Token::Ident(name) = &self.current {
            node.variable = Some((*name).to_string());
            self.advance()?;
        }

        // Labels
        while matches!(self.current, Token::Colon) {
            self.advance()?;
            if let Token::Ident(label) = &self.current {
                node.labels.push((*label).to_string());
                self.advance()?;
            } else {
                return Err(QueryError::ParseError {
                    position: self.lexer.position,
                    message: "Expected label after ':'".to_string(),
                });
            }
        }

        // Properties
        if matches!(self.current, Token::LBrace) {
            node.properties = self.parse_map_literal()?;
        }

        self.expect(Token::RParen)?;
        Ok(node)
    }

    fn parse_edge_pattern(&mut self) -> Result<EdgePattern> {
        let mut edge = EdgePattern::default();

        // Direction: <- or -
        if matches!(self.current, Token::LeftArrow) {
            edge.direction = Direction::Incoming;
            self.advance()?;
        } else {
            self.expect(Token::Dash)?;
        }

        // Edge details (optional)
        if matches!(self.current, Token::LBracket) {
            self.advance()?;

            // Variable
            if let Token::Ident(name) = &self.current {
                edge.variable = Some((*name).to_string());
                self.advance()?;
            }

            // Types
            while matches!(self.current, Token::Colon) {
                self.advance()?;
                if let Token::Ident(rel_type) = &self.current {
                    edge.rel_types.push((*rel_type).to_string());
                    self.advance()?;
                }
                if matches!(self.current, Token::Pipe) {
                    self.advance()?;
                }
            }

            // Length specification
            if matches!(self.current, Token::Star) {
                self.advance()?;
                edge.length = Some(self.parse_length_spec()?);
            }

            // Properties
            if matches!(self.current, Token::LBrace) {
                edge.properties = self.parse_map_literal()?;
            }

            self.expect(Token::RBracket)?;
        }

        // Direction: -> or -
        if matches!(self.current, Token::Arrow) {
            if edge.direction == Direction::Incoming {
                edge.direction = Direction::Both;
            } else {
                edge.direction = Direction::Outgoing;
            }
            self.advance()?;
        } else {
            self.expect(Token::Dash)?;
        }

        Ok(edge)
    }

    fn parse_length_spec(&mut self) -> Result<LengthSpec> {
        let mut spec = LengthSpec {
            min: None,
            max: None,
        };

        if let Token::Integer(n) = self.current {
            spec.min = Some(n as u32);
            self.advance()?;

            if matches!(self.current, Token::DoubleDot) {
                self.advance()?;
                if let Token::Integer(m) = self.current {
                    spec.max = Some(m as u32);
                    self.advance()?;
                }
            } else {
                spec.max = spec.min;
            }
        } else if matches!(self.current, Token::DoubleDot) {
            self.advance()?;
            if let Token::Integer(m) = self.current {
                spec.max = Some(m as u32);
                self.advance()?;
            }
        }

        Ok(spec)
    }

    fn parse_map_literal(&mut self) -> Result<IndexMap<String, Expr>> {
        self.expect(Token::LBrace)?;
        let mut map = IndexMap::new();

        if !matches!(self.current, Token::RBrace) {
            loop {
                let key = if let Token::Ident(name) = &self.current {
                    let k = (*name).to_string();
                    self.advance()?;
                    k
                } else {
                    return Err(QueryError::ParseError {
                        position: self.lexer.position,
                        message: "Expected property name".to_string(),
                    });
                };

                self.expect(Token::Colon)?;
                let value = self.parse_expression()?;
                map.insert(key, value);

                if !matches!(self.current, Token::Comma) {
                    break;
                }
                self.advance()?;
            }
        }

        self.expect(Token::RBrace)?;
        Ok(map)
    }

    fn parse_expression(&mut self) -> Result<Expr> {
        self.parse_or_expression()
    }

    fn parse_or_expression(&mut self) -> Result<Expr> {
        let mut left = self.parse_xor_expression()?;
        while matches!(self.current, Token::Or) {
            self.advance()?;
            let right = self.parse_xor_expression()?;
            left = Expr::Binary {
                left: Box::new(left),
                op: BinaryOp::Or,
                right: Box::new(right),
            };
        }
        Ok(left)
    }

    fn parse_xor_expression(&mut self) -> Result<Expr> {
        let mut left = self.parse_and_expression()?;
        while matches!(self.current, Token::Xor) {
            self.advance()?;
            let right = self.parse_and_expression()?;
            left = Expr::Binary {
                left: Box::new(left),
                op: BinaryOp::Xor,
                right: Box::new(right),
            };
        }
        Ok(left)
    }

    fn parse_and_expression(&mut self) -> Result<Expr> {
        let mut left = self.parse_not_expression()?;
        while matches!(self.current, Token::And) {
            self.advance()?;
            let right = self.parse_not_expression()?;
            left = Expr::Binary {
                left: Box::new(left),
                op: BinaryOp::And,
                right: Box::new(right),
            };
        }
        Ok(left)
    }

    fn parse_not_expression(&mut self) -> Result<Expr> {
        if matches!(self.current, Token::Not) {
            self.advance()?;
            let expr = self.parse_not_expression()?;
            Ok(Expr::Unary {
                op: UnaryOp::Not,
                expr: Box::new(expr),
            })
        } else {
            self.parse_comparison_expression()
        }
    }

    fn parse_comparison_expression(&mut self) -> Result<Expr> {
        let left = self.parse_additive_expression()?;

        let op = match &self.current {
            Token::Eq | Token::EqEq => Some(BinaryOp::Eq),
            Token::Ne => Some(BinaryOp::Ne),
            Token::Lt => Some(BinaryOp::Lt),
            Token::Le => Some(BinaryOp::Le),
            Token::Gt => Some(BinaryOp::Gt),
            Token::Ge => Some(BinaryOp::Ge),
            Token::In => Some(BinaryOp::In),
            Token::Contains => Some(BinaryOp::Contains),
            Token::StartsWith => Some(BinaryOp::StartsWith),
            Token::EndsWith => Some(BinaryOp::EndsWith),
            Token::Is => {
                self.advance()?;
                let is_not = matches!(self.current, Token::Not);
                if is_not {
                    self.advance()?;
                }
                self.expect(Token::Null)?;
                return Ok(Expr::Binary {
                    left: Box::new(left),
                    op: if is_not {
                        BinaryOp::IsNotNull
                    } else {
                        BinaryOp::IsNull
                    },
                    right: Box::new(Expr::Literal(Literal::Null)),
                });
            }
            _ => None,
        };

        if let Some(op) = op {
            self.advance()?;
            let right = self.parse_additive_expression()?;
            Ok(Expr::Binary {
                left: Box::new(left),
                op,
                right: Box::new(right),
            })
        } else {
            Ok(left)
        }
    }

    fn parse_additive_expression(&mut self) -> Result<Expr> {
        let mut left = self.parse_multiplicative_expression()?;
        loop {
            let op = match &self.current {
                Token::Plus => BinaryOp::Add,
                Token::Minus => BinaryOp::Sub,
                _ => break,
            };
            self.advance()?;
            let right = self.parse_multiplicative_expression()?;
            left = Expr::Binary {
                left: Box::new(left),
                op,
                right: Box::new(right),
            };
        }
        Ok(left)
    }

    fn parse_multiplicative_expression(&mut self) -> Result<Expr> {
        let mut left = self.parse_power_expression()?;
        loop {
            let op = match &self.current {
                Token::Star => BinaryOp::Mul,
                Token::Slash => BinaryOp::Div,
                Token::Percent => BinaryOp::Mod,
                _ => break,
            };
            self.advance()?;
            let right = self.parse_power_expression()?;
            left = Expr::Binary {
                left: Box::new(left),
                op,
                right: Box::new(right),
            };
        }
        Ok(left)
    }

    fn parse_power_expression(&mut self) -> Result<Expr> {
        let left = self.parse_unary_expression()?;
        if matches!(self.current, Token::Caret) {
            self.advance()?;
            let right = self.parse_power_expression()?;
            Ok(Expr::Binary {
                left: Box::new(left),
                op: BinaryOp::Pow,
                right: Box::new(right),
            })
        } else {
            Ok(left)
        }
    }

    fn parse_unary_expression(&mut self) -> Result<Expr> {
        match &self.current {
            Token::Minus => {
                self.advance()?;
                let expr = self.parse_unary_expression()?;
                Ok(Expr::Unary {
                    op: UnaryOp::Neg,
                    expr: Box::new(expr),
                })
            }
            Token::Plus => {
                self.advance()?;
                let expr = self.parse_unary_expression()?;
                Ok(Expr::Unary {
                    op: UnaryOp::Pos,
                    expr: Box::new(expr),
                })
            }
            _ => self.parse_postfix_expression(),
        }
    }

    fn parse_postfix_expression(&mut self) -> Result<Expr> {
        let mut expr = self.parse_primary_expression()?;

        loop {
            match &self.current {
                Token::Dot => {
                    self.advance()?;
                    if let Token::Ident(name) = &self.current {
                        let name = (*name).to_string();
                        self.advance()?;
                        expr = Expr::Property {
                            expr: Box::new(expr),
                            name,
                        };
                    } else {
                        return Err(QueryError::ParseError {
                            position: self.lexer.position,
                            message: "Expected property name after '.'".to_string(),
                        });
                    }
                }
                Token::LBracket => {
                    self.advance()?;
                    let index = self.parse_expression()?;
                    self.expect(Token::RBracket)?;
                    expr = Expr::Index {
                        expr: Box::new(expr),
                        index: Box::new(index),
                    };
                }
                _ => break,
            }
        }

        Ok(expr)
    }

    fn parse_primary_expression(&mut self) -> Result<Expr> {
        match &self.current {
            Token::Null => {
                self.advance()?;
                Ok(Expr::Literal(Literal::Null))
            }
            Token::True => {
                self.advance()?;
                Ok(Expr::Literal(Literal::Boolean(true)))
            }
            Token::False => {
                self.advance()?;
                Ok(Expr::Literal(Literal::Boolean(false)))
            }
            Token::Integer(n) => {
                let n = *n;
                self.advance()?;
                Ok(Expr::Literal(Literal::Integer(n)))
            }
            Token::Float(n) => {
                let n = *n;
                self.advance()?;
                Ok(Expr::Literal(Literal::Float(n)))
            }
            Token::String(s) => {
                let s = (*s).to_string();
                self.advance()?;
                Ok(Expr::Literal(Literal::String(s)))
            }
            Token::Parameter(p) => {
                let p = (*p).to_string();
                self.advance()?;
                Ok(Expr::Parameter(p))
            }
            Token::Ident(name) => {
                let name = (*name).to_string();
                self.advance()?;

                // Check for function call
                if matches!(self.current, Token::LParen) {
                    self.advance()?;
                    let mut args = Vec::new();
                    if !matches!(self.current, Token::RParen) {
                        args.push(self.parse_expression()?);
                        while matches!(self.current, Token::Comma) {
                            self.advance()?;
                            args.push(self.parse_expression()?);
                        }
                    }
                    self.expect(Token::RParen)?;
                    Ok(Expr::FunctionCall { name, args })
                } else {
                    Ok(Expr::Variable(name))
                }
            }
            Token::LParen => {
                self.advance()?;
                let expr = self.parse_expression()?;
                self.expect(Token::RParen)?;
                Ok(expr)
            }
            Token::LBracket => {
                self.advance()?;
                let mut elements = Vec::new();
                if !matches!(self.current, Token::RBracket) {
                    elements.push(self.parse_expression()?);
                    while matches!(self.current, Token::Comma) {
                        self.advance()?;
                        elements.push(self.parse_expression()?);
                    }
                }
                self.expect(Token::RBracket)?;
                Ok(Expr::List(elements))
            }
            Token::LBrace => {
                let map = self.parse_map_literal()?;
                Ok(Expr::Map(map))
            }
            Token::Count => {
                self.advance()?;
                self.expect(Token::LBrace)?;
                let pattern = self.parse_pattern()?;
                self.expect(Token::RBrace)?;
                Ok(Expr::Count { pattern })
            }
            Token::Exists => {
                self.advance()?;
                self.expect(Token::LBrace)?;
                let pattern = self.parse_pattern()?;
                self.expect(Token::RBrace)?;
                Ok(Expr::Exists { pattern })
            }
            _ => Err(QueryError::ParseError {
                position: self.lexer.position,
                message: format!("Unexpected token in expression: {:?}", self.current),
            }),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_simple_match() {
        let parser = QueryParser::new();
        let query = parser.parse("MATCH (n:Person) RETURN n").unwrap();
        assert_eq!(query.clauses.len(), 2);
    }

    #[test]
    fn test_match_with_where() {
        let parser = QueryParser::new();
        let query = parser
            .parse("MATCH (n:Person) WHERE n.age > 25 RETURN n")
            .unwrap();
        assert_eq!(query.clauses.len(), 3);
    }

    #[test]
    fn test_edge_pattern() {
        let parser = QueryParser::new();
        let query = parser
            .parse("MATCH (a:Person)-[:KNOWS]->(b:Person) RETURN a, b")
            .unwrap();
        assert_eq!(query.clauses.len(), 2);
    }

    #[test]
    fn test_complex_query() {
        let parser = QueryParser::new();
        let query = parser
            .parse(
                "MATCH (p:Person)-[:WORKS_AT]->(c:Company)
                 WHERE p.salary > 50000 AND c.name = 'Acme'
                 RETURN p.name, c.name ORDER BY p.salary DESC LIMIT 10",
            )
            .unwrap();
        assert!(query.clauses.len() >= 3);
    }

    #[test]
    fn test_tokenizer() {
        let parser = QueryParser::new();
        let tokens: Vec<_> = parser.tokenize("MATCH (n) RETURN n").collect();
        assert!(tokens.len() > 0);
        assert!(matches!(tokens[0], Token::Match));
    }
}
