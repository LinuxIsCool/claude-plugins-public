# The Cards System

## A Morphological Ontology for Personal Knowledge Infrastructure

---

# Prolegomena: The Nature of Digital Existence

What does it mean for something to *exist* in your digital life? Every email, every thought, every relationship, every project, every moment of insight—these are not mere data points scattered across disparate systems. They are the atoms of your extended mind, the cells of a living cognitive organism that metabolizes experience into understanding.

The Cards system emerges from a singular recognition: **all knowledge shares a common substrate**. An email is not fundamentally different from a task, which is not fundamentally different from a memory, which is not fundamentally different from a relationship. They are all *referents*—things that can be identified, related, searched, prioritized, and evolved over time.

This is not merely a technical architecture. It is an ontological commitment: that the digital dimension of your life can be organized around a universal primitive that makes everything equally addressable, equally discoverable, equally alive.

---

# Part I: Philosophical Foundations

## Chapter 1: The Morphological Imperative

### 1.1 From Taxonomy to Morphology

Traditional knowledge management systems begin with categories: this is an email, that is a document, here is a contact. They impose a *taxonomic* structure—fixed bins into which reality must be sorted.

The Cards system rejects taxonomy in favor of *morphology*: the study of form as it emerges from underlying structure. A Card is not a category; it is a *shape* that any piece of knowledge can assume. The shape is defined not by what the thing *is* but by what it *does*:

| Taxonomic Question | Morphological Question |
|-------------------|------------------------|
| What type is this? | What can this do? |
| Where does this belong? | What does this relate to? |
| How do I classify this? | How does this transform? |
| What folder contains this? | What graph embeds this? |

This shift from taxonomy to morphology enables a system where:
- **Everything inherits the same capabilities** (embedding, linking, prioritization)
- **Nothing is trapped in a single category** (an email can become a task can become a project)
- **Relationships matter more than labels** (the graph of connections is the true structure)

### 1.2 The Cell Metaphor

Every Card in the system is like a cell in a living organism:

**Cells share common structure** while expressing specialized function. A neuron and a skin cell contain the same DNA, yet manifest radically different behaviors. Similarly, an `Email(Card)` and a `Task(Card)` share the same universal fields—`rid`, `embedding`, `created_at`, `priority_score`—while expressing domain-specific properties.

**Cells are interconnected** through signaling pathways. No cell exists in isolation; each is part of a web of chemical messages, structural proteins, and shared resources. Cards connect through `CardLink` relationships that carry semantic weight: *supports*, *contradicts*, *derived_from*, *parent_of*.

**Cells maintain homeostasis** through feedback loops. The organism self-regulates, adjusting to maintain equilibrium. The Cards system implements this through priority decay, attention mechanisms, and agent-mediated curation that continuously rebalances what matters.

**Cells divide and differentiate** as the organism grows. New Cards emerge from existing Cards, inheriting context while specializing function. A conversation Card might spawn Task Cards which spawn Completion Cards which feed into Insight Cards.

### 1.3 The Reference Identifier (RID) as Universal Address

In the KOI (Knowledge Organization Infrastructure) protocol, every piece of knowledge receives a RID—a unique identifier that makes it addressable across any system, any agent, any context.

The RID is not merely a database primary key. It is an *ontological commitment*: this thing exists, can be referred to, and can be found. When a Card has a RID:

- It can be serialized and transmitted between systems (KOI protocol)
- It can be referenced by any other Card in the universe
- It can be addressed by any agent, human or artificial
- It persists as an identity even as its content evolves

The RID bridges two layers:
1. **Implementation Layer** (Django ORM): Cards live as database rows with relational integrity
2. **Protocol Layer** (KOI Network): Cards flow as knowledge objects with universal addressability

---

## Chapter 2: The Epistemological Architecture

### 2.1 Knowledge as Embedded Vectors

Every Card carries an embedding—a high-dimensional vector representation of its semantic content. This embedding is not metadata *about* the Card; it *is* the Card's position in meaning-space.

| Property | Explanation |
|----------|-------------|
| **Dimensionality** | 1536 (OpenAI ada-002) or 3072 (larger models) dimensions |
| **Semantic Proximity** | Similar meanings → nearby vectors |
| **Search Capability** | Cosine similarity enables semantic retrieval |
| **Compositionality** | Embeddings can be combined, averaged, differenced |
| **Model Plurality** | Multiple embeddings (cloud + local) for redundancy |

The embedding transforms the Cards system from a database into a **semantic manifold**—a continuous space where meaning has geometry. This enables:

- **Similarity search**: "Find everything related to X" without exact keyword matching
- **Clustering**: Automatically discovering natural groupings in your knowledge
- **Drift detection**: Tracking how concepts evolve over time
- **Interpolation**: Synthesizing new positions between existing ideas

### 2.2 Temporal Knowledge and Version Control

Knowledge is not static. Your understanding of a project changes. Relationships evolve. Priorities shift. The Cards system treats time as a first-class dimension:

**Hash History**: Every Card maintains a cryptographic hash of its content. When content changes, the hash changes. The `hash_history[]` array preserves the sequence of states.

**Embedding History**: Paired with `hash_history`, the `embedding_history[]` records the semantic position at each state. This enables *time-travel queries*: "What did my understanding of X look like six months ago?"

**Temporal Decay**: Priority scores decay over time according to configurable rates. What mattered yesterday matters slightly less today unless attention refreshes it. This implements the natural *forgetting curve* that prevents cognitive overload.

```
decayed_priority(as_of) = priority_score × e^(-decay_rate × days_since_update)
```

### 2.3 The Priority Calculus

Not all knowledge is equally important. The Cards system implements a multi-agent priority calculus:

**Agent-Relative Priority**: Different agents assign different priorities to the same Card. The CFO agent prioritizes financial Cards; the Project Architect prioritizes design decision Cards. Each agent maintains its own `AgentCardPriority(agent, card, score)`.

**Attention Weight**: Beyond priority, Cards carry an attention weight that modulates how strongly they appear in search and synthesis operations.

**Priority Sources**:
- Explicit human assignment ("This is critical")
- Implicit recency ("Recently accessed → higher priority")
- Relational importance ("Linked to many high-priority Cards → elevated")
- Agent assessment ("The CFO agent increased priority due to budget impact")

The priority system enables the **dashboard of your life**—a unified view where everything is sortable, filterable, and surfaceable according to what matters most *right now*.

---

## Chapter 3: The Systems Topology

### 3.1 The Days Table as Temporal Backbone

At the center of the Cards system sits the **Days** table—one row for each day of your life. This is the temporal backbone from which all other structure hangs.

| Field | Purpose |
|-------|---------|
| `date` | Primary key (unique, immutable) |
| `summary` | LLM-generated daily summary |
| `cards` | Relation to all Cards created that day |
| `events` | Relation to calendar events |
| `communications` | Relation to messages sent/received |
| `state` | Snapshot of financial, health, project states |

The Days table enables:
- **Diary queries**: "What happened on March 15th?"
- **Trajectory analysis**: "How have my priorities evolved over Q1?"
- **Pattern detection**: "When do I tend to feel most productive?"
- **Temporal joins**: Connecting any Card to its day and thus to everything else from that day

### 3.2 The Inheritance Hierarchy

The Cards system uses **multi-table inheritance**—a concrete `Card` table exists with universal fields, and specialized tables extend it:

```
Card (concrete base)
├── Email
├── Contact
├── Task
├── Project
├── Message
├── Event
├── Document
├── Insight
├── Principle
├── Objective
└── ... (extensible)
```

This architecture enables:
- `Card.objects.all()` returns ALL Cards regardless of type
- `AgentCardPriority` can point to any Card
- Universal RID assignment
- Cross-type queries ("Show me all high-priority Cards")

Each specialized table adds domain-specific fields while inheriting all Card capabilities.

### 3.3 The Link Graph

Cards connect through typed, weighted links:

| Link Type | Semantics |
|-----------|-----------|
| `supports` | Source provides evidence for target |
| `contradicts` | Source conflicts with target |
| `derived_from` | Source was created based on target |
| `parent_of` | Source contains or spawned target |
| `cites` | Source references target |
| `blocks` | Source must complete before target |
| `relates_to` | General semantic relationship |

The link graph enables:
- **Traversal queries**: "Find all Cards that support my thesis"
- **Impact analysis**: "What would change if I removed this Card?"
- **Coherence checking**: "Are there contradictions in my knowledge?"
- **Provenance tracking**: "Where did this insight come from?"

---

# Part II: Technical Specification

## Chapter 4: The Card Schema

### 4.1 Universal Fields

Every Card, regardless of type, carries these fields:

| Field | Type | Purpose | Default |
|-------|------|---------|---------|
| `id` | UUID | Primary key, globally unique | `uuid4()` |
| `rid` | UUID | KOI Reference Identifier | `uuid4()` |
| `content_type` | string | Discriminator for subtype | Required |
| `embedding` | vector(1536) | Semantic position | Required |
| `embedding_history` | JSON array | Past embeddings | `[]` |
| `hash` | string | Content fingerprint | Computed |
| `hash_history` | JSON array | Past hashes | `[]` |
| `priority_score` | float | Base importance [0,1] | `0.5` |
| `attention_weight` | float | Search boost factor | `1.0` |
| `temporal_decay_rate` | float | Priority decay per day | `0.01` |
| `created_at` | datetime | Birth timestamp | `now()` |
| `updated_at` | datetime | Last modification | `auto` |
| `last_accessed_at` | datetime | Last retrieval | `null` |
| `content` | JSON | Flexible structured data | `{}` |
| `summary` | text | LLM-generated summary | `""` |
| `source_uri` | URL | Origin if external | `""` |
| `created_by` | string | Agent or user ID | `""` |
| `metadata` | JSON | Extensible attributes | `{}` |

### 4.2 Link Fields

