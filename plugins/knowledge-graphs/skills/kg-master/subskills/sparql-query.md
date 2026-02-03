---
name: sparql-query
description: Master SPARQL 1.2 Query Language for querying RDF knowledge graphs. Use when querying semantic web data, linked data, triple stores, or any RDF-based knowledge graph. Supports graph pattern matching, aggregation, federated queries, and RDF-star quoted triples.
allowed-tools: Read, Glob, Grep, Bash, WebFetch
---

# SPARQL 1.2 Query Language Mastery

W3C standard query language for RDF knowledge graphs and semantic web data with support for graph patterns, aggregation, and RDF-star quoted triples.

## Territory Map

```
resources/knowledge_graphs/sparql-query/
├── spec/
│   ├── index.html              # SPARQL 1.2 specification
│   ├── sparql.bnf              # Complete grammar
│   └── common/                 # Shared spec resources
├── discussion/
│   ├── correlated-query-ex1.md            # LATERAL query examples
│   └── comparisons/
│       ├── EXISTS_APPROACHES_COMPARISON.md
│       ├── EXISTS_COMPLEXITY_ANALYSIS.md
│       └── EXISTS_APPROACH_COMPARISON.md
├── input/                      # SPARQL 1.1 base documents
└── README.md                   # Repository overview
```

## Core Capabilities

- **Graph Pattern Matching**: Basic graph patterns (BGPs), property paths, triple patterns
- **Query Forms**: SELECT, CONSTRUCT, DESCRIBE, ASK
- **Filtering**: FILTER expressions with rich function library
- **Aggregation**: GROUP BY, COUNT, SUM, AVG, MIN, MAX, SAMPLE
- **Solution Modifiers**: ORDER BY, LIMIT, OFFSET, DISTINCT, REDUCED
- **Subqueries**: Nested SELECT queries with variable scoping
- **Graph Operations**: UNION, OPTIONAL, MINUS, GRAPH
- **RDF-star Support**: Quoted triples and triple terms (SPARQL 1.2)
- **Federated Queries**: SERVICE for remote endpoint queries
- **Multiple Result Formats**: JSON, XML, CSV/TSV, Turtle

## Architecture Components

### Query Structure
```
Query = Prologue + ( SelectQuery | ConstructQuery | DescribeQuery | AskQuery ) + ValuesClause
Prologue = BaseDecl* PrefixDecl* VersionDecl*
SelectQuery = SelectClause + DatasetClause* + WhereClause + SolutionModifier
```

### Query Forms

**SELECT**: Return variable bindings as tabular results
**CONSTRUCT**: Build RDF graphs from query results
**DESCRIBE**: Return RDF data about resources
**ASK**: Boolean queries (does pattern match exist?)

### Pattern Types

**Basic Graph Pattern (BGP)**: Triple patterns matched against RDF graph
**Property Paths**: Regular expression-like path traversal
**OPTIONAL**: Left outer join semantics
**UNION**: Disjunction of patterns
**GRAPH**: Query named graphs
**FILTER**: Constrain solutions with boolean expressions

## Beginner Techniques

### Basic Triple Patterns

```sparql
PREFIX foaf: <http://xmlns.com/foaf/0.1/>

# Simple triple pattern
SELECT ?name
WHERE {
  ?person foaf:name ?name .
}

# Multiple triple patterns (join)
SELECT ?name ?email
WHERE {
  ?person foaf:name ?name .
  ?person foaf:mbox ?email .
}

# Specific subject
SELECT ?property ?value
WHERE {
  <http://example.org/alice> ?property ?value .
}
```

### Prefix Declarations

```sparql
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX foaf: <http://xmlns.com/foaf/0.1/>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>

SELECT ?person ?name
WHERE {
  ?person rdf:type foaf:Person .
  ?person foaf:name ?name .
}
```

### Simple Filters

```sparql
# String matching
SELECT ?name
WHERE {
  ?person foaf:name ?name .
  FILTER (regex(?name, "^A", "i"))  # Names starting with A (case-insensitive)
}

# Numeric comparison
SELECT ?product ?price
WHERE {
  ?product :price ?price .
  FILTER (?price > 100 && ?price < 500)
}

# Testing bound variables
SELECT ?person ?email
WHERE {
  ?person foaf:name ?name .
  OPTIONAL { ?person foaf:mbox ?email }
  FILTER (bound(?email))
}
```

