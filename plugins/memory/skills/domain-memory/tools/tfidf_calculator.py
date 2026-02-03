#!/usr/bin/env python3
"""
Standalone TF-IDF Calculator

A pure Python implementation of TF-IDF (Term Frequency-Inverse Document Frequency)
for text search and document ranking. Zero external dependencies.

This implementation mirrors the Domain Memory Agent MCP server's algorithm,
allowing offline experimentation, debugging, and custom integrations.

Usage:
    calculator = TFIDFCalculator()
    calculator.add_document("doc1", "Python is a programming language")
    calculator.add_document("doc2", "JavaScript is also a programming language")
    results = calculator.search("Python programming")

Author: Domain Memory Agent
License: MIT
"""

import math
import re
from collections import Counter
from dataclasses import dataclass, field
from typing import Optional


# =============================================================================
# Stop Words
# =============================================================================

STOP_WORDS = frozenset([
    "a", "an", "and", "are", "as", "at", "be", "by", "for", "from",
    "has", "he", "in", "is", "it", "its", "of", "on", "or", "that",
    "the", "to", "was", "were", "will", "with", "this", "they", "but",
    "have", "had", "what", "when", "where", "who", "which", "why", "how",
    "all", "each", "every", "both", "few", "more", "most", "other", "some",
    "such", "no", "nor", "not", "only", "own", "same", "so", "than", "too",
    "very", "can", "just", "should", "now", "also", "into", "over", "after",
    "before", "between", "under", "again", "further", "then", "once", "here",
    "there", "any", "about", "above", "below", "up", "down", "out", "off",
])


# =============================================================================
# Data Classes
# =============================================================================

@dataclass
class Document:
    """Represents an indexed document."""
    id: str
    content: str
    tokens: list[str] = field(default_factory=list)
    term_frequencies: dict[str, float] = field(default_factory=dict)
    metadata: dict = field(default_factory=dict)


@dataclass
class SearchResult:
    """Represents a search result with scoring details."""
    doc_id: str
    score: float
    matched_terms: list[str]
    term_scores: dict[str, float]
    excerpts: list[str] = field(default_factory=list)


@dataclass
class TFIDFStats:
    """Statistics about the TF-IDF index."""
    total_documents: int
    total_terms: int
    unique_terms: int
    avg_document_length: float
    term_distribution: dict[str, int]


# =============================================================================
# TF-IDF Calculator
# =============================================================================

