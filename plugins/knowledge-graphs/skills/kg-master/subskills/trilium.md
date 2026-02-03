---
name: trilium
description: Master Trilium Notes for building hierarchical knowledge bases with advanced features. Use when organizing notes with arbitrary depth, implementing bi-directional links, creating custom note types, scripting automation, setting up synchronization, or developing plugins. Supports desktop (Electron), server (Node.js), and mobile web deployments.
allowed-tools: Read, Glob, Grep, Bash, WebFetch
---

# Trilium Notes Mastery

Build powerful hierarchical knowledge bases with rich content, scripting, and real-time synchronization.

## Territory Map

```
resources/knowledge_graphs/Trilium/
├── apps/                           # Runnable applications
│   ├── client/                     # Frontend (shared by server & desktop)
│   │   ├── src/
│   │   │   ├── desktop.ts          # Client initialization
│   │   │   ├── services/
│   │   │   │   ├── froca.ts        # Frontend cache (read-only mirror)
│   │   │   │   ├── note_types.ts   # Note type registry
│   │   │   │   └── ws.ts           # WebSocket client
│   │   │   ├── widgets/            # UI component system
│   │   │   │   ├── basic_widget.ts        # Base widget class
│   │   │   │   ├── note_context_aware_widget.ts
│   │   │   │   ├── type_widgets/   # Note type-specific widgets
│   │   │   │   │   ├── text.ts     # Rich text (CKEditor5)
│   │   │   │   │   ├── code.ts     # Code editor (CodeMirror)
│   │   │   │   │   ├── canvas.ts   # Drawing (Excalidraw)
│   │   │   │   │   ├── mermaid.ts  # Diagrams
│   │   │   │   │   ├── relation_map.ts
│   │   │   │   │   └── note_map.ts
│   │   │   └── translations/       # i18n files
│   │   └── vite.config.ts          # Build configuration
│   ├── server/                     # Node.js backend
│   │   ├── src/
│   │   │   ├── main.ts             # Server entry point
│   │   │   ├── becca/              # Backend cache
│   │   │   │   ├── becca.ts        # Main cache instance
│   │   │   │   ├── becca_loader.ts # Database loader
│   │   │   │   └── entities/       # Core data models
│   │   │   │       ├── bnote.ts    # Note entity
│   │   │   │       ├── bbranch.ts  # Hierarchical relationships
│   │   │   │       ├── battribute.ts # Key-value metadata
│   │   │   │       ├── brevision.ts  # Version history
│   │   │   │       ├── battachment.ts # File attachments
│   │   │   │       └── bblob.ts      # Binary storage
│   │   │   ├── routes/
│   │   │   │   ├── api/            # Internal API routes
│   │   │   │   │   ├── notes.ts
│   │   │   │   │   ├── branches.ts
│   │   │   │   │   ├── attributes.ts
│   │   │   │   │   ├── sync.ts     # Synchronization endpoints
│   │   │   │   │   └── search.ts
│   │   │   ├── services/
│   │   │   │   ├── backend_script_api.ts  # Scripting API
│   │   │   │   ├── script.ts              # Script executor
│   │   │   │   ├── sync.ts                # Sync protocol
│   │   │   │   ├── search/                # Search engine
│   │   │   │   │   ├── search_context.ts
│   │   │   │   │   └── expressions.ts
│   │   │   │   └── ws.ts           # WebSocket server
│   │   │   ├── assets/
│   │   │   │   └── db/schema.sql   # Database schema
│   │   │   └── etapi/              # External REST API
│   │   │       ├── etapi.ts
│   │   │       └── etapi.openapi.yaml
│   │   └── package.json
│   ├── desktop/                    # Electron wrapper
│   │   └── src/
│   │       └── main.ts             # Electron main process
│   ├── web-clipper/                # Browser extension
│   └── edit-docs/                  # Documentation editor
│
├── packages/                       # Shared libraries
│   ├── commons/                    # Shared utilities
│   ├── ckeditor5/                  # Custom rich text editor
│   │   ├── src/
│   │   │   ├── plugins.ts          # Plugin registry
│   │   │   └── ckeditor.ts
│   ├── ckeditor5-admonition/       # Admonitions plugin
│   ├── ckeditor5-footnotes/        # Footnotes plugin
│   ├── ckeditor5-math/             # Math equations (KaTeX)
│   ├── ckeditor5-mermaid/          # Mermaid diagrams
│   ├── codemirror/                 # Code editor customizations
│   └── highlightjs/                # Syntax highlighting
│
├── docs/                           # Documentation
│   ├── User Guide/
│   │   └── User Guide/
│   │       ├── Scripting.md
│   │       ├── Advanced Usage/
│   │       │   ├── Attributes.md
│   │       │   ├── ETAPI (REST API).md
│   │       │   └── Templates.md
│   └── Developer Guide/
│       └── Developer Guide/
│           ├── Architecture.md
│           ├── Concepts/
│           │   ├── Entities.md
│           │   ├── Cache.md
│           │   └── Synchronisation.md
│
├── scripts/                        # Build scripts
├── package.json                    # Root dependencies
└── pnpm-workspace.yaml            # Monorepo config
```