### OPTIONAL Patterns

```sparql
# Left outer join - include results even if optional part doesn't match
SELECT ?person ?name ?email
WHERE {
  ?person foaf:name ?name .
  OPTIONAL { ?person foaf:mbox ?email }
}

# Multiple OPTIONAL clauses
SELECT ?person ?name ?phone ?email
WHERE {
  ?person foaf:name ?name .
  OPTIONAL { ?person foaf:phone ?phone }
  OPTIONAL { ?person foaf:mbox ?email }
}
```

### Basic Aggregation

```sparql
# Count results
SELECT (COUNT(?person) AS ?count)
WHERE {
  ?person rdf:type foaf:Person .
}

# Group by with count
SELECT ?city (COUNT(?person) AS ?population)
WHERE {
  ?person :livesIn ?city .
}
GROUP BY ?city

# Average, sum, min, max
SELECT ?category (AVG(?price) AS ?avg_price) (SUM(?price) AS ?total)
WHERE {
  ?product :category ?category .
  ?product :price ?price .
}
GROUP BY ?category
```

### Sorting and Limiting

```sparql
# ORDER BY
SELECT ?person ?name
WHERE {
  ?person foaf:name ?name .
}
ORDER BY ?name

# Multiple sort keys
ORDER BY DESC(?price) ?name

# LIMIT and OFFSET (pagination)
SELECT ?person ?name
WHERE {
  ?person foaf:name ?name .
}
ORDER BY ?name
LIMIT 10
OFFSET 20
```

## Intermediate Techniques

### Property Paths

```sparql
# Zero or more steps: foaf:knows*
SELECT ?person ?friend
WHERE {
  ?person foaf:knows* ?friend .
}

# One or more steps: foaf:knows+
SELECT ?person ?connection
WHERE {
  <http://example.org/alice> foaf:knows+ ?connection .
}

# Alternative paths: |
SELECT ?person ?contact
WHERE {
  ?person (foaf:mbox|foaf:phone) ?contact .
}

# Sequence paths: /
SELECT ?person ?grandparent
WHERE {
  ?person :parent/:parent ?grandparent .
}

# Inverse paths: ^
SELECT ?child ?parent
WHERE {
  ?child ^:parent ?parent .
}

# Negated property sets
SELECT ?person ?related
WHERE {
  ?person !(:parent|:child) ?related .
}
```

### UNION Patterns

```sparql
# Disjunction - match either pattern
SELECT ?person ?contact
WHERE {
  {
    ?person foaf:mbox ?contact .
  }
  UNION
  {
    ?person foaf:phone ?contact .
  }
}

# Multiple UNION branches
SELECT ?resource ?label
WHERE {
  { ?resource rdfs:label ?label }
  UNION
  { ?resource foaf:name ?label }
  UNION
  { ?resource :title ?label }
}
```

### Subqueries

```sparql
# Nested SELECT
SELECT ?person ?name ?avgAge
WHERE {
  ?person foaf:name ?name .
  {
    SELECT (AVG(?age) AS ?avgAge)
    WHERE {
      ?p :age ?age .
    }
  }
}

# Subquery for top-k
SELECT ?person ?name ?score
WHERE {
  {
    SELECT ?person ?score
    WHERE {
      ?person :score ?score .
    }
    ORDER BY DESC(?score)
    LIMIT 10
  }
  ?person foaf:name ?name .
}
```

### BIND and VALUES

```sparql
# BIND - create new variables from expressions
SELECT ?person ?name ?nameLength
WHERE {
  ?person foaf:name ?name .
  BIND(STRLEN(?name) AS ?nameLength)
}

# VALUES - inline data
SELECT ?person ?name
WHERE {
  VALUES ?type { foaf:Person :Employee }
  ?person rdf:type ?type .
  ?person foaf:name ?name .
}

# VALUES with multiple variables
SELECT ?person ?name
WHERE {
  VALUES (?id ?type) {
    (1 foaf:Person)
    (2 :Organization)
  }
  ?person :id ?id .
  ?person rdf:type ?type .
  ?person foaf:name ?name .
}
```

