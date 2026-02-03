---
name: logseq
description: Master Logseq for privacy-first knowledge management with hierarchical notes, bi-directional links, Datalog queries, and spatial whiteboards. Use for building personal knowledge graphs, PKM workflows, PDF annotation, task management, and plugin development. Supports file-based (Markdown/Org) and database (SQLite) graphs.
allowed-tools: Read, Glob, Grep, Bash, WebFetch
---

# Logseq Mastery

Privacy-first, open-source knowledge management platform with bidirectional links and powerful Datalog queries.

## Territory Map

```
resources/knowledge_graphs/logseq/
├── src/main/frontend/          # Frontend application
│   ├── components/             # UI components (React/Rum)
│   ├── handler/                # System handlers
│   ├── worker/                 # Separate worker asset
│   └── common/                 # Shared code
├── src/main/logseq/            # Plugin API
├── deps/                       # ClojureScript libraries
│   ├── graph-parser/           # Graph parsing & database saving
│   ├── db/                     # Database layer (DataScript)
│   ├── outliner/               # Block outliner logic
│   ├── publishing/             # Publishing engine
│   └── common/                 # Common utilities
├── packages/                   # JavaScript packages
│   ├── ui/                     # Component system (shadcn)
│   └── tldraw/                 # Whiteboard (custom fork)
├── docs/                       # Development documentation
├── android/                    # Android app
├── ios/                        # iOS app
└── resources/                  # Static assets
```

## Core Capabilities

- **Hierarchical Notes**: Infinitely nested blocks with arbitrary depth
- **Bi-directional Links**: Automatic backlinks with visual graph view
- **DataScript Database**: In-memory Datalog query engine for knowledge graphs
- **Dual Graph Types**: File-based (Markdown/Org + Git) and DB-based (SQLite)
- **Whiteboard**: Spatial canvas with shapes, drawings, embeds, connectors
- **PDF Annotation**: Highlight and annotate PDFs with linked notes
- **Task Management**: TODO/DOING/DONE workflows with deadlines/scheduling
- **Plugin API**: Extensible architecture with 300+ community plugins
- **Real-time Collaboration**: RTC sync for multi-device and team collaboration
- **Per-note Encryption**: Privacy-first with optional encryption
- **Multiple Formats**: Markdown and Org-mode support
- **Mobile Apps**: Full-featured iOS and Android applications

## Tech Stack

| Component | Technology |
|-----------|------------|
| Frontend | ClojureScript, React, Rum |
| Database | DataScript (Datalog), SQLite (DB graphs) |
| Parser | mldoc (OCaml/Angstrom) |
| Desktop | Electron |
| Mobile | Capacitor (iOS/Android) |
| Build | shadow-cljs, Gulp, Babashka |
| Version Control | isomorphic-git |
| Query Language | Datalog |

## Beginner Techniques

### Installation and Setup

```bash
# Download latest release
# Visit: https://github.com/logseq/logseq/releases/latest

# Linux automated installer
curl -fsSL https://raw.githubusercontent.com/logseq/logseq/master/scripts/install-linux.sh | bash

# Install specific version
curl -fsSL https://raw.githubusercontent.com/logseq/logseq/master/scripts/install-linux.sh | bash -s -- 0.10.14

# User-specific installation (no root)
curl -fsSL https://raw.githubusercontent.com/logseq/logseq/master/scripts/install-linux.sh | bash -s -- --user
```

### Basic Note Organization

```markdown
- This is a top-level block
  - This is a nested block
    - Deeper nesting works infinitely
  - Back to second level
- Another top-level block

## Page References
- [[Page Name]] creates a link to a page
- #tag creates a hashtag (also a page link)
- ((block-ref)) embeds a block reference

## Block Properties
property:: value
tags:: #project #important
deadline:: <2025-01-15>
```

### File Graph vs DB Graph

**File Graph** (Traditional):
- Files: Markdown (.md) or Org-mode (.org)
- Storage: Plain text files on disk
- Version Control: Works with Git
- Sync: File-based sync (Git, Dropbox, etc.)
- Best for: Users who want plain text, version control

**DB Graph** (New):
- Storage: SQLite database
- Performance: Faster queries, better scalability
- Features: Advanced properties, better relationships
- Sync: RTC (Real-Time Collaboration)
- Best for: Teams, large graphs, advanced features

### Creating Pages and Blocks

