---
name: kag
description: Master KAG (Knowledge Augmented Generation) for building professional domain knowledge systems with logical reasoning. Use when building domain-specific Q&A systems, multi-hop reasoning applications, schema-constrained knowledge graphs, or hybrid RAG+Graph solutions. Overcomes RAG ambiguity and GraphRAG noise through semantic alignment and logical form-guided reasoning.
allowed-tools: Read, Glob, Grep, Bash, WebFetch
---

# KAG (Knowledge Augmented Generation) Mastery

Build professional domain knowledge systems combining knowledge graphs, vector retrieval, and logical reasoning for complex Q&A and multi-hop inference.

## Territory Map

```
resources/knowledge_graphs/KAG/
├── kag/
│   ├── builder/              # Knowledge construction (kg-builder)
│   │   ├── component/        # Extractors, aligners, splitters, vectorizers
│   │   ├── default_chain.py  # Builder pipeline orchestration
│   │   ├── runner.py         # Execution engine
│   │   └── prompt/           # Construction prompts
│   ├── solver/               # Reasoning & Q&A (kg-solver)
│   │   ├── planner/          # Task planning (static & iterative)
│   │   ├── executor/         # Hybrid retrieval, deduction, math
│   │   ├── generator/        # Answer generation
│   │   ├── prompt/           # Reasoning prompts
│   │   └── pipelineconf/     # Pipeline configs (deep_thought, naive_rag, kag_thinker)
│   ├── indexer/              # Index management (chunk, outline, summary, atomic_query)
│   ├── mcp/                  # MCP protocol integration
│   ├── examples/             # Domain examples (NetOperatorQA, medicine, finance)
│   └── open_benchmark/       # SOTA benchmarks (HotpotQA, 2WikiMultihop, MuSiQue)
└── knext/                    # OpenSPG integration & schema engine
```

## Core Capabilities

KAG addresses three critical RAG limitations:
1. **Vector similarity ambiguity** - Semantic distance doesn't equal reasoning relevance
2. **GraphRAG noise** - OpenIE extracts too many irrelevant facts
3. **Logic insensitivity** - RAG struggles with numerical, temporal, and rule-based reasoning

### Key Features
- **Knowledge-Chunk Mutual Indexing**: Bidirectional links between graph structures and original text
- **Semantic Alignment**: Conceptual reasoning reduces OpenIE noise by 40-60%
- **Schema-Constrained Construction**: Domain expert knowledge via entity/event types
- **Logical Form-Guided Reasoning**: Symbolic planning + LLM hybrid execution
- **Dual Modes**: Simple Mode (fast retrieval) + Deep Reasoning (multi-hop inference)
- **MCP Protocol Support**: Integration with Claude/agent workflows
- **KAG-Thinker Model**: Optimized for breadth-wise decomposition & depth-wise derivation

## Beginner Techniques

### 1. Project Initialization

```bash
# Install KAG
pip install openspg-kag

# Start OpenSPG engine (requires Docker)
docker compose -f docker-compose-west.yml up -d

# Create project
cd kag/examples
knext project create --config_path ./example_config.yaml
```

### 2. Define Domain Schema

Schema constrains knowledge extraction (vs schema-free OpenIE):

```
namespace NetOperatorQA

Document(Original Document): EntityType
    properties:
        desc(Content): Text
            index: TextAndVector

Chunk(Text Block): EntityType
    properties:
        content(Content): Text
            index: TextAndVector
    relations:
        sourceChunk(Associated): Document

KnowledgeUnit(Knowledge Unit): EntityType
    properties:
        ontology(Domain Ontology): Text
            index: Text
        desc(Content): Text
            index: TextAndVector
    relations:
        sourceChunk(Belongs To): Chunk
        sourceDoc(Belongs To): Document
```

**Why Schema Matters**: Schema-constrained extraction aligns with business concepts, reducing noise from irrelevant OpenIE triples.

### 3. Build Knowledge Graph

```python
from kag.builder.runner import KGBuilderRunner

runner = KGBuilderRunner(config_path="./kag_config.yaml")
runner.run(
    scanner_type="file_scanner",
    input_path="./builder/data",
    project_id="NetOperatorQA"
)
```

### 4. Simple Query (Naive RAG Mode)

