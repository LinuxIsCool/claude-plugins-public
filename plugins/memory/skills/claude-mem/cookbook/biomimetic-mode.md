# Biomimetic Mode: Endless Mode with Memory Decay

## Purpose

Implement natural memory decay patterns for extended sessions. Biomimetic mode mimics biological memory systems where recent memories have higher relevance and older memories naturally fade, enabling sustained operation without context window overflow.

## Variables

| Variable | Value | Description |
|----------|-------|-------------|
| `DECAY_HALF_LIFE_HOURS` | `24` | Time for memory relevance to decay by 50% |
| `RECENT_THRESHOLD_HOURS` | `1` | Memories newer than this get full weight |
| `ARCHIVE_THRESHOLD_HOURS` | `168` | (7 days) Memories older than this are archive-only |
| `BASE_RELEVANCE_WEIGHT` | `1.0` | Starting weight for new memories |
| `MIN_RELEVANCE_THRESHOLD` | `0.1` | Minimum weight before archival |

## Instructions

### The Problem

Standard memory retrieval treats all memories equally:

```
All 1000 memories compete equally for context space
→ Old, irrelevant memories crowd out recent work
→ Context window fills with stale information
→ Extended sessions become unwieldy
```

### The Solution

Biomimetic decay naturally prioritizes recent, relevant memories:

```
Recent memories (< 1 hour):  Weight 1.0 (immediate access)
Recent memories (< 24 hours): Weight 0.5-1.0 (high priority)
Older memories (1-7 days):   Weight 0.1-0.5 (available on demand)
Archive (> 7 days):          Weight < 0.1 (explicit retrieval only)
```

### Memory Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ WORKING MEMORY (< 1 hour)                                    │
│ • Full weight (1.0)                                          │
│ • Always included in context                                 │
│ • Immediate, detailed recall                                 │
├─────────────────────────────────────────────────────────────┤
│ SHORT-TERM MEMORY (1-24 hours)                               │
│ • Exponential decay (0.5-1.0)                                │
│ • Included based on relevance scoring                        │
│ • Good recall with semantic matching                         │
├─────────────────────────────────────────────────────────────┤
│ LONG-TERM MEMORY (1-7 days)                                  │
│ • Continued decay (0.1-0.5)                                  │
│ • Requires higher semantic relevance to surface              │
│ • Gist-level recall, details on demand                       │
├─────────────────────────────────────────────────────────────┤
│ ARCHIVE (> 7 days)                                           │
│ • Minimal weight (< 0.1)                                     │
│ • Explicit retrieval only                                    │
│ • Compressed summaries, full details available               │
└─────────────────────────────────────────────────────────────┘
```

## Code Examples

### Decay Function

```typescript
/**
 * Calculate time-based relevance decay
 *
 * Uses exponential decay with a 24-hour half-life:
 * - At t=0: weight = 1.0
 * - At t=24h: weight = 0.5
 * - At t=48h: weight = 0.25
 * - At t=168h: weight ≈ 0.0078
 */
function calculateDecay(
  memoryTimestamp: Date,
  currentTime: Date = new Date(),
  halfLifeHours: number = 24
): number {
  const ageHours = (currentTime.getTime() - memoryTimestamp.getTime()) / (1000 * 60 * 60);

  // Memories less than 1 hour old get full weight
  if (ageHours < 1) {
    return 1.0;
  }

  // Exponential decay: weight = e^(-age/halfLife * ln(2))
  const decayFactor = Math.exp(-ageHours / halfLifeHours * Math.LN2);

  return Math.max(decayFactor, 0.01); // Minimum 1% weight
}

// Examples:
// 0 hours: 1.0
// 6 hours: 0.84
// 12 hours: 0.71
// 24 hours: 0.50
// 48 hours: 0.25
// 72 hours: 0.125
// 168 hours (7 days): 0.0078
```

### Combined Relevance Scoring

```typescript
interface Memory {
  id: number;
  content: string;
  timestamp: Date;
  embedding?: number[];
}

