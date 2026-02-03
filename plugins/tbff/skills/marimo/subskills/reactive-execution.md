# Marimo Reactive Execution

## How Reactivity Works

Marimo builds a **dependency graph** from your code:

1. Analyzes which variables each cell uses (parameters)
2. Analyzes which variables each cell defines (returns)
3. Automatically determines execution order

```
Cell A: defines `data`
    ↓
Cell B: uses `data`, defines `filtered`
    ↓
Cell C: uses `filtered`, displays output
```

When you change Cell A, marimo automatically re-runs B and C.

## Key Guarantees

| Guarantee | Meaning |
|-----------|---------|
| **No hidden state** | Delete a cell → its variables are removed from memory |
| **Deterministic order** | Same code always runs in same order |
| **Reproducible** | Re-run from scratch gets same results |
| **No stale data** | Downstream cells always reflect upstream changes |

## Execution Order

Order is determined by **data dependencies**, not cell position:

```python
# This cell runs SECOND (depends on `x`)
@app.cell
def _(x):
    mo.md(f"x is {x}")
    return

# This cell runs FIRST (no dependencies)
@app.cell
def _():
    x = 42
    return (x,)
```

You can reorder cells visually without changing execution.

## Lazy Execution Mode

Configure runtime to mark cells as **stale** instead of auto-running:

**Enable in notebook settings** or via:
```python
app = marimo.App(lazy=True)
```

**Benefits:**
- Prevents expensive cells from running accidentally
- User manually triggers execution
- Stale cells show visual indicator
- Program state guarantees still maintained

## Conditional Execution

Use `mo.stop()` to halt execution conditionally:

```python
@app.cell
def _(mo, user_input):
    mo.stop(
        not user_input.value,
        mo.md("Please enter a value first")
    )
    # Code below only runs if user_input has a value
    process(user_input.value)
    return
```

## Debugging Reactive Flows

### See the dependency graph

The marimo editor shows which cells depend on which variables. Hover over a cell to see its dependencies.

### Isolate problematic cells

Create a test cell that only uses the specific variables you're debugging:

```python
@app.cell
def _(suspicious_variable):
    print(type(suspicious_variable))
    print(suspicious_variable)
    return
```

### Check for circular dependencies

Marimo prevents circular dependencies at parse time. If you see an error about cycles, check that you're not:
- Returning a variable that's also a parameter
- Having two cells that depend on each other

## Common Pitfalls

**1. Mutating objects in place**
```python
# BAD: Mutation doesn't trigger re-run
@app.cell
def _(data):
    data.append(item)  # data's identity unchanged
    return

# GOOD: Create new object
@app.cell
def _(data):
    new_data = data + [item]
    return (new_data,)
```

**2. Side effects without dependencies**
```python
# BAD: This won't re-run when file changes
@app.cell
def _():
    data = pd.read_csv("data.csv")
    return (data,)

# GOOD: Use mo.ui.file for user-controlled file input
```

**3. Using global state**
```python
# BAD: Modifying globals breaks reproducibility
COUNTER = 0

@app.cell
def _():
    global COUNTER
    COUNTER += 1  # Hidden state!

# GOOD: Use cell returns for state
```
