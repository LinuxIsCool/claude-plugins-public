# OmniMind Hybrid Search Architecture

## Executive Summary

A Django-based unified search interface providing **hybrid search** (full-text + semantic) over all **atoms** in the OmniMind substrate, with cross-compatibility to existing SQLite-based stores.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Django Admin Interface                               │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐           │
│  │   Atoms     │ │  Journals   │ │ Transcripts │ │  Messages   │           │
│  │  (unified)  │ │             │ │             │ │             │           │
│  └──────┬──────┘ └──────┬──────┘ └──────┬──────┘ └──────┬──────┘           │
│         │               │               │               │                   │
│         └───────────────┴───────────────┴───────────────┘                   │
│                                 │                                           │
│                    ┌────────────┴────────────┐                              │
│                    │    Hybrid Search API    │                              │
│                    │  BM25 + pgvector + KG   │                              │
│                    └────────────┬────────────┘                              │
└─────────────────────────────────┼───────────────────────────────────────────┘
                                  │
┌─────────────────────────────────┴───────────────────────────────────────────┐
│                    PostgreSQL + pgvector                                     │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  atoms                                                                │  │
│  │  ├─ id (UUID, primary key)                                           │  │
│  │  ├─ atom_type (enum: journal|transcript|message|resource|log)        │  │
│  │  ├─ source_id (original ID from source store)                        │  │
│  │  ├─ content (TEXT)                                                   │  │
│  │  ├─ title (TEXT)                                                     │  │
│  │  ├─ created_at (TIMESTAMP)                                           │  │
│  │  ├─ metadata (JSONB)                                                 │  │
│  │  ├─ embedding (VECTOR(768))  ← pgvector semantic search              │  │
│  │  ├─ search_vector (TSVECTOR) ← PostgreSQL full-text search           │  │
│  │  └─ citation_score (FLOAT)                                           │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
                                  │
                    ┌─────────────┴─────────────┐
                    │     Sync Adapters         │
                    │  (bidirectional sync)     │
                    └─────────────┬─────────────┘
                                  │
┌─────────────────────────────────┴───────────────────────────────────────────┐
│                    Existing Stores (SQLite + JSONL)                         │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌──────────┐ │
│  │  Journal   │ │ Transcripts│ │  Messages  │ │  Library   │ │  Logs    │ │
│  │ (markdown) │ │  (sqlite)  │ │  (sqlite)  │ │ (json/db)  │ │ (jsonl)  │ │
│  └────────────┘ └────────────┘ └────────────┘ └────────────┘ └──────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 1. Core Data Model

### 1.1 Unified Atom Schema

```python
# omnimind/models.py
from django.db import models
from django.contrib.postgres.search import SearchVectorField
from django.contrib.postgres.indexes import GinIndex
from pgvector.django import VectorField

class AtomType(models.TextChoices):
    JOURNAL = 'journal', 'Journal Entry'
    TRANSCRIPT = 'transcript', 'Transcript Utterance'
    MESSAGE = 'message', 'Message'
    RESOURCE = 'resource', 'Library Resource'
    LOG = 'log', 'Session Log'
    SPEAKER = 'speaker', 'Speaker Profile'
    ENTITY = 'entity', 'Extracted Entity'

class Atom(models.Model):
    """
    Unified searchable unit across all data stores.

    Each atom represents a single searchable piece of content
    with both full-text and semantic search capabilities.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # Type discrimination
    atom_type = models.CharField(max_length=20, choices=AtomType.choices, db_index=True)

    # Source tracking (for sync)
    source_id = models.CharField(max_length=255, db_index=True)
    source_store = models.CharField(max_length=50)  # journal, transcripts, messages, library
    source_path = models.CharField(max_length=500, blank=True)

    # Content
    title = models.CharField(max_length=500, blank=True)
    content = models.TextField()

    # Temporal
    created_at = models.DateTimeField(db_index=True)
    updated_at = models.DateTimeField(auto_now=True)
    imported_at = models.DateTimeField(auto_now_add=True)

    # Structured metadata (type-specific fields)
    metadata = models.JSONField(default=dict)

    # Full-text search (PostgreSQL tsvector)
    search_vector = SearchVectorField(null=True)

    # Semantic search (pgvector)
    embedding = VectorField(dimensions=768, null=True)  # nomic-embed-text dimension

    # Citation/relevance scoring
    citation_score = models.FloatField(default=0.0)
    pagerank_score = models.FloatField(default=0.0)
    access_count = models.IntegerField(default=0)
    last_accessed = models.DateTimeField(null=True)

    # Relationships
    parent = models.ForeignKey('self', null=True, blank=True, on_delete=models.SET_NULL, related_name='children')

    class Meta:
        indexes = [
            GinIndex(fields=['search_vector']),
            models.Index(fields=['atom_type', 'created_at']),
            models.Index(fields=['source_store', 'source_id']),
        ]
        unique_together = [['source_store', 'source_id']]

    def save(self, *args, **kwargs):
        # Auto-generate search vector on save
        from django.contrib.postgres.search import SearchVector
        super().save(*args, **kwargs)
        # Update search vector asynchronously or in post_save signal
```