interface RelevanceScore {
  memoryId: number;
  semanticScore: number;
  decayWeight: number;
  combinedScore: number;
}

/**
 * Calculate combined relevance score
 *
 * Formula: combinedScore = semanticScore * decayWeight
 */
function calculateRelevance(
  memory: Memory,
  query: string,
  queryEmbedding: number[],
  currentTime: Date = new Date()
): RelevanceScore {
  // Semantic similarity (0.0 to 1.0)
  const semanticScore = memory.embedding
    ? cosineSimilarity(queryEmbedding, memory.embedding)
    : 0.5; // Default if no embedding

  // Time-based decay (0.01 to 1.0)
  const decayWeight = calculateDecay(memory.timestamp, currentTime);

  // Combined score
  const combinedScore = semanticScore * decayWeight;

  return {
    memoryId: memory.id,
    semanticScore,
    decayWeight,
    combinedScore
  };
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator === 0 ? 0 : dotProduct / denominator;
}
```

### Memory Tier Classification

```typescript
type MemoryTier = 'working' | 'short_term' | 'long_term' | 'archive';

interface TierConfig {
  maxAgeHours: number;
  minRelevanceThreshold: number;
  compressionLevel: 'none' | 'summary' | 'gist';
}

const TIER_CONFIG: Record<MemoryTier, TierConfig> = {
  working: {
    maxAgeHours: 1,
    minRelevanceThreshold: 0.0,
    compressionLevel: 'none'
  },
  short_term: {
    maxAgeHours: 24,
    minRelevanceThreshold: 0.3,
    compressionLevel: 'none'
  },
  long_term: {
    maxAgeHours: 168, // 7 days
    minRelevanceThreshold: 0.5,
    compressionLevel: 'summary'
  },
  archive: {
    maxAgeHours: Infinity,
    minRelevanceThreshold: 0.7,
    compressionLevel: 'gist'
  }
};

function classifyMemory(memory: Memory, currentTime: Date = new Date()): MemoryTier {
  const ageHours = (currentTime.getTime() - memory.timestamp.getTime()) / (1000 * 60 * 60);

  if (ageHours < 1) return 'working';
  if (ageHours < 24) return 'short_term';
  if (ageHours < 168) return 'long_term';
  return 'archive';
}

function shouldIncludeMemory(
  memory: Memory,
  relevanceScore: RelevanceScore,
  currentTime: Date = new Date()
): boolean {
  const tier = classifyMemory(memory, currentTime);
  const config = TIER_CONFIG[tier];

  return relevanceScore.combinedScore >= config.minRelevanceThreshold;
}
```

### Endless Mode Context Builder

```typescript
interface EndlessModeConfig {
  maxTokens: number;
  workingMemoryPercent: number;   // 40%
  shortTermPercent: number;       // 35%
  longTermPercent: number;        // 20%
  archivePercent: number;         // 5%
}

const DEFAULT_CONFIG: EndlessModeConfig = {
  maxTokens: 8000,
  workingMemoryPercent: 0.40,
  shortTermPercent: 0.35,
  longTermPercent: 0.20,
  archivePercent: 0.05
};

interface ContextBudget {
  working: number;
  short_term: number;
  long_term: number;
  archive: number;
}

function allocateTokenBudget(config: EndlessModeConfig): ContextBudget {
  return {
    working: Math.floor(config.maxTokens * config.workingMemoryPercent),
    short_term: Math.floor(config.maxTokens * config.shortTermPercent),
    long_term: Math.floor(config.maxTokens * config.longTermPercent),
    archive: Math.floor(config.maxTokens * config.archivePercent)
  };
}