| Field | Type | Purpose |
|-------|------|---------|
| `source` | FK(Card) | Origin of relationship |
| `target` | FK(Card) | Destination of relationship |
| `link_type` | string | Semantic type |
| `weight` | float | Strength of connection |
| `metadata` | JSON | Link-specific data |
| `created_at` | datetime | When link was made |

### 4.3 Agent Priority Fields

| Field | Type | Purpose |
|-------|------|---------|
| `agent` | FK(Agent) | Which agent assigned |
| `card` | FK(Card) | Which card |
| `score` | float | Priority [0,1] |
| `rationale` | text | Why this priority |
| `assigned_at` | datetime | When assessed |

---

## Chapter 5: Core Operations

### 5.1 Card Lifecycle

```
┌─────────────┐
│   CREATE    │ ← External sensor or agent produces new Card
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   EMBED     │ ← Generate semantic embedding
└──────┬──────┘
       │
       ▼
┌─────────────┐
│    HASH     │ ← Compute content fingerprint
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   PERSIST   │ ← Store in database with RID
└──────┬──────┘
       │
       ▼
┌─────────────┐
│    LINK     │ ← Establish relationships to existing Cards
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  PRIORITIZE │ ← Agents assign initial priority
└──────┬──────┘
       │
       ▼
┌─────────────┐
│    LIVE     │ ← Card exists, searchable, decaying
└──────┬──────┘
       │
       ▼ (on update)
┌─────────────┐
│   VERSION   │ ← Append to hash/embedding history
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   ARCHIVE   │ ← Soft delete or move to cold storage
└─────────────┘
```

### 5.2 Search Operations

**Semantic Search**:
```
query_embedding = embed(query_text)
similar_cards = Card.objects.order_by(
    cosine_distance(embedding, query_embedding)
).limit(k)
```

**Hybrid Search** (semantic + keyword):
```
keyword_matches = Card.objects.filter(content__icontains=keywords)
semantic_matches = semantic_search(query_text)
results = merge_and_rank(keyword_matches, semantic_matches)
```

**Priority-Weighted Search**:
```
results = semantic_search(query).order_by(
    -decayed_priority(now())
)
```

### 5.3 KOI Protocol Integration

**Serialization**:
```python
card.to_koi_object() → {
    "rid": card.rid,
    "manifest": {
        "content_type": card.content_type,
        "created_at": card.created_at.isoformat(),
        "hash": card.hash
    },
    "content": card.content,
    "embedding": card.embedding.tolist()
}
```

**Deserialization**:
```python
Card.from_koi_object(kobj) → Card(
    rid=kobj["rid"],
    content_type=kobj["manifest"]["content_type"],
    content=kobj["content"],
    embedding=vector(kobj["embedding"])
)
```

---

## Chapter 6: The Agent Ecosystem

### 6.1 The Seven Core Agents

| Agent | Role | Card Interactions |
|-------|------|-------------------|
| **Human (You)** | Ultimate authority, creative vision | Creates high-value Cards, makes priority decisions |
| **Digital Twin** | Thinks like you, knows what you know | Queries across all Cards, synthesizes insights |
| **Chief of Staff** | Resource management, team composition | Manages agent priorities, orchestrates workflows |
| **CFO** | Financial intelligence | Prioritizes financial Cards, monitors budgets |
| **Main Driver** | Tactical implementation | Creates Task Cards, tracks completion |
| **Project Architect** | Strategic design | Creates design decision Cards, maintains coherence |
| **Circuit Breaker** | Risk assessment | Monitors for dangerous patterns, can pause operations |

### 6.2 Agent-Card Interactions

Agents interact with Cards through defined operations:

| Operation | Description | Permission Level |
|-----------|-------------|------------------|
| `read` | Query and retrieve Cards | All agents |
| `create` | Generate new Cards | Most agents |
| `update` | Modify existing Cards | Authorized agents |
| `prioritize` | Assign priority scores | Each agent for own scores |
| `link` | Create relationships | Authorized agents |
| `delete` | Soft-delete Cards | Chief of Staff, Human only |

### 6.3 Sensor and Processor Nodes

**Sensors** (ingest external data):
- Gmail Sensor → Email Cards
- Calendar Sensor → Event Cards
- Telegram Sensor → Message Cards
- Financial Sensor → Transaction Cards

**Processors** (transform and route):
- Embedding Processor → Generates embeddings for new Cards
- Priority Processor → Computes initial priority scores
- Link Processor → Discovers relationships to existing Cards
- Summary Processor → Generates LLM summaries

---

# Part III: Implementation

## Chapter 7: The Minimal Pure Implementation

The following implementations express the Cards system in its most essential form across five languages. Each implementation embodies these principles:

1. **Single Base Type**: Everything inherits from Card
2. **Universal Identity**: Every Card has a UUID
3. **Semantic Position**: Every Card has an embedding
4. **Temporal Awareness**: Every Card tracks its history
5. **Priority Calculus**: Every Card has decaying priority
6. **Relational Completeness**: Cards link to Cards

---

### 7.1 Lua Implementation

Lua's table-based prototype system creates elegant, minimal Cards:

```lua
-- cards.lua
-- The Cards System in Lua: Morphological Knowledge Infrastructure
-- Minimal, pure, table-based implementation

local json = require("dkjson") -- or cjson
local uuid = require("uuid")   -- lua-uuid

--------------------------------------------------------------------------------
-- CARD: The Universal Primitive
--------------------------------------------------------------------------------

local Card = {}
Card.__index = Card

-- Constructor: Birth of a Card
function Card.new(params)
    params = params or {}
    
    local self = setmetatable({}, Card)
    
    -- Identity
    self.id = params.id or uuid()
    self.rid = params.rid or uuid()
    self.content_type = params.content_type or "card"
    
    -- Semantic Position
    self.embedding = params.embedding or {}
    self.embedding_history = params.embedding_history or {}
    
    -- Content Integrity
    self.content = params.content or {}
    self.hash = nil  -- computed lazily
    self.hash_history = params.hash_history or {}
    
    -- Priority Calculus
    self.priority_score = params.priority_score or 0.5
    self.attention_weight = params.attention_weight or 1.0
    self.temporal_decay_rate = params.temporal_decay_rate or 0.01
    
    -- Temporal Tracking
    self.created_at = params.created_at or os.time()
    self.updated_at = params.updated_at or os.time()
    self.last_accessed_at = params.last_accessed_at
    
    -- Metadata
    self.summary = params.summary or ""
    self.source_uri = params.source_uri or ""
    self.created_by = params.created_by or ""
    self.metadata = params.metadata or {}
    
    -- Relationships (in-memory graph)
    self.outgoing_links = {}
    self.incoming_links = {}
    
    -- Compute initial hash
    self:compute_hash()
    
    return self
end

-- Content hash for version tracking
function Card:compute_hash()
    local content_str = json.encode(self.content)
    -- Simple hash (in production, use sha256)
    local hash = 0
    for i = 1, #content_str do
        hash = (hash * 31 + string.byte(content_str, i)) % 2^32
    end
    self.hash = string.format("%08x", hash)
    return self.hash
end

-- Update content with versioning
function Card:update_content(new_content)
    -- Archive current state
    table.insert(self.hash_history, self.hash)
    if #self.embedding > 0 then
        table.insert(self.embedding_history, self.embedding)
    end
    
    -- Apply update
    self.content = new_content
    self.updated_at = os.time()
    self:compute_hash()
    
    return self
end

-- Priority with temporal decay
function Card:decayed_priority(as_of)
    as_of = as_of or os.time()
    local age_days = (as_of - self.updated_at) / 86400
    return self.priority_score * math.exp(-self.temporal_decay_rate * age_days)
end

-- Record access
function Card:touch()
    self.last_accessed_at = os.time()
    return self
end

-- Serialization to KOI format
function Card:to_koi_object()
    return {
        rid = self.rid,
        manifest = {
            content_type = self.content_type,
            created_at = self.created_at,
            updated_at = self.updated_at,
            hash = self.hash
        },
        content = self.content,
        embedding = self.embedding
    }
end

-- Deserialization from KOI format
function Card.from_koi_object(kobj)
    return Card.new({
        rid = kobj.rid,
        content_type = kobj.manifest.content_type,
        created_at = kobj.manifest.created_at,
        content = kobj.content,
        embedding = kobj.embedding
    })
end

-- String representation
function Card:__tostring()
    return string.format("Card<%s:%s>", self.content_type, self.id:sub(1,8))
end

--------------------------------------------------------------------------------
-- CARD_LINK: Typed Relationship Between Cards
--------------------------------------------------------------------------------

local CardLink = {}
CardLink.__index = CardLink

function CardLink.new(source, target, link_type, weight)
    local self = setmetatable({}, CardLink)
    
    self.id = uuid()
    self.source = source
    self.target = target
    self.link_type = link_type or "relates_to"
    self.weight = weight or 1.0
    self.metadata = {}
    self.created_at = os.time()
    
    -- Register with cards
    table.insert(source.outgoing_links, self)
    table.insert(target.incoming_links, self)
    
    return self
end

function CardLink:__tostring()
    return string.format("Link<%s --%s--> %s>", 
        tostring(self.source), self.link_type, tostring(self.target))
end

--------------------------------------------------------------------------------
-- CARD_STORE: In-Memory Repository
--------------------------------------------------------------------------------

local CardStore = {}
CardStore.__index = CardStore

function CardStore.new()
    local self = setmetatable({}, CardStore)
    self.cards = {}      -- id -> Card
    self.by_rid = {}     -- rid -> Card
    self.by_type = {}    -- content_type -> {Card, ...}
    return self
end

function CardStore:add(card)
    self.cards[card.id] = card
    self.by_rid[card.rid] = card
    
    local type_set = self.by_type[card.content_type] or {}
    table.insert(type_set, card)
    self.by_type[card.content_type] = type_set
    
    return card
end

function CardStore:get(id)
    return self.cards[id]
end

function CardStore:get_by_rid(rid)
    return self.by_rid[rid]
end

function CardStore:all()
    local result = {}
    for _, card in pairs(self.cards) do
        table.insert(result, card)
    end
    return result
end

function CardStore:by_content_type(content_type)
    return self.by_type[content_type] or {}
end

-- Priority-sorted retrieval
function CardStore:by_priority(as_of)
    as_of = as_of or os.time()
    local cards = self:all()
    table.sort(cards, function(a, b)
        return a:decayed_priority(as_of) > b:decayed_priority(as_of)
    end)
    return cards
end

-- Semantic search (placeholder - requires embedding comparison)
function CardStore:search_semantic(query_embedding, k)
    k = k or 10
    local scored = {}
    
    for _, card in pairs(self.cards) do
        if #card.embedding > 0 then
            local sim = cosine_similarity(query_embedding, card.embedding)
            table.insert(scored, {card = card, score = sim})
        end
    end
    
    table.sort(scored, function(a, b) return a.score > b.score end)
    
    local results = {}
    for i = 1, math.min(k, #scored) do
        table.insert(results, scored[i].card)
    end
    return results
end

--------------------------------------------------------------------------------
-- SPECIALIZED CARD TYPES (via prototype extension)
--------------------------------------------------------------------------------

-- Email Card
local EmailCard = setmetatable({}, {__index = Card})
EmailCard.__index = EmailCard

function EmailCard.new(params)
    params = params or {}
    params.content_type = "email"
    local self = Card.new(params)
    setmetatable(self, EmailCard)
    
    self.subject = params.subject or ""
    self.body = params.body or ""
    self.from_email = params.from_email or ""
    self.to_emails = params.to_emails or {}
    self.cc_emails = params.cc_emails or {}
    
    return self
end

-- Task Card
local TaskCard = setmetatable({}, {__index = Card})
TaskCard.__index = TaskCard

function TaskCard.new(params)
    params = params or {}
    params.content_type = "task"
    local self = Card.new(params)
    setmetatable(self, TaskCard)
    
    self.title = params.title or ""
    self.description = params.description or ""
    self.status = params.status or "pending"
    self.due_date = params.due_date
    self.assignee = params.assignee
    
    return self
end

function TaskCard:complete()
    self.status = "completed"
    self.updated_at = os.time()
    return self
end

-- Contact Card
local ContactCard = setmetatable({}, {__index = Card})
ContactCard.__index = ContactCard

function ContactCard.new(params)
    params = params or {}
    params.content_type = "contact"
    local self = Card.new(params)
    setmetatable(self, ContactCard)
    
    self.name = params.name or ""
    self.email = params.email or ""
    self.phone = params.phone or ""
    self.organization = params.organization or ""
    
    return self
end

--------------------------------------------------------------------------------
-- UTILITY: Cosine Similarity
--------------------------------------------------------------------------------

function cosine_similarity(a, b)
    if #a ~= #b or #a == 0 then return 0 end
    
    local dot, norm_a, norm_b = 0, 0, 0
    for i = 1, #a do
        dot = dot + a[i] * b[i]
        norm_a = norm_a + a[i] * a[i]
        norm_b = norm_b + b[i] * b[i]
    end
    
    if norm_a == 0 or norm_b == 0 then return 0 end
    return dot / (math.sqrt(norm_a) * math.sqrt(norm_b))
end

--------------------------------------------------------------------------------
-- MODULE EXPORTS
--------------------------------------------------------------------------------

return {
    Card = Card,
    CardLink = CardLink,
    CardStore = CardStore,
    EmailCard = EmailCard,
    TaskCard = TaskCard,
    ContactCard = ContactCard,
    cosine_similarity = cosine_similarity
}
```

