# Library Manifest

Complete inventory of all resources in `.claude/library/`

---

## Directory Structure

```
.claude/library/
├── README.md                    # Quick-start guide
├── index.md                     # Complete resource index
├── MANIFEST.md                  # This file
├── design.md                    # Architecture and design
├── implementation-roadmap.md    # Development roadmap
├── .embeddings/                 # Vector embeddings cache
│   ├── ids.json
│   ├── metadata.json
│   └── vectors.npy
└── urls/
    ├── by-domain/              # Resources grouped by domain
    │   ├── claude.com.md
    │   ├── code.claude.com.md
    │   ├── github.com.md
    │   └── pypi.org.md
    └── by-topic/               # Resources grouped by topic
        ├── agent-development.md
        ├── documentation.md
        ├── knowledge-graphs.md
        ├── python.md
        └── security.md
```

---

## File Descriptions

### Documentation Files
- **README.md** - Getting started guide for the library
- **index.md** - Master index of all resources
- **MANIFEST.md** - This file
- **design.md** - Architecture decisions and patterns
- **implementation-roadmap.md** - Planned enhancements

### Domain Catalogs (urls/by-domain/)
Detailed resource collections organized by domain:

| Domain | Resources | Focus |
|--------|-----------|-------|
| **claude.com** | 27 | Claude platform, APIs |
| **code.claude.com** | 2 | Documentation |
| **github.com** | 20 | Code, examples, security |
| **pypi.org** | 4 | Python packages |

### Topic Catalogs (urls/by-topic/)
Curated collections organized by topic:

| Topic | Resources | Focus |
|-------|-----------|-------|
| **agent-development** | - | Agent frameworks, patterns |
| **documentation** | - | API docs, guides |
| **knowledge-graphs** | - | Graph systems, databases |
| **python** | - | Python ecosystem |
| **security** | - | Security practices, tools |

### Embeddings Cache (.embeddings/)
- **ids.json** - Resource identifiers
- **metadata.json** - Resource metadata
- **vectors.npy** - Vector embeddings (numpy binary)

---

## Resource Statistics

- **Total catalogued**: 100+ resources
- **Domains tracked**: 10+
- **Topics indexed**: 6
- **Coverage**: 2025-12-08 to 2026-01-30

---

## Maintenance

Last updated: 2026-01-30

All resources are externally sourced and properly attributed.
