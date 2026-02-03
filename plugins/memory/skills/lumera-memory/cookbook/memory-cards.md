# Memory Card Generation

Deterministic memory card generation for intelligent search without LLM overhead.

## Purpose

Memory cards are lightweight summaries generated deterministically from session content. They enable rich search results, session previews, and contextual relevance scoring without requiring LLM calls or network requests. Every stored session gets a memory card that captures its essence through simple heuristics.

## Variables

```yaml
TITLE_MAX_LENGTH: 80
SUMMARY_BULLET_COUNT: 3
SUMMARY_BULLET_MAX_LENGTH: 100
KEYWORD_MIN_LENGTH: 5
KEYWORD_TOP_N: 10
ENTITY_MIN_LENGTH: 3
DECISION_KEYWORDS: ["decided", "decision", "will use", "chosen", "selected", "going with"]
TODO_KEYWORDS: ["todo", "need to", "should", "must", "will need", "remember to"]
```

## Instructions

### 1. Memory Card Structure

```python
from dataclasses import dataclass, field

@dataclass
class MemoryCard:
    """Deterministic session summary card."""

    # Primary identification
    title: str  # First user message, truncated to 80 chars

    # Content summary
    summary_bullets: list[str] = field(default_factory=list)  # First 3 messages

    # Extracted intelligence
    decisions: list[str] = field(default_factory=list)  # Decision statements
    todos: list[str] = field(default_factory=list)  # Action items
    entities: list[str] = field(default_factory=list)  # Proper nouns
    keywords: list[str] = field(default_factory=list)  # Frequent meaningful words
    notable_quotes: list[str] = field(default_factory=list)  # Questions/exclamations

    def to_dict(self) -> dict:
        return {
            "title": self.title,
            "summary_bullets": self.summary_bullets,
            "decisions": self.decisions,
            "todos": self.todos,
            "entities": list(self.entities),
            "keywords": self.keywords,
            "notable_quotes": self.notable_quotes
        }
```

### 2. Complete Generation Algorithm

```python
import re
from collections import Counter
from typing import Optional

def generate_memory_card(session_data: dict) -> MemoryCard:
    """
    Generate a deterministic memory card from session data.

    The algorithm extracts:
    - Title from first user message
    - Summary from first 3 messages
    - Decisions from keyword detection
    - TODOs from action item patterns
    - Entities from capitalized words
    - Keywords from word frequency
    - Notable quotes from punctuation patterns
    """
    messages = session_data.get("messages", [])

    # Collect all text content
    text_parts = []
    for msg in messages:
        content = msg.get("content", "")
        if isinstance(content, str):
            text_parts.append(content)
    full_text = " ".join(text_parts)

    # 1. Extract Title
    title = _extract_title(messages)

    # 2. Generate Summary Bullets
    summary_bullets = _generate_summary_bullets(messages)

    # 3. Detect Decisions
    decisions = _detect_decisions(messages)

    # 4. Detect TODOs
    todos = _detect_todos(messages)

    # 5. Extract Entities
    entities = _extract_entities(full_text)

    # 6. Extract Keywords
    keywords = _extract_keywords(full_text)

    # 7. Find Notable Quotes
    notable_quotes = _find_notable_quotes(messages)

    return MemoryCard(
        title=title,
        summary_bullets=summary_bullets,
        decisions=decisions,
        todos=todos,
        entities=entities,
        keywords=keywords,
        notable_quotes=notable_quotes
    )
```

### 3. Title Extraction

```python
def _extract_title(messages: list[dict], max_length: int = 80) -> str:
    """
    Extract title from first user message.

    Truncates at word boundary if possible.
    """
    for msg in messages:
        if msg.get("role") == "user":
            content = msg.get("content", "")
            if isinstance(content, str) and len(content) > 0:
                if len(content) <= max_length:
                    return content

                # Truncate at word boundary
                truncated = content[:max_length]
                last_space = truncated.rfind(" ")
                if last_space > max_length * 0.7:  # Keep at least 70%
                    truncated = truncated[:last_space]

                return truncated + "..."

    return "Untitled Session"
```

### 4. Summary Bullet Generation

```python
def _generate_summary_bullets(
    messages: list[dict],
    count: int = 3,
    max_length: int = 100
) -> list[str]:
    """
    Generate summary bullets from first N messages.

    Format: "[role]: content..."
    """
    bullets = []

    for msg in messages[:count]:
        role = msg.get("role", "unknown")
        content = msg.get("content", "")

        if isinstance(content, str):
            # Truncate content
            snippet = content[:max_length]
            if len(content) > max_length:
                snippet = snippet.rstrip() + "..."

            # Clean up whitespace
            snippet = " ".join(snippet.split())

            bullets.append(f"[{role}] {snippet}")

    return bullets
```

### 5. Decision Detection

