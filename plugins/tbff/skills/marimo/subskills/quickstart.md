# Marimo Quickstart

## Installation

```bash
# Basic installation
pip install marimo

# With recommended extras (SQL, AI, better autocomplete)
pip install "marimo[recommended]"

# With specific extras
pip install "marimo[sql]"     # SQL support
pip install "marimo[ai]"      # AI/LLM features
```

## CLI Reference

| Command | Description |
|---------|-------------|
| `marimo edit notebook.py` | Open notebook in browser editor |
| `marimo run notebook.py` | Run as web app (code hidden) |
| `python notebook.py` | Execute as script |
| `marimo export html notebook.py -o out.html` | Export to static HTML |
| `marimo export html-wasm notebook.py -o output_dir` | Export with WASM (browser Python, creates directory) |
| `marimo convert notebook.ipynb > notebook.py` | Convert Jupyter notebook |
| `marimo tutorial --help` | List built-in tutorials |
| `marimo tutorial intro` | Run the intro tutorial |

## Your First Notebook

Create a file `hello.py`:

```python
import marimo

app = marimo.App()

@app.cell
def _():
    import marimo as mo
    return (mo,)

@app.cell
def _(mo):
    slider = mo.ui.slider(1, 100, value=50, label="Pick a number")
    slider
    return (slider,)

@app.cell
def _(mo, slider):
    mo.md(f"**You selected:** {slider.value}")
    return

if __name__ == "__main__":
    app.run()
```

Run it:
```bash
marimo edit hello.py
```

## Cell Structure

Every cell is a function decorated with `@app.cell`:

```python
@app.cell
def _(dependency1, dependency2):
    # Cell code here
    result = dependency1 + dependency2
    return (result,)  # Tuple of variables to expose
```

**Key rules:**
- Parameters are dependencies (auto-injected)
- Return tuple exposes variables to other cells
- Underscore `_` in function name means "no name needed"
- Last expression is displayed as output

## Storage Format

Notebooks are pure Python `.py` files:
- Git-friendly (no JSON, no output blobs)
- Importable as Python modules
- Diffable and mergeable
- Executable directly with `python notebook.py`

## Next Steps

- **Add interactivity**: Read `ui-components.md`
- **Understand reactivity**: Read `reactive-execution.md`
- **Deploy your app**: Read `deployment.md`
