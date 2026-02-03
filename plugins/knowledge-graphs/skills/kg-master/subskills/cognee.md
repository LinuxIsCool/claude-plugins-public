# Cognee - Persistent AI Memory with Knowledge Graphs

Cognee is an open-source tool that transforms raw data into persistent, dynamic AI memory using Extract-Cognify-Load (ECL) pipelines. It combines vector search with graph databases to create searchable, relationship-rich knowledge from your documents.

## What is Cognee?

Cognee replaces traditional RAG systems with a unified memory layer built on graphs and vectors. It processes data through ECL pipelines:
- **Extract**: Ingest data from 30+ sources (text, files, images, audio)
- **Cognify**: Create knowledge graphs using LLMs to extract entities and relationships
- **Load**: Store in hybrid vector + graph databases for retrieval

### Key Features

- Interconnects any data type (conversations, files, images, audio transcriptions)
- Modular architecture with user-defined tasks and pipelines
- Built-in memory algorithms (memify)
- Hybrid retrieval (vector + graph)
- Dynamic updates without reprocessing entire datasets
- Web UI dashboard and CLI tools
- Support for multiple LLM providers (OpenAI, Anthropic, Ollama, local models)
- Flexible database backends (SQLite, Postgres, Neo4j, LanceDB, Qdrant, etc.)

## Installation

### Prerequisites
- Python 3.10 to 3.13

### Install with uv (recommended)
```bash
uv pip install cognee
```

### Install with pip
```bash
pip install cognee
```

### Install with optional dependencies
```bash
# For PostgreSQL support
uv pip install cognee[postgres]

# For Neo4j graph database
uv pip install cognee[neo4j]

# For code graph analysis
uv pip install cognee[codegraph]

# Multiple extras
uv pip install cognee[postgres,neo4j,codegraph,aws]
```

## Configuration

### Quick Setup (OpenAI)
```python
import os
os.environ["LLM_API_KEY"] = "your_openai_api_key"
```

### Environment File Setup
Create a `.env` file in your project root:

```bash
# LLM Configuration
LLM_API_KEY="your_api_key"
LLM_MODEL="openai/gpt-5-mini"
LLM_PROVIDER="openai"

# Embedding Configuration
EMBEDDING_PROVIDER="openai"
EMBEDDING_MODEL="openai/text-embedding-3-large"

# Database Configuration (defaults shown)
DB_PROVIDER="sqlite"              # Relational database
VECTOR_DB_PROVIDER="lancedb"       # Vector database
GRAPH_DATABASE_PROVIDER="kuzu"     # Graph database
```

### Alternative LLM Providers

#### Anthropic
```bash
LLM_API_KEY="your_anthropic_key"
LLM_MODEL="anthropic/claude-3-5-sonnet-20241022"
LLM_PROVIDER="anthropic"
```

#### Ollama (Local)
```bash
LLM_API_KEY="ollama"
LLM_MODEL="llama3.1:8b"
LLM_PROVIDER="ollama"
LLM_ENDPOINT="http://localhost:11434/v1"
EMBEDDING_PROVIDER="ollama"
EMBEDDING_MODEL="nomic-embed-text:latest"
EMBEDDING_ENDPOINT="http://localhost:11434/api/embed"
```

#### Azure OpenAI
```bash
LLM_MODEL="azure/gpt-5-mini"
LLM_ENDPOINT="https://your-endpoint.azure.com/openai/deployments/gpt-5-mini"
LLM_API_KEY="your_azure_key"
LLM_API_VERSION="2024-12-01-preview"
```

## Basic Usage

### Example 1: Simple Text to Knowledge Graph

```python
import cognee
import asyncio

async def main():
    # Add text to cognee
    await cognee.add("Cognee turns documents into AI memory.")

    # Generate the knowledge graph
    await cognee.cognify()

    # Query the knowledge graph
    results = await cognee.search("What does Cognee do?")

    # Display the results
    for result in results:
        print(result)

if __name__ == '__main__':
    asyncio.run(main())
```

**Output:**
```
Cognee turns documents into AI memory.
```

### Example 2: Document Processing

