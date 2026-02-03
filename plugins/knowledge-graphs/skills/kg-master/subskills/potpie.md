---
name: potpie
description: Master Potpie for building AI agents specialized in codebases via comprehensive knowledge graphs. Use when you need automated code analysis, codebase Q&A, debugging assistance, test generation, or code changes detection. Supports multi-language parsing, semantic code search, and custom agent creation with 8 specialized tools.
allowed-tools: Read, Glob, Grep, Bash, WebFetch
---

# Potpie Mastery

Build AI agents specialized in your codebase using comprehensive knowledge graphs for automated code understanding, debugging, testing, and development.

## Territory Map

```
resources/knowledge_graphs/potpie/
├── app/
│   ├── modules/
│   │   ├── intelligence/               # Core intelligence layer
│   │   │   ├── agents/                 # Agent implementations
│   │   │   │   ├── chat_agents/        # Chat-based agents
│   │   │   │   │   ├── system_agents/  # Pre-built agents
│   │   │   │   │   │   ├── debug_agent.py              # Stacktrace debugging
│   │   │   │   │   │   ├── qna_agent.py                # Codebase Q&A
│   │   │   │   │   │   ├── code_gen_agent.py           # Code generation
│   │   │   │   │   │   ├── unit_test_agent.py          # Unit test generation
│   │   │   │   │   │   ├── integration_test_agent.py   # Integration tests
│   │   │   │   │   │   ├── low_level_design_agent.py   # LLD generation
│   │   │   │   │   │   └── blast_radius_agent.py       # Impact analysis
│   │   │   │   │   ├── pydantic_agent.py    # Base Pydantic agent
│   │   │   │   │   ├── pydantic_multi_agent.py # Multi-agent orchestration
│   │   │   │   │   └── agent_config.py       # Agent configuration models
│   │   │   │   └── chat_agent.py           # Base chat agent interface
│   │   │   ├── tools/                  # Agent tools
│   │   │   │   ├── kg_based_tools/     # Knowledge graph tools
│   │   │   │   │   ├── ask_knowledge_graph_queries_tool.py
│   │   │   │   │   ├── get_code_from_node_id_tool.py
│   │   │   │   │   ├── get_code_from_multiple_node_ids_tool.py
│   │   │   │   │   ├── get_code_from_probable_node_name_tool.py
│   │   │   │   │   └── get_nodes_from_tags_tool.py
│   │   │   │   ├── code_query_tools/   # Code analysis tools
│   │   │   │   │   ├── get_code_graph_from_node_id_tool.py
│   │   │   │   │   ├── get_node_neighbours_from_node_id_tool.py
│   │   │   │   │   ├── get_code_file_structure.py
│   │   │   │   │   ├── code_analysis.py
│   │   │   │   │   ├── bash_command_tool.py
│   │   │   │   │   └── get_file_content_by_path.py
│   │   │   │   ├── change_detection/   # Change analysis
│   │   │   │   │   └── change_detection_tool.py
│   │   │   │   ├── web_tools/          # External integrations
│   │   │   │   │   ├── web_search_tool.py
│   │   │   │   │   ├── webpage_extractor_tool.py
│   │   │   │   │   └── code_provider_*.py  # GitHub/GitLab ops
│   │   │   │   ├── linear_tools/       # Linear integration
│   │   │   │   ├── jira_tools/         # Jira integration
│   │   │   │   ├── confluence_tools/   # Confluence integration
│   │   │   │   └── tool_service.py     # Tool orchestration
│   │   │   ├── prompts/                # LLM prompts
│   │   │   └── provider/               # LLM provider abstraction
│   │   ├── parsing/                    # Codebase parsing
│   │   │   ├── knowledge_graph/        # KG construction
│   │   │   │   ├── inference_service.py
│   │   │   │   └── inference_schema.py
│   │   │   ├── graph_construction/     # Graph building
│   │   │   │   └── parsing_repomap.py
│   │   │   └── utils/                  # Parsing utilities
│   │   ├── code_provider/              # Git provider abstraction
│   │   │   ├── github/                 # GitHub integration
│   │   │   ├── local_repo/             # Local repositories
│   │   │   └── code_provider_service.py
│   │   ├── projects/                   # Project management
│   │   └── search/                     # Search service
│   ├── celery/                         # Background job processing
│   └── alembic/                        # Database migrations
├── potpie-ui/                          # Frontend (submodule)
├── deployment/                         # Production configs
│   ├── prod/
│   └── stage/
├── docker-compose.yaml                 # Local dev setup
├── requirements.txt                    # Python dependencies
└── pyproject.toml                      # UV package config
```

