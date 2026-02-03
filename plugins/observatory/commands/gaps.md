---
description: Analyze capability gaps between local and external plugins
argument-hint: [--detail | --summary]
---

# Observatory Gap Analysis

Compare local plugin capabilities against the external catalog to identify gaps and get recommendations.

## Arguments

- `--detail` - Show full gap analysis with all details
- `--summary` - Show quick summary only (default)
- No argument - Show summary with top recommendations

## Instructions

### Step 1: Scan Local Plugins

First, inventory local plugins:
```bash
ls -d plugins/*/.claude-plugin 2>/dev/null | wc -l
```

List local plugin names:
```bash
ls -1 plugins/ | grep -v "^observatory$"
```

### Step 2: Load External Catalog

Read the curated catalogs to understand what's available externally:
```
Read plugins/observatory/data/curated/davepoon.yaml
Read plugins/observatory/data/curated/jeremylongshore.yaml
```

### Step 3: Map Capabilities

For local plugins, check their keywords and descriptions:
```bash
for p in plugins/*/.claude-plugin/plugin.json; do
  echo "=== $(dirname $(dirname $p)) ==="
  grep -E "(keywords|description)" "$p" 2>/dev/null | head -3
done
```

### Step 4: Identify Gaps

Compare the capability lists:

**Local Capabilities** (inferred from plugin keywords):
- journal, logging, awareness → documentation, project-management
- schedule → scheduling
- projects → project-management, finance
- backlog → project-management
- knowledge-graphs → rag, ai-ml
- etc.

**External Capabilities Not Covered Locally**:
- security-audit (no dedicated security plugin)
- testing (no dedicated testing plugin)
- code-review (no dedicated review plugin)
- Most language specialists (python, rust, go experts)
- Mobile development
- Blockchain/Web3

### Step 5: Present Gap Report

Format the output as:

```markdown
# Plugin Observatory - Gap Analysis

*Generated: [timestamp]*

## Summary

| Metric | Value |
|--------|-------|
| Local Plugins | 21 |
| External Catalog | ~60 entries |
| Capabilities Covered | 8 |
| Capability Gaps | 15+ |

## Top Recommendations

### 1. security-audit (Priority: 85)
**No local coverage**

Recommended: `security-auditor` from davepoon/buildwithclaude
> Review code for vulnerabilities, implement secure authentication...

### 2. testing (Priority: 70)
**No local coverage**

Recommended: `test-automator` from davepoon/buildwithclaude
> Create comprehensive test suites with unit, integration, and e2e tests...

### 3. code-review (Priority: 65)
**No local coverage**

Recommended: `code-reviewer` from davepoon/buildwithclaude
> Expert code review specialist for quality, security, and maintainability...

## Covered Capabilities

These capabilities have local plugin coverage:
- project-management (projects, backlog)
- scheduling (schedule)
- documentation (journal, logging)
- llm-tooling (llms, knowledge-graphs)
- rag (hipporag, knowledge-graphs)

## Next Steps

1. Review recommended plugins on GitHub
2. Test in sandbox: `experiments/`
3. Request integration for valuable plugins
```

## For --detail Flag

Also include:

- Full list of all identified gaps with priority scores
- Detailed capability mapping for each local plugin
- Complete external plugin counts by capability