### 1.2 Type-Specific Metadata Schemas

```python
# Type-specific metadata stored in JSONB
METADATA_SCHEMAS = {
    'journal': {
        'entry_type': str,      # atomic, daily, weekly, monthly
        'tags': list[str],
        'author': str,
        'parent_daily': str,    # wikilink
        'related': list[str],   # wikilinks
    },
    'transcript': {
        'transcript_id': str,
        'speaker_id': str,
        'speaker_name': str,
        'start_ms': int,
        'end_ms': int,
        'confidence': float,
        'source_filename': str,
    },
    'message': {
        'platform': str,        # telegram, email, signal
        'account_id': str,
        'thread_id': str,
        'author_name': str,
        'author_handle': str,
        'direction': str,       # incoming, outgoing
        'kind': int,            # message kind enum
    },
    'resource': {
        'resource_type': str,   # paper, repo, url, dataset
        'url': str,
        'creators': list[str],
        'subjects': list[str],
        'arxiv_id': str,
        'doi': str,
        'repo_stars': int,
    },
    'log': {
        'session_id': str,
        'event_type': str,
        'tool_name': str,
        'cwd': str,
    },
}
```

### 1.3 Citation Graph

```python
class Citation(models.Model):
    """
    Citation relationships between atoms.
    Enables PageRank, co-citation analysis, and provenance tracking.
    """
    source = models.ForeignKey(Atom, on_delete=models.CASCADE, related_name='outgoing_citations')
    target = models.ForeignKey(Atom, on_delete=models.CASCADE, related_name='incoming_citations')

    citation_type = models.CharField(max_length=20, choices=[
        ('reference', 'Reference'),
        ('implements', 'Implements'),
        ('relates', 'Relates To'),
        ('extends', 'Extends'),
        ('reply', 'Reply To'),
        ('mentions', 'Mentions'),
    ])

    context = models.TextField(blank=True)  # Surrounding text
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [['source', 'target', 'citation_type']]
        indexes = [
            models.Index(fields=['target', 'citation_type']),
        ]
```

## 2. Hybrid Search Implementation

### 2.1 Search Manager

