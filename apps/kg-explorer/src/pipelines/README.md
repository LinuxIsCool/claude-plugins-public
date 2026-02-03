# KG Explorer ETL Pipeline

A robust, scalable ETL pipeline for ingesting data into the knowledge graph. Designed for continuous improvement with type-safe, composable components.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           ORCHESTRATOR                                  │
│                    (DAG Execution, Retry Logic)                        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   ┌─────────────┐     ┌──────────────┐     ┌─────────────┐            │
│   │  EXTRACTORS │ ──▶ │ TRANSFORMERS │ ──▶ │   LOADERS   │            │
│   └─────────────┘     └──────────────┘     └─────────────┘            │
│   - GitHub            - Entity           - Neo4j                       │
│   - NPM               - Relationship     - TypeDB                      │
│   - PyPI              - Embedding        - JSON                        │
│   - ArXiv             - Temporal         - Batch                       │
│   - Web               - Deduplication                                   │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│                            MONITORS                                     │
│   - Pipeline Metrics  - Data Quality  - Freshness Detection            │
└─────────────────────────────────────────────────────────────────────────┘
```

## Quick Start

### 1. Start Infrastructure

```bash
# Start Neo4j and Redis
docker compose up -d

# Or start with monitoring
docker compose --profile monitoring up -d

# Or start with TypeDB for advanced reasoning
docker compose --profile full up -d
```

### 2. Configure Pipeline

```typescript
import {
  createPipelineConfig,
  getDevelopmentConfig,
} from '@/pipelines';

// Use development preset
const config = getDevelopmentConfig();

// Or build custom configuration
const customConfig = createPipelineConfig()
  .setEnvironment('development')
  .enableSource('github', process.env.GITHUB_TOKEN)
  .enableBackend('neo4j', {
    uri: 'bolt://localhost:7687',
    auth: { username: 'neo4j', password: 'password123' },
  })
  .setBatchSize(100)
  .enableEmbeddings('openai-3-small', process.env.OPENAI_API_KEY)
  .build();
```

### 3. Create and Execute Pipeline

```typescript
import {
  createOrchestrator,
  buildPipelineDAG,
  createGitHubExtractor,
  createEntityTransformer,
  createNeo4jLoader,
  createMetricsCollector,
} from '@/pipelines';

// Create components
const extractor = createGitHubExtractor({
  apiToken: process.env.GITHUB_TOKEN,
});
const transformer = createEntityTransformer();
const loader = createNeo4jLoader({
  uri: 'bolt://localhost:7687',
  auth: { username: 'neo4j', password: 'password123' },
});

// Create orchestrator with monitoring
const orchestrator = createOrchestrator();
const metricsCollector = createMetricsCollector();

orchestrator.registerEventHandler(metricsCollector.handleEvent.bind(metricsCollector));

// Register handlers
orchestrator.registerHandler('extract', async (input, ctx) => {
  const results = [];
  for await (const result of extractor.extract(input)) {
    if (result.success) results.push(result.value);
  }
  return { success: true, value: results };
});

orchestrator.registerHandler('transform', async (input, ctx) => {
  return transformer.transform(input[0], ctx);
});

orchestrator.registerHandler('load', async (input, ctx) => {
  return loader.load(input.entities, {
    batchId: ctx.batchId,
    upsert: true,
    dryRun: false,
    transactional: true,
    batchSize: 100,
  });
});

// Build DAG
const dag = buildPipelineDAG()
  .setName('github-ingestion')
  .addStage({
    id: 'extract',
    name: 'Extract from GitHub',
    type: 'extractor',
    handler: 'extract',
    config: { repositories: ['facebook/react', 'vuejs/vue'] },
    dependencies: [],
  })
  .addStage({
    id: 'transform',
    name: 'Transform to Entities',
    type: 'transformer',
    handler: 'transform',
    config: {},
    dependencies: ['extract'],
  })
  .addStage({
    id: 'load',
    name: 'Load to Neo4j',
    type: 'loader',
    handler: 'load',
    config: {},
    dependencies: ['transform'],
  })
  .build();

// Execute pipeline
const result = await orchestrator.execute(dag, {
  input: {
    filter: {
      repositories: ['facebook/react', 'vuejs/vue'],
    },
  },
});