---

### 7.2 Python (with Pydantic/Param) Implementation

Python's class system with Pydantic validation creates robust, type-safe Cards:

```python
"""
cards.py
The Cards System in Python: Morphological Knowledge Infrastructure
Using Pydantic for validation and Param for reactive parameters
"""

from __future__ import annotations

import hashlib
import math
import uuid
from datetime import datetime, timezone
from typing import Any, Optional

import param
from pydantic import BaseModel, Field, computed_field


# =============================================================================
# CARD: The Universal Primitive (Pydantic Model)
# =============================================================================

class CardBase(BaseModel):
    """
    The Card is the universal primitive of the knowledge system.
    Every piece of information inherits this substrate.
    """
    
    # Identity
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    rid: str = Field(default_factory=lambda: str(uuid.uuid4()))
    content_type: str = "card"
    
    # Semantic Position
    embedding: list[float] = Field(default_factory=list)
    embedding_history: list[list[float]] = Field(default_factory=list)
    
    # Content
    content: dict[str, Any] = Field(default_factory=dict)
    hash: Optional[str] = None
    hash_history: list[str] = Field(default_factory=list)
    
    # Priority Calculus
    priority_score: float = Field(default=0.5, ge=0.0, le=1.0)
    attention_weight: float = Field(default=1.0, ge=0.0)
    temporal_decay_rate: float = Field(default=0.01, ge=0.0)
    
    # Temporal Tracking
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    last_accessed_at: Optional[datetime] = None
    
    # Metadata
    summary: str = ""
    source_uri: str = ""
    created_by: str = ""
    metadata: dict[str, Any] = Field(default_factory=dict)
    
    model_config = {"extra": "allow"}
    
    def model_post_init(self, __context: Any) -> None:
        """Compute hash after initialization."""
        if self.hash is None:
            self.hash = self._compute_hash()
    
    def _compute_hash(self) -> str:
        """Compute SHA-256 hash of content."""
        import json
        content_str = json.dumps(self.content, sort_keys=True)
        return hashlib.sha256(content_str.encode()).hexdigest()[:16]
    
    def update_content(self, new_content: dict[str, Any]) -> "CardBase":
        """Update content with version tracking."""
        # Archive current state
        if self.hash:
            self.hash_history.append(self.hash)
        if self.embedding:
            self.embedding_history.append(self.embedding.copy())
        
        # Apply update
        self.content = new_content
        self.updated_at = datetime.now(timezone.utc)
        self.hash = self._compute_hash()
        
        return self
    
    def decayed_priority(self, as_of: Optional[datetime] = None) -> float:
        """Calculate priority with temporal decay."""
        if as_of is None:
            as_of = datetime.now(timezone.utc)
        age_days = (as_of - self.updated_at).total_seconds() / 86400
        return self.priority_score * math.exp(-self.temporal_decay_rate * age_days)
    
    def touch(self) -> "CardBase":
        """Record access to this Card."""
        self.last_accessed_at = datetime.now(timezone.utc)
        return self
    
    def to_koi_object(self) -> dict:
        """Serialize to KOI protocol format."""
        return {
            "rid": self.rid,
            "manifest": {
                "content_type": self.content_type,
                "created_at": self.created_at.isoformat(),
                "updated_at": self.updated_at.isoformat(),
                "hash": self.hash
            },
            "content": self.content,
            "embedding": self.embedding
        }
    
    @classmethod
    def from_koi_object(cls, kobj: dict) -> "CardBase":
        """Deserialize from KOI protocol format."""
        return cls(
            rid=kobj["rid"],
            content_type=kobj["manifest"]["content_type"],
            content=kobj.get("content", {}),
            embedding=kobj.get("embedding", [])
        )
    
    def __repr__(self) -> str:
        return f"Card<{self.content_type}:{self.id[:8]}>"


# =============================================================================
# CARD LINK: Typed Relationship Between Cards
# =============================================================================

class CardLink(BaseModel):
    """Typed, weighted relationship between Cards."""
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    source_id: str
    target_id: str
    link_type: str = "relates_to"
    weight: float = Field(default=1.0, ge=0.0)
    metadata: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    
    def __repr__(self) -> str:
        return f"Link<{self.source_id[:8]} --{self.link_type}--> {self.target_id[:8]}>"


# =============================================================================
# SPECIALIZED CARD TYPES
# =============================================================================

class EmailCard(CardBase):
    """Email message as a Card."""
    content_type: str = "email"
    subject: str = ""
    body: str = ""
    from_email: str = ""
    to_emails: list[str] = Field(default_factory=list)
    cc_emails: list[str] = Field(default_factory=list)
    sent_at: Optional[datetime] = None


class TaskCard(CardBase):
    """Task or todo item as a Card."""
    content_type: str = "task"
    title: str = ""
    description: str = ""
    status: str = "pending"
    due_date: Optional[datetime] = None
    assignee: Optional[str] = None
    
    def complete(self) -> "TaskCard":
        """Mark task as completed."""
        self.status = "completed"
        self.updated_at = datetime.now(timezone.utc)
        return self
    
    @computed_field
    @property
    def is_overdue(self) -> bool:
        """Check if task is past due date."""
        if self.due_date is None or self.status == "completed":
            return False
        return datetime.now(timezone.utc) > self.due_date


class ContactCard(CardBase):
    """Person or entity as a Card."""
    content_type: str = "contact"
    name: str = ""
    email: str = ""
    phone: str = ""
    organization: str = ""
    notes: str = ""


class ProjectCard(CardBase):
    """Project or initiative as a Card."""
    content_type: str = "project"
    name: str = ""
    description: str = ""
    status: str = "active"
    start_date: Optional[datetime] = None
    target_date: Optional[datetime] = None
    objectives: list[str] = Field(default_factory=list)


class InsightCard(CardBase):
    """Realization or learning as a Card."""
    content_type: str = "insight"
    title: str = ""
    body: str = ""
    confidence: float = Field(default=0.5, ge=0.0, le=1.0)
    domain: str = ""


# =============================================================================
# CARD STORE: Repository with Query Capabilities
# =============================================================================

class CardStore:
    """In-memory repository for Cards with query operations."""
    
    def __init__(self):
        self._cards: dict[str, CardBase] = {}
        self._by_rid: dict[str, CardBase] = {}
        self._by_type: dict[str, list[CardBase]] = {}
        self._links: list[CardLink] = []
    
    def add(self, card: CardBase) -> CardBase:
        """Add a Card to the store."""
        self._cards[card.id] = card
        self._by_rid[card.rid] = card
        
        if card.content_type not in self._by_type:
            self._by_type[card.content_type] = []
        self._by_type[card.content_type].append(card)
        
        return card
    
    def get(self, id: str) -> Optional[CardBase]:
        """Retrieve Card by ID."""
        return self._cards.get(id)
    
    def get_by_rid(self, rid: str) -> Optional[CardBase]:
        """Retrieve Card by RID."""
        return self._by_rid.get(rid)
    
    def all(self) -> list[CardBase]:
        """Get all Cards."""
        return list(self._cards.values())
    
    def by_type(self, content_type: str) -> list[CardBase]:
        """Get Cards of specific type."""
        return self._by_type.get(content_type, [])
    
    def by_priority(self, as_of: Optional[datetime] = None) -> list[CardBase]:
        """Get Cards sorted by decayed priority."""
        cards = self.all()
        return sorted(cards, key=lambda c: c.decayed_priority(as_of), reverse=True)
    
    def link(self, source: CardBase, target: CardBase, 
             link_type: str = "relates_to", weight: float = 1.0) -> CardLink:
        """Create a link between Cards."""
        link = CardLink(
            source_id=source.id,
            target_id=target.id,
            link_type=link_type,
            weight=weight
        )
        self._links.append(link)
        return link
    
    def links_from(self, card: CardBase) -> list[CardLink]:
        """Get outgoing links from a Card."""
        return [l for l in self._links if l.source_id == card.id]
    
    def links_to(self, card: CardBase) -> list[CardLink]:
        """Get incoming links to a Card."""
        return [l for l in self._links if l.target_id == card.id]
    
    def search_semantic(self, query_embedding: list[float], k: int = 10) -> list[CardBase]:
        """Find Cards most similar to query embedding."""
        scored = []
        for card in self._cards.values():
            if card.embedding:
                sim = cosine_similarity(query_embedding, card.embedding)
                scored.append((card, sim))
        
        scored.sort(key=lambda x: x[1], reverse=True)
        return [card for card, _ in scored[:k]]


# =============================================================================
# PARAM-BASED REACTIVE CARD (Alternative Pattern)
# =============================================================================

class ReactiveCard(param.Parameterized):
    """
    Param-based Card with reactive parameters.
    Useful for Panel dashboards and reactive pipelines.
    """
    
    id = param.String(default="", doc="Unique identifier")
    rid = param.String(default="", doc="KOI Reference Identifier")
    content_type = param.String(default="card", doc="Card type discriminator")
    
    embedding = param.List(default=[], doc="Semantic embedding vector")
    content = param.Dict(default={}, doc="Structured content")
    
    priority_score = param.Number(default=0.5, bounds=(0, 1), doc="Base priority")
    attention_weight = param.Number(default=1.0, bounds=(0, None), doc="Attention multiplier")
    temporal_decay_rate = param.Number(default=0.01, bounds=(0, None), doc="Decay rate per day")
    
    summary = param.String(default="", doc="LLM-generated summary")
    
    def __init__(self, **params):
        if "id" not in params:
            params["id"] = str(uuid.uuid4())
        if "rid" not in params:
            params["rid"] = str(uuid.uuid4())
        super().__init__(**params)
        self._created_at = datetime.now(timezone.utc)
        self._updated_at = datetime.now(timezone.utc)
    
    @param.depends("priority_score", "temporal_decay_rate")
    def decayed_priority(self) -> float:
        """Reactive decayed priority computation."""
        age_days = (datetime.now(timezone.utc) - self._updated_at).total_seconds() / 86400
        return self.priority_score * math.exp(-self.temporal_decay_rate * age_days)


# =============================================================================
# UTILITIES
# =============================================================================

def cosine_similarity(a: list[float], b: list[float]) -> float:
    """Compute cosine similarity between two vectors."""
    if len(a) != len(b) or len(a) == 0:
        return 0.0
    
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(x * x for x in b))
    
    if norm_a == 0 or norm_b == 0:
        return 0.0
    
    return dot / (norm_a * norm_b)


# =============================================================================
# EXAMPLE USAGE
# =============================================================================

if __name__ == "__main__":
    # Create a store
    store = CardStore()
    
    # Create some Cards
    email = EmailCard(
        subject="Project Update",
        body="Here's the latest on the Cards system...",
        from_email="collaborator@example.com",
        priority_score=0.8
    )
    store.add(email)
    
    task = TaskCard(
        title="Implement embedding pipeline",
        description="Set up the semantic embedding generation",
        due_date=datetime(2025, 2, 15, tzinfo=timezone.utc),
        priority_score=0.9
    )
    store.add(task)
    
    # Link them
    store.link(email, task, link_type="derived_from", weight=0.9)
    
    # Query by priority
    top_cards = store.by_priority()
    for card in top_cards:
        print(f"{card}: priority={card.decayed_priority():.3f}")
```