## Core Capabilities

### Hierarchical Note Organization
- **Arbitrary depth tree structure**: Organize notes in unlimited nested hierarchies
- **Note cloning**: Single note can appear in multiple tree locations
- **Branches**: Manage parent-child relationships with positioning
- **Hoisting**: Focus on specific subtrees for distraction-free work
- **Prefixes**: Customize branch display with custom text/icons

### Rich Content Editing
- **10+ note types**: Text, code, image, file, canvas, mermaid, relation map, mind map, geo map, book
- **CKEditor 5**: Advanced WYSIWYG editing with markdown autoformat
- **CodeMirror 6**: Syntax highlighting for 100+ languages
- **Excalidraw**: Infinite canvas for sketches and diagrams
- **Math support**: KaTeX rendering for equations
- **Attachments**: Link files to notes with encryption support

### Three-Layer Cache System
- **Becca (Backend)**: Server-side entity cache for fast database access
- **Froca (Frontend)**: Client-side read-only mirror with lazy loading
- **Shaca (Share)**: Optimized cache for public note sharing

### Synchronization Protocol
- **Bidirectional sync**: Desktop clients sync with server instances
- **Real-time updates**: WebSocket broadcasts for live collaboration
- **Conflict resolution**: Last-write-wins with hash verification
- **Incremental sync**: Only changed entities transferred
- **Protected note sync**: Encrypted content synchronized securely

### Scripting and Automation
- **Frontend scripts**: Run in browser context with UI manipulation
- **Backend scripts**: Node.js context with full API access
- **Event system**: React to note creation, updates, deletions
- **Custom widgets**: Extend UI with JavaScript components
- **Templates**: Automated note structure generation

## Beginner Techniques

### Environment Setup

```bash
# Clone repository
git clone https://github.com/TriliumNext/Trilium.git
cd Trilium

# Enable pnpm (package manager)
corepack enable

# Install dependencies
pnpm install

# Start development server (http://localhost:8080)
pnpm run server:start

# Build desktop application (Windows)
pnpm run --filter desktop electron-forge:make --arch=x64 --platform=win32
```

### Basic Note Management

```javascript
// Backend script: Create a note programmatically
const {note} = await api.runOnBackend(() => {
    const parent = api.getNote('root');
    const note = api.createTextNote(parent.noteId, 'My New Note', 'Initial content');
    return {note: note.getPojo()};
});

// Frontend script: Navigate to a note
await api.activateNote('noteId123');

// Clone a note to multiple locations
const branch = api.createBranch('noteId123', 'parentNoteId456', 100);
```

### Using Attributes for Organization

```javascript
// Add label attribute to a note
note.setLabel('priority', 'high');
note.setLabel('status', 'in-progress');
note.setLabel('color', '#ff0000');  // Change note color in tree

// Add relation attribute (link between notes)
note.setRelation('relatedTo', 'otherNoteId');

// Make attribute inheritable to children
note.setLabel('template', 'project', true);  // isInheritable = true

// Query notes by attributes
const notes = await api.searchForNotes('#status=completed');
```

### Creating Templates

```javascript
// Create a template note with #template label
const template = api.createTextNote('templates', 'Project Template', `
# Project: ${~title}

## Status
#status=planning

