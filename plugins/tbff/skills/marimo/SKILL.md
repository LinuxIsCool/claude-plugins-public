---
name: marimo
description: Master skill for marimo reactive notebooks. Sub-skills (8): quickstart, reactive-execution, ui-components, output-display, data-integration, deployment, ecosystem, jupyter-migration. Invoke for Python notebooks, data apps, interactive computing.
allowed-tools: Read, Skill, Task, Glob, Grep, Bash
---

# Marimo - Master Skill

**marimo** is a reactive Python notebook (NumFOCUS affiliated) that's reproducible, git-friendly, and deployable as scripts or apps.

## Quick Reference

### Core Concepts

| Concept | Description |
|---------|-------------|
| Reactive execution | Run a cell → dependent cells auto-run |
| No hidden state | Delete a cell → variables scrubbed |
| Pure Python | Notebooks are `.py` files, not JSON |
| Built-in UI | Native `mo.ui.*` widgets |

### Essential CLI

```bash
pip install marimo              # Install
marimo edit notebook.py         # Edit in browser
marimo run notebook.py          # Run as app
marimo export html notebook.py  # Export to HTML
```

## Sub-Skills Index

| Sub-Skill | Use When | File |
|-----------|----------|------|
| **quickstart** | New to marimo, getting started, CLI reference | `subskills/quickstart.md` |
| **reactive-execution** | Understanding reactivity, debugging execution, lazy mode | `subskills/reactive-execution.md` |
| **ui-components** | Building interactive UIs, widgets, forms | `subskills/ui-components.md` |
| **output-display** | Formatting output, markdown, layouts, visualizations | `subskills/output-display.md` |
| **data-integration** | SQL queries, databases, DataFrames | `subskills/data-integration.md` |
| **deployment** | Deploying apps, WASM, Docker, frameworks | `subskills/deployment.md` |
| **ecosystem** | Third-party tools, marimo-blocks, community libs | `subskills/ecosystem.md` |
| **jupyter-migration** | Converting from Jupyter, comparison, migration tips | `subskills/jupyter-migration.md` |

## Quick Selection Guide

| If You Want To... | Read This Sub-Skill |
|-------------------|---------------------|
| Get started with marimo | quickstart |
| Understand how reactivity works | reactive-execution |
| Add sliders, buttons, dropdowns | ui-components |
| Format text, create layouts | output-display |
| Query databases or DataFrames | data-integration |
| Share your notebook as an app | deployment |
| Find community tools | ecosystem |
| Migrate from Jupyter | jupyter-migration |

## Deep Dive

Load sub-skills for detailed context:

```
Read subskills/quickstart.md         → Installation, CLI, first notebook
Read subskills/reactive-execution.md → Reactivity model, lazy mode
Read subskills/ui-components.md      → All 15 widgets with examples
Read subskills/output-display.md     → Markdown, HTML, layouts
Read subskills/data-integration.md   → SQL, databases, DataFrames
Read subskills/deployment.md         → 8 deployment methods
Read subskills/ecosystem.md          → Third-party tools, extensions
Read subskills/jupyter-migration.md  → Jupyter comparison, migration
```
