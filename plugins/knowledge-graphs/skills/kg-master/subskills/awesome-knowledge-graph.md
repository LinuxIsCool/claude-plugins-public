---
name: awesome-knowledge-graph
description: Master knowledge graph fundamentals, tools, and research from a comprehensive curated collection. Use when building KGs, entity linking, relation extraction, graph embeddings, semantic reasoning, or researching state-of-the-art papers and datasets. Covers infrastructure, engineering, datasets, and learning materials.
allowed-tools: Read, Glob, Grep, Bash, WebFetch
---

# Awesome Knowledge Graph Mastery

A comprehensive guide to knowledge graph research, tools, and implementation.

## Territory Map

```
resources/knowledge_graphs/awesome-knowledge-graph/
├── readme.md                # Main curated list
├── contributing.md          # Contribution guidelines
└── code-of-conduct.md       # Community standards
```

## Contents Overview

- **Infrastructure**: Graph databases, triple stores, computing frameworks, visualization, construction tools
- **Knowledge Engineering**: Fusion, extraction, alignment techniques
- **Datasets**: General KGs, semantic networks, academic graphs, domain-specific KGs
- **Learning Materials**: Official docs, community tutorials, conference proceedings

## Infrastructure Stack

### Graph Databases (OLTP)

| Database | Key Features | Use Case |
|----------|-------------|----------|
| **Neo4j** | Industry standard, Cypher query language | General-purpose property graphs |
| **Dgraph** | Go-based, distributed, GraphQL+- | Scalable production systems |
| **JanusGraph** | Pluggable backends (Cassandra, HBase) | Enterprise distributed graphs |
| **TigerGraph** | Parallel processing, real-time analytics | Web-scale data analytics |
| **Nebula Graph** | Truly distributed, linear scaling | High-performance applications |
| **ArangoDB** | Multi-model (document + graph + KV) | Flexible schema requirements |
| **Memgraph** | In-memory, high-performance | Real-time pattern matching |
| **TypeDB** | Rich type system, logical reasoning | Complex schema modeling |
| **Kuzu** | Embeddable, Python-friendly | Embedded applications |

### Triple Stores (RDF/SPARQL)

| Triple Store | Key Features | Use Case |
|--------------|-------------|----------|
| **Apache Jena** | Java framework, full Semantic Web stack | Linked Data applications |
| **Eclipse RDF4J** | Java API, SPARQL endpoint support | Semantic web development |
| **GraphDB** | W3C compliant, enterprise-ready | Production semantic graphs |
| **Virtuoso** | High-performance, data integration | Large-scale RDF storage |
| **AllegroGraph** | Billions of quads, RDFS++ reasoning | Enterprise knowledge bases |
| **Oxigraph** | Rust-based, lightweight | Embedded RDF stores |
| **QLever** | 100B+ triples on single server | Massive knowledge graphs |

### Graph Computing Frameworks

```
Apache TinkerPop (Gremlin)  → OLTP graph traversals
Apache Spark GraphX         → Distributed graph processing
Apache Giraph              → Iterative graph algorithms
Gradoop (Flink)            → Distributed graph analytics
Tencent Plato              → Graph ML at scale
```

### Graph Visualization Tools

| Tool | Type | Best For |
|------|------|----------|
| **Gephi** | Desktop software | Network analysis, exploration |
| **Cytoscape.js** | JavaScript library | Web applications |
| **Graphistry** | GPU-accelerated | Large-scale visual analytics |
| **AntV G6** | JavaScript (Ant Financial) | Enterprise dashboards |
| **KeyLines/ReGraph** | Commercial toolkit | Production applications |
| **Sigma.js** | JavaScript | Large graph rendering |

### Graph Construction Tools

```
Morph-KGC    → RML mappings, KG generation
Ontop        → Virtual KG over SQL (SPARQL→SQL)
Ontopic Studio → No-code R2RML mapping editor
Termboard    → Graphical term/relation editor with LLM support
```

## Query Languages

### Cypher (Neo4j, Memgraph, AgensGraph)
```cypher
MATCH (p:Person)-[:WORKS_AT]->(c:Company)
WHERE c.name = 'TechCorp'
RETURN p.name, p.role
```

### Gremlin (TinkerPop-compatible DBs)
```groovy
g.V().hasLabel('person')
  .out('worksAt')
  .has('name', 'TechCorp')
  .values('name')
```

