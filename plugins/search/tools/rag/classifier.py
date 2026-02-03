"""Query classifier to detect answerable vs unanswerable queries."""
from dataclasses import dataclass
from enum import Enum


class QueryType(Enum):
    """Classification of query types for routing."""
    KNOWLEDGE = "knowledge"      # Standalone info queries → RAG
    CONTEXT = "context"          # Requires conversation history
    ACTION = "action"            # Requests action, not info
    DEBUGGING = "debugging"      # Runtime state, not indexed


@dataclass
class QueryClassification:
    """Result of query classification."""
    query_type: QueryType
    confidence: float
    reason: str
    should_retrieve: bool


class QueryClassifier:
    """
    Classify queries to determine if RAG retrieval is appropriate.

    Key insight: Many real user queries are NOT answerable by static retrieval:
    - Context-dependent ("Where is it?", "How does this work?")
    - Action requests ("Can you make X bold?")
    - Runtime debugging ("Why is X not working right now?")

    Only standalone knowledge queries benefit from RAG.
    """

    # Pronouns that indicate context-dependency
    CONTEXT_PRONOUNS = {"it", "this", "that", "these", "those"}

    # Phrases that indicate context-dependency
    CONTEXT_PHRASES = [
        "the above", "mentioned", "discussed",
        "right now", "currently",
        "our work", "we worked", "we did",
    ]

    # Patterns indicating action requests (not info-seeking)
    ACTION_MARKERS = [
        "can you make", "can you change", "can you add",
        "can you create", "can you update", "can you fix",
        "can you write", "can you journal",
        "please write", "please create", "please make",
        "want to use", "need to", "should we",
    ]

    # Patterns indicating runtime debugging
    DEBUG_MARKERS = [
        "not working", "why is", "why are", "why did",
        "what happened", "broken", "error", "failed",
        "not showing", "stopped working",
        "did the", "did it", "did you",  # Past-tense debugging
    ]

    # Patterns indicating knowledge queries (only if no context markers)
    KNOWLEDGE_MARKERS = [
        "what is the", "what are the", "what does the",
        "how does the", "how do hooks", "how do plugins",
        "explain the", "describe the", "tell me about the",
        "where is the", "where are the",
    ]

    def _tokenize(self, text: str) -> set[str]:
        """Tokenize text, stripping punctuation."""
        import re
        # Split on non-alphanumeric, keep words only
        return set(re.findall(r"[a-z]+", text.lower()))

    def classify(self, query: str) -> QueryClassification:
        """Classify a query to determine retrieval strategy."""
        query_lower = query.lower()
        words = self._tokenize(query)

        # Check for action requests first (highest priority)
        for marker in self.ACTION_MARKERS:
            if marker in query_lower:
                return QueryClassification(
                    query_type=QueryType.ACTION,
                    confidence=0.8,
                    reason=f"Contains action marker: '{marker}'",
                    should_retrieve=False
                )

        # Check for debugging queries
        for marker in self.DEBUG_MARKERS:
            if marker in query_lower:
                return QueryClassification(
                    query_type=QueryType.DEBUGGING,
                    confidence=0.7,
                    reason=f"Contains debug marker: '{marker}'",
                    should_retrieve=False
                )

        # Check for context-dependent pronouns
        has_pronoun = bool(words & self.CONTEXT_PRONOUNS)

        # Check for context phrases
        has_context_phrase = any(p in query_lower for p in self.CONTEXT_PHRASES)

        # If query has context markers and is short/vague, reject
        if has_pronoun or has_context_phrase:
            # Look for specific entity names that might make it answerable
            # Entities typically have capital letters in the original query
            # Skip first word (sentence capitalization) and common words
            query_words = query.split()
            non_first_words = query_words[1:] if len(query_words) > 1 else []
            has_entity = any(
                w[0].isupper() and len(w) > 2 and w.isalpha()
                for w in non_first_words
            )

            if not has_entity:
                return QueryClassification(
                    query_type=QueryType.CONTEXT,
                    confidence=0.7,
                    reason=f"Context-dependent: {'pronoun' if has_pronoun else 'phrase'}",
                    should_retrieve=False
                )

        # Check for knowledge queries
        for marker in self.KNOWLEDGE_MARKERS:
            if marker in query_lower:
                return QueryClassification(
                    query_type=QueryType.KNOWLEDGE,
                    confidence=0.8,
                    reason=f"Contains knowledge marker: '{marker}'",
                    should_retrieve=True
                )

        # Default: uncertain, try retrieval with lower confidence
        return QueryClassification(
            query_type=QueryType.KNOWLEDGE,
            confidence=0.5,
            reason="No clear markers, defaulting to knowledge query",
            should_retrieve=True
        )
