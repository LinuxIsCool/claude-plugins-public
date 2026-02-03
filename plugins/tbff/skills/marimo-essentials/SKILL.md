---
name: marimo-essentials-deprecated
description: DEPRECATED - Use 'marimo' skill instead. This skill has been superseded by the marimo master skill with 8 sub-skills.
---

> **DEPRECATED**: This skill has been replaced by the `marimo` skill with comprehensive sub-skills.
> Use `Skill marimo` or invoke the `tbff:marimo-specialist` agent instead.


# Marimo Essentials

**marimo** is a reactive Python notebook (NumFOCUS affiliated) that's reproducible, git-friendly, and deployable as scripts or apps.

## Core Concepts

### Reactive Execution
- Run a cell → marimo automatically runs all dependent cells
- Delete a cell → variables scrubbed from memory (no hidden state)
- Deterministic execution order based on variable references, not cell position

### Storage Format
- Notebooks stored as pure `.py` files (not JSON)
- Git-friendly, diffable, importable as Python modules

## CLI Commands

```bash
# Install
pip install marimo
pip install "marimo[recommended]"  # with SQL, AI, extras

# Edit notebook in browser
marimo edit notebook.py

# Run as web app (code hidden)
marimo run notebook.py

# Execute as script
python notebook.py

# Export to static HTML
marimo export html notebook.py -o output.html

# Export with WASM (runs Python in browser)
marimo export html-wasm notebook.py -o output.html

# Convert Jupyter notebook
marimo convert notebook.ipynb > notebook.py

# List tutorials
marimo tutorial --help
```

## Cell Structure

```python
import marimo as mo

@app.cell
def _():
    slider = mo.ui.slider(1, 100, value=50, label="Value")
    return slider,

@app.cell
def _(slider):
    # Automatically re-runs when slider changes
    mo.md(f"**Result:** {slider.value ** 2}")
    return
```

## UI Widgets (mo.ui.*)

| Widget | Usage |
|--------|-------|
| `mo.ui.slider(start, stop, value, label)` | Numeric slider |
| `mo.ui.dropdown(options, value)` | Selection dropdown |
| `mo.ui.checkbox(value)` | Boolean toggle |
| `mo.ui.text(value, placeholder)` | Single-line text input |
| `mo.ui.text_area(value)` | Multi-line text input |
| `mo.ui.table(data)` | Interactive data table |
| `mo.ui.file(kind)` | File upload |
| `mo.ui.button(label, on_click)` | Clickable button |
| `mo.ui.number(start, stop, value)` | Numeric input |
| `mo.ui.date(value)` | Date picker |
| `mo.ui.form(element)` | Wrap element in submit form |
| `mo.ui.array(elements)` | Array of UI elements |
| `mo.ui.dictionary(elements)` | Dict of UI elements |
| `mo.ui.chat(model)` | Chat interface |

## SQL Support

```python
@app.cell
def _():
    # Query dataframes directly with SQL
    result = mo.sql("""
        SELECT * FROM my_dataframe
        WHERE value > 100
        ORDER BY date DESC
    """)
    return result,
```

- Query dataframes, databases, lakehouses, CSVs, Google Sheets
- Results returned as Python dataframes
- Notebooks remain pure Python even with SQL cells

## Output & Markdown

```python
# Dynamic markdown with Python variables
mo.md(f"The result is **{value}**")

# HTML output
mo.Html("<div>Custom HTML</div>")

# Accordion, tabs, callouts
mo.accordion({"Section 1": content1, "Section 2": content2})
mo.tabs({"Tab A": content_a, "Tab B": content_b})
mo.callout("Important message", kind="warn")

# Stop execution conditionally
mo.stop(condition, mo.md("Stopped because..."))
```

## Lazy Execution Mode

Configure runtime to mark cells as stale instead of auto-running:
- Prevents accidental execution of expensive cells
- Maintains program state guarantees

## Framework Integration

Mount marimo apps in web frameworks:
- **FastAPI**: `from marimo import MarimoASGI`
- **Flask**: Flask adapter available
- **FastHTML**: Native integration

## Ecosystem

### marimo-blocks (@marimo-team/blocks)
React components for embedding marimo in custom apps:
```tsx
import { Provider, CellEditor, CellOutput } from "@marimo-team/blocks";
```

### marimo-lsp
Language server protocol for editor integration.

### Community Libraries
- `mkdocs-marimo` - Reactive docs with MkDocs
- `mowidget` - Custom widgets (color picker, array viewer)
- `mohtml` - HTML DSL for marimo
- `wigglystuff` - Creative widgets for explorable explanations

## Deployment Options

| Method | Command/Approach |
|--------|------------------|
| Local app | `marimo run notebook.py` |
| Static HTML | `marimo export html` |
| WASM (browser Python) | `marimo export html-wasm` |
| Hugging Face Spaces | Template available |
| Railway | Template available |
| Docker | Containerization supported |
| Kubernetes | marimo-operator available |

## Key Differentiators from Jupyter

| Jupyter | marimo |
|---------|--------|
| JSON format | Pure Python `.py` |
| Manual re-run cells | Automatic reactive execution |
| Hidden state issues | No hidden state |
| Widgets via ipywidgets | Native `mo.ui.*` widgets |
| Separate deployment | Built-in app mode |
