---
name: awesome-graph-universe
description: Navigate the complete graph technology ecosystem. Use when selecting graph databases, engines, ETL tools, visualization libraries, or GraphRAG infrastructure. Covers property graphs (Neo4j, ArangoDB, TigerGraph), triple stores (AllegroGraph, Stardog), analytics (NetworkX, Neo4j GDS), computing frameworks (Pregel, GraphFrames), and visualization tools.
allowed-tools: Read, Glob, Grep, Bash, WebFetch
---

# Awesome Graph Universe

Comprehensive guide to the graph technology ecosystem for building knowledge graphs, analytics platforms, and AI-powered applications.

## Territory Map

```
resources/knowledge_graphs/awesome-graph-universe/
├── README.md                # Complete curated list
└── CONTRIBUTING.md          # Contribution guidelines
```

## Technology Categories

### 1. Graph Databases

**Property Graph Databases**
- Store nodes and edges with associated properties
- Support complex relationship patterns
- Ideal for: Knowledge graphs, social networks, recommendation engines

**Key Technologies**:
- **Neo4j** (Java) - Industry-leading native graph database with Cypher query language
- **ArangoDB** (C++) - Multi-model: graphs, documents, key-value
- **TigerGraph** (C++) - Enterprise-scale analytics with deep link analysis
- **Memgraph** (C++) - In-memory, optimized for streaming and dynamic workloads
- **KuzuDB** - Embedded graph database, extremely fast for OLAP workloads
- **FalkorDB** (C/Rust) - Low-latency, GraphBLAS-based, Redis-compatible
- **JanusGraph** (Java) - Distributed, scalable for massive graphs
- **Amazon Neptune** (C++) - Managed service supporting property graphs + RDF

**Triple Stores (RDF Databases)**
- Semantic web standard (subject-predicate-object)
- SPARQL query language
- Ideal for: Ontologies, linked data, interoperability

**Key Technologies**:
- **Stardog** (Java) - Enterprise knowledge graph platform, full RDF/SPARQL compliance
- **AllegroGraph** (Lisp) - Multi-model with vector, document, RDF graph support
- **GraphDB** (Java) - RDF database for linked data creation and querying
- **Apache Fuseki** (Java) - Open-source SPARQL server on Apache Jena
- **QLever** (C++) - Ultra-fast SPARQL engine for massive KGs like Wikidata
- **Oxigraph** (Rust) - Embedded RDF store with WebAssembly support
- **Ontop VKG** (Java) - Virtual Knowledge Graph over relational sources
- **Virtuoso** - Data access, integration, and management with AI support

### 2. Graph Engines

Performance-optimized query and computation systems for large-scale graph processing.

**Key Technologies**:
- **Apache TinkerPop** (Java) - Graph computing framework with Gremlin query language
- **Dgraph** (Go) - Distributed, real-time query execution
- **GFQL** (Python/CUDA) - Dataframe-native columnar processing with GPU acceleration
- **PuppyGraph** - Query multiple data stores as unified graph model
- **GunDB** (JavaScript) - Decentralized graph database for distributed systems

### 3. Knowledge Graphs (Public)

Pre-built semantic knowledge bases for AI and search applications.

**Key Resources**:
- **DBpedia** (PHP) - Structured content extracted from Wikipedia
- **Wikidata** (JavaScript) - Free, open, queryable knowledge graph
- **Google Knowledge Graph** - Powers Google Search with structured knowledge
- **YAGO** (Java) - Semantic knowledge from Wikipedia, WordNet, GeoNames
- **Louie.AI** (Python/CUDA) - Real-time AI graph intelligence tier

### 4. Graph ETL

Extract, Transform, Load tools for building knowledge graphs from diverse sources.

**Key Technologies**:
- **Graph.Build** (Java) - No-code platform for ontologies, schemas, ETL workflows
- **Ontopic Studio** - Rapid KG creation from relational sources, virtualization + ETL
- **Nodestream** (Python) - Declarative framework for building and maintaining graph data
- **TrustGraph** (Python) - Bulk PDF/TXT/MD ingestion to RDF graphs with vector embeddings
- **CocoIndex** (Python) - Real-time KG with incremental processing and custom logic

### 5. Graph Data Science and Analytics

Analyze graph structure and patterns for ML, recommendations, fraud detection, social network analysis.

