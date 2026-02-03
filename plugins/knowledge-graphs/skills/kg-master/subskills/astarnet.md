---
name: astarnet
description: Master A*Net for scalable path-based reasoning on knowledge graphs. Use when performing multi-hop reasoning, link prediction, inductive KG inference, or visualizing reasoning paths. Scales to 2.5M entities with interpretable A* algorithm-based search. Supports transductive/inductive settings and ChatGPT integration.
allowed-tools: Read, Glob, Grep, Bash
---

# A*Net Mastery

Scalable path-based reasoning for knowledge graphs using neural A* search.

## Territory Map

```
resources/knowledge_graphs/AStarNet/
├── reasoning/                # Core library
│   ├── model.py             # NBFNet & AStarNet models
│   ├── layer.py             # GNN layers (NBFNetConv, CompGCNConv)
│   ├── dataset.py           # FB15k237, WN18RR, ogbl-wikikg2 loaders
│   ├── task.py              # KnowledgeGraphCompletion task
│   ├── data.py              # VirtualTensor, RepeatGraph utilities
│   └── functional.py        # Custom operations (bincount, variadic_topks)
├── script/
│   ├── run.py               # Training & evaluation pipeline
│   ├── chat.py              # ChatGPT interface with OpenAI API
│   └── visualize.py         # Path visualization tool
├── config/
│   ├── transductive/        # FB15k237, WN18RR, WikiKG2 configs
│   └── inductive/           # Inductive split configs (v1-v4)
├── data/                    # Entity & relation vocabularies
│   ├── fb15k237/
│   └── ogblwikikg2/
└── prompt/                  # ChatGPT prompts (NER, RE, direction)
```

## Core Capabilities

- **A* Algorithm-Based Search**: Neural priority function selects important nodes/edges iteratively
- **Scalability**: First path-based method to scale to 2.5M entities, 16M triplets (ogbl-wikikg2)
- **Inductive Reasoning**: Generalizes to unseen entities (4 inductive splits per dataset)
- **Interpretable Paths**: Beam search extracts top-k reasoning paths with weights
- **Multi-hop Reasoning**: 6-layer graph traversal for complex queries
- **ChatGPT Integration**: Natural language interface over Wikidata knowledge graph

## Beginner Techniques

### Basic Setup

```bash
# Install dependencies
pip install torch torchdrug torch-sparse ogb easydict pyyaml openai

# Verify installation
python -c "import torchdrug; print(torchdrug.__version__)"
```

### Training on FB15k237 (Transductive)

```bash
python script/run.py \
  -c config/transductive/fb15k237_astarnet.yaml \
  --gpus [0]
```

**Config Breakdown** (`fb15k237_astarnet.yaml`):
```yaml
dataset:
  class: FB15k237
  path: ~/datasets/knowledge_graphs/

task:
  class: KnowledgeGraphCompletion
  model:
    class: AStarNet
    base_layer:
      class: NBFNetConv
      input_dim: 32
      output_dim: 32
      message_func: distmult  # or transe, rotate
      aggregate_func: pna     # or sum, mean, max
    num_layer: 6
    node_ratio: 0.1           # Select top 10% nodes per layer
  criterion: bce
  num_negative: 32

train:
  num_epoch: 20
```

### Understanding the Models

**NBFNet** (Neural Bellman-Ford Network):
- Predecessor to A*Net
- Explores full graph at each layer
- Useful for smaller graphs (<100k entities)

**AStarNet** (A* Network):
- Learns neural priority function for node/edge selection
- `node_ratio`: Fraction of nodes to explore (0.1 = 10%)
- `degree_ratio`: Fraction of edges per selected node (default 1.0)

## Intermediate Techniques

### Inductive Reasoning (Unseen Entities)

```bash
python script/run.py \
  -c config/inductive/fb15k237_astarnet.yaml \
  --gpus [0] \
  --version v1  # v1, v2, v3, v4 splits available
```

**Use Case**: Train on entity set A, test on entity set B (zero-shot entity generalization)

### Custom Message Functions

Edit `reasoning/layer.py` to implement custom GNN layers:

```python
from torchdrug.core import Registry as R

@R.register("layer.CustomConv")
class CustomRelationalConv(layers.MessagePassingBase):
    def message(self, graph, input):
        # Compute messages from neighbors
        node_in = graph.edge_list[:, 0]
        node_input = input[node_in]
        edge_input = self.relation.weight[graph.edge_list[:, 2]]
        return self.compute_message(node_input, edge_input)

    def aggregate(self, graph, message):
        # Aggregate messages to nodes
        node_out = graph.edge_list[:, 1]
        return scatter_add(message, node_out, dim=0, dim_size=graph.num_node)

    def combine(self, input, update):
        # Combine input & aggregated messages
        return self.linear(torch.cat([input, update], dim=-1))

    def compute_message(self, node_input, edge_input):
        # Custom message computation (e.g., DistMult, TransE, RotatE)
        return node_input * edge_input  # DistMult
```

**Then register in config**:
```yaml
task:
  model:
    base_layer:
      class: CustomConv
      input_dim: 32
      output_dim: 32
```

### Multi-GPU Training

```bash
torchrun --nproc_per_node=4 script/run.py \
  -c config/transductive/wikikg2_astarnet.yaml \
  --gpus [0,1,2,3]
```

**Note**: Batch size is divided across GPUs

## Advanced Techniques

### Path Visualization

Extract and interpret reasoning paths:

```bash
python script/visualize.py \
  -c config/transductive/fb15k237_astarnet_visualize.yaml \
  --checkpoint /path/to/model_epoch_20.pth \
  --gpus [0]
```