---

### 7.3 TypeScript Implementation

TypeScript's type system provides compile-time safety for the Cards architecture:

```typescript
/**
 * cards.ts
 * The Cards System in TypeScript: Morphological Knowledge Infrastructure
 * Type-safe, immutable-friendly implementation
 */

import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

interface KOIObject {
  rid: string;
  manifest: {
    content_type: string;
    created_at: string;
    updated_at: string;
    hash: string;
  };
  content: Record<string, unknown>;
  embedding: number[];
}

type LinkType = 
  | 'supports'
  | 'contradicts'
  | 'derived_from'
  | 'parent_of'
  | 'cites'
  | 'blocks'
  | 'relates_to';

// =============================================================================
// CARD: The Universal Primitive
// =============================================================================

class Card {
  // Identity
  readonly id: string;
  readonly rid: string;
  readonly contentType: string;
  
  // Semantic Position
  embedding: number[];
  embeddingHistory: number[][];
  
  // Content
  content: Record<string, unknown>;
  hash: string;
  hashHistory: string[];
  
  // Priority Calculus
  priorityScore: number;
  attentionWeight: number;
  temporalDecayRate: number;
  
  // Temporal Tracking
  readonly createdAt: Date;
  updatedAt: Date;
  lastAccessedAt: Date | null;
  
  // Metadata
  summary: string;
  sourceUri: string;
  createdBy: string;
  metadata: Record<string, unknown>;

  constructor(params: Partial<Card> & { contentType?: string } = {}) {
    // Identity
    this.id = params.id ?? uuidv4();
    this.rid = params.rid ?? uuidv4();
    this.contentType = params.contentType ?? 'card';
    
    // Semantic Position
    this.embedding = params.embedding ?? [];
    this.embeddingHistory = params.embeddingHistory ?? [];
    
    // Content
    this.content = params.content ?? {};
    this.hashHistory = params.hashHistory ?? [];
    this.hash = this.computeHash();
    
    // Priority Calculus
    this.priorityScore = params.priorityScore ?? 0.5;
    this.attentionWeight = params.attentionWeight ?? 1.0;
    this.temporalDecayRate = params.temporalDecayRate ?? 0.01;
    
    // Temporal Tracking
    this.createdAt = params.createdAt ?? new Date();
    this.updatedAt = params.updatedAt ?? new Date();
    this.lastAccessedAt = params.lastAccessedAt ?? null;
    
    // Metadata
    this.summary = params.summary ?? '';
    this.sourceUri = params.sourceUri ?? '';
    this.createdBy = params.createdBy ?? '';
    this.metadata = params.metadata ?? {};
  }

  private computeHash(): string {
    const contentStr = JSON.stringify(this.content);
    return crypto.createHash('sha256').update(contentStr).digest('hex').slice(0, 16);
  }

  updateContent(newContent: Record<string, unknown>): this {
    // Archive current state
    this.hashHistory.push(this.hash);
    if (this.embedding.length > 0) {
      this.embeddingHistory.push([...this.embedding]);
    }
    
    // Apply update
    this.content = newContent;
    this.updatedAt = new Date();
    this.hash = this.computeHash();
    
    return this;
  }

  decayedPriority(asOf: Date = new Date()): number {
    const ageDays = (asOf.getTime() - this.updatedAt.getTime()) / (1000 * 60 * 60 * 24);
    return this.priorityScore * Math.exp(-this.temporalDecayRate * ageDays);
  }

  touch(): this {
    this.lastAccessedAt = new Date();
    return this;
  }

  toKOIObject(): KOIObject {
    return {
      rid: this.rid,
      manifest: {
        content_type: this.contentType,
        created_at: this.createdAt.toISOString(),
        updated_at: this.updatedAt.toISOString(),
        hash: this.hash
      },
      content: this.content,
      embedding: this.embedding
    };
  }

  static fromKOIObject(kobj: KOIObject): Card {
    return new Card({
      rid: kobj.rid,
      contentType: kobj.manifest.content_type,
      content: kobj.content,
      embedding: kobj.embedding
    });
  }

  toString(): string {
    return `Card<${this.contentType}:${this.id.slice(0, 8)}>`;
  }
}

// =============================================================================
// CARD LINK: Typed Relationship
// =============================================================================

class CardLink {
  readonly id: string;
  readonly sourceId: string;
  readonly targetId: string;
  readonly linkType: LinkType;
  weight: number;
  metadata: Record<string, unknown>;
  readonly createdAt: Date;

  constructor(
    sourceId: string,
    targetId: string,
    linkType: LinkType = 'relates_to',
    weight: number = 1.0
  ) {
    this.id = uuidv4();
    this.sourceId = sourceId;
    this.targetId = targetId;
    this.linkType = linkType;
    this.weight = weight;
    this.metadata = {};
    this.createdAt = new Date();
  }

  toString(): string {
    return `Link<${this.sourceId.slice(0, 8)} --${this.linkType}--> ${this.targetId.slice(0, 8)}>`;
  }
}

// =============================================================================
// SPECIALIZED CARD TYPES
// =============================================================================

class EmailCard extends Card {
  subject: string;
  body: string;
  fromEmail: string;
  toEmails: string[];
  ccEmails: string[];
  sentAt: Date | null;

  constructor(params: Partial<EmailCard> = {}) {
    super({ ...params, contentType: 'email' });
    this.subject = params.subject ?? '';
    this.body = params.body ?? '';
    this.fromEmail = params.fromEmail ?? '';
    this.toEmails = params.toEmails ?? [];
    this.ccEmails = params.ccEmails ?? [];
    this.sentAt = params.sentAt ?? null;
  }
}

class TaskCard extends Card {
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  dueDate: Date | null;
  assignee: string | null;

  constructor(params: Partial<TaskCard> = {}) {
    super({ ...params, contentType: 'task' });
    this.title = params.title ?? '';
    this.description = params.description ?? '';
    this.status = params.status ?? 'pending';
    this.dueDate = params.dueDate ?? null;
    this.assignee = params.assignee ?? null;
  }

  complete(): this {
    this.status = 'completed';
    this.updatedAt = new Date();
    return this;
  }

  get isOverdue(): boolean {
    if (!this.dueDate || this.status === 'completed') return false;
    return new Date() > this.dueDate;
  }
}

class ContactCard extends Card {
  name: string;
  email: string;
  phone: string;
  organization: string;
  notes: string;

  constructor(params: Partial<ContactCard> = {}) {
    super({ ...params, contentType: 'contact' });
    this.name = params.name ?? '';
    this.email = params.email ?? '';
    this.phone = params.phone ?? '';
    this.organization = params.organization ?? '';
    this.notes = params.notes ?? '';
  }
}

class ProjectCard extends Card {
  name: string;
  description: string;
  status: 'planning' | 'active' | 'paused' | 'completed' | 'cancelled';
  startDate: Date | null;
  targetDate: Date | null;
  objectives: string[];

  constructor(params: Partial<ProjectCard> = {}) {
    super({ ...params, contentType: 'project' });
    this.name = params.name ?? '';
    this.description = params.description ?? '';
    this.status = params.status ?? 'planning';
    this.startDate = params.startDate ?? null;
    this.targetDate = params.targetDate ?? null;
    this.objectives = params.objectives ?? [];
  }
}

class InsightCard extends Card {
  title: string;
  body: string;
  confidence: number;
  domain: string;

  constructor(params: Partial<InsightCard> = {}) {
    super({ ...params, contentType: 'insight' });
    this.title = params.title ?? '';
    this.body = params.body ?? '';
    this.confidence = params.confidence ?? 0.5;
    this.domain = params.domain ?? '';
  }
}

// =============================================================================
// CARD STORE: Repository
// =============================================================================

class CardStore {
  private cards: Map<string, Card> = new Map();
  private byRid: Map<string, Card> = new Map();
  private byType: Map<string, Card[]> = new Map();
  private links: CardLink[] = [];

  add<T extends Card>(card: T): T {
    this.cards.set(card.id, card);
    this.byRid.set(card.rid, card);
    
    const typeCards = this.byType.get(card.contentType) ?? [];
    typeCards.push(card);
    this.byType.set(card.contentType, typeCards);
    
    return card;
  }

  get(id: string): Card | undefined {
    return this.cards.get(id);
  }

  getByRid(rid: string): Card | undefined {
    return this.byRid.get(rid);
  }

  all(): Card[] {
    return Array.from(this.cards.values());
  }

  ofType<T extends Card>(contentType: string): T[] {
    return (this.byType.get(contentType) ?? []) as T[];
  }

  byPriority(asOf: Date = new Date()): Card[] {
    return this.all().sort((a, b) => b.decayedPriority(asOf) - a.decayedPriority(asOf));
  }

  link(source: Card, target: Card, linkType: LinkType = 'relates_to', weight: number = 1.0): CardLink {
    const link = new CardLink(source.id, target.id, linkType, weight);
    this.links.push(link);
    return link;
  }

  linksFrom(card: Card): CardLink[] {
    return this.links.filter(l => l.sourceId === card.id);
  }

  linksTo(card: Card): CardLink[] {
    return this.links.filter(l => l.targetId === card.id);
  }

  searchSemantic(queryEmbedding: number[], k: number = 10): Card[] {
    const scored = this.all()
      .filter(card => card.embedding.length > 0)
      .map(card => ({
        card,
        score: cosineSimilarity(queryEmbedding, card.embedding)
      }));
    
    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, k)
      .map(s => s.card);
  }
}

// =============================================================================
// UTILITIES
// =============================================================================

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// =============================================================================
// EXPORTS
// =============================================================================

export {
  Card,
  CardLink,
  CardStore,
  EmailCard,
  TaskCard,
  ContactCard,
  ProjectCard,
  InsightCard,
  cosineSimilarity,
  KOIObject,
  LinkType
};
```