### CONSTRUCT Queries

```sparql
# Build new RDF graph from query results
CONSTRUCT {
  ?person foaf:name ?name .
  ?person :contactInfo ?email .
}
WHERE {
  ?person foaf:name ?name .
  ?person foaf:mbox ?email .
}

# Transform data structure
CONSTRUCT {
  ?book :author ?author .
  ?author foaf:name ?name .
}
WHERE {
  ?book :writtenBy ?author .
  ?author rdfs:label ?name .
}

# Shorthand for copying matching patterns
CONSTRUCT WHERE {
  ?s ?p ?o .
  FILTER (isLiteral(?o))
}
```

### Named Graphs

```sparql
# Query specific named graph
SELECT ?person ?name
FROM <http://example.org/people>
WHERE {
  ?person foaf:name ?name .
}

# Query from multiple graphs
SELECT ?person ?name
FROM <http://example.org/people>
FROM <http://example.org/employees>
WHERE {
  ?person foaf:name ?name .
}

# GRAPH keyword to specify graph inline
SELECT ?person ?name ?graph
WHERE {
  GRAPH ?graph {
    ?person foaf:name ?name .
  }
}

# Named graph with OPTIONAL
SELECT ?person ?name ?workInfo
WHERE {
  GRAPH <http://example.org/people> {
    ?person foaf:name ?name .
  }
  OPTIONAL {
    GRAPH <http://example.org/employment> {
      ?person :worksAt ?workInfo .
    }
  }
}
```

## Advanced Techniques

### Complex Aggregation

```sparql
# Multiple aggregates with HAVING
SELECT ?category
       (COUNT(?product) AS ?count)
       (AVG(?price) AS ?avgPrice)
       (MIN(?price) AS ?minPrice)
       (MAX(?price) AS ?maxPrice)
WHERE {
  ?product :category ?category .
  ?product :price ?price .
}
GROUP BY ?category
HAVING (COUNT(?product) > 5 && AVG(?price) > 100)
ORDER BY DESC(?count)

# GROUP_CONCAT for string aggregation
SELECT ?author (GROUP_CONCAT(?title; separator=", ") AS ?books)
WHERE {
  ?book :author ?author .
  ?book :title ?title .
}
GROUP BY ?author

# Nested aggregation via subquery
SELECT ?category ?product ?price ?categoryAvg
WHERE {
  ?product :category ?category .
  ?product :price ?price .
  {
    SELECT ?category (AVG(?p) AS ?categoryAvg)
    WHERE {
      ?prod :category ?category .
      ?prod :price ?p .
    }
    GROUP BY ?category
  }
  FILTER (?price > ?categoryAvg)
}
```

### EXISTS and NOT EXISTS

```sparql
# EXISTS - test for pattern existence
SELECT ?person ?name
WHERE {
  ?person foaf:name ?name .
  FILTER EXISTS {
    ?person foaf:knows ?friend .
    ?friend foaf:name "Bob" .
  }
}

# NOT EXISTS - negation
SELECT ?person ?name
WHERE {
  ?person foaf:name ?name .
  FILTER NOT EXISTS {
    ?person :hasAccount ?account .
  }
}

# Complex EXISTS with correlation
SELECT ?author ?book
WHERE {
  ?author :wrote ?book .
  FILTER EXISTS {
    SELECT ?book
    WHERE {
      ?book :soldCopies ?copies .
    }
    HAVING (SUM(?copies) > 1000)
  }
}
```

### MINUS Pattern

```sparql
# Set difference - exclude matching patterns
SELECT ?person ?name
WHERE {
  ?person foaf:name ?name .
  MINUS {
    ?person :banned true .
  }
}

# Difference between MINUS and NOT EXISTS
SELECT ?person
WHERE {
  ?person rdf:type foaf:Person .
  MINUS {
    ?person :age ?age .
    FILTER (?age < 18)
  }
}

# MINUS removes entire solution if any variable matches
SELECT ?s ?p
WHERE {
  ?s ?p ?o .
  MINUS {
    ?s ?p2 ?o2 .
    FILTER (?p2 = rdf:type)
  }
}
```