```python
DECISION_KEYWORDS = [
    "decided", "decision", "will use", "chosen", "selected",
    "going with", "opted for", "settled on", "concluded",
    "determined", "resolved to"
]

def _detect_decisions(
    messages: list[dict],
    max_count: int = 3,
    max_length: int = 100
) -> list[str]:
    """
    Detect decision statements using keyword matching.
    """
    decisions = []

    for msg in messages:
        content = str(msg.get("content", "")).lower()

        # Check for decision keywords
        if any(kw in content for kw in DECISION_KEYWORDS):
            original_content = str(msg.get("content", ""))
            snippet = original_content[:max_length]
            if len(original_content) > max_length:
                snippet += "..."
            decisions.append(snippet)

            if len(decisions) >= max_count:
                break

    return decisions
```

### 6. TODO Detection

```python
TODO_KEYWORDS = [
    "todo", "need to", "should", "must", "will need",
    "remember to", "don't forget", "make sure to",
    "action item", "follow up", "next step"
]

def _detect_todos(
    messages: list[dict],
    max_count: int = 3,
    max_length: int = 100
) -> list[str]:
    """
    Detect action items using keyword matching.
    """
    todos = []

    for msg in messages:
        content = str(msg.get("content", "")).lower()

        if any(kw in content for kw in TODO_KEYWORDS):
            original_content = str(msg.get("content", ""))
            snippet = original_content[:max_length]
            if len(original_content) > max_length:
                snippet += "..."
            todos.append(snippet)

            if len(todos) >= max_count:
                break

    return todos
```

### 7. Entity Extraction

```python
def _extract_entities(
    text: str,
    min_length: int = 3,
    max_count: int = 10
) -> list[str]:
    """
    Extract entities using capitalization heuristics.

    Detects: Proper nouns, technology names, product names.
    """
    entities = set()

    # Split by whitespace and punctuation
    words = re.findall(r'\b[A-Z][a-zA-Z]*\b', text)

    for word in words:
        # Skip if too short
        if len(word) < min_length:
            continue

        # Skip common sentence starters
        common_starters = {"I", "The", "This", "That", "It", "We", "You", "They"}
        if word in common_starters:
            continue

        entities.add(word)

    # Sort by frequency in original text
    entity_counts = Counter(
        w for w in text.split()
        if w in entities
    )

    sorted_entities = sorted(
        entities,
        key=lambda e: entity_counts.get(e, 0),
        reverse=True
    )

    return sorted_entities[:max_count]
```

### 8. Keyword Extraction

```python
# Common words to skip
STOP_WORDS = {
    "the", "and", "for", "are", "but", "not", "you", "all",
    "can", "had", "her", "was", "one", "our", "out", "has",
    "have", "been", "would", "could", "should", "will", "with",
    "this", "that", "from", "they", "which", "their", "what",
    "there", "about", "when", "make", "like", "just", "over",
    "into", "also", "some", "than", "them", "then", "very",
    "after", "before", "being", "other", "those", "these"
}

def _extract_keywords(
    text: str,
    min_length: int = 5,
    top_n: int = 10
) -> list[str]:
    """
    Extract keywords using word frequency.

    Filters: Stop words, short words, numbers.
    """
    # Normalize and tokenize
    words = text.lower().split()

    # Clean and filter
    cleaned_words = []
    for word in words:
        # Remove punctuation
        word = re.sub(r'[^\w]', '', word)

        # Skip if too short or is stop word
        if len(word) >= min_length and word not in STOP_WORDS:
            # Skip if mostly numbers
            if not re.match(r'^\d+$', word):
                cleaned_words.append(word)

    # Count frequencies
    word_freq = Counter(cleaned_words)

    # Return top N
    return [word for word, _ in word_freq.most_common(top_n)]
```

### 9. Notable Quote Detection

```python
def _find_notable_quotes(
    messages: list[dict],
    max_count: int = 3,
    max_length: int = 100
) -> list[str]:
    """
    Find notable quotes (questions, exclamations, emphatic statements).
    """
    quotes = []

    for msg in messages:
        content = str(msg.get("content", ""))

        # Check for questions or exclamations
        if "?" in content or "!" in content:
            snippet = content[:max_length]
            if len(content) > max_length:
                snippet += "..."
            quotes.append(snippet)

            if len(quotes) >= max_count:
                break

    return quotes
```

## Common Patterns

### Memory Card for Search Indexing

```python
def index_memory_card(card: MemoryCard, index) -> None:
    """
    Index memory card fields for full-text search.

    Strategy: Weight title and keywords higher than content.
    """
    # Combine searchable text
    searchable_text = " ".join([
        card.title,
        card.title,  # Double-weight title
        " ".join(card.keywords),
        " ".join(card.keywords),  # Double-weight keywords
        " ".join(card.summary_bullets),
        " ".join(card.entities),
        " ".join(card.decisions),
        " ".join(card.todos)
    ])

    index.add_document(
        title=card.title,
        content=searchable_text,
        keywords=" ".join(card.keywords)
    )
```