```python
from kag.solver.main_solver import KAGSolver

solver = KAGSolver(
    config_path="./kag_config.yaml",
    pipeline_config="naive_rag"  # Simple vector retrieval
)

answer = await solver.solve("What is the 5G coverage area?")
```

## Intermediate Techniques

### 1. Index Configuration

KAG supports multiple index types for different retrieval strategies:

```python
# In builder/indexer.py
from kag.indexer import KagIndexManager

manager = KagIndexManager()

# Enable indexes based on complexity needs
manager.enable_indexes([
    "chunk_index",        # Basic text blocks (low cost)
    "outline_index",      # Document structure (low cost)
    "summary_index",      # Semantic summaries (medium cost)
    "atomic_query_index", # Question-answer pairs (high cost)
    "table_index"         # Structured data (medium cost)
])
```

**Index Selection Strategy**:
- **Fast/Test Mode**: chunk_index only
- **Production Mode**: All indexes for maximum retrieval quality

### 2. Deep Reasoning Mode

```yaml
# solver/config.yaml - Deep thought pipeline
solver_pipeline:
  type: kag_static_pipeline
  planner:
    type: lf_kag_static_planner  # Logical form planner
    llm: *chat_llm
    plan_prompt:
      type: default_lf_static_planning
    rewrite_prompt:
      type: default_rewrite_sub_task_query
  executors:
    - type: kag_hybrid_retrieval_executor  # Vector + Graph + BM25
    - type: py_code_based_math_executor    # Numerical reasoning
    - type: kag_deduce_executor            # Logical deduction
    - type: kag_output_executor            # Answer synthesis
```

**Execution Flow**:
1. **Planner** decomposes query into logical subtasks
2. **Executors** run parallel retrieval + reasoning ops
3. **Generator** synthesizes final answer with references

### 3. Semantic Alignment (Noise Reduction)

```python
# In builder configuration
chain:
  type: unstructured_builder_chain
  extractor:
    type: schema_free_extractor  # OpenIE with alignment
    aligner:
      type: kag_aligner          # Merges duplicate entities semantically

# Alignment reduces noise:
# Before: "CEO", "Chief Executive Officer", "executive leader" → 3 nodes
# After:  "CEO" (aligned) → 1 node
```

### 4. Multi-Retriever Configuration

```python
# Hybrid retrieval combining multiple strategies
kag_hybrid_executor:
  type: kag_hybrid_retrieval_executor
  retrievers:
    - type: exact_kg_retriever      # Entity linking + graph walk
      el_num: 5
    - type: fuzzy_kg_retriever      # Vector similarity on graph
      el_num: 5
    - type: chunk_retriever         # Text similarity
      recall_num: 10
      rerank_topk: 5
  merger:
    type: kag_merger                # RRF (Reciprocal Rank Fusion)
```

## Advanced Techniques

### 1. KAG-Thinker Model Integration

Optimized reasoning model with multi-round thinking:

```yaml
# kag_thinker.yaml pipeline
solver_pipeline:
  type: kag_static_pipeline
  planner:
    type: kag_model_planner  # Uses KAG-Thinker for planning
    system_prompt:
      type: kag_system
    clarification_prompt:
      type: kag_clarification
  executors:
    - type: kag_model_hybrid_retrieval_executor
      kag_sub_question_think_prompt:
        type: kag_subquestion_think  # Breadth-wise decomposition
```

**KAG-Thinker Optimizations**:
- Breadth-wise problem decomposition
- Depth-wise solution derivation
- Knowledge boundary determination
- Noise-resistant retrieval

### 2. Domain Knowledge Injection

Custom schema + expert rules for specialized domains:

```python
# schema/Medicine.schema - Medical domain
namespace Medicine

Disease(Disease): EntityType
    properties:
        icd10_code(ICD-10): Text
        symptoms(Symptoms): Text
            index: TextAndVector
    relations:
        treatedBy(Treatment): Drug
        causedBy(Etiology): Pathogen

# Domain-specific reasoning rules
Drug(Medication): EntityType
    properties:
        contraindications(Contraindications): Text
        dosage(Dosage): Text
    relations:
        interactsWith(Drug Interaction): Drug  # Expert rule
```

### 3. MCP Protocol Integration

Enable KAG in agent workflows:

```python
# Start MCP server
from kag.mcp.server import KagMcpServer

server = KagMcpServer(
    transport="sse",
    port=3000,
    enabled_tools=["qa-pipeline", "kb-retrieve"]
)
server.serve()
```

**MCP Tools**:
- `qa-pipeline(query)`: Full reasoning pipeline with answer
- `kb-retrieve(query)`: SPO triples + chunks without synthesis

**Claude Desktop Config**:
```json
{
  "mcpServers": {
    "kag-knowledge": {
      "command": "python",
      "args": ["-m", "kag.bin", "mcp", "--transport", "sse", "--port", "3000"]
    }
  }
}
```

### 4. Custom Executor Development

Extend reasoning with domain operators:

```python
from kag.interface import ExecutorABC, Task, Context

@ExecutorABC.register("medical_diagnostic_executor")
class MedicalDiagnosticExecutor(ExecutorABC):
    async def ainvoke(self, query: str, task: Task, context: Context):
        # Custom medical reasoning logic
        symptoms = await self.extract_symptoms(query)
        diseases = await self.graph_api.query_diseases(symptoms)
        diagnosis = await self.llm.differential_diagnosis(diseases)

        task.result.summary = diagnosis
        return task
```

### 5. Benchmark Reproduction

Compare with SOTA methods:

```python
# Run on HotpotQA benchmark
cd kag/open_benchmark/hotpotqa
python builder/indexer.py  # Build graph
python solver/eval.py      # Run evaluation

# KAG vs alternatives (F1 scores):
# - NaiveRAG: 25.1
# - HippoRAG: 30.9
# - KAG: 37.0 (+19.6% improvement)
```

### 6. Lightweight Build Mode

Reduce token costs by 89% for construction:

```yaml
# builder configuration
kag_builder_pipeline:
  lightweight_mode: true  # Skip expensive LLM calls
  chain:
    extractor:
      type: lightweight_extractor  # Simpler NER
      skip_complex_reasoning: true
```

## Key Patterns

| Pattern | Use Case | Cost |
|---------|----------|------|
| Schema-free extraction | General documents, news, logs | Medium |
| Schema-constrained | Domain expertise, business rules | High (better quality) |
| Chunk-only indexing | Fast prototyping, testing | Very Low |
| Full indexing | Production Q&A, multi-hop reasoning | High |
| Simple mode | Direct fact lookup | Low latency |
| Deep reasoning | Complex inference, calculations | High latency, high quality |
| MCP integration | Agent workflows, Claude Desktop | Variable |

## Architecture Comparison

### RAG vs GraphRAG vs KAG

| Aspect | RAG | GraphRAG | KAG |
|--------|-----|----------|-----|
| Knowledge rep | Vector chunks | OpenIE triples | Schema + chunks + graph |
| Retrieval | Semantic similarity | Graph walk | Hybrid (semantic + graph + logical) |
| Noise level | Low | High (OpenIE) | Low (aligned) |
| Reasoning | LLM only | Graph reasoning | Logical forms + LLM |
| Domain expertise | Weak | Weak | Strong (schema) |

### KAG Unique Advantages

1. **Mutual Indexing**: Graph nodes link back to original chunks for context
2. **Semantic Alignment**: Reduces OpenIE noise via conceptual reasoning
3. **Logical Forms**: Symbolic planning enables multi-step reasoning
4. **Mixed Operators**: Combines retrieval, graph reasoning, language reasoning, calculation

## When to Use KAG

- Professional domain Q&A (medical, financial, legal, telecom)
- Multi-hop reasoning requiring fact chaining
- Numerical/temporal/rule-based reasoning
- Scenarios with expert domain knowledge to encode
- When RAG retrieval quality is insufficient
- Combining structured + unstructured knowledge

## When NOT to Use KAG

- General chatbot (simpler RAG sufficient)
- Simple fact lookup (vector search enough)
- No domain schema available
- Limited compute budget (KAG is heavyweight)
- Latency-critical applications (use Simple Mode)

## Example Domains

1. **Telecom (NetOperatorQA)**: 5G networks, business metrics, partner relationships
2. **Medicine**: Diseases, drugs, treatments, contraindications
3. **Finance (FinAlibaba)**: Company reports, risk indicators, regulatory compliance
4. **Supply Chain**: Logistics, inventory, supplier networks
5. **Risk Mining**: Fraud detection, anomaly patterns