### Advanced Filtering

```sparql
# String functions
SELECT ?person ?name
WHERE {
  ?person foaf:name ?name .
  FILTER (
    STRSTARTS(?name, "John") ||
    STRENDS(?name, "Smith") ||
    CONTAINS(?name, "van")
  )
}

# Date/time functions
SELECT ?event ?date
WHERE {
  ?event :date ?date .
  FILTER (
    YEAR(?date) = 2024 &&
    MONTH(?date) >= 6
  )
}

# Language filtering
SELECT ?label
WHERE {
  ?resource rdfs:label ?label .
  FILTER (LANG(?label) = "en")
}

# Type testing
SELECT ?s ?o
WHERE {
  ?s :value ?o .
  FILTER (isLiteral(?o) && datatype(?o) = xsd:integer)
}

# IN operator
SELECT ?product ?category
WHERE {
  ?product :category ?category .
  FILTER (?category IN ("electronics", "books", "toys"))
}

# IF expressions
SELECT ?person ?name
       (IF(bound(?email), ?email, "no-email") AS ?contact)
WHERE {
  ?person foaf:name ?name .
  OPTIONAL { ?person foaf:mbox ?email }
}

# COALESCE for fallback values
SELECT ?person (COALESCE(?preferredName, ?fullName, ?username) AS ?displayName)
WHERE {
  ?person :username ?username .
  OPTIONAL { ?person :fullName ?fullName }
  OPTIONAL { ?person :preferredName ?preferredName }
}
```

### Federated Queries (SERVICE)

```sparql
# Query remote SPARQL endpoint
PREFIX dbr: <http://dbpedia.org/resource/>
PREFIX dbo: <http://dbpedia.org/ontology/>

SELECT ?person ?birthPlace ?population
WHERE {
  ?person foaf:name ?name .

  # Query DBpedia for additional info
  SERVICE <http://dbpedia.org/sparql> {
    ?person dbo:birthPlace ?birthPlace .
    ?birthPlace dbo:populationTotal ?population .
  }
}

# SILENT to continue on endpoint failure
SELECT ?person ?name ?remoteData
WHERE {
  ?person foaf:name ?name .
  SERVICE SILENT <http://remote.example.org/sparql> {
    ?person :additionalInfo ?remoteData .
  }
}
```

### RDF-star Quoted Triples (SPARQL 1.2)

```sparql
# Query quoted triples (RDF-star)
PREFIX : <http://example.org/>

# Match quoted triple in subject position
SELECT ?source ?date
WHERE {
  << ?person :name "Alice" >> :source ?source .
  << ?person :name "Alice" >> :date ?date .
}

# Triple terms in expressions
SELECT ?s ?p ?o ?reliability
WHERE {
  ?s ?p ?o .
  OPTIONAL {
    <<(?s ?p ?o)>> :reliability ?reliability .
  }
}

# CONSTRUCT with quoted triples
CONSTRUCT {
  << ?person :age ?age >> :verifiedBy ?source .
  << ?person :age ?age >> :verifiedDate ?date .
}
WHERE {
  ?person :age ?age .
  ?person :source ?source .
  BIND(NOW() AS ?date)
}

# Nested quoted triples
SELECT ?s ?p ?o ?metaMeta
WHERE {
  << << ?s ?p ?o >> :reliability ?score >> :verifiedBy ?metaMeta .
}

# isTRIPLE, SUBJECT, PREDICATE, OBJECT functions
SELECT ?triple ?s ?p ?o
WHERE {
  ?triple ?prop ?value .
  FILTER (isTRIPLE(?triple))
  BIND(SUBJECT(?triple) AS ?s)
  BIND(PREDICATE(?triple) AS ?p)
  BIND(OBJECT(?triple) AS ?o)
}
```

### Property Path Advanced Patterns

