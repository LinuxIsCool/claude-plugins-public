# Purpose

Optimize token usage by progressively disclosing memory context based on relevance signals. Instead of injecting all available memory at once, this pattern reveals information in layers - from summaries to full content - based on the user's query complexity and context needs.

## Variables

```yaml
# Disclosure Levels
DISCLOSURE_LEVELS:
  minimal:
    hot_items: 2
    warm_items: 0
    format: summary_only
    max_tokens: 200

  standard:
    hot_items: 5
    warm_items: 2
    format: summary_with_entities
    max_tokens: 500

  detailed:
    hot_items: 5
    warm_items: 4
    format: full_content
    max_tokens: 1500

  comprehensive:
    hot_items: 5
    warm_items: 6
    cold_search: enabled
    format: full_with_context
    max_tokens: 3000

# Trigger Keywords
COMPLEXITY_TRIGGERS:
  minimal: ["quick", "simple", "just"]
  detailed: ["explain", "analyze", "investigate", "debug"]
  comprehensive: ["full context", "everything", "complete history"]

# Token Budget
DEFAULT_TOKEN_BUDGET: 1000
MAX_TOKEN_BUDGET: 4000
```

## Instructions

### 1. Understand the Disclosure Philosophy

Progressive disclosure treats memory injection as a **compression problem**:

```
Full History (10K+ tokens) → Relevant Subset → Compressed Format → Injected Context
```

The goal is to maximize information density while minimizing token usage:

| Metric | Definition | Target |
|--------|------------|--------|
| **Precision** | % of injected content that's relevant | > 80% |
| **Recall** | % of relevant content that's injected | > 60% |
| **Compression** | Original tokens / Injected tokens | > 10x |

### 2. Implement Query Complexity Analysis

```python
from dataclasses import dataclass
from enum import Enum
from typing import List, Set
import re


class DisclosureLevel(Enum):
    MINIMAL = "minimal"
    STANDARD = "standard"
    DETAILED = "detailed"
    COMPREHENSIVE = "comprehensive"


@dataclass
class QueryAnalysis:
    """Analysis of a user query for disclosure level."""
    level: DisclosureLevel
    detected_signals: List[str]
    entities_mentioned: Set[str]
    is_continuation: bool
    has_temporal_reference: bool
    estimated_complexity: float  # 0.0 - 1.0


class QueryComplexityAnalyzer:
    """Analyze query to determine appropriate disclosure level."""

    def __init__(self):
        self.complexity_keywords = {
            "minimal": {"quick", "simple", "just", "only", "briefly"},
            "detailed": {"explain", "analyze", "investigate", "debug",
                        "understand", "why", "how does"},
            "comprehensive": {"full context", "everything about",
                             "complete history", "all details"}
        }

        self.temporal_keywords = {
            "yesterday", "last week", "earlier", "before",
            "previously", "last time", "when we"
        }

        self.continuation_patterns = [
            r"^(and|also|another|next|then)\b",
            r"^(continue|keep going|more)\b",
            r"^(what about|how about)\b"
        ]

    def analyze(self, query: str, recent_context: List[str] = None) -> QueryAnalysis:
        """Analyze query and determine disclosure level."""
        query_lower = query.lower()
        signals = []

        # Check for explicit complexity keywords
        level = DisclosureLevel.STANDARD

        for lvl, keywords in self.complexity_keywords.items():
            if any(kw in query_lower for kw in keywords):
                level = DisclosureLevel[lvl.upper()]
                signals.append(f"keyword:{lvl}")
                break

        # Check for question complexity
        word_count = len(query.split())
        if word_count > 30:
            level = max(level, DisclosureLevel.DETAILED,
                       key=lambda x: list(DisclosureLevel).index(x))
            signals.append("long_query")

        # Check for temporal references
        has_temporal = any(tw in query_lower for tw in self.temporal_keywords)
        if has_temporal:
            level = max(level, DisclosureLevel.DETAILED,
                       key=lambda x: list(DisclosureLevel).index(x))
            signals.append("temporal_reference")

        # Check for continuation patterns
        is_continuation = any(
            re.match(pattern, query_lower)
            for pattern in self.continuation_patterns
        )
        if is_continuation:
            signals.append("continuation")

        # Extract mentioned entities
        entities = self._extract_entities(query)
        if len(entities) > 3:
            level = max(level, DisclosureLevel.DETAILED,
                       key=lambda x: list(DisclosureLevel).index(x))
            signals.append("multiple_entities")

        # Calculate complexity score
        complexity = self._calculate_complexity(
            word_count, len(entities), has_temporal, is_continuation
        )

        return QueryAnalysis(
            level=level,
            detected_signals=signals,
            entities_mentioned=entities,
            is_continuation=is_continuation,
            has_temporal_reference=has_temporal,
            estimated_complexity=complexity
        )

    def _extract_entities(self, query: str) -> Set[str]:
        """Extract file paths, function names, and other entities."""
        entities = set()

        # File paths
        entities.update(re.findall(r'[\w/.-]+\.(py|ts|js|md|json|yaml)', query))

        # Function/class names (CamelCase or snake_case)
        entities.update(re.findall(r'\b[A-Z][a-zA-Z]+\b', query))
        entities.update(re.findall(r'\b[a-z]+_[a-z_]+\b', query))

        return entities

    def _calculate_complexity(self, word_count: int, entity_count: int,
                             has_temporal: bool, is_continuation: bool) -> float:
        """Calculate overall query complexity score."""
        score = 0.0

        # Word count contribution (0-0.3)
        score += min(word_count / 100, 0.3)

        # Entity count contribution (0-0.3)
        score += min(entity_count / 10, 0.3)

        # Temporal reference (0.2)
        if has_temporal:
            score += 0.2

        # Continuation (0.2)
        if is_continuation:
            score += 0.2

        return min(score, 1.0)
```