## Core Capabilities

### Multi-Language Code Parsing
- Automatic language detection and parsing
- Support for Python, JavaScript/TypeScript, Java, Go, Rust, and more
- Tree-sitter based syntax analysis
- Docstring and comment extraction

### Knowledge Graph Architecture
- **Nodes**: Functions, classes, methods, files
- **Edges**: Function calls, imports, inheritance, references
- **Neo4j Backend**: Graph database for relationship storage
- **Vector Search**: Semantic similarity via embeddings
- **Full-Text Search**: BM25-based code search

### Pre-Built Agent Suite
1. **Debugging Agent**: Analyzes stacktraces with codebase context
2. **Q&A Agent**: Answers questions about architecture and functionality
3. **Code Changes Agent**: Impact analysis and blast radius computation
4. **Unit Test Agent**: Generates test plans and unit tests
5. **Integration Test Agent**: Creates integration test scenarios
6. **Low-Level Design Agent**: Produces implementation designs
7. **Code Generation Agent**: Writes production-ready code
8. **Blast Radius Agent**: Identifies affected components

### 8 Core Agent Tools

#### 1. get_code_from_probable_node_name
Retrieve code by file and function/class name pattern.

```python
# Input format
{
    "project_id": "550e8400-e29b-41d4-a716-446655440000",
    "probable_node_names": [
        "src/services/auth.ts:validateToken",
        "src/models/User.ts:User",
        "utils/helper.py:format_date"
    ]
}

# Returns
[
    {
        "node_id": "abc123...",
        "relative_file_path": "src/services/auth.ts",
        "start_line": 45,
        "end_line": 68,
        "code_content": "function validateToken(token) {...}",
        "docstring": "Validates JWT token and returns payload"
    }
]
```

#### 2. get_code_from_node_id
Fetch code for specific node ID from knowledge graph.

```python
# Input
{
    "project_id": "550e8400-e29b-41d4-a716-446655440000",
    "node_id": "123e4567-e89b-12d3-a456-426614174000"
}

# Returns
{
    "node_id": "123e4567...",
    "file_path": "src/auth/validator.py",
    "start_line": 12,
    "end_line": 28,
    "code_content": "def validate_user(user_id): ...",
    "docstring": "Validates user credentials"
}
```

#### 3. get_code_from_multiple_node_ids
Batch retrieve code for multiple nodes efficiently.

```python
# Input
{
    "project_id": "550e8400-e29b-41d4-a716-446655440000",
    "node_ids": ["node1", "node2", "node3"]
}

# Returns list of code dictionaries
```

#### 4. ask_knowledge_graph_queries
Vector similarity search over code knowledge graph.

```python
# Input
{
    "queries": [
        "How is user authentication implemented?",
        "What does the payment processing flow look like?",
        "Where is the email validation logic?"
    ],
    "project_id": "550e8400-e29b-41d4-a716-446655440000",
    "node_ids": []  # Optional context
}

# Returns
[
    [
        {
            "node_id": "xyz789...",
            "docstring": "Authenticates user via OAuth2",
            "file_path": "auth/oauth.py",
            "start_line": 10,
            "end_line": 45,
            "similarity": 0.89
        }
    ]
]
```