```sparql
# Complex path with sequence and alternatives
SELECT ?person ?relative
WHERE {
  ?person (:parent|:child)/:sibling* ?relative .
}

# Negated property set with inverse
SELECT ?x ?y
WHERE {
  ?x !^:parent ?y .  # Not a parent of anyone
}

# Path in OPTIONAL
SELECT ?person ?ancestor
WHERE {
  ?person foaf:name ?name .
  OPTIONAL {
    ?person :parent+ ?ancestor .
  }
}

# Path with FILTER
SELECT ?person ?friend ?mutualFriend
WHERE {
  ?person foaf:knows ?friend .
  ?person foaf:knows/foaf:knows ?mutualFriend .
  FILTER (?friend != ?mutualFriend && ?person != ?mutualFriend)
}
```

### DESCRIBE Queries

```sparql
# Describe resources
DESCRIBE <http://example.org/alice>

# Describe multiple resources
DESCRIBE <http://example.org/alice> <http://example.org/bob>

# Describe with pattern matching
DESCRIBE ?person
WHERE {
  ?person rdf:type foaf:Person .
  ?person :verified true .
}

# Describe all
DESCRIBE *
WHERE {
  ?s :important true .
}
```

### ASK Queries

```sparql
# Boolean query - does pattern exist?
ASK {
  ?person foaf:name "Alice" .
  ?person foaf:knows ?friend .
}

# ASK with complex pattern
ASK {
  {
    SELECT ?category
    WHERE {
      ?product :category ?category .
    }
    GROUP BY ?category
    HAVING (COUNT(?product) > 100)
  }
}
```

## Performance Optimization Strategies

### Query Optimization

1. **Filter Early**: Place FILTER close to the patterns that bind variables
```sparql
# Better
SELECT ?person ?name
WHERE {
  ?person rdf:type foaf:Person .
  FILTER (?person = <http://example.org/alice>)
  ?person foaf:name ?name .
}

# Worse
SELECT ?person ?name
WHERE {
  ?person rdf:type foaf:Person .
  ?person foaf:name ?name .
  ?person foaf:knows ?friend .
  FILTER (?person = <http://example.org/alice>)
}
```

2. **Limit Triple Patterns**: Reduce cardinality early
```sparql
# Better - specific subject first
SELECT ?name ?friend
WHERE {
  <http://example.org/alice> foaf:name ?name .
  <http://example.org/alice> foaf:knows ?friend .
}

# Worse - broad pattern first
SELECT ?name ?friend
WHERE {
  ?person foaf:knows ?friend .
  ?person foaf:name ?name .
  FILTER (?person = <http://example.org/alice>)
}
```

3. **Use Property Paths Judiciously**: They can be expensive
```sparql
# More efficient when depth is bounded
?person :parent/:parent ?grandparent .

# Expensive when unbounded
?person :knows* ?connection .  # Could match millions

# Better with LIMIT
SELECT ?connection
WHERE {
  ?person :knows+ ?connection .
}
LIMIT 100
```

4. **Avoid OPTIONAL When Possible**: Use MINUS or NOT EXISTS if appropriate
```sparql
# If you only want persons WITHOUT email
SELECT ?person ?name
WHERE {
  ?person foaf:name ?name .
  FILTER NOT EXISTS { ?person foaf:mbox ?email }
}

# Not
SELECT ?person ?name
WHERE {
  ?person foaf:name ?name .
  OPTIONAL { ?person foaf:mbox ?email }
  FILTER (!bound(?email))
}
```

5. **Subquery for Aggregation**: Isolate expensive operations
```sparql
# Better - aggregate once
SELECT ?category ?product ?price ?avg
WHERE {
  {
    SELECT ?category (AVG(?p) AS ?avg)
    WHERE { ?prod :category ?category . ?prod :price ?p }
    GROUP BY ?category
  }
  ?product :category ?category .
  ?product :price ?price .
}
```

### Index-Friendly Patterns

1. **Bound Subjects**: Most efficient
```sparql
<http://specific/uri> ?p ?o .
```

2. **Bound Predicates**: Very efficient
```sparql
?s foaf:name ?name .
```

3. **Bound Objects**: Efficient for literals, varies for URIs
```sparql
?s ?p "specific value" .
```

4. **Avoid Triple Patterns with Only Variables**: Least efficient
```sparql
# Avoid if possible
?s ?p ?o .
```

### Solution Modifier Optimization

