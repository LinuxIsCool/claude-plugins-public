---
name: awesome-tkgc
description: Master Temporal Knowledge Graph Completion (TKGC) research spanning 5 methodological stages from static embeddings to LLM-augmented reasoning. Use when building temporal KG systems, implementing time-aware predictions, studying TKGC evolution, or developing explainable temporal reasoning applications in QA, medical analysis, and recommendation systems.
allowed-tools: Read, Glob, Grep, Bash, WebFetch
---

# Awesome-TKGC Mastery

Comprehensive research collection for Temporal Knowledge Graph Completion covering a decade of methodological evolution.

## Territory Map

```
resources/knowledge_graphs/Awesome-TKGC/
└── README.md                    # Complete TKGC research taxonomy
    ├── 5 Research Stages (150+ papers)
    ├── Applications (QA, Medical, Recommendations)
    └── Future Directions (Multi-modal, Foundation Models)
```

## Research Evolution Overview

The field has evolved through five well-defined methodological stages:

1. **Static Model Extension** (2016-2022): Timestamp-dependent representations
2. **Dynamic Temporal Modeling** (2017-2025): Context-aware temporal encoding
3. **Generalization-Oriented Learning** (2021-2024): Few-shot and inductive reasoning
4. **Explainable Temporal Reasoning** (2021-2025): Logic-driven and policy-based approaches
5. **LLM-augmented TKGC** (2023-2025): Prompt-guided and fine-tuned reasoning

## Stage 1: Static Model Extension

### Timestamps-dependent Representations

Early approaches extending static KG embeddings with temporal information.

**Foundation Models**:
- **TTransE** (COLING 2016): First time-aware KG completion approach
- **HyTE** (EMNLP 2018): Hyperplane-based temporal embeddings
- **TKGFrame** (APWeb-WAIM 2020): Two-phase temporal framework

**Tensor Decomposition Lineage**:
- Tucker decomposition-based TKGC (KBS 2022)
- TBDRI: Block decomposition with relational interaction (APIN 2023)
- Sparse transfer matrix (IS 2023)

### Time-aware Embedding Function Models

Advanced temporal encoding using geometric and manifold representations.

**Geometric Approaches**:
- **TeRo** (COLING 2020): Temporal rotation in vector space
- **TComplEx** (ICLR 2020): Tensor decompositions for temporal completion
- **ChronoR** (AAAI 2021): Rotation-based temporal embeddings
- **RotateQVS** (ACL 2022): Quaternion vector space rotations

**Manifold-based Models**:
- **DyERNIE** (EMNLP 2020): Riemannian manifold embeddings
- **ATISE** (ISWC 2020): Time series Gaussian embedding
- Hyperbolic temporal embeddings (ACL 2021): Relational and time curvatures

**Advanced Geometry**:
- **BoxTE** (AAAI 2022): Box embeddings for temporal reasoning
- **SANe** (ISWC 2022): Space adaptation per snapshot
- **HGE** (AAAI 2024): Heterogeneous geometric subspaces
- **MADE** (TCYB 2024): Multicurvature adaptive embedding
- **IME** (WWW 2024): Multi-curvature shared/specific embedding

**When to Use**: Static approaches work well for:
- Datasets with regular timestamps
- Link prediction tasks
- Baseline comparisons
- Resource-constrained environments

## Stage 2: Dynamic Temporal Modeling

### Context-aware Temporal Encoding

Models that capture temporal evolution and historical context.

**Pioneering Dynamic Models**:
- **Know-evolve** (PMLR 2017): Deep temporal reasoning for dynamic KGs
- **TDG2E** (IEEE Access 2020): Timespan-aware dynamic embedding
- **TeMP** (EMNLP 2020): Temporal message passing framework

