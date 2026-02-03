# Jupyter to Marimo Migration

## Feature Comparison

| Feature | Jupyter | marimo |
|---------|---------|--------|
| File format | JSON (`.ipynb`) | Pure Python (`.py`) |
| Execution model | Manual cell runs | Reactive (automatic) |
| Hidden state | Common problem | Impossible by design |
| Git-friendly | Poor (JSON diffs) | Excellent (Python diffs) |
| Reproducibility | Requires "Run All" | Guaranteed |
| Widgets | ipywidgets | Native `mo.ui.*` |
| Deployment | Separate tooling | Built-in `marimo run` |
| Import as module | No | Yes |

## Automatic Conversion

Convert a Jupyter notebook:

```bash
marimo convert notebook.ipynb > notebook.py
```

The converter:
- Extracts code cells as `@app.cell` functions
- Preserves markdown as `mo.md()` calls
- Maintains cell order
- Adds necessary imports

## Manual Adjustments

After conversion, you'll typically need to:

### 1. Fix Variable Dependencies

**Jupyter** (implicit globals):
```python
# Cell 1
data = load_data()

# Cell 2
print(data)  # Uses global
```

**marimo** (explicit dependencies):
```python
@app.cell
def _():
    data = load_data()
    return (data,)

@app.cell
def _(data):  # Explicit parameter
    print(data)
    return
```

### 2. Replace ipywidgets

**Jupyter** (ipywidgets):
```python
from ipywidgets import IntSlider, interact

slider = IntSlider(min=0, max=100, value=50)

@interact(x=slider)
def update(x):
    print(x)
```

**marimo** (mo.ui):
```python
@app.cell
def _(mo):
    slider = mo.ui.slider(0, 100, value=50)
    slider
    return (slider,)

@app.cell
def _(slider):
    print(slider.value)  # Reactive
    return
```

### Widget Translation Table

| ipywidgets | marimo equivalent |
|------------|-------------------|
| `IntSlider` | `mo.ui.slider` |
| `FloatSlider` | `mo.ui.slider` |
| `Text` | `mo.ui.text` |
| `Textarea` | `mo.ui.text_area` |
| `Dropdown` | `mo.ui.dropdown` |
| `Checkbox` | `mo.ui.checkbox` |
| `Button` | `mo.ui.button` |
| `FileUpload` | `mo.ui.file` |
| `DatePicker` | `mo.ui.date` |
| `Output` | Direct cell output |
| `HBox` | `mo.hstack` |
| `VBox` | `mo.vstack` |
| `Tab` | `mo.tabs` |
| `Accordion` | `mo.accordion` |

### 3. Handle Display Outputs

**Jupyter** (display function):
```python
from IPython.display import display, Markdown

display(Markdown("# Title"))
display(df)
```

**marimo** (last expression or vstack):
```python
@app.cell
def _(mo, df):
    mo.vstack([
        mo.md("# Title"),
        df
    ])
    return
```

### 4. Remove Magic Commands

**Jupyter** (magics):
```python
%matplotlib inline
%timeit function()
%%sql SELECT * FROM table
```

**marimo** (Python equivalents):
```python
# No %matplotlib needed - auto-displays

# Timing
import time
start = time.time()
function()
print(f"Took {time.time() - start:.2f}s")

# SQL
result = mo.sql("SELECT * FROM table")
```

## Migration Workflow

### Step 1: Convert

```bash
marimo convert old_notebook.ipynb > new_notebook.py
```

### Step 2: Open and Test

```bash
marimo edit new_notebook.py
```

### Step 3: Fix Issues

1. Add missing returns for shared variables
2. Add parameters for dependencies
3. Replace widgets
4. Remove magics
5. Fix display calls

### Step 4: Verify Reactivity

- Change upstream cells
- Confirm downstream cells update automatically
- Check no hidden state issues

### Step 5: Clean Up

- Remove unused imports
- Consolidate related cells
- Add markdown documentation

## Common Migration Issues

### Circular Dependencies

**Problem**: Two cells depend on each other

**Jupyter** (works due to execution order):
```python
# Cell 1
a = b + 1

# Cell 2
b = a + 1
```

**marimo** (error):
```
Error: Circular dependency detected between cells
```

**Solution**: Restructure logic
```python
@app.cell
def _():
    initial = 0
    a = initial + 1
    b = a + 1
    return (a, b)
```

### Stateful Objects

**Problem**: Objects that accumulate state

**Jupyter**:
```python
# Cell 1
results = []

# Cell 2 (run multiple times)
results.append(compute())
```

**marimo** (anti-pattern):
```python
# This doesn't work as expected in reactive model
```

**Solution**: Compute full state in one cell
```python
@app.cell
def _(iterations):
    results = [compute(i) for i in range(iterations.value)]
    return (results,)
```

### Long-Running Cells

**Problem**: Expensive cells re-run on every change

**Solution**: Use lazy execution mode
```python
app = marimo.App(lazy=True)
```

Or use `mo.stop()` to gate execution:
```python
@app.cell
def _(mo, trigger_button):
    mo.stop(not trigger_button.value)
    expensive_computation()
    return
```

## Best Practices Post-Migration

1. **Embrace reactivity**: Don't fight it, design for it
2. **Small cells**: One concept per cell
3. **Clear dependencies**: Explicit is better than implicit
4. **Use forms**: For batch inputs that shouldn't trigger on every keystroke
5. **Lazy mode**: For notebooks with expensive computations
6. **Test reproducibility**: Restart and run from scratch regularly