```python
# omnimind/search.py
from django.contrib.postgres.search import SearchQuery, SearchRank, SearchVector
from pgvector.django import CosineDistance
from sentence_transformers import SentenceTransformer

# Initialize embedding model (same as existing ecosystem)
_embedder = None
def get_embedder():
    global _embedder
    if _embedder is None:
        _embedder = SentenceTransformer('nomic-ai/nomic-embed-text-v1')
    return _embedder

class HybridSearchManager:
    """
    Hybrid search combining:
    - PostgreSQL full-text search (BM25-like ranking via ts_rank)
    - pgvector semantic search (cosine similarity)
    - Citation graph signals (PageRank, velocity, co-citation)
    """

    # Default weights (matching existing library plugin)
    DEFAULT_WEIGHTS = {
        'bm25': 0.30,           # Full-text relevance
        'vector': 0.25,         # Semantic similarity
        'pagerank': 0.20,       # Citation importance
        'recency': 0.10,        # Time decay
        'velocity': 0.10,       # Citation rate
        'co_citation': 0.05,    # Cited together
    }

    def __init__(self, weights=None):
        self.weights = weights or self.DEFAULT_WEIGHTS

    def search(
        self,
        query: str,
        atom_types: list[str] = None,
        limit: int = 50,
        candidate_limit: int = 200,
        since: datetime = None,
        until: datetime = None,
        weights: dict = None,
    ) -> list[dict]:
        """
        Execute hybrid search with re-ranking.

        Stage 1: Candidate retrieval (FTS + vector)
        Stage 2: Re-ranking with all signals
        """
        weights = weights or self.weights

        # Stage 1: Get candidates from both FTS and vector search
        fts_candidates = self._fts_search(query, atom_types, candidate_limit, since, until)
        vector_candidates = self._vector_search(query, atom_types, candidate_limit, since, until)

        # Merge candidates (union)
        all_candidates = {}
        for atom, score in fts_candidates:
            all_candidates[atom.id] = {'atom': atom, 'bm25': score, 'vector': 0}

        for atom, score in vector_candidates:
            if atom.id in all_candidates:
                all_candidates[atom.id]['vector'] = score
            else:
                all_candidates[atom.id] = {'atom': atom, 'bm25': 0, 'vector': score}

        # Stage 2: Compute all signals and final score
        results = []
        for atom_id, data in all_candidates.items():
            atom = data['atom']

            scores = {
                'bm25': self._normalize(data['bm25'], fts_candidates),
                'vector': data['vector'],  # Already 0-1
                'pagerank': atom.pagerank_score,
                'recency': self._recency_score(atom.created_at),
                'velocity': self._velocity_score(atom),
                'co_citation': self._co_citation_score(atom, all_candidates.keys()),
            }

            # Weighted sum
            final_score = sum(
                scores[signal] * weights.get(signal, 0)
                for signal in scores
            )

            results.append({
                'atom': atom,
                'scores': scores,
                'final_score': final_score,
            })

        # Sort and limit
        results.sort(key=lambda x: x['final_score'], reverse=True)
        return results[:limit]

    def _fts_search(self, query, atom_types, limit, since, until):
        """PostgreSQL full-text search with ts_rank."""
        search_query = SearchQuery(query, config='english')

        qs = Atom.objects.annotate(
            rank=SearchRank('search_vector', search_query)
        ).filter(
            search_vector=search_query
        )

        if atom_types:
            qs = qs.filter(atom_type__in=atom_types)
        if since:
            qs = qs.filter(created_at__gte=since)
        if until:
            qs = qs.filter(created_at__lte=until)

        qs = qs.order_by('-rank')[:limit]
        return [(atom, atom.rank) for atom in qs]

    def _vector_search(self, query, atom_types, limit, since, until):
        """pgvector semantic search with cosine distance."""
        query_embedding = get_embedder().encode(query)

        qs = Atom.objects.exclude(
            embedding__isnull=True
        ).annotate(
            distance=CosineDistance('embedding', query_embedding)
        )

        if atom_types:
            qs = qs.filter(atom_type__in=atom_types)
        if since:
            qs = qs.filter(created_at__gte=since)
        if until:
            qs = qs.filter(created_at__lte=until)

        qs = qs.order_by('distance')[:limit]

        # Convert distance to similarity (1 - distance)
        return [(atom, 1 - atom.distance) for atom in qs]

    def _recency_score(self, created_at, half_life_days=365):
        """Exponential decay based on age."""
        age_days = (datetime.now() - created_at).days
        return 2 ** (-age_days / half_life_days)

    def _velocity_score(self, atom):
        """Citation rate over recent window."""
        # Count recent citations
        recent = Citation.objects.filter(
            target=atom,
            created_at__gte=datetime.now() - timedelta(days=30)
        ).count()
        # Normalize (assuming max ~100 citations/month)
        return min(recent / 100, 1.0)

    def _co_citation_score(self, atom, candidate_ids):
        """How often cited alongside other results."""
        # Get atoms that cite this atom
        citers = Citation.objects.filter(target=atom).values_list('source_id', flat=True)
        # Count how many also cite other candidates
        co_citations = Citation.objects.filter(
            source_id__in=citers,
            target_id__in=candidate_ids
        ).exclude(target=atom).count()
        # Normalize
        return min(co_citations / 50, 1.0)

    @staticmethod
    def _normalize(score, all_results):
        """Min-max normalization."""
        if not all_results:
            return 0
        scores = [s for _, s in all_results]
        min_s, max_s = min(scores), max(scores)
        if max_s == min_s:
            return 1.0
        return (score - min_s) / (max_s - min_s)
```

