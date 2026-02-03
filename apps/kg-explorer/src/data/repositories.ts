import type { Repository, Tier, SingularityImpact, ResearchFrontier } from "@/lib/types";

// Repository data parsed from the KG Repository Database
// Source: plugins/knowledge-graphs/skills/kg-master/subskills/singularity-research/kg-repository-database.md
// Compiled by 22 specialized agents as part of the KG Singularity Research project
// Date: 2026-01-15

export const repositories: Repository[] = [
  // Tier 1: Core Infrastructure (Graph Databases)
  {
    id: "dgraph-io-dgraph",
    name: "dgraph",
    fullName: "dgraph-io/dgraph",
    description: "Distributed GraphQL database",
    url: "https://github.com/dgraph-io/dgraph",
    tier: "Tier 1: Core Infrastructure",
    singularityRelevance: "Horizontal scaling for web-scale KGs",
    singularityImpact: "High",
    language: "Go",
  },
  {
    id: "typedb-typedb",
    name: "typedb",
    fullName: "typedb/typedb",
    description: "Polymorphic database with type system",
    url: "https://github.com/typedb/typedb",
    tier: "Tier 1: Core Infrastructure",
    singularityRelevance: "Strong typing enables formal reasoning",
    singularityImpact: "High",
    researchFrontier: "Neuro-symbolic",
    language: "Java",
  },
  {
    id: "vesoft-inc-nebula",
    name: "nebula",
    fullName: "vesoft-inc/nebula",
    description: "Distributed graph database",
    url: "https://github.com/vesoft-inc/nebula",
    tier: "Tier 1: Core Infrastructure",
    singularityRelevance: "Billion-scale graph handling",
    singularityImpact: "High",
    language: "C++",
  },
  {
    id: "apache-jena",
    name: "jena",
    fullName: "apache/jena",
    description: "Semantic web framework",
    url: "https://github.com/apache/jena",
    tier: "Tier 1: Core Infrastructure",
    singularityRelevance: "RDF/SPARQL foundation",
    singularityImpact: "Foundation",
    language: "Java",
  },
  {
    id: "apache-age",
    name: "age",
    fullName: "apache/age",
    description: "PostgreSQL graph extension",
    url: "https://github.com/apache/age",
    tier: "Tier 1: Core Infrastructure",
    singularityRelevance: "SQL+Graph hybrid queries",
    singularityImpact: "Medium",
    language: "C",
  },
  {
    id: "blazegraph-database",
    name: "blazegraph",
    fullName: "blazegraph/database",
    description: "High-performance graph database",
    url: "https://github.com/blazegraph/database",
    tier: "Tier 1: Core Infrastructure",
    singularityRelevance: "Powers Wikidata",
    singularityImpact: "Foundation",
    language: "Java",
  },
  {
    id: "tugraph-family-tugraph-db",
    name: "tugraph-db",
    fullName: "TuGraph-family/tugraph-db",
    description: "High-performance graph database",
    url: "https://github.com/TuGraph-family/tugraph-db",
    tier: "Tier 1: Core Infrastructure",
    singularityRelevance: "Alibaba's production KG system",
    singularityImpact: "High",
    language: "C++",
  },
  {
    id: "falkordb-falkordb",
    name: "FalkorDB",
    fullName: "FalkorDB/FalkorDB",
    description: "Redis-based graph database",
    url: "https://github.com/FalkorDB/FalkorDB",
    tier: "Tier 1: Core Infrastructure",
    singularityRelevance: "In-memory performance",
    singularityImpact: "Medium",
    language: "C",
  },

  // Tier 2: RAG + Knowledge Graphs (Singularity Frontier)
  {
    id: "microsoft-graphrag",
    name: "graphrag",
    fullName: "microsoft/graphrag",
    description: "LLM + KG retrieval system",
    url: "https://github.com/microsoft/graphrag",
    tier: "Tier 2: RAG + Knowledge Graphs",
    singularityRelevance: "Industry standard for GraphRAG",
    singularityImpact: "Medium",
    language: "Python",
  },
  {
    id: "hkuds-lightrag",
    name: "LightRAG",
    fullName: "HKUDS/LightRAG",
    description: "Lightweight RAG with KG",
    url: "https://github.com/HKUDS/LightRAG",
    tier: "Tier 2: RAG + Knowledge Graphs",
    singularityRelevance: "Efficient retrieval at scale",
    singularityImpact: "Medium",
    language: "Python",
  },
  {
    id: "getzep-graphiti",
    name: "graphiti",
    fullName: "getzep/graphiti",
    description: "Temporal knowledge graphs",
    url: "https://github.com/getzep/graphiti",
    tier: "Tier 2: RAG + Knowledge Graphs",
    singularityRelevance: "Bi-temporal reasoning for agents",
    singularityImpact: "Critical",
    researchFrontier: "Temporal KGs",
    language: "Python",
  },
  {
    id: "openspg-kag",
    name: "KAG",
    fullName: "OpenSPG/KAG",
    description: "Knowledge Augmented Generation",
    url: "https://github.com/OpenSPG/KAG",
    tier: "Tier 2: RAG + Knowledge Graphs",
    singularityRelevance: "Domain-specific logical reasoning",
    singularityImpact: "Medium",
    researchFrontier: "Neuro-symbolic",
    language: "Python",
  },
  {
    id: "topoteretes-cognee",
    name: "cognee",
    fullName: "topoteretes/cognee",
    description: "KG for AI memory",
    url: "https://github.com/topoteretes/cognee",
    tier: "Tier 2: RAG + Knowledge Graphs",
    singularityRelevance: "Cognitive architecture foundation",
    singularityImpact: "Critical",
    researchFrontier: "Multi-modal KGs",
    language: "Python",
  },
  {
    id: "sciphi-ai-r2r",
    name: "R2R",
    fullName: "SciPhi-AI/R2R",
    description: "RAG-to-riches framework",
    url: "https://github.com/SciPhi-AI/R2R",
    tier: "Tier 2: RAG + Knowledge Graphs",
    singularityRelevance: "Production-ready RAG pipelines",
    singularityImpact: "Medium",
    language: "Python",
  },
  {
    id: "mem0ai-mem0",
    name: "mem0",
    fullName: "mem0ai/mem0",
    description: "AI memory layer",
    url: "https://github.com/mem0ai/mem0",
    tier: "Tier 2: RAG + Knowledge Graphs",
    singularityRelevance: "Persistent agent memory",
    singularityImpact: "Critical",
    researchFrontier: "Agent Memory",
    language: "Python",
  },
  {
    id: "cpacker-memgpt",
    name: "MemGPT",
    fullName: "cpacker/MemGPT",
    description: "LLM with memory",
    url: "https://github.com/cpacker/MemGPT",
    tier: "Tier 2: RAG + Knowledge Graphs",
    singularityRelevance: "Self-editing memory system",
    singularityImpact: "Critical",
    researchFrontier: "Agent Memory",
    language: "Python",
  },
  {
    id: "gusye1234-nano-graphrag",
    name: "nano-graphrag",
    fullName: "gusye1234/nano-graphrag",
    description: "Minimal GraphRAG",
    url: "https://github.com/gusye1234/nano-graphrag",
    tier: "Tier 2: RAG + Knowledge Graphs",
    singularityRelevance: "Lightweight implementation",
    singularityImpact: "Medium",
    language: "Python",
  },
  {
    id: "neo4j-labs-llm-graph-builder",
    name: "llm-graph-builder",
    fullName: "neo4j-labs/llm-graph-builder",
    description: "LLM-powered KG construction",
    url: "https://github.com/neo4j-labs/llm-graph-builder",
    tier: "Tier 2: RAG + Knowledge Graphs",
    singularityRelevance: "Automated KG building",
    singularityImpact: "Medium",
    language: "Python",
  },
  {
    id: "falkordb-graphrag-sdk",
    name: "GraphRAG-SDK",
    fullName: "FalkorDB/GraphRAG-SDK",
    description: "GraphRAG toolkit",
    url: "https://github.com/FalkorDB/GraphRAG-SDK",
    tier: "Tier 2: RAG + Knowledge Graphs",
    singularityRelevance: "Multi-backend support",
    singularityImpact: "Medium",
    language: "Python",
  },
  {
    id: "trustgraph-ai-trustgraph",
    name: "trustgraph",
    fullName: "trustgraph-ai/trustgraph",
    description: "Trusted knowledge graphs",
    url: "https://github.com/trustgraph-ai/trustgraph",
    tier: "Tier 2: RAG + Knowledge Graphs",
    singularityRelevance: "Verifiable knowledge",
    singularityImpact: "High",
    language: "Python",
  },
  {
    id: "whyhow-ai-knowledge-graph-studio",
    name: "knowledge-graph-studio",
    fullName: "whyhow-ai/knowledge-graph-studio",
    description: "KG construction platform",
    url: "https://github.com/whyhow-ai/knowledge-graph-studio",
    tier: "Tier 2: RAG + Knowledge Graphs",
    singularityRelevance: "Visual KG building",
    singularityImpact: "Medium",
    language: "TypeScript",
  },

  // Tier 3: KG Embedding & Reasoning
  {
    id: "pykeen-pykeen",
    name: "pykeen",
    fullName: "pykeen/pykeen",
    description: "KG embedding framework",
    url: "https://github.com/pykeen/pykeen",
    tier: "Tier 3: KG Embedding & Reasoning",
    singularityRelevance: "30+ embedding models",
    singularityImpact: "Foundation",
    language: "Python",
  },
  {
    id: "accenture-ampligraph",
    name: "AmpliGraph",
    fullName: "Accenture/AmpliGraph",
    description: "KG embeddings library",
    url: "https://github.com/Accenture/AmpliGraph",
    tier: "Tier 3: KG Embedding & Reasoning",
    singularityRelevance: "Industry-grade embeddings",
    singularityImpact: "Foundation",
    language: "Python",
  },
  {
    id: "deepgraphlearning-graphvite",
    name: "graphvite",
    fullName: "DeepGraphLearning/graphvite",
    description: "GPU-accelerated KG embeddings",
    url: "https://github.com/DeepGraphLearning/graphvite",
    tier: "Tier 3: KG Embedding & Reasoning",
    singularityRelevance: "Scale to billions",
    singularityImpact: "High",
    language: "C++",
  },
  {
    id: "deepgraphlearning-knowledgegraphembedding",
    name: "KnowledgeGraphEmbedding",
    fullName: "DeepGraphLearning/KnowledgeGraphEmbedding",
    description: "KGE implementations",
    url: "https://github.com/DeepGraphLearning/KnowledgeGraphEmbedding",
    tier: "Tier 3: KG Embedding & Reasoning",
    singularityRelevance: "Reference implementations",
    singularityImpact: "Foundation",
    language: "Python",
  },
  {
    id: "torchkge-team-torchkge",
    name: "torchkge",
    fullName: "torchkge-team/torchkge",
    description: "PyTorch KG embeddings",
    url: "https://github.com/torchkge-team/torchkge",
    tier: "Tier 3: KG Embedding & Reasoning",
    singularityRelevance: "PyTorch-native",
    singularityImpact: "Foundation",
    language: "Python",
  },
  {
    id: "awslabs-dgl-ke",
    name: "dgl-ke",
    fullName: "awslabs/dgl-ke",
    description: "Distributed KG embeddings",
    url: "https://github.com/awslabs/dgl-ke",
    tier: "Tier 3: KG Embedding & Reasoning",
    singularityRelevance: "AWS-scale training",
    singularityImpact: "High",
    language: "Python",
  },
  {
    id: "awslabs-graphstorm",
    name: "graphstorm",
    fullName: "awslabs/graphstorm",
    description: "Graph ML at scale",
    url: "https://github.com/awslabs/graphstorm",
    tier: "Tier 3: KG Embedding & Reasoning",
    singularityRelevance: "Enterprise GNN training",
    singularityImpact: "High",
    language: "Python",
  },
  {
    id: "facebookresearch-pytorch-biggraph",
    name: "PyTorch-BigGraph",
    fullName: "facebookresearch/PyTorch-BigGraph",
    description: "Billion-scale graph embeddings",
    url: "https://github.com/facebookresearch/PyTorch-BigGraph",
    tier: "Tier 3: KG Embedding & Reasoning",
    singularityRelevance: "Facebook's production system",
    singularityImpact: "High",
    language: "Python",
  },

  // Tier 4: Graph Neural Networks
  {
    id: "dmlc-dgl",
    name: "dgl",
    fullName: "dmlc/dgl",
    description: "Deep Graph Library",
    url: "https://github.com/dmlc/dgl",
    tier: "Tier 4: Graph Neural Networks",
    singularityRelevance: "Industry standard GNN framework",
    singularityImpact: "Foundation",
    language: "Python",
  },
  {
    id: "pyg-team-pytorch-geometric",
    name: "pytorch_geometric",
    fullName: "pyg-team/pytorch_geometric",
    description: "PyTorch Geometric",
    url: "https://github.com/pyg-team/pytorch_geometric",
    tier: "Tier 4: Graph Neural Networks",
    singularityRelevance: "Most popular GNN library",
    singularityImpact: "Foundation",
    language: "Python",
  },
  {
    id: "danielegrattarola-spektral",
    name: "spektral",
    fullName: "danielegrattarola/spektral",
    description: "Keras GNN library",
    url: "https://github.com/danielegrattarola/spektral",
    tier: "Tier 4: Graph Neural Networks",
    singularityRelevance: "TensorFlow GNN support",
    singularityImpact: "Foundation",
    language: "Python",
  },
  {
    id: "benedekrozemberczki-karateclub",
    name: "karateclub",
    fullName: "benedekrozemberczki/karateclub",
    description: "Graph embedding algorithms",
    url: "https://github.com/benedekrozemberczki/karateclub",
    tier: "Tier 4: Graph Neural Networks",
    singularityRelevance: "40+ methods",
    singularityImpact: "Foundation",
    language: "Python",
  },
  {
    id: "benedekrozemberczki-pytorch-geometric-temporal",
    name: "pytorch_geometric_temporal",
    fullName: "benedekrozemberczki/pytorch_geometric_temporal",
    description: "Temporal GNNs",
    url: "https://github.com/benedekrozemberczki/pytorch_geometric_temporal",
    tier: "Tier 4: Graph Neural Networks",
    singularityRelevance: "Time-aware graph learning",
    singularityImpact: "High",
    researchFrontier: "Temporal KGs",
    language: "Python",
  },

  // Tier 5: Knowledge Bases & Datasets
  {
    id: "yago-naga-yago3",
    name: "yago3",
    fullName: "yago-naga/yago3",
    description: "YAGO knowledge base",
    url: "https://github.com/yago-naga/yago3",
    tier: "Tier 5: Knowledge Bases & Datasets",
    singularityRelevance: "10M entities, high precision",
    singularityImpact: "Foundation",
    language: "Java",
  },
  {
    id: "dbpedia-extraction-framework",
    name: "extraction-framework",
    fullName: "dbpedia/extraction-framework",
    description: "DBpedia extraction",
    url: "https://github.com/dbpedia/extraction-framework",
    tier: "Tier 5: Knowledge Bases & Datasets",
    singularityRelevance: "Wikipedia to KG",
    singularityImpact: "Foundation",
    language: "Scala",
  },
  {
    id: "wikidata-wikidata-toolkit",
    name: "Wikidata-Toolkit",
    fullName: "Wikidata/Wikidata-Toolkit",
    description: "Wikidata Java toolkit",
    url: "https://github.com/Wikidata/Wikidata-Toolkit",
    tier: "Tier 5: Knowledge Bases & Datasets",
    singularityRelevance: "Largest open KG",
    singularityImpact: "Foundation",
    language: "Java",
  },
  {
    id: "wordnet-wordnet",
    name: "wordnet",
    fullName: "wordnet/wordnet",
    description: "WordNet lexical database",
    url: "https://github.com/wordnet/wordnet",
    tier: "Tier 5: Knowledge Bases & Datasets",
    singularityRelevance: "Semantic relations",
    singularityImpact: "Foundation",
    language: "C",
  },

  // Tier 6: Visualization & Exploration
  {
    id: "cytoscape-cytoscape",
    name: "cytoscape",
    fullName: "cytoscape/cytoscape",
    description: "Network visualization platform",
    url: "https://github.com/cytoscape/cytoscape",
    tier: "Tier 6: Visualization & Exploration",
    singularityRelevance: "Scientific graph viz",
    singularityImpact: "Medium",
    language: "Java",
  },
  {
    id: "visjs-vis-network",
    name: "vis-network",
    fullName: "visjs/vis-network",
    description: "Dynamic network viz",
    url: "https://github.com/visjs/vis-network",
    tier: "Tier 6: Visualization & Exploration",
    singularityRelevance: "Interactive exploration",
    singularityImpact: "Medium",
    language: "JavaScript",
  },
  {
    id: "vasturiano-react-force-graph",
    name: "react-force-graph",
    fullName: "vasturiano/react-force-graph",
    description: "React force-directed graphs",
    url: "https://github.com/vasturiano/react-force-graph",
    tier: "Tier 6: Visualization & Exploration",
    singularityRelevance: "WebGL performance",
    singularityImpact: "Medium",
    language: "JavaScript",
  },
  {
    id: "xyflow-xyflow",
    name: "xyflow",
    fullName: "xyflow/xyflow",
    description: "React Flow diagrams",
    url: "https://github.com/xyflow/xyflow",
    tier: "Tier 6: Visualization & Exploration",
    singularityRelevance: "Node-based UIs",
    singularityImpact: "Medium",
    language: "TypeScript",
  },
  {
    id: "westhealth-pyvis",
    name: "pyvis",
    fullName: "WestHealth/pyvis",
    description: "Python network viz",
    url: "https://github.com/WestHealth/pyvis",
    tier: "Tier 6: Visualization & Exploration",
    singularityRelevance: "Jupyter integration",
    singularityImpact: "Medium",
    language: "Python",
  },
  {
    id: "xflr6-graphviz",
    name: "graphviz",
    fullName: "xflr6/graphviz",
    description: "Graphviz Python interface",
    url: "https://github.com/xflr6/graphviz",
    tier: "Tier 6: Visualization & Exploration",
    singularityRelevance: "DOT language",
    singularityImpact: "Foundation",
    language: "Python",
  },

  // Tier 7: NLP & Entity Extraction
  {
    id: "allenai-scispacy",
    name: "scispacy",
    fullName: "allenai/scispacy",
    description: "Scientific NLP",
    url: "https://github.com/allenai/scispacy",
    tier: "Tier 7: NLP & Entity Extraction",
    singularityRelevance: "Biomedical entity extraction",
    singularityImpact: "Medium",
    language: "Python",
  },
  {
    id: "deepset-ai-haystack",
    name: "haystack",
    fullName: "deepset-ai/haystack",
    description: "NLP framework",
    url: "https://github.com/deepset-ai/haystack",
    tier: "Tier 7: NLP & Entity Extraction",
    singularityRelevance: "KG-aware retrieval",
    singularityImpact: "Medium",
    language: "Python",
  },
  {
    id: "derwenai-kglab",
    name: "kglab",
    fullName: "DerwenAI/kglab",
    description: "KG construction toolkit",
    url: "https://github.com/DerwenAI/kglab",
    tier: "Tier 7: NLP & Entity Extraction",
    singularityRelevance: "Python-native KG building",
    singularityImpact: "Medium",
    language: "Python",
  },
  {
    id: "auvalab-itext2kg",
    name: "itext2kg",
    fullName: "AuvaLab/itext2kg",
    description: "Text to KG extraction",
    url: "https://github.com/AuvaLab/itext2kg",
    tier: "Tier 7: NLP & Entity Extraction",
    singularityRelevance: "Document KG construction",
    singularityImpact: "Medium",
    language: "Python",
  },

  // Tier 8: Agent Frameworks
  {
    id: "yoheinakajima-babyagi",
    name: "babyagi",
    fullName: "yoheinakajima/babyagi",
    description: "Task-driven agent",
    url: "https://github.com/yoheinakajima/babyagi",
    tier: "Tier 8: Agent Frameworks",
    singularityRelevance: "Self-improving agents",
    singularityImpact: "Critical",
    researchFrontier: "Agent Memory",
    language: "Python",
  },
  {
    id: "xpressai-xai-gpt-agent-toolkit",
    name: "xai-gpt-agent-toolkit",
    fullName: "xpressai/xai-gpt-agent-toolkit",
    description: "Agent toolkit",
    url: "https://github.com/xpressai/xai-gpt-agent-toolkit",
    tier: "Tier 8: Agent Frameworks",
    singularityRelevance: "KG-enhanced agents",
    singularityImpact: "Medium",
    language: "Python",
  },

  // Tier 9: Research & Awesome Lists
  {
    id: "zjukg-kg-llm-papers",
    name: "KG-LLM-Papers",
    fullName: "zjukg/KG-LLM-Papers",
    description: "KG + LLM papers",
    url: "https://github.com/zjukg/KG-LLM-Papers",
    tier: "Tier 9: Research & Awesome Lists",
    singularityRelevance: "Academic frontier",
    singularityImpact: "Medium",
    language: "Markdown",
  },
  {
    id: "zjukg-kg-mm-survey",
    name: "KG-MM-Survey",
    fullName: "zjukg/KG-MM-Survey",
    description: "Multi-modal KG survey",
    url: "https://github.com/zjukg/KG-MM-Survey",
    tier: "Tier 9: Research & Awesome Lists",
    singularityRelevance: "Vision + KG",
    singularityImpact: "Medium",
    researchFrontier: "Multi-modal KGs",
    language: "Markdown",
  },
  {
    id: "zjunlp-generative-kg-construction-papers",
    name: "Generative_KG_Construction_Papers",
    fullName: "zjunlp/Generative_KG_Construction_Papers",
    description: "Generative KG papers",
    url: "https://github.com/zjunlp/Generative_KG_Construction_Papers",
    tier: "Tier 9: Research & Awesome Lists",
    singularityRelevance: "LLM-based construction",
    singularityImpact: "Medium",
    language: "Markdown",
  },
  {
    id: "zjunlp-promptkg",
    name: "PromptKG",
    fullName: "zjunlp/PromptKG",
    description: "Prompt-based KG",
    url: "https://github.com/zjunlp/PromptKG",
    tier: "Tier 9: Research & Awesome Lists",
    singularityRelevance: "Prompting for KGs",
    singularityImpact: "Medium",
    language: "Python",
  },
  {
    id: "deep-polyu-awesome-graphrag",
    name: "Awesome-GraphRAG",
    fullName: "DEEP-PolyU/Awesome-GraphRAG",
    description: "GraphRAG resources",
    url: "https://github.com/DEEP-PolyU/Awesome-GraphRAG",
    tier: "Tier 9: Research & Awesome Lists",
    singularityRelevance: "Curated list",
    singularityImpact: "Medium",
    language: "Markdown",
  },
  {
    id: "totogo-awesome-knowledge-graph",
    name: "awesome-knowledge-graph",
    fullName: "totogo/awesome-knowledge-graph",
    description: "KG resources",
    url: "https://github.com/totogo/awesome-knowledge-graph",
    tier: "Tier 9: Research & Awesome Lists",
    singularityRelevance: "Comprehensive guide",
    singularityImpact: "Medium",
    language: "Markdown",
  },
  {
    id: "liangke23-awesome-knowledge-graph-reasoning",
    name: "Awesome-Knowledge-Graph-Reasoning",
    fullName: "LIANGKE23/Awesome-Knowledge-Graph-Reasoning",
    description: "KG reasoning",
    url: "https://github.com/LIANGKE23/Awesome-Knowledge-Graph-Reasoning",
    tier: "Tier 9: Research & Awesome Lists",
    singularityRelevance: "Reasoning methods",
    singularityImpact: "Medium",
    language: "Markdown",
  },
  {
    id: "tugraph-family-awesome-graphs",
    name: "Awesome-Graphs",
    fullName: "TuGraph-family/Awesome-Graphs",
    description: "Graph resources",
    url: "https://github.com/TuGraph-family/Awesome-Graphs",
    tier: "Tier 9: Research & Awesome Lists",
    singularityRelevance: "Alibaba curated",
    singularityImpact: "Medium",
    language: "Markdown",
  },
];