#### 5. get_nodes_from_tags
Search nodes by tags/keywords in codebase.

```python
# Input
{
    "project_id": "550e8400-e29b-41d4-a716-446655440000",
    "tags": ["authentication", "validation", "user"]
}

# Returns nodes matching tags
```

#### 6. get_code_graph_from_node_id / get_code_graph_from_node_name
Retrieve graph structure showing relationships.

```python
# Returns graph showing:
# - Function calls (who calls this function)
# - Dependencies (what this function calls)
# - Inheritance hierarchy
# - Import relationships
```

#### 7. change_detection
Detect code changes between branches with impact analysis.

```python
# Input
{
    "project_id": "550e8400-e29b-41d4-a716-446655440000"
}

# Returns
{
    "patches": {
        "file1.py": "diff content...",
        "file2.py": "diff content..."
    },
    "changes": [
        {
            "updated_code": "def new_function()...",
            "entrypoint_code": "def caller()...",
            "citations": ["file1.py", "file2.py"]
        }
    ]
}
```

#### 8. get_code_file_structure
Retrieve nested directory structure of codebase.

```python
# Input
{
    "project_id": "550e8400-e29b-41d4-a716-446655440000"
}

# Returns
{
    "src/": {
        "services/": ["auth.py", "payment.py"],
        "models/": ["user.py", "order.py"],
        "utils/": ["helpers.py"]
    }
}
```

## Beginner Techniques

### Setup and Installation

```bash
# Install uv package manager
curl -LsSf https://astral.sh/uv/install.sh | sh

# Clone and setup
git clone https://github.com/potpie-ai/potpie.git
cd potpie

# Create environment file
cp .env.template .env

# Key configuration
cat > .env << EOF
isDevelopmentMode=enabled
ENV=development
POSTGRES_SERVER=postgresql://postgres:mysecretpassword@localhost:5432/momentum
NEO4J_URI=bolt://127.0.0.1:7687
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=mysecretpassword
REDISHOST=127.0.0.1
REDISPORT=6379
BROKER_URL=redis://127.0.0.1:6379/0
CELERY_QUEUE_NAME=dev
PROJECT_PATH=projects

# LLM Configuration
ANTHROPIC_API_KEY=sk-ant-your-key
INFERENCE_MODEL=anthropic/claude-3-5-sonnet-20241022
CHAT_MODEL=anthropic/claude-3-5-sonnet-20241022
EOF

# Install dependencies
uv sync

# Start services
chmod +x start.sh
./start.sh
```

### Basic Repository Parsing

```bash
# Parse local repository (development mode)
curl -X POST 'http://localhost:8001/api/v1/parse' \
  -H 'Content-Type: application/json' \
  -d '{
    "repo_path": "/path/to/local/repo",
    "branch_name": "main"
  }'

# Parse remote repository (production mode)
curl -X POST 'http://localhost:8001/api/v1/parse' \
  -H 'Content-Type: application/json' \
  -d '{
    "repo_name": "owner/repo-name",
    "branch_name": "main"
  }'

# Save the project_id from response
```

### Monitor Parsing Status

```bash
# Check parsing progress
curl -X GET 'http://localhost:8001/api/v1/parsing-status/YOUR-PROJECT-ID'

# Response shows:
# - Parsing state (in_progress, completed, failed)
# - Files processed
# - Nodes created
# - Edges established
```

### List Available Agents

```bash
curl -X GET 'http://localhost:8001/api/v1/list-available-agents/?list_system_agents=true'

# Returns agent details:
# - agent_id
# - name
# - description
# - capabilities
```

## Intermediate Techniques

### Creating Conversations with Agents

```bash
# Create conversation
curl -X POST 'http://localhost:8001/api/v1/conversations/' \
  -H 'Content-Type: application/json' \
  -d '{
    "user_id": "your_user_id",
    "title": "Debug Authentication Issue",
    "status": "active",
    "project_ids": ["project-uuid"],
    "agent_ids": ["debugging_agent"]
  }'

# Save conversation_id
```

