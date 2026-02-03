# KOI-Net - Knowledge Organization Infrastructure Protocol

KOI-Net is a protocol specification and Python reference implementation for building heterogeneous networks of autonomous knowledge processing nodes. It enables distributed knowledge coordination through RID-based identification and event-driven communication patterns.

## What is KOI-Net?

KOI-Net defines standard communication patterns and coordination norms for Knowledge Organization Infrastructure (KOI) networks. These networks are composed of autonomous nodes that can input, process, and output knowledge independently while maintaining interoperability through a simple protocol.

### Core Concepts

- **RID Protocol Foundation**: Uses the [RID (Resource Identifier) protocol](https://github.com/BlockScience/rid-lib) for content-addressable identification
- **Event-Driven Communication**: FUN model (Forget, Update, New) for state change signaling
- **State Transfer**: Request/response pattern for fetching RIDs, manifests, and bundles
- **Network Topology**: Full nodes (web servers) and Partial nodes (clients) with flexible composition
- **Fractal Architecture**: Networks of nodes can act as single nodes from an outside perspective

### Key Features

- 5 RESTful API endpoints for event and state communication
- Support for both webhook (push) and polling (pull) patterns
- Extensible knowledge processing pipeline with handler chains
- Built-in edge negotiation and network graph management
- Thread-safe asynchronous knowledge processing
- Pydantic models and OpenAPI specification
- Default handlers for common patterns

## Protocol Overview

### Communication Methods

KOI-Net defines two classes of communication:

**Event Communication (One-Way)**
- Node sends an event to another node
- Three event types: `NEW`, `UPDATE`, `FORGET`
- Push via broadcast or pull via polling

**State Communication (Request/Response)**
- Node requests RIDs, manifests, or bundles from another node
- Synchronous response with requested resources
- Only available from full nodes

### Node Types

**Full Nodes**
- Web servers implementing all KOI-Net API endpoints
- Can receive events via webhooks (push)
- Can serve state queries from other nodes
- Can broadcast events and retrieve state from other full nodes

**Partial Nodes**
- Web clients without API endpoints
- Can only receive events via polling (pull)
- Can broadcast events to full nodes
- Cannot serve state queries

### API Endpoints

```
POST /events/broadcast    - Broadcast events to a full node
POST /events/poll         - Poll events from a full node (for partial nodes)
POST /rids/fetch          - Fetch list of RIDs by type
POST /manifests/fetch     - Fetch manifests by RID or type
POST /bundles/fetch       - Fetch complete bundles by RID
```

All endpoints accept and return JSON payloads defined in the OpenAPI specification.

### Knowledge Types

KOI-Net works with four fundamental knowledge types from the RID ecosystem:

**RID (Resource Identifier)**
- Content-addressable identifier for knowledge objects
- Format: `<type>:<hash>`
- Immutable reference to content

**Manifest**
- Portable descriptor of a knowledge object
- Contains RID, timestamp, and SHA256 hash
- Enables version tracking and integrity verification

**Bundle**
- Complete knowledge package: manifest + contents
- Written to and read from cache
- Transferred between nodes

**Event**
- Signaling construct for state changes
- Composed of RID, event type, optional manifest and contents
- Event types: `NEW`, `UPDATE`, `FORGET`

### Event Model

Events signal internal state changes, not operations:

```json
{
    "rid": "koi-net-node:abc123...",
    "event_type": "NEW",
    "manifest": {
        "rid": "koi-net-node:abc123...",
        "timestamp": "2025-12-11T19:00:00Z",
        "sha256_hash": "def456..."
    },
    "contents": {}
}
```

**Event Types (FUN Model)**
- `NEW` - Previously unknown RID was cached
- `UPDATE` - Previously known RID was updated in cache
- `FORGET` - Previously known RID was deleted from cache

Each node decides autonomously how to react to received events. A `NEW` event might be ignored if the node isn't interested, or might trigger fetching the full bundle.

## Installation

### Prerequisites
- Python 3.8+

### Install from PyPI
```bash
pip install koi-net
```

### Install with Examples
```bash
# Clone repository
git clone https://github.com/BlockScience/koi-net
cd koi-net

# Install with example dependencies
pip install .[examples]
```

## Quick Start

### Creating a Partial Node

Partial nodes poll other nodes for events and can broadcast their own events.

```python
from koi_net.config.partial_node import PartialNodeConfig, KoiNetConfig, NodeProfile
from koi_net.core import PartialNode

class MyPartialNodeConfig(PartialNodeConfig):
    koi_net: KoiNetConfig = KoiNetConfig(
        node_name="my_partial_node",
        node_profile=NodeProfile(),
        first_contact="http://coordinator.example.com:8080/koi-net"
    )

class MyPartialNode(PartialNode):
    config_schema = MyPartialNodeConfig

if __name__ == "__main__":
    MyPartialNode().run()
```

The partial node will automatically:
- Poll the first contact node for events
- Process received events through the knowledge pipeline
- Handle edge negotiation with other nodes

### Creating a Full Node

Full nodes implement the API and can serve both events and state to other nodes.

```python
from rid_lib.types import KoiNetNode, KoiNetEdge
from koi_net.config.full_node import (
    FullNodeConfig,
    ServerConfig,
    KoiNetConfig,
    NodeProfile,
    NodeProvides
)
from koi_net.core import FullNode

class CoordinatorConfig(FullNodeConfig):
    server: ServerConfig = ServerConfig(port=8080)
    koi_net: KoiNetConfig = KoiNetConfig(
        node_name="coordinator",
        node_profile=NodeProfile(
            provides=NodeProvides(
                event=[KoiNetNode, KoiNetEdge],
                state=[KoiNetNode, KoiNetEdge]
            )
        ),
        rid_types_of_interest=[KoiNetNode, KoiNetEdge]
    )

class CoordinatorNode(FullNode):
    config_schema = CoordinatorConfig

if __name__ == "__main__":
    CoordinatorNode().run()
```

The full node will automatically:
- Start a FastAPI web server with KOI-Net endpoints
- Process knowledge objects asynchronously on a worker thread
- Maintain a network graph of connected nodes
- Handle edge negotiation and state queries

## Knowledge Processing Pipeline

The knowledge processing pipeline is the core of node behavior. Knowledge objects flow through five handler phases:

### Pipeline Flow

```
RID Handler
    ↓
[Fetch manifest if needed]
    ↓
Manifest Handler
    ↓
[Fetch bundle if needed]
    ↓
Bundle Handler
    ↓
[Cache Action: write/delete]
    ↓
Network Handler
    ↓
[Broadcast Event]
    ↓
Final Handler
```

### Knowledge Object

The internal representation used in the pipeline:

```python
class KnowledgeObject(BaseModel):
    rid: RID                              # Required
    manifest: Manifest | None = None      # Added after RID phase
    contents: dict | None = None          # Added after Manifest phase
    event_type: EventType | None = None   # External event type
    normalized_event_type: EventType | None = None  # Internal perspective
    source: KoiNetNode | None = None      # Originating node
    network_targets: set[KoiNetNode] = set()  # Broadcast targets
```

### Handler Types

**1. RID Handler**
- Input: RID, event_type, source
- Purpose: Filter unwanted knowledge
- Can set `normalized_event_type` for `FORGET` events
- Can return `STOP_CHAIN` to abort processing

**2. Manifest Handler**
- Input: RID, manifest, source
- Purpose: Validate manifest before fetching bundle
- Can return `STOP_CHAIN` to abort processing
- Default handler checks timestamp and hash

**3. Bundle Handler**
- Input: RID, manifest, contents (bundle), source
- Purpose: Decide cache action by setting `normalized_event_type`
- Set to `NEW` or `UPDATE` to write to cache
- Set to `FORGET` to delete from cache
- Leave as `None` to skip cache action

**4. Network Handler**
- Input: RID, manifest, contents, normalized_event_type, source
- Purpose: Decide broadcast targets
- Append node RIDs to `network_targets` field
- Can return `STOP_CHAIN` to skip broadcast

**5. Final Handler**
- Input: Complete knowledge object after broadcast
- Purpose: Custom actions after processing complete
- No subsequent pipeline actions

### Handler Return Values

Each handler can return:
- `None` - Pass unmodified knowledge object to next handler
- `KnowledgeObject` - Pass modified knowledge object to next handler
- `STOP_CHAIN` - Immediately end processing

## Writing Custom Handlers

### Basic Handler Pattern

```python
from koi_net.processor.handler import KnowledgeHandler, HandlerType, STOP_CHAIN
from koi_net.processor.context import HandlerContext
from koi_net.processor.knowledge_object import KnowledgeObject
from koi_net.protocol.event import EventType

@KnowledgeHandler.create(HandlerType.RID)
def my_rid_handler(ctx: HandlerContext, kobj: KnowledgeObject):
    """Filter unwanted RIDs."""
    if not is_interested_in(kobj.rid):
        return STOP_CHAIN

    # Continue processing
    return None
```

### Filtered Handler

Handlers can be restricted to specific RID types and event types:

```python
from rid_lib.types import KoiNetNode, KoiNetEdge

@KnowledgeHandler.create(
    handler_type=HandlerType.Bundle,
    rid_types=(KoiNetNode, KoiNetEdge),
    event_types=(EventType.NEW, EventType.UPDATE)
)
def network_bundle_handler(ctx: HandlerContext, kobj: KnowledgeObject):
    """Only handles NEW and UPDATE events for nodes and edges."""

    # Validate bundle contents
    if not validate_bundle(kobj.bundle):
        return STOP_CHAIN

    # Set normalized event type to write to cache
    kobj.normalized_event_type = kobj.event_type
    return kobj
```

### Handler Context

The `HandlerContext` provides access to node components:

```python
@KnowledgeHandler.create(HandlerType.Network)
def broadcast_handler(ctx: HandlerContext, kobj: KnowledgeObject):
    """Broadcast to all neighbors."""

    # Access cache
    cached_data = ctx.cache.read(kobj.rid)

    # Access network graph
    neighbors = ctx.graph.get_neighbors(direction="out")

    # Queue additional knowledge objects
    ctx.kobj_queue.push(rid=related_rid)

    # Queue events for broadcast
    from koi_net.protocol.event import Event
    ctx.event_queue.push(
        event=Event.from_rid(EventType.UPDATE, kobj.rid),
        target=neighbor_node
    )

    # Set broadcast targets
    kobj.network_targets = set(neighbors)
    return kobj
```

## Edge Negotiation

KOI-Net includes automatic edge negotiation between nodes. Edges represent connections in the network graph and control event routing.

### Edge Types

```python
class EdgeType(StrEnum):
    WEBHOOK = "WEBHOOK"  # Full node can receive push events
    POLL = "POLL"        # Partial node polls for events
```

### Edge Status

```python
class EdgeStatus(StrEnum):
    PROPOSED = "PROPOSED"  # Edge awaiting approval
    APPROVED = "APPROVED"  # Edge active and operational
```

### Edge Profile

```python
class EdgeProfile(BaseModel):
    source: KoiNetNode      # Node initiating connection
    target: KoiNetNode      # Node receiving connection
    edge_type: EdgeType     # WEBHOOK or POLL
    status: EdgeStatus      # PROPOSED or APPROVED
    rid_types: list[RIDType]  # RID types this edge will carry
```

### Creating an Edge

```python
from koi_net.protocol.edge import generate_edge_bundle, EdgeType
from koi_net.protocol.event import EventType
from rid_lib.types import KoiNetNode, KoiNetEdge

# Generate edge bundle
edge_bundle = generate_edge_bundle(
    source=source_node_rid,
    target=target_node_rid,
    edge_type=EdgeType.WEBHOOK,
    rid_types=[KoiNetNode, KoiNetEdge]
)

# Propose edge by processing as NEW event
ctx.kobj_queue.push(bundle=edge_bundle)
```

The default `edge_negotiation_handler` automatically:
- Validates edge type matches node capabilities
- Approves edges requesting RID types the node provides
- Sends approval event back to source node
- Updates edge status from PROPOSED to APPROVED

## Network Graph

The network graph provides a view of the node's connections using NetworkX.

### Querying the Graph

```python
# Get all edges this node participates in
all_edges = ctx.graph.get_edges()

# Get only outgoing edges
outgoing_edges = ctx.graph.get_edges(direction="out")

# Get neighbors
all_neighbors = ctx.graph.get_neighbors()

# Get neighbors via outgoing approved edges
active_neighbors = ctx.graph.get_neighbors(
    direction="out",
    status=EdgeStatus.APPROVED
)

# Get neighbors that support specific RID types
neighbors_with_support = ctx.graph.get_neighbors(
    allowed_type=MyCustomRIDType
)

# Get specific edge between nodes
edge_rid = ctx.graph.get_edge(source_node, target_node)
```

## Advanced Examples

### Example 1: Custom Handshake Handler

Respond to new nodes joining the network:

```python
from koi_net.processor.handler import KnowledgeHandler, HandlerType
from koi_net.processor.context import HandlerContext
from koi_net.processor.knowledge_object import KnowledgeObject
from koi_net.protocol.event import Event, EventType
from koi_net.protocol.edge import generate_edge_bundle, EdgeType
from rid_lib.types import KoiNetNode, KoiNetEdge

@KnowledgeHandler.create(
    HandlerType.Network,
    rid_types=(KoiNetNode,),
    event_types=(EventType.NEW,)
)
def handshake_handler(ctx: HandlerContext, kobj: KnowledgeObject):
    """Respond to new nodes with identity and edge proposal."""

    # Share this node's bundle
    identity_bundle = ctx.cache.read(ctx.identity.rid)
    ctx.event_queue.push(
        event=Event.from_bundle(EventType.NEW, identity_bundle),
        target=kobj.rid
    )

    # Propose edge connection
    edge_bundle = generate_edge_bundle(
        source=kobj.rid,
        target=ctx.identity.rid,
        edge_type=EdgeType.WEBHOOK,
        rid_types=[KoiNetNode, KoiNetEdge]
    )

    # First forget any existing edge, then propose new one
    ctx.kobj_queue.push(rid=edge_bundle.rid, event_type=EventType.FORGET)
    ctx.kobj_queue.push(bundle=edge_bundle)
```

### Example 2: Content Filter

Filter knowledge by content before caching:

```python
@KnowledgeHandler.create(
    HandlerType.Bundle,
    rid_types=(MyContentType,)
)
def content_filter_handler(ctx: HandlerContext, kobj: KnowledgeObject):
    """Only cache content meeting quality criteria."""

    # Validate content structure
    try:
        content = MyContentModel.parse_obj(kobj.contents)
    except ValidationError:
        return STOP_CHAIN

    # Apply business rules
    if content.quality_score < 0.7:
        return STOP_CHAIN

    # Accept for caching
    kobj.normalized_event_type = kobj.event_type or EventType.NEW
    return kobj
```

### Example 3: Selective Broadcasting

Broadcast different events to different neighbors:

```python
@KnowledgeHandler.create(HandlerType.Network)
def selective_broadcast_handler(ctx: HandlerContext, kobj: KnowledgeObject):
    """Broadcast based on neighbor capabilities."""

    # Get neighbors that support this RID type
    interested_neighbors = ctx.graph.get_neighbors(
        direction="out",
        status=EdgeStatus.APPROVED,
        allowed_type=type(kobj.rid)
    )

    # Only broadcast updates, not new content
    if kobj.normalized_event_type == EventType.UPDATE:
        kobj.network_targets = set(interested_neighbors)

    return kobj
```

### Example 4: Processing with Side Effects

Trigger external actions in final handler:

```python
@KnowledgeHandler.create(
    HandlerType.Final,
    rid_types=(DatasetRID,),
    event_types=(EventType.NEW,)
)
def dataset_processor(ctx: HandlerContext, kobj: KnowledgeObject):
    """Process new datasets with external ML pipeline."""

    import asyncio

    async def process_async():
        # Extract dataset
        dataset = kobj.bundle.validate_contents(DatasetModel)

        # Run ML pipeline
        results = await ml_pipeline.process(dataset)

        # Store results as new knowledge
        results_bundle = Bundle.generate(
            ResultsRID(hash_of(results)),
            results.dict()
        )

        # Queue results for processing
        ctx.kobj_queue.push(bundle=results_bundle)

    # Run async processing
    asyncio.create_task(process_async())
```

## Configuration

### Node Configuration

KOI-Net uses Pydantic-based configuration that can load from YAML files:

```yaml
# config.yaml
server:
  host: "0.0.0.0"
  port: 8080
  root_path: "/koi-net"

koi_net:
  node_name: "my_coordinator"
  cache_directory_path: ".rid_cache"
  event_queues_path: "event_queues.json"

  node_profile:
    provides:
      event:
        - "koi-net-node"
        - "koi-net-edge"
      state:
        - "koi-net-node"
        - "koi-net-edge"

  rid_types_of_interest:
    - "koi-net-node"
    - "koi-net-edge"

  first_contact: "http://bootstrap.example.com:8080/koi-net"
```

Load configuration:

```python
from koi_net.config.full_node import FullNodeConfig

config = FullNodeConfig.load_from_yaml("config.yaml")
```

### Logging Configuration

KOI-Net uses structlog for structured logging. Configure via environment:

```python
import structlog
import logging

# Configure logging level
logging.basicConfig(level=logging.INFO)

# Configure structlog
structlog.configure(
    processors=[
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.JSONRenderer()
    ]
)
```

## Default Handlers

KOI-Net provides default handlers for common patterns:

### basic_rid_handler
- Blocks external events about this node
- Sets normalized event type for `FORGET` events

### basic_manifest_handler
- Compares manifest hash and timestamp with cached version
- Sets normalized event type to `NEW` or `UPDATE`
- Stops processing for unchanged or outdated manifests

### secure_profile_handler
- Validates node profile public key matches RID hash
- Prevents malicious nodes from impersonating others

### edge_negotiation_handler
- Validates edge type matches node capabilities
- Auto-approves edges for supported RID types
- Sends rejection for incompatible edges

### node_contact_handler
- Broadcasts node identity to new neighbors

### basic_network_output_filter
- Implements default broadcast rules
- Broadcasts to neighbors based on edge configuration

### forget_edge_on_node_deletion
- Cleans up edges when nodes are deleted

### Overriding Defaults

```python
from koi_net.core import FullNode
from koi_net.processor.knowledge_handlers import (
    basic_rid_handler,
    basic_manifest_handler,
    edge_negotiation_handler
)

class MyNode(FullNode):
    # Include only desired defaults plus custom handlers
    knowledge_handlers = [
        basic_rid_handler,
        basic_manifest_handler,
        my_custom_handler,
        edge_negotiation_handler
    ]
```

## Testing Locally

### Run Example Nodes

Start coordinator (full node):
```bash
python -m examples.coordinator
```

Start partial node (in separate terminal):
```bash
python -m examples.partial
```

The partial node will:
1. Announce itself to coordinator
2. Establish edge connection
3. Poll for events every 5 seconds
4. Process any received events

### Interactive Testing

```python
import asyncio
from koi_net.core import FullNode
from rid_lib import RID
from rid_lib.ext import Bundle

async def test_node():
    node = FullNode()
    node.start()

    # Add knowledge
    my_rid = RID("my-type", "abc123")
    bundle = Bundle.generate(my_rid, {"data": "test"})

    node.processor.handle(bundle=bundle)

    # Wait for processing
    await asyncio.sleep(1)

    # Check cache
    cached = node.cache.read(my_rid)
    print(f"Cached: {cached}")

    node.stop()

asyncio.run(test_node())
```

## Protocol Reference

### Event Types

```python
class EventType(StrEnum):
    NEW = "NEW"         # Previously unknown RID cached
    UPDATE = "UPDATE"   # Previously known RID updated
    FORGET = "FORGET"   # Previously known RID deleted
```

### Request Models

**PollEvents**
```python
{
    "rid": "koi-net-node:abc123",  # Node RID requesting events
    "limit": 10                     # Max events to return (0 = all)
}
```

**FetchRids**
```python
{
    "rid_types": ["my-type"]  # RID types to fetch (empty = all)
}
```

**FetchManifests**
```python
{
    "rid_types": ["my-type"],        # RID types (empty = all)
    "rids": ["my-type:abc123"]       # Specific RIDs (empty = all)
}
```

**FetchBundles**
```python
{
    "rids": ["my-type:abc123"]  # Specific RIDs to fetch
}
```

### Response Models

**EventsPayload**
```python
{
    "events": [
        {
            "rid": "my-type:abc123",
            "event_type": "NEW",
            "manifest": {...},
            "contents": {...}
        }
    ]
}
```

**RidsPayload**
```python
{
    "rids": ["my-type:abc123", "my-type:def456"]
}
```

**ManifestsPayload**
```python
{
    "manifests": [{...}],
    "not_found": ["my-type:xyz789"]
}
```

**BundlesPayload**
```python
{
    "bundles": [{...}],
    "not_found": ["my-type:xyz789"],
    "deferred": ["my-type:deferred123"]
}
```

## Architecture Patterns

### Coordinator Pattern

Single coordinator full node manages network:
- New nodes connect to coordinator
- Coordinator maintains network graph
- Coordinator routes events between nodes

### Mesh Pattern

Multiple full nodes interconnected:
- No central coordinator
- Nodes discover each other through edges
- Resilient to individual node failures

### Hub-and-Spoke Pattern

Central hub with peripheral partial nodes:
- Hub is full node serving state
- Spokes are partial nodes polling hub
- Simple topology for read-heavy workloads

### Hierarchical Pattern

Multi-layer network:
- Top-level coordinators
- Mid-level aggregators
- Leaf-level processors
- Enables scaling and specialization

## Performance Considerations

### Threading

Full nodes use worker threads for async processing:
- `kobj_worker` processes knowledge queue
- `event_worker` processes event queue
- Prevents race conditions in web handlers

### Caching

RID cache uses file system:
- One file per bundle
- SHA256 hash verification
- Timestamp-based eviction possible

### Event Queues

In-memory queues per neighbor:
- JSON persistence across restarts
- FIFO ordering guarantees
- Configurable limits

### Network Graph

NetworkX directed graph:
- Regenerated after node/edge changes
- Cached between changes
- O(1) neighbor lookups

## Security Considerations

### Node Identity

Nodes identified by hash of public key:
- Cryptographic verification
- Prevents impersonation
- Secure profile handler validates

### Edge Approval

Manual or automatic edge approval:
- Validates edge type compatibility
- Checks RID type support
- Prevents unauthorized connections

### Content Validation

Bundle integrity verification:
- SHA256 hash matching
- Timestamp validation
- Custom content validation in handlers

## Troubleshooting

### Node Can't Connect

Check first contact configuration:
```python
koi_net:
  first_contact: "http://coordinator:8080/koi-net"
```

Verify coordinator is running and accessible.

### Events Not Processing

Enable debug logging:
```python
import logging
logging.basicConfig(level=logging.DEBUG)
```

Check worker threads started:
```python
node = FullNode()
node.start()  # Must call before processing
```

### Cache Not Persisting

Verify cache directory writable:
```python
koi_net:
  cache_directory_path: ".rid_cache"
```

Check disk space and permissions.

### Network Graph Not Updating

Ensure node/edge RIDs in pipeline:
```python
rid_types_of_interest:
  - "koi-net-node"
  - "koi-net-edge"
```

Graph regenerates automatically on changes.

## Resources

- **Repository**: https://github.com/BlockScience/koi-net
- **OpenAPI Spec**: [Interactive Swagger Docs](https://generator.swagger.io/?url=https://raw.githubusercontent.com/BlockScience/koi-net/refs/heads/main/koi-net-protocol-openapi.json)
- **RID Protocol**: https://github.com/BlockScience/rid-lib
- **KOI Research**: https://github.com/BlockScience/koi
- **Python Package**: https://pypi.org/project/koi-net/

## License

MIT License - See repository for details.