### 3. Implement Progressive Formatters

```python
from abc import ABC, abstractmethod
from typing import List, Dict, Any


class MemoryFormatter(ABC):
    """Base class for memory content formatters."""

    @abstractmethod
    def format(self, memories: List[Dict[str, Any]],
               token_budget: int) -> str:
        """Format memories within token budget."""
        pass

    def estimate_tokens(self, text: str) -> int:
        """Estimate token count (rough approximation)."""
        return int(len(text.split()) * 1.3)


class SummaryOnlyFormatter(MemoryFormatter):
    """Format memories as brief summaries only."""

    def format(self, memories: List[Dict[str, Any]],
               token_budget: int) -> str:
        lines = []
        tokens_used = 0

        for mem in memories:
            # One-line summary
            summary = mem.get("summary", mem.get("content", "")[:50])
            age = self._format_age(mem.get("timestamp"))
            line = f"- [{age}] {summary}"

            line_tokens = self.estimate_tokens(line)
            if tokens_used + line_tokens > token_budget:
                break

            lines.append(line)
            tokens_used += line_tokens

        return "\n".join(lines) if lines else ""

    def _format_age(self, timestamp: str) -> str:
        """Format timestamp as relative age."""
        if not timestamp:
            return "?"
        from datetime import datetime
        try:
            age = datetime.now() - datetime.fromisoformat(timestamp)
            if age.total_seconds() < 3600:
                return f"{int(age.total_seconds() / 60)}m"
            elif age.total_seconds() < 86400:
                return f"{int(age.total_seconds() / 3600)}h"
            else:
                return f"{age.days}d"
        except:
            return "?"


class SummaryWithEntitiesFormatter(MemoryFormatter):
    """Format memories with summaries and key entities."""

    def format(self, memories: List[Dict[str, Any]],
               token_budget: int) -> str:
        lines = []
        tokens_used = 0

        for mem in memories:
            summary = mem.get("summary", mem.get("content", "")[:100])
            entities = mem.get("key_entities", [])
            age = SummaryOnlyFormatter()._format_age(mem.get("timestamp"))

            # Build entry
            entry_lines = [f"- [{age}] {summary}"]
            if entities:
                entry_lines.append(f"  Entities: {', '.join(entities[:5])}")

            entry = "\n".join(entry_lines)
            entry_tokens = self.estimate_tokens(entry)

            if tokens_used + entry_tokens > token_budget:
                break

            lines.append(entry)
            tokens_used += entry_tokens

        return "\n".join(lines) if lines else ""


class FullContentFormatter(MemoryFormatter):
    """Format memories with full content, truncated as needed."""

    def __init__(self, max_content_length: int = 500):
        self.max_content_length = max_content_length

    def format(self, memories: List[Dict[str, Any]],
               token_budget: int) -> str:
        sections = []
        tokens_used = 0

        for i, mem in enumerate(memories):
            content = mem.get("content", "")
            if len(content) > self.max_content_length:
                content = content[:self.max_content_length] + "..."

            age = SummaryOnlyFormatter()._format_age(mem.get("timestamp"))
            score = mem.get("score", 0)

            section = f"""### Memory {i+1} [{age}] (score: {score:.2f})
{content}
"""
            section_tokens = self.estimate_tokens(section)

            if tokens_used + section_tokens > token_budget:
                break

            sections.append(section)
            tokens_used += section_tokens

        return "\n".join(sections) if sections else ""


class FullWithContextFormatter(MemoryFormatter):
    """Format memories with full content and surrounding context."""

    def format(self, memories: List[Dict[str, Any]],
               token_budget: int) -> str:
        sections = []
        tokens_used = 0

        # Add header with overview
        header = self._generate_header(memories)
        header_tokens = self.estimate_tokens(header)
        tokens_used += header_tokens
        sections.append(header)

        # Add memories with context
        per_memory_budget = (token_budget - header_tokens) // max(len(memories), 1)

        for i, mem in enumerate(memories):
            section = self._format_memory_with_context(mem, i, per_memory_budget)
            section_tokens = self.estimate_tokens(section)

            if tokens_used + section_tokens > token_budget:
                sections.append(f"\n[{len(memories) - i} additional memories omitted]")
                break

            sections.append(section)
            tokens_used += section_tokens

        return "\n".join(sections)

    def _generate_header(self, memories: List[Dict[str, Any]]) -> str:
        """Generate overview header."""
        total = len(memories)
        sources = set(m.get("source", "unknown") for m in memories)

        return f"""## Memory Context Overview
- Total memories: {total}
- Sources: {', '.join(sources)}
---"""

    def _format_memory_with_context(self, mem: Dict[str, Any],
                                    index: int, budget: int) -> str:
        """Format single memory with full context."""
        content = mem.get("content", "")
        metadata = mem.get("metadata", {})

        # Truncate if needed
        max_content = budget * 4  # Rough chars-to-tokens
        if len(content) > max_content:
            content = content[:max_content] + "\n[truncated]"

        return f"""
### Memory {index + 1}
**Source**: {mem.get('source', 'unknown')}
**Time**: {mem.get('timestamp', 'unknown')}
**Importance**: {mem.get('importance', 0):.2f}

{content}

**Metadata**: {metadata}
"""
```