```sparql
# Use DISTINCT only when necessary (adds overhead)
SELECT DISTINCT ?category
WHERE { ?product :category ?category }

# LIMIT early in subqueries
SELECT ?person ?topFriend
WHERE {
  ?person foaf:name ?name .
  {
    SELECT ?person ?topFriend
    WHERE {
      ?person foaf:knows ?topFriend .
      ?topFriend :score ?score .
    }
    ORDER BY DESC(?score)
    LIMIT 1
  }
}
```

## Common Patterns and Idioms

### Top-K Per Group

```sparql
# Top 2 products per category by price
PREFIX : <http://example.org/>

SELECT ?category ?product ?price
WHERE {
  {
    SELECT ?category ?product ?price
    WHERE {
      ?product :category ?category .
      ?product :price ?price .
    }
    ORDER BY ?category DESC(?price)
  }
  {
    SELECT ?category (MAX(?price) AS ?maxPrice)
    WHERE {
      ?product :category ?category .
      ?product :price ?price .
    }
    GROUP BY ?category
  }
  FILTER (?price >= ?maxPrice * 0.9)  # Approximation
}
```

### Transitive Closure

```sparql
# Find all ancestors
SELECT DISTINCT ?person ?ancestor
WHERE {
  ?person :parent+ ?ancestor .
}

# Find shortest path length
SELECT ?person ?ancestor (COUNT(?intermediate) AS ?distance)
WHERE {
  ?person :parent+ ?intermediate .
  ?intermediate :parent* ?ancestor .
}
GROUP BY ?person ?ancestor
```

### Conditional Aggregation

```sparql
# Count by condition
SELECT ?category
       (COUNT(*) AS ?total)
       (SUM(IF(?price > 100, 1, 0)) AS ?expensive)
       (SUM(IF(?price <= 100, 1, 0)) AS ?affordable)
WHERE {
  ?product :category ?category .
  ?product :price ?price .
}
GROUP BY ?category
```

### Self-Join Pattern

```sparql
# Find pairs of friends who know each other
SELECT ?person1 ?person2
WHERE {
  ?person1 foaf:knows ?person2 .
  ?person2 foaf:knows ?person1 .
  FILTER (?person1 < ?person2)  # Avoid duplicates and self-pairs
}
```

### Date Range Queries

```sparql
# Events in date range
SELECT ?event ?date
WHERE {
  ?event :date ?date .
  FILTER (?date >= "2024-01-01"^^xsd:date &&
          ?date < "2024-12-31"^^xsd:date)
}

# Relative date (last 30 days)
SELECT ?event ?date
WHERE {
  ?event :date ?date .
  BIND(NOW() AS ?now)
  FILTER (?date > ?now - "P30D"^^xsd:duration)
}
```

## SPARQL Endpoint Integration

### Common Endpoints

| Endpoint | URL | Content |
|----------|-----|---------|
| DBpedia | `http://dbpedia.org/sparql` | Wikipedia data as RDF |
| Wikidata | `https://query.wikidata.org/sparql` | Structured data from Wikidata |
| UniProt | `https://sparql.uniprot.org/sparql` | Protein sequences and annotations |
| Bio2RDF | `http://bio2rdf.org/sparql` | Biological databases |

### Query Tools

**Command Line**:
```bash
# Using curl
curl -X POST https://query.wikidata.org/sparql \
  -H "Accept: application/sparql-results+json" \
  --data-urlencode "query=SELECT * WHERE { ?s ?p ?o } LIMIT 10"

# Using Apache Jena ARQ
arq --data data.ttl --query query.rq

# Using Jena's rsparql for remote endpoints
rsparql --service https://query.wikidata.org/sparql --query query.rq
```

**Python**:
```python
from SPARQLWrapper import SPARQLWrapper, JSON

sparql = SPARQLWrapper("https://query.wikidata.org/sparql")
sparql.setQuery("""
    SELECT ?item ?itemLabel
    WHERE {
      ?item wdt:P31 wd:Q5 .
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en" }
    }
    LIMIT 10
""")
sparql.setReturnFormat(JSON)
results = sparql.query().convert()
```

**JavaScript**:
```javascript
const fetch = require('node-fetch');

const query = `
  SELECT ?s ?p ?o
  WHERE { ?s ?p ?o }
  LIMIT 10
