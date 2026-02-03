# Progressive Disclosure: 3-Layer Search Workflow

## Purpose

Implement token-efficient memory retrieval using the progressive disclosure pattern. This approach achieves approximately 10x token savings by filtering before fetching full details.

## Variables

| Variable | Value | Description |
|----------|-------|-------------|
| `LAYER_1_TOKENS` | `50-100` | Tokens per result in search index |
| `LAYER_2_TOKENS` | `100-200` | Tokens per result in timeline view |
| `LAYER_3_TOKENS` | `500-1000` | Tokens per full observation |
| `SAVINGS_FACTOR` | `~10x` | Token efficiency vs. naive full fetch |

## Instructions

### The Problem

Naive memory retrieval fetches full details for all results:

```
Search "authentication" → 20 results × 800 tokens = 16,000 tokens
```

Most of these details are irrelevant to the current task.

### The Solution

Progressive disclosure filters at each layer:

```
Layer 1: Search → 20 IDs × 75 tokens   = 1,500 tokens
Layer 2: Timeline → 5 IDs × 150 tokens =   750 tokens
Layer 3: Fetch → 2 IDs × 800 tokens    = 1,600 tokens
                                   Total: 3,850 tokens

Savings: 16,000 - 3,850 = 12,150 tokens (76% reduction)
```

### The 3-Layer Workflow

```
┌─────────────────────────────────────────────────────────────┐
│ LAYER 1: SEARCH                                              │
│ Get compact index with IDs and titles (~50-100 tokens/result)│
│                                                              │
│ search(query="authentication", limit=20)                     │
│ Returns: ID | Date | Type | Title                            │
│          123 | Jan 14 | bug | Fixed auth token refresh       │
│          456 | Jan 12 | feat | Added OAuth2 support          │
│          789 | Jan 10 | disc | Explored PKCE flow            │
└─────────────────────────────────────────────────────────────┘
                              ↓
                     Filter to interesting IDs
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ LAYER 2: TIMELINE                                            │
│ Get chronological context around results (~100-200 tokens)   │
│                                                              │
│ timeline(anchor=123, depth_before=3, depth_after=3)          │
│ Returns: What was happening before and after observation 123 │
└─────────────────────────────────────────────────────────────┘
                              ↓
                     Identify truly relevant IDs
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ LAYER 3: FETCH                                               │
│ Get full details ONLY for filtered IDs (~500-1000 tokens)    │
│                                                              │
│ get_observations(ids=[123, 456])                             │
│ Returns: Full facts, narrative, files, concepts              │
└─────────────────────────────────────────────────────────────┘
```

## Code Examples

### MCP Tools Interface

The claude-mem MCP server exposes 4 tools:

```typescript
// Tool 1: __IMPORTANT (workflow documentation, always visible)
// Tool 2: search
// Tool 3: timeline
// Tool 4: get_observations

const tools = [
  {
    name: '__IMPORTANT',
    description: `3-LAYER WORKFLOW (ALWAYS FOLLOW):
1. search(query) → Get index with IDs (~50-100 tokens/result)
2. timeline(anchor=ID) → Get context around interesting results
3. get_observations([IDs]) → Fetch full details ONLY for filtered IDs
NEVER fetch full details without filtering first. 10x token savings.`
  },
  {
    name: 'search',
    description: 'Step 1: Search memory. Returns index with IDs.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        limit: { type: 'number', description: 'Max results (default: 20)' },
        project: { type: 'string', description: 'Filter by project' },
        type: { type: 'string', description: 'Filter by type (observations/sessions/prompts)' },
        obs_type: { type: 'string', description: 'Filter by observation type' },
        dateStart: { type: 'string', description: 'Filter from date (ISO)' },
        dateEnd: { type: 'string', description: 'Filter to date (ISO)' }
      }
    }
  },
  {
    name: 'timeline',
    description: 'Step 2: Get context around results.',
    inputSchema: {
      type: 'object',
      properties: {
        anchor: { type: 'number', description: 'Observation ID to center on' },
        query: { type: 'string', description: 'OR find anchor automatically' },
        depth_before: { type: 'number', description: 'Records before anchor' },
        depth_after: { type: 'number', description: 'Records after anchor' },
        project: { type: 'string', description: 'Filter by project' }
      }
    }
  },
  {
    name: 'get_observations',
    description: 'Step 3: Fetch full details for filtered IDs.',
    inputSchema: {
      type: 'object',
      properties: {
        ids: {
          type: 'array',
          items: { type: 'number' },
          description: 'Array of observation IDs to fetch (required)'
        }
      },
      required: ['ids']
    }
  }
];
```

