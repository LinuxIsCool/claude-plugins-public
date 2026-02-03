# KG Explorer Documentation

This documentation site is built with [Docusaurus](https://docusaurus.io/) and documents the KG Explorer knowledge graph exploration system.

## Development

### Prerequisites

- Node.js >= 18.0
- npm or yarn

### Local Development

```bash
# Install dependencies
npm install

# Start development server
npm start
```

This starts a local development server at `http://localhost:3000`. Most changes are reflected live without needing to restart the server.

### Build

```bash
npm run build
```

This generates static content in the `build` directory that can be served using any static hosting service.

### Type Checking

```bash
npm run typecheck
```

## Documentation Structure

```
docs/
  getting-started/     # Installation and quick start guides
  concepts/            # Core concepts and theory
  guides/              # Practical how-to guides
  api/                 # API reference documentation
  architecture/        # System architecture docs

iterations/            # Recursive improvement log
  overview.md
  2025/
    iteration-001.md
    iteration-002.md
    ...

src/
  components/          # Custom React components
    GraphPreview.tsx   # Interactive graph visualization
    QueryPlayground.tsx # Query editor with results
    InsightExplorer.tsx # Insight browser

static/
  img/                 # Static images and diagrams
```

## Custom Components

The documentation includes interactive components:

### GraphPreview

Renders an interactive force-directed graph visualization:

```jsx
import GraphPreview from '@site/src/components/GraphPreview';

<GraphPreview
  title="Sample Graph"
  description="A knowledge graph visualization"
/>
```

### QueryPlayground

Interactive Cypher query editor:

```jsx
import QueryPlayground from '@site/src/components/QueryPlayground';

<QueryPlayground
  defaultQuery={`MATCH (c:Concept)
RETURN c.name
LIMIT 5`}
/>
```

### InsightExplorer

Browse and interact with insights:

```jsx
import InsightExplorer from '@site/src/components/InsightExplorer';

<InsightExplorer />
```

## Deployment

The documentation automatically deploys to GitHub Pages when changes are pushed to the `main` branch. See `.github/workflows/deploy.yml` for the deployment configuration.

### Manual Deployment

```bash
# Build the site
npm run build

# Deploy to GitHub Pages (if configured)
npm run deploy
```

## Contributing

Documentation contributions follow the same patterns as the KG Explorer system itself:

1. **Observe** - Identify gaps or improvements needed
2. **Analyze** - Understand the root cause
3. **Synthesize** - Propose documentation changes
4. **Implement** - Write the documentation
5. **Validate** - Review and merge

See the [Contributing Guide](/docs/guides/contributing-data) for more details.

## License

Documentation is licensed under the same terms as the KG Explorer project.