class TFIDFCalculator:
    """
    Pure Python TF-IDF implementation for document search and ranking.

    Features:
    - Zero external dependencies
    - Configurable tokenization
    - Stop word filtering
    - Minimum term length filtering
    - Document frequency smoothing
    - Explainable scoring

    Example:
        calc = TFIDFCalculator()
        calc.add_document("doc1", "Machine learning is transforming software")
        calc.add_document("doc2", "Deep learning uses neural networks")
        calc.add_document("doc3", "Python is great for machine learning")

        results = calc.search("machine learning Python")
        for r in results:
            print(f"{r.doc_id}: {r.score:.4f} - matched: {r.matched_terms}")
    """

    def __init__(
        self,
        min_term_length: int = 3,
        use_stop_words: bool = True,
        custom_stop_words: Optional[set[str]] = None
    ):
        """
        Initialize the TF-IDF calculator.

        Args:
            min_term_length: Minimum token length to include
            use_stop_words: Whether to filter stop words
            custom_stop_words: Additional stop words to filter
        """
        self.min_term_length = min_term_length
        self.use_stop_words = use_stop_words
        self.stop_words = STOP_WORDS.copy()
        if custom_stop_words:
            self.stop_words = self.stop_words | custom_stop_words

        # Document storage
        self._documents: dict[str, Document] = {}

        # TF-IDF index structures
        self._term_frequencies: dict[str, dict[str, float]] = {}  # term -> {doc_id: tf}
        self._document_frequencies: dict[str, int] = {}  # term -> doc count
        self._document_lengths: dict[str, int] = {}  # doc_id -> token count

    # =========================================================================
    # Tokenization
    # =========================================================================

    def tokenize(self, text: str) -> list[str]:
        """
        Tokenize text into normalized tokens.

        Process:
        1. Convert to lowercase
        2. Replace punctuation with spaces
        3. Split on whitespace
        4. Filter by minimum length
        5. Remove stop words (if enabled)

        Args:
            text: Input text to tokenize

        Returns:
            List of normalized tokens
        """
        # Lowercase and remove punctuation
        text = text.lower()
        text = re.sub(r'[^\w\s]', ' ', text)

        # Split and filter
        tokens = text.split()
        tokens = [t for t in tokens if len(t) >= self.min_term_length]

        if self.use_stop_words:
            tokens = [t for t in tokens if t not in self.stop_words]

        return tokens

    # =========================================================================
    # Document Operations
    # =========================================================================

    def add_document(
        self,
        doc_id: str,
        content: str,
        metadata: Optional[dict] = None
    ) -> Document:
        """
        Add a document to the index.

        Args:
            doc_id: Unique document identifier
            content: Document text content
            metadata: Optional metadata dictionary

        Returns:
            The indexed Document object
        """
        # Remove existing document if present
        if doc_id in self._documents:
            self.remove_document(doc_id)

        # Tokenize
        tokens = self.tokenize(content)
        token_counts = Counter(tokens)
        total_tokens = len(tokens)

        # Calculate term frequencies (normalized by document length)
        term_frequencies = {}
        if total_tokens > 0:
            term_frequencies = {
                term: count / total_tokens
                for term, count in token_counts.items()
            }

        # Create document
        doc = Document(
            id=doc_id,
            content=content,
            tokens=tokens,
            term_frequencies=term_frequencies,
            metadata=metadata or {}
        )
        self._documents[doc_id] = doc

        # Update index
        self._document_lengths[doc_id] = total_tokens

        for term in set(tokens):
            # Update term -> doc_id -> tf mapping
            if term not in self._term_frequencies:
                self._term_frequencies[term] = {}
            self._term_frequencies[term][doc_id] = term_frequencies[term]

            # Update document frequency
            self._document_frequencies[term] = \
                self._document_frequencies.get(term, 0) + 1

        return doc

    def remove_document(self, doc_id: str) -> bool:
        """
        Remove a document from the index.

        Args:
            doc_id: Document ID to remove

        Returns:
            True if document was removed, False if not found
        """
        if doc_id not in self._documents:
            return False

        doc = self._documents[doc_id]

        # Update index
        for term in set(doc.tokens):
            # Remove from term frequencies
            if term in self._term_frequencies:
                self._term_frequencies[term].pop(doc_id, None)
                if not self._term_frequencies[term]:
                    del self._term_frequencies[term]

            # Update document frequency
            if term in self._document_frequencies:
                self._document_frequencies[term] -= 1
                if self._document_frequencies[term] <= 0:
                    del self._document_frequencies[term]

        # Remove document
        del self._documents[doc_id]
        del self._document_lengths[doc_id]

        return True

    def get_document(self, doc_id: str) -> Optional[Document]:
        """Get a document by ID."""
        return self._documents.get(doc_id)

    def list_documents(self) -> list[str]:
        """List all document IDs."""
        return list(self._documents.keys())

    # =========================================================================
    # TF-IDF Calculations
    # =========================================================================

    def calculate_idf(self, term: str) -> float:
        """
        Calculate Inverse Document Frequency for a term.

        IDF(term) = log((N + 1) / (DF(term) + 1))

        Args:
            term: The term to calculate IDF for

        Returns:
            IDF value (higher = rarer term)
        """
        total_docs = len(self._documents)
        doc_freq = self._document_frequencies.get(term, 0)

        # Smoothed IDF to prevent division by zero and log(1)=0
        return math.log((total_docs + 1) / (doc_freq + 1))

    def calculate_tfidf(self, term: str, doc_id: str) -> float:
        """
        Calculate TF-IDF score for a term in a document.

        TF-IDF = TF(term, doc) * IDF(term)

        Args:
            term: The term
            doc_id: The document ID

        Returns:
            TF-IDF score
        """
        # Get term frequency
        tf = 0.0
        if term in self._term_frequencies:
            tf = self._term_frequencies[term].get(doc_id, 0.0)

        # Get IDF
        idf = self.calculate_idf(term)

        return tf * idf

    def calculate_query_score(
        self,
        query_tokens: list[str],
        doc_id: str
    ) -> tuple[float, dict[str, float], list[str]]:
        """
        Calculate total TF-IDF score for a query against a document.

        Args:
            query_tokens: Tokenized query terms
            doc_id: Document to score

        Returns:
            Tuple of (total_score, term_scores, matched_terms)
        """
        total_score = 0.0
        term_scores = {}
        matched_terms = []

        for term in query_tokens:
            score = self.calculate_tfidf(term, doc_id)
            term_scores[term] = score
            total_score += score

            if score > 0:
                matched_terms.append(term)

        return total_score, term_scores, matched_terms

    # =========================================================================
    # Search
    # =========================================================================

    def search(
        self,
        query: str,
        limit: int = 10,
        min_score: float = 0.0,
        include_excerpts: bool = True,
        max_excerpts: int = 3
    ) -> list[SearchResult]:
        """
        Search documents using TF-IDF ranking.

        Args:
            query: Search query string
            limit: Maximum results to return
            min_score: Minimum score threshold
            include_excerpts: Whether to extract relevant excerpts
            max_excerpts: Maximum excerpts per result

        Returns:
            List of SearchResult objects, sorted by score descending
        """
        query_tokens = self.tokenize(query)
        if not query_tokens:
            return []

        results = []

        for doc_id in self._documents:
            score, term_scores, matched_terms = self.calculate_query_score(
                query_tokens, doc_id
            )

            if score >= min_score:
                excerpts = []
                if include_excerpts:
                    excerpts = self._extract_excerpts(
                        doc_id, query_tokens, max_excerpts
                    )

                results.append(SearchResult(
                    doc_id=doc_id,
                    score=score,
                    matched_terms=matched_terms,
                    term_scores=term_scores,
                    excerpts=excerpts
                ))

        # Sort by score descending
        results.sort(key=lambda x: x.score, reverse=True)

        return results[:limit]

    def _extract_excerpts(
        self,
        doc_id: str,
        query_tokens: list[str],
        max_excerpts: int = 3
    ) -> list[str]:
        """
        Extract relevant sentence excerpts from a document.

        Args:
            doc_id: Document ID
            query_tokens: Query terms to match
            max_excerpts: Maximum excerpts to return

        Returns:
            List of relevant sentences
        """
        doc = self._documents.get(doc_id)
        if not doc:
            return []

        # Split into sentences
        sentences = re.split(r'[.!?]+', doc.content)
        sentences = [s.strip() for s in sentences if len(s.strip()) > 20]

        if not sentences:
            return []

        # Score sentences by query term presence
        query_set = set(query_tokens)
        scored = []

        for sentence in sentences:
            sentence_tokens = set(self.tokenize(sentence))
            match_count = len(sentence_tokens & query_set)
            scored.append((sentence, match_count))

        # Sort by match count and return top excerpts
        scored.sort(key=lambda x: x[1], reverse=True)
        return [s for s, _ in scored[:max_excerpts] if _ > 0]

    # =========================================================================
    # Extractive Summarization
    # =========================================================================

    def summarize(
        self,
        doc_id: str,
        max_sentences: int = 5
    ) -> str:
        """
        Generate extractive summary of a document.

        Selects the most important sentences based on term frequency
        and position boosting.

        Args:
            doc_id: Document ID to summarize
            max_sentences: Maximum sentences in summary

        Returns:
            Summary string
        """
        doc = self._documents.get(doc_id)
        if not doc:
            return ""

        return self.summarize_text(doc.content, max_sentences)

    def summarize_text(
        self,
        content: str,
        max_sentences: int = 5
    ) -> str:
        """
        Generate extractive summary of text content.

        Args:
            content: Text content to summarize
            max_sentences: Maximum sentences in summary

        Returns:
            Summary string
        """
        # Split into sentences
        sentences = re.split(r'[.!?]+', content)
        sentences = [s.strip() for s in sentences if len(s.strip()) > 20]

        if len(sentences) <= max_sentences:
            return ". ".join(sentences) + "." if sentences else ""

        # Calculate term frequencies for entire document
        all_tokens = self.tokenize(content)
        term_freq = Counter(all_tokens)

        # Score each sentence
        scored = []
        for index, sentence in enumerate(sentences):
            sentence_tokens = self.tokenize(sentence)

            # Score by term frequency
            score = sum(term_freq.get(t, 0) for t in sentence_tokens)

            # Position boost for first and last sentences
            if index == 0 or index == len(sentences) - 1:
                score *= 1.2

            scored.append((sentence, score, index))

        # Select top sentences, maintain original order
        top = sorted(scored, key=lambda x: x[1], reverse=True)[:max_sentences]
        ordered = sorted(top, key=lambda x: x[2])

        return ". ".join(s for s, _, _ in ordered) + "."

    # =========================================================================
    # Statistics and Debugging
    # =========================================================================

    def get_stats(self) -> TFIDFStats:
        """
        Get statistics about the TF-IDF index.

        Returns:
            TFIDFStats object with index statistics
        """
        total_docs = len(self._documents)
        total_terms = sum(self._document_lengths.values())
        unique_terms = len(self._term_frequencies)
        avg_length = total_terms / total_docs if total_docs > 0 else 0

        # Term distribution (top terms by document frequency)
        term_dist = dict(
            sorted(
                self._document_frequencies.items(),
                key=lambda x: x[1],
                reverse=True
            )[:50]
        )

        return TFIDFStats(
            total_documents=total_docs,
            total_terms=total_terms,
            unique_terms=unique_terms,
            avg_document_length=avg_length,
            term_distribution=term_dist
        )

    def explain_score(
        self,
        query: str,
        doc_id: str
    ) -> dict:
        """
        Explain how a document's score was calculated.

        Args:
            query: Search query
            doc_id: Document ID

        Returns:
            Dictionary with detailed scoring breakdown
        """
        query_tokens = self.tokenize(query)
        doc = self._documents.get(doc_id)

        if not doc:
            return {"error": f"Document {doc_id} not found"}

        explanation = {
            "query": query,
            "query_tokens": query_tokens,
            "doc_id": doc_id,
            "doc_length": self._document_lengths.get(doc_id, 0),
            "total_documents": len(self._documents),
            "term_breakdown": []
        }

        total_score = 0.0

        for term in query_tokens:
            tf = 0.0
            if term in self._term_frequencies:
                tf = self._term_frequencies[term].get(doc_id, 0.0)

            df = self._document_frequencies.get(term, 0)
            idf = self.calculate_idf(term)
            tfidf = tf * idf

            total_score += tfidf

            explanation["term_breakdown"].append({
                "term": term,
                "tf": round(tf, 6),
                "df": df,
                "idf": round(idf, 6),
                "tfidf": round(tfidf, 6),
                "in_document": tf > 0
            })

        explanation["total_score"] = round(total_score, 6)

        return explanation

    def get_term_info(self, term: str) -> dict:
        """
        Get information about a specific term in the index.

        Args:
            term: Term to look up

        Returns:
            Dictionary with term statistics
        """
        term = term.lower()

        df = self._document_frequencies.get(term, 0)
        idf = self.calculate_idf(term)

        documents_containing = []
        if term in self._term_frequencies:
            for doc_id, tf in self._term_frequencies[term].items():
                documents_containing.append({
                    "doc_id": doc_id,
                    "tf": round(tf, 6),
                    "tfidf": round(tf * idf, 6)
                })
            documents_containing.sort(key=lambda x: x["tfidf"], reverse=True)

        return {
            "term": term,
            "document_frequency": df,
            "idf": round(idf, 6),
            "total_documents": len(self._documents),
            "documents_containing": documents_containing
        }


