# Marimo Ecosystem

## Official Packages

### marimo-blocks (@marimo-team/blocks)

React components for embedding marimo in custom applications:

```tsx
import { Provider, CellEditor, CellOutput } from "@marimo-team/blocks";

function App() {
  return (
    <Provider>
      <CellEditor
        code="import marimo as mo\nmo.md('Hello')"
        onRun={(result) => console.log(result)}
      />
      <CellOutput result={result} />
    </Provider>
  );
}
```

**Use cases:**
- Embed marimo in React dashboards
- Build custom notebook UIs
- Create interactive documentation sites

### marimo-lsp

Language Server Protocol implementation for editor integration:

- VS Code extension support
- Autocomplete for `mo.*` APIs
- Inline documentation
- Error checking

### marimo-operator

Kubernetes operator for running marimo at scale:

```bash
# Install operator
kubectl apply -f https://github.com/marimo-team/marimo-operator/releases/latest/download/install.yaml

# Deploy notebook
kubectl apply -f my-notebook.yaml
```

## Community Libraries

### mkdocs-marimo

Build reactive documentation with MkDocs:

```yaml
# mkdocs.yml
plugins:
  - marimo

# In your markdown
```marimo
import marimo as mo
mo.ui.slider(0, 100)
```
```

### mowidget

Custom widgets for common use cases:

```python
from mowidget import ColorPicker, ArrayViewer

# Color picker widget
color = ColorPicker(value="#ff0000")

# Array visualization
viewer = ArrayViewer(numpy_array)
```

### mohtml

HTML DSL for marimo:

```python
from mohtml import div, h1, p, style

div(
    h1("Title"),
    p("Paragraph with ", style("bold", font_weight="bold"), " text"),
    class_="container"
)
```

### wigglystuff

Creative widgets for explorable explanations:

```python
from wigglystuff import DraggableNumber, Scrubber

# Draggable inline number
text = f"The value is {DraggableNumber(50, min=0, max=100)}"

# Scrubbable range
scrubber = Scrubber(start=0, end=100, step=1)
```

## Third-Party Integrations

### Hugging Face

```python
from transformers import pipeline
import marimo as mo

# Use HF models in marimo
classifier = pipeline("sentiment-analysis")

@app.cell
def _(mo):
    text_input = mo.ui.text_area(placeholder="Enter text to analyze")
    text_input
    return (text_input,)

@app.cell
def _(classifier, text_input):
    if text_input.value:
        result = classifier(text_input.value)
        mo.md(f"**Sentiment:** {result[0]['label']}")
    return
```

### Weights & Biases

```python
import wandb
import marimo as mo

# Log marimo runs to W&B
wandb.init(project="marimo-experiments")

@app.cell
def _(mo, model_output):
    wandb.log({"accuracy": model_output.accuracy})
    return
```

### SageMath

```python
# marimo supports SageMath for symbolic math
from sage.all import *

@app.cell
def _():
    x = var('x')
    f = x^2 + 2*x + 1
    solve(f == 0, x)
    return
```

## Community Resources

### awesome-marimo

Curated list of marimo resources:
- Example notebooks
- Tutorials
- Extensions
- Community projects

GitHub: `github.com/marimo-team/awesome-marimo`

### Community Spotlights

32 featured community projects showcasing real-world marimo usage:

| Focus Area | Examples |
|------------|----------|
| Data Science | ML workflows, data viz |
| Scientific Computing | Physics simulations, bioinformatics |
| Education | Interactive tutorials, STEM tools |
| Finance | Trading dashboards, risk analysis |
| Web3 | Blockchain analytics, DeFi tools |

### Discord Community

Active Discord server for:
- Getting help
- Sharing projects
- Feature discussions
- Bug reports

## Extension Development

### Creating Custom Widgets

```python
import marimo as mo
from anywidget import AnyWidget
import traitlets

class MyWidget(AnyWidget):
    _esm = """
    export function render({ model, el }) {
        el.innerHTML = `<button>Click: ${model.get('count')}</button>`;
        el.querySelector('button').onclick = () => {
            model.set('count', model.get('count') + 1);
            model.save_changes();
        };
    }
    """
    count = traitlets.Int(0).tag(sync=True)

# Use in marimo
widget = mo.ui.anywidget(MyWidget())
```

### Creating Plugins

marimo plugins extend functionality:

1. Create a Python package with `marimo_` prefix
2. Register entry points in `setup.py`
3. Implement plugin interface

```python
# setup.py
entry_points={
    'marimo.plugins': [
        'my_plugin = marimo_myplugin:MyPlugin',
    ],
}
```