### 4. Implement the Disclosure Controller

```python
from dataclasses import dataclass
from typing import Optional


@dataclass
class DisclosureConfig:
    """Configuration for a disclosure level."""
    hot_items: int
    warm_items: int
    cold_search: bool
    formatter: MemoryFormatter
    max_tokens: int


class ProgressiveDisclosureController:
    """Control progressive memory disclosure based on query analysis."""

    def __init__(self, memory_manager):
        self.memory = memory_manager
        self.analyzer = QueryComplexityAnalyzer()

        # Configure disclosure levels
        self.configs = {
            DisclosureLevel.MINIMAL: DisclosureConfig(
                hot_items=2,
                warm_items=0,
                cold_search=False,
                formatter=SummaryOnlyFormatter(),
                max_tokens=200
            ),
            DisclosureLevel.STANDARD: DisclosureConfig(
                hot_items=5,
                warm_items=2,
                cold_search=False,
                formatter=SummaryWithEntitiesFormatter(),
                max_tokens=500
            ),
            DisclosureLevel.DETAILED: DisclosureConfig(
                hot_items=5,
                warm_items=4,
                cold_search=False,
                formatter=FullContentFormatter(),
                max_tokens=1500
            ),
            DisclosureLevel.COMPREHENSIVE: DisclosureConfig(
                hot_items=5,
                warm_items=6,
                cold_search=True,
                formatter=FullWithContextFormatter(),
                max_tokens=3000
            )
        }

    def get_context(self, query: str,
                    override_level: Optional[DisclosureLevel] = None,
                    token_budget: Optional[int] = None) -> str:
        """Get memory context at appropriate disclosure level."""

        # Analyze query
        analysis = self.analyzer.analyze(query)
        level = override_level or analysis.level
        config = self.configs[level]

        # Apply token budget override if provided
        effective_budget = token_budget or config.max_tokens

        # Gather memories
        memories = []

        # Hot tier (always included)
        hot_entries = self.memory.hot.get_active_context()[:config.hot_items]
        for entry in hot_entries:
            memories.append({
                "content": entry.summary,
                "timestamp": entry.timestamp,
                "key_entities": entry.key_entities,
                "importance": entry.importance,
                "source": "hot",
                "score": 1.0
            })

        # Warm tier (if configured)
        if config.warm_items > 0:
            query_embedding = self.memory._get_embedding(query)
            warm_results = self.memory.warm.search(
                query_embedding,
                limit=config.warm_items
            )
            for content, score in warm_results:
                memories.append({
                    "content": content,
                    "score": score,
                    "source": "warm"
                })

        # Cold tier (if comprehensive)
        if config.cold_search:
            cold_results = self.memory.cold.search(query, limit=3)
            for result in cold_results:
                memories.append({
                    "content": result["content"],
                    "timestamp": result["timestamp"],
                    "score": result["score"],
                    "source": "cold"
                })

        # Format output
        if not memories:
            return ""

        formatted = config.formatter.format(memories, effective_budget)

        # Add disclosure metadata
        return self._wrap_with_metadata(formatted, analysis, level)

    def _wrap_with_metadata(self, content: str, analysis: QueryAnalysis,
                           level: DisclosureLevel) -> str:
        """Wrap content with disclosure metadata."""
        signals = ", ".join(analysis.detected_signals) if analysis.detected_signals else "default"

        return f"""[Memory Context - Level: {level.value}]
[Signals: {signals} | Complexity: {analysis.estimated_complexity:.2f}]

{content}

[End Memory Context]"""
```