**Graph-based Dynamic Approaches**:
- **RE-GCN** (SIGIR 2021): Evolutional representation learning
- **DACHA** (TKDD 2021): Dual graph convolution with historical relations
- **TANGO** (EMNLP 2021): Neural ODEs for future link forecasting
- **CyGNet** (AAAI 2021): Sequential copy-generation networks

**Advanced Historical Modeling**:
- **xERTE** (ICLR 2021): Explainable subgraph reasoning
- **EvoKG** (WSDM 2022): Joint event time and network structure modeling
- **HiSMatch** (EMNLP 2022): Historical structure matching
- **CRNet** (ISWC 2022): Modeling concurrent events
- **TiRGN** (IJCAI 2022): Time-guided recurrent graph network
- **CENET** (AAAI 2023): Historical contrastive learning

**Recent Advances**:
- **HTCCN** (NAACL 2024): Hawkes process with causal convolution
- Transformer-based evolutionary chain reasoning (SIGIR 2024)
- Hawkes-based scale-free community modeling (COLING 2025)
- Disentangled multi-span evolutionary network (Findings 2025)

### Constraint-aware Temporal Encoding

Incorporating temporal constraints and logical consistency.

**Key Models**:
- **TempCaps** (SPNLP 2022): Capsule network-based embeddings
- **RoAN** (EAAI 2023): Relation-oriented attention network
- Temporal-structural importance weighted GCN (FGCS 2023)

**When to Use**: Dynamic approaches excel at:
- Event forecasting
- Multi-hop temporal reasoning
- Capturing temporal dependencies
- Real-world evolving KGs

## Stage 3: Generalization-Oriented Learning

### Few-shot Generalization

Learning from limited temporal examples.

**Core Methods**:
- **MetaTKG** (EMNLP 2022): Meta-learning for evolutionary knowledge
- Learning to sample and aggregate (NeurIPS 2022): Few-shot reasoning
- **FTMF** (WWW 2023): Meta-optimization with fault-tolerance
- Meta representations of one-shot relations (IJCNN 2023)
- Time-aware translation with attention (Neural Networks 2023)

### Inductive Generalization

Reasoning over unseen entities and relations.

**Key Approaches**:
- **TimeTraveler** (EMNLP 2021): Reinforcement learning for forecasting
- **ALRET-IR** (EMNLP 2022): Adaptive logical rule embedding
- BERT-based fully-inductive prediction (SIGIR 2023)
- Confidence-augmented RL (PKDD 2023)
- **TiPNN** (Artificial Intelligence 2024): Temporal inductive path neural network

**When to Use**: Generalization methods are critical for:
- Cold-start scenarios
- Emerging entities/relations
- Cross-domain transfer
- Production systems with evolving schemas

## Stage 4: Explainable Temporal Reasoning

### Logic-driven Temporal Reasoning

Integrating logical rules for interpretable predictions.

**Foundational Works**:
- **TLogic** (AAAI 2022): Temporal logical rules for explainable forecasting
- **TILP** (ICLR 2023): Differentiable learning of temporal logical rules
- Multi-hop temporal path rules guidance (Expert Systems 2023)

**Advanced Logical Models**:
- **NeuSTIP** (EMNLP 2023): Neuro-symbolic link and time prediction
- Iterative guidance by temporal logical rules (Information Sciences 2023)
- **TFLEX** (NeurIPS 2023): Temporal feature-logic embedding framework
- **TEILP** (AAAI 2024): Time prediction via logical reasoning
- Relation logical reasoning (COLING 2025)

### Policy-based Temporal Reasoning

Reinforcement learning for multi-hop path discovery.

**Key Methods**:
- Temporal link prediction via RL (ICASSP 2021)
- Multi-hop reasoning with RL (Applied Soft Computing 2021)
- **TimeTraveler** (EMNLP 2021): Two-stage reasoning framework
- **DREAM** (SIGIR 2023): Adaptive RL with attention mechanism
- **RLAT** (KBS 2023): RL and attention for multi-hop reasoning