### 2.2 Search Vector Generation

```python
# omnimind/signals.py
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.contrib.postgres.search import SearchVector

@receiver(post_save, sender=Atom)
def update_search_vector(sender, instance, **kwargs):
    """Update full-text search vector on save."""
    # Weight: title (A) > content (B)
    Atom.objects.filter(pk=instance.pk).update(
        search_vector=(
            SearchVector('title', weight='A', config='english') +
            SearchVector('content', weight='B', config='english')
        )
    )

@receiver(post_save, sender=Atom)
def generate_embedding(sender, instance, created, **kwargs):
    """Generate semantic embedding asynchronously."""
    if instance.embedding is None:
        # Queue for async processing
        from omnimind.tasks import generate_atom_embedding
        generate_atom_embedding.delay(instance.id)
```

## 3. Django Admin Interface

### 3.1 Custom Admin with Hybrid Search

```python
# omnimind/admin.py
from django.contrib import admin
from django.contrib.postgres.search import SearchQuery
from .models import Atom, Citation
from .search import HybridSearchManager

@admin.register(Atom)
class AtomAdmin(admin.ModelAdmin):
    list_display = ['title_preview', 'atom_type', 'source_store', 'created_at', 'citation_score']
    list_filter = ['atom_type', 'source_store', 'created_at']
    search_fields = ['title', 'content']
    readonly_fields = ['id', 'search_vector', 'embedding', 'imported_at']
    date_hierarchy = 'created_at'

    fieldsets = (
        (None, {
            'fields': ('atom_type', 'title', 'content')
        }),
        ('Source', {
            'fields': ('source_store', 'source_id', 'source_path'),
            'classes': ('collapse',)
        }),
        ('Metadata', {
            'fields': ('metadata',),
            'classes': ('collapse',)
        }),
        ('Scores', {
            'fields': ('citation_score', 'pagerank_score', 'access_count'),
            'classes': ('collapse',)
        }),
        ('System', {
            'fields': ('id', 'created_at', 'updated_at', 'imported_at'),
            'classes': ('collapse',)
        }),
    )

    def title_preview(self, obj):
        return obj.title[:50] + '...' if len(obj.title) > 50 else obj.title
    title_preview.short_description = 'Title'

    def get_search_results(self, request, queryset, search_term):
        """Override to use hybrid search."""
        queryset, use_distinct = super().get_search_results(request, queryset, search_term)

        if search_term:
            # Use hybrid search
            searcher = HybridSearchManager()
            results = searcher.search(search_term, limit=100)

            # Get IDs in ranked order
            ranked_ids = [r['atom'].id for r in results]

            if ranked_ids:
                # Filter to matching IDs and preserve order
                from django.db.models import Case, When
                preserved_order = Case(*[
                    When(pk=pk, then=pos) for pos, pk in enumerate(ranked_ids)
                ])
                queryset = Atom.objects.filter(pk__in=ranked_ids).order_by(preserved_order)

        return queryset, use_distinct

@admin.register(Citation)
class CitationAdmin(admin.ModelAdmin):
    list_display = ['source', 'target', 'citation_type', 'created_at']
    list_filter = ['citation_type', 'created_at']
    raw_id_fields = ['source', 'target']
```