### 5. Implement Adaptive Budget Management

```python
class AdaptiveTokenBudget:
    """Dynamically adjust token budget based on context."""

    def __init__(self, base_budget: int = 1000):
        self.base_budget = base_budget
        self.min_budget = 100
        self.max_budget = 4000

        # Track historical usage
        self.usage_history = []

    def calculate_budget(self, query: str,
                        available_context: int,
                        complexity: float) -> int:
        """Calculate appropriate token budget."""

        # Start with base
        budget = self.base_budget

        # Adjust for complexity
        budget = int(budget * (0.5 + complexity))

        # Adjust for available context window
        # Reserve at least 50% for response
        max_from_context = available_context // 2
        budget = min(budget, max_from_context)

        # Apply historical learning
        if self.usage_history:
            avg_useful = sum(self.usage_history[-10:]) / len(self.usage_history[-10:])
            # If historically using less, reduce budget
            budget = int(budget * (0.5 + avg_useful * 0.5))

        # Enforce bounds
        return max(self.min_budget, min(budget, self.max_budget))

    def record_usage(self, tokens_injected: int, tokens_referenced: int) -> None:
        """Record how much of injected context was actually used."""
        if tokens_injected > 0:
            utility = min(tokens_referenced / tokens_injected, 1.0)
            self.usage_history.append(utility)

            # Keep only recent history
            if len(self.usage_history) > 100:
                self.usage_history = self.usage_history[-100:]
```

## When to Use This Pattern

Use progressive disclosure when:

- **Token budget is constrained** - You cannot inject all available memory
- **Query complexity varies** - Some questions need more context than others
- **Performance matters** - Larger injections increase latency and cost
- **Memory accumulates over time** - Historical context grows unboundedly
- **Users have different needs** - Quick questions vs. deep investigations

Avoid when:

- Context window is essentially unlimited
- All queries are uniformly complex
- Memory is small enough to always inject fully

## Trade-offs and Considerations

### Precision vs. Recall Trade-off

| Level | Precision | Recall | Token Cost |
|-------|-----------|--------|------------|
| Minimal | Very High | Low | ~200 |
| Standard | High | Medium | ~500 |
| Detailed | Medium | High | ~1500 |
| Comprehensive | Low | Very High | ~3000 |

### Complexity Analysis Accuracy

The query analyzer uses heuristics that may misclassify:

```python
# Example misclassifications
"Just explain everything about the authentication system"
# Contains "just" (minimal) but requests comprehensive info

"Debug the issue"
# Contains "debug" (detailed) but might be a simple fix
```

Mitigation: Allow user override via explicit keywords like "brief" or "full context".

### Latency Considerations

| Level | Typical Latency | Components |
|-------|-----------------|------------|
| Minimal | 5-10ms | Hot cache only |
| Standard | 20-40ms | Hot + warm search |
| Detailed | 40-80ms | Hot + warm (more results) |
| Comprehensive | 100-200ms | All tiers + formatting |

### Compression Quality

Higher compression can lose nuance:

```python
# Original (detailed)
"The authentication system uses JWT tokens stored in HTTP-only cookies,
with refresh tokens in a separate secure cookie. Session invalidation
happens via a Redis blacklist."

# Compressed (minimal)
"Auth: JWT + cookies + Redis"

# Information loss: cookie security details, blacklist mechanism
```

Balance compression with information preservation for critical details.
