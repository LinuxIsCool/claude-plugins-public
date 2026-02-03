#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = ["numpy"]
# ///
"""Search conversation logs using BM25 and optional semantic search.

Usage:
    uv run search_logs.py "query" [options]
    uv run search_logs.py --stats [--logs-dir DIR]

Examples:
    uv run search_logs.py "authentication"
    uv run search_logs.py "database" --limit 5 --pairs
    uv run search_logs.py "error" --type UserPromptSubmit --highlight
    uv run search_logs.py "bug" --from 2025-12-10 --semantic
    uv run search_logs.py --session b22351d6
    uv run search_logs.py --stats
"""

import argparse
import json
import math
import os
import re
from collections import Counter
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional

# Try to import numpy for semantic search (optional)
try:
    import numpy as np
    HAS_NUMPY = True
except ImportError:
    HAS_NUMPY = False


def tokenize(text):
    """Tokenize text into lowercase words, removing punctuation."""
    words = re.findall(r'\b[a-z0-9]+\b', text.lower())
    stopwords = {'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been',
                 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
                 'would', 'could', 'should', 'may', 'might', 'must', 'shall',
                 'can', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by',
                 'from', 'as', 'into', 'through', 'during', 'before', 'after',
                 'above', 'below', 'between', 'under', 'again', 'further',
                 'then', 'once', 'here', 'there', 'when', 'where', 'why',
                 'how', 'all', 'each', 'few', 'more', 'most', 'other', 'some',
                 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so',
                 'than', 'too', 'very', 'just', 'and', 'but', 'if', 'or',
                 'because', 'until', 'while', 'this', 'that', 'these', 'those',
                 'i', 'me', 'my', 'myself', 'we', 'our', 'ours', 'ourselves',
                 'you', 'your', 'yours', 'yourself', 'yourselves', 'he', 'him',
                 'his', 'himself', 'she', 'her', 'hers', 'herself', 'it', 'its',
                 'itself', 'they', 'them', 'their', 'theirs', 'themselves',
                 'what', 'which', 'who', 'whom'}
    return [w for w in words if len(w) > 1 and w not in stopwords]


def bm25_score(query_terms, doc_terms, doc_len, avg_doc_len, idf, k1=1.5, b=0.75):
    """Calculate BM25 score for a document."""
    score = 0.0
    doc_counter = Counter(doc_terms)
    for term in query_terms:
        if term in idf:
            tf = doc_counter.get(term, 0)
            if tf > 0:
                numerator = tf * (k1 + 1)
                denominator = tf + k1 * (1 - b + b * doc_len / avg_doc_len)
                score += idf[term] * numerator / denominator
    return score


def parse_date_filter(date_str):
    """Parse date filter string into datetime."""
    if not date_str:
        return None

    date_str = date_str.lower().strip()

    if date_str == 'today':
        return datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)

    if date_str == 'yesterday':
        return (datetime.now() - timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)

    if re.match(r'^\d+d$', date_str):
        days = int(date_str[:-1])
        return (datetime.now() - timedelta(days=days)).replace(hour=0, minute=0, second=0, microsecond=0)

    try:
        return datetime.strptime(date_str, '%Y-%m-%d')
    except ValueError:
        pass

    return None


def highlight_text(text, query_terms, use_ansi=True):
    """Highlight matching terms in text."""
    if not query_terms:
        return text

    # Build regex pattern for all query terms
    pattern = r'\b(' + '|'.join(re.escape(term) for term in query_terms) + r')\b'

    if use_ansi:
        # ANSI yellow background for terminal
        highlighted = re.sub(pattern, r'\033[43m\033[30m\1\033[0m', text, flags=re.IGNORECASE)
    else:
        # Markdown bold for JSON/text output
        highlighted = re.sub(pattern, r'**\1**', text, flags=re.IGNORECASE)

    return highlighted


def get_snippet(text, query_terms, context_chars=100):
    """Get a snippet of text around the first match."""
    if not query_terms:
        return text[:500] + "..." if len(text) > 500 else text

    # Find first match
    pattern = r'\b(' + '|'.join(re.escape(term) for term in query_terms) + r')\b'
    match = re.search(pattern, text, flags=re.IGNORECASE)

    if not match:
        return text[:500] + "..." if len(text) > 500 else text

    start = max(0, match.start() - context_chars)
    end = min(len(text), match.end() + context_chars)

    snippet = text[start:end]
    if start > 0:
        snippet = "..." + snippet
    if end < len(text):
        snippet = snippet + "..."

    return snippet