## Tasks
- [ ] Task 1
- [ ] Task 2

## Notes
`);
template.setLabel('template', '');  // Mark as template

// Create note from template
const newProject = api.createNoteWithContent('projects', 'New Project', '', {
    templateNoteId: template.noteId
});
```

### Basic Search

```javascript
// Full-text search
const results = await api.searchForNotes('keyword');

// Attribute search
const highPriority = await api.searchForNotes('#priority=high');

// Combined search
const urgent = await api.searchForNotes('#priority=high #status=active "urgent"');

// Hierarchical search
const childNotes = await api.searchForNotes('#ancestor(root/projects)');
```

## Intermediate Techniques

### Custom Note Types

#### 1. Register Note Type (Server)

```typescript
// apps/server/src/services/note_types.ts
export const NOTE_TYPES = {
    // ... existing types
    'kanban': {
        title: 'Kanban Board',
        mimeType: 'application/json',
        isProtected: false
    }
};
```

#### 2. Create Type Widget (Frontend)

```typescript
// apps/client/src/widgets/type_widgets/kanban.ts
import NoteContextAwareWidget from "../note_context_aware_widget.js";

export default class KanbanTypeWidget extends NoteContextAwareWidget {
    static getType() { return "kanban"; }

    doRender() {
        this.$widget = $(`
            <div class="kanban-widget">
                <div class="kanban-column" data-status="todo">
                    <h3>To Do</h3>
                    <div class="kanban-cards"></div>
                </div>
                <div class="kanban-column" data-status="in-progress">
                    <h3>In Progress</h3>
                    <div class="kanban-cards"></div>
                </div>
                <div class="kanban-column" data-status="done">
                    <h3>Done</h3>
                    <div class="kanban-cards"></div>
                </div>
            </div>
        `);

        return this.$widget;
    }

    async refresh() {
        const content = await this.note.getContent();
        const data = JSON.parse(content || '{"cards":[]}');

        this.renderCards(data.cards);
    }

    renderCards(cards) {
        this.$widget.find('.kanban-cards').empty();

        for (const card of cards) {
            const $card = $(`<div class="kanban-card">${card.title}</div>`);
            this.$widget.find(`[data-status="${card.status}"] .kanban-cards`).append($card);
        }
    }

    async saveCard(card) {
        const content = await this.note.getContent();
        const data = JSON.parse(content || '{"cards":[]}');
        data.cards.push(card);

        await this.note.setContent(JSON.stringify(data));
    }
}
```

#### 3. Register Widget

```typescript
// apps/client/src/services/note_types.ts
import KanbanTypeWidget from "../widgets/type_widgets/kanban.js";

export const NOTE_TYPE_WIDGETS = {
    // ... existing widgets
    'kanban': KanbanTypeWidget
};
```

### Advanced Scripting Patterns

#### Frontend Startup Script

```javascript
// Create launcher button that appears on startup
// Label: #run=frontendStartup

class CustomButton extends api.NoteContextAwareWidget {
    isEnabled() {
        return super.isEnabled()
            && this.note.hasLabel('customButton');
    }

    doRender() {
        this.$widget = $(`<button class="btn btn-sm">Execute</button>`);

        this.$widget.on('click', async () => {
            const result = await api.runOnBackend(async (noteId) => {
                const note = await api.getNote(noteId);
                // Backend logic here
                return {success: true};
            }, [this.noteId]);

            api.showMessage(result.success ? 'Done!' : 'Failed');
        });

        return this.$widget;
    }
}

const widget = new CustomButton();
api.addButtonToToolbar({
    title: 'Custom Action',
    icon: 'check-square',
    action: () => widget.$widget.click()
});
```

#### Backend Event Handlers