**Key Technologies**:
- **NetworkX** (Python) - De facto standard for graph creation and analysis
- **Neo4j Graph Data Science** (Java) - 65+ graph algorithms and ML models
- **PyGraphistry[AI]** (Python/CUDA) - GPU-accelerated graph visualization, analytics, ML
- **GraphX (Apache Spark)** (Scala) - Graph-parallel computation at scale
- **GraphFrames** (Scala) - DataFrame-based graphs with Pregel engine
- **Raphtory** (Rust) - In-memory vectorized graph database with Python APIs
- **GraphTool** (Python) - Efficient statistical analysis of graphs
- **MAGE** (C++/Python/Rust) - Memgraph's advanced graph algorithms library
- **Amazon Neptune Analytics** (C++) - Memory-optimized for graph algorithms

### 6. Graph Computing

Distributed infrastructure for large-scale graph processing.

**Key Technologies**:
- **Pregel** (C++) - Google's BSP-based graph processing model (research)
- **Apache Giraph** (Java) - Scalable graph processing used by Facebook
- **GraphLab** (C++) - High-performance ML-focused graph computation
- **GraphFrames** (Scala) - Combines GraphX + DataFrames for Apache Spark
- **GFQL** (Python/CUDA) - GPU-accelerated graph query language
- **thatDot Streaming Graph** (Scala) - Real-time, massively parallel on Quine

### 7. Graph Visualization

**Applications** (Standalone tools):
- **Gephi** - Network analysis and exploration, open-source
- **Neo4j Bloom** - No-code graph exploration for Neo4j
- **Graphistry Hub/Enterprise** (CUDA/WebGL) - GPU-accelerated visual investigation
- **G.V()** - Multi-database client for Gremlin, Cypher, GQL queries
- **Kineviz GraphXR** - Immersive browser-based exploration
- **Linkurious Enterprise** - Interactive visual investigation for decisions
- **NeoDash** - Build dashboards from Neo4j data
- **yEd Desktop/Live** - Draw graphs with styling and auto-layout

**Libraries** (Embeddable):
- **Cytoscape.js** (JavaScript) - Widely used graph visualization library
- **Sigma.js** (JavaScript) - Fast rendering for large networks
- **PyGraphistry** (Python/CUDA/WebGL) - GPU-accelerated with native notebook support
- **GraphistryJS** (JavaScript/CUDA/WebGL) - HTML, React, Node.js library
- **Cambridge Intelligence KeyLines** (JavaScript) - SDK for interactive graph components
- **Orb** (TypeScript) - Memgraph's open-source visualization library
- **yFiles for HTML/Jupyter** - Precise diagramming with advanced layouts

**Purpose Categories**:
- Network Analysis: Global pattern identification (Gephi, Kineviz)
- Local Analysis: Node-centric exploration (Bloom, Linkurious, Graphistry)
- Drawing Graphs: Illustration creation (yEd)
- Data Structuring: Note organization (TheBrain)

### 8. GraphRAG Infrastructure

Use knowledge graphs as basis for Retrieval-Augmented Generation in AI applications.

**Key Technologies**:
- **Microsoft GraphRAG** (Python) - Open-source framework for graph-based RAG
- **LightRAG** (Python) - Dual-retrieval system (low-level/high-level) with Web UI
- **GraphRAG-SDK** (Python) - FalkorDB's toolkit for real-time graph-based retrieval
- **Louie.AI** (Python/CUDA) - Self-adjusting AI graph intelligence tier
- **TrustGraph** (Python) - Full AI engine with native GraphRAG for agents

### 9. Graph Stream Processors

Real-time graph computations within event-stream processing systems.

**Key Technologies**:
- **Quine** (Scala) - Combine multiple event streams into single graph, real-time pattern detection
- **thatDot Streaming Graph** (Scala) - Millions of events/second, massively parallel

## Selection Guide

### By Use Case

**AI Agent Memory Systems**
- Primary: Graphiti + FalkorDB or Neo4j
- GraphRAG: LightRAG, GraphRAG-SDK, TrustGraph
- Visualization: Louie.AI, Graphistry

**Knowledge Graph Construction**
- ETL: Graph.Build, Nodestream, TrustGraph
- Database: Neo4j, Stardog, GraphDB
- Public KGs: DBpedia, Wikidata, YAGO

**Analytics & Data Science**
- Python: NetworkX, PyGraphistry, Raphtory
- Enterprise: Neo4j GDS, TigerGraph Graph Studio
- Distributed: Apache Spark GraphX/GraphFrames