### 3.2 Custom Search View

```python
# omnimind/views.py
from django.views.generic import TemplateView
from django.http import JsonResponse
from .search import HybridSearchManager
from .models import Atom, AtomType

class OmniSearchView(TemplateView):
    """Advanced search interface with faceted filtering."""
    template_name = 'omnimind/search.html'

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)

        query = self.request.GET.get('q', '')
        atom_types = self.request.GET.getlist('type')

        if query:
            searcher = HybridSearchManager()
            results = searcher.search(
                query,
                atom_types=atom_types or None,
                limit=50,
            )
            context['results'] = results
            context['query'] = query

        context['atom_types'] = AtomType.choices
        return context

class SearchAPIView(View):
    """JSON API for search (for MCP integration)."""

    def get(self, request):
        query = request.GET.get('q', '')
        atom_types = request.GET.getlist('type')
        limit = int(request.GET.get('limit', 20))

        if not query:
            return JsonResponse({'error': 'Query required'}, status=400)

        searcher = HybridSearchManager()
        results = searcher.search(query, atom_types=atom_types or None, limit=limit)

        return JsonResponse({
            'query': query,
            'count': len(results),
            'results': [
                {
                    'id': str(r['atom'].id),
                    'title': r['atom'].title,
                    'content_preview': r['atom'].content[:200],
                    'atom_type': r['atom'].atom_type,
                    'source_store': r['atom'].source_store,
                    'created_at': r['atom'].created_at.isoformat(),
                    'scores': r['scores'],
                    'final_score': r['final_score'],
                }
                for r in results
            ]
        })
```

## 4. Sync Adapters

### 4.1 Base Adapter

```python
# omnimind/sync/base.py
from abc import ABC, abstractmethod
from datetime import datetime

class SyncAdapter(ABC):
    """Base class for syncing external stores to PostgreSQL."""

    store_name: str  # e.g., 'journal', 'transcripts'

    @abstractmethod
    def get_items_since(self, since: datetime) -> list[dict]:
        """Get items modified since timestamp."""
        pass

    @abstractmethod
    def item_to_atom(self, item: dict) -> dict:
        """Convert source item to Atom fields."""
        pass

    def sync(self, full: bool = False):
        """Execute sync operation."""
        from omnimind.models import Atom

        if full:
            since = datetime.min
        else:
            # Get last sync time
            last = Atom.objects.filter(
                source_store=self.store_name
            ).order_by('-imported_at').first()
            since = last.imported_at if last else datetime.min

        items = self.get_items_since(since)

        created, updated = 0, 0
        for item in items:
            atom_data = self.item_to_atom(item)
            atom, was_created = Atom.objects.update_or_create(
                source_store=self.store_name,
                source_id=atom_data['source_id'],
                defaults=atom_data
            )
            if was_created:
                created += 1
            else:
                updated += 1

        return {'created': created, 'updated': updated}
```

### 4.2 Journal Adapter

```python
# omnimind/sync/journal.py
import yaml
from pathlib import Path
from datetime import datetime
from .base import SyncAdapter

class JournalAdapter(SyncAdapter):
    """Sync journal markdown entries to atoms."""

    store_name = 'journal'

    def __init__(self, journal_path: Path):
        self.journal_path = journal_path

    def get_items_since(self, since: datetime) -> list[dict]:
        items = []

        for md_file in self.journal_path.rglob('*.md'):
            if md_file.stat().st_mtime > since.timestamp():
                items.append(self._parse_journal_entry(md_file))

        return items

    def _parse_journal_entry(self, path: Path) -> dict:
        content = path.read_text()

        # Parse YAML frontmatter
        if content.startswith('---'):
            _, frontmatter, body = content.split('---', 2)
            meta = yaml.safe_load(frontmatter)
        else:
            meta = {}
            body = content

        return {
            'source_id': meta.get('id', path.stem),
            'source_path': str(path),
            'title': meta.get('title', path.stem),
            'content': body.strip(),
            'created_at': meta.get('created', datetime.fromtimestamp(path.stat().st_ctime)),
            'metadata': {
                'entry_type': meta.get('type', 'atomic'),
                'tags': meta.get('tags', []),
                'author': meta.get('author', 'unknown'),
                'parent_daily': meta.get('parent_daily'),
                'related': meta.get('related', []),
            }
        }

    def item_to_atom(self, item: dict) -> dict:
        return {
            'atom_type': 'journal',
            'source_id': item['source_id'],
            'source_path': item['source_path'],
            'title': item['title'],
            'content': item['content'],
            'created_at': item['created_at'],
            'metadata': item['metadata'],
        }
```