async function buildEndlessModeContext(
  memories: Memory[],
  query: string,
  config: EndlessModeConfig = DEFAULT_CONFIG
): Promise<string[]> {
  const budget = allocateTokenBudget(config);
  const currentTime = new Date();
  const queryEmbedding = await generateEmbedding(query);

  // Score and sort memories
  const scoredMemories = memories.map(memory => ({
    memory,
    score: calculateRelevance(memory, query, queryEmbedding, currentTime),
    tier: classifyMemory(memory, currentTime)
  }));

  // Group by tier
  const byTier: Record<MemoryTier, typeof scoredMemories> = {
    working: [],
    short_term: [],
    long_term: [],
    archive: []
  };

  for (const item of scoredMemories) {
    byTier[item.tier].push(item);
  }

  // Sort each tier by combined score (descending)
  for (const tier of Object.keys(byTier) as MemoryTier[]) {
    byTier[tier].sort((a, b) => b.score.combinedScore - a.score.combinedScore);
  }

  // Fill context within budget
  const context: string[] = [];

  for (const tier of ['working', 'short_term', 'long_term', 'archive'] as MemoryTier[]) {
    let tierTokens = 0;
    const tierBudget = budget[tier];

    for (const item of byTier[tier]) {
      const content = formatMemoryForTier(item.memory, tier);
      const tokens = estimateTokens(content);

      if (tierTokens + tokens <= tierBudget) {
        context.push(content);
        tierTokens += tokens;
      }
    }
  }

  return context;
}

function formatMemoryForTier(memory: Memory, tier: MemoryTier): string {
  const config = TIER_CONFIG[tier];

  switch (config.compressionLevel) {
    case 'none':
      return memory.content;
    case 'summary':
      return extractSummary(memory.content);
    case 'gist':
      return extractGist(memory.content);
    default:
      return memory.content;
  }
}

function extractSummary(content: string): string {
  // Return first 500 characters with ellipsis
  if (content.length <= 500) return content;
  return content.substring(0, 497) + '...';
}

function extractGist(content: string): string {
  // Return first sentence or 100 characters
  const firstSentence = content.split(/[.!?]/)[0];
  if (firstSentence.length <= 100) return firstSentence + '.';
  return content.substring(0, 97) + '...';
}

function estimateTokens(text: string): number {
  // Rough estimate: 1 token ≈ 4 characters
  return Math.ceil(text.length / 4);
}

async function generateEmbedding(text: string): Promise<number[]> {
  // Placeholder - actual implementation uses embedding API
  return new Array(1536).fill(0).map(() => Math.random());
}
```

## Common Patterns

### Pattern 1: Enabling Endless Mode

```bash
# Via settings.json
{
  "mode": "endless",
  "endless": {
    "enabled": true,
    "decayHalfLifeHours": 24,
    "maxTokens": 8000
  }
}

# Or via web UI at http://localhost:37777 → Settings → Beta Features
```

### Pattern 2: Custom Decay Curves

```typescript
// Faster decay (12-hour half-life) for rapid iteration
function fastDecay(timestamp: Date): number {
  return calculateDecay(timestamp, new Date(), 12);
}

// Slower decay (72-hour half-life) for longer-term projects
function slowDecay(timestamp: Date): number {
  return calculateDecay(timestamp, new Date(), 72);
}

// Step decay (full weight for 24h, then rapid drop)
function stepDecay(timestamp: Date): number {
  const ageHours = (Date.now() - timestamp.getTime()) / (1000 * 60 * 60);
  if (ageHours < 24) return 1.0;
  if (ageHours < 48) return 0.5;
  if (ageHours < 72) return 0.25;
  return 0.1;
}
```

### Pattern 3: Context-Aware Decay

```typescript
/**
 * Boost relevance for memories related to current file
 */
function contextAwareRelevance(
  memory: Memory,
  currentFile: string,
  relevanceScore: RelevanceScore
): RelevanceScore {
  // Check if memory references current file
  const filesModified = memory.filesModified || [];
  const filesRead = memory.filesRead || [];
  const allFiles = [...filesModified, ...filesRead];

  const isRelatedToCurrentFile = allFiles.some(f =>
    f.includes(currentFile) || currentFile.includes(f)
  );

  if (isRelatedToCurrentFile) {
    // Boost combined score by 50%
    return {
      ...relevanceScore,
      combinedScore: Math.min(relevanceScore.combinedScore * 1.5, 1.0)
    };
  }

  return relevanceScore;
}
```

### Pattern 4: Importance Anchoring

```typescript
interface ImportanceAnchor {
  memoryId: number;
  anchorType: 'decision' | 'milestone' | 'error' | 'insight';
  decayOverride?: number; // Optional fixed weight
}