### Interacting with Debugging Agent

```bash
# Send stacktrace for analysis
curl -X POST 'http://localhost:8001/api/v1/conversations/CONV-ID/message/' \
  -H 'Content-Type: application/json' \
  -d '{
    "content": "I am getting this error:\n\nTraceback (most recent call last):\n  File \"app.py\", line 45, in authenticate\n    user = validate_token(token)\nAttributeError: NoneType object has no attribute validate",
    "node_ids": []
  }'

# Agent analyzes:
# 1. Identifies function in stacktrace
# 2. Retrieves relevant code via KG
# 3. Analyzes control flow
# 4. Suggests root cause and fix
```

### Codebase Q&A Pattern

```python
# Agent workflow for "How does authentication work?"

# Step 1: Query knowledge graph
queries = ["authentication flow", "user login", "token validation"]
kg_results = ask_knowledge_graph_queries(queries, project_id)

# Step 2: Get code from relevant nodes
node_ids = [r["node_id"] for r in kg_results[0][:5]]
code_snippets = get_code_from_multiple_node_ids(project_id, node_ids)

# Step 3: Explore relationships
for snippet in code_snippets:
    neighbors = get_node_neighbours_from_node_id(snippet["node_id"])
    # Analyze callers and callees

# Step 4: Synthesize explanation
# Agent combines retrieved context into coherent answer
```

### Code Changes Analysis Workflow

```bash
# Detect changes in feature branch
curl -X POST 'http://localhost:8001/api/v1/conversations/CONV-ID/message/' \
  -H 'Content-Type: application/json' \
  -d '{
    "content": "Analyze the changes in my current branch and identify affected APIs",
    "node_ids": []
  }'

# Agent performs:
# 1. Runs change_detection tool
# 2. Identifies modified functions
# 3. Finds entry points (callers)
# 4. Computes blast radius
# 5. Suggests test coverage
```

## Advanced Techniques

### Custom Agent Creation via Prompt

```bash
# Auto-generate agent from description
curl -X POST "http://localhost:8001/api/v1/custom-agents/agents/auto" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "An agent that analyzes API endpoints, identifies security vulnerabilities, and suggests authentication improvements"
  }'

# Potpie generates:
# - Agent configuration
# - System instructions
# - Tool selection
# - Task definitions
```

### Multi-Agent Orchestration

The `PydanticMultiAgent` system enables sophisticated multi-agent workflows:

```python
# Example: Code Generation with Review
# Main agent coordinates:
# 1. Think/Execute agent for implementation
# 2. Review agent for quality checks

# Configuration in code_gen_agent.py:
delegate_agents = {
    MultiAgentType.THINK_EXECUTE: AgentConfig(
        role="Code Implementation Specialist",
        goal="Write clean, maintainable code",
        tasks=[...],
        max_iter=20
    )
}

# Agent automatically:
# - Decomposes request
# - Delegates to specialist
# - Aggregates results
# - Iterates until convergence
```

### Integration with CI/CD

```bash
# Generate API key for automation
curl -X POST 'http://localhost:8001/api/v1/generate-api-key' \
  -H 'Authorization: Bearer YOUR_TOKEN'

# Use in CI/CD pipeline
export POTPIE_API_KEY="your-api-key"

# Pre-commit hook: Code review
curl -X POST 'http://localhost:8001/api/v1/analyze-changes' \
  -H "X-API-Key: $POTPIE_API_KEY" \
  -d '{
    "project_id": "uuid",
    "branch": "feature/new-api"
  }'

# Generate tests automatically
curl -X POST 'http://localhost:8001/api/v1/generate-tests' \
  -H "X-API-Key: $POTPIE_API_KEY" \
  -d '{
    "project_id": "uuid",
    "node_ids": ["function_node_id"]
  }'
```

### Tool Integration Extensions