### 4.3 Transcripts Adapter

```python
# omnimind/sync/transcripts.py
import sqlite3
from pathlib import Path
from .base import SyncAdapter

class TranscriptsAdapter(SyncAdapter):
    """Sync transcript utterances to atoms."""

    store_name = 'transcripts'

    def __init__(self, db_path: Path):
        self.db_path = db_path

    def get_items_since(self, since: datetime) -> list[dict]:
        conn = sqlite3.connect(str(self.db_path))
        conn.row_factory = sqlite3.Row

        cursor = conn.execute('''
            SELECT
                m.id, m.transcript_id, m.speaker_id, m.speaker_name,
                m.text, m.start_ms, m.end_ms, m.created_at,
                t.title as transcript_title
            FROM utterances_meta m
            JOIN transcripts_meta t ON m.transcript_id = t.id
            WHERE m.created_at > ?
        ''', (since.timestamp() * 1000,))

        items = [dict(row) for row in cursor.fetchall()]
        conn.close()
        return items

    def item_to_atom(self, item: dict) -> dict:
        return {
            'atom_type': 'transcript',
            'source_id': item['id'],
            'title': f"{item['speaker_name']} in {item['transcript_title']}",
            'content': item['text'],
            'created_at': datetime.fromtimestamp(item['created_at'] / 1000),
            'metadata': {
                'transcript_id': item['transcript_id'],
                'speaker_id': item['speaker_id'],
                'speaker_name': item['speaker_name'],
                'start_ms': item['start_ms'],
                'end_ms': item['end_ms'],
            }
        }
```

### 4.4 Messages Adapter

```python
# omnimind/sync/messages.py
import sqlite3
import json
from pathlib import Path
from .base import SyncAdapter

class MessagesAdapter(SyncAdapter):
    """Sync messages to atoms."""

    store_name = 'messages'

    def __init__(self, db_path: Path):
        self.db_path = db_path

    def get_items_since(self, since: datetime) -> list[dict]:
        conn = sqlite3.connect(str(self.db_path))
        conn.row_factory = sqlite3.Row

        cursor = conn.execute('''
            SELECT id, kind, account_id, thread_id, platform,
                   created_at, direction, data
            FROM messages_meta
            WHERE imported_at > ?
        ''', (since.timestamp() * 1000,))

        items = []
        for row in cursor.fetchall():
            data = json.loads(row['data'])
            items.append({
                'id': row['id'],
                'data': data,
                'platform': row['platform'],
            })

        conn.close()
        return items

    def item_to_atom(self, item: dict) -> dict:
        data = item['data']
        return {
            'atom_type': 'message',
            'source_id': item['id'],
            'title': data.get('title', f"Message from {data.get('author', {}).get('name', 'Unknown')}"),
            'content': data.get('content', ''),
            'created_at': datetime.fromisoformat(data.get('created_at', datetime.now().isoformat())),
            'metadata': {
                'platform': item['platform'],
                'account_id': data.get('account_id'),
                'thread_id': data.get('refs', {}).get('thread_id'),
                'author_name': data.get('author', {}).get('name'),
                'author_handle': data.get('author', {}).get('handle'),
                'direction': next((t[1] for t in data.get('tags', []) if t[0] == 'direction'), None),
                'kind': data.get('kind'),
            }
        }
```