```python
import cognee
import asyncio
from cognee.api.v1.search import SearchType

async def main():
    # Reset data and system state for a clean start
    await cognee.prune.prune_data()
    await cognee.prune.prune_system(metadata=True)

    # Add a document
    text = """
    Natural language processing (NLP) is an interdisciplinary
    subfield of computer science and information retrieval.
    """

    await cognee.add(text)

    # Create knowledge graph
    await cognee.cognify()

    # Search with graph completion
    search_results = await cognee.search(
        query_type=SearchType.GRAPH_COMPLETION,
        query_text="Tell me about NLP"
    )

    for result in search_results:
        print(result)

asyncio.run(main())
```

### Example 3: File Ingestion

```python
import cognee
import asyncio
import os

async def main():
    # Clean slate
    await cognee.prune.prune_data()
    await cognee.prune.prune_system(metadata=True)

    # Add a file path
    file_path = "/path/to/document.txt"
    await cognee.add(file_path)

    # Process into knowledge graph
    await cognee.cognify()

    # Query the processed document
    results = await cognee.search("What are the key topics in the document?")

    for result in results:
        print(result)

asyncio.run(main())
```

## Intermediate Usage

### Example 4: Multiple Data Sources with Node Sets

Node sets allow you to categorize and organize your knowledge graph by topic or domain.

```python
import cognee
import asyncio

async def main():
    await cognee.prune.prune_data()
    await cognee.prune.prune_system(metadata=True)

    # Add data with different node sets
    text_a = """
    AI is revolutionizing financial services through intelligent fraud detection
    and automated customer service platforms.
    """

    text_b = """
    Advances in AI are enabling smarter systems that learn and adapt over time.
    """

    text_c = """
    MedTech startups have seen significant growth in recent years, driven by
    innovation in digital health and medical devices.
    """

    # Associate data with node sets (categories)
    await cognee.add(text_a, node_set=["AI", "FinTech"])
    await cognee.add(text_b, node_set=["AI"])
    await cognee.add(text_c, node_set=["MedTech"])

    # Create unified knowledge graph
    await cognee.cognify()

    # Visualize the graph
    import os
    visualization_path = "./graph_visualization.html"
    await cognee.visualize_graph(visualization_path)
    print(f"Graph visualization saved to {visualization_path}")

asyncio.run(main())
```

### Example 5: Different Search Types

Cognee supports multiple search strategies for different use cases.

```python
import cognee
import asyncio
from cognee.api.v1.search import SearchType

async def main():
    await cognee.prune.prune_data()
    await cognee.prune.prune_system(metadata=True)

    text = """
    Machine learning models require large datasets for training.
    Deep learning is a subset of machine learning that uses neural networks.
    Neural networks are inspired by biological neural networks in the brain.
    """

    await cognee.add(text)
    await cognee.cognify()

    query = "How are neural networks related to machine learning?"

    # Graph completion - traverse relationships
    print("\n=== GRAPH_COMPLETION ===")
    results = await cognee.search(
        query_type=SearchType.GRAPH_COMPLETION,
        query_text=query
    )
    for result in results:
        print(result)

    # RAG completion - vector search + LLM generation
    print("\n=== RAG_COMPLETION ===")
    results = await cognee.search(
        query_type=SearchType.RAG_COMPLETION,
        query_text=query
    )
    for result in results:
        print(result)

    # Chunks - retrieve relevant text chunks
    print("\n=== CHUNKS ===")
    results = await cognee.search(
        query_type=SearchType.CHUNKS,
        query_text=query
    )
    for result in results:
        print(result)

    # Summaries - get document summaries
    print("\n=== SUMMARIES ===")
    results = await cognee.search(
        query_type=SearchType.SUMMARIES,
        query_text=query
    )
    for result in results:
        print(result)

asyncio.run(main())
```

### Example 6: Multimedia Processing

Cognee can process images and audio files using multimodal models.

```python
import cognee
import asyncio
from cognee.api.v1.search import SearchType

async def main():
    await cognee.prune.prune_data()
    await cognee.prune.prune_system(metadata=True)

    # Process multiple file types
    files = [
        "/path/to/audio.mp3",
        "/path/to/image.png",
        "/path/to/document.pdf"
    ]

    await cognee.add(files)
    await cognee.cognify()

    # Query across all multimedia
    results = await cognee.search(
        query_type=SearchType.SUMMARIES,
        query_text="What content is in these files?"
    )

    for result in results:
        print(result)

asyncio.run(main())
```

