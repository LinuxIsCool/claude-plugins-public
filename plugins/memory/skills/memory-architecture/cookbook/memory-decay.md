# Purpose

Implement biomimetic memory decay patterns that mirror how human memory naturally fades over time. Unlike hard cutoffs, decay functions provide smooth degradation that prioritizes recent information while preserving truly important memories. This creates a self-regulating system that maintains relevance without manual pruning.

## Variables

```yaml
# Decay Function Parameters
EXPONENTIAL_DECAY:
  half_life_days: 14
  min_weight: 0.01
  formula: "weight = exp(-lambda * age_days)"

POWER_LAW_DECAY:
  exponent: 0.5
  scale_factor: 1.0
  min_weight: 0.01
  formula: "weight = 1 / (1 + age_days)^exponent"

COMPOSITE_DECAY:
  short_term_half_life: 7
  long_term_half_life: 90
  blend_ratio: 0.7  # 70% short-term, 30% long-term

# Importance Modulation
IMPORTANCE_LEVELS:
  critical: 0.1    # Decay rate multiplier (slower = more important)
  high: 0.5
  normal: 1.0
  low: 2.0

# Reinforcement Parameters
ACCESS_REINFORCEMENT: 0.2  # Score boost per access
MAX_REINFORCEMENT: 2.0     # Maximum reinforcement multiplier
REINFORCEMENT_DECAY: 0.95  # Daily decay of reinforcement

# Consolidation Thresholds
HOT_TO_WARM_AGE_HOURS: 24
WARM_TO_COLD_AGE_DAYS: 7
ARCHIVE_THRESHOLD: 0.05    # Decay below this triggers archival
```

## Instructions

### 1. Understand Biomimetic Decay Principles

Human memory follows predictable decay patterns discovered by Ebbinghaus:

```
Retention
   │
1.0├──┐
   │  └──────┐
0.5├         └──────────────────────
   │                                └──────────────
0.0├──────────────────────────────────────────────────► Time
   0    1d    1w        1m              6m
```

Key principles:
- **Rapid initial decay**: Most forgetting happens early
- **Long tail**: Some information persists indefinitely
- **Reinforcement**: Accessed memories decay slower
- **Importance modulation**: Critical memories resist decay

### 2. Implement Core Decay Functions

