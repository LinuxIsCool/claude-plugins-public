---
description: Build and deploy Quartz site to GitHub Pages
---

# Deploy Quartz Site

Build the Quartz static site from journal content and deploy to GitHub Pages.

## Prerequisites

Ensure Quartz is set up:
```bash
ls resources/quartz/quartz.config.ts || echo "Quartz not configured - see obsidian-master skill"
```

## Execution

```bash
QUARTZ_DIR="$(pwd)/resources/quartz"

if [ ! -d "$QUARTZ_DIR" ]; then
    echo "Error: Quartz directory not found at $QUARTZ_DIR"
    echo ""
    echo "To set up Quartz:"
    echo "  1. Clone: git clone https://github.com/jackyzha0/quartz.git resources/quartz"
    echo "  2. Install: cd resources/quartz && npm ci"
    echo "  3. Link content: ln -sf ../../.claude/journal content"
    echo "  4. Configure: edit quartz.config.ts"
    exit 1
fi

cd "$QUARTZ_DIR"

# Check for node_modules
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm ci
fi

# Build
echo "Building Quartz site..."
npx quartz build

if [ $? -eq 0 ]; then
    echo ""
    echo "Build successful! Output in resources/quartz/public/"
    echo ""
    echo "To deploy to GitHub Pages:"
    echo "  npx quartz sync --no-pull"
    echo ""
    echo "To preview locally:"
    echo "  npx quartz build --serve"
    echo "  # Opens http://localhost:8080"
else
    echo ""
    echo "Build failed. Check for:"
    echo "  - Invalid frontmatter in markdown files"
    echo "  - Broken wikilinks"
    echo "  - Configuration errors in quartz.config.ts"
fi
```

## Deploy Options

### Manual Deploy
```bash
cd resources/quartz
npx quartz sync --no-pull
```

### GitHub Actions (Automatic)
Create `.github/workflows/deploy-quartz.yml`:
```yaml
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
      - run: cd resources/quartz && npm ci && npx quartz build
      - uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: resources/quartz/public
```

## After Deployment

Your site will be available at:
- `https://<username>.github.io/<repo>/`
- Or custom domain if configured

The graph view is accessible at:
- `https://<site>/graph` (global)
- Any page (local graph in sidebar)