```javascript
// Label: #run=backendStartup
api.dayjs = require('dayjs');

// Listen for note creation
api.addBackendEventListener('note_created', async ({noteId}) => {
    const note = await api.getNote(noteId);

    // Auto-add creation date label
    if (note.type === 'text') {
        note.setLabel('created', api.dayjs().format('YYYY-MM-DD'));
    }
});

// Listen for note updates
api.addBackendEventListener('note_changed', async ({noteId}) => {
    const note = await api.getNote(noteId);

    // Auto-update modification date
    note.setLabel('modified', api.dayjs().format('YYYY-MM-DD HH:mm'));
});

// Listen for attribute changes
api.addBackendEventListener('attribute_changed', async ({attributeId, noteId}) => {
    const note = await api.getNote(noteId);

    if (note.hasLabel('autoArchive', 'true')) {
        const modifiedDate = note.getLabelValue('modified');
        const daysSince = api.dayjs().diff(modifiedDate, 'day');

        if (daysSince > 30) {
            // Move to archive
            const archiveNote = await api.getNote('archive');
            await api.createBranch(note.noteId, archiveNote.noteId);
        }
    }
});
```

#### Custom Request Handler

```javascript
// Label: #customRequestHandler=/api/custom/action
api.axios = require('axios');

const {req, res} = api;

if (req.method === 'POST') {
    const {action, data} = req.body;

    if (action === 'import') {
        const note = await api.createTextNote('inbox', data.title, data.content);

        res.json({
            success: true,
            noteId: note.noteId
        });
    } else {
        res.status(400).json({error: 'Unknown action'});
    }
} else {
    res.status(405).json({error: 'Method not allowed'});
}
```

### Entity Relationships and Queries

```javascript
// Work with entity graph
const note = await api.getNote('noteId');

// Get parent branches
const parentBranches = note.getParentBranches();
for (const branch of parentBranches) {
    const parent = branch.parentNote;
    console.log(`Parent: ${parent.title}`);
}

// Get child notes
const children = await note.getChildNotes();
for (const child of children) {
    console.log(`Child: ${child.title}`);
}

// Get notes via relation
const relatedNotes = note.getRelations('relatedTo')
    .map(attr => attr.value);  // attr.value is target noteId

// Get all attributes
const attributes = note.getOwnedAttributes();
for (const attr of attributes) {
    if (attr.type === 'label') {
        console.log(`Label: ${attr.name}=${attr.value}`);
    } else if (attr.type === 'relation') {
        const targetNote = await api.getNote(attr.value);
        console.log(`Relation: ${attr.name} -> ${targetNote.title}`);
    }
}
```

### Promoted Attributes (Form-Like UI)

```javascript
// Create attribute definition note
const attrDef = await api.createTextNote('root', 'Task Attributes', '');

// Define promoted label
attrDef.setLabel('label:priority', 'promoted,single,select');
attrDef.setLabel('priority', 'high');
attrDef.setLabel('priority', 'medium');
attrDef.setLabel('priority', 'low');

// Define promoted relation
attrDef.setLabel('relation:assignedTo', 'promoted,single');

// Use in template
const template = await api.createTextNote('templates', 'Task', '');
template.setLabel('template', '');
template.setRelation('inherit', attrDef.noteId);

// When creating note from template, promoted attributes appear in UI
```

## Advanced Techniques

### Custom Synchronization Setup

#### Server Configuration

```ini
# config.ini (server instance)
serverPort=8080
instanceName=main-server
syncServerHost=0.0.0.0
syncServerPort=8080

# Enable SSL
sslEnabled=true
sslCertPath=/path/to/cert.pem
sslKeyPath=/path/to/key.pem
```

#### Desktop Client Sync

```javascript
// Configure sync from desktop client
await api.runOnBackend(async () => {
    await api.sql.execute(`
        INSERT INTO options (name, value, isSynced)
        VALUES
            ('syncServerHost', 'https://sync.example.com', 0),
            ('syncProxy', '', 0)
    `);

    // Trigger initial sync
    await api.triggerSync();
});

// Monitor sync status
api.addFrontendEventListener('sync-status-changed', (status) => {
    console.log(`Sync status: ${status}`);
    // Status: 'syncing', 'synced', 'error'
});
```

### Database Schema Customization

```javascript
// Direct database access (use with caution)
await api.sql.execute(`
    CREATE TABLE IF NOT EXISTS custom_data (
        id INTEGER PRIMARY KEY,
        noteId TEXT NOT NULL,
        data TEXT,
        dateCreated TEXT NOT NULL,
        FOREIGN KEY(noteId) REFERENCES notes(noteId)
    )
`);

// Insert custom data
await api.sql.execute(`
    INSERT INTO custom_data (noteId, data, dateCreated)
    VALUES (?, ?, ?)
