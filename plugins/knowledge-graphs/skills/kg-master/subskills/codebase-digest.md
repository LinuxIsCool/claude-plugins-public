---
name: codebase-digest
description: Analyze and summarize codebases using codebase-digest CLI. Use when exploring unfamiliar code, preparing code for LLM analysis, generating architecture diagrams, identifying technical debt, creating documentation, or analyzing code quality. Provides directory trees, file consolidation, token counts, and 70+ LLM analysis prompts.
allowed-tools: Read, Bash, Glob, Grep
---

# Codebase Digest

A powerful CLI tool for analyzing, visualizing, and consolidating codebases for human and LLM analysis.

## Purpose

Codebase Digest transforms complex codebases into structured, analyzable outputs by:
- Generating hierarchical directory trees with statistics
- Consolidating all text files into single-file outputs
- Counting tokens for LLM context window planning
- Supporting multiple output formats (text, JSON, markdown, XML, HTML)
- Providing 70+ specialized LLM analysis prompts

## Installation

The tool is available at `resources/knowledge_graphs/codebase-digest/`

### Install via pip
```bash
pip install codebase-digest
```

### Install from source
```bash
cd resources/knowledge_graphs/codebase-digest
pip install -r requirements.txt
```

## Core Commands

### Basic Analysis
```bash
# Analyze current directory
cdigest /path/to/project

# Analyze with specific depth
cdigest /path/to/project -d 3

# Show file sizes in tree
cdigest /path/to/project --show-size
```

### Output Formats
```bash
# Markdown format (best for documentation)
cdigest /path/to/project -o markdown -f analysis.md

# JSON format (best for programmatic analysis)
cdigest /path/to/project -o json -f analysis.json

# XML format
cdigest /path/to/project -o xml -f analysis.xml

# HTML format (best for viewing in browser)
cdigest /path/to/project -o html -f analysis.html
```

### Filtering and Ignoring
```bash
# Ignore specific patterns
cdigest /path/to/project --ignore "*.log" "temp_*" "cache/"

# Use only custom ignore patterns (no defaults)
cdigest /path/to/project --no-default-ignores --ignore "*.test.js"

# Include .git directory (ignored by default)
cdigest /path/to/project --include-git

# Show ignored files in output
cdigest /path/to/project --show-ignored
```

### Content Control
```bash
# Exclude file contents (tree + stats only)
cdigest /path/to/project --no-content

# Set maximum content size (default: 10240 KB)
cdigest /path/to/project --max-size 5000

# Copy output to clipboard
cdigest /path/to/project --copy-to-clipboard
```

## CLI Options Reference

| Option | Short | Description | Default |
|--------|-------|-------------|---------|
| `--max-depth` | `-d` | Maximum directory traversal depth | Unlimited |
| `--output-format` | `-o` | Output format: text, json, markdown, xml, html | text |
| `--file` | `-f` | Output file name | `<dirname>_codebase_digest.<ext>` |
| `--show-size` | | Show file sizes in directory tree | false |
| `--show-ignored` | | Show ignored files in tree | false |
| `--ignore` | | Additional patterns to ignore | [] |
| `--keep-defaults` | | Keep default ignore patterns with custom | true |
| `--no-default-ignores` | | Disable default ignore patterns | false |
| `--no-content` | | Exclude file contents from output | false |
| `--include-git` | | Include .git directory | false |
| `--max-size` | | Maximum text content size in KB | 10240 |
| `--copy-to-clipboard` | | Copy output to clipboard | false |

## Default Ignore Patterns

Automatically ignores:
- **Python**: `*.pyc`, `*.pyo`, `*.pyd`, `__pycache__`, `venv`, `.venv`, `env`, `*.egg-info`
- **JavaScript**: `node_modules`, `bower_components`
- **Version Control**: `.git`, `.svn`, `.hg`, `.gitignore`
- **IDEs**: `.idea`, `.vscode`
- **Temp Files**: `*.log`, `*.bak`, `*.swp`, `*.tmp`
- **OS Files**: `.DS_Store`, `Thumbs.db`
- **Build**: `build`, `dist`
- **Binaries**: `*.so`, `*.dylib`, `*.dll`

## Output Format Comparison

### Text Format
- Human-readable console output
- Colored tree visualization
- Suitable for terminal viewing
- Best for quick exploration

### JSON Format
- Structured nested object
- Programmatically parseable
- Includes all metadata
- Best for tool integration