```clojure
;; Create a page via Plugin API
(defn create-page [page-name]
  (js/logseq.Editor.createPage page-name))

;; Insert a block
(defn insert-block [content]
  (js/logseq.Editor.insertBlock
    (js/logseq.Editor.getCurrentBlock)
    content))

;; Get current page
(defn get-current-page []
  (js/logseq.Editor.getCurrentPage))
```

### Basic Queries

```clojure
;; Simple query: Find all TODO items
{{query (todo now later)}}

;; Query with page reference
{{query [[Project Name]]}}

;; Query with tag
{{query (page-tags #[[important]])}}

;; Query with properties
{{query (property priority high)}}

;; Date-based query
{{query (between -7d today)}}
```

## Intermediate Techniques

### Advanced Datalog Queries

```clojure
;; Query all blocks with specific content
#+BEGIN_QUERY
{:title "Blocks containing 'DataScript'"
 :query [:find (pull ?b [*])
         :where
         [?b :block/content ?c]
         [(clojure.string/includes? ?c "DataScript")]]}
#+END_QUERY

;; Query pages by property
#+BEGIN_QUERY
{:title "High priority tasks"
 :query [:find (pull ?b [*])
         :where
         [?b :block/properties ?p]
         [(get ?p :priority) ?priority]
         [(= ?priority "high")]]}
#+END_QUERY

;; Query with joins
#+BEGIN_QUERY
{:title "Blocks referencing specific pages"
 :query [:find (pull ?b [*])
         :where
         [?b :block/refs ?p]
         [?p :block/name "project-alpha"]]}
#+END_QUERY

;; Query with rules
#+BEGIN_QUERY
{:title "Nested TODO items"
 :query [:find (pull ?b [*])
         :in $ %
         :where
         (todo ?b)]
 :rules [[(todo ?b)
          [?b :block/marker ?m]
          [(contains? #{"TODO" "DOING"} ?m)]]]}
#+END_QUERY
```

### Custom Query DSL

```clojure
;; AND queries
{{query (and [[Page A]] [[Page B]])}}

;; OR queries
{{query (or [[Tag 1]] [[Tag 2]])}}

;; NOT queries
{{query (not [[Excluded Topic]])}}

;; Property filters
{{query (and (property type article) (property status published))}}

;; Date ranges
{{query (and [[Research]] (between [[Dec 1st, 2024]] [[Dec 31st, 2024]]))}}

;; Task queries
{{query (and (task TODO DOING) [[Project Name]])}}

;; Sorting
{{query (and [[Notes]] (sort-by created-at desc))}}

;; Limiting results
{{query (and [[Inbox]] (take 10))}}
```

### Block References and Embeds

```markdown
## Block References
- Reference a block: ((block-uuid))
- Copy block ref: Right-click block → Copy block ref

## Block Embeds
- {{embed ((block-uuid))}}
- Embeds update automatically when source changes

## Page Embeds
- {{embed [[Page Name]]}}
- Renders entire page content inline
```

### Templates

```markdown
## Define a Template
template:: meeting-notes
- **Date:** <% today %>
- **Attendees:**
- **Agenda:**
  -
- **Notes:**
  -
- **Action Items:**
  - TODO

## Use Template
/template → Select "meeting-notes"
```

### Plugin Development Basics

```javascript
// Plugin manifest (package.json)
{
  "name": "logseq-plugin-example",
  "version": "1.0.0",
  "main": "index.js",
  "logseq": {
    "id": "logseq-plugin-example",
    "title": "Example Plugin",
    "icon": "./icon.png"
  }
}

// Plugin entry point (index.js)
function main() {
  console.log('Plugin loaded!');

  // Register slash command
  logseq.Editor.registerSlashCommand('My Command', async () => {
    await logseq.Editor.insertAtEditingCursor('Hello from plugin!');
  });

  // Register UI item
  logseq.App.registerUIItem('toolbar', {
    key: 'my-plugin-button',
    template: '<a class="button">Click Me</a>'
  });

  // Listen to events
  logseq.DB.onChanged((e) => {
    console.log('Database changed:', e);
  });
}

logseq.ready(main).catch(console.error);
```

## Advanced Techniques

### Complex Datalog Queries