```python
# Add custom tool to agent (tool_service.py pattern)

from langchain_core.tools import StructuredTool
from pydantic import BaseModel, Field

class CustomToolInput(BaseModel):
    project_id: str = Field(description="Project UUID")
    query: str = Field(description="Custom query")

class CustomTool:
    name = "custom_analysis"

    def run(self, project_id: str, query: str) -> dict:
        # Your custom logic
        # Can access:
        # - Knowledge graph (Neo4j)
        # - Code provider (GitHub/GitLab)
        # - Vector search
        # - LLM provider
        return {"result": "..."}

def get_custom_tool(db, user_id) -> StructuredTool:
    return StructuredTool.from_function(
        func=CustomTool().run,
        name="custom_analysis",
        description="Performs custom analysis",
        args_schema=CustomToolInput
    )

# Register in ToolService._initialize_tools():
tools["custom_analysis"] = get_custom_tool(self.db, self.user_id)
```

### Slack Integration Setup

```bash
# Install Potpie Slack App
# Visit: https://slack.potpie.ai/slack/install

# Configuration in .env:
SLACK_BOT_TOKEN=xoxb-your-token
SLACK_SIGNING_SECRET=your-secret

# Use in channels:
@potpie How does the payment processing work?
@potpie Debug this stacktrace: [paste error]
@potpie Generate tests for UserService
```

### VSCode Extension Usage

1. Install from VSCode Marketplace: `PotpieAI.potpie-vscode-extension`
2. Configure API endpoint and key
3. Use inline:
   - Right-click code → "Ask Potpie"
   - Select function → "Generate Tests"
   - Highlight error → "Debug with Potpie"

## Expert Patterns

### Knowledge Graph Optimization

```cypher
-- Create custom indices for faster queries
CREATE INDEX node_file_path IF NOT EXISTS
FOR (n:NODE) ON (n.file_path);

CREATE INDEX node_name IF NOT EXISTS
FOR (n:NODE) ON (n.name);

-- Query patterns for agent tools
MATCH (n:NODE {repoId: $project_id})
WHERE n.file_path ENDS WITH $file_path
  AND n.name = $function_name
  AND (n:FUNCTION OR n:CLASS)
RETURN n.node_id AS node_id
```

### Custom Provider Integration

```python
# Support for self-hosted Git (GitLab, GitBucket)

# Environment configuration:
CODE_PROVIDER=gitlab  # Options: github, gitlab, gitbucket
CODE_PROVIDER_BASE_URL=https://gitlab.company.com/api/v4
CODE_PROVIDER_TOKEN=your-private-token

# Potpie automatically:
# - Adapts API calls to provider
# - Handles authentication
# - Normalizes responses
```

### Advanced Agent Prompting

From `code_gen_agent.py`, the structured prompting pattern:

```python
# Agent receives multi-stage instructions:
"""
IMPORTANT: Use the following guide to accomplish tasks

HOW TO traverse the codebase:
1. Use websearch, docstrings, readme to understand context
2. Use AskKnowledgeGraphQueries to locate functionality
3. Use GetCodeFromProbableNodeIDs for specific functions
4. Use GetCodeFromMultipleNodeIDs for batch retrieval
5. Use GetNodeNeighboursFromNodeIDs for relationships
6. Figure out how code ties together
7. Fetch dir structure and use fetch_file for complete files
8. Use code analysis for targeted line numbers
9. Fetch imported code, helpers, classes for control flow

Context Analysis:
- Review exact formatting, indentation, string literals
- Note import organization
- Ensure ALL required files fetched
- Check dependency compatibility
- Analyze database schemas
- Review API contracts

Implementation Planning:
- Maintain exact formatting
- Never modify patterns unless requested
- Identify new imports needed
- Plan changes for ALL affected files
- Map database schema updates
- Detail API version impacts

Code Generation Format:
📝 Overview
🔍 Dependency Analysis
📦 Changes by File
⚠️ Important Notes
🔄 Verification Steps
"""
```