`, [noteId, JSON.stringify(data), api.utils.nowDate()]);

// Query custom data
const rows = await api.sql.getRows(`
    SELECT * FROM custom_data WHERE noteId = ?
`, [noteId]);
```

### Advanced Search Expressions

```javascript
// Complex search queries
const results = await api.searchForNotes(`
    #year=2025
    AND #status=active
    AND note.dateCreated >= MONTH-3
    AND NOT #archived
`);

// Hierarchical queries
const projectNotes = await api.searchForNotes(`
    #ancestor(root/projects)
    AND #priority=high
    ORDER BY title
    LIMIT 10
`);

// Full-text with attributes
const docs = await api.searchForNotes(`
    "artificial intelligence"
    AND #category=research
    AND note.type = 'text'
`);

// Programmatic search context
const context = await api.searchContext();
context.addCondition('#status=active');
context.addCondition('note.dateModified >= MONTH-1');
const notes = await context.search();
```

### Entity Change Tracking

```javascript
// Track all changes to an entity
const changes = await api.sql.getRows(`
    SELECT * FROM entity_changes
    WHERE entityName = 'notes'
    AND entityId = ?
    ORDER BY utcDateChanged DESC
`, [noteId]);

for (const change of changes) {
    console.log(`Change ${change.changeId} at ${change.utcDateChanged}`);
    console.log(`  Hash: ${change.hash}`);
    console.log(`  Synced: ${change.isSynced}`);
}

// Get sync statistics
const stats = await api.sql.getRow(`
    SELECT
        entityName,
        COUNT(*) as totalChanges,
        SUM(CASE WHEN isSynced = 1 THEN 1 ELSE 0 END) as syncedChanges
    FROM entity_changes
    WHERE entityName = 'notes'
    GROUP BY entityName
`);
```

### Custom Resource Providers

```javascript
// Label: #customResourceProvider=images
// Serve custom resources at /custom/images/*

const {req, res} = api;
const path = require('path');
const fs = require('fs').promises;

const imagePath = path.join('/path/to/images', req.params[0]);

try {
    const exists = await fs.access(imagePath).then(() => true).catch(() => false);

    if (exists) {
        const data = await fs.readFile(imagePath);
        const ext = path.extname(imagePath);
        const mimeTypes = {
            '.jpg': 'image/jpeg',
            '.png': 'image/png',
            '.gif': 'image/gif',
            '.svg': 'image/svg+xml'
        };

        res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream');
        res.send(data);
    } else {
        res.status(404).send('Not found');
    }
} catch (error) {
    res.status(500).send('Server error');
}
```

### ETAPI (External REST API)

```bash
# Obtain ETAPI token
curl -X POST https://trilium.example.com/etapi/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "secret"}'

# Get note content
curl https://trilium.example.com/etapi/notes/noteId123/content \
  -H "Authorization: ETAPI_TOKEN"

# Create a note
curl -X POST https://trilium.example.com/etapi/notes \
  -H "Authorization: ETAPI_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "parentNoteId": "root",
    "title": "New Note",
    "type": "text",
    "content": "Hello from API"
  }'

# Update note
curl -X PATCH https://trilium.example.com/etapi/notes/noteId123 \
  -H "Authorization: ETAPI_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Updated Title"
  }'

# Search notes
curl https://trilium.example.com/etapi/search \
  -H "Authorization: ETAPI_TOKEN" \
  -G \
  --data-urlencode "query=#status=active"

# Export note
curl https://trilium.example.com/etapi/notes/noteId123/export \
  -H "Authorization: ETAPI_TOKEN" \
  --output export.zip
```

### Plugin Development

#### 1. Create Plugin Structure

```
plugins/
└── my-plugin/
    ├── plugin.json           # Plugin metadata
    ├── frontend/
    │   ├── plugin.js         # Frontend initialization
    │   └── widget.js         # Custom widget
    ├── backend/
    │   └── plugin.js         # Backend initialization
    └── assets/
        ├── style.css         # Plugin styles
        └── icon.svg          # Plugin icon
```

#### 2. Plugin Metadata