### Example 7: Dynamic Updates

Update your knowledge graph without reprocessing everything.

```python
import cognee
import asyncio

async def main():
    # Initial data
    await cognee.prune.prune_data()
    await cognee.prune.prune_system(metadata=True)

    await cognee.add("Python is a programming language.")
    await cognee.cognify()

    # Add new information
    await cognee.add("Python was created by Guido van Rossum in 1991.")
    await cognee.cognify()  # Only processes new data

    # The graph now contains both pieces of information
    results = await cognee.search("Tell me about Python")
    for result in results:
        print(result)

    # Update specific data
    await cognee.update(
        data_id="your-data-id",
        new_data="Python 3.12 is the latest version as of 2024."
    )

asyncio.run(main())
```

## Advanced Usage

### Example 8: Custom ECL Pipeline with DataPoints

Create custom data models and pipelines for specialized processing.

```python
import asyncio
from cognee import prune, visualize_graph
from cognee.low_level import setup, DataPoint
from cognee.modules.data.methods import load_or_create_datasets
from cognee.modules.users.methods import get_default_user
from cognee.pipelines import run_tasks, Task
from cognee.tasks.storage import add_data_points

# Define custom data models
class Person(DataPoint):
    name: str
    metadata: dict = {"index_fields": ["name"]}

class Department(DataPoint):
    name: str
    employees: list[Person]
    metadata: dict = {"index_fields": ["name"]}

class Company(DataPoint):
    name: str
    departments: list[Department]
    metadata: dict = {"index_fields": ["name"]}

# Custom ingestion task
def ingest_company_data(data):
    companies = []

    for item in data:
        # Create Person objects
        people = [Person(name=p["name"]) for p in item["people"]]

        # Create Department objects
        dept_dict = {}
        for person in item["people"]:
            dept_name = person["department"]
            if dept_name not in dept_dict:
                dept_dict[dept_name] = Department(name=dept_name, employees=[])
            # Find and add person to department
            for p in people:
                if p.name == person["name"]:
                    dept_dict[dept_name].employees.append(p)

        # Create Company object
        company = Company(
            name=item["company_name"],
            departments=list(dept_dict.values())
        )
        companies.append(company)

    return companies

async def main():
    await prune.prune_data()
    await prune.prune_system(metadata=True)

    # Setup database tables
    await setup()

    # Get default user
    user = await get_default_user()

    # Create dataset
    datasets = await load_or_create_datasets(["company_dataset"], [], user)

    # Prepare data
    data = [{
        "company_name": "TechCorp",
        "people": [
            {"name": "Alice", "department": "Engineering"},
            {"name": "Bob", "department": "Engineering"},
            {"name": "Carol", "department": "Sales"}
        ]
    }]

    # Run custom pipeline
    pipeline = run_tasks(
        [Task(ingest_company_data), Task(add_data_points)],
        dataset_id=datasets[0].id,
        data=data,
        incremental_loading=False
    )

    async for status in pipeline:
        print(f"Pipeline status: {status}")

    # Visualize the custom graph
    await visualize_graph("./company_graph.html")

asyncio.run(main())
```

### Example 9: Memory Algorithms (Memify)

Add advanced memory capabilities to your knowledge graph.

```python
import cognee
import asyncio

async def main():
    await cognee.prune.prune_data()
    await cognee.prune.prune_system(metadata=True)

    # Add data
    text = """
    Python is used for web development, data science, and automation.
    Django is a Python web framework. Flask is another Python web framework.
    NumPy and Pandas are popular data science libraries in Python.
    """

    await cognee.add(text)

    # Create knowledge graph
    await cognee.cognify()

    # Apply memory algorithms to enhance the graph
    # Adds importance scores, temporal awareness, etc.
    await cognee.memify()

    # Search now uses enhanced graph with memory algorithms
    results = await cognee.search("What Python frameworks exist?")
    for result in results:
        print(result)

asyncio.run(main())
```

