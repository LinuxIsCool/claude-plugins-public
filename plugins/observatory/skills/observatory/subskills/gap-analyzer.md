---
name: gap-analyzer
description: Analyze capability gaps between local plugins and external catalog offerings.
---

# Gap Analyzer Sub-Skill

## Purpose

Compare the capabilities of locally installed plugins against the external catalog to identify gaps and recommend plugins to explore.

## How It Works

1. **Scan Local Plugins**: Inventory all plugins in `plugins/` directory
2. **Load External Catalog**: Read curated YAML catalogs
3. **Map Capabilities**: Extract capabilities from both sets
4. **Identify Gaps**: Find capabilities available externally but not locally
5. **Prioritize**: Score gaps by importance and availability
6. **Recommend**: Suggest top plugins to fill gaps

## Running Gap Analysis

### Quick Analysis (CLI)
```bash
cd plugins/observatory && bun run gaps
```

### Manual Analysis

1. First, scan local plugins:
```bash
ls -la plugins/*/. claude-plugin/plugin.json | wc -l
```

2. Check local capabilities by examining plugin keywords:
```bash
grep -h "keywords" plugins/*/.claude-plugin/plugin.json | sort | uniq
```

3. Compare against external catalog:
```bash
cat plugins/observatory/data/curated/*.yaml | grep "capabilities:"
```

## Gap Priority Scoring

Gaps are scored 0-100 based on:

| Factor | Weight | Description |
|--------|--------|-------------|
| **External Availability** | 30% | More external plugins = validated need |
| **Local Coverage** | -20 | Partial coverage reduces priority |
| **High-Value Domain** | +25 | Security, testing, code-review, devops, AI |
| **Essential Domain** | +15 | Backend, frontend, database, debugging |

## Output Format

Gap analysis produces a report with:

### Summary
- Local plugin count
- External catalog size
- Capabilities covered vs gaps

### Top Recommendations
For each high-priority gap:
- Capability name
- Recommended external plugin
- Why it matters

### Gap Details Table
| Capability | Priority | Local Coverage | External Options |
|------------|----------|----------------|------------------|

### Covered Capabilities
List of capabilities already provided locally.

## Example Output

```markdown
# Gap Analysis Report

**Local Plugins**: 21
**External Catalog**: 85 entries
**Gaps Identified**: 12

## Top Recommendations

### 1. security-audit (Priority: 85)
**Recommended**: `security-auditor` (davepoon)
> Review code for vulnerabilities, implement secure authentication...
*No local plugins currently provide security-audit*

### 2. testing (Priority: 70)
**Recommended**: `test-automator` (davepoon)
> Create comprehensive test suites with unit, integration, and e2e tests...
*Would enhance existing testing capabilities*
```

## Using the Results

After identifying gaps:

1. **Prioritize**: Focus on gaps with score > 50
2. **Evaluate**: Review recommended plugins on GitHub
3. **Test**: Clone to `experiments/` for sandbox testing
4. **Integrate**: If suitable, add to local plugins/

## Capability Categories

The analyzer tracks these domains:

**Development**: backend, frontend, mobile, api-design, database, devops-cicd
**Languages**: python, typescript, rust, go, java, ruby, php, c-cpp
**Quality**: code-review, testing, security-audit, debugging, performance
**AI/Data**: ai-ml, llm-tooling, embeddings, rag, data-engineering
**Business**: project-management, documentation, scheduling, finance
**Infrastructure**: cloud, containerization, monitoring, networking
**Specialized**: blockchain-web3, game-development, research, accessibility