### HTTP API Usage

```bash
# Layer 1: Search for index
curl "http://127.0.0.1:37777/api/search?query=authentication&limit=20"

# Response format:
# | ID | Date | Type | Title |
# |-----|------|------|-------|
# | 123 | Jan 14 | bugfix | Fixed auth token refresh |
# | 456 | Jan 12 | feature | Added OAuth2 support |

# Layer 2: Get timeline context
curl "http://127.0.0.1:37777/api/timeline?anchor=123&depth_before=3&depth_after=3"

# Layer 3: Fetch full details (POST with JSON body)
curl -X POST "http://127.0.0.1:37777/api/observations/batch" \
  -H "Content-Type: application/json" \
  -d '{"ids": [123, 456]}'
```

### TypeScript Client Implementation

```typescript
import { getWorkerPort } from '../shared/worker-utils.js';

const WORKER_BASE_URL = `http://127.0.0.1:${getWorkerPort()}`;

interface SearchResult {
  id: number;
  date: string;
  type: string;
  title: string;
}

interface TimelineResult {
  anchor: number;
  before: SearchResult[];
  after: SearchResult[];
}

interface Observation {
  id: number;
  type: string;
  title: string;
  subtitle: string;
  facts: string[];
  narrative: string;
  concepts: string[];
  files_read: string[];
  files_modified: string[];
  created_at: string;
}

class ProgressiveSearch {
  /**
   * Layer 1: Get compact search index
   */
  async search(query: string, options: {
    limit?: number;
    project?: string;
    type?: string;
    obs_type?: string;
    dateStart?: string;
    dateEnd?: string;
  } = {}): Promise<SearchResult[]> {
    const params = new URLSearchParams({ query, ...options as any });
    const response = await fetch(`${WORKER_BASE_URL}/api/search?${params}`);

    if (!response.ok) {
      throw new Error(`Search failed: ${response.status}`);
    }

    const data = await response.json();
    return data.content.map((item: any) => ({
      id: item.id,
      date: item.date,
      type: item.type,
      title: item.title
    }));
  }

  /**
   * Layer 2: Get timeline context around a result
   */
  async timeline(anchor: number, options: {
    depth_before?: number;
    depth_after?: number;
    project?: string;
  } = {}): Promise<TimelineResult> {
    const params = new URLSearchParams({
      anchor: String(anchor),
      depth_before: String(options.depth_before ?? 5),
      depth_after: String(options.depth_after ?? 5),
      ...(options.project && { project: options.project })
    });

    const response = await fetch(`${WORKER_BASE_URL}/api/timeline?${params}`);

    if (!response.ok) {
      throw new Error(`Timeline failed: ${response.status}`);
    }

    return await response.json();
  }