### Codebase Traversal Strategy

Agents use this systematic approach:

1. **Broad Search**: `ask_knowledge_graph_queries` with natural language
2. **Focused Retrieval**: `get_code_from_probable_node_name` for specifics
3. **Relationship Exploration**: `get_node_neighbours_from_node_id` for context
4. **Batch Processing**: `get_code_from_multiple_node_ids` for efficiency
5. **Structure Mapping**: `get_code_file_structure` for navigation
6. **Change Tracking**: `change_detection` for impact analysis

### Production Deployment Architecture

```yaml
# docker-compose.yaml structure
services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: momentum
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}

  neo4j:
    image: neo4j:5.13.0
    environment:
      NEO4J_AUTH: neo4j/${NEO4J_PASSWORD}

  redis:
    image: redis:7-alpine

  potpie-api:
    build:
      context: .
      dockerfile: deployment/prod/mom-api/api.Dockerfile
    environment:
      ENV: production
      INFERENCE_MODEL: ${INFERENCE_MODEL}
      CHAT_MODEL: ${CHAT_MODEL}

  celery-worker:
    build:
      context: .
      dockerfile: deployment/prod/celery/celery.Dockerfile
    environment:
      CELERY_QUEUE_NAME: ${CELERY_QUEUE_NAME}

  potpie-ui:
    build: ./potpie-ui
    environment:
      NEXT_PUBLIC_API_URL: ${API_URL}
```

### Monitoring and Observability

```python
# Phoenix tracing (local development)
# Terminal 1: Start Phoenix
phoenix serve

# Terminal 2: Start Potpie
./start.sh

# Access traces at http://localhost:6006
# View:
# - LLM calls and token usage
# - Tool invocations
# - Agent reasoning steps
# - Performance bottlenecks
```

## Common Patterns

### Pattern 1: Onboarding New Developers

```bash
# Use Q&A agent to create onboarding guide
curl -X POST 'http://localhost:8001/api/v1/conversations/CONV-ID/message/' \
  -d '{
    "content": "Create a comprehensive onboarding guide covering:\n1. How to set up the development environment\n2. Main architecture components\n3. How to run tests\n4. Deployment process"
  }'
```

### Pattern 2: Feature Implementation

```bash
# Step 1: Create Low-Level Design
# Agent: low_level_design_agent
"Design implementation for: Add email notification when order is shipped"

# Step 2: Generate Code
# Agent: code_generation_agent
"Implement the LLD design with all necessary files and dependencies"

# Step 3: Create Tests
# Agent: unit_test_agent
"Generate unit tests for the new shipping notification feature"

# Step 4: Review Impact
# Agent: blast_radius_agent
"Analyze impact of changes on existing order processing flow"
```

### Pattern 3: Legacy Code Understanding

```bash
# Use multiple tools in sequence
# 1. File structure to map codebase
get_code_file_structure(project_id)

# 2. Tag search for relevant modules
get_nodes_from_tags(project_id, ["payment", "legacy", "transaction"])

# 3. KG query for relationships
ask_knowledge_graph_queries([
    "How does the legacy payment system work?",
    "What are the dependencies of the transaction module?"
])

# 4. Code retrieval for analysis
get_code_from_multiple_node_ids(project_id, identified_node_ids)
```

### Pattern 4: Security Audit

```bash
# Create custom agent for security
curl -X POST "http://localhost:8001/api/v1/custom-agents/agents/auto" \
  -d '{
    "prompt": "Security audit agent that:\n- Identifies SQL injection risks\n- Checks authentication bypass vulnerabilities\n- Reviews input validation\n- Suggests security improvements"
  }'

# Run audit
# Agent will:
# 1. Search for database query patterns
# 2. Analyze authentication flows
# 3. Check input sanitization
# 4. Generate security report
```

## Authentication Methods

### Development Mode
```bash
# No authentication required
isDevelopmentMode=enabled
defaultUsername=devuser
```

### Production Mode

