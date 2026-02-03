# Marimo Data Integration

## SQL Support

Query DataFrames directly with SQL:

```python
@app.cell
def _(mo, customers_df, orders_df):
    result = mo.sql("""
        SELECT
            c.name,
            COUNT(o.id) as order_count,
            SUM(o.amount) as total_spent
        FROM customers_df c
        LEFT JOIN orders_df o ON c.id = o.customer_id
        GROUP BY c.name
        ORDER BY total_spent DESC
    """)
    return (result,)
```

### SQL Data Sources

| Source | How to Query |
|--------|--------------|
| Pandas DataFrame | Use variable name directly in SQL |
| Polars DataFrame | Use variable name directly in SQL |
| DuckDB | Connect via `duckdb.connect()` |
| SQLite | Use `sqlite3` connection |
| PostgreSQL | Use `psycopg2` or `sqlalchemy` |
| CSV files | Load first, then query |
| Parquet files | Load first, then query |

### SQL with Parameters

```python
@app.cell
def _(mo, df, threshold):
    result = mo.sql(f"""
        SELECT * FROM df
        WHERE value > {threshold.value}
    """)
    return (result,)
```

## DataFrame Integration

### Pandas

```python
@app.cell
def _():
    import pandas as pd

    df = pd.read_csv("data.csv")
    df  # Auto-displayed as table
    return (df,)
```

### Polars

```python
@app.cell
def _():
    import polars as pl

    df = pl.read_csv("data.csv")
    df  # Auto-displayed
    return (df,)
```

### Interactive DataFrames

```python
@app.cell
def _(mo, df):
    # Filterable, sortable DataFrame viewer
    viewer = mo.ui.dataframe(df)
    viewer
    return (viewer,)

@app.cell
def _(viewer):
    # Get filtered DataFrame
    filtered_df = viewer.value
    return (filtered_df,)
```

## File Loading

### User File Upload

```python
@app.cell
def _(mo):
    file_input = mo.ui.file(
        kind="text",  # or "binary", "dataframe"
        multiple=False,
    )
    file_input
    return (file_input,)

@app.cell
def _(file_input):
    if file_input.value:
        content = file_input.value[0].contents
        # Process content
    return
```

### Direct File Loading

```python
@app.cell
def _():
    import pandas as pd

    # CSV
    df = pd.read_csv("data.csv")

    # Parquet
    df = pd.read_parquet("data.parquet")

    # JSON
    df = pd.read_json("data.json")

    # Excel
    df = pd.read_excel("data.xlsx")

    return (df,)
```

## Database Connections

### DuckDB (Recommended for Analytics)

```python
@app.cell
def _():
    import duckdb

    conn = duckdb.connect()

    # Query CSV directly
    result = conn.execute("""
        SELECT * FROM 'data.csv'
        WHERE amount > 100
    """).df()

    return (result,)
```

### SQLite

```python
@app.cell
def _():
    import sqlite3
    import pandas as pd

    conn = sqlite3.connect("database.db")
    df = pd.read_sql("SELECT * FROM users", conn)
    conn.close()

    return (df,)
```

### PostgreSQL

```python
@app.cell
def _():
    from sqlalchemy import create_engine
    import pandas as pd

    engine = create_engine("postgresql://user:pass@host/db")
    df = pd.read_sql("SELECT * FROM users", engine)

    return (df,)
```

## External Data Sources

### Google Sheets

```python
@app.cell
def _():
    import pandas as pd

    # Public sheet
    sheet_url = "https://docs.google.com/spreadsheets/d/SHEET_ID/export?format=csv"
    df = pd.read_csv(sheet_url)

    return (df,)
```

### APIs

```python
@app.cell
def _():
    import requests
    import pandas as pd

    response = requests.get("https://api.example.com/data")
    df = pd.DataFrame(response.json())

    return (df,)
```

## Data Processing Patterns

### Chained Transformations

```python
@app.cell
def _(df):
    processed = (
        df
        .query("value > 0")
        .assign(doubled=lambda x: x.value * 2)
        .groupby("category")
        .agg({"doubled": "sum"})
    )
    return (processed,)
```

### Reactive Data Pipelines

```python
# Cell 1: Load data
@app.cell
def _():
    raw_data = load_data()
    return (raw_data,)

# Cell 2: Filter (depends on raw_data and filter_widget)
@app.cell
def _(raw_data, filter_widget):
    filtered = raw_data[raw_data.category == filter_widget.value]
    return (filtered,)

# Cell 3: Aggregate (depends on filtered)
@app.cell
def _(filtered):
    aggregated = filtered.groupby("date").sum()
    return (aggregated,)

# Cell 4: Visualize (depends on aggregated)
@app.cell
def _(aggregated):
    aggregated.plot()
    return
```
