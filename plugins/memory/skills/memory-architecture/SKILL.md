---
name: memory-architecture
description: This skill should be used when the user asks about "memory architecture", "three-tier memory", "hot warm cold memory", "temporal memory design", "memory decay patterns", "context injection strategy", or needs to design a memory system architecture for AI agents.
version: 0.1.0
allowed-tools: Read, Glob, Grep
---

# Memory Architecture Skill

Provides guidance on designing memory architectures for AI agents, with focus on the three-tier temporal memory pattern that balances automatic convenience with explicit control.

## The Core Tension

Memory systems must balance two competing goals:

| Goal | Approach | Tradeoff |
|------|----------|----------|
| **Convenience** | Automatic injection | Risk of context pollution |
| **Precision** | Explicit retrieval | Requires user awareness |

The solution: **Match automation boundaries to information decay rates**.

## Three-Tier Temporal Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ TIER 1: HOT MEMORY (0-24 hours)                            │
├─────────────────────────────────────────────────────────────┤
│ Strategy:    Automatic injection on EVERY prompt           │
│ Storage:     In-memory cache (deque, maxlen=5)             │
│ Threshold:   None (inject all recent context)              │
│ Decay:       24-hour hard cutoff                           │
│ Max items:   Last 5 interactions                           │
│                                                             │
│ Rationale:   Within a day, continuity >> noise             │
│              User mental model still includes this context  │
│              Fast (in-memory), no persistence needed        │
└─────────────────────────────────────────────────────────────┘
                    ↓ Automatic aging
┌─────────────────────────────────────────────────────────────┐
│ TIER 2: WARM MEMORY (1-7 days)                             │
├─────────────────────────────────────────────────────────────┤
│ Strategy:    Triggered by semantic cues in prompt          │
│ Storage:     SQLite vector DB (persistent)                 │
│ Threshold:   0.4 similarity (moderate selectivity)         │
│ Decay:       7-day hard cutoff                             │
│ Max items:   Top 2 matches only                            │
│                                                             │
│ Triggers:    • Question marks in prompt                    │
│              • File/directory references                   │
│              • >10 word queries (complex questions)        │
│              • Temporal keywords (yesterday, last week)    │
│                                                             │
│ Rationale:   Recent work benefits from auto-assist         │
│              But filter heavily to prevent pollution       │
└─────────────────────────────────────────────────────────────┘
                    ↓ Archival
┌─────────────────────────────────────────────────────────────┐
│ TIER 3: COLD MEMORY (8+ days)                              │
├─────────────────────────────────────────────────────────────┤
│ Strategy:    Explicit user invocation ONLY                 │
│ Storage:     JSONL logs + BM25/FTS5 index                  │
│ Threshold:   User-controlled search parameters             │
│ Decay:       None (permanent archive)                      │
│                                                             │
│ Access:      Skills, commands, or explicit queries         │
│                                                             │
│ Rationale:   Historical context requires intentional       │
│              retrieval. User knows what they need.         │
│              Search quality stable over time.              │
└─────────────────────────────────────────────────────────────┘
```

## Timescale Analysis

| Timescale | Optimal Approach | Reason |
|-----------|------------------|--------|
| **Minutes-Hours** | Automatic injection | Zero-friction continuity trumps noise |
| **1-3 Days** | Automatic (triggered) | Cross-session coherence still valuable |
| **1-2 Weeks** | Hybrid | Patterns emerge but noise creeps in |
| **1-3 Months** | Explicit search | Accumulates too much noise |
| **6+ Months** | Explicit search | Search quality stable over time |

## The Information Pollution Spiral

Why purely automatic systems fail over time:

```
Memory capture → Everything indexed → Noise accumulates
      ↑                                        ↓
      └──────── Threshold must lower ──────────┘

Effect: System becomes less discriminating over time
        No natural carrying capacity
        "Sophisticated Amnesia"
```

The three-tier architecture solves this by having **natural boundaries** at each tier.

## Hook Architecture for Memory

Claude Code hooks enable the three-tier pattern:

| Hook Event | Memory Application | Tier |
|------------|-------------------|------|
| **UserPromptSubmit** | Inject hot memory context | Hot |
| **UserPromptSubmit** | Triggered warm memory retrieval | Warm |
| **PostToolUse** | Index tool results for future retrieval | All |
| **Stop** | Summarize exchange, update hot cache | Hot |
| **SessionEnd** | Batch embedding generation | Warm |
| **PreCompact** | Archive context before loss | All |

### Hook Output for Context Injection

```python
# UserPromptSubmit hook output for context injection
output = {
    "hookSpecificOutput": {
        "hookEventName": "UserPromptSubmit",
        "additionalContext": "[MEMORY CONTEXT]\n" + context + "\n[END MEMORY]"
    }
}
print(json.dumps(output))
```

## Configuration Parameters

Starting configuration based on multi-agent analysis:

```yaml
hot_memory:
  enabled: true
  max_age_hours: 24
  max_items: 5
  auto_inject: true

warm_memory:
  enabled: true
  max_age_days: 7
  similarity_threshold: 0.4  # 0.3=aggressive, 0.5=conservative
  max_injections: 2

  triggers:
    question_mark: true
    file_reference: true
    complex_query_min_words: 10
    temporal_keywords: true

  disabled_dirs:
    - /tmp
    - /scratch

cold_memory:
  enabled: true
  tool: /log-search
  default_limit: 10
```

## Hybrid Search Scoring

Combine multiple signals for optimal retrieval:

```python
final_score = (
    similarity * semantic_weight +        # 0.6 default
    keyword_score * keyword_weight +      # 0.4 default
    recency_weight * recency_factor +     # 0.3 default
    importance * importance_weight +       # 0.25 default
    access_pattern * access_weight +       # 0.15 default
    context_boost                          # 0.0-0.5 based on matches
)
```

### Recency Decay Function

Exponential decay provides natural aging:

```python
def calculate_recency_weight(timestamp: str, decay_days: int = 30) -> float:
    age_days = (datetime.now() - parse_timestamp(timestamp)).days
    decay_rate = 1.0 / decay_days
    return math.exp(-decay_rate * age_days)
```

## Expected System Behavior

### Short Term (1-7 days)
- Hot memory provides seamless session continuity
- Warm memory "just works" for recent questions
- User builds trust in automatic context

### Medium Term (1-3 months)
- Hot cache churns naturally (self-limiting)
- Warm DB reaches steady state (~350 memories)
- User learns when to invoke explicit search

### Long Term (6+ months)
- Hot memory prevents context drift
- Warm memory focuses on current work phase
- Cold archive becomes reliable reference
- **No degradation in retrieval quality**

## Failure Modes and Mitigations

| Failure Mode | Symptom | Mitigation |
|--------------|---------|------------|
| Warm memory overfiring | Every prompt triggers | Increase threshold to 0.5 |
| Hot memory pollution | Tangential context injected | Add similarity threshold to cache |
| User disables everything | Turns off hot + warm | Make transparency visible, tune defaults |
| Cold archive too large | Search becomes slow | Implement time-bounded defaults |

## Transparency Layer

Always show when memory is used:

```
[Memory Context: 2 warm memories injected (scores: 0.72, 0.58)]
```

This builds user trust and enables debugging.

## Additional Resources

### Reference Files
- `references/legacy-system-analysis.md` - Analysis of failed automatic memory
- `references/multi-agent-evaluation.md` - Four-agent architecture consensus

### Related Skills
- `../embeddings/SKILL.md` - Embedding model selection
- `../vector-search/SKILL.md` - Vector database integration
- `../claude-mem/SKILL.md` - Progressive disclosure patterns