## Performance Benchmarks

### HotpotQA (Multi-hop Reasoning)
- KAG: F1 37.0, EM 24.7
- HippoRAG: F1 30.9, EM 19.8
- NaiveRAG: F1 25.1, EM 12.4

### 2WikiMultihop
- KAG: F1 61.5, EM 42.3
- GraphRAG: F1 46.1, EM 28.9

### Cost Reduction
- Lightweight mode: 89% fewer tokens for construction
- Simple mode: 3-5x faster inference vs Deep Reasoning

## Configuration Templates

### Quick Start (Testing)
```yaml
indexes: [chunk_index]
pipeline: naive_rag
extractors: [schema_free_extractor]
```

### Production (Quality)
```yaml
indexes: [chunk, outline, summary, atomic_query, table]
pipeline: deep_thought
extractors: [schema_constraint_extractor]
retrievers: [exact_kg, fuzzy_kg, chunk, outline, summary, atomic_query]
```

### KAG-Thinker (Best Quality)
```yaml
pipeline: kag_thinker_pipeline
planner: kag_model_planner
model: kag-thinker-v1
```

## Reference Files

- Architecture: `README.md`, `docs/release_notes.md`
- Builder: `kag/builder/default_chain.py`, `kag/builder/runner.py`
- Solver: `kag/solver/main_solver.py`
- Schemas: `kag/examples/NetOperatorQA/schema/NetOperatorQA.schema`
- Pipelines: `kag/solver/pipelineconf/deep_thought.yaml`
- MCP: `kag/mcp/server/kag_mcp_server.py`
- Benchmarks: `kag/open_benchmark/hotpotqa/`, `kag/open_benchmark/2wiki/`
- Examples: `kag/examples/README.md`

## Key Concepts

### DIKW Hierarchy
KAG structures knowledge in layers:
- **Data**: Raw documents, tables, logs
- **Information**: Extracted entities, relations
- **Knowledge**: Aligned concepts, domain ontology
- **Wisdom**: Inference rules, expert patterns

### Logical Form Representation
Natural language queries converted to symbolic execution plans:
```
Query: "What is the revenue growth rate for TechCorp in 2024?"
Logical Form:
  1. RETRIEVE(entity="TechCorp", relation="revenue", time="2024")
  2. RETRIEVE(entity="TechCorp", relation="revenue", time="2023")
  3. CALCULATE(growth_rate, [1.output, 2.output])
  4. OUTPUT(3.result)
```

### Index Types

| Index | Description | Retrieval Strategy | Cost |
|-------|-------------|-------------------|------|
| Chunk | Raw text blocks | Vector similarity | Very Low |
| Outline | Hierarchical headers | Structural matching | Low |
| Summary | Condensed semantics | Concept matching | Medium |
| AtomicQuery | QA pairs | Question similarity | High |
| Table | Structured data | Column/row lookup | Medium |
| Graph (SPO) | Entity relations | Graph traversal | High |

## Common Workflows

### 1. Schema Design
```
1. Analyze domain documents
2. Identify key entities (nouns) and relations (verbs)
3. Define properties and indexes
4. Encode business rules as relations
5. Commit schema: `knext schema commit`
```

### 2. Knowledge Construction
```
1. Prepare data in builder/data/
2. Configure extractors and indexes
3. Run builder: `python builder/indexer.py`
4. Verify graph in Neo4j browser
```

### 3. Q&A Evaluation
```
1. Prepare test questions in solver/data/
2. Select pipeline (naive_rag, deep_thought, kag_thinker)
3. Run solver: `python solver/eval.py`
4. Analyze EM/F1 metrics and answer quality
```

## Troubleshooting

### Low Retrieval Quality
- Enable more indexes (outline, summary, atomic_query)
- Use schema-constrained extraction
- Increase retrieval recall_num and rerank_topk

### High Latency
- Switch to Simple Mode (naive_rag pipeline)
- Reduce number of indexes
- Use lightweight build mode

### OpenIE Noise
- Enable semantic alignment (kag_aligner)
- Use schema-constrained extraction
- Adjust entity linking threshold (el_num)

### Poor Multi-hop Reasoning
- Use deep_thought or kag_thinker pipeline
- Enable logical form planning
- Ensure graph connectivity (check relations in schema)