### SPARQL (RDF Triple Stores)
```sparql
SELECT ?person ?role
WHERE {
  ?person rdf:type ex:Person .
  ?person ex:worksAt ?company .
  ?company rdfs:label "TechCorp" .
}
```

### GraphQL+- (Dgraph)
```graphql
{
  person(func: eq(name, "Alice")) {
    name
    worksAt {
      name
    }
  }
}
```

### GQL (Emerging Standard)
ISO standard for property graph queries, similar to SQL for relational DBs.

## Major Knowledge Graph Datasets

### General-Purpose KGs

| Dataset | Scale | Focus | Access |
|---------|-------|-------|--------|
| **Wikidata** | 100M+ entities | Multilingual, crowd-sourced | SPARQL endpoint, dumps |
| **DBpedia** | 68M entities | Wikipedia extraction | SPARQL, Linked Data |
| **YAGO** | 10M+ entities | Wikipedia + WordNet + GeoNames | Downloads |
| **Google Knowledge Graph** | Billions | Real-world entities | Knowledge Graph Search API |
| **Freebase** | 50M+ entities (archived) | General knowledge | Data dumps |
| **XLore** | Bilingual EN-CN | Wikipedia + Baidu Baike | Web interface |
| **Diffbot** | 10B+ entities | Web-crawled commercial KG | API access |
| **Golden Protocol** | Decentralized | Web3-native canonical KG | Blockchain-based |

### Semantic Networks

```
ConceptNet         → Common-sense reasoning (words, meanings)
WordNet            → Lexical database (synsets, relations)
Microsoft Concept  → Short text understanding
OpenHowNet         → Chinese sememe-based knowledge
BabelNet           → Multilingual encyclopedic dictionary (16M entries)
```

### Academic & Research KGs

```
AMiner             → Researcher social networks
Microsoft Academic → Machine learning-powered paper graph
Semantic Scholar   → AI-powered scientific literature
AceMap             → Paper, author, institution entities
```

### Domain-Specific KGs

| Domain | Dataset | Coverage |
|--------|---------|----------|
| **Legal** | Lynx LKG | Legislation, case law, compliance |
| **Cultural Heritage** | ResearchSpace | British Museum collections |
| **Biomedical** | UMLS | Medical terminology, coding standards |
| **Drug Discovery** | DrugBank | Drug interactions, pharmacology |
| **Protein Biology** | STRING | Protein-protein interactions |
| **News/Events** | GDELT | Global events, 100+ languages |

## Knowledge Engineering Workflows

### 1. Knowledge Fusion
```
Multiple sources → Entity resolution → Schema alignment → Conflict resolution → Unified KG
```

**Tools:**
- **Dedupe**: ML-based fuzzy matching for structured data
- **LIMES**: Metric space link discovery framework
- **KGPrune**: Extract Wikidata subgraphs from seed entities

### 2. Entity Linking Pipeline
```
Text → Named Entity Recognition → Candidate Generation → Disambiguation → Linked Entities
```

### 3. Relation Extraction
```
Text corpus → Sentence parsing → Pattern mining → Triple extraction → Validation → KG triples
```

### 4. Knowledge Graph Completion
```
Existing KG → Missing link prediction → Reasoning rules → Graph embeddings → Completed KG
```

### 5. Graph Embeddings
```
KG structure → TransE/TransR/RotatE → Vector space → Similarity/classification tasks
```

## Beginner Techniques

### Start with Neo4j
```cypher
// Create nodes
CREATE (a:Person {name: 'Alice', role: 'CEO'})
CREATE (b:Company {name: 'TechCorp'})
CREATE (a)-[:FOUNDED]->(b)

// Query relationships
MATCH (p:Person)-[r:FOUNDED]->(c:Company)
RETURN p.name, c.name
```

### Simple RDF with Apache Jena
```java
Model model = ModelFactory.createDefaultModel();
Resource alice = model.createResource("http://example.org/alice")
  .addProperty(RDF.type, "Person")
  .addProperty(RDFS.label, "Alice");
```

### Explore Wikidata SPARQL
```sparql
SELECT ?itemLabel WHERE {
  ?item wdt:P31 wd:Q5 .        # instance of human
  ?item wdt:P106 wd:Q82955 .   # occupation: politician
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en" }
}
LIMIT 10
```

