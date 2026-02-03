---
name: Research
description: Generate insights and maps from acquired resources for the Cards plugin. Use when you need to scan resources, extract patterns, map relationships, or synthesize findings. Keywords: scan, analyze, map, insight, patterns, research.
---

# Research Skill

Generate insights, maps, and analysis from acquired resources to inform Cards plugin development.

## Variables

RESEARCH_PATH: `plugins/cards/skills/research/`
MAPS_PATH: `plugins/cards/skills/research/maps/`
INSIGHTS_PATH: `plugins/cards/skills/research/insights/`
RESEARCH_INDEX: `plugins/cards/skills/research/index.jsonl`
RESOURCES_SKILL: `plugins/cards/skills/resources/`

## Instructions

- **Maps document structure**: What's in a resource, how it's organized
- **Insights synthesize understanding**: Patterns, themes, recommendations
- **Cross-reference liberally**: Link maps and insights to resources
- **Use @tags**: Reference source resources in all research outputs
- **Progressive research**: Start shallow, go deep as needed

### Output File Pattern

All research outputs use consistent frontmatter:
```yaml
---
title: "Document Title"
type: map|insight|relationship
created: ISO8601
sources:
  - "@repos/resource-name"
  - "@urls/source-name"
tags: [tag1, tag2]
status: draft|complete
---
```

## Workflow

### Scan Resource (Generate Map)

1. **Identify resource**: Use @tag to reference (e.g., `@repos/koi-research`)
2. **Survey structure**: List directories, key files, README
3. **Read key files**: Extract concepts, patterns, purpose
4. **Generate map**: Document in `maps/{resource-name}.md`
5. **Index**: Append to index.jsonl

### Generate Insight

1. **Gather sources**: Read relevant maps and resources
2. **Identify question**: What are we trying to understand?
3. **Analyze**: Extract patterns, compare approaches
4. **Synthesize**: Document in `insights/{topic}.md`
5. **Index**: Append to index.jsonl

### Map Relationships

1. **Extract entities**: From multiple resources
2. **Identify relationships**: How concepts connect
3. **Diagram**: Use mermaid for visualization
4. **Document**: Save to `maps/relationships/{topic}.md`

## Cookbook

Extended documentation for research operations.

| Operation | When to Read | Documentation |
|-----------|--------------|---------------|
| Scan Repository | Need to map structure of a cloned repo | [cookbook/scan-repo.md](cookbook/scan-repo.md) |
| Deep Dive | Need comprehensive analysis of a resource | [cookbook/deep-dive.md](cookbook/deep-dive.md) |
| Synthesize | Need to combine insights from multiple sources | [cookbook/synthesize.md](cookbook/synthesize.md) |
| Extract Schema | Need to identify data structures in a resource | [cookbook/extract-schema.md](cookbook/extract-schema.md) |

## Research Questions

Current research questions driving Cards plugin development:

### Card Ontology
- [ ] What is the minimal viable Card schema?
- [ ] How do existing ontologies handle identity, type, timestamps?
- [ ] What relationship types are universal (parent, child, neighbor)?
- [ ] How do embeddings relate to ontological structure?

### Morphological Transformations
- [ ] What transformations exist between markdown ↔ JSON ↔ SQL?
- [ ] How does KOI handle format conversion?
- [ ] What validation is needed at transformation boundaries?

### Graph Structure
- [ ] How to represent parent/child/neighbor in different formats?
- [ ] What graph query patterns are most useful?
- [ ] How do tags relate to graph edges?

## Map Template

Use this template for resource maps:

```markdown
---
title: "Resource Map: {name}"
type: map
created: {ISO8601}
sources:
  - "@repos/{name}"
tags: []
status: draft
---

# Resource Map: {name}

## Overview
- **Type**: repo|url|transcript|reference
- **Purpose**: What this resource is for
- **Relevance**: Why it matters for Cards

## Structure
{directory tree or document outline}

## Key Concepts
| Concept | Description | Location |
|---------|-------------|----------|
| Concept 1 | What it is | Where found |

## Patterns Identified
| Pattern | Description | Example |
|---------|-------------|---------|
| Pattern 1 | What it does | Where seen |

## Key Files
| File | Purpose | Read Priority |
|------|---------|---------------|
| path/to/file | What it does | High/Medium/Low |

## Cross-References
- Related to: [other resource map]
- Informs: [insight if any]
```

## Insight Template

Use this template for insights:

```markdown
---
title: "Insight: {topic}"
type: insight
created: {ISO8601}
sources:
  - "@repos/{name}"
  - "maps/{map-name}.md"
tags: []
status: draft
---

# Insight: {topic}

## Question
What were we trying to understand?

## Sources Consulted
| Source | Key Contribution |
|--------|------------------|
| @repos/... | What we learned |

## Findings

### Finding 1: {title}
{detailed explanation with evidence}

### Finding 2: {title}
{detailed explanation with evidence}

## Synthesis
How findings connect and what they mean together.

## Recommendations
1. Recommendation with rationale
2. Recommendation with rationale

## Open Questions
- What remains unclear
- What needs further research
```

## Prompts

Prompt templates for research operations:

| Prompt | Use When | File |
|--------|----------|------|
| scan-structure | Initial survey of resource organization | [prompts/scan-structure.md](prompts/scan-structure.md) |
| extract-patterns | Identifying patterns across resources | [prompts/extract-patterns.md](prompts/extract-patterns.md) |
| synthesize-findings | Combining insights into coherent analysis | [prompts/synthesize-findings.md](prompts/synthesize-findings.md) |

## Index Schema

### index.jsonl
```json
{"id": "uuid", "type": "map|insight|relationship", "title": "...", "created_at": "ISO8601", "path": "maps/...|insights/...", "sources": ["@repos/...", "@urls/..."], "tags": ["tag1"], "status": "draft|complete"}
```

## Foundational Insights

**CRITICAL**: Before any Cards-related work, consult these foundational documents:

### @insights/cards-concept.md
The complete philosophical and technical specification for the Cards system:
- Morphological ontology (taxonomy → morphology shift)
- Cell metaphor (Cards as cells in a cognitive organism)
- Universal Card schema (20+ fields: rid, embedding, hash_history, priority_score, etc.)
- Days table as temporal backbone
- CardLink semantics (supports, contradicts, derived_from, parent_of, etc.)
- 7 Core Agents architecture
- Multi-language implementations

### @insights/ontological-manual.md
The semantic density principle and agentic leverage:
- Schema as capability (DDL → SQL, TTL → SPARQL, OpenAPI → REST, MCP → tools)
- Knowledge representation (RDF, OWL, SPARQL, Cypher, GDS)
- Agent protocols (MCP, A2A, ATPROTO)
- LLM patterns (RAG, CoT, ReAct, HyDE, DSPy)
- 100 terms ranked by agentic leverage
- Quick reference cards for DDL, MCP, RAG, ReAct

## Current Research Status

### Maps Generated
(none yet - initialize by scanning resources)

### Insights Generated
| Insight | Path | Status |
|---------|------|--------|
| The Cards System | `@insights/cards-concept.md` | Complete |
| Agentic LLM User Manual | `@insights/ontological-manual.md` | Complete |

### Next Steps
1. Scan `@repos/koi-research` - ontology patterns
2. Scan `@repos/claude-plugins-official` - plugin patterns
3. Scan personal-digital reference - Card implementation
4. Generate insight on Card base schema