### Markdown Format
- GitHub/docs compatible
- Code blocks for syntax highlighting
- Table of contents friendly
- Best for documentation

### XML Format
- Hierarchical element structure
- Enterprise system compatible
- Schema-validatable
- Best for data exchange

### HTML Format
- Browser-viewable
- Styled output
- Clickable navigation
- Best for sharing reports

## LLM Integration Patterns

### Pattern 1: Prepare Code for LLM Analysis
```bash
# Generate markdown with full content
cdigest /path/to/project -o markdown -f analysis.md --max-size 20000

# Copy to clipboard and paste into LLM
cdigest /path/to/project -o markdown --copy-to-clipboard
```

### Pattern 2: Token Count Planning
```bash
# Check if codebase fits in context window
cdigest /path/to/project --no-content

# Output includes "Total tokens: 15234" for cl100k_base encoding
```

### Pattern 3: Selective Analysis
```bash
# Only analyze Python files
cdigest /path/to/project --no-default-ignores --ignore "*.js" "*.css" "*.html"

# Focus on specific directory depth
cdigest /path/to/project -d 2 -o markdown
```

## Prompt Library Categories

The tool includes 70+ specialized prompts at `resources/knowledge_graphs/codebase-digest/prompt_library/`

### I. Code Quality & Understanding
- **quality_error_analysis.md**: Identify errors and inconsistencies
- **quality_risk_assessment.md**: Evaluate security and maintainability risks
- **quality_code_complexity_analysis.md**: Analyze cyclomatic complexity
- **quality_code_duplication_analysis.md**: Find duplicated code
- **quality_code_style_consistency_analysis.md**: Check naming conventions
- **quality_documentation_generation.md**: Generate documentation

### II. Learning & Knowledge Extraction
- **learning_frontend_code_analysis.md**: Frontend best practices
- **learning_backend_code_analysis.md**: Backend patterns
- **learning_user_story_reconstruction.md**: Reconstruct user stories
- **learning_mini_lesson_generation.md**: Create learning materials
- **learning_algorithmic_storytelling.md**: Explain algorithm logic
- **learning_code_pattern_recognition.md**: Identify design patterns
- **learning_codebase_trivia_game.md**: Gamified learning
- **learning_frontend_component_documentation.md**: Component docs
- **learning_backend_api_documentation.md**: API documentation

### III. Code Improvement & Transformation
- **improvement_best_practice_analysis.md**: Best practice review
- **improvement_language_translation.md**: Translate to other languages
- **improvement_refactoring.md**: Suggest refactorings

### IV. Testing & Security
- **testing_unit_test_generation.md**: Generate unit tests
- **security_vulnerability_analysis.md**: Security assessment

### V. Business & Stakeholder Analysis
- **business_impact_analysis.md**: Feature impact analysis
- **swot_analysis.md**: Strengths, weaknesses, opportunities, threats
- **jobs_to_be_done_analysis.md**: User needs mapping
- **okr_analysis.md**: Align with OKRs
- **business_model_canvas_analysis.md**: Business model canvas
- **value_proposition_canvas_analysis.md**: Value propositions
- **lean_canvas_analysis.md**: Lean startup canvas
- **customer_journey_map_analysis.md**: User journey mapping
- **stakeholder_persona_generation.md**: Create personas

### VI. Architecture & Design
- **architecture_layer_identification.md**: Identify architectural layers
- **architecture_coupling_cohesion_analysis.md**: Coupling analysis
- **architecture_design_pattern_identification.md**: Pattern detection
- **architecture_database_schema_review.md**: Database review
- **architecture_diagram_generation.md**: Generate diagrams
- **architecture_api_conformance_check.md**: API validation
- **architecture_api_client_code_generation.md**: Generate API clients

### VII. Performance & Optimization
- **performance_bottleneck_identification.md**: Find bottlenecks
- **performance_resource_usage_profiling.md**: Resource profiling
- **performance_scalability_analysis.md**: Scalability assessment
- **performance_code_optimization_suggestions.md**: Optimization tips
- **performance_test_scenario_generation.md**: Performance tests

### VIII. Code Evolution & History
- **evolution_code_churn_hotspot_analysis.md**: High churn areas
- **evolution_technical_debt_estimation.md**: Technical debt
- **evolution_impact_analysis_of_code_changes.md**: Change impact
- **evolution_code_evolution_report_generation.md**: Evolution reports
- **evolution_codebase_evolution_visualization.md**: Visualize evolution