**Output Format**:
```
rank(Barack Obama | Joe Biden, successor) = 12
weight: 0.85
  <Joe Biden, occupation, President> ->
  <President, country, United States> ->
  <United States, head_of_state, Barack Obama>
weight: 0.72
  <Joe Biden, position_held, Vice President> ->
  <Vice President, under, Barack Obama>
```

**Use Cases**:
- Debugging model predictions
- Explainability for end users
- Identifying missing knowledge graph edges

### ChatGPT Integration

Natural language interface over Wikidata (2.5M entities):

```bash
export OPENAI_API_KEY=your-openai-api-key

python script/chat.py \
  -c config/transductive/wikikg2_astarnet_visualize.yaml \
  --checkpoint wikikg2_astarnet.pth \
  --gpus [0]
```

**Example Conversation**:
```
User: What is the job of Joe Biden?
Bot: [Uses named entity recognition + relation extraction]
     Top answers:
     1. President of the United States (score: 0.92)
     2. Senator (score: 0.76)
     3. Vice President (score: 0.68)

User: Explain the answer "President of the United States"
Bot: Reasoning paths:
     1. Joe Biden -> position_held -> President (weight: 0.89)
     2. Joe Biden -> successor -> Barack Obama -> occupation -> President (weight: 0.71)
     Reference: https://www.wikidata.org/wiki/Q6279#P39
```

**Architecture**:
1. **Named Entity Recognition** (`prompt/ner.txt`): Extract entity from query
2. **Relation Extraction** (`prompt/re.txt`): Extract relation from query
3. **Wikidata Lookup**: Map entity/relation to IDs (Q6279, P39)
4. **A*Net Inference**: Predict answers with scores
5. **Path Extraction**: Beam search for interpretable reasoning

### Custom Indicator Functions

A*Net supports two initialization strategies:

**One-hot** (default):
```python
# config
task:
  model:
    indicator_func: onehot  # Inject query only at source node
```

**Personalized PageRank**:
```python
# config
task:
  model:
    indicator_func: ppr
    num_indicator_bin: 10  # Discretize PPR scores into 10 bins
```

**Effect**: PPR spreads signal globally, improving long-range reasoning but increasing memory usage.

### Scaling to Massive Graphs (WikiKG2: 2.5M entities)

```yaml
task:
  model:
    node_ratio: 0.1          # Explore 10% of nodes per layer
    degree_ratio: 1.0        # Use 100% of edges for selected nodes
    test_node_ratio: 0.5     # Increase exploration at test time
    test_degree_ratio: 2.0   # Use more edges at test time
    break_tie: false         # Deterministic tie-breaking (slower)
```

**Memory Optimization**:
- A*Net uses `VirtualTensor` to avoid materializing full node embeddings
- `RepeatGraph` replicates graph structure without copying node features
- Chunked edge selection to limit peak memory

### CompGCN Integration

Compositional graph convolution for relation-aware message passing:

```yaml
task:
  model:
    class: NBFNet  # CompGCN only works with NBFNet
    base_layer:
      class: CompGCNConv
      message_func: mult  # or sub, corr (circular correlation)
      input_dim: 32
      output_dim: 32
```

**Difference from NBFNetConv**:
- Learns relation embeddings jointly with node embeddings
- Applies relation transformation before message passing
- Separates forward/backward/loop messages

## Key Patterns

| Pattern | Use Case |
|---------|----------|
| Transductive reasoning | Seen entities, link prediction |
| Inductive reasoning | Unseen entities, generalization |
| Path visualization | Interpretability, debugging |
| ChatGPT interface | Natural language Q&A over KG |
| Multi-GPU training | Large graphs (WikiKG2) |
| Custom GNN layers | Domain-specific message passing |

## When to Use A*Net

- **Link Prediction**: Predict missing edges in knowledge graphs
- **Multi-hop Reasoning**: Answer complex queries requiring 2+ hops
- **Inductive KG Completion**: Generalize to new entities not seen during training
- **Explainable AI**: Need interpretable reasoning paths (vs black-box embeddings)
- **Large-Scale KGs**: 100k+ entities where full graph traversal is infeasible
- **ChatGPT Integration**: Natural language interface over structured knowledge

## Performance Benchmarks

| Dataset | Entities | Triplets | MRR (NBFNet) | MRR (A*Net) | Speedup |
|---------|----------|----------|--------------|-------------|---------|
| FB15k237 | 14,541 | 310k | 0.415 | 0.408 | 1.2x |
| WN18RR | 40,943 | 93k | 0.551 | 0.549 | 1.5x |
| WikiKG2 | 2.5M | 16M | 0.523 | 0.497 | 3.8x |

**Key Insight**: A*Net trades ~2% accuracy for 2-4x faster inference on large graphs.

## Reference Files

- Core model: `reasoning/model.py` (lines 231-454)
- GNN layers: `reasoning/layer.py`
- Training script: `script/run.py`
- ChatGPT demo: `script/chat.py`
- Visualization: `script/visualize.py`
- Datasets: `reasoning/dataset.py`
- Paper: [A*Net: A Scalable Path-based Reasoning Approach for Knowledge Graphs](https://arxiv.org/pdf/2206.04798.pdf)

## Troubleshooting

**Error**: "The code is stuck at the beginning of epoch 0"
```bash
# Clear JIT cache
rm -r ~/.cache/torch_extensions/*
```

**Error**: CUDA out of memory on WikiKG2
```yaml
# Reduce exploration ratios
task:
  model:
    node_ratio: 0.05      # From 0.1
    degree_ratio: 0.5     # From 1.0
engine:
  batch_size: 32          # From 64
```

**Error**: ChatGPT can't find entity in Wikidata
```
# Entity may use different naming convention
# Try: "Joseph Biden" instead of "Joe Biden"
# Or search manually: https://www.wikidata.org/
```