```clojure
;; Recursive queries: Find all descendants
#+BEGIN_QUERY
{:title "All nested blocks under current page"
 :query [:find (pull ?child [*])
         :in $ ?parent %
         :where
         [?p :block/name "current-page"]
         (parent-child ?p ?child)]
 :rules [[(parent-child ?p ?c)
          [?c :block/parent ?p]]
         [(parent-child ?p ?c)
          [?c :block/parent ?m]
          (parent-child ?p ?m)]]}
#+END_QUERY

;; Graph analysis: Find highly connected pages
#+BEGIN_QUERY
{:title "Most referenced pages"
 :query [:find ?page-name (count ?ref)
         :where
         [?p :block/name ?page-name]
         [?ref :block/refs ?p]]
 :group-by ?page-name
 :order-by [[?count :desc]]
 :limit 20}
#+END_QUERY

;; Complex filtering with functions
#+BEGIN_QUERY
{:title "Long blocks (>200 characters)"
 :query [:find (pull ?b [*])
         :where
         [?b :block/content ?content]
         [(count ?content) ?len]
         [(> ?len 200)]]}
#+END_QUERY

;; Time-based analysis
#+BEGIN_QUERY
{:title "Recently modified high-priority tasks"
 :query [:find (pull ?b [*])
         :where
         [?b :block/marker ?m]
         [(contains? #{"TODO" "DOING"} ?m)]
         [?b :block/properties ?props]
         [(get ?props :priority) ?p]
         [(= ?p "high")]
         [?b :block/updated-at ?t]
         [(> ?t ?cutoff)]]
 :inputs [:7d-before]}
#+END_QUERY
```

### Plugin API Advanced Patterns

```javascript
// Database queries from plugin
async function queryDatabase() {
  const results = await logseq.DB.datascriptQuery(`
    [:find (pull ?b [*])
     :where
     [?b :block/marker "TODO"]
     [?b :block/priority "A"]]
  `);
  return results;
}

// Block manipulation
async function createLinkedBlocks(parentId, items) {
  for (const item of items) {
    const block = await logseq.Editor.insertBlock(
      parentId,
      item.content,
      { sibling: false }
    );

    if (item.properties) {
      await logseq.Editor.upsertBlockProperty(
        block.uuid,
        item.properties.key,
        item.properties.value
      );
    }
  }
}

// Custom UI with React
function renderCustomUI() {
  logseq.provideUI({
    key: 'my-custom-panel',
    path: '#/panel',
    template: `
      <div id="custom-panel">
        <h2>Custom Panel</h2>
        <div id="content"></div>
      </div>
    `
  });
}

// Settings management
logseq.useSettingsSchema([
  {
    key: 'apiKey',
    type: 'string',
    title: 'API Key',
    description: 'Your API key for external service',
    default: ''
  },
  {
    key: 'enableFeature',
    type: 'boolean',
    title: 'Enable Advanced Feature',
    default: false
  }
]);

const settings = logseq.settings;
```

### Whiteboard Integration

```javascript
// Create whiteboard from plugin
async function createWhiteboard(name) {
  const wb = await logseq.Editor.createWhiteboard(name);
  return wb;
}

// Add shapes to whiteboard
async function addShapesToWhiteboard(whiteboardId) {
  await logseq.Editor.addWhiteboardShape(whiteboardId, {
    type: 'rectangle',
    x: 100,
    y: 100,
    width: 200,
    height: 150,
    fill: '#e3f2fd',
    stroke: '#1976d2'
  });

  await logseq.Editor.addWhiteboardShape(whiteboardId, {
    type: 'text',
    x: 150,
    y: 150,
    text: 'Hello Whiteboard',
    fontSize: 16
  });
}
```

### Database Graph Advanced Operations

```bash
# Validate DB graph schema (requires bb setup)
bb dev:validate-db my-graph

# Query DB graph from CLI
bb dev:db-query my-graph '[:find (pull ?b [*]) :where [?b :block/marker "TODO"]]'

# Transact data programmatically
bb dev:db-transact my-graph \
  '[:find ?b :where [?b :block/type "object"]]' \
  '(fn [id] (vector :db/retract id :block/type "object"))'

# Create DB graph from EDN file
bb dev:db-create my-new-graph schema.edn

# Import file graph to DB graph
bb dev:db-import /path/to/file-graph output-db-graph -d

# Export datoms for analysis
bb dev:db-datoms my-graph snapshot.edn

# Diff two datom snapshots
bb dev:diff-datoms before.edn after.edn
```

### Custom Themes and Styling

