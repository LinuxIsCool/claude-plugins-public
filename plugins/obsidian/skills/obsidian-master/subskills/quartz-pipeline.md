# Quartz Pipeline Sub-Skill

Build and deploy Quartz static sites from Obsidian vaults to GitHub Pages.

## What is Quartz?

Quartz is a fast static site generator for Obsidian vaults that provides:
- **Interactive graph view** (D3.js + PixiJS, WebGL accelerated)
- **Wikilink resolution** preserving Obsidian `[[links]]`
- **Full-text search** with Flexsearch
- **Backlinks** and transclusions

## Architecture

```
Markdown Files → Quartz Build → Static HTML/JS → GitHub Pages
     │               │                │
     └── Content ────┘                └── Deploy ──→ Web
```

### Build Pipeline
1. **Parse**: Read markdown with frontmatter
2. **Transform**: Process wikilinks, embeds, syntax
3. **Emit**: Generate HTML, content index, graph data
4. **Bundle**: Compile client-side JS (D3, PixiJS, tween.js)

### Key Output Files
```
public/
├── index.html              # Entry point
├── static/
│   ├── contentIndex.json   # All pages + links for graph
│   └── graph.js            # D3 + PixiJS bundle
└── .claude/journal/...     # Rendered pages
```

## Setup in Repository

### Directory Structure
```
resources/quartz/
├── quartz.config.ts        # Site configuration
├── quartz.layout.ts        # Page layout
├── content/                # Symlink to .claude/journal/
├── quartz/
│   ├── components/
│   │   ├── Graph.tsx
│   │   └── scripts/
│   │       └── graph.inline.ts
│   └── plugins/
│       └── emitters/
│           └── contentIndex.ts
└── docs/
```

### Configuration (quartz.config.ts)
```typescript
const config: QuartzConfig = {
  configuration: {
    pageTitle: "Claude Ecosystem",
    enableSPA: true,
    enablePopovers: true,
    baseUrl: "username.github.io/repo",
  },
  plugins: {
    transformers: [
      Plugin.FrontMatter(),
      Plugin.WikiLinks(),
      Plugin.SyntaxHighlighting(),
    ],
    filters: [Plugin.RemoveDrafts()],
    emitters: [
      Plugin.ContentPage(),
      Plugin.FolderPage(),
      Plugin.ContentIndex(),  // Generates graph data
      Plugin.ComponentResources(),
    ],
  },
}
```

## Graph Configuration

### Component Config (Graph.tsx)
```typescript
interface GraphOptions {
  localGraph: {
    drag: true,
    zoom: true,
    depth: 1,           // 1 hop from current page
    scale: 1.1,
    repelForce: 0.5,
    centerForce: 0.3,
    linkDistance: 30,
    fontSize: 0.6,
    showTags: true,
  },
  globalGraph: {
    drag: true,
    zoom: true,
    depth: -1,          // All nodes
    scale: 0.9,
    repelForce: 0.5,
    centerForce: 0.3,
    linkDistance: 30,
    fontSize: 0.6,
    showTags: true,
  },
}
```

### Rendering Stack
- **D3.js**: Force simulation physics
- **PixiJS**: WebGL/WebGPU rendering (handles 1000+ nodes)
- **tween.js**: Smooth animations

## Build Commands

### Local Development
```bash
cd resources/quartz
npx quartz build --serve
# Opens http://localhost:8080
```

### Production Build
```bash
npx quartz build
# Output in resources/quartz/public/
```

### Sync Content
```bash
# Link journal to Quartz content
ln -sf ../../.claude/journal resources/quartz/content
```

## Deploy to GitHub Pages

### Manual Deploy
```bash
cd resources/quartz
npx quartz sync --no-pull
```

### GitHub Actions
```yaml
# .github/workflows/deploy-quartz.yml
name: Deploy Quartz
on:
  push:
    branches: [main]
    paths: ['.claude/journal/**']

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: |
          cd resources/quartz
          npm ci
          npx quartz build
      - uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: resources/quartz/public
```

## Custom Graph Views

### Journal-Only View
```typescript
// Custom filter plugin
export const JournalFilter: QuartzFilterPlugin = {
  name: "JournalFilter",
  shouldPublish: (ctx, content) => {
    return content.slug?.startsWith(".claude/journal/")
  }
}
```

### Time-Based Coloring
```typescript
// Color nodes by date in graph.inline.ts
const getNodeColor = (slug: string) => {
  if (slug.includes("2025-12")) return "#4C9F70"
  if (slug.includes("2025-11")) return "#3B7A57"
  return "#808080"
}
```

## Integration with FalkorDB

Bridge pattern for richer graph data:

```typescript
// Custom emitter: fetch from FalkorDB, merge with content index
export const FalkorDBGraph: QuartzEmitterPlugin = {
  name: "FalkorDBGraph",
  emit: async (ctx, content, resources) => {
    const contentIndex = buildContentIndex(content)
    const graphData = await fetchFromFalkorDB()
    return mergeGraphData(contentIndex, graphData)
  }
}
```

## Troubleshooting

### Build Fails
```bash
# Clear cache
rm -rf resources/quartz/.quartz-cache
npx quartz build
```

### Graph Empty
- Check `contentIndex.json` is being generated
- Verify wikilinks use `[[target]]` not `[target](path)`
- Ensure frontmatter is valid YAML

### Deploy Permission Denied
- Enable GitHub Pages in repo settings
- Set source to "GitHub Actions"
- Check GITHUB_TOKEN permissions