---

### 7.4 Rust Implementation

Rust provides memory safety and performance for production-grade Cards:

```rust
//! cards.rs
//! The Cards System in Rust: Morphological Knowledge Infrastructure
//! Memory-safe, zero-cost abstractions

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use uuid::Uuid;

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

pub type CardId = Uuid;
pub type RID = Uuid;
pub type Embedding = Vec<f64>;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum LinkType {
    Supports,
    Contradicts,
    DerivedFrom,
    ParentOf,
    Cites,
    Blocks,
    RelatesTo,
}

impl Default for LinkType {
    fn default() -> Self {
        LinkType::RelatesTo
    }
}

// =============================================================================
// CARD: The Universal Primitive
// =============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Card {
    // Identity
    pub id: CardId,
    pub rid: RID,
    pub content_type: String,
    
    // Semantic Position
    pub embedding: Embedding,
    pub embedding_history: Vec<Embedding>,
    
    // Content
    pub content: serde_json::Value,
    pub hash: String,
    pub hash_history: Vec<String>,
    
    // Priority Calculus
    pub priority_score: f64,
    pub attention_weight: f64,
    pub temporal_decay_rate: f64,
    
    // Temporal Tracking
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub last_accessed_at: Option<DateTime<Utc>>,
    
    // Metadata
    pub summary: String,
    pub source_uri: String,
    pub created_by: String,
    pub metadata: serde_json::Value,
}

impl Default for Card {
    fn default() -> Self {
        let now = Utc::now();
        let content = serde_json::json!({});
        let hash = Self::compute_hash_for(&content);
        
        Self {
            id: Uuid::new_v4(),
            rid: Uuid::new_v4(),
            content_type: "card".to_string(),
            embedding: vec![],
            embedding_history: vec![],
            content,
            hash,
            hash_history: vec![],
            priority_score: 0.5,
            attention_weight: 1.0,
            temporal_decay_rate: 0.01,
            created_at: now,
            updated_at: now,
            last_accessed_at: None,
            summary: String::new(),
            source_uri: String::new(),
            created_by: String::new(),
            metadata: serde_json::json!({}),
        }
    }
}

impl Card {
    pub fn new(content_type: &str) -> Self {
        Self {
            content_type: content_type.to_string(),
            ..Default::default()
        }
    }
    
    pub fn with_content(mut self, content: serde_json::Value) -> Self {
        self.content = content;
        self.hash = Self::compute_hash_for(&self.content);
        self
    }
    
    pub fn with_embedding(mut self, embedding: Embedding) -> Self {
        self.embedding = embedding;
        self
    }
    
    pub fn with_priority(mut self, score: f64) -> Self {
        self.priority_score = score.clamp(0.0, 1.0);
        self
    }
    
    fn compute_hash_for(content: &serde_json::Value) -> String {
        let content_str = serde_json::to_string(content).unwrap_or_default();
        let mut hasher = Sha256::new();
        hasher.update(content_str.as_bytes());
        let result = hasher.finalize();
        hex::encode(&result[..8])
    }
    
    pub fn update_content(&mut self, new_content: serde_json::Value) {
        // Archive current state
        self.hash_history.push(self.hash.clone());
        if !self.embedding.is_empty() {
            self.embedding_history.push(self.embedding.clone());
        }
        
        // Apply update
        self.content = new_content;
        self.updated_at = Utc::now();
        self.hash = Self::compute_hash_for(&self.content);
    }
    
    pub fn decayed_priority(&self, as_of: Option<DateTime<Utc>>) -> f64 {
        let as_of = as_of.unwrap_or_else(Utc::now);
        let age_days = (as_of - self.updated_at).num_seconds() as f64 / 86400.0;
        self.priority_score * (-self.temporal_decay_rate * age_days).exp()
    }
    
    pub fn touch(&mut self) {
        self.last_accessed_at = Some(Utc::now());
    }
    
    pub fn to_koi_object(&self) -> KOIObject {
        KOIObject {
            rid: self.rid,
            manifest: KOIManifest {
                content_type: self.content_type.clone(),
                created_at: self.created_at,
                updated_at: self.updated_at,
                hash: self.hash.clone(),
            },
            content: self.content.clone(),
            embedding: self.embedding.clone(),
        }
    }
    
    pub fn from_koi_object(kobj: KOIObject) -> Self {
        Self {
            rid: kobj.rid,
            content_type: kobj.manifest.content_type,
            content: kobj.content,
            embedding: kobj.embedding,
            hash: kobj.manifest.hash,
            ..Default::default()
        }
    }
}

// =============================================================================
// KOI PROTOCOL TYPES
// =============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KOIManifest {
    pub content_type: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub hash: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KOIObject {
    pub rid: RID,
    pub manifest: KOIManifest,
    pub content: serde_json::Value,
    pub embedding: Embedding,
}

// =============================================================================
// CARD LINK
// =============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CardLink {
    pub id: Uuid,
    pub source_id: CardId,
    pub target_id: CardId,
    pub link_type: LinkType,
    pub weight: f64,
    pub metadata: serde_json::Value,
    pub created_at: DateTime<Utc>,
}

impl CardLink {
    pub fn new(source_id: CardId, target_id: CardId, link_type: LinkType) -> Self {
        Self {
            id: Uuid::new_v4(),
            source_id,
            target_id,
            link_type,
            weight: 1.0,
            metadata: serde_json::json!({}),
            created_at: Utc::now(),
        }
    }
    
    pub fn with_weight(mut self, weight: f64) -> Self {
        self.weight = weight;
        self
    }
}

// =============================================================================
// SPECIALIZED CARD TYPES
// =============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmailCard {
    #[serde(flatten)]
    pub card: Card,
    pub subject: String,
    pub body: String,
    pub from_email: String,
    pub to_emails: Vec<String>,
    pub cc_emails: Vec<String>,
    pub sent_at: Option<DateTime<Utc>>,
}

impl EmailCard {
    pub fn new(subject: &str, body: &str, from: &str) -> Self {
        Self {
            card: Card::new("email"),
            subject: subject.to_string(),
            body: body.to_string(),
            from_email: from.to_string(),
            to_emails: vec![],
            cc_emails: vec![],
            sent_at: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskCard {
    #[serde(flatten)]
    pub card: Card,
    pub title: String,
    pub description: String,
    pub status: TaskStatus,
    pub due_date: Option<DateTime<Utc>>,
    pub assignee: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TaskStatus {
    Pending,
    InProgress,
    Completed,
    Cancelled,
}

impl Default for TaskStatus {
    fn default() -> Self {
        TaskStatus::Pending
    }
}

impl TaskCard {
    pub fn new(title: &str) -> Self {
        Self {
            card: Card::new("task"),
            title: title.to_string(),
            description: String::new(),
            status: TaskStatus::Pending,
            due_date: None,
            assignee: None,
        }
    }
    
    pub fn complete(&mut self) {
        self.status = TaskStatus::Completed;
        self.card.updated_at = Utc::now();
    }
    
    pub fn is_overdue(&self) -> bool {
        match (self.due_date, self.status) {
            (Some(due), status) if status != TaskStatus::Completed => Utc::now() > due,
            _ => false,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContactCard {
    #[serde(flatten)]
    pub card: Card,
    pub name: String,
    pub email: String,
    pub phone: String,
    pub organization: String,
    pub notes: String,
}

impl ContactCard {
    pub fn new(name: &str, email: &str) -> Self {
        Self {
            card: Card::new("contact"),
            name: name.to_string(),
            email: email.to_string(),
            phone: String::new(),
            organization: String::new(),
            notes: String::new(),
        }
    }
}

// =============================================================================
// CARD STORE
// =============================================================================

pub struct CardStore {
    cards: HashMap<CardId, Card>,
    by_rid: HashMap<RID, CardId>,
    by_type: HashMap<String, Vec<CardId>>,
    links: Vec<CardLink>,
}

impl CardStore {
    pub fn new() -> Self {
        Self {
            cards: HashMap::new(),
            by_rid: HashMap::new(),
            by_type: HashMap::new(),
            links: vec![],
        }
    }
    
    pub fn add(&mut self, card: Card) -> CardId {
        let id = card.id;
        let rid = card.rid;
        let content_type = card.content_type.clone();
        
        self.cards.insert(id, card);
        self.by_rid.insert(rid, id);
        self.by_type
            .entry(content_type)
            .or_insert_with(Vec::new)
            .push(id);
        
        id
    }
    
    pub fn get(&self, id: &CardId) -> Option<&Card> {
        self.cards.get(id)
    }
    
    pub fn get_mut(&mut self, id: &CardId) -> Option<&mut Card> {
        self.cards.get_mut(id)
    }
    
    pub fn get_by_rid(&self, rid: &RID) -> Option<&Card> {
        self.by_rid.get(rid).and_then(|id| self.cards.get(id))
    }
    
    pub fn all(&self) -> impl Iterator<Item = &Card> {
        self.cards.values()
    }
    
    pub fn by_type(&self, content_type: &str) -> Vec<&Card> {
        self.by_type
            .get(content_type)
            .map(|ids| ids.iter().filter_map(|id| self.cards.get(id)).collect())
            .unwrap_or_default()
    }
    
    pub fn by_priority(&self, as_of: Option<DateTime<Utc>>) -> Vec<&Card> {
        let mut cards: Vec<_> = self.cards.values().collect();
        cards.sort_by(|a, b| {
            b.decayed_priority(as_of)
                .partial_cmp(&a.decayed_priority(as_of))
                .unwrap_or(std::cmp::Ordering::Equal)
        });
        cards
    }
    
    pub fn link(&mut self, source: CardId, target: CardId, link_type: LinkType) -> &CardLink {
        let link = CardLink::new(source, target, link_type);
        self.links.push(link);
        self.links.last().unwrap()
    }
    
    pub fn links_from(&self, card_id: &CardId) -> Vec<&CardLink> {
        self.links.iter().filter(|l| &l.source_id == card_id).collect()
    }
    
    pub fn links_to(&self, card_id: &CardId) -> Vec<&CardLink> {
        self.links.iter().filter(|l| &l.target_id == card_id).collect()
    }
    
    pub fn search_semantic(&self, query_embedding: &Embedding, k: usize) -> Vec<&Card> {
        let mut scored: Vec<_> = self.cards
            .values()
            .filter(|c| !c.embedding.is_empty())
            .map(|c| (c, cosine_similarity(query_embedding, &c.embedding)))
            .collect();
        
        scored.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));
        scored.into_iter().take(k).map(|(c, _)| c).collect()
    }
}

impl Default for CardStore {
    fn default() -> Self {
        Self::new()
    }
}

// =============================================================================
// UTILITIES
// =============================================================================

pub fn cosine_similarity(a: &[f64], b: &[f64]) -> f64 {
    if a.len() != b.len() || a.is_empty() {
        return 0.0;
    }
    
    let (dot, norm_a, norm_b) = a.iter().zip(b.iter()).fold(
        (0.0, 0.0, 0.0),
        |(dot, na, nb), (x, y)| (dot + x * y, na + x * x, nb + y * y),
    );
    
    if norm_a == 0.0 || norm_b == 0.0 {
        return 0.0;
    }
    
    dot / (norm_a.sqrt() * norm_b.sqrt())
}

// =============================================================================
// TESTS
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_card_creation() {
        let card = Card::new("test")
            .with_content(serde_json::json!({"key": "value"}))
            .with_priority(0.8);
        
        assert_eq!(card.content_type, "test");
        assert_eq!(card.priority_score, 0.8);
        assert!(!card.hash.is_empty());
    }
    
    #[test]
    fn test_version_tracking() {
        let mut card = Card::new("test").with_content(serde_json::json!({"v": 1}));
        let original_hash = card.hash.clone();
        
        card.update_content(serde_json::json!({"v": 2}));
        
        assert_ne!(card.hash, original_hash);
        assert_eq!(card.hash_history.len(), 1);
        assert_eq!(card.hash_history[0], original_hash);
    }
    
    #[test]
    fn test_priority_decay() {
        let card = Card::new("test").with_priority(1.0);
        let now = Utc::now();
        let future = now + chrono::Duration::days(10);
        
        let current_priority = card.decayed_priority(Some(now));
        let future_priority = card.decayed_priority(Some(future));
        
        assert!(future_priority < current_priority);
    }
    
    #[test]
    fn test_cosine_similarity() {
        let a = vec![1.0, 0.0, 0.0];
        let b = vec![0.0, 1.0, 0.0];
        let c = vec![1.0, 0.0, 0.0];
        
        assert!((cosine_similarity(&a, &b) - 0.0).abs() < 1e-10);
        assert!((cosine_similarity(&a, &c) - 1.0).abs() < 1e-10);
    }
}
```