```css
/* Custom theme (custom.css in graph root) */
:root {
  --ls-primary-background-color: #fafafa;
  --ls-secondary-background-color: #ffffff;
  --ls-tertiary-background-color: #f5f5f5;
  --ls-quaternary-background-color: #eeeeee;

  --ls-primary-text-color: #212121;
  --ls-secondary-text-color: #424242;

  --ls-link-text-color: #1976d2;
  --ls-link-text-hover-color: #1565c0;

  --ls-border-color: #e0e0e0;
}

/* Custom block styling */
.block-marker {
  font-weight: bold;
}

/* Custom page styling */
.page-reference {
  color: var(--ls-link-text-color);
  font-style: italic;
}

/* Custom query result styling */
.custom-query .query-title {
  font-size: 1.2em;
  font-weight: bold;
  margin-bottom: 0.5em;
}
```

### Git Integration for File Graphs

```bash
# Configure Git auto-commit (config.edn)
:git/auto-push true
:git/auto-commit-seconds 60

# Manual Git operations via Plugin API
async function gitCommit(message) {
  await logseq.Git.commit(message);
}

async function gitPush() {
  await logseq.Git.push();
}

async function gitPull() {
  await logseq.Git.pull();
}
```

### Performance Optimization

```clojure
;; Optimize queries with indexes
;; Use indexed attributes in WHERE clauses
#+BEGIN_QUERY
{:query [:find (pull ?b [*])
         :where
         [?b :block/name "page-name"]  ; Indexed
         [?b :block/properties ?p]]    ; More efficient
 :limit 100}
#+END_QUERY

;; Avoid expensive string operations in queries
;; Pre-filter with indexes, then apply string operations
#+BEGIN_QUERY
{:query [:find (pull ?b [*])
         :where
         [?b :block/page ?p]
         [?p :block/name "specific-page"]  ; Index filter first
         [?b :block/content ?c]
         [(clojure.string/includes? ?c "keyword")]]}  ; Then string op
#+END_QUERY
```

### Batch Operations

```javascript
// Batch block creation
async function createMultipleBlocks(parentId, contents) {
  const batch = await logseq.Editor.insertBatchBlock(
    parentId,
    contents.map(c => ({ content: c })),
    { sibling: false }
  );
  return batch;
}

// Batch property updates
async function updateMultipleProperties(blockIds, property, value) {
  for (const id of blockIds) {
    await logseq.Editor.upsertBlockProperty(id, property, value);
  }
}
```

## Key Patterns

| Pattern | Use Case |
|---------|----------|
| File Graph | Version control, plain text, Git workflows |
| DB Graph | Teams, large graphs, advanced queries |
| Datalog queries | Complex graph analysis, reporting |
| Block references | Reusable content, transclusion |
| Templates | Consistent note structure |
| Plugins | Automation, integrations, custom workflows |
| Whiteboard | Visual thinking, brainstorming |
| PDF annotation | Research, literature review |

## When to Use Logseq

- **Personal Knowledge Management**: Building a second brain with bidirectional links
- **Research**: Literature review, PDF annotation, citation management
- **Project Management**: Task tracking, Kanban boards, agile workflows
- **Note-taking**: Meeting notes, daily journals, learning logs
- **Writing**: Long-form content with outline-first approach
- **Team Collaboration**: Shared knowledge base with RTC sync
- **Academic Work**: Zettelkasten method, concept mapping
- **Software Development**: Documentation, design docs, code snippets

## Comparison Advantages

| Feature | Logseq | Obsidian | Roam Research | Notion |
|---------|--------|----------|---------------|--------|
| Open Source | Yes | No | No | No |
| Local-first | Yes | Yes | No | No |
| Outliner | Yes | Mixed | Yes | Yes |
| Datalog Queries | Yes | No | Limited | No |
| Whiteboard | Yes | Canvas | No | No |
| Database Graphs | Yes | No | No | Yes |
| Plugin API | Yes | Yes | Limited | Limited |
| Pricing | Free | Freemium | Subscription | Freemium |

## Best Practices

1. **Graph Organization**: Use namespaces for pages (e.g., `project/alpha`, `book/sapiens`)
2. **Properties**: Consistent property naming for queryability
3. **Block Structure**: Keep blocks atomic and reusable
4. **Queries**: Start simple, add complexity incrementally
5. **Templates**: Create templates for repeated structures
6. **Backups**: Regular backups for DB graphs (automated backup feature)
7. **Version Control**: Use Git for file graphs
8. **Performance**: Limit query result size, use indexes effectively
9. **Plugins**: Only install trusted plugins, review permissions
10. **Privacy**: Use encryption for sensitive notes

