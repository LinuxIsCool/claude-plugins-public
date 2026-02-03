# TBFF Data Tools

Tools and patterns for working with TBFF experiment data.

## Data Location

All data lives in `plugins/tbff/skills/tbff/data/`:

| File | Purpose | Load Pattern |
|------|---------|--------------|
| `people.json` | 37 participants with thresholds | `load_people()` |
| `networks.json` | 3 network entities | `load_networks()` |
| `experiments.json` | 12 funded experiments | `load_experiments()` |
| `pool.json` | Community pool status | `load_pool()` |
| `rules.json` | 26 simple rules | `load_rules()` |
| `schema.md` | Data documentation | Reference |

**Source**: `Scoping for MycoFi FlowFunding experiment.xlsx` (Christina Bowen)

---

## Quick Data Access

### Python Loader Module

Create this as `data/loader.py`:

```python
"""TBFF Data Loader - utilities for accessing experiment data."""

import json
from pathlib import Path
from typing import TypedDict, List

# Resolve data directory relative to this file
DATA_DIR = Path(__file__).parent

class Participant(TypedDict):
    name: str
    monthly_comfort: float
    monthly_minimum: float

class Network(TypedDict):
    name: str

class Experiment(TypedDict):
    name: str
    comfort_budget: float | None
    minimum_budget: float | None
    forward_flows: str | None

class Pool(TypedDict):
    needed_6_months: int
    current_balance: int
    runway_months: float

def load_people() -> dict:
    """Load all participants with their thresholds."""
    with open(DATA_DIR / 'people.json') as f:
        return json.load(f)

def load_networks() -> dict:
    """Load network entities."""
    with open(DATA_DIR / 'networks.json') as f:
        return json.load(f)

def load_experiments() -> dict:
    """Load funded experiments."""
    with open(DATA_DIR / 'experiments.json') as f:
        return json.load(f)

def load_pool() -> Pool:
    """Load community pool status."""
    with open(DATA_DIR / 'pool.json') as f:
        return json.load(f)

def load_rules() -> dict:
    """Load simple rules."""
    with open(DATA_DIR / 'rules.json') as f:
        return json.load(f)

def load_all() -> dict:
    """Load all data as a single dict."""
    return {
        'people': load_people(),
        'networks': load_networks(),
        'experiments': load_experiments(),
        'pool': load_pool(),
        'rules': load_rules(),
    }

# Computed metrics
def total_monthly_minimum() -> float:
    """Calculate total monthly minimum needed for all participants."""
    people = load_people()
    return sum(p['monthly_minimum'] for p in people['participants'])

def total_monthly_comfort() -> float:
    """Calculate total monthly comfort for all participants."""
    people = load_people()
    return sum(p['monthly_comfort'] for p in people['participants'])

def experiment_totals() -> dict:
    """Calculate experiment budget totals."""
    exp = load_experiments()
    return {
        'minimum_total': sum(e['minimum_budget'] or 0 for e in exp['experiments']),
        'comfort_total': sum(e['comfort_budget'] or 0 for e in exp['experiments']),
    }

def pool_health() -> dict:
    """Calculate pool health metrics."""
    pool = load_pool()
    people = load_people()
    monthly_burn = total_monthly_minimum()

    return {
        'current_balance': pool['current_balance'],
        'monthly_burn': monthly_burn,
        'runway_months': pool['current_balance'] / monthly_burn if monthly_burn > 0 else 0,
        'needed_for_6mo': monthly_burn * 6,
        'participant_count': people['count'],
        'can_add_member': pool['current_balance'] >= (monthly_burn + 3000) * 6,
    }
```

---

## CLI Data Queries

### List Participants
```bash
python3 -c "
import json
with open('plugins/tbff/skills/tbff/data/people.json') as f:
    data = json.load(f)
print(f'Participants: {data[\"count\"]}')
for p in data['participants'][:10]:
    print(f'  - {p[\"name\"]}')
print('  ...')
"
```

### Show Pool Status
```bash
python3 -c "
import json
with open('plugins/tbff/skills/tbff/data/pool.json') as f:
    pool = json.load(f)
print(f'Pool Status:')
print(f'  Needed (6mo): \${pool[\"needed_6_months\"]:,}')
print(f'  Balance: \${pool[\"current_balance\"]:,}')
print(f'  Runway: {pool[\"runway_months\"]:.1f} months')
"
```

### List Experiments with Budgets
```bash
python3 -c "
import json
with open('plugins/tbff/skills/tbff/data/experiments.json') as f:
    data = json.load(f)
print(f'Experiments: {data[\"count\"]}')
for e in data['experiments']:
    min_b = f'\${e[\"minimum_budget\"]:,.0f}' if e['minimum_budget'] else 'TBD'
    print(f'  - {e[\"name\"]}: {min_b}')
"
```

---

## Marimo Patterns