`;

fetch('https://query.wikidata.org/sparql?query=' + encodeURIComponent(query), {
  headers: { 'Accept': 'application/sparql-results+json' }
})
.then(res => res.json())
.then(data => console.log(data));
```

## Triple Store Implementations

| System | Query Language | Features |
|--------|----------------|----------|
| Apache Jena Fuseki | SPARQL 1.1 | Full-text search, spatial, reasoning |
| Virtuoso | SPARQL 1.1 | High performance, SQL integration |
| Stardog | SPARQL 1.1 | Reasoning, graph analytics |
| GraphDB | SPARQL 1.1 | OWL reasoning, clustering |
| AllegroGraph | SPARQL 1.1 | Temporal reasoning, geospatial |
| Amazon Neptune | SPARQL 1.1 | Managed service, Gremlin support |
| Blazegraph | SPARQL 1.1 | GPU acceleration option |
| RDFox | SPARQL 1.1 | In-memory, parallel reasoning |

## Result Format Examples

### JSON Results
```json
{
  "head": {
    "vars": ["person", "name"]
  },
  "results": {
    "bindings": [
      {
        "person": { "type": "uri", "value": "http://example.org/alice" },
        "name": { "type": "literal", "value": "Alice Smith" }
      }
    ]
  }
}
```

### XML Results
```xml
<sparql xmlns="http://www.w3.org/2005/sparql-results#">
  <head>
    <variable name="person"/>
    <variable name="name"/>
  </head>
  <results>
    <result>
      <binding name="person">
        <uri>http://example.org/alice</uri>
      </binding>
      <binding name="name">
        <literal>Alice Smith</literal>
      </binding>
    </result>
  </results>
</sparql>
```

### CSV Results
```csv
person,name
http://example.org/alice,Alice Smith
http://example.org/bob,Bob Jones
```

## Grammar Reference (BNF Highlights)

```
Query ::= Prologue ( SelectQuery | ConstructQuery | DescribeQuery | AskQuery ) ValuesClause

SelectQuery ::= SelectClause DatasetClause* WhereClause SolutionModifier

SelectClause ::= 'SELECT' ( 'DISTINCT' | 'REDUCED' )? ( Var+ | '*' )

WhereClause ::= 'WHERE'? GroupGraphPattern

GroupGraphPattern ::= '{' ( SubSelect | GroupGraphPatternSub ) '}'

Filter ::= 'FILTER' Constraint

Constraint ::= BrackettedExpression | BuiltInCall | FunctionCall

SolutionModifier ::= GroupClause? HavingClause? OrderClause? LimitOffsetClauses?

Aggregate ::= 'COUNT' | 'SUM' | 'MIN' | 'MAX' | 'AVG' | 'SAMPLE' | 'GROUP_CONCAT'
```

## When to Use SPARQL

- **Querying Linked Data**: DBpedia, Wikidata, schema.org data
- **Semantic Web Applications**: Knowledge graphs with RDF/OWL ontologies
- **Data Integration**: Combining data from multiple RDF sources
- **Scientific Data**: Life sciences, bibliographic, geospatial data
- **Enterprise Knowledge Graphs**: Metadata management, data catalogs
- **Cultural Heritage**: Museum collections, library catalogs
- **Government Open Data**: Census, statistics, regulations

## Best Practices

1. **Use Prefixes**: Make queries readable and maintainable
2. **Comment Complex Queries**: Explain business logic and intent
3. **Test Incrementally**: Build queries step-by-step
4. **Validate Data**: Check for expected patterns and data types
5. **Handle Optional Data**: Use OPTIONAL, BIND, COALESCE appropriately
6. **Limit Result Sets**: Always use LIMIT during development
7. **Use Subqueries for Complexity**: Break down complex operations
8. **Profile Performance**: Identify slow patterns and optimize
9. **Version Your Queries**: Track changes in version control
10. **Document Assumptions**: Note expected data shapes and vocabularies

## Common Gotchas

### Variable Scoping
```sparql
# Variables in subquery don't leak out
SELECT ?person ?name ?avg
WHERE {
  ?person foaf:name ?name .
  {
    SELECT (AVG(?age) AS ?avg)
    WHERE { ?p :age ?age }
    # ?person is NOT visible here
  }
}
```