```json
// plugin.json
{
    "id": "my-plugin",
    "name": "My Custom Plugin",
    "version": "1.0.0",
    "author": "Your Name",
    "description": "Custom functionality for Trilium",
    "frontend": "frontend/plugin.js",
    "backend": "backend/plugin.js",
    "assets": ["assets/style.css"]
}
```

#### 3. Frontend Plugin

```javascript
// frontend/plugin.js
class MyPlugin {
    constructor(api) {
        this.api = api;
    }

    async initialize() {
        // Add custom button
        this.api.addButtonToToolbar({
            title: 'My Plugin',
            icon: 'star',
            action: () => this.handleAction()
        });

        // Listen for note changes
        this.api.addFrontendEventListener('note-changed', (noteId) => {
            console.log(`Note changed: ${noteId}`);
        });
    }

    async handleAction() {
        const note = this.api.getActiveContextNote();
        await this.api.showMessage(`Active note: ${note.title}`);
    }
}

module.exports = MyPlugin;
```

#### 4. Backend Plugin

```javascript
// backend/plugin.js
class MyBackendPlugin {
    constructor(api) {
        this.api = api;
    }

    async initialize() {
        // Add backend event handler
        this.api.addBackendEventListener('note_created', async ({noteId}) => {
            const note = await this.api.getNote(noteId);
            console.log(`Note created: ${note.title}`);
        });

        // Add custom API endpoint
        this.api.addRoute('GET', '/my-plugin/status', async (req, res) => {
            res.json({status: 'ok', version: '1.0.0'});
        });
    }
}

module.exports = MyBackendPlugin;
```

### Docker Deployment

```yaml
# docker-compose.yml
version: '3'
services:
  trilium:
    image: triliumnext/trilium:latest
    restart: unless-stopped
    ports:
      - "8080:8080"
    volumes:
      - trilium-data:/home/node/trilium-data
    environment:
      - TRILIUM_DATA_DIR=/home/node/trilium-data
      - TRILIUM_PORT=8080
      - NODE_ENV=production

volumes:
  trilium-data:
```

```bash
# Start Trilium server
docker-compose up -d

# View logs
docker-compose logs -f trilium

# Backup database
docker-compose exec trilium tar czf /tmp/backup.tar.gz /home/node/trilium-data
docker cp trilium:/tmp/backup.tar.gz ./trilium-backup.tar.gz

# Restore from backup
docker-compose down
docker volume rm trilium_trilium-data
docker volume create trilium_trilium-data
docker run --rm -v trilium_trilium-data:/data -v $(pwd):/backup alpine \
  tar xzf /backup/trilium-backup.tar.gz -C /data --strip-components=4
docker-compose up -d
```

## Common Patterns

### Daily Note System

```javascript
// Label: #run=frontendStartup
// Create daily note launcher

api.addButtonToToolbar({
    title: 'Today',
    icon: 'calendar',
    action: async () => {
        const today = api.dayjs().format('YYYY-MM-DD');

        // Search for today's note
        let dayNote = await api.searchForNote(`#dateNote=${today}`);

        if (!dayNote) {
            // Create from template
            const template = await api.searchForNote('#template=dailyNote');
            const journalRoot = await api.searchForNote('#journal');

            dayNote = await api.createNoteWithContent(
                journalRoot.noteId,
                today,
                '',
                {templateNoteId: template.noteId}
            );

            dayNote.setLabel('dateNote', today);
        }

        await api.activateNote(dayNote.noteId);
    }
});
```

### Task Management System

```javascript
// Create task template
const taskTemplate = await api.createTextNote('templates', 'Task', `
# ${~title}

#task
#status=todo
#priority=medium

## Description

## Subtasks
- [ ]

## Notes
`);
taskTemplate.setLabel('template', '');

// Task query widget
class TaskListWidget extends api.NoteContextAwareWidget {
    doRender() {
        this.$widget = $(`<div class="task-list"></div>`);
        return this.$widget;
    }

    async refresh() {
        const tasks = await api.searchForNotes('#task #status=todo');

        this.$widget.empty();
        for (const task of tasks) {
            const priority = task.getLabelValue('priority');
            const $task = $(`
                <div class="task-item priority-${priority}">
                    <input type="checkbox" data-note-id="${task.noteId}">
                    <span>${task.title}</span>
                </div>
            `);

            $task.find('input').on('change', async (e) => {
                const noteId = $(e.target).data('note-id');
                const note = await api.getNote(noteId);
                note.setLabel('status', 'done');
                this.refresh();
            });

            this.$widget.append($task);
        }
    }
}