---

### 7.5 Bash Implementation

Bash provides command-line access to Cards through simple file operations:

```bash
#!/usr/bin/env bash

# cards.sh
# The Cards System in Bash: Morphological Knowledge Infrastructure
# File-based implementation using JSON and standard Unix tools

set -euo pipefail

# =============================================================================
# CONFIGURATION
# =============================================================================

CARDS_DIR="${CARDS_DIR:-$HOME/.cards}"
CARDS_DB="$CARDS_DIR/cards"
LINKS_DB="$CARDS_DIR/links"
INDEX_FILE="$CARDS_DIR/index.json"

# Ensure directories exist
mkdir -p "$CARDS_DB" "$LINKS_DB"

# =============================================================================
# UTILITIES
# =============================================================================

# Generate UUID
generate_uuid() {
    if command -v uuidgen &>/dev/null; then
        uuidgen | tr '[:upper:]' '[:lower:]'
    else
        cat /proc/sys/kernel/random/uuid 2>/dev/null || \
        python3 -c "import uuid; print(uuid.uuid4())"
    fi
}

# Get current ISO timestamp
timestamp() {
    date -u +"%Y-%m-%dT%H:%M:%SZ"
}

# Compute content hash
compute_hash() {
    echo -n "$1" | sha256sum | cut -c1-16
}

# JSON pretty print
json_pp() {
    if command -v jq &>/dev/null; then
        jq '.'
    else
        python3 -m json.tool
    fi
}

# JSON query
json_get() {
    local file="$1"
    local path="$2"
    jq -r "$path" "$file" 2>/dev/null || echo ""
}

# Calculate decayed priority
decayed_priority() {
    local priority="$1"
    local decay_rate="$2"
    local updated_at="$3"
    local now
    now=$(date +%s)
    local updated
    updated=$(date -d "$updated_at" +%s 2>/dev/null || date +%s)
    local age_days
    age_days=$(echo "scale=6; ($now - $updated) / 86400" | bc)
    echo "scale=6; $priority * e(-$decay_rate * $age_days)" | bc -l
}

# =============================================================================
# CARD OPERATIONS
# =============================================================================

# Create a new card
card_create() {
    local content_type="${1:-card}"
    local content="${2:-{}}"
    
    local id
    id=$(generate_uuid)
    local rid
    rid=$(generate_uuid)
    local now
    now=$(timestamp)
    local hash
    hash=$(compute_hash "$content")
    
    local card_file="$CARDS_DB/$id.json"
    
    cat > "$card_file" <<EOF
{
    "id": "$id",
    "rid": "$rid",
    "content_type": "$content_type",
    "embedding": [],
    "embedding_history": [],
    "content": $content,
    "hash": "$hash",
    "hash_history": [],
    "priority_score": 0.5,
    "attention_weight": 1.0,
    "temporal_decay_rate": 0.01,
    "created_at": "$now",
    "updated_at": "$now",
    "last_accessed_at": null,
    "summary": "",
    "source_uri": "",
    "created_by": "",
    "metadata": {}
}
EOF
    
    echo "$id"
}

# Get a card by ID
card_get() {
    local id="$1"
    local card_file="$CARDS_DB/$id.json"
    
    if [[ -f "$card_file" ]]; then
        cat "$card_file" | json_pp
    else
        echo "Card not found: $id" >&2
        return 1
    fi
}

# Update card content
card_update() {
    local id="$1"
    local new_content="$2"
    local card_file="$CARDS_DB/$id.json"
    
    if [[ ! -f "$card_file" ]]; then
        echo "Card not found: $id" >&2
        return 1
    fi
    
    local old_hash
    old_hash=$(json_get "$card_file" '.hash')
    local old_embedding
    old_embedding=$(json_get "$card_file" '.embedding')
    local now
    now=$(timestamp)
    local new_hash
    new_hash=$(compute_hash "$new_content")
    
    # Update with jq
    jq --arg content "$new_content" \
       --arg hash "$new_hash" \
       --arg old_hash "$old_hash" \
       --arg now "$now" \
       '.content = ($content | fromjson) |
        .hash_history += [$old_hash] |
        .hash = $hash |
        .updated_at = $now' "$card_file" > "$card_file.tmp"
    
    mv "$card_file.tmp" "$card_file"
    echo "Updated card: $id"
}

# Set card priority
card_set_priority() {
    local id="$1"
    local priority="$2"
    local card_file="$CARDS_DB/$id.json"
    
    if [[ ! -f "$card_file" ]]; then
        echo "Card not found: $id" >&2
        return 1
    fi
    
    jq --argjson priority "$priority" \
       '.priority_score = $priority' "$card_file" > "$card_file.tmp"
    
    mv "$card_file.tmp" "$card_file"
    echo "Set priority for $id: $priority"
}

# Touch a card (update last_accessed_at)
card_touch() {
    local id="$1"
    local card_file="$CARDS_DB/$id.json"
    local now
    now=$(timestamp)
    
    jq --arg now "$now" '.last_accessed_at = $now' "$card_file" > "$card_file.tmp"
    mv "$card_file.tmp" "$card_file"
}

# List all cards
card_list() {
    local type_filter="${1:-}"
    
    for card_file in "$CARDS_DB"/*.json; do
        [[ -f "$card_file" ]] || continue
        
        local content_type
        content_type=$(json_get "$card_file" '.content_type')
        
        if [[ -z "$type_filter" || "$content_type" == "$type_filter" ]]; then
            local id
            id=$(json_get "$card_file" '.id')
            local priority
            priority=$(json_get "$card_file" '.priority_score')
            local updated
            updated=$(json_get "$card_file" '.updated_at')
            
            printf "%-36s %-12s %s %s\n" "$id" "$content_type" "$priority" "$updated"
        fi
    done
}

# List cards by priority
card_list_by_priority() {
    local now
    now=$(date +%s)
    
    local cards=()
    for card_file in "$CARDS_DB"/*.json; do
        [[ -f "$card_file" ]] || continue
        
        local id
        id=$(json_get "$card_file" '.id')
        local priority
        priority=$(json_get "$card_file" '.priority_score')
        local decay_rate
        decay_rate=$(json_get "$card_file" '.temporal_decay_rate')
        local updated_at
        updated_at=$(json_get "$card_file" '.updated_at')
        
        local decayed
        decayed=$(decayed_priority "$priority" "$decay_rate" "$updated_at")
        
        cards+=("$decayed|$id")
    done
    
    # Sort by decayed priority (descending)
    printf '%s\n' "${cards[@]}" | sort -t'|' -k1 -rn | while IFS='|' read -r dp id; do
        local card_file="$CARDS_DB/$id.json"
        local content_type
        content_type=$(json_get "$card_file" '.content_type')
        printf "%.4f %-36s %s\n" "$dp" "$id" "$content_type"
    done
}

# Delete a card
card_delete() {
    local id="$1"
    local card_file="$CARDS_DB/$id.json"
    
    if [[ -f "$card_file" ]]; then
        rm "$card_file"
        echo "Deleted card: $id"
        
        # Clean up links
        for link_file in "$LINKS_DB"/*.json; do
            [[ -f "$link_file" ]] || continue
            local source_id
            source_id=$(json_get "$link_file" '.source_id')
            local target_id
            target_id=$(json_get "$link_file" '.target_id')
            
            if [[ "$source_id" == "$id" || "$target_id" == "$id" ]]; then
                rm "$link_file"
            fi
        done
    else
        echo "Card not found: $id" >&2
        return 1
    fi
}

# =============================================================================
# LINK OPERATIONS
# =============================================================================

# Create a link between cards
link_create() {
    local source_id="$1"
    local target_id="$2"
    local link_type="${3:-relates_to}"
    local weight="${4:-1.0}"
    
    # Verify cards exist
    if [[ ! -f "$CARDS_DB/$source_id.json" ]]; then
        echo "Source card not found: $source_id" >&2
        return 1
    fi
    
    if [[ ! -f "$CARDS_DB/$target_id.json" ]]; then
        echo "Target card not found: $target_id" >&2
        return 1
    fi
    
    local id
    id=$(generate_uuid)
    local now
    now=$(timestamp)
    
    local link_file="$LINKS_DB/$id.json"
    
    cat > "$link_file" <<EOF
{
    "id": "$id",
    "source_id": "$source_id",
    "target_id": "$target_id",
    "link_type": "$link_type",
    "weight": $weight,
    "metadata": {},
    "created_at": "$now"
}
EOF
    
    echo "$id"
}

# List links from a card
links_from() {
    local card_id="$1"
    
    for link_file in "$LINKS_DB"/*.json; do
        [[ -f "$link_file" ]] || continue
        
        local source_id
        source_id=$(json_get "$link_file" '.source_id')
        
        if [[ "$source_id" == "$card_id" ]]; then
            local target_id
            target_id=$(json_get "$link_file" '.target_id')
            local link_type
            link_type=$(json_get "$link_file" '.link_type')
            local weight
            weight=$(json_get "$link_file" '.weight')
            
            printf "%s --[%s:%.1f]--> %s\n" "$source_id" "$link_type" "$weight" "$target_id"
        fi
    done
}

# List links to a card
links_to() {
    local card_id="$1"
    
    for link_file in "$LINKS_DB"/*.json; do
        [[ -f "$link_file" ]] || continue
        
        local target_id
        target_id=$(json_get "$link_file" '.target_id')
        
        if [[ "$target_id" == "$card_id" ]]; then
            local source_id
            source_id=$(json_get "$link_file" '.source_id')
            local link_type
            link_type=$(json_get "$link_file" '.link_type')
            local weight
            weight=$(json_get "$link_file" '.weight')
            
            printf "%s --[%s:%.1f]--> %s\n" "$source_id" "$link_type" "$weight" "$target_id"
        fi
    done
}

# =============================================================================
# SPECIALIZED CARD HELPERS
# =============================================================================

# Create an email card
email_create() {
    local subject="$1"
    local body="$2"
    local from_email="$3"
    local to_emails="${4:-[]}"
    
    local content
    content=$(jq -n \
        --arg subject "$subject" \
        --arg body "$body" \
        --arg from_email "$from_email" \
        --argjson to_emails "$to_emails" \
        '{subject: $subject, body: $body, from_email: $from_email, to_emails: $to_emails}')
    
    card_create "email" "$content"
}

# Create a task card
task_create() {
    local title="$1"
    local description="${2:-}"
    local due_date="${3:-null}"
    
    local content
    content=$(jq -n \
        --arg title "$title" \
        --arg description "$description" \
        --arg due_date "$due_date" \
        '{title: $title, description: $description, status: "pending", due_date: $due_date}')
    
    card_create "task" "$content"
}

# Complete a task
task_complete() {
    local id="$1"
    local card_file="$CARDS_DB/$id.json"
    local now
    now=$(timestamp)
    
    jq --arg now "$now" \
       '.content.status = "completed" | .updated_at = $now' "$card_file" > "$card_file.tmp"
    mv "$card_file.tmp" "$card_file"
    
    echo "Completed task: $id"
}

# Create a contact card
contact_create() {
    local name="$1"
    local email="${2:-}"
    local phone="${3:-}"
    local org="${4:-}"
    
    local content
    content=$(jq -n \
        --arg name "$name" \
        --arg email "$email" \
        --arg phone "$phone" \
        --arg org "$org" \
        '{name: $name, email: $email, phone: $phone, organization: $org}')
    
    card_create "contact" "$content"
}

# =============================================================================
# SEARCH OPERATIONS
# =============================================================================

# Search cards by content (grep-based)
card_search() {
    local query="$1"
    
    grep -l "$query" "$CARDS_DB"/*.json 2>/dev/null | while read -r card_file; do
        local id
        id=$(json_get "$card_file" '.id')
        local content_type
        content_type=$(json_get "$card_file" '.content_type')
        local priority
        priority=$(json_get "$card_file" '.priority_score')
        
        printf "%-36s %-12s %s\n" "$id" "$content_type" "$priority"
    done
}

# =============================================================================
# KOI PROTOCOL
# =============================================================================

# Export card to KOI format
card_to_koi() {
    local id="$1"
    local card_file="$CARDS_DB/$id.json"
    
    if [[ ! -f "$card_file" ]]; then
        echo "Card not found: $id" >&2
        return 1
    fi
    
    jq '{
        rid: .rid,
        manifest: {
            content_type: .content_type,
            created_at: .created_at,
            updated_at: .updated_at,
            hash: .hash
        },
        content: .content,
        embedding: .embedding
    }' "$card_file"
}

# Import card from KOI format
card_from_koi() {
    local koi_json="$1"
    
    local rid
    rid=$(echo "$koi_json" | jq -r '.rid')
    local content_type
    content_type=$(echo "$koi_json" | jq -r '.manifest.content_type')
    local content
    content=$(echo "$koi_json" | jq -c '.content')
    local embedding
    embedding=$(echo "$koi_json" | jq -c '.embedding')
    
    local id
    id=$(generate_uuid)
    local now
    now=$(timestamp)
    local hash
    hash=$(compute_hash "$content")
    
    local card_file="$CARDS_DB/$id.json"
    
    jq -n \
        --arg id "$id" \
        --arg rid "$rid" \
        --arg content_type "$content_type" \
        --argjson embedding "$embedding" \
        --argjson content "$content" \
        --arg hash "$hash" \
        --arg now "$now" \
        '{
            id: $id,
            rid: $rid,
            content_type: $content_type,
            embedding: $embedding,
            embedding_history: [],
            content: $content,
            hash: $hash,
            hash_history: [],
            priority_score: 0.5,
            attention_weight: 1.0,
            temporal_decay_rate: 0.01,
            created_at: $now,
            updated_at: $now,
            last_accessed_at: null,
            summary: "",
            source_uri: "",
            created_by: "",
            metadata: {}
        }' > "$card_file"
    
    echo "$id"
}

# =============================================================================
# MAIN CLI
# =============================================================================

show_help() {
    cat <<EOF
Cards System - Morphological Knowledge Infrastructure

Usage: cards.sh <command> [arguments]

Commands:
  Card Operations:
    create <type> [content]       Create a new card
    get <id>                      Get card by ID
    update <id> <content>         Update card content
    priority <id> <score>         Set card priority
    touch <id>                    Update last accessed time
    list [type]                   List all cards (optionally filtered by type)
    list-priority                 List cards by decayed priority
    delete <id>                   Delete a card
    search <query>                Search cards by content

  Specialized Cards:
    email <subject> <body> <from> [to_json]   Create email card
    task <title> [description] [due_date]     Create task card
    task-complete <id>                        Mark task complete
    contact <name> [email] [phone] [org]      Create contact card

  Link Operations:
    link <source> <target> [type] [weight]    Create link between cards
    links-from <id>                           List outgoing links
    links-to <id>                             List incoming links

  KOI Protocol:
    to-koi <id>                   Export card to KOI format
    from-koi <json>               Import card from KOI format

  Utility:
    help                          Show this help

Environment:
    CARDS_DIR                     Cards storage directory (default: ~/.cards)
EOF
}

main() {
    local cmd="${1:-help}"
    shift || true
    
    case "$cmd" in
        create)          card_create "$@" ;;
        get)             card_get "$@" ;;
        update)          card_update "$@" ;;
        priority)        card_set_priority "$@" ;;
        touch)           card_touch "$@" ;;
        list)            card_list "$@" ;;
        list-priority)   card_list_by_priority ;;
        delete)          card_delete "$@" ;;
        search)          card_search "$@" ;;
        
        email)           email_create "$@" ;;
        task)            task_create "$@" ;;
        task-complete)   task_complete "$@" ;;
        contact)         contact_create "$@" ;;
        
        link)            link_create "$@" ;;
        links-from)      links_from "$@" ;;
        links-to)        links_to "$@" ;;
        
        to-koi)          card_to_koi "$@" ;;
        from-koi)        card_from_koi "$@" ;;
        
        help|--help|-h)  show_help ;;
        *)               echo "Unknown command: $cmd" >&2; show_help; exit 1 ;;
    esac
}

# Run if executed directly
if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
    main "$@"
fi
```

