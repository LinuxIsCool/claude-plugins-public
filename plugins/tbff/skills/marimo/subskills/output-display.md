# Marimo Output & Display

## Basic Output

The last expression in a cell is automatically displayed:

```python
@app.cell
def _():
    "Hello, world!"  # Displayed as output
    return
```

## Markdown

Dynamic markdown with Python f-strings:

```python
@app.cell
def _(mo, value):
    mo.md(f"""
    # Results

    The computed value is **{value}**.

    - Item 1: {items[0]}
    - Item 2: {items[1]}
    """)
    return
```

### Markdown with Embedded Widgets

```python
@app.cell
def _(mo):
    slider = mo.ui.slider(0, 100)

    mo.md(f"""
    Adjust the value: {slider}

    Current: **{slider.value}**
    """)
    return (slider,)
```

## HTML Output

For custom HTML:

```python
@app.cell
def _(mo):
    mo.Html("""
    <div style="background: #f0f0f0; padding: 20px;">
        <h2>Custom HTML</h2>
        <p>Any valid HTML here</p>
    </div>
    """)
    return
```

## Layout Components

### Vertical Stack

```python
mo.vstack([
    element1,
    element2,
    element3,
], gap=2)  # Gap in spacing units
```

### Horizontal Stack

```python
mo.hstack([
    element1,
    element2,
], justify="space-between")
```

### Grid

```python
mo.grid([
    [cell_1_1, cell_1_2],
    [cell_2_1, cell_2_2],
], widths="equal")
```

### Accordion

```python
mo.accordion({
    "Section 1": content1,
    "Section 2": content2,
    "Section 3": content3,
})
```

### Tabs

```python
mo.tabs({
    "Tab A": content_a,
    "Tab B": content_b,
    "Tab C": content_c,
})
```

### Sidebar

```python
mo.sidebar([
    mo.md("## Navigation"),
    mo.ui.button("Home"),
    mo.ui.button("Settings"),
])
```

## Callouts

```python
# Info callout (default)
mo.callout("This is informational", kind="info")

# Warning callout
mo.callout("Be careful!", kind="warn")

# Danger callout
mo.callout("Error occurred", kind="danger")

# Success callout
mo.callout("Operation completed", kind="success")
```

## Progress & Status

```python
# Progress bar
mo.progress(0.75)  # 75%

# Spinner
mo.spinner()

# Status indicator
mo.status("Processing...", kind="loading")
```

## Visualization Integration

Marimo auto-displays common visualization libraries:

### Matplotlib

```python
@app.cell
def _():
    import matplotlib.pyplot as plt

    fig, ax = plt.subplots()
    ax.plot([1, 2, 3], [1, 4, 9])
    fig  # Auto-displayed
    return
```

### Plotly

```python
@app.cell
def _():
    import plotly.express as px

    fig = px.scatter(df, x="x", y="y")
    fig  # Interactive plot
    return
```

### Altair

```python
@app.cell
def _():
    import altair as alt

    chart = alt.Chart(df).mark_point().encode(
        x='x',
        y='y'
    )
    chart
    return
```

## Conditional Display

Use `mo.stop()` to conditionally halt rendering:

```python
@app.cell
def _(mo, data):
    mo.stop(
        data is None,
        mo.callout("No data loaded", kind="warn")
    )

    # Only reaches here if data exists
    mo.md(f"Loaded {len(data)} records")
    return
```

## Multiple Outputs

Display multiple items from one cell:

```python
@app.cell
def _(mo):
    mo.vstack([
        mo.md("## Title"),
        table,
        chart,
        mo.md("## Footer"),
    ])
    return
```

## Raw Output

For debugging, use plain print:

```python
@app.cell
def _(data):
    print(type(data))  # Goes to console
    print(data.shape)
    return
```