### Example 10: Custom Search with Cypher Queries

For advanced users who need precise graph queries.

```python
import cognee
import asyncio
from cognee.api.v1.search import SearchType

async def main():
    await cognee.prune.prune_data()
    await cognee.prune.prune_system(metadata=True)

    text = """
    Alice works at Google as a Software Engineer.
    Bob works at Microsoft as a Product Manager.
    Carol works at Google as a Designer.
    """

    await cognee.add(text)
    await cognee.cognify()

    # Use Cypher query for precise graph traversal
    # Find all people who work at Google
    cypher_query = """
    MATCH (person)-[:WORKS_AT]->(company {name: 'Google'})
    RETURN person.name, person.role
    """

    results = await cognee.search(
        query_type=SearchType.CYPHER,
        query_text=cypher_query
    )

    for result in results:
        print(result)

asyncio.run(main())
```

### Example 11: Incremental Loading for Large Datasets

Efficiently process large amounts of data over time.

```python
import cognee
import asyncio
from cognee.modules.data.methods import load_or_create_datasets
from cognee.modules.users.methods import get_default_user

async def main():
    await cognee.prune.prune_data()
    await cognee.prune.prune_system(metadata=True)

    # Get user and create dataset
    user = await get_default_user()
    datasets = await load_or_create_datasets(["large_dataset"], [], user)

    # First batch of data
    batch_1 = ["Document 1 content here...", "Document 2 content here..."]
    for doc in batch_1:
        await cognee.add(doc, dataset_id=datasets[0].id)

    # Process first batch
    await cognee.cognify(dataset_id=datasets[0].id)

    # Add more data incrementally
    batch_2 = ["Document 3 content here...", "Document 4 content here..."]
    for doc in batch_2:
        await cognee.add(doc, dataset_id=datasets[0].id)

    # Process only new data (incremental)
    await cognee.cognify(
        dataset_id=datasets[0].id,
        incremental_loading=True
    )

    # Search across all processed data
    results = await cognee.search("Find relevant information")
    for result in results:
        print(result)

asyncio.run(main())
```

### Example 12: Production Configuration with PostgreSQL and Neo4j

Configure Cognee for production use with enterprise databases.

```python
import os
import cognee
import asyncio

# Production environment configuration
os.environ.update({
    # LLM Configuration
    "LLM_API_KEY": "your_api_key",
    "LLM_MODEL": "openai/gpt-5-mini",
    "LLM_PROVIDER": "openai",

    # PostgreSQL for relational data
    "DB_PROVIDER": "postgres",
    "DB_NAME": "cognee_db",
    "DB_HOST": "localhost",
    "DB_PORT": "5432",
    "DB_USERNAME": "cognee",
    "DB_PASSWORD": "secure_password",

    # Neo4j for graph database
    "GRAPH_DATABASE_PROVIDER": "neo4j",
    "GRAPH_DATABASE_URL": "bolt://localhost:7687",
    "GRAPH_DATABASE_NAME": "neo4j",
    "GRAPH_DATABASE_USERNAME": "neo4j",
    "GRAPH_DATABASE_PASSWORD": "neo4j_password",

    # Qdrant for vector search
    "VECTOR_DB_PROVIDER": "qdrant",
    "VECTOR_DB_URL": "http://localhost:6333",

    # Security settings
    "ACCEPT_LOCAL_FILE_PATH": "False",
    "ALLOW_HTTP_REQUESTS": "False",
    "REQUIRE_AUTHENTICATION": "True"
})

async def main():
    # Production workflow
    await cognee.add("Production data here...")
    await cognee.cognify()

    results = await cognee.search("Production query")
    for result in results:
        print(result)

asyncio.run(main())
```

## CLI Usage

Cognee provides a command-line interface for quick operations.

```bash
# Add data
cognee-cli add "Your text here"
cognee-cli add /path/to/file.txt

# Create knowledge graph
cognee-cli cognify

# Search
cognee-cli search "Your query here"

# Delete all data
cognee-cli delete --all

# Launch Web UI
cognee-cli -ui
```

## MCP Server Integration