const ANCHOR_WEIGHTS: Record<ImportanceAnchor['anchorType'], number> = {
  decision: 0.8,    // Decisions stay relevant longer
  milestone: 0.7,   // Milestones are reference points
  error: 0.6,       // Errors should be remembered
  insight: 0.5      // Insights are valuable context
};

function getAnchoredWeight(
  memory: Memory,
  anchor: ImportanceAnchor | null,
  baseDecay: number
): number {
  if (!anchor) return baseDecay;

  if (anchor.decayOverride !== undefined) {
    return anchor.decayOverride;
  }

  // Blend anchor weight with decay
  const anchorWeight = ANCHOR_WEIGHTS[anchor.anchorType];
  return Math.max(baseDecay, anchorWeight * 0.5);
}
```

## Configuration

### settings.json Endless Mode Options

```json
{
  "mode": "endless",
  "endless": {
    "enabled": true,
    "decayHalfLifeHours": 24,
    "maxContextTokens": 8000,
    "tierAllocation": {
      "working": 0.40,
      "shortTerm": 0.35,
      "longTerm": 0.20,
      "archive": 0.05
    },
    "compressionThresholds": {
      "summary": 24,
      "gist": 168
    },
    "importanceAnchors": {
      "enabled": true,
      "types": ["decision", "milestone", "error"]
    }
  }
}
```

### Switching Modes

```bash
# Enable endless mode via API
curl -X POST "http://127.0.0.1:37777/api/settings" \
  -H "Content-Type: application/json" \
  -d '{"mode": "endless"}'

# Disable endless mode (return to standard)
curl -X POST "http://127.0.0.1:37777/api/settings" \
  -H "Content-Type: application/json" \
  -d '{"mode": "standard"}'
```

## Best Practices

### 1. Monitor Memory Distribution

```typescript
function analyzeMemoryDistribution(memories: Memory[]): void {
  const currentTime = new Date();
  const distribution = {
    working: 0,
    short_term: 0,
    long_term: 0,
    archive: 0
  };

  for (const memory of memories) {
    const tier = classifyMemory(memory, currentTime);
    distribution[tier]++;
  }

  console.log('Memory Distribution:', distribution);
  // Healthy: working ~5%, short_term ~15%, long_term ~30%, archive ~50%
}
```

### 2. Periodic Consolidation

```typescript
/**
 * Consolidate similar archived memories to save space
 */
async function consolidateArchive(archiveMemories: Memory[]): Promise<Memory[]> {
  // Group by topic/content similarity
  const groups = clusterBySimilarity(archiveMemories);

  // Merge each group into a consolidated memory
  const consolidated: Memory[] = [];
  for (const group of groups) {
    if (group.length > 3) {
      const merged = await mergeMemories(group);
      consolidated.push(merged);
    } else {
      consolidated.push(...group);
    }
  }

  return consolidated;
}
```

### 3. Explicit Recall Override

```typescript
/**
 * Allow explicit retrieval of archived memories
 */
async function explicitRecall(memoryId: number): Promise<Memory> {
  const memory = await fetchMemory(memoryId);

  // Temporarily boost the memory's weight
  await setTemporaryBoost(memoryId, {
    weight: 0.9,
    durationHours: 2
  });

  return memory;
}
```

## See Also

- [progressive-disclosure.md](./progressive-disclosure.md) - Token-efficient search patterns
- [worker-service.md](./worker-service.md) - API for mode switching
- [hook-patterns.md](./hook-patterns.md) - How memories are captured