def load_all_events(logs_dir):
    """Load all events from JSONL files."""
    events = []
    logs_path = Path(logs_dir)

    if not logs_path.exists():
        return events

    for jsonl in logs_path.rglob("*.jsonl"):
        try:
            lines = jsonl.read_text().strip().split("\n")
        except Exception:
            continue

        for line in lines:
            if not line.strip():
                continue
            try:
                event = json.loads(line)
                event['_log_file'] = str(jsonl)
                events.append(event)
            except json.JSONDecodeError:
                continue

    return events


def get_stats(logs_dir):
    """Get comprehensive statistics about logs."""
    logs_path = Path(logs_dir)

    if not logs_path.exists():
        return {"error": f"Logs directory not found: {logs_dir}"}

    jsonl_files = list(logs_path.rglob("*.jsonl"))
    total_size = sum(f.stat().st_size for f in jsonl_files)

    events = load_all_events(logs_dir)

    if not events:
        return {
            "location": str(logs_path.absolute()),
            "total_size_bytes": total_size,
            "total_size_human": f"{total_size / 1024 / 1024:.1f} MB",
            "log_files": len(jsonl_files),
            "total_events": 0,
            "sessions": 0,
            "message": "No events found"
        }

    type_counts = Counter(e.get('type', 'unknown') for e in events)
    sessions = set(e.get('session_id', '') for e in events if e.get('session_id'))

    timestamps = [e.get('ts') for e in events if e.get('ts')]
    timestamps = [t for t in timestamps if isinstance(t, str)]

    if timestamps:
        timestamps.sort()
        earliest = timestamps[0][:10]
        latest = timestamps[-1][:10]
    else:
        earliest = latest = "unknown"

    return {
        "location": str(logs_path.absolute()),
        "total_size_bytes": total_size,
        "total_size_human": f"{total_size / 1024 / 1024:.1f} MB",
        "log_files": len(jsonl_files),
        "total_events": len(events),
        "sessions": len(sessions),
        "date_range": {
            "earliest": earliest,
            "latest": latest
        },
        "user_prompts": type_counts.get('UserPromptSubmit', 0),
        "assistant_responses": type_counts.get('AssistantResponse', 0),
        "events_by_type": dict(type_counts.most_common())
    }


def build_conversation_pairs(events):
    """Build prompt→response pairs from events."""
    pairs = []

    # Sort events by timestamp within each session
    by_session = {}
    for e in events:
        sid = e.get('session_id', '')
        if sid not in by_session:
            by_session[sid] = []
        by_session[sid].append(e)

    for sid, session_events in by_session.items():
        # Sort by timestamp
        session_events.sort(key=lambda x: x.get('ts', ''))

        current_prompt = None
        for e in session_events:
            if e.get('type') == 'UserPromptSubmit':
                current_prompt = e
            elif e.get('type') == 'AssistantResponse' and current_prompt:
                pairs.append({
                    'prompt': current_prompt,
                    'response': e,
                    'session_id': sid
                })
                current_prompt = None

    return pairs


def collect_documents(logs_dir, event_types=None, date_from=None, date_to=None,
                     session_filter=None, as_pairs=False):
    """Collect searchable documents from JSONL logs with filtering."""
    if event_types is None:
        event_types = {'UserPromptSubmit', 'AssistantResponse'}

    events = load_all_events(logs_dir)

    # Filter events first
    filtered_events = []
    for event in events:
        event_type = event.get("type", "")
        if event_type not in event_types:
            continue

        ts = event.get("ts", "")
        if ts and (date_from or date_to):
            try:
                event_dt = datetime.fromisoformat(ts.replace('Z', '+00:00'))
                if date_from and event_dt < date_from:
                    continue
                if date_to and event_dt > date_to.replace(hour=23, minute=59, second=59):
                    continue
            except (ValueError, TypeError):
                pass

        if session_filter:
            session_id = event.get("session_id", "")
            if not session_id.startswith(session_filter):
                continue

        filtered_events.append(event)

    if as_pairs:
        # Build conversation pairs
        pairs = build_conversation_pairs(filtered_events)
        docs = []
        for pair in pairs:
            prompt_content = pair['prompt'].get('data', {}).get('prompt', '')
            response_content = pair['response'].get('data', {}).get('response', '')

            if not prompt_content and not response_content:
                continue

            # Combine content for searching
            combined_content = f"USER: {prompt_content}\n\nCLAUDE: {response_content}"

            docs.append({
                "type": "ConversationPair",
                "prompt_content": prompt_content,
                "response_content": response_content,
                "content": combined_content,
                "timestamp": pair['prompt'].get('ts', ''),
                "response_timestamp": pair['response'].get('ts', ''),
                "session_id": pair['session_id'],
                "log_file": pair['prompt'].get('_log_file', ''),
                "terms": tokenize(combined_content)
            })
        return docs

    # Standard document collection
    docs = []
    for event in filtered_events:
        event_type = event.get("type", "")
        data = event.get("data", {})

        if event_type == "UserPromptSubmit":
            content = data.get("prompt", "")
        elif event_type == "AssistantResponse":
            content = data.get("response", "")
        else:
            continue

        if not content or len(content.strip()) < 10:
            continue

        docs.append({
            "type": event_type,
            "content": content,
            "timestamp": event.get("ts", ""),
            "session_id": event.get("session_id", ""),
            "log_file": event.get("_log_file", ""),
            "terms": tokenize(content)
        })

    return docs