## 5. Background Tasks

### 5.1 Embedding Generation

```python
# omnimind/tasks.py
from celery import shared_task
from .models import Atom
from .search import get_embedder

@shared_task
def generate_atom_embedding(atom_id):
    """Generate embedding for a single atom."""
    try:
        atom = Atom.objects.get(pk=atom_id)
        text = f"{atom.title}\n\n{atom.content}"
        embedding = get_embedder().encode(text)

        Atom.objects.filter(pk=atom_id).update(embedding=embedding.tolist())
    except Atom.DoesNotExist:
        pass

@shared_task
def batch_generate_embeddings(batch_size=100):
    """Generate embeddings for atoms missing them."""
    atoms = Atom.objects.filter(embedding__isnull=True)[:batch_size]

    embedder = get_embedder()
    for atom in atoms:
        text = f"{atom.title}\n\n{atom.content}"
        embedding = embedder.encode(text)
        Atom.objects.filter(pk=atom.pk).update(embedding=embedding.tolist())

    return len(atoms)

@shared_task
def sync_all_stores():
    """Periodic sync task."""
    from omnimind.sync.journal import JournalAdapter
    from omnimind.sync.transcripts import TranscriptsAdapter
    from omnimind.sync.messages import MessagesAdapter
    from pathlib import Path

    claude_path = Path.home() / 'Workspace/claude-plugins/.claude'

    results = {}

    # Journal
    adapter = JournalAdapter(claude_path / 'journal')
    results['journal'] = adapter.sync()

    # Transcripts
    adapter = TranscriptsAdapter(claude_path / 'transcripts/search/index.db')
    results['transcripts'] = adapter.sync()

    # Messages
    adapter = MessagesAdapter(claude_path / 'messages/search/index.db')
    results['messages'] = adapter.sync()

    return results

@shared_task
def update_pagerank_scores():
    """Recompute PageRank for all atoms."""
    import networkx as nx
    from .models import Atom, Citation

    # Build graph
    G = nx.DiGraph()
    for citation in Citation.objects.all():
        G.add_edge(str(citation.source_id), str(citation.target_id))

    # Compute PageRank
    if G.number_of_nodes() > 0:
        pagerank = nx.pagerank(G, alpha=0.85)

        # Update atoms
        for atom_id, score in pagerank.items():
            Atom.objects.filter(pk=atom_id).update(pagerank_score=score)
```

## 6. MCP Server Integration

```python
# omnimind/mcp.py
"""
MCP server exposing hybrid search to Claude Code.

Tools:
- omnimind_search: Hybrid search across all atoms
- omnimind_get: Get atom by ID
- omnimind_cite: Create citation between atoms
"""

from mcp.server import Server
from mcp.types import Tool, TextContent
from .search import HybridSearchManager
from .models import Atom, Citation

server = Server("omnimind")

@server.tool("omnimind_search")
async def search(
    query: str,
    atom_types: list[str] = None,
    limit: int = 20,
) -> list[dict]:
    """
    Hybrid search across all atoms (journals, transcripts, messages, resources).
    Combines full-text (BM25) with semantic (vector) search and citation ranking.
    """
    searcher = HybridSearchManager()
    results = searcher.search(query, atom_types=atom_types, limit=limit)

    return [
        {
            'id': str(r['atom'].id),
            'title': r['atom'].title,
            'content_preview': r['atom'].content[:500],
            'atom_type': r['atom'].atom_type,
            'source_store': r['atom'].source_store,
            'scores': r['scores'],
            'final_score': r['final_score'],
        }
        for r in results
    ]

@server.tool("omnimind_get")
async def get_atom(atom_id: str) -> dict:
    """Get full atom content by ID."""
    atom = Atom.objects.get(pk=atom_id)
    return {
        'id': str(atom.id),
        'title': atom.title,
        'content': atom.content,
        'atom_type': atom.atom_type,
        'source_store': atom.source_store,
        'source_path': atom.source_path,
        'created_at': atom.created_at.isoformat(),
        'metadata': atom.metadata,
    }

@server.tool("omnimind_cite")
async def create_citation(
    source_id: str,
    target_id: str,
    citation_type: str = 'reference',
    context: str = '',
) -> dict:
    """Create a citation link between two atoms."""
    citation, created = Citation.objects.get_or_create(
        source_id=source_id,
        target_id=target_id,
        citation_type=citation_type,
        defaults={'context': context}
    )
    return {
        'id': citation.id,
        'created': created,
    }
```