### OPTIONAL vs MINUS
```sparql
# OPTIONAL includes rows, MINUS removes them
SELECT ?s ?o1 ?o2
WHERE {
  ?s :p1 ?o1 .
  OPTIONAL { ?s :p2 ?o2 }  # Includes ?s even if no :p2
}

SELECT ?s ?o1
WHERE {
  ?s :p1 ?o1 .
  MINUS { ?s :p2 ?o2 }  # Excludes ?s if ANY :p2 exists
}
```

### FILTER with OPTIONAL
```sparql
# FILTER inside OPTIONAL - only filters optional part
SELECT ?s ?o
WHERE {
  ?s :p1 ?o1 .
  OPTIONAL {
    ?s :p2 ?o2
    FILTER (?o2 > 10)  # Only applies to optional matches
  }
}

# FILTER outside OPTIONAL - filters entire result
SELECT ?s ?o
WHERE {
  ?s :p1 ?o1 .
  OPTIONAL { ?s :p2 ?o2 }
  FILTER (!bound(?o2) || ?o2 > 10)  # Applies to all results
}
```

### Blank Node Behavior
```sparql
# Blank nodes are scoped to basic graph patterns
SELECT ?b1 ?b2
WHERE {
  ?s :p _:b .  # This _:b
  ?x :q _:b .  # is DIFFERENT from this _:b
}
```

## Troubleshooting

**Empty Results**:
- Check PREFIX declarations match your data
- Verify URIs are complete and correct
- Test patterns incrementally
- Use DESCRIBE to explore unknown data

**Slow Queries**:
- Add LIMIT during testing
- Check for unbounded property paths
- Use FILTER early in pattern
- Consider subquery decomposition
- Profile with EXPLAIN (if supported)

**Syntax Errors**:
- Check for missing periods between triple patterns
- Verify balanced braces and parentheses
- Ensure variables start with ? or $
- Validate PREFIX syntax

**Type Mismatches**:
- Check literal datatypes match expectations
- Use STR(), datatype(), and isLiteral() to debug
- Verify language tags with LANG()

## Reference Resources

- **W3C SPARQL 1.2 Query**: https://w3c.github.io/sparql-query/spec/
- **W3C SPARQL 1.1**: https://www.w3.org/TR/sparql11-query/
- **SPARQL Update**: https://www.w3.org/TR/sparql11-update/
- **Federated Query**: https://www.w3.org/TR/sparql11-federated-query/
- **RDF 1.2 Concepts**: https://www.w3.org/TR/rdf12-concepts/
- **Wikidata Query Service**: https://query.wikidata.org/
- **Apache Jena ARQ**: https://jena.apache.org/documentation/query/
- **Bob DuCharme's SPARQL Book**: "Learning SPARQL"

## Quick Reference Commands

```bash
# Validate SPARQL syntax (Apache Jena)
sparql --validate query.rq

# Execute local query against data file
arq --data data.ttl --query query.rq

# Query remote endpoint
rsparql --service https://query.wikidata.org/sparql --query query.rq

# Convert results to different format
arq --data data.ttl --query query.rq --results=json

# Load data into Fuseki and query
fuseki-server --mem /ds
s-put http://localhost:3030/ds/data default data.ttl
s-query --service http://localhost:3030/ds/query 'SELECT * { ?s ?p ?o }'
```

## Summary

SPARQL provides powerful declarative querying for RDF knowledge graphs:

- **Expressive Pattern Matching**: Triple patterns, property paths, graph patterns
- **Flexible Query Forms**: SELECT, CONSTRUCT, DESCRIBE, ASK for different use cases
- **Rich Function Library**: String, numeric, date, and RDF-specific functions
- **Aggregation & Analytics**: GROUP BY, aggregates, HAVING for analytical queries
- **Graph Operations**: UNION, OPTIONAL, MINUS, GRAPH for complex queries
- **Federation**: SERVICE for distributed queries across endpoints
- **RDF-star Support**: Quoted triples for metadata on statements (SPARQL 1.2)

Master SPARQL to unlock the full potential of semantic web technologies and linked data ecosystems.
