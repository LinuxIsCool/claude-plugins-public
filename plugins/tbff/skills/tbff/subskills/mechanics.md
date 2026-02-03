# TBFF Mechanics

## The Spreadsheet Constraints

Christina's breakthrough: Constrain the experiment with rules that ensure abundance can only grow at the rate it expands.

### Core Parameters

| Parameter | Description | Example Value |
|-----------|-------------|---------------|
| **Minimum Threshold** | Per-person floor for basic needs | $3,000/month |
| **Comfort Threshold** | Above minimum, where overflow begins | User-defined |
| **Community Pool** | Must maintain 6 months runway at minimum for all | Calculated |
| **Flow-back Rate (below comfort)** | When above minimum but below comfort | 5% |
| **Flow-back Rate (above comfort)** | When exceeding comfort, flowing everything forward | 25% |

### The Overflow Mechanic

Each node is a **bucket with a hole**:

```
    [Inflow]
       ↓
   ┌───────┐
   │       │ ← Comfort threshold
   │       │
   │───────│ ← Minimum threshold
   │       │
   └───┬───┘
       ↓
   [Overflow to other buckets]
```

1. Money flows in
2. Bucket fills toward minimum threshold
3. Once minimum is met, 5% flows back to community pool
4. Once comfort threshold is met, 25% flows back
5. Overflow can go to other individuals, pools, or forward to other groups

### Payment Cycles

- Batched transactions work fine for the experiment
- Before each cycle (e.g., 15th of the month), people adjust their **sliders**
- Sliders control allocation percentages to various destinations
- In ideal implementation: continuous streaming via Superfluid

### Network Growth Rules

**The Waiting List Function**:
- New people can only be invited when pool has runway for them
- If pool shrinks dangerously, everyone's minimum drops as early warning
- Prevents chaotic expansion or popularity contests
- Growth is metered based on actual abundance

**Why this matters**:
> "If you can actually create conditions for abundance and only grow at the rate the abundance can expand, you have a chance of including more people at a very metered rate based on having runway to add another person."

### Funders as Participants

Key insight: Funders sit at the table, not above it.
- They set their own minimums and maximums
- They participate like everyone else
- They can have their own experiments (impact assessment, storytelling)
- This breaks the typical funder-as-overlord dynamic

### Three-Layer Minimum

For complex emergence to work at team level:
- ~21 people before teams-of-teams dynamics become necessary
- Three layers: individuals → teams → federation
- Each layer has its own rules and membranes

## Implementation Considerations

### For the Demo

Focus on visualizing:
1. **The network topology** - Who's connected to whom
2. **The flow dynamics** - Money moving through thresholds
3. **The slider interface** - How individuals adjust allocations
4. **The pool health** - Runway calculations

### Technical Options

| Approach | Good For |
|----------|----------|
| **Sankey Diagram** | Showing flow magnitudes |
| **Network Graph** | Showing relationships |
| **Dashboard Sliders** | Individual allocation control |
| **Time Series** | Pool runway projections |

### Superfluid Concepts

For future implementation:
- Streams instead of batched payments
- Real-time flow rates
- Automatic threshold enforcement via smart contracts
- On-chain transparency

### The "Hole in Bucket" Dynamic

Dylan's key phrase. Every node:
- Has inflow
- Fills to a point
- Automatically overflows to configured destinations
- The configuration is the governance

## Key Questions for Design

1. How do we visualize flows without overwhelming?
2. How do we make threshold-setting intuitive?
3. How do we show pool health at a glance?
4. How do we prevent the waiting list from feeling exclusionary?
5. How do we balance transparency with privacy?

## Simplest Possible Implementation

Shawn's goal: "The simplest possible implementation that covers all the bases."

Minimum viable features:
1. Set your minimum and comfort thresholds
2. See inflow and outflow
3. Adjust allocation sliders
4. See community pool runway
5. Understand your place in the network
