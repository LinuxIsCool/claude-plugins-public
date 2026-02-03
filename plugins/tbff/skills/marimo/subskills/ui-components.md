# Marimo UI Components

All UI components are in the `mo.ui` namespace.

## Widget Reference

### Input Widgets

| Widget | Example | Description |
|--------|---------|-------------|
| `mo.ui.slider(start, stop, value, label)` | `mo.ui.slider(0, 100, value=50)` | Numeric slider |
| `mo.ui.number(start, stop, value)` | `mo.ui.number(0, 100, value=50)` | Numeric input field |
| `mo.ui.text(value, placeholder)` | `mo.ui.text(placeholder="Name")` | Single-line text |
| `mo.ui.text_area(value)` | `mo.ui.text_area()` | Multi-line text |
| `mo.ui.checkbox(value, label)` | `mo.ui.checkbox(label="Enable")` | Boolean toggle |
| `mo.ui.switch(value, label)` | `mo.ui.switch(label="On/Off")` | Toggle switch |

### Selection Widgets

| Widget | Example | Description |
|--------|---------|-------------|
| `mo.ui.dropdown(options, value)` | `mo.ui.dropdown(["a", "b", "c"])` | Single selection |
| `mo.ui.multiselect(options)` | `mo.ui.multiselect(["a", "b"])` | Multiple selection |
| `mo.ui.radio(options, value)` | `mo.ui.radio(["yes", "no"])` | Radio buttons |
| `mo.ui.date(value)` | `mo.ui.date()` | Date picker |
| `mo.ui.date_range()` | `mo.ui.date_range()` | Date range picker |

### Data Widgets

| Widget | Example | Description |
|--------|---------|-------------|
| `mo.ui.table(data)` | `mo.ui.table(df)` | Interactive data table |
| `mo.ui.dataframe(df)` | `mo.ui.dataframe(df)` | DataFrame viewer with filtering |
| `mo.ui.file(kind)` | `mo.ui.file(kind="text")` | File upload |

### Advanced Widgets

| Widget | Example | Description |
|--------|---------|-------------|
| `mo.ui.button(label, on_click)` | `mo.ui.button("Click me")` | Clickable button |
| `element.form()` | `slider.form()` | Wrap in submit form (chain method) |
| `mo.ui.array(elements)` | `mo.ui.array([s1, s2])` | Array of widgets |
| `mo.ui.dictionary(elements)` | `mo.ui.dictionary({"a": s1})` | Dict of widgets |
| `mo.ui.chat(model)` | `mo.ui.chat(fn)` | Chat interface (fn is a chatbot function) |

## Usage Patterns

### Basic Widget Usage

```python
@app.cell
def _(mo):
    slider = mo.ui.slider(1, 100, value=50, label="Value")
    slider  # Display the widget
    return (slider,)

@app.cell
def _(slider):
    # Access value - this cell re-runs when slider changes
    print(slider.value)
    return
```

### Combining Widgets

```python
@app.cell
def _(mo):
    controls = mo.vstack([
        mo.ui.slider(0, 100, label="X"),
        mo.ui.slider(0, 100, label="Y"),
        mo.ui.dropdown(["red", "blue", "green"], label="Color"),
    ])
    controls
    return (controls,)
```

### Forms for Batch Submission

```python
@app.cell
def _(mo):
    # Use .form() method to wrap batched widgets - values only update on submit
    form = (
        mo.md('''
        **Settings**

        Name: {name}

        Age: {age}
        ''')
        .batch(
            name=mo.ui.text(placeholder="Your name"),
            age=mo.ui.number(0, 120, value=25),
        )
        .form()  # Chain .form() method
    )
    form
    return (form,)

@app.cell
def _(form):
    # Only runs when form is submitted
    if form.value:
        print(f"Name: {form.value['name']}, Age: {form.value['age']}")
    return
```

### Dynamic Widget Arrays

```python
@app.cell
def _(mo):
    # Create array of sliders
    sliders = mo.ui.array([
        mo.ui.slider(0, 100, label=f"Slider {i}")
        for i in range(5)
    ])
    sliders
    return (sliders,)

@app.cell
def _(sliders):
    # Access all values
    values = [s.value for s in sliders.value]
    print(f"Sum: {sum(values)}")
    return
```

### Interactive Tables

```python
@app.cell
def _(mo, df):
    # Selectable table
    table = mo.ui.table(
        df,
        selection="multi",  # or "single"
        pagination=True,
    )
    table
    return (table,)

@app.cell
def _(table):
    # Get selected rows
    selected = table.value
    print(f"Selected {len(selected)} rows")
    return
```

## Widget State

- All widgets have a `.value` property
- Widgets are **immutable** - changing `.value` creates a new widget
- To update a widget, create a new one in the same cell
- Widget changes trigger reactive re-execution of dependent cells

## Styling Widgets

```python
# Add CSS classes
slider = mo.ui.slider(0, 100).style({"width": "200px"})

# Conditional styling
button = mo.ui.button(
    "Submit",
    kind="success",  # or "danger", "warn", "neutral"
)
```
