# github.com

*Domain catalogue for GitHub resources*

---

## Domain Statistics

| Metric | Value |
|--------|-------|
| Resources tracked | 16 unique URLs |
| Total references | 22 |
| First accessed | 2025-12-08 |
| Category | Code Repositories |
| Domains | github.com, gist.github.com |

---

## Overview

GitHub resources include code repositories, gists, security alerts, and plugin dependencies. These represent the primary code hosting and collaboration platform for the ecosystem.

---

## Resources by Category

### Security & Secrets (1 resources)

Security-related URLs including secret scanning and push protection alerts.

**URL**: https://github.com/LinuxIsCool/claude-plugins/security/secret-scanning/unblock-secret/36tKHHxKfzuRQS93Kcd4itmVs5J
- Sessions: 1
- Context: Security scanning and secret management


### Code Repositories (14 resources)

**URL**: https://github.com/polyipseity/obsidian-show-hidden-files
- Sessions: 1

**URL**: https://github.com/polyipseity/obsidian-show-hidden-files/releases/latest/download/manifest.json
- Sessions: 1

**URL**: https://github.com/polyipseity/obsidian-show-hidden-files/releases/latest/download/main.js
- Sessions: 1

**URL**: https://github.com/polyipseity/obsidian-show-hidden-files/releases/latest/download/styles.css
- Sessions: 1

**URL**: https://github.com/samuelcolvin/watchfiles
- Sessions: 1


*... and 9 more repositories*

### Gists (1 resources)

Code snippets and examples shared via GitHub Gists.

**URL**: https://gist.github.com/yano3nora/49bbe455ea8529f6276627a9391118c5
- Sessions: 1


---

## Notable Resources

### graphiti

**URL**: https://github.com/getzep/graphiti

**Metadata**:
```yaml
url: https://github.com/getzep/graphiti
title: "Graphiti - Build and query temporally-aware knowledge graphs"
domain: github.com
fetched: 2025-12-15T19:15:00Z
last_accessed: 2025-12-15T19:15:00Z
access_count: 1
topics: [knowledge-graphs, temporal-graphs, agent-memory, ai-agents]
cited_by:
  - session: 2025-12-13-15-18-40-05038dd8
  - document: plugins/knowledge-graphs/skills/kg-master/subskills/graphiti.md
  - agent: git-historian
freshness_policy: 7d
license: Apache-2.0
```

**Summary**:
Graphiti is an open-source framework by Zep for building and querying temporally-aware knowledge graphs optimized for AI agents. It continuously integrates user interactions, structured/unstructured enterprise data, and external information into a coherent, queryable graph.

**Key Features**:
- Real-time incremental updates without batch recomputation
- Bi-temporal data model (event occurrence time + ingestion time)
- Hybrid retrieval: semantic embeddings + BM25 keyword search + graph traversal
- Custom entity definitions via Pydantic models
- Enterprise scalability with parallel processing
- Point-in-time historical queries

**Use In This Repository**:
- Informed the design of the `git-historian` agent
- Provided patterns for temporal knowledge graph construction
- FalkorDB driver used for git history ingestion
- Bi-temporal model applied to commit validity tracking

**Related Resources**:
- Documentation: https://help.getzep.com/graphiti
- Academic Paper: https://arxiv.org/abs/2501.13956
- MCP Server: Included in repository

---

## Access Patterns

- **Frequency**: Medium-High (20 unique URLs)
- **Type**: Mixed (manual references, automated alerts)
- **Purpose**: Code dependencies, security scanning, examples
- **Caching**: Varies by resource type

---

*Last updated: 2025-12-15*