### Basic Data Cell
```python
import marimo as mo
import json

@mo.cell
def _():
    # Load data relative to notebook location
    import sys
    sys.path.insert(0, str(Path(__file__).parent.parent / 'data'))
    from loader import load_all
    return load_all()
```

### Interactive People Explorer
```python
@mo.cell
def people_explorer(data):
    people = data['people']['participants']

    # Create selector
    selected = mo.ui.dropdown(
        options=[p['name'] for p in people],
        label="Select participant"
    )

    return selected

@mo.cell
def show_participant(selected, data):
    if selected.value:
        person = next(p for p in data['people']['participants']
                     if p['name'] == selected.value)
        return mo.md(f"""
        ## {person['name']}
        - Monthly Minimum: ${person['monthly_minimum']:,}
        - Monthly Comfort: ${person['monthly_comfort']:,}
        """)
```

### Pool Health Gauge
```python
@mo.cell
def pool_gauge(data):
    pool = data['pool']
    pct = (pool['current_balance'] / pool['needed_6_months']) * 100

    return mo.md(f"""
    ## Community Pool Health

    **Balance**: ${pool['current_balance']:,}
    **Needed (6mo)**: ${pool['needed_6_months']:,}
    **Runway**: {pool['runway_months']:.1f} months

    ```
    [{('█' * int(pct/5)).ljust(20)}] {pct:.1f}%
    ```
    """)
```

---

## Data Modification Patterns

### Add Participant
```python
def add_participant(name: str, comfort: float = 6000, minimum: float = 3000):
    """Add a new participant to people.json."""
    import json

    with open('data/people.json') as f:
        data = json.load(f)

    data['participants'].append({
        'name': name,
        'monthly_comfort': comfort,
        'monthly_minimum': minimum,
    })
    data['count'] = len(data['participants'])

    with open('data/people.json', 'w') as f:
        json.dump(data, f, indent=2)

    return data
```

### Update Pool Balance
```python
def update_pool_balance(new_balance: float):
    """Update the community pool balance."""
    import json

    with open('data/pool.json') as f:
        pool = json.load(f)

    pool['current_balance'] = new_balance
    pool['runway_months'] = new_balance / (pool['needed_6_months'] / 6)

    with open('data/pool.json', 'w') as f:
        json.dump(pool, f, indent=2)

    return pool
```

---

## Simulation Helpers

### Calculate Overflow
```python
def calculate_overflow(income: float, minimum: float, comfort: float) -> dict:
    """Calculate flow-back based on TBFF mechanics."""
    if income <= minimum:
        return {'retained': income, 'flow_back': 0, 'rate': 0}
    elif income <= comfort:
        excess = income - minimum
        flow_back = excess * 0.05
        return {'retained': income - flow_back, 'flow_back': flow_back, 'rate': 0.05}
    else:
        below_comfort = comfort - minimum
        above_comfort = income - comfort
        flow_back = (below_comfort * 0.05) + (above_comfort * 0.25)
        return {'retained': income - flow_back, 'flow_back': flow_back, 'rate': 0.25}
```

### Network Flow Simulation
```python
def simulate_network_flow(inflow: float, people: list) -> dict:
    """Simulate one epoch of network flow distribution."""
    total_minimum = sum(p['monthly_minimum'] for p in people)

    if inflow < total_minimum:
        # Not enough - distribute proportionally
        return {
            'distributed': inflow,
            'pool_contribution': 0,
            'shortfall': total_minimum - inflow,
        }

    # Distribute minimums and calculate overflows
    pool_contribution = 0
    for person in people:
        allocation = person['monthly_minimum']
        overflow = calculate_overflow(allocation,
                                      person['monthly_minimum'],
                                      person['monthly_comfort'])
        pool_contribution += overflow['flow_back']

    return {
        'distributed': total_minimum,
        'pool_contribution': pool_contribution,
        'shortfall': 0,
    }
```

---

## Integration with POCs

The data files can be loaded by existing POCs:

| POC | Data Usage |
|-----|------------|
| `poc-threshold-math` | Load people.json for threshold calculations |
| `poc-network-model` | Load networks.json + people.json for graph |
| `poc-marimo-basic` | Load all data for interactive dashboard |
| `poc-d3-sankey` | Load experiments.json for flow visualization |

### Example: Sankey Data Generation
```python
def generate_sankey_data():
    """Generate Sankey diagram data from experiments."""
    exp = load_experiments()

    nodes = [{'name': 'Community Pool'}]
    links = []

    for e in exp['experiments']:
        if e['minimum_budget']:
            nodes.append({'name': e['name']})
            links.append({
                'source': 0,
                'target': len(nodes) - 1,
                'value': e['minimum_budget']
            })

    return {'nodes': nodes, 'links': links}
```

---

## Best Practices

1. **Always use loader functions** - Don't hardcode file paths
2. **Validate on load** - Check for required fields
3. **Immutable operations** - Return new data, don't mutate in place
4. **Type hints** - Use TypedDict for structure clarity
5. **Relative paths** - Use `Path(__file__).parent` pattern