Run Cognee as a Model Context Protocol server for integration with Claude Desktop, Cursor, and other MCP clients.

```bash
# Install with MCP extras
cd cognee/cognee-mcp
uv sync --dev --all-extras --reinstall

# Run with different transports
python src/server.py                    # stdio (default)
python src/server.py --transport sse    # SSE streaming
python src/server.py --transport http   # HTTP

# Docker deployment
docker run -e TRANSPORT_MODE=sse --env-file ./.env -p 8000:8000 cognee/cognee-mcp:main
```

## Datasets and Data Management

### Working with Datasets

```python
import cognee
import asyncio

async def main():
    # List all datasets
    datasets = await cognee.datasets.list()
    print(f"Available datasets: {datasets}")

    # Get specific dataset
    dataset = await cognee.datasets.get("dataset_id")
    print(f"Dataset info: {dataset}")

    # Delete dataset
    await cognee.datasets.delete("dataset_id")

asyncio.run(main())
```

### Data Deletion

```python
import cognee
import asyncio

async def main():
    # Soft delete (preserves shared entities)
    await cognee.delete(
        data_id="data-uuid",
        dataset_id="dataset-uuid",
        mode="soft"
    )

    # Hard delete (removes orphaned entities)
    await cognee.delete(
        data_id="data-uuid",
        dataset_id="dataset-uuid",
        mode="hard"
    )

asyncio.run(main())
```

## Monitoring and Observability

### Enable Monitoring

```python
# Install monitoring dependencies
# uv pip install cognee[monitoring]

import os

# Sentry configuration
os.environ["SENTRY_DSN"] = "your_sentry_dsn"

# Langfuse configuration
os.environ["LANGFUSE_PUBLIC_KEY"] = "your_public_key"
os.environ["LANGFUSE_SECRET_KEY"] = "your_secret_key"
os.environ["LANGFUSE_HOST"] = "https://cloud.langfuse.com"
```

## Best Practices

1. **Start Simple**: Begin with basic add/cognify/search workflows before customizing
2. **Use Async**: Always use `asyncio` for better performance
3. **Clean State**: Use `prune` methods for testing and development to ensure clean state
4. **Node Sets**: Organize data with node sets for better categorization
5. **Incremental Loading**: Use for large datasets to avoid reprocessing
6. **Monitor Performance**: Enable logging and monitoring in production
7. **Choose Right Search Type**: Match search type to use case (CHUNKS for retrieval, GRAPH_COMPLETION for reasoning)
8. **Environment Files**: Use `.env` files for configuration management
9. **Version Control**: Exclude `.cognee_system/` and `.cognee_data/` from version control

## Troubleshooting

### Common Issues

**Issue**: "No module named 'cognee'"
```bash
# Solution: Install cognee
uv pip install cognee
```

**Issue**: "API key not found"
```bash
# Solution: Set environment variable
export LLM_API_KEY="your_key_here"
# Or use .env file
```

**Issue**: "Database connection error"
```bash
# Solution: Check database configuration
# Verify DB_HOST, DB_PORT, credentials
# Ensure database server is running
```

**Issue**: Graph visualization not showing
```bash
# Solution: Ensure data has been cognified
await cognee.cognify()  # Run before visualize_graph
```

## Additional Resources

- [Official Documentation](https://docs.cognee.ai/)
- [GitHub Repository](https://github.com/topoteretes/cognee)
- [Discord Community](https://discord.gg/NQPKmU5CCg)
- [Reddit Community](https://www.reddit.com/r/AIMemory/)
- [Example Notebooks](https://github.com/topoteretes/cognee/tree/main/notebooks)
- [Research Paper](https://arxiv.org/abs/2505.24478)

## Summary

Cognee provides a powerful framework for building AI memory systems:
- **ECL Pipelines**: Extract-Cognify-Load architecture
- **Hybrid Storage**: Combines vector and graph databases
- **Flexible**: Support for multiple LLMs, databases, and data sources
- **Scalable**: Incremental loading and modular architecture
- **Production-Ready**: Enterprise database support, monitoring, and security features

Start with simple examples and progressively add complexity as your needs grow. The modular design allows you to customize every aspect of the pipeline while maintaining simplicity for common use cases.