**Real-Time Streaming**
- Stream Processing: Quine, thatDot Streaming Graph
- Database: Memgraph, FalkorDB
- Computing: GFQL (GPU acceleration)

**Semantic Web & Ontologies**
- Triple Stores: Stardog, AllegroGraph, GraphDB
- Query Language: SPARQL
- Virtual KGs: Ontop VKG over relational sources

**Large-Scale Enterprise**
- Property Graphs: TigerGraph, Neo4j, Amazon Neptune
- RDF: Stardog, MarkLogic, Altair Graph Studio
- Distributed: JanusGraph, Dgraph

**Embedded & Edge Computing**
- Lightweight: KuzuDB, Oxigraph, FalkorDB
- WebAssembly: Oxigraph
- In-memory: Memgraph, Raphtory

### By Programming Language

**Python-First**
- NetworkX (analysis)
- PyGraphistry (visualization + ML + GPU)
- LightRAG, TrustGraph (GraphRAG)
- Nodestream (ETL)

**JavaScript/TypeScript**
- GunDB (database)
- Cytoscape.js, Sigma.js (visualization)
- Quadstore (RDF in browsers/Node/Deno)

**Java/Scala**
- Neo4j, JanusGraph, Stardog (databases)
- Apache TinkerPop (framework)
- GraphFrames, thatDot Streaming Graph (computing)

**C++/Performance-Critical**
- TigerGraph, ArangoDB, Amazon Neptune (databases)
- QLever (SPARQL engine)
- GraphLab (ML)

**Rust (Modern Performance)**
- FalkorDB, Raphtory (databases)
- Oxigraph (RDF)

**Go**
- Dgraph (database)

### By Query Language

**Cypher (OpenCypher)**
- Neo4j, Memgraph, FalkorDB, Amazon Neptune
- Most intuitive for pattern matching

**Gremlin**
- Apache TinkerPop, JanusGraph, Amazon Neptune, Azure Cosmos DB
- Functional traversal language

**SPARQL**
- All RDF triple stores
- W3C standard for semantic web

**GraphQL-like**
- Dgraph (GraphQL+-)
- PuppyGraph (unified query)

**SQL-like**
- GFQL (dataframe-native)
- Various bridges to relational systems

## Technology Comparison Matrix

| Category | Open Source | Managed Service | On-Premise | Cloud-Native |
|----------|-------------|-----------------|------------|--------------|
| **Property Graphs** | Neo4j, FalkorDB, JanusGraph, Memgraph | Amazon Neptune, Neo4j Aura | TigerGraph, ArangoDB | Data Graphs |
| **Triple Stores** | Apache Fuseki, Oxigraph, Quadstore | AllegroGraph Cloud | Stardog, GraphDB, Virtuoso | Amazon Neptune |
| **Analytics** | NetworkX, Raphtory, PyGraphistry | Neptune Analytics | Neo4j GDS, TigerGraph | Louie.AI |
| **Visualization** | Gephi, Cytoscape.js, Orb | Graphistry Hub | Linkurious, yFiles | Kineviz GraphXR |
| **GraphRAG** | Microsoft GraphRAG, LightRAG, TrustGraph | Louie.AI | GraphRAG-SDK | - |

## Decision Framework

### Start Here Questions

1. **What type of data model?**
   - Rich properties & relationships → Property Graph (Neo4j, TigerGraph)
   - Semantic web, ontologies → Triple Store (Stardog, GraphDB)
   - Multi-model needs → ArangoDB, AllegroGraph

2. **What scale?**
   - < 1M nodes → Embedded (KuzuDB, Oxigraph)
   - 1M-100M nodes → Single-instance (Neo4j, Memgraph, FalkorDB)
   - > 100M nodes → Distributed (TigerGraph, JanusGraph, Neptune)

3. **Real-time or batch?**
   - Real-time streaming → Memgraph, Quine, FalkorDB
   - Batch analytics → NetworkX, Spark GraphX, TigerGraph
   - Hybrid → Neo4j GDS, PyGraphistry

4. **Managed or self-hosted?**
   - Managed → Amazon Neptune, Neo4j Aura, Data Graphs
   - Self-hosted → Neo4j, Stardog, FalkorDB, ArangoDB
   - Embedded → KuzuDB, Oxigraph