const widget = new TaskListWidget();
widget.renderInSidebar('right-pane');
```

### Note Linking and Backlinks

```javascript
// Get all notes linking to current note
async function getBacklinks(noteId) {
    const backlinks = await api.sql.getRows(`
        SELECT notes.noteId, notes.title
        FROM notes
        JOIN note_contents ON notes.noteId = note_contents.noteId
        WHERE note_contents.content LIKE ?
    `, [`%#root/${noteId}%`]);

    return backlinks;
}

// Create bidirectional link
async function createBidirectionalLink(sourceNoteId, targetNoteId, relationType = 'relatedTo') {
    const source = await api.getNote(sourceNoteId);
    const target = await api.getNote(targetNoteId);

    source.setRelation(relationType, targetNoteId);
    target.setRelation(relationType, sourceNoteId);
}

// Display backlinks widget
class BacklinksWidget extends api.NoteContextAwareWidget {
    async refresh() {
        const backlinks = await getBacklinks(this.noteId);

        this.$widget.empty();
        for (const link of backlinks) {
            const $link = $(`
                <a href="#root/${link.noteId}">${link.title}</a><br>
            `);
            this.$widget.append($link);
        }
    }
}
```

### Note Version History

```javascript
// Get revision history
async function getRevisions(noteId) {
    const revisions = await api.sql.getRows(`
        SELECT revisionId, title, dateCreated, contentLength
        FROM revisions
        WHERE noteId = ?
        ORDER BY dateCreated DESC
    `, [noteId]);

    return revisions;
}

// Compare revisions
async function compareRevisions(noteId, revisionId1, revisionId2) {
    const rev1 = await api.sql.getRow(`
        SELECT * FROM revisions WHERE revisionId = ?
    `, [revisionId1]);

    const rev2 = await api.sql.getRow(`
        SELECT * FROM revisions WHERE revisionId = ?
    `, [revisionId2]);

    return {
        titleChanged: rev1.title !== rev2.title,
        contentChanged: rev1.content !== rev2.content,
        changes: {
            title: {old: rev1.title, new: rev2.title},
            dateCreated: {old: rev1.dateCreated, new: rev2.dateCreated}
        }
    };
}

// Restore from revision
async function restoreRevision(noteId, revisionId) {
    const revision = await api.sql.getRow(`
        SELECT * FROM revisions WHERE revisionId = ?
    `, [revisionId]);

    const note = await api.getNote(noteId);
    await note.setContent(revision.content);
    await note.setTitle(revision.title);
}
```

## Performance Optimization

### Frontend Cache Management

```javascript
// Force reload subtree
await api.froca.loadSubTree(noteId);

// Clear frontend cache
await api.froca.clear();

// Lazy load optimization
const note = await api.froca.getNote(noteId);
if (!note.isContentLoaded) {
    await note.loadContent();
}
```

### Backend Cache Control

```javascript
// Backend: Invalidate Becca cache
await api.becca.reset();

// Reload specific entity
const note = api.becca.getNote(noteId);
await note.loadContent();

// Batch entity loading
const noteIds = ['id1', 'id2', 'id3'];
const notes = noteIds.map(id => api.becca.getNote(id));
```

### Database Optimization

```sql
-- Vacuum database (reclaim space)
VACUUM;

-- Analyze query performance
EXPLAIN QUERY PLAN
SELECT * FROM notes WHERE noteId = 'abc';

-- Create custom indices
CREATE INDEX idx_notes_type ON notes(type);
CREATE INDEX idx_attributes_name_value ON attributes(name, value);

-- Clean old revisions
DELETE FROM revisions
WHERE dateCreated < datetime('now', '-90 days')
AND noteId NOT IN (
    SELECT noteId FROM attributes WHERE name = 'keepRevisions'
);
```

### Sync Performance

```javascript
// Configure sync interval (milliseconds)
await api.sql.execute(`
    UPDATE options SET value = '300000' WHERE name = 'syncInterval'
`);