# =============================================================================
# Command Line Interface
# =============================================================================

def main():
    """Demonstrate TF-IDF calculator functionality."""
    print("TF-IDF Calculator Demo\n" + "=" * 50)

    # Create calculator
    calc = TFIDFCalculator()

    # Add sample documents
    documents = [
        ("doc1", "Python is a high-level programming language known for its readability"),
        ("doc2", "Machine learning uses algorithms to learn patterns from data"),
        ("doc3", "Python is widely used in machine learning and data science"),
        ("doc4", "JavaScript is the language of the web and runs in browsers"),
        ("doc5", "Deep learning is a subset of machine learning using neural networks"),
    ]

    print("\nIndexing documents...")
    for doc_id, content in documents:
        calc.add_document(doc_id, content)
        print(f"  Added: {doc_id}")

    # Show stats
    stats = calc.get_stats()
    print(f"\nIndex Statistics:")
    print(f"  Documents: {stats.total_documents}")
    print(f"  Unique terms: {stats.unique_terms}")
    print(f"  Avg doc length: {stats.avg_document_length:.1f} tokens")

    # Search examples
    queries = [
        "Python programming",
        "machine learning algorithms",
        "neural networks deep learning",
    ]

    for query in queries:
        print(f"\n{'=' * 50}")
        print(f"Query: '{query}'")
        print("-" * 50)

        results = calc.search(query, limit=3)

        if not results:
            print("  No results found")
            continue

        for result in results:
            print(f"\n  {result.doc_id} (score: {result.score:.4f})")
            print(f"    Matched terms: {result.matched_terms}")
            if result.excerpts:
                print(f"    Excerpt: {result.excerpts[0][:80]}...")

    # Explain scoring for one result
    print(f"\n{'=' * 50}")
    print("Score Explanation for 'Python machine learning' -> doc3:")
    print("-" * 50)

    explanation = calc.explain_score("Python machine learning", "doc3")
    for term_info in explanation["term_breakdown"]:
        status = "MATCH" if term_info["in_document"] else "MISS"
        print(f"  {term_info['term']:15} TF={term_info['tf']:.4f} "
              f"IDF={term_info['idf']:.4f} -> {term_info['tfidf']:.4f} [{status}]")
    print(f"  {'TOTAL':15} {'':24} -> {explanation['total_score']:.4f}")

    # Summarization demo
    print(f"\n{'=' * 50}")
    print("Summarization Demo")
    print("-" * 50)

    long_text = """
    Machine learning is a subset of artificial intelligence that enables systems
    to learn and improve from experience. Traditional programming requires explicit
    instructions for every scenario. Machine learning instead identifies patterns
    in data to make predictions. Supervised learning uses labeled training data.
    Unsupervised learning discovers hidden patterns without labels. Reinforcement
    learning learns through trial and error with rewards. Deep learning uses neural
    networks with multiple layers. These techniques power modern applications like
    image recognition, natural language processing, and recommendation systems.
    The field continues to advance rapidly with new architectures and approaches.
    """

    summary = calc.summarize_text(long_text, max_sentences=3)
    print(f"\nOriginal: {len(long_text.split())} words")
    print(f"Summary ({len(summary.split())} words):\n{summary}")


if __name__ == "__main__":
    main()
