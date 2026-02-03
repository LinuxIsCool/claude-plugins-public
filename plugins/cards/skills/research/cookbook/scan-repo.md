# Scan Repository Recipe

## When to Use
When you need to generate a comprehensive map of a repository's structure and contents.

## Prerequisites
- Repository cloned in `skills/resources/repos/{name}`
- Entry exists in `skills/resources/repos.jsonl`

## Steps

### 1. Survey Top-Level Structure

```bash
ls -la plugins/cards/skills/resources/repos/{repo-name}/
tree -L 2 plugins/cards/skills/resources/repos/{repo-name}/ 2>/dev/null || find plugins/cards/skills/resources/repos/{repo-name}/ -maxdepth 2 -type d
```

### 2. Read Documentation

```bash
cat plugins/cards/skills/resources/repos/{repo-name}/README.md
ls plugins/cards/skills/resources/repos/{repo-name}/docs/ 2>/dev/null
```

### 3. Identify Schema/Model Files

Look for common patterns:
```bash
find plugins/cards/skills/resources/repos/{repo-name} -name "*.schema.json" -o -name "*.ttl" -o -name "models.py" -o -name "types.ts"
```

### 4. Generate Map Document

Create `skills/research/maps/{repo-name}.md` with:

```markdown
---
title: "Resource Map: {repo-name}"
type: map
created: {ISO8601}
sources:
  - "@repos/{repo-name}"
tags: []
status: draft
---

# Resource Map: {repo-name}

## Overview
{brief description from README}

## Structure
{tree output or directory listing}

## Key Concepts
{extracted from documentation and code}

## Key Files
{prioritized list of files to read}
```

### 5. Index the Map

```bash
echo '{"id":"'$(uuidgen)'","type":"map","title":"Resource Map: {repo-name}","created_at":"'$(date -Iseconds)'","path":"maps/{repo-name}.md","sources":["@repos/{repo-name}"],"tags":[],"status":"draft"}' >> plugins/cards/skills/research/index.jsonl
```

## Deep Scan Checklist

For comprehensive scanning:
- [ ] README and documentation
- [ ] Package/dependency files (package.json, requirements.txt, pyproject.toml)
- [ ] Schema definitions (.schema.json, .ttl, OpenAPI specs)
- [ ] Model/type definitions (models.py, types.ts, interfaces)
- [ ] Configuration files
- [ ] Example data or fixtures
- [ ] Tests (often reveal expected behavior)

## Output

A map document in `skills/research/maps/{repo-name}.md` that:
- Documents the repository's structure
- Identifies key concepts and patterns
- Prioritizes files for deeper reading
- Establishes cross-references to other resources