**When to Use**: Explainable approaches for:
- High-stakes decision making
- Regulatory compliance
- Scientific discovery
- Human-in-the-loop systems

## Stage 5: LLM-augmented TKGC

### Prompt-guided Reasoning with LMs

Leveraging pre-trained language models without fine-tuning.

**Prompting Approaches**:
- **PPT** (Findings 2023): Pre-trained LM with prompts
- In-context learning for TKG forecasting (EMNLP 2023)
- **zrLLM** (NAACL 2024): Zero-shot relational learning with LLMs
- Chain-of-History reasoning (arXiv 2024)
- **LLM-DA** (NeurIPS 2024): LLM-guided dynamic adaptation

**Recent Innovations**:
- **AnRe** (ACL 2025): Analogical replay for forecasting
- Diachronic semantic encoding (KBS 2025)
- Iterative prompt for TKGC (Neurocomputing 2025)
- **LLM-DR** (AAAI 2025): LLM-aided diffusion for rule generation
- Temporal validity rules via LLMs (KBS 2025)

### Fine-tuned Reasoning with LLMs

Adapting LLMs for temporal reasoning tasks.

**Fine-tuning Methods**:
- Back to the future (WWW 2024): Explainable temporal reasoning
- **ChapTER** (Findings 2024): Contrastive historical modeling with prefix-tuning
- **GenTKG** (Findings 2024): Generative forecasting with LLMs
- **G2S** (Findings 2025): General-to-specific learning framework

**When to Use**: LLM approaches excel at:
- Zero/few-shot scenarios
- Complex temporal queries
- Natural language integration
- Rapid prototyping

## Applications

### Question Answering Systems

Temporal QA over knowledge graphs.

**Datasets & Systems**:
- **Event-QA** (CIKM 2020): Event-centric QA dataset
- **TempoQR** (AAAI 2022): Temporal question reasoning
- **TwiRGCN** (arXiv 2022): Temporally weighted graph convolution
- Forecasting QA (AAAI 2022): Future-oriented questions
- Time sensitivity improvement (ACL 2022)
- **TKGQA Dataset** (Data 2023): Evolution-guided QA

### Medical and Risk Analysis Systems

Healthcare and risk prediction applications.

**Medical Applications**:
- Medical aided diagnosis (ICADMA 2020)
- Traditional Chinese medicine semantic search (JIST 2019)
- **HC-LLM** (AAAI 2025): Historical-constrained LLM for radiology reports

**Risk Analysis**:
- Spatio-temporal KG for meteorological risk (ICSQRSC 2021)
- Urban multi-source spatio-temporal analysis (Symmetry 2020)

### Recommendation Systems

Temporal-aware recommendations.

**Applications**:
- Travel attractions with spatial-temporal KGs (ICPCSEE 2018)
- TKG incremental construction (Web and Big Data 2020)
- Next POI recommendation (KBS 2022)
- Service recommendation (TSC 2022)
- Diversified exercise recommendation (SIGIR 2025)
- Personalized learning paths (arXiv 2024)

## Future Directions

### Multi-Modal Temporal Knowledge Graphs

Integrating vision, text, and temporal information.

**Challenges**:
- Cross-modal temporal alignment
- Multi-modal entity resolution
- Temporal visual reasoning

### Complex Temporal Query Answering

Beyond simple link prediction.

**Research Areas**:
- Conjunctive temporal queries
- Temporal path queries
- Aggregation over time

### Interpretability of Temporal Reasoning

Understanding model decisions.

**Approaches**:
- Attention visualization
- Rule extraction
- Counterfactual explanations

### Foundation Models for Temporal Knowledge Graphs

Large-scale pre-trained temporal models.

**Vision**:
- Universal temporal representations
- Transfer learning across domains
- Unified temporal reasoning framework

## Learning Progression

### Beginner: Understanding Fundamentals

1. Start with **TTransE** and **HyTE** papers to understand timestamp encoding
2. Study **TComplEx** for tensor decomposition basics
3. Read related surveys for broad overview