## Practical Workflows

### Workflow 1: New Codebase Exploration
```bash
# Step 1: Generate overview without content
cdigest /path/to/project --no-content -o markdown -f overview.md

# Step 2: Analyze architecture with LLM
cdigest /path/to/project -o markdown --copy-to-clipboard
# Use with: prompt_library/architecture_diagram_generation.md

# Step 3: Identify technical debt
# Use output with: prompt_library/evolution_technical_debt_estimation.md
```

### Workflow 2: Code Quality Review
```bash
# Generate full analysis
cdigest /path/to/project -o markdown -f quality_review.md

# Apply quality prompts:
# - quality_code_complexity_analysis.md
# - quality_code_duplication_analysis.md
# - quality_code_style_consistency_analysis.md
# - security_vulnerability_analysis.md
```

### Workflow 3: Documentation Generation
```bash
# Analyze frontend
cdigest /path/to/project/src/components -o markdown --copy-to-clipboard
# Use with: learning_frontend_component_documentation.md

# Analyze backend
cdigest /path/to/project/api -o markdown --copy-to-clipboard
# Use with: learning_backend_api_documentation.md
```

### Workflow 4: Pre-LLM Context Preparation
```bash
# Check token count
cdigest /path/to/project --no-content
# Note: "Total tokens: X"

# If under context limit (e.g., 200k tokens)
cdigest /path/to/project -o markdown --copy-to-clipboard

# If over context limit, use selective analysis
cdigest /path/to/project -d 2 --ignore "tests/" "docs/" -o markdown
```

### Workflow 5: Business Alignment Analysis
```bash
# Generate codebase digest
cdigest /path/to/project -o markdown -f business_analysis.md

# Apply business prompts:
# - business_impact_analysis.md (feature value)
# - swot_analysis.md (strategic position)
# - value_proposition_canvas_analysis.md (user value)
# - customer_journey_map_analysis.md (user experience)
```

## Integration Examples

### Example 1: Automated Documentation Pipeline
```bash
#!/bin/bash
# Generate architecture docs
cdigest ./src -o markdown -f docs/architecture.md

# Generate API docs using prompt library
cdigest ./src/api -o markdown --copy-to-clipboard
# Apply: prompt_library/learning_backend_api_documentation.md
```

### Example 2: CI/CD Quality Checks
```bash
# Pre-commit hook: Check codebase size
MAX_TOKENS=50000
ACTUAL=$(cdigest . --no-content | grep "Total tokens:" | awk '{print $3}')

if [ "$ACTUAL" -gt "$MAX_TOKENS" ]; then
  echo "Warning: Codebase exceeds token limit"
fi
```

### Example 3: Multi-Format Export
```bash
# Generate all formats for different stakeholders
cdigest /path/to/project -o text -f reports/digest.txt
cdigest /path/to/project -o json -f reports/digest.json
cdigest /path/to/project -o markdown -f reports/digest.md
cdigest /path/to/project -o html -f reports/digest.html
```

## Token Counting

Uses OpenAI's `tiktoken` library with `cl100k_base` encoding (GPT-4, GPT-3.5-turbo compatible).

**Token estimates**:
- Claude 3.5 Sonnet: ~200,000 token context
- GPT-4: ~128,000 token context
- GPT-3.5-turbo: ~16,000 token context

**Planning tip**: Run with `--no-content` first to check token count before generating full content.

## Custom Ignore Patterns

### Using .cdigestignore
Create `.cdigestignore` in project root:
```
# Custom ignore patterns
*.test.js
*_test.py
fixtures/
mocks/
.env*
secrets/
```

### Wildcard Patterns
- `*.ext` - All files with extension
- `file*` - Files starting with "file"
- `*pattern*` - Files containing "pattern"
- `dir/` - Specific directory
- `/absolute/path` - Absolute path

## Clipboard Integration

### macOS
Uses `pbcopy` automatically via `pyperclip`

### Linux
Requires `xclip` or `xsel`:
```bash
sudo apt-get install xclip  # Debian/Ubuntu
sudo yum install xclip      # RHEL/CentOS
```

### Windows
Uses built-in clipboard via `pyperclip`

## Output Statistics