// Check results
if (result.success) {
  console.log('Pipeline completed:', result.value.progress);
} else {
  console.error('Pipeline failed:', result.error);
}
```

## Components

### Extractors

| Extractor | Source | Features |
|-----------|--------|----------|
| `GitHubExtractor` | GitHub API | Repos, README, deps, contributors, languages |
| `NpmExtractor` | NPM Registry | Packages, versions, downloads, maintainers |
| `PyPIExtractor` | PyPI | Packages, classifiers, dependencies |
| `ArXivExtractor` | ArXiv API | Papers, authors, categories, abstracts |
| `WebExtractor` | Any URL | Metadata, content, links, structured data |

### Transformers

| Transformer | Purpose |
|-------------|---------|
| `EntityTransformer` | Convert raw data to typed entities |
| `RelationshipTransformer` | Infer relationships between entities |
| `EmbeddingTransformer` | Generate vector embeddings |
| `TemporalTransformer` | Add timestamps and version tracking |
| `DeduplicationTransformer` | Merge duplicate entities |

### Loaders

| Loader | Target | Features |
|--------|--------|----------|
| `Neo4jLoader` | Neo4j | Cypher MERGE, constraints, indexes |
| `TypeDBLoader` | TypeDB | TypeQL insert, schema management |
| `JsonLoader` | Files | Development/testing, file patterns |
| `BatchLoader` | Multiple | Parallel backends, progress tracking |

### Monitors

| Monitor | Purpose |
|---------|---------|
| `PipelineMetricsCollector` | Throughput, latency, resource usage |
| `DataQualityMonitor` | Schema validation, completeness |
| `FreshnessMonitor` | Stale data detection, refresh scheduling |

## Configuration

### Environment Variables

```bash
# Sources
GITHUB_TOKEN=ghp_xxx
OPENAI_API_KEY=sk-xxx

# Backends
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=password123

# Optional
TYPEDB_ADDRESS=localhost:1729
REDIS_URL=redis://localhost:6379
```

### Rate Limits

| Source | Default Rate | Configurable |
|--------|-------------|--------------|
| GitHub | 5 req/s | Yes |
| NPM | 20 req/s | Yes |
| PyPI | 10 req/s | Yes |
| ArXiv | 3 req/s (with 3s delay) | Yes |
| Web | 2 req/s | Yes |

## Docker Services

| Service | Port | Purpose |
|---------|------|---------|
| Neo4j | 7474, 7687 | Graph database |
| Redis | 6379 | Caching, rate limiting |
| MinIO | 9000, 9001 | Object storage |
| TypeDB | 1729 | Advanced reasoning (optional) |
| Grafana | 3001 | Metrics visualization (optional) |
| Prometheus | 9090 | Metrics collection (optional) |

## Pipeline DAG Example

```
┌─────────────┐
│   Extract   │
│   GitHub    │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   Extract   │
│     NPM     │
└──────┬──────┘
       │
       ▼
┌─────────────┐     ┌─────────────┐
│  Transform  │────▶│  Generate   │
│  Entities   │     │  Embeddings │
└──────┬──────┘     └──────┬──────┘
       │                   │
       ▼                   ▼
┌─────────────┐     ┌─────────────┐
│ Deduplicate │◀────│  Temporal   │
│  Entities   │     │  Transform  │
└──────┬──────┘     └─────────────┘
       │
       ▼
┌─────────────┐
│    Load     │
│   Neo4j     │
└─────────────┘
```

## Entity Types

- `repository` - Code repositories
- `package` - Software packages (npm, pypi, crates)
- `author` - Individual contributors
- `organization` - GitHub orgs, companies
- `technology` - Languages, frameworks, tools
- `paper` - Research papers
- `concept` - Abstract concepts

## Relationship Types

- `depends_on` - Package dependencies
- `authored_by` - Authorship
- `maintained_by` - Maintenance responsibility
- `owned_by` - Repository ownership
- `uses` - Technology usage
- `implements` - Implementation relationship
- `cites` - Paper citations
- `related_to` - General relation
- `contributes_to` - Contributions

## Error Handling

The pipeline implements comprehensive error handling:

1. **Retry Logic**: Configurable exponential backoff
2. **Checkpointing**: Resume from failure points
3. **Error Categories**: Network, rate limit, timeout, validation
4. **Graceful Degradation**: Continue on non-fatal errors

## Monitoring

### Metrics

- Throughput (items/second, bytes/second)
- Latency percentiles (p50, p95, p99)
- Error rates
- Resource utilization

### Data Quality

- Schema validation
- Completeness checks
- Duplicate detection
- Orphaned relationship detection

### Freshness

- Age tracking per entity type
- Configurable staleness thresholds
- Automatic refresh scheduling

## Development

```bash
# Install dependencies
npm install

# Run type checking
npm run typecheck

# Run tests
npm test

# Start development server
npm run dev
```

## Cost Estimation

| Component | Estimated Cost | Notes |
|-----------|---------------|-------|
| Neo4j | Free (Community) | Self-hosted |
| OpenAI Embeddings | ~$0.02/1M tokens | Optional |
| GitHub API | Free | 5000 req/hour with token |
| ArXiv API | Free | Rate limited |