## Intermediate Techniques

### Multi-Backend JanusGraph
```groovy
// Configure with Cassandra + Elasticsearch
JanusGraph graph = JanusGraphFactory.build()
  .set("storage.backend", "cql")
  .set("storage.hostname", "127.0.0.1")
  .set("index.search.backend", "elasticsearch")
  .open();
```

### Virtual Knowledge Graphs (Ontop)
Map existing SQL databases to RDF without data duplication:
```
SQL tables → R2RML mappings → SPARQL queries → On-demand results
```

### Graph Embeddings for Link Prediction
```python
# TransE-style embedding
h + r ≈ t  # (head + relation ≈ tail in vector space)

# Train on known triples
# Predict missing links via similarity search
```

### Community Detection
Identify clusters in large graphs:
- Louvain algorithm
- Label propagation
- Graph neural networks

## Advanced Techniques

### Temporal Knowledge Graphs
```
Static: (subject, predicate, object)
Temporal: (subject, predicate, object, timestamp)
Interval: (subject, predicate, object, [start, end])
```

### Semantic Reasoning
```
RDFS/OWL inference:
  Person ⊑ Agent          (subclass)
  worksAt → domain Person (domain constraint)
  Alice worksAt TechCorp → Alice is Person (inferred)
```

### Graph Neural Networks
```
GCN (Graph Convolutional Networks)
GAT (Graph Attention Networks)
GraphSAGE (inductive learning)
→ Node classification, link prediction, graph generation
```

### Distributed Graph Processing
```
Apache Spark GraphX:
  - PageRank at scale
  - Connected components
  - Triangle counting
  - Custom Pregel algorithms
```

### Hybrid Search (Graph + Vector)
```
Query → Vector embedding → Top-K similar entities
      ↓
Graph traversal from seeds → Expand neighborhood → Rank results
```

## Managed Hosting Services

### Cloud-Native Options
```
AWS Neptune         → Managed graph DB (Gremlin + SPARQL)
Azure CosmosDB     → Multi-model with Gremlin API
GCP + JanusGraph   → JanusGraph on K8s + Bigtable
Huawei GES         → Graph Engine Service
Alibaba GDB        → Property graph + Gremlin
Tencent TKG        → One-stop graph platform (beta, Chinese)
```

### Specialized Hosting
```
Graphene DB        → Neo4j hosting
Graph Story        → Enterprise Neo4j with expert support
Graphistry Cloud   → GPU-accelerated visual analytics
WordLift           → SEO-focused KG (Apache Marmotta)
```

## Key Patterns

| Pattern | Implementation | Use Case |
|---------|----------------|----------|
| **Entity resolution** | Dedupe, LIMES | Merge duplicate entities |
| **Subgraph extraction** | KGPrune | Bootstrap new KG from Wikidata |
| **Virtual KG** | Ontop, R2RML | Query SQL as RDF |
| **Graph embeddings** | TransE, RotatE | ML on graph structure |
| **Temporal modeling** | Interval graphs | Historical data tracking |
| **Federated queries** | SPARQL SERVICE | Query across endpoints |

## When to Use Knowledge Graphs

### Good Fit
- Complex, highly connected data (social networks, supply chains)
- Semantic queries ("find all directors who worked with actors from France")
- Recommendation systems (collaborative filtering on graphs)
- Fraud detection (pattern matching, community detection)
- Knowledge-intensive AI (RAG, reasoning, fact verification)
- Data integration from heterogeneous sources

### Consider Alternatives
- Simple CRUD operations → Relational DB
- High-throughput writes → NoSQL key-value stores
- Pure vector similarity search → Vector databases
- Document-centric data → Document stores

## Learning Resources