## 7. Deployment Architecture

```yaml
# docker-compose.yml
version: '3.8'

services:
  db:
    image: pgvector/pgvector:pg16
    environment:
      POSTGRES_DB: omnimind
      POSTGRES_USER: omnimind
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  web:
    build: .
    command: gunicorn omnimind.wsgi:application --bind 0.0.0.0:8000
    environment:
      DATABASE_URL: postgres://omnimind:${DB_PASSWORD}@db:5432/omnimind
      REDIS_URL: redis://redis:6379/0
    depends_on:
      - db
      - redis
    ports:
      - "8000:8000"
    volumes:
      - /home/user/path

  celery:
    build: .
    command: celery -A omnimind worker -l info
    environment:
      DATABASE_URL: postgres://omnimind:${DB_PASSWORD}@db:5432/omnimind
      REDIS_URL: redis://redis:6379/0
    depends_on:
      - db
      - redis
    volumes:
      - /home/user/path

  celery-beat:
    build: .
    command: celery -A omnimind beat -l info
    environment:
      DATABASE_URL: postgres://omnimind:${DB_PASSWORD}@db:5432/omnimind
      REDIS_URL: redis://redis:6379/0
    depends_on:
      - db
      - redis

volumes:
  postgres_data:
```

## 8. Migration Path

### Phase 1: Setup (Week 1)
1. Create Django project with PostgreSQL + pgvector
2. Define Atom and Citation models
3. Run migrations, verify pgvector extension

### Phase 2: Sync Adapters (Week 2)
1. Implement Journal adapter
2. Implement Transcripts adapter
3. Implement Messages adapter
4. Implement Library adapter
5. Initial full sync

### Phase 3: Search (Week 3)
1. Implement HybridSearchManager
2. Generate embeddings for all atoms
3. Compute initial PageRank scores
4. Create Django admin customizations

### Phase 4: Integration (Week 4)
1. Create MCP server
2. Hook sync adapters to existing store events
3. Set up Celery beat for periodic sync
4. Create CLI tools for management

## 9. Cross-Compatibility Guarantees

```python
# Existing stores remain primary source of truth
# PostgreSQL is a search index, not authoritative storage

COMPATIBILITY_PRINCIPLES = {
    'read_path': 'Hybrid search → PostgreSQL → atom.source_path → original store',
    'write_path': 'Original store → sync adapter → PostgreSQL',
    'deletion': 'Delete from original store → sync removes from PostgreSQL',
    'latency': 'Sync delay < 5 minutes (Celery beat)',
    'fallback': 'If PostgreSQL unavailable, existing FTS5 indexes still work',
}
```

## 10. Future Extensions

### Temporal Queries
```python
# "What did we discuss about X in December?"
results = searcher.search(
    "project roadmap",
    since=datetime(2025, 12, 1),
    until=datetime(2025, 12, 31),
)
```

### Entity Resolution
```python
# Link "Paolo" in transcript to "Paolo Melchiorre" in library
class EntityAlias(models.Model):
    canonical = models.ForeignKey(Atom, on_delete=models.CASCADE)
    alias = models.CharField(max_length=255, db_index=True)
    confidence = models.FloatField(default=1.0)
```

### Graph Visualization
```python
# Export citation graph for Obsidian/Quartz
def export_citation_graph():
    nodes = [{'id': str(a.id), 'label': a.title} for a in Atom.objects.all()]
    edges = [{'source': str(c.source_id), 'target': str(c.target_id)} for c in Citation.objects.all()]
    return {'nodes': nodes, 'edges': edges}
```