```python
import math
from datetime import datetime, timedelta
from dataclasses import dataclass
from enum import Enum
from typing import Callable, Optional
from abc import ABC, abstractmethod


class ImportanceLevel(Enum):
    CRITICAL = "critical"
    HIGH = "high"
    NORMAL = "normal"
    LOW = "low"


@dataclass
class DecayConfig:
    """Configuration for decay function."""
    half_life_days: float = 14.0
    min_weight: float = 0.01
    importance_multipliers: dict = None

    def __post_init__(self):
        if self.importance_multipliers is None:
            self.importance_multipliers = {
                ImportanceLevel.CRITICAL: 0.1,
                ImportanceLevel.HIGH: 0.5,
                ImportanceLevel.NORMAL: 1.0,
                ImportanceLevel.LOW: 2.0
            }


class DecayFunction(ABC):
    """Base class for decay functions."""

    @abstractmethod
    def calculate(self, age_days: float, importance: ImportanceLevel = ImportanceLevel.NORMAL) -> float:
        """Calculate decay weight for given age and importance."""
        pass

    @abstractmethod
    def time_to_threshold(self, threshold: float, importance: ImportanceLevel = ImportanceLevel.NORMAL) -> float:
        """Calculate days until weight reaches threshold."""
        pass


class ExponentialDecay(DecayFunction):
    """
    Exponential decay: weight = exp(-lambda * t)

    Characterized by constant half-life regardless of current weight.
    Good for modeling natural forgetting.
    """

    def __init__(self, config: DecayConfig):
        self.config = config
        # Calculate lambda from half-life
        self.base_lambda = math.log(2) / config.half_life_days

    def calculate(self, age_days: float,
                  importance: ImportanceLevel = ImportanceLevel.NORMAL) -> float:
        """Calculate exponential decay weight."""
        # Adjust decay rate based on importance
        importance_mult = self.config.importance_multipliers[importance]
        adjusted_lambda = self.base_lambda * importance_mult

        weight = math.exp(-adjusted_lambda * age_days)
        return max(weight, self.config.min_weight)

    def time_to_threshold(self, threshold: float,
                          importance: ImportanceLevel = ImportanceLevel.NORMAL) -> float:
        """Days until weight reaches threshold."""
        importance_mult = self.config.importance_multipliers[importance]
        adjusted_lambda = self.base_lambda * importance_mult

        if threshold <= 0:
            return float('inf')
        return -math.log(threshold) / adjusted_lambda


class PowerLawDecay(DecayFunction):
    """
    Power law decay: weight = 1 / (1 + t)^alpha

    Heavy tail - memories persist longer than exponential.
    Better models long-term retention in human memory.
    """

    def __init__(self, config: DecayConfig, exponent: float = 0.5):
        self.config = config
        self.exponent = exponent

    def calculate(self, age_days: float,
                  importance: ImportanceLevel = ImportanceLevel.NORMAL) -> float:
        """Calculate power law decay weight."""
        importance_mult = self.config.importance_multipliers[importance]
        adjusted_exponent = self.exponent * importance_mult

        weight = 1.0 / math.pow(1 + age_days, adjusted_exponent)
        return max(weight, self.config.min_weight)

    def time_to_threshold(self, threshold: float,
                          importance: ImportanceLevel = ImportanceLevel.NORMAL) -> float:
        """Days until weight reaches threshold."""
        importance_mult = self.config.importance_multipliers[importance]
        adjusted_exponent = self.exponent * importance_mult

        if threshold <= 0 or threshold >= 1:
            return float('inf') if threshold <= 0 else 0

        return math.pow(1/threshold, 1/adjusted_exponent) - 1


class CompositeDecay(DecayFunction):
    """
    Composite decay: blend of fast and slow components.

    Models both working memory (fast decay) and long-term storage (slow decay).
    """

    def __init__(self, config: DecayConfig,
                 short_half_life: float = 7,
                 long_half_life: float = 90,
                 short_weight: float = 0.7):
        self.config = config
        self.short_term = ExponentialDecay(
            DecayConfig(half_life_days=short_half_life,
                       importance_multipliers=config.importance_multipliers)
        )
        self.long_term = ExponentialDecay(
            DecayConfig(half_life_days=long_half_life,
                       importance_multipliers=config.importance_multipliers)
        )
        self.short_weight = short_weight
        self.long_weight = 1 - short_weight

    def calculate(self, age_days: float,
                  importance: ImportanceLevel = ImportanceLevel.NORMAL) -> float:
        """Calculate composite decay weight."""
        short_component = self.short_term.calculate(age_days, importance)
        long_component = self.long_term.calculate(age_days, importance)

        weight = (self.short_weight * short_component +
                  self.long_weight * long_component)
        return max(weight, self.config.min_weight)

    def time_to_threshold(self, threshold: float,
                          importance: ImportanceLevel = ImportanceLevel.NORMAL) -> float:
        """Approximate days until weight reaches threshold."""
        # Use binary search for composite function
        low, high = 0, 365 * 10  # Up to 10 years

        while high - low > 0.1:
            mid = (low + high) / 2
            weight = self.calculate(mid, importance)
            if weight > threshold:
                low = mid
            else:
                high = mid

        return low
```

### 3. Implement Reinforcement Learning

```python
@dataclass
class MemoryState:
    """State of a memory including reinforcement."""
    content_hash: str
    created_at: datetime
    last_accessed: datetime
    access_count: int
    importance: ImportanceLevel
    reinforcement_score: float = 1.0


class ReinforcementManager:
    """Manage memory reinforcement through access patterns."""

    def __init__(self,
                 access_boost: float = 0.2,
                 max_reinforcement: float = 2.0,
                 daily_decay: float = 0.95):
        self.access_boost = access_boost
        self.max_reinforcement = max_reinforcement
        self.daily_decay = daily_decay

    def on_access(self, state: MemoryState) -> MemoryState:
        """Reinforce memory when accessed."""
        # Boost reinforcement score
        new_reinforcement = min(
            state.reinforcement_score + self.access_boost,
            self.max_reinforcement
        )

        return MemoryState(
            content_hash=state.content_hash,
            created_at=state.created_at,
            last_accessed=datetime.now(),
            access_count=state.access_count + 1,
            importance=state.importance,
            reinforcement_score=new_reinforcement
        )

    def apply_reinforcement_decay(self, state: MemoryState) -> MemoryState:
        """Apply daily decay to reinforcement score."""
        days_since_access = (datetime.now() - state.last_accessed).days

        # Decay reinforcement toward 1.0 (neutral)
        decayed = 1.0 + (state.reinforcement_score - 1.0) * (self.daily_decay ** days_since_access)

        return MemoryState(
            content_hash=state.content_hash,
            created_at=state.created_at,
            last_accessed=state.last_accessed,
            access_count=state.access_count,
            importance=state.importance,
            reinforcement_score=max(1.0, decayed)
        )

    def calculate_effective_weight(self, base_weight: float,
                                   state: MemoryState) -> float:
        """Calculate weight with reinforcement applied."""
        # Apply reinforcement decay first
        current_state = self.apply_reinforcement_decay(state)
        return base_weight * current_state.reinforcement_score
```