### Memory Card Preview Rendering

```python
def render_card_preview(card: MemoryCard) -> str:
    """Render memory card as readable text preview."""

    lines = [
        f"# {card.title}",
        "",
        "## Summary",
    ]

    for bullet in card.summary_bullets:
        lines.append(f"- {bullet}")

    if card.decisions:
        lines.append("")
        lines.append("## Decisions")
        for decision in card.decisions:
            lines.append(f"- {decision}")

    if card.todos:
        lines.append("")
        lines.append("## Action Items")
        for todo in card.todos:
            lines.append(f"- [ ] {todo}")

    if card.keywords:
        lines.append("")
        lines.append(f"**Keywords:** {', '.join(card.keywords)}")

    if card.entities:
        lines.append(f"**Entities:** {', '.join(card.entities)}")

    return "\n".join(lines)
```

### Memory Card Comparison

```python
def compare_cards(card1: MemoryCard, card2: MemoryCard) -> float:
    """
    Calculate similarity between two memory cards.

    Returns: Similarity score 0.0 to 1.0
    """
    # Keyword overlap
    keywords1 = set(card1.keywords)
    keywords2 = set(card2.keywords)
    keyword_overlap = len(keywords1 & keywords2) / max(len(keywords1 | keywords2), 1)

    # Entity overlap
    entities1 = set(card1.entities)
    entities2 = set(card2.entities)
    entity_overlap = len(entities1 & entities2) / max(len(entities1 | entities2), 1)

    # Combined score (weighted average)
    return 0.6 * keyword_overlap + 0.4 * entity_overlap
```

### Merging Related Sessions

```python
def merge_memory_cards(cards: list[MemoryCard]) -> MemoryCard:
    """
    Merge multiple related memory cards into one.

    Useful for summarizing conversation threads.
    """
    if not cards:
        raise ValueError("No cards to merge")

    if len(cards) == 1:
        return cards[0]

    # Use first card's title
    title = cards[0].title

    # Combine summaries (deduplicate)
    all_bullets = []
    seen_bullets = set()
    for card in cards:
        for bullet in card.summary_bullets:
            normalized = bullet.lower().strip()
            if normalized not in seen_bullets:
                all_bullets.append(bullet)
                seen_bullets.add(normalized)

    # Combine and deduplicate other fields
    all_decisions = list(dict.fromkeys(
        d for card in cards for d in card.decisions
    ))
    all_todos = list(dict.fromkeys(
        t for card in cards for t in card.todos
    ))

    # Merge keywords by frequency
    keyword_counts = Counter()
    for card in cards:
        keyword_counts.update(card.keywords)
    merged_keywords = [kw for kw, _ in keyword_counts.most_common(10)]

    # Merge entities
    all_entities = list(set(
        e for card in cards for e in card.entities
    ))[:10]

    return MemoryCard(
        title=title,
        summary_bullets=all_bullets[:5],
        decisions=all_decisions[:5],
        todos=all_todos[:5],
        entities=all_entities,
        keywords=merged_keywords,
        notable_quotes=[]
    )
```

## Testing Memory Cards

```python
import pytest

def test_title_extraction():
    """Title should come from first user message."""
    session = {
        "messages": [
            {"role": "user", "content": "Deploy the API to production"},
            {"role": "assistant", "content": "I'll help with that."}
        ]
    }

    card = generate_memory_card(session)
    assert card.title == "Deploy the API to production"

def test_title_truncation():
    """Long titles should be truncated with ellipsis."""
    long_content = "A" * 100  # 100 chars
    session = {
        "messages": [{"role": "user", "content": long_content}]
    }

    card = generate_memory_card(session)
    assert len(card.title) <= 83  # 80 + "..."
    assert card.title.endswith("...")

def test_keyword_extraction():
    """Keywords should be frequent, meaningful words."""
    session = {
        "messages": [{
            "role": "user",
            "content": "Deploy deploy deploy the application application to production"
        }]
    }

    card = generate_memory_card(session)
    assert "deploy" in card.keywords
    assert "application" in card.keywords

def test_decision_detection():
    """Decision statements should be detected."""
    session = {
        "messages": [{
            "role": "assistant",
            "content": "I've decided to use PostgreSQL for the database."
        }]
    }

    card = generate_memory_card(session)
    assert len(card.decisions) > 0
    assert "PostgreSQL" in card.decisions[0]

def test_entity_extraction():
    """Capitalized proper nouns should be extracted."""
    session = {
        "messages": [{
            "role": "user",
            "content": "Deploy to AWS using Docker and Kubernetes."
        }]
    }

    card = generate_memory_card(session)
    assert "AWS" in card.entities
    assert "Docker" in card.entities
    assert "Kubernetes" in card.entities
```

## Related Resources

- `prompts/memory_card_template.md` - Template for card fields
- `cookbook/quickstart.md` - Using cards in storage workflow
- `cookbook/cascade-storage.md` - Cards in the indexing layer