// Helper functions
export function getRepositoriesByTier(tier: Tier): Repository[] {
  return repositories.filter((repo) => repo.tier === tier);
}

export function getRepositoriesByImpact(impact: SingularityImpact): Repository[] {
  return repositories.filter((repo) => repo.singularityImpact === impact);
}

export function getRepositoriesByFrontier(frontier: ResearchFrontier): Repository[] {
  return repositories.filter((repo) => repo.researchFrontier === frontier);
}

export function getRepositoriesByLanguage(language: string): Repository[] {
  return repositories.filter(
    (repo) => repo.language?.toLowerCase() === language.toLowerCase()
  );
}

export function searchRepositories(query: string): Repository[] {
  const lowerQuery = query.toLowerCase();
  return repositories.filter(
    (repo) =>
      repo.name.toLowerCase().includes(lowerQuery) ||
      repo.description.toLowerCase().includes(lowerQuery) ||
      repo.singularityRelevance.toLowerCase().includes(lowerQuery) ||
      repo.fullName.toLowerCase().includes(lowerQuery)
  );
}

// Statistics computation
export function computeStatistics() {
  const byTier: Record<string, number> = {};
  const byImpact: Record<SingularityImpact, number> = {
    Critical: 0,
    High: 0,
    Medium: 0,
    Foundation: 0,
  };
  const byFrontier: Record<string, number> = {};
  const byLanguage: Record<string, number> = {};

  for (const repo of repositories) {
    // By tier
    byTier[repo.tier] = (byTier[repo.tier] || 0) + 1;

    // By impact
    if (repo.singularityImpact) {
      byImpact[repo.singularityImpact]++;
    }

    // By frontier
    if (repo.researchFrontier) {
      byFrontier[repo.researchFrontier] =
        (byFrontier[repo.researchFrontier] || 0) + 1;
    }

    // By language
    if (repo.language) {
      byLanguage[repo.language] = (byLanguage[repo.language] || 0) + 1;
    }
  }

  return {
    totalRepositories: repositories.length,
    byTier,
    byImpact,
    byFrontier,
    byLanguage,
    trends: [
      { label: "Temporal KGs", count: byFrontier["Temporal KGs"] || 0, trend: "rising" as const },
      { label: "Multi-modal KGs", count: byFrontier["Multi-modal KGs"] || 0, trend: "emerging" as const },
      { label: "Neuro-symbolic", count: byFrontier["Neuro-symbolic"] || 0, trend: "accelerating" as const },
      { label: "Agent Memory", count: byFrontier["Agent Memory"] || 0, trend: "explosive" as const },
    ],
  };
}

export const TIERS: Tier[] = [
  "Tier 1: Core Infrastructure",
  "Tier 2: RAG + Knowledge Graphs",
  "Tier 3: KG Embedding & Reasoning",
  "Tier 4: Graph Neural Networks",
  "Tier 5: Knowledge Bases & Datasets",
  "Tier 6: Visualization & Exploration",
  "Tier 7: NLP & Entity Extraction",
  "Tier 8: Agent Frameworks",
  "Tier 9: Research & Awesome Lists",
];

export const IMPACTS: SingularityImpact[] = ["Critical", "High", "Medium", "Foundation"];

export const FRONTIERS: ResearchFrontier[] = [
  "Temporal KGs",
  "Multi-modal KGs",
  "Neuro-symbolic",
  "Agent Memory",
  "General",
];

export const LANGUAGES = [
  ...new Set(repositories.map((r) => r.language).filter(Boolean)),
].sort() as string[];