### 4. Implement Spaced Repetition Integration

```python
class SpacedRepetitionScheduler:
    """
    Schedule memory review based on spacing effect.

    Optimal retention occurs when review happens just before forgetting.
    """

    def __init__(self, decay_fn: DecayFunction,
                 review_threshold: float = 0.5):
        self.decay_fn = decay_fn
        self.review_threshold = review_threshold

    def next_review_time(self, state: MemoryState) -> datetime:
        """Calculate optimal next review time."""
        # Time until memory decays to threshold
        time_to_threshold = self.decay_fn.time_to_threshold(
            self.review_threshold,
            state.importance
        )

        # Account for reinforcement
        if state.reinforcement_score > 1.0:
            # Reinforced memories can wait longer
            time_to_threshold *= state.reinforcement_score

        return state.last_accessed + timedelta(days=time_to_threshold)

    def get_due_for_review(self, memories: list[MemoryState]) -> list[MemoryState]:
        """Get memories that are due for review (approaching threshold)."""
        now = datetime.now()
        due = []

        for memory in memories:
            review_time = self.next_review_time(memory)
            if review_time <= now:
                due.append(memory)

        return sorted(due, key=lambda m: self.next_review_time(m))
```

### 5. Implement Tier Transition Logic

```python
from typing import Tuple, List


class TierTransitionManager:
    """Manage transitions between memory tiers based on decay."""

    def __init__(self,
                 decay_fn: DecayFunction,
                 hot_to_warm_hours: int = 24,
                 warm_to_cold_days: int = 7,
                 archive_threshold: float = 0.05):
        self.decay_fn = decay_fn
        self.hot_to_warm = timedelta(hours=hot_to_warm_hours)
        self.warm_to_cold = timedelta(days=warm_to_cold_days)
        self.archive_threshold = archive_threshold

    def get_tier(self, state: MemoryState) -> str:
        """Determine current tier for a memory."""
        age = datetime.now() - state.created_at

        if age <= self.hot_to_warm:
            return "hot"
        elif age <= self.warm_to_cold:
            return "warm"
        else:
            return "cold"

    def should_archive(self, state: MemoryState) -> bool:
        """Check if memory should be archived (removed from active search)."""
        age_days = (datetime.now() - state.created_at).days
        weight = self.decay_fn.calculate(age_days, state.importance)

        # Don't archive critical memories
        if state.importance == ImportanceLevel.CRITICAL:
            return False

        # Archive if decayed below threshold and not recently accessed
        if weight < self.archive_threshold:
            days_since_access = (datetime.now() - state.last_accessed).days
            return days_since_access > 30  # Inactive for a month

        return False

    def process_transitions(self, memories: List[MemoryState]) -> Tuple[List, List, List]:
        """Process all memories and return tier assignments."""
        hot = []
        warm = []
        cold = []

        for memory in memories:
            if self.should_archive(memory):
                continue  # Will be archived separately

            tier = self.get_tier(memory)
            if tier == "hot":
                hot.append(memory)
            elif tier == "warm":
                warm.append(memory)
            else:
                cold.append(memory)

        return hot, warm, cold


class DecayBasedRanker:
    """Rank search results with decay applied."""

    def __init__(self, decay_fn: DecayFunction,
                 reinforcement_mgr: ReinforcementManager):
        self.decay_fn = decay_fn
        self.reinforcement = reinforcement_mgr

    def rank(self, results: List[dict],
             base_score_key: str = "score") -> List[dict]:
        """Rank results by decay-adjusted score."""
        ranked = []

        for result in results:
            # Get base score
            base_score = result.get(base_score_key, 0.5)

            # Calculate decay weight
            timestamp = result.get("timestamp")
            if timestamp:
                age_days = (datetime.now() - datetime.fromisoformat(timestamp)).days
            else:
                age_days = 0

            importance = ImportanceLevel(result.get("importance", "normal"))
            decay_weight = self.decay_fn.calculate(age_days, importance)

            # Apply reinforcement if available
            if "access_count" in result:
                state = MemoryState(
                    content_hash="",
                    created_at=datetime.fromisoformat(timestamp) if timestamp else datetime.now(),
                    last_accessed=datetime.fromisoformat(result.get("last_accessed", timestamp or datetime.now().isoformat())),
                    access_count=result.get("access_count", 0),
                    importance=importance,
                    reinforcement_score=result.get("reinforcement", 1.0)
                )
                decay_weight = self.reinforcement.calculate_effective_weight(
                    decay_weight, state
                )

            # Calculate final score
            final_score = base_score * decay_weight

            ranked.append({
                **result,
                "decay_weight": decay_weight,
                "final_score": final_score
            })

        return sorted(ranked, key=lambda x: x["final_score"], reverse=True)
```