# ============================================================================
# SEMANTIC SEARCH (Phase 2)
# ============================================================================

def get_embeddings_path(logs_dir):
    """Get path to embeddings cache."""
    return Path(logs_dir) / ".search-index" / "embeddings.npz"


def get_embedding_model():
    """Load or return cached embedding model."""
    global _embedding_model
    if '_embedding_model' not in globals():
        try:
            from sentence_transformers import SentenceTransformer
            _embedding_model = SentenceTransformer('all-MiniLM-L6-v2')
        except ImportError:
            _embedding_model = None
    return _embedding_model


def simple_embedding(text, vocab_size=5000):
    """Simple TF-IDF-like embedding when sentence-transformers not available."""
    if not HAS_NUMPY:
        return None

    # Simple hash-based embedding
    terms = tokenize(text)
    embedding = np.zeros(vocab_size, dtype=np.float32)

    for term in terms:
        idx = hash(term) % vocab_size
        embedding[idx] += 1

    # Normalize
    norm = np.linalg.norm(embedding)
    if norm > 0:
        embedding = embedding / norm

    return embedding


def get_embedding(text):
    """Get embedding for text."""
    model = get_embedding_model()
    if model is not None:
        return model.encode(text, normalize_embeddings=True)
    elif HAS_NUMPY:
        return simple_embedding(text)
    return None


def build_embedding_index(docs, logs_dir):
    """Build or update embedding index for documents."""
    if not HAS_NUMPY:
        return None, None

    embeddings_path = get_embeddings_path(logs_dir)
    embeddings_path.parent.mkdir(parents=True, exist_ok=True)

    # Generate embeddings
    embeddings = []
    doc_ids = []

    for i, doc in enumerate(docs):
        content = doc.get('content', '')[:2000]  # Limit content length
        emb = get_embedding(content)
        if emb is not None:
            embeddings.append(emb)
            doc_ids.append(i)

    if not embeddings:
        return None, None

    embeddings_array = np.array(embeddings)
    return embeddings_array, doc_ids


def semantic_search(query, docs, logs_dir, limit=10):
    """Perform semantic search using embeddings."""
    if not HAS_NUMPY:
        return []

    # Build index
    embeddings, doc_ids = build_embedding_index(docs, logs_dir)
    if embeddings is None:
        return []

    # Get query embedding
    query_emb = get_embedding(query)
    if query_emb is None:
        return []

    # Compute similarities
    similarities = embeddings @ query_emb

    # Get top results
    top_indices = np.argsort(similarities)[::-1][:limit]

    results = []
    for idx in top_indices:
        doc_idx = doc_ids[idx]
        score = float(similarities[idx])
        if score > 0.1:  # Minimum threshold
            results.append({
                'doc': docs[doc_idx],
                'semantic_score': score
            })

    return results