---

# Part IV: Operational Patterns

## Chapter 8: The Living System

### 8.1 Circadian Rhythms

The Cards system, like any living organism, operates on cycles:

| Rhythm | Period | Function |
|--------|--------|----------|
| **Heartbeat** | Minutes | Health checks, active card monitoring |
| **Breath** | Hourly | Embedding updates, priority recalculation |
| **Digest** | Daily | Integration of new data, summarization |
| **Sleep** | Nightly | Archival, cleanup, optimization |
| **Season** | Weekly | Trend analysis, pattern detection |

### 8.2 Self-Awareness

The system maintains awareness of its own state:

- **Card census**: How many Cards of each type exist?
- **Link topology**: What is the shape of the knowledge graph?
- **Priority distribution**: Are priorities healthy or skewed?
- **Temporal patterns**: When are Cards created? Accessed?
- **Agent activity**: What are agents doing?

### 8.3 Growth and Evolution

The system evolves through:

1. **Card multiplication**: New Cards born from existing Cards
2. **Link formation**: Relationships discovered and created
3. **Priority rebalancing**: Attention shifts based on usage
4. **Type specialization**: New Card types emerge as needed
5. **Agent adaptation**: Agents learn from interactions

---

## Chapter 9: Integration Pathways

### 9.1 Data Sources