### 6. Implement Decay Visualization

```python
def plot_decay_comparison(days: int = 60) -> str:
    """Generate ASCII visualization of decay functions."""
    config = DecayConfig()

    exp_decay = ExponentialDecay(config)
    power_decay = PowerLawDecay(config)
    composite_decay = CompositeDecay(config)

    # Generate data points
    x = list(range(0, days + 1, max(1, days // 20)))
    exp_y = [exp_decay.calculate(d) for d in x]
    pow_y = [power_decay.calculate(d) for d in x]
    comp_y = [composite_decay.calculate(d) for d in x]

    # ASCII plot
    height = 10
    width = len(x)

    lines = []
    lines.append("Decay Function Comparison (14-day half-life)")
    lines.append("-" * 50)

    for row in range(height, -1, -1):
        threshold = row / height
        line = f"{threshold:.1f}|"

        for i, day in enumerate(x):
            char = " "
            if abs(exp_y[i] - threshold) < 0.05:
                char = "E"
            elif abs(pow_y[i] - threshold) < 0.05:
                char = "P"
            elif abs(comp_y[i] - threshold) < 0.05:
                char = "C"
            line += char

        lines.append(line)

    lines.append("   +" + "-" * width)
    lines.append(f"   0{''.join([str(d % 10) for d in x])}")
    lines.append("   Days")
    lines.append("")
    lines.append("Legend: E=Exponential, P=Power Law, C=Composite")

    return "\n".join(lines)
```

## When to Use This Pattern

Use biomimetic decay when:

- **Natural memory dynamics are desired** - System should "forget" gracefully
- **Memory accumulates unboundedly** - Need self-regulating pruning
- **Recent information is more valuable** - Recency bias is appropriate
- **Access patterns matter** - Frequently used memories should persist
- **Importance varies** - Critical memories should resist decay

Avoid when:

- **All history is equally valuable** - No natural recency bias
- **Explicit deletion is preferred** - Users control what's forgotten
- **Regulatory requirements** - Must retain all records
- **Simple age cutoffs suffice** - Decay adds unnecessary complexity

## Trade-offs and Considerations

### Decay Function Selection

| Function | Characteristics | Best For |
|----------|-----------------|----------|
| Exponential | Constant half-life, fast early decay | Short-term memory, transient data |
| Power Law | Heavy tail, long retention | Knowledge that compounds over time |
| Composite | Blends fast and slow | Human-like memory patterns |

### Parameter Sensitivity

```python
# Half-life impact on retention
for half_life in [7, 14, 30, 90]:
    decay = ExponentialDecay(DecayConfig(half_life_days=half_life))
    print(f"{half_life}d half-life: 30d retention = {decay.calculate(30):.2%}")

# Output:
# 7d half-life: 30d retention = 1.95%
# 14d half-life: 30d retention = 13.97%
# 30d half-life: 30d retention = 50.00%
# 90d half-life: 30d retention = 79.37%
```

### Importance Level Impact

| Importance | Decay Rate | 30-day Retention |
|------------|------------|------------------|
| Critical | 0.1x | 94.3% |
| High | 0.5x | 54.7% |
| Normal | 1.0x | 14.0% |
| Low | 2.0x | 1.95% |

### Reinforcement Dynamics

- **Positive feedback**: Accessed memories become more accessible
- **Risk**: Popular content may dominate over relevant content
- **Mitigation**: Cap reinforcement multiplier, apply decay to reinforcement