def hybrid_search(query, docs, logs_dir, limit=10, bm25_weight=0.5):
    """Combine BM25 and semantic search."""
    if not docs:
        return []

    query_terms = tokenize(query)
    if not query_terms:
        return []

    # BM25 scoring
    N = len(docs)
    df = Counter()
    for doc in docs:
        for term in set(doc["terms"]):
            df[term] += 1

    idf = {term: math.log((N - freq + 0.5) / (freq + 0.5) + 1) for term, freq in df.items()}
    total_terms = sum(len(d["terms"]) for d in docs)
    avg_doc_len = total_terms / N if N > 0 else 1

    bm25_scores = {}
    for i, doc in enumerate(docs):
        score = bm25_score(query_terms, doc["terms"], len(doc["terms"]), avg_doc_len, idf)
        bm25_scores[i] = score

    # Normalize BM25 scores
    max_bm25 = max(bm25_scores.values()) if bm25_scores else 1
    if max_bm25 > 0:
        bm25_scores = {k: v / max_bm25 for k, v in bm25_scores.items()}

    # Semantic scoring
    semantic_results = semantic_search(query, docs, logs_dir, limit=len(docs))
    semantic_scores = {}
    for r in semantic_results:
        doc_idx = docs.index(r['doc'])
        semantic_scores[doc_idx] = r['semantic_score']

    # Combine scores
    combined_scores = {}
    for i in range(len(docs)):
        bm25 = bm25_scores.get(i, 0)
        semantic = semantic_scores.get(i, 0)
        combined_scores[i] = bm25_weight * bm25 + (1 - bm25_weight) * semantic

    # Sort and return top results
    sorted_indices = sorted(combined_scores.keys(), key=lambda x: combined_scores[x], reverse=True)

    results = []
    for idx in sorted_indices[:limit]:
        if combined_scores[idx] > 0:
            results.append({
                'doc': docs[idx],
                'score': combined_scores[idx],
                'bm25_score': bm25_scores.get(idx, 0) * max_bm25,  # Unnormalize for display
                'semantic_score': semantic_scores.get(idx, 0)
            })

    return results


# ============================================================================
# MAIN SEARCH FUNCTION
# ============================================================================

def search(query, logs_dir, limit=10, event_types=None, date_from=None, date_to=None,
           session_filter=None, full_content=False, as_pairs=False, highlight=False,
           semantic=False):
    """Search logs with all features."""
    docs = collect_documents(logs_dir, event_types, date_from, date_to, session_filter, as_pairs)

    if not docs:
        return []

    query_terms = tokenize(query) if query else []

    # If no query, return most recent (for session browsing)
    if not query:
        docs.sort(key=lambda x: x.get('timestamp', ''), reverse=True)
        results = []
        for doc in docs[:limit]:
            result = format_result(doc, query_terms, full_content, highlight, as_pairs)
            result['score'] = 0
            results.append(result)
        return results

    # Semantic/Hybrid search
    if semantic and HAS_NUMPY:
        hybrid_results = hybrid_search(query, docs, logs_dir, limit)
        results = []
        for hr in hybrid_results:
            result = format_result(hr['doc'], query_terms, full_content, highlight, as_pairs)
            result['score'] = round(hr['score'], 4)
            result['bm25_score'] = round(hr.get('bm25_score', 0), 4)
            result['semantic_score'] = round(hr.get('semantic_score', 0), 4)
            results.append(result)
        return results

    # Standard BM25 search
    N = len(docs)
    df = Counter()
    for doc in docs:
        for term in set(doc["terms"]):
            df[term] += 1

    idf = {term: math.log((N - freq + 0.5) / (freq + 0.5) + 1) for term, freq in df.items()}
    total_terms = sum(len(d["terms"]) for d in docs)
    avg_doc_len = total_terms / N if N > 0 else 1

    results = []
    for doc in docs:
        score = bm25_score(query_terms, doc["terms"], len(doc["terms"]), avg_doc_len, idf)
        if score > 0:
            result = format_result(doc, query_terms, full_content, highlight, as_pairs)
            result['score'] = round(score, 4)
            results.append(result)

    results.sort(key=lambda x: x["score"], reverse=True)
    return results[:limit]


def format_result(doc, query_terms, full_content, highlight, as_pairs):
    """Format a document into a result."""
    if as_pairs and doc.get('type') == 'ConversationPair':
        prompt = doc.get('prompt_content', '')
        response = doc.get('response_content', '')

        if not full_content:
            if len(prompt) > 300:
                prompt = get_snippet(prompt, query_terms, 150) if query_terms else prompt[:300] + "..."
            if len(response) > 500:
                response = get_snippet(response, query_terms, 250) if query_terms else response[:500] + "..."

        if highlight and query_terms:
            prompt = highlight_text(prompt, query_terms, use_ansi=False)
            response = highlight_text(response, query_terms, use_ansi=False)

        return {
            "type": "ConversationPair",
            "prompt": prompt,
            "response": response,
            "timestamp": doc.get("timestamp", ""),
            "response_timestamp": doc.get("response_timestamp", ""),
            "session_id": doc.get("session_id", ""),
            "log_file": doc.get("log_file", "")
        }

    content = doc.get("content", "")

    if not full_content and len(content) > 500:
        content = get_snippet(content, query_terms, 250) if query_terms else content[:500] + "..."

    if highlight and query_terms:
        content = highlight_text(content, query_terms, use_ansi=False)

    return {
        "type": doc.get("type", ""),
        "content": content,
        "timestamp": doc.get("timestamp", ""),
        "session_id": doc.get("session_id", ""),
        "log_file": doc.get("log_file", "")
    }