// Batch entity changes
const entities = [];
for (const note of notes) {
    entities.push({
        entity: note,
        entityChange: {
            entityName: 'notes',
            entityId: note.noteId,
            changeId: api.utils.newUuid()
        }
    });
}

// Push all at once
await api.syncPush(entities);
```

## Troubleshooting

### Common Issues

| Problem | Solution |
|---------|----------|
| Sync stuck at "Syncing..." | Reset sync state: `DELETE FROM options WHERE name LIKE 'sync%'` |
| Frontend not loading | Clear browser cache, rebuild client: `pnpm run client:build` |
| Protected session timeout | Increase timeout in Options > Advanced > Protected session timeout |
| Database locked | Close other Trilium instances, check for stale lock files |
| High memory usage | Reduce cache size, restart server, check for memory leaks in scripts |

### Debug Logging

```javascript
// Enable frontend logging
api.setDebugMode(true);

// Backend logging
const log = require('./services/log');
log.info('Custom log message');
log.error('Error occurred', error);

// SQL query logging
await api.sql.execute(`
    UPDATE options SET value = '1' WHERE name = 'logSql'
`);
```

### Database Integrity Checks

```javascript
// Check for orphaned entities
const orphanedBranches = await api.sql.getRows(`
    SELECT * FROM branches
    WHERE noteId NOT IN (SELECT noteId FROM notes)
`);

const orphanedAttributes = await api.sql.getRows(`
    SELECT * FROM attributes
    WHERE noteId NOT IN (SELECT noteId FROM notes)
`);

// Fix database integrity
await api.sql.execute(`PRAGMA integrity_check`);
```

## When to Use Trilium

**Ideal Use Cases:**
- Personal knowledge management with hierarchical organization
- Software development documentation with code snippets
- Research note-taking with bidirectional linking
- Project management with custom task tracking
- Encrypted personal journal with per-note encryption
- Team knowledge base with sync server
- Script-based automation and custom workflows

**Not Recommended For:**
- Real-time collaborative editing (use Notion/Google Docs)
- Large binary file storage (not optimized for this)
- Multi-user permissions (single-user model)
- Mobile-first note-taking (web interface not optimized)
- Simple todo lists (too feature-rich for basic needs)

## Key Design Principles

1. **Hierarchical first**: Notes organized in tree structure with cloning support
2. **Offline-capable**: Full functionality without network connection
3. **Scriptable everything**: Extend with JavaScript on frontend and backend
4. **Strong encryption**: Per-note encryption with protected sessions
5. **Sync-aware**: Built-in synchronization protocol for multi-device usage
6. **Widget-based UI**: Modular components for extensibility
7. **Type-flexible**: Support for 10+ note types with custom type creation

## Reference Files

Core Architecture:
- Main entry: `apps/server/src/main.ts`
- Client init: `apps/client/src/desktop.ts`
- Backend cache: `apps/server/src/becca/becca.ts`
- Frontend cache: `apps/client/src/services/froca.ts`
- Database schema: `apps/server/src/assets/db/schema.sql`

Entity System:
- Note entity: `apps/server/src/becca/entities/bnote.ts`
- Branch entity: `apps/server/src/becca/entities/bbranch.ts`
- Attribute entity: `apps/server/src/becca/entities/battribute.ts`
- Revision entity: `apps/server/src/becca/entities/brevision.ts`

Scripting:
- Backend API: `apps/server/src/services/backend_script_api.ts`
- Script executor: `apps/server/src/services/script.ts`
- Widget base: `apps/client/src/widgets/basic_widget.ts`

Synchronization:
- Sync protocol: `apps/server/src/services/sync.ts`
- Sync routes: `apps/server/src/routes/api/sync.ts`
- Entity changes: `apps/server/src/services/entity_changes.ts`

Documentation:
- User guide: `docs/User Guide/User Guide/`
- Developer guide: `docs/Developer Guide/Developer Guide/`
- Architecture: `docs/Developer Guide/Developer Guide/Architecture.md`
- Scripting guide: `docs/User Guide/User Guide/Scripting.md`
- ETAPI spec: `apps/server/src/etapi/etapi.openapi.yaml`
- Project instructions: `CLAUDE.md`