#### GitHub App (Recommended)
```bash
GITHUB_APP_ID=123456
GITHUB_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n..."
```

#### Personal Access Token Pool
```bash
# Comma-separated for load balancing
GH_TOKEN_LIST=ghp_token1,ghp_token2,ghp_token3
# Rate limit: 5,000 requests/hour per token
```

#### Self-Hosted Git
```bash
CODE_PROVIDER=gitlab
CODE_PROVIDER_BASE_URL=https://gitlab.company.com/api/v4
CODE_PROVIDER_TOKEN=private-token
```

## Tech Stack

### Backend
- **Python 3.11+**: Core language
- **FastAPI**: REST API framework
- **PostgreSQL**: Relational data (users, projects, conversations)
- **Neo4j**: Graph database (code knowledge graph)
- **Redis**: Caching and Celery broker
- **Celery**: Async task processing (parsing, KG building)

### Frontend
- **Next.js**: React framework
- **TypeScript**: Type safety
- **TailwindCSS**: Styling

### Infrastructure
- **Docker/Docker Compose**: Containerization
- **Kubernetes**: Production orchestration (Jenkinsfile_*)
- **Nginx**: Reverse proxy
- **Supervisord**: Process management

### AI/ML
- **LiteLLM**: Multi-provider LLM abstraction
- **LangChain**: Agent framework and tools
- **Pydantic**: Structured agent outputs
- **Tree-sitter**: Code parsing
- **OpenAI/Anthropic/etc**: Embeddings and LLM inference

## Troubleshooting

### Parsing Failures
```bash
# Check Celery logs
docker logs potpie-celery-worker

# Common issues:
# 1. Unsupported language: Add parser to tree-sitter config
# 2. Large repo timeout: Increase CELERY_TASK_TIMEOUT
# 3. Memory issues: Scale up Docker resources
```

### Knowledge Graph Queries Slow
```cypher
-- Verify indices exist
SHOW INDEXES;

-- Check node counts
MATCH (n:NODE {repoId: $project_id})
RETURN count(n);

-- Optimize: Create compound index
CREATE INDEX node_repo_file IF NOT EXISTS
FOR (n:NODE) ON (n.repoId, n.file_path);
```

### Agent Not Finding Code
```python
# Debug: Check if node exists
from app.modules.search.search_service import SearchService
results = await SearchService(db).search_codebase(
    project_id,
    "function_name OR file_path"
)
# If empty, re-parse repository
```

## Resources

- **Official Docs**: https://docs.potpie.ai
- **API Reference**: https://docs.potpie.ai/open-source
- **GitHub**: https://github.com/potpie-ai/potpie
- **Discord**: https://discord.gg/ryk5CMD5v6
- **VSCode Extension**: https://marketplace.visualstudio.com/items?itemName=PotpieAI.potpie-vscode-extension
- **Slack App**: https://slack.potpie.ai/slack/install

## Key Differences from Other KG Systems

| Feature | Potpie | Graphiti | LightRAG |
|---------|--------|----------|----------|
| **Domain** | Codebase-specific | General temporal KG | General purpose |
| **Nodes** | Functions, classes, files | Entities, episodes, communities | Entities, topics |
| **Edges** | Calls, imports, inheritance | Temporal relationships | Semantic relations |
| **Primary Use** | Code analysis, agents | Agent memory, time-series | RAG enhancement |
| **Query Method** | Tool-based (8 tools) | Hybrid search (BFS + vector) | Two-level retrieval |
| **Backend** | Neo4j only | Neo4j, FalkorDB, Kuzu, Neptune | In-memory graphs |
| **Parsing** | Tree-sitter syntax | LLM-based extraction | LLM-based chunking |
| **Agents** | 8 pre-built + custom | User-built with search | User-built RAG |

Potpie excels at **code understanding** with purpose-built agents and tools, while Graphiti focuses on **temporal reasoning** and LightRAG on **retrieval augmentation**.