def format_stats_text(stats):
    """Format statistics as human-readable text."""
    lines = [
        "Log Statistics",
        "=" * 50,
        f"Location: {stats.get('location', 'unknown')}",
        f"Total Size: {stats.get('total_size_human', 'unknown')}",
        f"Log Files: {stats.get('log_files', 0)}",
        "",
        f"Date Range: {stats.get('date_range', {}).get('earliest', '?')} to {stats.get('date_range', {}).get('latest', '?')}",
        f"Sessions: {stats.get('sessions', 0)}",
        "",
        f"User Prompts: {stats.get('user_prompts', 0)}",
        f"Assistant Responses: {stats.get('assistant_responses', 0)}",
        f"Total Events: {stats.get('total_events', 0)}",
        "",
        "Events by Type:",
    ]

    for event_type, count in stats.get('events_by_type', {}).items():
        lines.append(f"  {event_type}: {count}")

    return "\n".join(lines)


def format_text_output(results, as_pairs=False):
    """Format results as human-readable text."""
    if not results:
        return "No results found."

    lines = []
    for i, r in enumerate(results, 1):
        lines.append(f"\n{'='*60}")
        score_str = f" (score: {r['score']})" if r.get('score', 0) > 0 else ""

        if r.get('semantic_score'):
            score_str += f" [BM25: {r.get('bm25_score', 0)}, Semantic: {r.get('semantic_score', 0)}]"

        lines.append(f"Result {i}{score_str}")
        lines.append(f"Type: {r['type']}")
        lines.append(f"Time: {r.get('timestamp', 'unknown')}")
        lines.append(f"Session: {r.get('session_id', 'unknown')[:8]}...")
        lines.append("=" * 60)

        if r['type'] == 'ConversationPair':
            lines.append("\n[USER]:")
            lines.append(r.get('prompt', ''))
            lines.append("\n[CLAUDE]:")
            lines.append(r.get('response', ''))
        else:
            lines.append(r.get('content', ''))

    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(
        description="Search conversation logs using BM25 and semantic search",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
    %(prog)s "authentication bug"
    %(prog)s "database" --limit 5 --pairs
    %(prog)s "error" --type UserPromptSubmit --highlight
    %(prog)s "bug" --from 2025-12-10 --semantic
    %(prog)s --session b22351d6
    %(prog)s --stats
        """
    )
    parser.add_argument("query", nargs="?", default="", help="Search query")
    parser.add_argument("--logs-dir", default=".claude/logging", help="Path to logs directory")
    parser.add_argument("--limit", type=int, default=10, help="Maximum number of results")
    parser.add_argument("--type", choices=["UserPromptSubmit", "AssistantResponse", "all"], default="all")
    parser.add_argument("--format", choices=["json", "text"], default="json", help="Output format")
    parser.add_argument("--stats", action="store_true", help="Show log statistics")
    parser.add_argument("--from", dest="date_from", help="Filter from date")
    parser.add_argument("--to", dest="date_to", help="Filter to date")
    parser.add_argument("--session", help="Filter by session ID")
    parser.add_argument("--full", action="store_true", help="Show full content")
    parser.add_argument("--pairs", action="store_true", help="Show prompt→response pairs together")
    parser.add_argument("--highlight", action="store_true", help="Highlight matching terms")
    parser.add_argument("--semantic", action="store_true", help="Use semantic search (requires sentence-transformers)")

    args = parser.parse_args()

    # Stats mode
    if args.stats:
        stats = get_stats(args.logs_dir)
        if args.format == "json":
            print(json.dumps(stats, indent=2))
        else:
            print(format_stats_text(stats))
        return

    # Search mode
    if not args.query and not args.session:
        parser.error("Either query or --session is required (unless using --stats)")

    event_types = {"UserPromptSubmit", "AssistantResponse"} if args.type == "all" else {args.type}
    date_from = parse_date_filter(args.date_from)
    date_to = parse_date_filter(args.date_to)

    results = search(
        args.query,
        args.logs_dir,
        args.limit,
        event_types,
        date_from,
        date_to,
        args.session,
        args.full,
        args.pairs,
        args.highlight,
        args.semantic
    )

    if args.format == "json":
        print(json.dumps(results, indent=2))
    else:
        print(format_text_output(results, args.pairs))


if __name__ == "__main__":
    main()