### Official Documentation
- **Cypher**: [Neo4j Cypher Reference](https://neo4j.com/developer/cypher-query-language/)
- **Gremlin**: [Apache TinkerPop Docs](http://tinkerpop.apache.org/docs/current/reference/#traversal)
- **SPARQL**: W3C Recommendation

### Community Tutorials
- **Graph Book**: TinkerPop3-centric guide by Kelvin R. Lawrence
- **SQL2Gremlin**: Transition guide for SQL developers
- **The Gremlin Compendium**: 10-part series by Doan DuyHai

### Books
- **Knowledge Graphs and LLMs in Action** (Manning): Integrating KGs with LLM applications and RAG pipelines

## Conferences & Events

```
Graph Connect        → Neo4j ecosystem
Graph Day            → Independent graph conference
Connected Data London → KG, Linked Data, AI/ML integration
```

## Research Directions

### Active Areas (2024-2025)
- **KG + LLM integration**: RAG, knowledge-grounded generation
- **Temporal KG completion**: Predicting future facts
- **Multi-modal KGs**: Integrating text, images, audio
- **Explainable graph ML**: Interpretable GNN predictions
- **Federated knowledge graphs**: Privacy-preserving graph queries
- **Automated KG construction**: LLM-based entity/relation extraction

## Quick Start Checklist

### For Researchers
- [ ] Survey datasets: Wikidata, DBpedia, domain-specific KGs
- [ ] Learn SPARQL for querying RDF stores
- [ ] Explore graph embeddings (TransE, RotatE)
- [ ] Experiment with GNN libraries (PyTorch Geometric, DGL)

### For Engineers
- [ ] Set up Neo4j or JanusGraph locally
- [ ] Learn Cypher or Gremlin query language
- [ ] Build a simple entity extraction pipeline
- [ ] Integrate with vector DB for hybrid search
- [ ] Deploy graph visualization (Cytoscape.js, Sigma.js)

### For Product Teams
- [ ] Identify use case (recommendations, fraud, Q&A, etc.)
- [ ] Choose deployment model (self-hosted vs. managed)
- [ ] Evaluate query language fit (Cypher vs. Gremlin vs. SPARQL)
- [ ] Plan data ingestion strategy
- [ ] Benchmark query performance at scale

## Integration Patterns

### KG + Vector Database
```
Documents → Chunks → Embeddings → Vector DB (Pinecone, Weaviate)
                ↓
          Entity extraction → Knowledge Graph (Neo4j, Dgraph)
                ↓
Query → Hybrid retrieval (semantic + graph) → LLM → Answer
```

### KG + LLM RAG
```
User query → Retrieve relevant KG subgraph
          ↓
     Format as context (triples, natural language)
          ↓
     LLM with context → Grounded response
```

### KG + Real-Time Data Streams
```
Kafka/Flink → Entity extraction → Graph updates (Memgraph, Dgraph)
                                       ↓
                              Pattern detection → Alerts
```

## Troubleshooting Common Issues

### Performance
- **Slow queries**: Add indexes on frequently queried properties
- **Large traversals**: Limit depth, use sampling, or pre-compute paths
- **Write bottlenecks**: Batch inserts, use write-optimized backends

### Data Quality
- **Duplicate entities**: Run entity resolution pipelines (Dedupe, LIMES)
- **Stale data**: Implement temporal versioning or TTL policies
- **Inconsistent schema**: Use ontology validation (SHACL, ShEx)

### Integration
- **Heterogeneous data**: Use R2RML or custom ETL for schema mapping
- **Multiple sources**: Implement conflict resolution (recency, provenance, voting)
- **Evolving schema**: Use flexible property graphs or versioned ontologies

## Best Practices

1. **Design for queries**: Model the graph based on access patterns, not just schema
2. **Denormalize strategically**: Store computed properties for frequent reads
3. **Index wisely**: Balance write performance vs. query speed
4. **Version temporal data**: Track entity/relation changes over time
5. **Monitor graph metrics**: Diameter, density, centrality for health checks
6. **Test at scale**: Prototype with production-size data early
7. **Document ontology**: Maintain clear schema definitions and examples
8. **Validate incrementally**: Check data quality during ingestion, not after

## Reference Files

- Main resource: `resources/knowledge_graphs/awesome-knowledge-graph/readme.md`
- Contributing: `contributing.md`
- Code of conduct: `code-of-conduct.md`

## Next Steps

After mastering basics:
1. Build a simple KG from Wikipedia/DBpedia
2. Implement graph embeddings for link prediction
3. Integrate KG with LLM for RAG
4. Explore temporal KGs for event prediction
5. Deploy production graph DB with monitoring
6. Contribute to open-source KG projects

## Cross-Skill Integration

- **graphiti**: Temporally-aware KGs for AI agents
- **lightrag**: Graph-based RAG systems
- **koi-net**: Regen Network knowledge graph integration
- **sparql-query**: SPARQL endpoint querying
- **dgraph**: Deep dive into Dgraph ecosystem