## Development Setup

```bash
# Clone repository
git clone https://github.com/logseq/logseq.git
cd logseq

# Install dependencies
yarn install
clojure -P -M:cljs

# Development mode
yarn watch

# In another terminal, start Electron
yarn dev-electron-app

# Run tests
yarn test

# Linting
bb lint:dev

# REPL setup (for interactive development)
clojure -M:cljs watch app
# Connect REPL via nREPL port shown in output
```

## Plugin Development Workflow

```bash
# Create plugin from template
npx @logseq/plugin-cli create my-plugin

# Development mode (hot reload)
cd my-plugin
npm install
npm run dev

# Build for release
npm run build

# Load plugin in Logseq
# Settings → Advanced → Developer mode → Load unpacked plugin
```

## Common Query Patterns

```clojure
;; Daily journal queries
{{query (and (page-property journal true) (between -7d today))}}

;; Task management
{{query (and (task TODO DOING) (not [[Archived]]))}}

;; Project overview
{{query (and [[Project Name]] (or (task TODO DOING) (property status active)))}}

;; Research notes with tag
{{query (and (page-tags #[[research]]) (property type paper))}}

;; Recent modifications
{{query (sort-by updated-at desc) (take 20)}}

;; Orphaned pages (no backlinks)
#+BEGIN_QUERY
{:title "Orphaned pages"
 :query [:find ?page-name
         :where
         [?p :block/name ?page-name]
         (not [?b :block/refs ?p])]}
#+END_QUERY
```

## Reference Files

| Feature | File |
|---------|------|
| Codebase overview | `CODEBASE_OVERVIEW.md` |
| Development practices | `docs/dev-practices.md` |
| Contributing guide | `CONTRIBUTING.md` |
| Plugin API docs | https://plugins-doc.logseq.com/ |
| User documentation | https://docs.logseq.com/ |
| Graph parser | `deps/graph-parser/` |
| Database layer | `deps/db/` |
| Outliner logic | `deps/outliner/` |
| UI components | `src/main/frontend/components/` |
| Query implementation | `src/main/frontend/db/query_dsl.cljs` |
| Plugin API | `src/main/logseq/` |

## Troubleshooting

**Slow Query Performance**
```clojure
;; Add indexes to WHERE clauses first
;; Limit results with :limit
;; Avoid expensive string operations on large datasets
{:query [...] :limit 100}
```

**Plugin Not Loading**
```javascript
// Check browser console for errors
// Verify plugin manifest (package.json)
// Ensure logseq.ready() is called
// Check Developer mode is enabled
```

**DB Graph Corruption**
```bash
# Validate graph schema
bb dev:validate-db my-graph

# Export to file graph
# Settings → Export → Export as Markdown

# Restore from backup
# Settings → Backups → Restore
```

**Sync Conflicts**
```markdown
# File graphs: Use Git merge strategies
# DB graphs: RTC handles conflicts automatically
# Manual resolution: Settings → Sync → Resolve conflicts
```

## Additional Resources

- Official Documentation: https://docs.logseq.com/
- Plugin API Documentation: https://plugins-doc.logseq.com/
- GitHub Repository: https://github.com/logseq/logseq
- Community Forum: https://discuss.logseq.com/
- Discord: https://discord.gg/KpN4eHY
- Awesome Logseq: https://github.com/logseq/awesome-logseq
- Learn Datalog Today: http://www.learndatalogtoday.org/
- DataScript Repository: https://github.com/tonsky/datascript
- Advanced Queries Guide: https://hub.logseq.com/features/av5LyiLi5xS7EFQXy4h4K8/getting-started-with-advanced-queries/8xwSRJNVKFJhGSvJUxs5B2
- Logseq Query CLI: https://github.com/cldwalker/logseq-query

## Summary

Logseq provides a powerful, privacy-first knowledge management platform:
- **Outliner-based**: Hierarchical blocks with infinite nesting
- **Bidirectional Links**: Automatic graph connections and backlinks
- **Datalog Queries**: Powerful graph analysis with DataScript
- **Dual Storage**: File-based (Git-friendly) or database (scalable)
- **Extensible**: Rich plugin API with 300+ community plugins
- **Visual Tools**: Whiteboard canvas for spatial thinking
- **Open Source**: AGPL-3.0 license, community-driven development

Start with basic note-taking and linking, then progressively adopt queries, plugins, and advanced features as your knowledge graph grows.
