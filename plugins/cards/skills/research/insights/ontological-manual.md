# The Agentic LLM User Manual

## Semantic Density → Agentic Capacity

**Version 1.0 | January 2026**

---

## Preface

This manual operates on a single principle: **compact textual artifacts, when fed to an LLM, maximize its ability to act.**

The most powerful artifacts are *grammars*—specifications that define possibility spaces. Feed the grammar, unlock the space. 50 lines of DDL unlocks arbitrary SQL. A TTL ontology unlocks SPARQL. An OpenAPI spec unlocks an entire REST API. An MCP manifest unlocks tool use.

This is the leverage point. This manual teaches you to identify, create, and wield these semantic artifacts.

---

## Table of Contents

1. [Foundations](#1-foundations)
2. [The Semantic Density Principle](#2-the-semantic-density-principle)
3. [Schema as Capability](#3-schema-as-capability)
4. [Knowledge Representation](#4-knowledge-representation)
5. [Agent Protocols](#5-agent-protocols)
6. [Transport Layers](#6-transport-layers)
7. [LLM Patterns](#7-llm-patterns)
8. [Vector & Retrieval Systems](#8-vector--retrieval-systems)
9. [Building Agentic Infrastructure](#9-building-agentic-infrastructure)
10. [Orchestration Patterns](#10-orchestration-patterns)
11. [Reference Architectures](#11-reference-architectures)
12. [Appendix A: 100 Terms Ranked by Agentic Leverage](#appendix-a-100-terms-ranked-by-agentic-leverage)
13. [Appendix B: Quick Reference Cards](#appendix-b-quick-reference-cards)

---

## 1. Foundations

### 1.1 What is an Agentic LLM?

An agentic LLM is a language model that can:
- **Perceive** — ingest structured and unstructured information
- **Reason** — plan, decompose, and evaluate
- **Act** — execute tools, write code, call APIs
- **Learn** — incorporate feedback and update context

The difference between a chatbot and an agent is **tools**. The difference between a weak agent and a powerful agent is **semantic density of context**.

### 1.2 The Context Window as Working Memory

The context window is finite. Every token matters. The goal is to pack maximum actionable information into minimum tokens.

**Bad context:**
```
Here is some information about our database. We have a users table 
that contains information about users including their name, email, 
and when they signed up. We also have a posts table...
```

**Good context:**
```sql
CREATE TABLE users (id SERIAL PRIMARY KEY, name TEXT, email TEXT UNIQUE, created_at TIMESTAMP);
CREATE TABLE posts (id SERIAL PRIMARY KEY, user_id INT REFERENCES users(id), content TEXT, created_at TIMESTAMP);
CREATE INDEX idx_posts_user ON posts(user_id);
```

The DDL is shorter AND more powerful. The LLM can now write arbitrary queries.

### 1.3 The Unlock Hierarchy

Each grammar unlocks a capability space:

| Grammar | Unlocks |
|---------|---------|
| DDL | SQL queries against your database |
| OpenAPI | REST API calls |
| MCP | Tool invocations |
| TTL/OWL | SPARQL queries, ontological reasoning |
| Cypher | Graph traversals |
| JSON Schema | Validated structured outputs |
| Protobuf | gRPC service calls |
| GraphQL SDL | GraphQL queries |

**The meta-skill is recognizing which grammar to feed for which task.**

---

## 2. The Semantic Density Principle

### 2.1 Definition

**Semantic Density** = (Actionable Information) / (Token Count)

High semantic density artifacts enable more agent capability per token spent.

### 2.2 Properties of High-Density Artifacts

1. **Formal** — follow a grammar/specification
2. **Complete** — define the full possibility space
3. **Minimal** — no redundancy or prose padding
4. **Composable** — can be combined with other artifacts
5. **Machine-readable** — parseable structure

### 2.3 Density Spectrum

From low to high density:

```
Prose description → Markdown docs → Structured data → Schema → Grammar → Executable spec
```

Always push right on this spectrum when preparing context for agents.

### 2.4 The Compression Principle

Before feeding any information to an agent, ask:

> "What is the most compressed representation that preserves all actionable information?"

Examples:
- Don't describe a database; export the DDL
- Don't explain an API; provide the OpenAPI spec
- Don't list facts; provide the ontology
- Don't write instructions; provide examples + schema

---

## 3. Schema as Capability

### 3.1 DDL — Data Definition Language

**Purpose:** Define database structure so LLMs can write queries.

**Usage:**
```sql
-- Export from PostgreSQL
pg_dump --schema-only --no-owner mydb > schema.sql

-- Export from MySQL
mysqldump --no-data mydb > schema.sql
```

**What to include:**
- CREATE TABLE statements
- PRIMARY KEY and FOREIGN KEY constraints
- Indexes (inform query optimization)
- CHECK constraints and ENUMs
- Views (expose common query patterns)
- Comments on columns (semantic hints)

**Pro tip:** Add column comments for ambiguous fields:
```sql
COMMENT ON COLUMN orders.status IS 'pending|processing|shipped|delivered|cancelled';
```

### 3.2 OpenAPI

**Purpose:** Define REST APIs so LLMs can make HTTP calls.

**Key sections:**
```yaml
openapi: 3.0.0
info:
  title: My API
  version: 1.0.0
paths:
  /users/{id}:
    get:
      summary: Get user by ID
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: integer
      responses:
        '200':
          description: User object
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/User'
components:
  schemas:
    User:
      type: object
      properties:
        id:
          type: integer
        name:
          type: string
        email:
          type: string
          format: email
```

**Pro tip:** Include example values—LLMs use them for inference:
```yaml
properties:
  status:
    type: string
    enum: [active, inactive, suspended]
    example: active
```

### 3.3 JSON Schema

**Purpose:** Define expected output structure for validated responses.

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["analysis", "confidence", "recommendations"],
  "properties": {
    "analysis": {
      "type": "string",
      "description": "Your detailed analysis"
    },
    "confidence": {
      "type": "number",
      "minimum": 0,
      "maximum": 1
    },
    "recommendations": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["action", "priority"],
        "properties": {
          "action": { "type": "string" },
          "priority": { "type": "string", "enum": ["low", "medium", "high"] }
        }
      }
    }
  }
}
```

**Usage:** Feed this schema to the LLM with instruction to output conforming JSON.

### 3.4 GraphQL SDL

**Purpose:** Define GraphQL APIs for typed queries.

```graphql
type User {
  id: ID!
  name: String!
  email: String!
  posts: [Post!]!
}

type Post {
  id: ID!
  title: String!
  content: String!
  author: User!
  createdAt: DateTime!
}

type Query {
  user(id: ID!): User
  users(limit: Int, offset: Int): [User!]!
  post(id: ID!): Post
}

type Mutation {
  createPost(title: String!, content: String!): Post!
}
```

### 3.5 Protobuf

**Purpose:** Define gRPC services for high-performance RPC.

```protobuf
syntax = "proto3";

service UserService {
  rpc GetUser(GetUserRequest) returns (User);
  rpc ListUsers(ListUsersRequest) returns (stream User);
  rpc CreateUser(CreateUserRequest) returns (User);
}

message User {
  int64 id = 1;
  string name = 2;
  string email = 3;
  google.protobuf.Timestamp created_at = 4;
}

message GetUserRequest {
  int64 id = 1;
}
```

---

## 4. Knowledge Representation

### 4.1 The RDF Stack

RDF (Resource Description Framework) is a family of specifications for representing knowledge as graphs of triples: **Subject → Predicate → Object**.

**The stack:**
```
         ┌─────────────────────────┐
         │   OWL (Full Ontology)   │  ← Classes, restrictions, inference
         ├─────────────────────────┤
         │   RDFS (Schema)         │  ← Class hierarchies, domains, ranges
         ├─────────────────────────┤
         │   RDF (Data Model)      │  ← Triples: subject-predicate-object
         ├─────────────────────────┤
         │   Serializations        │  ← TTL, JSON-LD, N-Triples, RDF/XML
         └─────────────────────────┘
```

### 4.2 TTL — Turtle

**Purpose:** Human-readable RDF serialization. The sweet spot for feeding ontologies to LLMs.

```turtle
@prefix ex: <http://example.org/> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

# Define classes
ex:Person a rdfs:Class ;
    rdfs:label "Person" ;
    rdfs:comment "A human being" .

ex:Organization a rdfs:Class ;
    rdfs:label "Organization" .

# Define properties
ex:worksAt a rdf:Property ;
    rdfs:domain ex:Person ;
    rdfs:range ex:Organization .

ex:name a rdf:Property ;
    rdfs:domain ex:Person ;
    rdfs:range xsd:string .

# Instance data
ex:ygg a ex:Person ;
    ex:name "Ygg" ;
    ex:worksAt ex:BlockScience .

ex:BlockScience a ex:Organization ;
    ex:name "Block Science" .
```

**Why TTL for agents:**
- Compact and readable (LLMs parse it easily)
- Defines vocabulary + instance data together
- Directly queryable with SPARQL

### 4.3 JSON-LD

**Purpose:** JSON-compatible linked data. Best for web APIs and existing JSON infrastructure.

```json
{
  "@context": {
    "@vocab": "http://example.org/",
    "name": "http://schema.org/name",
    "worksAt": {
      "@type": "@id"
    }
  },
  "@id": "http://example.org/ygg",
  "@type": "Person",
  "name": "Ygg",
  "worksAt": {
    "@id": "http://example.org/BlockScience",
    "@type": "Organization",
    "name": "Block Science"
  }
}
```

**Pro tip:** JSON-LD is perfect for Django models—you can serialize with context for semantic interoperability while keeping standard JSON tooling.

### 4.4 OWL — Web Ontology Language

**Purpose:** Full ontological reasoning—classes, restrictions, inference.

```turtle
@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix ex: <http://example.org/> .

ex:Person a owl:Class .
ex:Employee a owl:Class ;
    rdfs:subClassOf ex:Person .

ex:worksAt a owl:ObjectProperty ;
    rdfs:domain ex:Person ;
    rdfs:range ex:Organization .

# Restriction: Employees must work somewhere
ex:Employee rdfs:subClassOf [
    a owl:Restriction ;
    owl:onProperty ex:worksAt ;
    owl:minCardinality 1
] .
```

**Use cases:**
- Consistency checking (detect contradictions)
- Inference (derive new facts from rules)
- Classification (auto-categorize instances)

### 4.5 SHACL — Shapes Constraint Language

**Purpose:** Validate RDF data against expected shapes.

```turtle
@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix ex: <http://example.org/> .

ex:PersonShape a sh:NodeShape ;
    sh:targetClass ex:Person ;
    sh:property [
        sh:path ex:name ;
        sh:datatype xsd:string ;
        sh:minCount 1 ;
        sh:maxCount 1 ;
    ] ;
    sh:property [
        sh:path ex:email ;
        sh:pattern "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$" ;
    ] .
```

**Agent use:** Feed SHACL shapes to validate LLM-generated RDF before committing.

### 4.6 SPARQL

**Purpose:** Query language for RDF data.

```sparql
PREFIX ex: <http://example.org/>

# Find all people and where they work
SELECT ?person ?name ?org ?orgName
WHERE {
    ?person a ex:Person ;
            ex:name ?name ;
            ex:worksAt ?org .
    ?org ex:name ?orgName .
}
ORDER BY ?name

# Find people who work at organizations in a specific domain
SELECT ?person ?name
WHERE {
    ?person a ex:Person ;
            ex:name ?name ;
            ex:worksAt ?org .
    ?org ex:domain ex:RegenerativeFinance .
}
```

**Agent pattern:** Feed TTL ontology + SPARQL examples → LLM can write arbitrary queries.

### 4.7 Cypher (Neo4j)

**Purpose:** Query language for property graphs.

```cypher
// Create nodes and relationships
CREATE (ygg:Person {name: "Ygg", expertise: ["tokenomics", "AI"]})
CREATE (bs:Organization {name: "Block Science"})
CREATE (ygg)-[:WORKS_AT {since: 2023, role: "Fellow"}]->(bs)

// Query: Find all organizations a person works at
MATCH (p:Person {name: "Ygg"})-[r:WORKS_AT]->(org:Organization)
RETURN org.name, r.role, r.since

// Query: Find 2-hop connections
MATCH (p:Person {name: "Ygg"})-[:WORKS_AT]->(:Organization)<-[:WORKS_AT]-(colleague:Person)
WHERE colleague <> p
RETURN DISTINCT colleague.name

// Query: Shortest path between entities
MATCH path = shortestPath((a:Person {name: "Ygg"})-[*]-(b:Person {name: "Vitalik"}))
RETURN path
```

**Property graphs vs RDF:**
- Property graphs: properties on edges are first-class
- RDF: requires reification for edge properties
- For personal knowledge graphs with rich relationship metadata, property graphs often win

### 4.8 GDS — Graph Data Science

**Purpose:** Neo4j library for graph algorithms.

```cypher
// Create a graph projection
CALL gds.graph.project(
    'myGraph',
    'Person',
    'KNOWS',
    { relationshipProperties: 'weight' }
)

// Run PageRank
CALL gds.pageRank.stream('myGraph')
YIELD nodeId, score
RETURN gds.util.asNode(nodeId).name AS name, score
ORDER BY score DESC

// Community detection
CALL gds.louvain.stream('myGraph')
YIELD nodeId, communityId
RETURN communityId, collect(gds.util.asNode(nodeId).name) AS members

// Node similarity
CALL gds.nodeSimilarity.stream('myGraph')
YIELD node1, node2, similarity
RETURN gds.util.asNode(node1).name AS person1,
       gds.util.asNode(node2).name AS person2,
       similarity
ORDER BY similarity DESC
```

**Agent use:** Run GDS algorithms to discover latent connections, then feed results back as context.

---

## 5. Agent Protocols

### 5.1 MCP — Model Context Protocol

**Purpose:** Standardized way to give LLMs access to tools and context.

**Architecture:**
```
┌──────────────┐       ┌──────────────┐       ┌──────────────┐
│   LLM Host   │◄─────►│  MCP Server  │◄─────►│   Resource   │
│   (Claude)   │ JSON  │  (Your Code) │       │  (DB, API)   │
└──────────────┘  RPC  └──────────────┘       └──────────────┘
```

**MCP Server Definition:**
```python
from mcp.server import Server
from mcp.types import Tool, TextContent

server = Server("my-tools")

@server.tool()
async def query_database(sql: str) -> str:
    """Execute a SQL query against the database.
    
    Args:
        sql: The SQL query to execute (SELECT only)
    """
    # Validate and execute
    result = await db.execute(sql)
    return json.dumps(result)

@server.tool()
async def search_documents(query: str, limit: int = 10) -> str:
    """Search the document corpus using semantic similarity.
    
    Args:
        query: Natural language search query
        limit: Maximum results to return
    """
    embeddings = await embed(query)
    results = await vector_store.search(embeddings, limit)
    return json.dumps(results)
```

**Tool manifest (what the LLM sees):**
```json
{
  "tools": [
    {
      "name": "query_database",
      "description": "Execute a SQL query against the database.",
      "inputSchema": {
        "type": "object",
        "properties": {
          "sql": {
            "type": "string",
            "description": "The SQL query to execute (SELECT only)"
          }
        },
        "required": ["sql"]
      }
    }
  ]
}
```

**Key insight:** The tool description + input schema IS the semantic artifact. Write them carefully.

### 5.2 A2A — Agent-to-Agent Protocol

**Purpose:** Standardized communication between autonomous agents.

**Core concepts:**
- **Agent Card:** JSON manifest describing agent capabilities
- **Tasks:** Units of work with defined inputs/outputs
- **Messages:** Structured communication with parts (text, files, data)
- **Streaming:** Real-time updates via SSE

**Agent Card:**
```json
{
  "name": "Research Agent",
  "description": "Performs deep research on topics",
  "url": "https://research-agent.example.com",
  "capabilities": {
    "streaming": true,
    "pushNotifications": false
  },
  "skills": [
    {
      "id": "web-research",
      "name": "Web Research",
      "description": "Search and synthesize information from the web",
      "inputSchema": {
        "type": "object",
        "properties": {
          "query": { "type": "string" },
          "depth": { "type": "string", "enum": ["shallow", "deep"] }
        }
      }
    }
  ]
}
```

**Task lifecycle:**
```
Client                          Agent
   │                              │
   │─── POST /tasks ─────────────►│
   │◄── 201 Created + task_id ────│
   │                              │
   │─── GET /tasks/{id}/stream ──►│
   │◄── SSE: status updates ──────│
   │◄── SSE: partial results ─────│
   │◄── SSE: complete ────────────│
```

### 5.3 ATPROTO — Authenticated Transfer Protocol

**Purpose:** Decentralized social networking protocol (powers Bluesky).

**Key concepts:**
- **DID:** Decentralized Identifier (user identity)
- **PDS:** Personal Data Server (user's data store)
- **Lexicon:** Schema definitions for record types
- **XRPC:** Cross-server RPC

**Lexicon (schema definition):**
```json
{
  "lexicon": 1,
  "id": "app.bsky.feed.post",
  "defs": {
    "main": {
      "type": "record",
      "key": "tid",
      "record": {
        "type": "object",
        "required": ["text", "createdAt"],
        "properties": {
          "text": { "type": "string", "maxLength": 3000 },
          "createdAt": { "type": "string", "format": "datetime" },
          "reply": { "type": "ref", "ref": "#replyRef" }
        }
      }
    }
  }
}
```

**Agent use cases:**
- Build agents that post/interact on Bluesky
- Create custom feed generators
- Analyze social graph data

### 5.4 OpenAPI for Agent Tools

**Pattern:** Convert any OpenAPI spec into MCP tools.

```python
import yaml
from mcp.server import Server

def openapi_to_mcp_tools(openapi_spec: dict) -> list[Tool]:
    """Convert OpenAPI paths to MCP tool definitions."""
    tools = []
    for path, methods in openapi_spec["paths"].items():
        for method, details in methods.items():
            tool = Tool(
                name=details.get("operationId", f"{method}_{path}"),
                description=details.get("summary", ""),
                inputSchema=extract_input_schema(details)
            )
            tools.append(tool)
    return tools
```

This is massive leverage—any documented API becomes agent-accessible.

---

## 6. Transport Layers

### 6.1 HTTP — Hypertext Transfer Protocol

**The foundation.** Everything builds on HTTP.

**Key methods for agents:**
- `GET` — Retrieve resources
- `POST` — Create resources, submit data
- `PUT/PATCH` — Update resources
- `DELETE` — Remove resources

**Headers that matter:**
```http
Content-Type: application/json
Authorization: Bearer <token>
Accept: text/event-stream  # For SSE
```

### 6.2 SSE — Server-Sent Events

**Purpose:** Server-to-client streaming over HTTP.

**Server (Python/FastAPI):**
```python
from fastapi import FastAPI
from fastapi.responses import StreamingResponse

app = FastAPI()

async def generate_stream():
    for i in range(10):
        yield f"data: {json.dumps({'step': i, 'content': '...'})}\n\n"
        await asyncio.sleep(0.1)
    yield "data: [DONE]\n\n"

@app.get("/stream")
async def stream():
    return StreamingResponse(
        generate_stream(),
        media_type="text/event-stream"
    )
```

**Client (JavaScript):**
```javascript
const eventSource = new EventSource('/stream');
eventSource.onmessage = (event) => {
    const data = JSON.parse(event.data);
    console.log(data);
};
```

**Agent use:** Stream LLM responses, tool execution progress, multi-step reasoning.

### 6.3 WS — WebSockets

**Purpose:** Full-duplex communication.

**When to use over SSE:**
- Need bidirectional communication
- Client needs to send data mid-stream
- Real-time collaborative features

```python
from fastapi import FastAPI, WebSocket

app = FastAPI()

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    while True:
        data = await websocket.receive_text()
        # Process and respond
        await websocket.send_text(f"Response: {data}")
```

### 6.4 gRPC

**Purpose:** High-performance RPC with streaming.

**When to use:**
- Service-to-service communication
- High throughput requirements
- Strongly typed contracts needed
- Bidirectional streaming

**Python client:**
```python
import grpc
import service_pb2
import service_pb2_grpc

channel = grpc.insecure_channel('localhost:50051')
stub = service_pb2_grpc.MyServiceStub(channel)

response = stub.GetUser(service_pb2.GetUserRequest(id=123))
print(response.name)
```

---

## 7. LLM Patterns

### 7.1 RAG — Retrieval Augmented Generation

**The pattern:** Retrieve relevant context → Inject into prompt → Generate.

**Architecture:**
```
┌─────────┐     ┌──────────┐     ┌─────────┐     ┌─────────┐
│  Query  │────►│  Embed   │────►│ Search  │────►│ Retrieve│
└─────────┘     └──────────┘     │ Index   │     │ Top-K   │
                                 └─────────┘     └────┬────┘
                                                      │
┌─────────┐     ┌──────────┐     ┌─────────┐          │
│ Response│◄────│   LLM    │◄────│ Augment │◄─────────┘
└─────────┘     └──────────┘     │ Prompt  │
                                 └─────────┘
```

**Implementation:**
```python
async def rag_query(question: str) -> str:
    # 1. Embed the question
    query_embedding = await embed(question)
    
    # 2. Search for relevant chunks
    results = await vector_store.search(query_embedding, k=5)
    
    # 3. Build augmented prompt
    context = "\n\n".join([r.content for r in results])
    prompt = f"""Based on the following context, answer the question.

Context:
{context}

Question: {question}

Answer:"""
    
    # 4. Generate
    response = await llm.complete(prompt)
    return response
```

### 7.2 CoT — Chain of Thought

**The pattern:** Prompt the model to show reasoning steps.

**Basic:**
```
Question: If a train travels 120 miles in 2 hours, then stops for 30 minutes, 
then travels another 90 miles in 1.5 hours, what is the average speed 
for the entire journey including the stop?

Let's think step by step:
```

**Structured:**
```
Analyze this business decision using the following framework:

1. First, identify the key stakeholders and their interests
2. Then, list the potential benefits and risks
3. Next, consider second-order effects
4. Finally, make a recommendation with confidence level

Decision: [description]
```

### 7.3 ReAct — Reasoning + Acting

**The pattern:** Interleave thinking with tool use.

```
Question: What is the population of the capital of France?

Thought: I need to find the capital of France, then look up its population.
Action: search("capital of France")
Observation: Paris is the capital of France.
Thought: Now I need to find the population of Paris.
Action: search("population of Paris 2024")
Observation: Paris has a population of approximately 2.1 million in the city proper.
Thought: I have the answer.
Answer: The population of Paris, the capital of France, is approximately 2.1 million.
```

**Implementation:**
```python
REACT_PROMPT = """You are an agent that can use tools to answer questions.

Available tools:
{tools}

Use this format:
Thought: [your reasoning]
Action: [tool_name(arguments)]
Observation: [tool result - filled by system]
... (repeat as needed)
Thought: I have the answer
Answer: [final answer]

Question: {question}
"""

async def react_loop(question: str, max_steps: int = 10):
    messages = [{"role": "user", "content": REACT_PROMPT.format(...)}]
    
    for _ in range(max_steps):
        response = await llm.complete(messages)
        
        if "Answer:" in response:
            return extract_answer(response)
        
        if "Action:" in response:
            tool_call = parse_action(response)
            result = await execute_tool(tool_call)
            messages.append({"role": "assistant", "content": response})
            messages.append({"role": "user", "content": f"Observation: {result}"})
```

### 7.4 HyDE — Hypothetical Document Embeddings

**The pattern:** Generate a hypothetical answer, embed that, search for similar real documents.

**Problem:** Query embeddings often don't match document embeddings well.
- Query: "What causes rain?"
- Document: "Precipitation occurs when water vapor in clouds condenses..."

**Solution:**
```python
async def hyde_search(question: str) -> list:
    # 1. Generate hypothetical answer
    hypothetical = await llm.complete(
        f"Write a short passage that would answer this question: {question}"
    )
    
    # 2. Embed the hypothetical answer
    embedding = await embed(hypothetical)
    
    # 3. Search with that embedding
    results = await vector_store.search(embedding, k=5)
    return results
```

### 7.5 DSPy — Declarative Self-improving Python

**The pattern:** Treat prompts as optimizable programs.

```python
import dspy

# Define a signature (typed prompt template)
class GenerateAnswer(dspy.Signature):
    """Answer questions based on context."""
    context = dspy.InputField(desc="Retrieved passages")
    question = dspy.InputField()
    answer = dspy.OutputField(desc="Concise answer")

# Build a module
class RAG(dspy.Module):
    def __init__(self):
        self.retrieve = dspy.Retrieve(k=3)
        self.generate = dspy.ChainOfThought(GenerateAnswer)
    
    def forward(self, question):
        context = self.retrieve(question).passages
        answer = self.generate(context=context, question=question)
        return answer

# Compile (optimize) the module
from dspy.teleprompt import BootstrapFewShot

optimizer = BootstrapFewShot(metric=my_metric)
compiled_rag = optimizer.compile(RAG(), trainset=examples)
```

**The power:** DSPy automatically optimizes prompts, few-shot examples, and reasoning strategies.

### 7.6 BAML — Basically a Made-up Language

**The pattern:** Type-safe LLM outputs with schema definitions.

```baml
class Person {
    name string
    age int
    occupation string?
}

function ExtractPerson(text: string) -> Person {
    client GPT4
    prompt #"
        Extract person information from the following text:
        {{ text }}
        
        {{ ctx.output_format }}
    "#
}
```

**Generated TypeScript:**
```typescript
const person = await b.ExtractPerson("John is a 30-year-old engineer.");
// person is typed as { name: string, age: number, occupation?: string }
```

### 7.7 LoRA — Low-Rank Adaptation

**The pattern:** Efficient fine-tuning by training small adapter matrices.

**When to use:**
- Need specialized behavior beyond prompting
- Have domain-specific data
- Want consistent style/format
- Reducing prompt length (bake in instructions)

**Conceptual:**
```
Original weights: W (frozen)
LoRA adapters: A, B (small, trainable)
Effective weights: W + AB
```

**Using with Hugging Face:**
```python
from peft import LoraConfig, get_peft_model

config = LoraConfig(
    r=16,  # rank
    lora_alpha=32,
    target_modules=["q_proj", "v_proj"],
    lora_dropout=0.05,
)

model = get_peft_model(base_model, config)
# Train on your data
```

---

## 8. Vector & Retrieval Systems

### 8.1 Embedding Fundamentals

**What:** Convert text to dense vectors that capture semantic meaning.

**Key properties:**
- Similar meanings → similar vectors (high cosine similarity)
- Typical dimensions: 384, 768, 1536, 3072
- Trade-off: more dimensions = more nuance but more storage/compute

**Models to know:**
- `text-embedding-3-small/large` (OpenAI)
- `embed-english-v3.0` (Cohere)
- `all-MiniLM-L6-v2` (open source, fast)
- `bge-large-en-v1.5` (open source, high quality)

### 8.2 HNSW — Hierarchical Navigable Small Worlds

**The algorithm powering most vector search.**

**Key parameters:**
- `M`: connections per node (higher = better recall, more memory)
- `ef_construction`: search width during build (higher = better quality, slower build)
- `ef_search`: search width during query (higher = better recall, slower query)

**pgvector:**
```sql
-- Create index
CREATE INDEX ON items USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Search
SELECT * FROM items
ORDER BY embedding <=> query_embedding
LIMIT 10;
```

### 8.3 Chunking Strategies

**The hidden complexity of RAG.**

**Fixed size:**
```python
def fixed_chunks(text: str, size: int = 500, overlap: int = 50):
    chunks = []
    for i in range(0, len(text), size - overlap):
        chunks.append(text[i:i + size])
    return chunks
```

**Semantic (by structure):**
```python
def semantic_chunks(text: str):
    # Split by headers, paragraphs, or semantic boundaries
    sections = re.split(r'\n#{1,3} ', text)
    return [s.strip() for s in sections if s.strip()]
```

**Recursive (LangChain style):**
```python
def recursive_chunks(text: str, separators=["\n\n", "\n", ". ", " "]):
    # Try each separator in order until chunks are small enough
    ...
```

**Pro tip:** Include metadata with chunks (source, section, page number) for better retrieval and citation.

### 8.4 Hybrid Search

**Combine vector similarity with keyword matching.**

```sql
-- pgvector + full-text search
SELECT *,
    (embedding <=> query_embedding) AS vector_score,
    ts_rank(search_vector, query) AS text_score
FROM documents
WHERE search_vector @@ query
ORDER BY (0.7 * vector_score + 0.3 * (1 - text_score))
LIMIT 10;
```

### 8.5 GraphRAG

**Enhance RAG with knowledge graph structure.**

**Pattern:**
1. Extract entities and relationships from documents
2. Build knowledge graph
3. At query time: retrieve relevant subgraph + text chunks
4. Provide both as context

**Microsoft's approach:**
```python
# Simplified concept
async def graph_rag(question: str):
    # 1. Get relevant entities
    entities = await extract_entities(question)
    
    # 2. Retrieve subgraph around entities
    subgraph = await kg.get_neighborhood(entities, hops=2)
    
    # 3. Get related text chunks
    chunks = await vector_store.search(question, k=5)
    
    # 4. Combine as context
    context = f"""
Knowledge Graph:
{format_graph(subgraph)}

Related Documents:
{format_chunks(chunks)}
"""
    
    return await llm.complete(f"{context}\n\nQuestion: {question}")
```

---

## 9. Building Agentic Infrastructure

### 9.1 The Card Architecture

**Pattern:** Everything is a Card—a searchable, linkable, embeddable unit of knowledge.

```python
class Card(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    
    # Content
    title = models.CharField(max_length=255)
    content = models.TextField()
    card_type = models.CharField(max_length=50)  # note, person, project, etc.
    
    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    priority = models.FloatField(default=0.5)  # 0-1, for attention allocation
    
    # Embedding
    embedding = VectorField(dimensions=1536)
    
    # Links (self-referential many-to-many)
    links = models.ManyToManyField('self', through='CardLink', symmetrical=False)
    
    # Structured data
    metadata = models.JSONField(default=dict)
```

**CardLink with relationship metadata:**
```python
class CardLink(models.Model):
    source = models.ForeignKey(Card, related_name='outgoing_links')
    target = models.ForeignKey(Card, related_name='incoming_links')
    relationship = models.CharField(max_length=100)  # "references", "contradicts", etc.
    weight = models.FloatField(default=1.0)
    created_at = models.DateTimeField(auto_now_add=True)
```

### 9.2 Temporal Knowledge Graphs

**Adding time as a first-class dimension.**

```python
class TemporalFact(models.Model):
    subject = models.ForeignKey(Card, related_name='facts_as_subject')
    predicate = models.CharField(max_length=100)
    object = models.ForeignKey(Card, related_name='facts_as_object', null=True)
    object_value = models.JSONField(null=True)  # For literal values
    
    # Temporal bounds
    valid_from = models.DateTimeField(null=True)
    valid_to = models.DateTimeField(null=True)
    
    # Provenance
    source = models.ForeignKey(Card, related_name='sourced_facts', null=True)
    confidence = models.FloatField(default=1.0)
```

**Query patterns:**
```python
# What was true at a specific time?
facts = TemporalFact.objects.filter(
    subject=person,
    valid_from__lte=target_date,
    valid_to__gte=target_date  # or null for ongoing
)

# How did this relationship change over time?
history = TemporalFact.objects.filter(
    subject=person,
    predicate='works_at'
).order_by('valid_from')
```

### 9.3 Agent-as-Card

**Represent agents as Cards for meta-reasoning.**

```python
class AgentCard(Card):
    """An agent is a Card that can act."""
    
    system_prompt = models.TextField()
    tools = models.JSONField(default=list)  # MCP tool definitions
    
    # Agent metadata
    temperature = models.FloatField(default=0.7)
    max_tokens = models.IntegerField(default=4096)
    
    # Performance tracking
    invocation_count = models.IntegerField(default=0)
    success_rate = models.FloatField(default=1.0)
    avg_latency_ms = models.FloatField(default=0.0)
```

**Benefit:** Agents can reason about other agents, recommend which to invoke, compose workflows.

### 9.4 Multi-Scale Journaling

**Capture knowledge at different time granularities.**

```python
class JournalEntry(Card):
    """Time-indexed knowledge capture."""
    
    scale = models.CharField(
        max_length=20,
        choices=[
            ('day', 'Daily'),
            ('week', 'Weekly'),
            ('month', 'Monthly'),
            ('quarter', 'Quarterly'),
            ('year', 'Yearly'),
            ('decade', 'Decade'),
        ]
    )
    period_start = models.DateField()
    period_end = models.DateField()
    
    # Structured sections (stored in Card.metadata)
    # - accomplishments
    # - challenges
    # - insights
    # - priorities_next
```

**Rollup pattern:**
```python
async def generate_weekly_rollup(week_start: date):
    daily_entries = JournalEntry.objects.filter(
        scale='day',
        period_start__gte=week_start,
        period_start__lt=week_start + timedelta(days=7)
    )
    
    context = "\n\n".join([e.content for e in daily_entries])
    
    prompt = f"""Synthesize these daily entries into a weekly summary:

{context}

Focus on:
1. Key accomplishments
2. Patterns and insights
3. Priorities for next week
"""
    
    summary = await llm.complete(prompt)
    
    return JournalEntry.objects.create(
        scale='week',
        period_start=week_start,
        period_end=week_start + timedelta(days=6),
        content=summary
    )
```

---

## 10. Orchestration Patterns

### 10.1 DAG Workflows

**Directed Acyclic Graph:** Define task dependencies, execute in correct order.

```python
from dataclasses import dataclass
from typing import Callable, Any

@dataclass
class Task:
    id: str
    fn: Callable
    dependencies: list[str] = None

class DAG:
    def __init__(self):
        self.tasks: dict[str, Task] = {}
        self.results: dict[str, Any] = {}
    
    def add_task(self, task: Task):
        self.tasks[task.id] = task
    
    async def execute(self):
        """Execute tasks in dependency order."""
        pending = set(self.tasks.keys())
        
        while pending:
            # Find tasks with all dependencies satisfied
            ready = [
                t for t in pending
                if all(d in self.results for d in (self.tasks[t].dependencies or []))
            ]
            
            # Execute ready tasks in parallel
            results = await asyncio.gather(*[
                self.tasks[t].fn(
                    **{d: self.results[d] for d in (self.tasks[t].dependencies or [])}
                )
                for t in ready
            ])
            
            for task_id, result in zip(ready, results):
                self.results[task_id] = result
                pending.remove(task_id)
        
        return self.results
```

**Example workflow:**
```python
dag = DAG()

dag.add_task(Task("fetch_data", fetch_from_api))
dag.add_task(Task("process", process_data, dependencies=["fetch_data"]))
dag.add_task(Task("analyze", analyze_with_llm, dependencies=["process"]))
dag.add_task(Task("summarize", generate_summary, dependencies=["analyze"]))

results = await dag.execute()
```

### 10.2 Supervisor Pattern

**A meta-agent that routes to specialist agents.**

```python
class Supervisor:
    def __init__(self, agents: list[AgentCard]):
        self.agents = {a.title: a for a in agents}
        self.router_prompt = self._build_router_prompt()
    
    def _build_router_prompt(self) -> str:
        agent_descriptions = "\n".join([
            f"- {name}: {agent.metadata.get('description', '')}"
            for name, agent in self.agents.items()
        ])
        return f"""You are a supervisor routing tasks to specialist agents.

Available agents:
{agent_descriptions}

Given a task, respond with JSON:
{{"agent": "<agent_name>", "subtask": "<refined task description>"}}
"""
    
    async def route(self, task: str) -> tuple[AgentCard, str]:
        response = await llm.complete(
            self.router_prompt + f"\n\nTask: {task}",
            response_format={"type": "json_object"}
        )
        result = json.loads(response)
        return self.agents[result["agent"]], result["subtask"]
    
    async def execute(self, task: str) -> str:
        agent, subtask = await self.route(task)
        return await agent.invoke(subtask)
```

### 10.3 Reflection Loop

**Agent critiques and improves its own output.**

```python
async def reflection_loop(task: str, max_iterations: int = 3) -> str:
    # Initial attempt
    output = await llm.complete(f"Complete this task:\n{task}")
    
    for i in range(max_iterations):
        # Critique
        critique = await llm.complete(f"""
Review this output for the task "{task}":

{output}

Identify specific improvements needed. If the output is satisfactory, respond with "APPROVED".
""")
        
        if "APPROVED" in critique:
            break
        
        # Improve
        output = await llm.complete(f"""
Original task: {task}

Previous output:
{output}

Critique:
{critique}

Generate an improved version addressing the critique:
""")
    
    return output
```

### 10.4 Tool Use Loop

**The canonical pattern for tool-using agents.**

```python
async def tool_use_loop(
    messages: list[dict],
    tools: list[Tool],
    max_iterations: int = 10
) -> str:
    for _ in range(max_iterations):
        response = await llm.complete(
            messages=messages,
            tools=tools,
            tool_choice="auto"
        )
        
        # Check if done
        if response.stop_reason == "end_turn":
            return response.content
        
        # Execute tool calls
        if response.tool_calls:
            messages.append({"role": "assistant", "content": response.content, "tool_calls": response.tool_calls})
            
            for tool_call in response.tool_calls:
                result = await execute_tool(tool_call)
                messages.append({
                    "role": "tool",
                    "tool_call_id": tool_call.id,
                    "content": result
                })
    
    return messages[-1]["content"]
```

---

## 11. Reference Architectures

### 11.1 Personal Knowledge Agent

```
┌─────────────────────────────────────────────────────────────┐
│                      User Interface                          │
│                    (Chat / CLI / API)                        │
└─────────────────────────┬───────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────┐
│                    Orchestrator Agent                        │
│              (Routes, Decomposes, Synthesizes)               │
└───────┬─────────────┬─────────────┬─────────────┬───────────┘
        │             │             │             │
┌───────▼───────┐ ┌───▼───┐ ┌───────▼───────┐ ┌───▼───────────┐
│  Search Agent │ │Writer │ │ Analysis Agent│ │ External APIs │
│ (RAG + Graph) │ │ Agent │ │ (Reasoning)   │ │  (via MCP)    │
└───────┬───────┘ └───┬───┘ └───────┬───────┘ └───────────────┘
        │             │             │
┌───────▼─────────────▼─────────────▼─────────────────────────┐
│                     Card Database                            │
│          (PostgreSQL + pgvector + Graph Links)               │
└─────────────────────────────────────────────────────────────┘
```

### 11.2 Research Pipeline

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  Query   │────►│  Search  │────►│  Fetch   │────►│  Extract │
│ Expansion│     │ (Web+DB) │     │ Full Text│     │ Entities │
└──────────┘     └──────────┘     └──────────┘     └────┬─────┘
                                                        │
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌────▼─────┐
│  Output  │◄────│ Quality  │◄────│Synthesize│◄────│  Build   │
│  Format  │     │  Check   │     │ Findings │     │   Graph  │
└──────────┘     └──────────┘     └──────────┘     └──────────┘
```

### 11.3 Multi-Agent Collaboration

```
                    ┌─────────────────┐
                    │   Supervisor    │
                    │     Agent       │
                    └────────┬────────┘
                             │
         ┌───────────────────┼───────────────────┐
         │                   │                   │
┌────────▼────────┐ ┌────────▼────────┐ ┌────────▼────────┐
│   Researcher    │ │     Critic      │ │     Writer      │
│     Agent       │ │     Agent       │ │     Agent       │
└────────┬────────┘ └────────┬────────┘ └────────┬────────┘
         │                   │                   │
         └───────────────────┼───────────────────┘
                             │
                    ┌────────▼────────┐
                    │  Shared Context │
                    │   (Message Bus) │
                    └─────────────────┘
```

---

## Appendix A: 100 Terms Ranked by Agentic Leverage

*The principle: compact textual artifacts that, when fed to an LLM, maximize its ability to act.*

### Tier 1: Schema as Capability (1-10)

| Rank | Term | Expansion | One-Liner |
|------|------|-----------|-----------|
| 1 | **DDL** | Data Definition Language | Database schema → unlocks SQL |
| 2 | **TTL** | Turtle | RDF serialization → unlocks SPARQL |
| 3 | **OpenAPI** | Open API Specification | REST API spec → unlocks HTTP calls |
| 4 | **MCP** | Model Context Protocol | Tool definitions → unlocks agent capabilities |
| 5 | **JSON-LD** | JSON for Linked Data | Semantic JSON → unlocks linked data |
| 6 | **SQL** | Structured Query Language | The universal data language |
| 7 | **Cypher** | (Neo4j query language) | Graph queries → unlocks property graphs |
| 8 | **SPARQL** | SPARQL Protocol and RDF Query Language | Triple queries → unlocks knowledge graphs |
| 9 | **JSON Schema** | JSON Schema | Structure validation → unlocks typed outputs |
| 10 | **GraphQL SDL** | GraphQL Schema Definition Language | API schema → unlocks GraphQL |

### Tier 2: Knowledge Architecture (11-20)

| Rank | Term | Expansion | One-Liner |
|------|------|-----------|-----------|
| 11 | **RDF** | Resource Description Framework | The triple data model |
| 12 | **OWL** | Web Ontology Language | Classes, restrictions, inference |
| 13 | **RDFS** | RDF Schema | Class hierarchies, domains, ranges |
| 14 | **SHACL** | Shapes Constraint Language | RDF validation shapes |
| 15 | **Protobuf** | Protocol Buffers | Binary schema → unlocks gRPC |
| 16 | **RAG** | Retrieval Augmented Generation | Ground LLMs in retrieved context |
| 17 | **CoT** | Chain of Thought | Step-by-step reasoning prompting |
| 18 | **ReAct** | Reasoning + Acting | Interleaved thinking and tool use |
| 19 | **A2A** | Agent-to-Agent Protocol | Inter-agent communication standard |
| 20 | **ATPROTO** | Authenticated Transfer Protocol | Decentralized social protocol |

### Tier 3: Transport & Realtime (21-30)

| Rank | Term | Expansion | One-Liner |
|------|------|-----------|-----------|
| 21 | **HTTP** | Hypertext Transfer Protocol | Foundation of web communication |
| 22 | **SSE** | Server-Sent Events | Server → client streaming |
| 23 | **WS** | WebSockets | Full-duplex communication |
| 24 | **gRPC** | Google Remote Procedure Call | High-performance RPC |
| 25 | **REST** | Representational State Transfer | Stateless resource architecture |
| 26 | **GDS** | Graph Data Science | Neo4j's algorithm library |
| 27 | **DAG** | Directed Acyclic Graph | Workflow dependency structure |
| 28 | **XML** | Extensible Markup Language | Structured document format |
| 29 | **YAML** | YAML Ain't Markup Language | Human-readable config format |
| 30 | **TOML** | Tom's Obvious Minimal Language | Simple config format |

### Tier 4: LLM Patterns (31-40)

| Rank | Term | Expansion | One-Liner |
|------|------|-----------|-----------|
| 31 | **HyDE** | Hypothetical Document Embeddings | Generate-then-search retrieval |
| 32 | **DSPy** | Declarative Self-improving Python | Optimizable prompt programs |
| 33 | **BAML** | Basically a Made-up Language | Type-safe LLM outputs |
| 34 | **LoRA** | Low-Rank Adaptation | Efficient fine-tuning |
| 35 | **ICL** | In-Context Learning | Learning from examples in prompt |
| 36 | **SFT** | Supervised Fine-Tuning | Training on input/output pairs |
| 37 | **RLHF** | Reinforcement Learning from Human Feedback | Preference-based training |
| 38 | **DPO** | Direct Preference Optimization | Simplified RLHF alternative |
| 39 | **QLoRA** | Quantized LoRA | Memory-efficient fine-tuning |
| 40 | **PEFT** | Parameter Efficient Fine-Tuning | Family of efficient tuning methods |

### Tier 5: Vector & Retrieval (41-50)

| Rank | Term | Expansion | One-Liner |
|------|------|-----------|-----------|
| 41 | **HNSW** | Hierarchical Navigable Small Worlds | Fast approximate nearest neighbors |
| 42 | **ANN** | Approximate Nearest Neighbors | Scalable similarity search |
| 43 | **KNN** | K-Nearest Neighbors | Exact neighbor search |
| 44 | **BM25** | Best Match 25 | Classic keyword ranking |
| 45 | **TF-IDF** | Term Frequency-Inverse Document Frequency | Term importance weighting |
| 46 | **PCA** | Principal Component Analysis | Dimensionality reduction |
| 47 | **FAISS** | Facebook AI Similarity Search | Vector search library |
| 48 | **pgvector** | PostgreSQL Vector Extension | Vectors in PostgreSQL |
| 49 | **ColBERT** | Contextualized Late Interaction BERT | Token-level retrieval |
| 50 | **GraphRAG** | Graph-enhanced RAG | Knowledge graph + retrieval |

### Tier 6: RDF Ecosystem (51-60)

| Rank | Term | Expansion | One-Liner |
|------|------|-----------|-----------|
| 51 | **N-Triples** | N-Triples | Line-based RDF serialization |
| 52 | **N-Quads** | N-Quads | N-Triples with named graphs |
| 53 | **TriG** | TriG | Turtle with named graphs |
| 54 | **N3** | Notation3 | Extended Turtle with rules |
| 55 | **RDF/XML** | RDF in XML | Original RDF serialization |
| 56 | **SKOS** | Simple Knowledge Organization System | Thesauri and taxonomies |
| 57 | **FOAF** | Friend of a Friend | Social network ontology |
| 58 | **DC** | Dublin Core | Metadata standard |
| 59 | **PROV** | Provenance Ontology | Data lineage tracking |
| 60 | **DCAT** | Data Catalog Vocabulary | Dataset descriptions |

### Tier 7: Data Formats (61-70)

| Rank | Term | Expansion | One-Liner |
|------|------|-----------|-----------|
| 61 | **JSONL** | JSON Lines | Newline-delimited JSON |
| 62 | **Parquet** | Apache Parquet | Columnar storage format |
| 63 | **Arrow** | Apache Arrow | In-memory columnar format |
| 64 | **Avro** | Apache Avro | Row-based serialization |
| 65 | **BSON** | Binary JSON | MongoDB's binary format |
| 66 | **CBOR** | Concise Binary Object Representation | Compact binary data |
| 67 | **MessagePack** | MessagePack | Fast binary JSON alternative |
| 68 | **CSV** | Comma-Separated Values | Universal tabular data |
| 69 | **HDF5** | Hierarchical Data Format 5 | Scientific data storage |
| 70 | **NetCDF** | Network Common Data Form | Multidimensional data |

### Tier 8: Auth & Security (71-80)

| Rank | Term | Expansion | One-Liner |
|------|------|-----------|-----------|
| 71 | **JWT** | JSON Web Token | Stateless authentication |
| 72 | **OAuth** | Open Authorization | Delegated authorization |
| 73 | **OIDC** | OpenID Connect | Identity layer on OAuth |
| 74 | **DID** | Decentralized Identifier | Self-sovereign identity |
| 75 | **VC** | Verifiable Credentials | Cryptographic credentials |
| 76 | **SAML** | Security Assertion Markup Language | Enterprise SSO |
| 77 | **mTLS** | Mutual TLS | Two-way certificate auth |
| 78 | **CORS** | Cross-Origin Resource Sharing | Browser security policy |
| 79 | **CSP** | Content Security Policy | XSS protection |
| 80 | **RBAC** | Role-Based Access Control | Permission management |

### Tier 9: Model Formats & Infra (81-90)

| Rank | Term | Expansion | One-Liner |
|------|------|-----------|-----------|
| 81 | **ONNX** | Open Neural Network Exchange | Portable model format |
| 82 | **GGUF** | GPT-Generated Unified Format | llama.cpp model format |
| 83 | **safetensors** | Safetensors | Secure tensor serialization |
| 84 | **HCL** | HashiCorp Configuration Language | Terraform's config language |
| 85 | **Dockerfile** | Dockerfile | Container build instructions |
| 86 | **K8s YAML** | Kubernetes YAML | Container orchestration config |
| 87 | **Terraform** | Terraform | Infrastructure as code |
| 88 | **CloudFormation** | AWS CloudFormation | AWS infrastructure templates |
| 89 | **Helm** | Helm Charts | Kubernetes package manager |
| 90 | **CUE** | Configure Unify Execute | Typed configuration language |

### Tier 10: Grammars & Meta (91-100)

| Rank | Term | Expansion | One-Liner |
|------|------|-----------|-----------|
| 91 | **BNF/EBNF** | (Extended) Backus-Naur Form | Grammar specification |
| 92 | **RegEx** | Regular Expressions | Pattern matching |
| 93 | **AST** | Abstract Syntax Tree | Code structure representation |
| 94 | **LSP** | Language Server Protocol | IDE ↔ language server |
| 95 | **WASM** | WebAssembly | Portable binary code |
| 96 | **ERD** | Entity Relationship Diagram | Data model visualization |
| 97 | **UML** | Unified Modeling Language | Software architecture notation |
| 98 | **BPMN** | Business Process Model Notation | Process flow diagrams |
| 99 | **Mermaid** | Mermaid | Diagrams as code |
| 100 | **PlantUML** | PlantUML | UML as text |

---

## Appendix B: Quick Reference Cards

### B.1 DDL Cheat Sheet

```sql
-- Table with all the hints
CREATE TABLE cards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    content TEXT,
    card_type VARCHAR(50) CHECK (card_type IN ('note', 'person', 'project')),
    priority FLOAT DEFAULT 0.5 CHECK (priority BETWEEN 0 AND 1),
    embedding VECTOR(1536),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Comments for semantic hints
COMMENT ON COLUMN cards.priority IS 'Attention allocation weight: 0=ignore, 1=urgent';
COMMENT ON COLUMN cards.card_type IS 'Taxonomy: note|person|project|event|concept';

-- Indexes
CREATE INDEX idx_cards_embedding ON cards USING hnsw (embedding vector_cosine_ops);
CREATE INDEX idx_cards_type ON cards (card_type);
CREATE INDEX idx_cards_metadata ON cards USING gin (metadata);
```

### B.2 MCP Tool Template

```python
@server.tool()
async def tool_name(
    required_param: str,
    optional_param: int = 10
) -> str:
    """One-line description of what this tool does.
    
    Detailed description that helps the LLM understand when and how 
    to use this tool effectively.
    
    Args:
        required_param: What this parameter represents
        optional_param: What this controls (default: 10)
    
    Returns:
        Description of the return format
    
    Examples:
        tool_name("example input") -> "example output"
    """
    # Implementation
    result = await do_something(required_param, optional_param)
    return json.dumps(result)
```

### B.3 RAG Prompt Template

```
You are an assistant with access to a knowledge base. Use the provided context to answer questions accurately.

## Context
{retrieved_chunks}

## Instructions
- Answer based ONLY on the provided context
- If the context doesn't contain the answer, say "I don't have information about that in my knowledge base"
- Cite specific sources when possible
- Be concise but complete

## Question
{user_question}

## Answer
```

### B.4 ReAct Prompt Template

```
You are an agent that solves problems by thinking and using tools.

## Available Tools
{tool_descriptions}

## Format
Use this exact format:

Thought: [Your reasoning about what to do next]
Action: tool_name(arg1="value1", arg2="value2")
Observation: [Tool result will appear here]
... (repeat Thought/Action/Observation as needed)
Thought: I have enough information to answer
Answer: [Your final answer]

## Rules
- Always think before acting
- Use tools when you need information you don't have
- Stop when you have a complete answer
- If a tool fails, try a different approach

## Task
{user_task}

Thought:
```

---

## Colophon

**Version:** 1.0
**Date:** January 2026
**Author:** Generated with Claude

**The Core Insight:**
> The most powerful artifacts are grammars—specifications that define possibility spaces. Feed the grammar, unlock the space.

**License:** Use freely. Build agents. Ship products.

---

*"Semantic density is the leverage point. Everything else is implementation."*