Every analysis includes:
- **Total files analyzed**: Count of non-ignored files
- **Total directories analyzed**: Count of non-ignored directories
- **Estimated output size**: Predicted size in KB
- **Actual analyzed size**: Total file sizes in KB
- **Total tokens**: Token count for cl100k_base encoding
- **Text content size**: Actual text content size in KB

## Common Use Cases

| Use Case | Command | Prompt Library |
|----------|---------|----------------|
| Explore new codebase | `cdigest . --no-content` | architecture_layer_identification.md |
| Security audit | `cdigest . -o markdown` | security_vulnerability_analysis.md |
| Generate docs | `cdigest ./src --copy-to-clipboard` | quality_documentation_generation.md |
| Code review | `cdigest . -d 3 -o markdown` | quality_code_complexity_analysis.md |
| Refactoring prep | `cdigest . --show-size` | improvement_refactoring.md |
| Test generation | `cdigest ./src -o json` | testing_unit_test_generation.md |
| Business analysis | `cdigest . -o markdown` | business_impact_analysis.md |
| Performance review | `cdigest . --copy-to-clipboard` | performance_bottleneck_identification.md |
| Architecture diagram | `cdigest . -o markdown` | architecture_diagram_generation.md |
| Technical debt | `cdigest . -o markdown` | evolution_technical_debt_estimation.md |

## Tips and Best Practices

### 1. Start Small
```bash
# Check stats first
cdigest /path/to/project --no-content

# Then generate content if size is reasonable
cdigest /path/to/project -o markdown
```

### 2. Use Depth Limiting
```bash
# Large projects: limit depth
cdigest /path/to/project -d 2 -o markdown

# Deep dive specific areas
cdigest /path/to/project/src/critical -d 5 -o markdown
```

### 3. Combine with LLM Prompts
```bash
# Generate digest
cdigest . -o markdown -f analysis.md

# Read prompt template
cat /path/to/codebase-digest/prompt_library/architecture_diagram_generation.md

# Combine in LLM: analysis.md + prompt template
```

### 4. Iterative Analysis
```bash
# Overview
cdigest . --no-content -o text

# Specific subsystems
cdigest ./frontend -o markdown -f frontend_analysis.md
cdigest ./backend -o markdown -f backend_analysis.md
cdigest ./database -o markdown -f database_analysis.md
```

### 5. Version Control Friendly
```bash
# Add to .gitignore
echo "*_codebase_digest.*" >> .gitignore
echo ".cdigestignore" >> .gitignore  # Optional
```

## Troubleshooting

### Issue: Output too large
```bash
# Solution 1: Exclude content
cdigest /path/to/project --no-content

# Solution 2: Limit depth
cdigest /path/to/project -d 2

# Solution 3: Add ignore patterns
cdigest /path/to/project --ignore "tests/" "docs/"
```

### Issue: Clipboard copy fails
```bash
# Linux: Install xclip
sudo apt-get install xclip

# Test with manual copy
cdigest /path/to/project -o text -f output.txt
# Then manually copy output.txt
```

### Issue: Permission denied
```bash
# Check directory permissions
ls -la /path/to/project

# Run with appropriate permissions
sudo cdigest /path/to/project  # Not recommended
# Better: fix directory permissions
```

### Issue: Non-text files included
```bash
# Add binary patterns to ignore
cdigest /path/to/project --ignore "*.jpg" "*.png" "*.pdf"
```

## Reference Files

**Main script**: `resources/knowledge_graphs/codebase-digest/codebase_digest/app.py`

**Prompt library**: `resources/knowledge_graphs/codebase-digest/prompt_library/`

**Documentation**: `resources/knowledge_graphs/codebase-digest/README.md`

**Setup**: `resources/knowledge_graphs/codebase-digest/setup.py`

**Requirements**: `resources/knowledge_graphs/codebase-digest/requirements.txt`

## Version

Current version: 0.1.43

## Dependencies

- **tiktoken**: Token counting (cl100k_base)
- **colorama**: Colored console output
- **pyperclip**: Clipboard integration
- **mimetypes**: File type detection

## Next Steps After Using This Skill

1. **Analyze the output** - Review generated statistics and structure
2. **Select appropriate prompts** - Choose from 70+ templates in prompt_library
3. **Apply LLM analysis** - Combine codebase digest with prompt templates
4. **Generate documentation** - Use output for technical docs
5. **Track changes** - Re-run periodically to monitor codebase evolution
