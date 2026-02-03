# TBFF Notebooks

Guide for managing Marimo notebooks in the TBFF skill.

## Location

All notebooks live in `plugins/tbff/skills/tbff/notebooks/`:

```
notebooks/
├── 01-data-exploration.py      # Explore the experiment data
├── 02-threshold-simulator.py   # Interactive threshold mechanics
├── 03-network-flow.py          # Network flow visualization
└── ...
```

## Notebook Naming Convention

Format: `##-descriptive-name.py`

| Prefix | Category | Examples |
|--------|----------|----------|
| `01-09` | Data exploration | `01-data-exploration.py` |
| `10-19` | Mechanism simulation | `10-threshold-simulator.py` |
| `20-29` | Visualization | `20-sankey-flows.py` |
| `30-39` | Analysis | `30-runway-projections.py` |
| `40-49` | Experiments | `40-new-member-impact.py` |

## Running Notebooks

### Local Development
```bash
cd plugins/tbff/skills/tbff
marimo edit notebooks/01-data-exploration.py
```

### View Mode (Read-only)
```bash
marimo run notebooks/01-data-exploration.py
```

### Export to HTML (WASM)
```bash
marimo export html-wasm notebooks/01-data-exploration.py -o notebooks/01-data-exploration.html
```

## Data Access Pattern

All notebooks should use the loader module:

```python
import marimo as mo
import sys
from pathlib import Path

# Add data directory to path
sys.path.insert(0, str(Path(__file__).parent.parent / 'data'))
from loader import load_all, pool_health, calculate_overflow
```

## Notebook Template

```python
import marimo

__generated_with = "0.10.19"
app = marimo.App(width="medium")

@app.cell
def setup():
    """Setup cell - imports and data loading."""
    import marimo as mo
    import sys
    from pathlib import Path

    # Data access
    sys.path.insert(0, str(Path(__file__).parent.parent / 'data'))
    from loader import load_all, pool_health

    data = load_all()
    return data, mo, pool_health

@app.cell
def header(mo):
    """Header cell."""
    mo.md('''
    # Notebook Title

    Description of what this notebook explores.
    ''')
    return

@app.cell
def main_content(data, mo):
    """Main content cell."""
    people = data['people']

    mo.md(f'''
    ## Data Summary

    - **Participants**: {people['count']}
    - **Networks**: {data['networks']['count']}
    - **Experiments**: {data['experiments']['count']}
    ''')
    return

if __name__ == "__main__":
    app.run()
```

## Integration with POCs

The notebooks complement existing POCs:

| Notebook | Related POC | Purpose |
|----------|-------------|---------|
| `01-data-exploration.py` | - | Deep dive into raw data |
| `02-threshold-simulator.py` | `poc-threshold-math` | Interactive threshold testing |
| `03-network-flow.py` | `poc-network-model` | Flow simulation |

## Best Practices

### 1. Cell Independence
Each cell should be independently runnable:
```python
@app.cell
def analysis(data):
    # Cell has all dependencies in signature
    result = sum(p['monthly_minimum'] for p in data['people']['participants'])
    return result
```

### 2. Use mo.ui for Interactivity
```python
@app.cell
def controls(mo):
    threshold = mo.ui.slider(1000, 10000, value=3000, label="Minimum Threshold")
    return threshold

@app.cell
def result(threshold, data):
    # Threshold reactively updates this cell
    affected = sum(1 for p in data['people']['participants']
                   if p['monthly_minimum'] >= threshold.value)
    return mo.md(f"**{affected}** participants at or above ${threshold.value:,}")
```

### 3. Visualization Patterns
```python
@app.cell
def viz(data, mo):
    import altair as alt
    import pandas as pd

    df = pd.DataFrame(data['people']['participants'])

    chart = alt.Chart(df).mark_bar().encode(
        x='name:N',
        y='monthly_minimum:Q'
    ).properties(width=600)

    return mo.ui.altair_chart(chart)
```

### 4. Data Modification Warning
If a notebook modifies data files, add a warning:
```python
@app.cell
def warning(mo):
    mo.callout(
        "This notebook modifies data files. Changes persist to disk.",
        kind="warn"
    )
    return
```

## Workflow: Developing a New Notebook

1. **Create from template**:
   ```bash
   cp notebooks/template.py notebooks/XX-new-notebook.py
   ```

2. **Edit interactively**:
   ```bash
   marimo edit notebooks/XX-new-notebook.py
   ```

3. **Test in run mode**:
   ```bash
   marimo run notebooks/XX-new-notebook.py
   ```

4. **Export for sharing**:
   ```bash
   marimo export html-wasm notebooks/XX-new-notebook.py -o exports/XX-new-notebook.html
   ```

## Agent Support

Use `tbff:marimo-specialist` for:
- Notebook architecture questions
- UI widget selection
- Reactive pattern design
- WASM deployment

Use `tbff:systems-data-scientist` for:
- Data analysis logic
- Simulation algorithms
- Visualization design