| Source | Card Type | Ingestion Pattern |
|--------|-----------|-------------------|
| Gmail | EmailCard | Sensor → Processor → Store |
| Calendar | EventCard | Polling → Transform → Store |
| Telegram | MessageCard | Webhook → Transform → Store |
| Financial | TransactionCard | Import → Categorize → Store |
| Notes | DocumentCard | Watch → Parse → Store |
| Code | FileCard | Git hook → Index → Store |

### 9.2 Agent Interfaces

Agents interact with Cards through defined protocols:

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Human     │────▶│   Digital   │────▶│   Card      │
│   (You)     │     │   Twin      │     │   Store     │
└─────────────┘     └──────┬──────┘     └──────┬──────┘
                          │                    │
                          ▼                    ▼
              ┌─────────────────────────────────────┐
              │        Agent Ecosystem              │
              │                                     │
              │  ┌─────┐ ┌─────┐ ┌─────┐ ┌───────┐ │
              │  │ CFO │ │ PM  │ │Arch │ │Circuit│ │
              │  └─────┘ └─────┘ └─────┘ │Breaker│ │
              │                          └───────┘ │
              └─────────────────────────────────────┘
```

---

# Epilogue: The Path Forward

The Cards system is not software to be installed and forgotten. It is an organism to be cultivated. Like any living thing, it requires:

**Nourishment**: Feed it data. Every email, every note, every thought.

**Exercise**: Use it. Query it. Let agents traverse its graph.

**Rest**: Allow periodic consolidation. Let priorities decay naturally.

**Attention**: Notice what emerges. The system will reveal patterns you didn't know existed.

**Patience**: Growth is gradual. Trust the morphological process.

The ultimate vision: a digital twin so complete, so aware, so integrated with your life that the boundary between you and your extended mind becomes permeable. Not to replace you, but to amplify you. Not to think for you, but to think with you.

Every Card is a cell. Every link is a synapse. Every agent is an organ. You are the consciousness that animates the whole.

Begin. Create a Card. Link it to another. Watch the organism breathe.

---

# Appendix: Quick Reference Tables

## A. Card Field Reference

| Field | Type | Required | Default | Purpose |
|-------|------|----------|---------|---------|
| `id` | UUID | Yes | auto | Primary key |
| `rid` | UUID | Yes | auto | KOI reference |
| `content_type` | string | Yes | "card" | Type discriminator |
| `embedding` | float[] | No | [] | Semantic vector |
| `content` | JSON | No | {} | Structured data |
| `hash` | string | Yes | computed | Content fingerprint |
| `priority_score` | float | No | 0.5 | Importance [0,1] |
| `attention_weight` | float | No | 1.0 | Search boost |
| `temporal_decay_rate` | float | No | 0.01 | Daily decay |
| `created_at` | datetime | Yes | now | Birth time |
| `updated_at` | datetime | Yes | now | Last change |
| `summary` | string | No | "" | LLM summary |

## B. Link Types

| Type | Semantics | Example |
|------|-----------|---------|
| `supports` | Evidence for | Research → Thesis |
| `contradicts` | Conflicts with | Study A → Study B |
| `derived_from` | Created from | Task → Email |
| `parent_of` | Contains | Project → Task |
| `cites` | References | Paper → Source |
| `blocks` | Must precede | Task A → Task B |
| `relates_to` | General relation | Any → Any |

## C. Card Types

| Type | Purpose | Key Fields |
|------|---------|------------|
| `email` | Message | subject, body, from, to |
| `task` | Todo | title, status, due_date |
| `contact` | Person | name, email, phone |
| `project` | Initiative | name, objectives, status |
| `event` | Calendar | title, start, end, location |
| `document` | File | path, content, format |
| `insight` | Learning | title, body, confidence |
| `principle` | Belief | statement, domain |
| `objective` | Goal | description, metrics |

## D. Priority Decay Formula

```
P(t) = P₀ × e^(-λt)

Where:
  P(t)  = Priority at time t
  P₀    = Base priority score
  λ     = Temporal decay rate
  t     = Days since last update
```

---

*End of Documentation*