5. **Primary workload?**
   - OLTP (transactions) → Neo4j, FalkorDB, ArangoDB
   - OLAP (analytics) → TigerGraph, KuzuDB, Neptune Analytics
   - GraphRAG → LightRAG, GraphRAG-SDK, TrustGraph

6. **Visualization needs?**
   - Embedded library → Cytoscape.js, PyGraphistry, yFiles
   - Standalone tool → Gephi, Neo4j Bloom, Graphistry
   - Custom development → KeyLines, ReGraph, GraphistryJS

## Key Patterns

### Building a Knowledge Graph Stack

**Minimal Stack**:
```
Database: Neo4j Community or FalkorDB
ETL: Nodestream
Query: Cypher
Visualization: Neo4j Bloom or Gephi
```

**Production Stack**:
```
Database: Neo4j Enterprise or TigerGraph
ETL: Graph.Build or custom with Nodestream
Analytics: Neo4j GDS or PyGraphistry
Visualization: Linkurious or Graphistry
Monitoring: Native tools + custom dashboards
```

**AI/GraphRAG Stack**:
```
Database: FalkorDB or Neo4j
ETL: TrustGraph
GraphRAG: LightRAG or GraphRAG-SDK
Vector DB: Integrated or standalone
Visualization: Louie.AI or Graphistry
```

**Research/Analysis Stack**:
```
Database: Public KG (Wikidata, DBpedia)
Query: SPARQL via QLever or Virtuoso
Analytics: NetworkX, Raphtory
Visualization: Gephi, PyGraphistry
```

### Common Workflows

**ETL Pipeline**:
1. Extract: Source systems (databases, APIs, files)
2. Transform: Graph.Build, Nodestream, or custom scripts
3. Load: Bulk import to Neo4j, TigerGraph, or Stardog
4. Validate: Query patterns, statistics, visualization

**Graph Analytics**:
1. Import: Data to NetworkX, Neo4j GDS, or PyGraphistry
2. Analyze: Run algorithms (PageRank, community detection, centrality)
3. Visualize: Gephi, Graphistry, or custom dashboards
4. Export: Results to database or downstream systems

**GraphRAG Development**:
1. Ingest: Documents via TrustGraph or custom pipeline
2. Build KG: Extract entities, relationships with LLM
3. Index: Vector embeddings + graph structure
4. Query: Hybrid search (semantic + graph traversal)
5. Generate: LLM with retrieved context

## Technology Status Legend

- Active (Green badge): Actively maintained and recommended
- Inactive (Red badge): No longer maintained, consider alternatives
- N/A (Gray badge): Research project or proprietary without public status

## When to Use This Resource

- Evaluating graph database options for new projects
- Selecting analytics or visualization tools
- Building GraphRAG or AI agent memory systems
- Comparing property graphs vs. triple stores
- Finding ETL tools for knowledge graph construction
- Exploring streaming graph processing options
- Researching public knowledge graphs for datasets

## Reference

Main README: `resources/knowledge_graphs/awesome-graph-universe/README.md`

### Technology Deep Dives

For specific technologies, refer to dedicated skills:
- Graphiti: `/plugins/knowledge-graphs/skills/graphiti/`
- Neo4j ecosystem tools
- SPARQL querying: `/plugins/knowledge-graphs/skills/sparql-query/`
- Dgraph: `/plugins/knowledge-graphs/skills/dgraph/`
- FalkorDB: `/plugins/llms/skills/falkordb/`

### Community Resources

- Contribution guidelines: `CONTRIBUTING.md`
- Original inspiration: Jean-Baptiste Musso's awesome-graph (inactive)
- License: CC0 1.0 Universal (freely usable)

## Quick Reference: Top Picks by Category

**Most Popular Overall**: Neo4j (property graph), Stardog (RDF)
**Best for Beginners**: Neo4j + Cypher, NetworkX (Python)
**Best Performance**: TigerGraph (enterprise), FalkorDB (low-latency), KuzuDB (embedded)
**Best for AI/ML**: Neo4j GDS, PyGraphistry, Graphiti + FalkorDB
**Best Open Source**: Neo4j Community, Apache TinkerPop, NetworkX, Gephi
**Best Managed Service**: Amazon Neptune, Neo4j Aura
**Best Visualization**: Graphistry (large-scale), Gephi (network analysis), Cytoscape.js (embeddable)
**Best for Streaming**: Memgraph, Quine, thatDot Streaming Graph
**Best GraphRAG**: LightRAG, Microsoft GraphRAG, GraphRAG-SDK