  /**
   * Layer 3: Fetch full observation details
   */
  async getObservations(ids: number[]): Promise<Observation[]> {
    const response = await fetch(`${WORKER_BASE_URL}/api/observations/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids })
    });

    if (!response.ok) {
      throw new Error(`Fetch observations failed: ${response.status}`);
    }

    return await response.json();
  }

  /**
   * Full progressive disclosure workflow
   */
  async progressiveSearch(
    query: string,
    relevanceFilter: (results: SearchResult[]) => number[]
  ): Promise<Observation[]> {
    // Layer 1: Search
    const searchResults = await this.search(query, { limit: 20 });

    if (searchResults.length === 0) {
      return [];
    }

    // User-defined filtering
    const relevantIds = relevanceFilter(searchResults);

    if (relevantIds.length === 0) {
      return [];
    }

    // Layer 2: Timeline (optional, for context)
    // Get timeline around most relevant result
    const timeline = await this.timeline(relevantIds[0]);

    // Layer 3: Fetch full details
    return await this.getObservations(relevantIds);
  }
}
```

## Common Patterns

### Pattern 1: Simple Query

For straightforward queries, the workflow is linear:

```typescript
// User asks: "What authentication bugs did I fix?"

// 1. Search
const results = await search("authentication bug fix", { obs_type: "bugfix" });
// Returns: 5 results with IDs [123, 456, 789, 012, 345]

// 2. User/Claude reviews titles, selects relevant ones
const selectedIds = [123, 456]; // Most relevant based on titles

// 3. Fetch details
const details = await getObservations(selectedIds);
// Now have full context for the 2 most relevant bugs
```

### Pattern 2: Context-Aware Query

When temporal context matters:

```typescript
// User asks: "What was I working on when I fixed the auth bug?"

// 1. Search for the auth bug
const results = await search("auth bug fix");
const authBugId = results[0].id; // 123

// 2. Get timeline around it
const timeline = await timeline(authBugId, {
  depth_before: 5,
  depth_after: 3
});
// Shows what happened before and after the fix

// 3. Fetch full details of interesting context
const contextIds = [
  ...timeline.before.filter(r => r.type === 'discovery').map(r => r.id),
  authBugId
];
const details = await getObservations(contextIds);
```

### Pattern 3: Semantic Shortcuts

For common query patterns, use semantic endpoints:

```typescript
// Instead of: search(query="decision", obs_type="decision")
// Use: /api/decisions
const decisions = await fetch(`${BASE_URL}/api/decisions?limit=10`);

// Instead of: search(query="change", obs_type="feature")
// Use: /api/changes
const changes = await fetch(`${BASE_URL}/api/changes?limit=10`);

// Instead of: search(query="how it works", obs_type="discovery")
// Use: /api/how-it-works
const explanations = await fetch(`${BASE_URL}/api/how-it-works?limit=10`);
```

### Pattern 4: Project Filtering

Scope searches to specific projects:

```typescript
// Search within current project only
const results = await search("authentication", {
  project: "claude-mem",
  limit: 20
});

// Search across all projects (omit project parameter)
const allResults = await search("authentication", { limit: 50 });
```

## Token Economics

### Calculation Model

```typescript
interface TokenEstimate {
  layer1_per_result: number;  // ~75 tokens
  layer2_per_result: number;  // ~150 tokens
  layer3_per_result: number;  // ~800 tokens
}

function estimateTokens(
  searchResults: number,
  timelineResults: number,
  fetchedDetails: number
): number {
  const layer1 = searchResults * 75;
  const layer2 = timelineResults * 150;
  const layer3 = fetchedDetails * 800;
  return layer1 + layer2 + layer3;
}

// Example: Search 20, timeline 5, fetch 2
// = 20*75 + 5*150 + 2*800
// = 1500 + 750 + 1600
// = 3,850 tokens

// Naive approach: Fetch all 20
// = 20 * 800 = 16,000 tokens

// Savings: 16,000 - 3,850 = 12,150 tokens (76%)
```

### When to Skip Layers

- **Skip Layer 2** when query results are already well-filtered
- **Fetch fewer** when only one or two results are relevant
- **Fetch more** when building comprehensive context

## Best Practices

### 1. Always Start with Search

Never call `get_observations` without first searching:

```typescript
// BAD: Direct fetch without filtering
const observations = await getObservations([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

// GOOD: Search first, then fetch relevant
const results = await search(query);
const relevantIds = selectRelevant(results); // User/Claude filtering
const observations = await getObservations(relevantIds);
```

### 2. Batch Fetches

Always batch multiple ID fetches:

```typescript
// BAD: Multiple single fetches
for (const id of ids) {
  const obs = await getObservation(id); // Multiple round-trips
}

// GOOD: Single batch fetch
const observations = await getObservations(ids); // One round-trip
```

### 3. Use Type Filters

Narrow results at search time:

```typescript
// Broader search (more filtering needed)
const results = await search("error");

// Narrower search (pre-filtered)
const bugfixes = await search("error", { obs_type: "bugfix" });
```

## See Also

- [hook-patterns.md](./hook-patterns.md) - How observations are captured
- [worker-service.md](./worker-service.md) - HTTP API documentation
- [biomimetic-mode.md](./biomimetic-mode.md) - Memory decay for extended sessions