**Key Concepts**:
- Temporal KG structure: (subject, relation, object, timestamp)
- Link prediction vs. extrapolation
- Static vs. dynamic modeling

### Intermediate: Dynamic and Generalization Methods

1. Explore **Know-evolve** and **TeMP** for dynamic modeling
2. Study **RE-GCN** and **TANGO** for graph-based approaches
3. Learn **MetaTKG** for few-shot scenarios
4. Review **TiPNN** for inductive reasoning

**Key Techniques**:
- Message passing over temporal graphs
- Historical context aggregation
- Meta-learning for generalization

### Advanced: Explainability and LLM Integration

1. Master **TLogic** and **TILP** for logical reasoning
2. Study **TFLEX** for neuro-symbolic approaches
3. Explore **zrLLM** and **LLM-DA** for LLM integration
4. Implement **GenTKG** for generative forecasting

**Advanced Patterns**:
- Rule learning and application
- Reinforcement learning for path finding
- Prompt engineering for temporal reasoning
- Fine-tuning strategies for LLMs

## Key Methodologies Reference

| Approach | Core Technique | Best For | Paper |
|----------|---------------|----------|-------|
| TTransE | Translation + timestamps | Baselines | COLING 2016 |
| HyTE | Hyperplane projection | Static scenarios | EMNLP 2018 |
| TComplEx | Tensor decomposition | Regular timestamps | ICLR 2020 |
| Know-evolve | Point processes | Irregular events | PMLR 2017 |
| TeMP | Message passing | Multi-hop reasoning | EMNLP 2020 |
| TANGO | Neural ODEs | Event forecasting | EMNLP 2021 |
| RE-GCN | Evolutional GCN | Dynamic graphs | SIGIR 2021 |
| MetaTKG | Meta-learning | Few-shot | EMNLP 2022 |
| TiPNN | Inductive paths | Unseen entities | AI 2024 |
| TLogic | Logical rules | Explainability | AAAI 2022 |
| TILP | Differentiable logic | Interpretable | ICLR 2023 |
| TimeTraveler | Reinforcement learning | Multi-hop paths | EMNLP 2021 |
| zrLLM | Zero-shot LLM | Cold-start | NAACL 2024 |
| GenTKG | Generative LLM | Complex queries | Findings 2024 |

## Implementation Strategy

### For Research

1. **Literature Review**: Use stage-based organization to identify gaps
2. **Baseline Selection**: Choose methods from different stages for comparison
3. **Dataset Selection**: Standard benchmarks (ICEWS, GDELT, YAGO, Wikidata)
4. **Evaluation Metrics**: MRR, Hits@1/3/10, time prediction accuracy

### For Applications

1. **QA Systems**: Start with TLogic or TempoQR
2. **Medical/Risk**: Use constraint-aware methods (RoAN, TempCaps)
3. **Recommendations**: Implement dynamic models (RE-GCN, TANGO)
4. **Production**: Consider LLM-augmented approaches for flexibility

## When to Use This Skill

- Designing temporal knowledge graph systems
- Comparing TKGC methodologies
- Implementing time-aware predictions
- Building explainable temporal AI
- Developing QA, medical, or recommendation applications
- Researching temporal reasoning with LLMs
- Understanding TKGC evolution and trends

## Reference Files

- Main resource: `resources/knowledge_graphs/Awesome-TKGC/README.md`
- Related surveys section for comparative analysis
- 150+ papers organized by methodology
- Future directions for cutting-edge research

## Cross-References

**Related Skills**:
- **graphiti**: For practical temporal KG implementation
- **sparql-query**: For temporal query languages
- **koi-net**: For blockchain-based temporal graphs
- **lightrag**: For RAG with temporal knowledge

**Complementary Resources**:
- awesome-knowledge-graph: Static KG completion methods
- awesome-graph-universe: Broader graph learning context
