"""
HippoRAG Client - Python wrapper for HippoRAG operations.

Provides a simplified interface for document indexing, retrieval, and
knowledge graph operations using the HippoRAG framework.

Usage:
    from hipporag_client import HippoRAGClient

    client = HippoRAGClient(
        save_dir='outputs/my_project',
        llm_model='gpt-4o-mini',
        embedding_model='text-embedding-3-small'
    )

    # Index documents
    client.index_documents(documents)

    # Query
    results = client.query("What did Einstein discover?")

    # RAG QA
    answer = client.ask("Who directed Titanic?")
"""

import os
import json
import logging
from dataclasses import dataclass, field
from typing import List, Dict, Optional, Tuple, Any, Union
from pathlib import Path

logger = logging.getLogger(__name__)


@dataclass
class QueryResult:
    """Result from a retrieval query."""
    question: str
    documents: List[str]
    scores: List[float]
    answer: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class GraphStats:
    """Statistics about the knowledge graph."""
    num_entities: int
    num_passages: int
    num_facts: int
    num_edges: int
    num_synonymy_edges: int


class HippoRAGClient:
    """
    High-level client for HippoRAG operations.

    Provides simplified methods for:
    - Document indexing with knowledge graph construction
    - Multi-hop retrieval with Personalized PageRank
    - RAG-enhanced question answering
    - Knowledge graph inspection and export
    """

    def __init__(
        self,
        save_dir: str = "outputs/hipporag",
        llm_model: str = "gpt-4o-mini",
        embedding_model: str = "text-embedding-3-small",
        llm_base_url: Optional[str] = None,
        embedding_base_url: Optional[str] = None,
        azure_endpoint: Optional[str] = None,
        damping: float = 0.5,
        linking_top_k: int = 5,
        retrieval_top_k: int = 200,
        qa_top_k: int = 5,
        force_rebuild: bool = False,
        verbose: bool = False
    ):
        """
        Initialize HippoRAG client.

        Args:
            save_dir: Directory for storing index artifacts
            llm_model: LLM model name for extraction and QA
            embedding_model: Model for entity/passage embeddings
            llm_base_url: Optional custom LLM API endpoint
            embedding_base_url: Optional custom embedding API endpoint
            azure_endpoint: Optional Azure OpenAI endpoint
            damping: PPR damping factor (0-1, higher = trust seeds more)
            linking_top_k: Number of facts to use as PPR seeds
            retrieval_top_k: Total documents to retrieve
            qa_top_k: Documents fed to QA reader
            force_rebuild: Force rebuild of index from scratch
            verbose: Enable verbose logging
        """
        self.save_dir = save_dir
        self.llm_model = llm_model
        self.embedding_model = embedding_model
        self.llm_base_url = llm_base_url
        self.embedding_base_url = embedding_base_url
        self.azure_endpoint = azure_endpoint
        self.damping = damping
        self.linking_top_k = linking_top_k
        self.retrieval_top_k = retrieval_top_k
        self.qa_top_k = qa_top_k
        self.force_rebuild = force_rebuild
        self.verbose = verbose

        self._hipporag = None
        self._initialized = False

        if verbose:
            logging.basicConfig(level=logging.DEBUG)
        else:
            logging.basicConfig(level=logging.INFO)

    def _ensure_initialized(self):
        """Lazily initialize HippoRAG instance."""
        if self._initialized:
            return

        try:
            from hipporag import HippoRAG
            from hipporag.utils.config_utils import BaseConfig
        except ImportError:
            raise ImportError(
                "HippoRAG not installed. Install with: pip install hipporag\n"
                "Or clone from: https://github.com/OSU-NLP-Group/HippoRAG"
            )

        config = BaseConfig(
            llm_name=self.llm_model,
            embedding_model_name=self.embedding_model,
            llm_base_url=self.llm_base_url,
            embedding_base_url=self.embedding_base_url,
            azure_endpoint=self.azure_endpoint,
            damping=self.damping,
            linking_top_k=self.linking_top_k,
            retrieval_top_k=self.retrieval_top_k,
            qa_top_k=self.qa_top_k,
            force_index_from_scratch=self.force_rebuild,
            force_openie_from_scratch=self.force_rebuild
        )

        self._hipporag = HippoRAG(
            global_config=config,
            save_dir=self.save_dir
        )
        self._initialized = True
        logger.info(f"HippoRAG initialized with save_dir: {self.save_dir}")

    @property
    def hipporag(self):
        """Access the underlying HippoRAG instance."""
        self._ensure_initialized()
        return self._hipporag

    # -------------------------------------------------------------------------
    # Document Indexing
    # -------------------------------------------------------------------------

    def index_documents(self, documents: List[str]) -> Dict[str, Any]:
        """
        Index documents into the knowledge graph.

        This performs:
        1. Named Entity Recognition (NER)
        2. Triple extraction (subject, predicate, object)
        3. Knowledge graph construction
        4. Embedding generation for passages, entities, and facts

        Args:
            documents: List of text documents to index

        Returns:
            Dictionary with indexing statistics
        """
        self._ensure_initialized()

        logger.info(f"Indexing {len(documents)} documents...")
        self.hipporag.index(docs=documents)

        stats = self.get_graph_stats()
        return {
            "documents_indexed": len(documents),
            "entities_extracted": stats.num_entities,
            "facts_extracted": stats.num_facts,
            "graph_edges": stats.num_edges
        }

    def index_file(self, filepath: str, chunk_size: Optional[int] = None) -> Dict[str, Any]:
        """
        Index documents from a file.

        Args:
            filepath: Path to text file (one document per line) or JSON file
            chunk_size: Optional max characters per chunk

        Returns:
            Dictionary with indexing statistics
        """
        path = Path(filepath)
        if not path.exists():
            raise FileNotFoundError(f"File not found: {filepath}")

        if path.suffix == '.json':
            with open(path, 'r') as f:
                data = json.load(f)
                if isinstance(data, list):
                    documents = data
                elif isinstance(data, dict) and 'documents' in data:
                    documents = data['documents']
                else:
                    raise ValueError("JSON must be a list or have 'documents' key")
        else:
            with open(path, 'r') as f:
                documents = [line.strip() for line in f if line.strip()]

        if chunk_size:
            documents = self._chunk_documents(documents, chunk_size)

        return self.index_documents(documents)

    def _chunk_documents(self, documents: List[str], max_size: int) -> List[str]:
        """Split documents into chunks of max_size characters."""
        chunks = []
        for doc in documents:
            if len(doc) <= max_size:
                chunks.append(doc)
            else:
                # Simple sentence-aware chunking
                sentences = doc.replace('. ', '.|').split('|')
                current_chunk = []
                current_size = 0

                for sentence in sentences:
                    if current_size + len(sentence) > max_size and current_chunk:
                        chunks.append(' '.join(current_chunk))
                        current_chunk = []
                        current_size = 0
                    current_chunk.append(sentence)
                    current_size += len(sentence) + 1

                if current_chunk:
                    chunks.append(' '.join(current_chunk))

        return chunks

    def delete_documents(self, documents: List[str]) -> Dict[str, Any]:
        """
        Delete documents from the index.

        Args:
            documents: List of exact document texts to delete

        Returns:
            Dictionary with deletion statistics
        """
        self._ensure_initialized()

        before_stats = self.get_graph_stats()
        self.hipporag.delete(docs_to_delete=documents)
        after_stats = self.get_graph_stats()

        return {
            "documents_deleted": before_stats.num_passages - after_stats.num_passages,
            "entities_removed": before_stats.num_entities - after_stats.num_entities,
            "facts_removed": before_stats.num_facts - after_stats.num_facts
        }

    # -------------------------------------------------------------------------
    # Retrieval
    # -------------------------------------------------------------------------

    def query(
        self,
        question: str,
        top_k: Optional[int] = None,
        include_scores: bool = True
    ) -> QueryResult:
        """
        Retrieve relevant documents for a question.

        Uses HippoRAG's multi-hop retrieval with:
        1. Fact matching via embedding similarity
        2. Recognition memory filtering
        3. Personalized PageRank graph traversal

        Args:
            question: The query string
            top_k: Number of documents to retrieve (default: retrieval_top_k)
            include_scores: Include relevance scores in result

        Returns:
            QueryResult with retrieved documents and scores
        """
        self._ensure_initialized()

        num_to_retrieve = top_k or self.retrieval_top_k
        results = self.hipporag.retrieve(
            queries=[question],
            num_to_retrieve=num_to_retrieve
        )

        result = results[0]
        return QueryResult(
            question=result.question,
            documents=result.docs,
            scores=list(result.doc_scores) if include_scores else [],
            metadata={"method": "hipporag_ppr"}
        )

    def batch_query(
        self,
        questions: List[str],
        top_k: Optional[int] = None
    ) -> List[QueryResult]:
        """
        Batch retrieve for multiple questions.

        Args:
            questions: List of query strings
            top_k: Number of documents per query

        Returns:
            List of QueryResult objects
        """
        self._ensure_initialized()

        num_to_retrieve = top_k or self.retrieval_top_k
        results = self.hipporag.retrieve(
            queries=questions,
            num_to_retrieve=num_to_retrieve
        )

        return [
            QueryResult(
                question=r.question,
                documents=r.docs,
                scores=list(r.doc_scores),
                metadata={"method": "hipporag_ppr"}
            )
            for r in results
        ]

    def query_dpr(
        self,
        question: str,
        top_k: Optional[int] = None
    ) -> QueryResult:
        """
        Dense passage retrieval without graph traversal.

        Useful as a baseline or when graph-based retrieval is not needed.

        Args:
            question: The query string
            top_k: Number of documents to retrieve

        Returns:
            QueryResult with retrieved documents
        """
        self._ensure_initialized()

        num_to_retrieve = top_k or self.retrieval_top_k
        results = self.hipporag.retrieve_dpr(
            queries=[question],
            num_to_retrieve=num_to_retrieve
        )

        result = results[0]
        return QueryResult(
            question=result.question,
            documents=result.docs,
            scores=list(result.doc_scores),
            metadata={"method": "dpr_only"}
        )

    # -------------------------------------------------------------------------
    # Question Answering
    # -------------------------------------------------------------------------

    def ask(
        self,
        question: str,
        top_k: Optional[int] = None
    ) -> QueryResult:
        """
        Answer a question using RAG.

        Combines retrieval with LLM-based answer generation.

        Args:
            question: The question to answer
            top_k: Number of context documents

        Returns:
            QueryResult with answer and supporting documents
        """
        self._ensure_initialized()

        # Override qa_top_k if provided
        if top_k:
            self.hipporag.global_config.qa_top_k = top_k

        solutions, responses, metadata = self.hipporag.rag_qa(queries=[question])

        solution = solutions[0]
        return QueryResult(
            question=solution.question,
            documents=solution.docs,
            scores=list(solution.doc_scores) if hasattr(solution, 'doc_scores') else [],
            answer=solution.answer,
            metadata={"raw_response": responses[0], "llm_metadata": metadata[0]}
        )

    def batch_ask(
        self,
        questions: List[str],
        top_k: Optional[int] = None
    ) -> List[QueryResult]:
        """
        Batch question answering.

        Args:
            questions: List of questions
            top_k: Number of context documents per question

        Returns:
            List of QueryResult objects with answers
        """
        self._ensure_initialized()

        if top_k:
            self.hipporag.global_config.qa_top_k = top_k

        solutions, responses, metadata = self.hipporag.rag_qa(queries=questions)

        return [
            QueryResult(
                question=sol.question,
                documents=sol.docs,
                scores=list(sol.doc_scores) if hasattr(sol, 'doc_scores') else [],
                answer=sol.answer,
                metadata={"raw_response": resp, "llm_metadata": meta}
            )
            for sol, resp, meta in zip(solutions, responses, metadata)
        ]

    # -------------------------------------------------------------------------
    # Knowledge Graph Operations
    # -------------------------------------------------------------------------

    def get_graph_stats(self) -> GraphStats:
        """
        Get statistics about the knowledge graph.

        Returns:
            GraphStats with entity, passage, fact, and edge counts
        """
        self._ensure_initialized()

        info = self.hipporag.get_graph_info()
        return GraphStats(
            num_entities=info.get('num_phrase_nodes', 0),
            num_passages=info.get('num_passage_nodes', 0),
            num_facts=info.get('num_extracted_triples', 0),
            num_edges=info.get('num_total_triples', 0),
            num_synonymy_edges=info.get('num_synonymy_triples', 0)
        )

    def get_entities(self, limit: Optional[int] = None) -> List[str]:
        """
        Get all extracted entities.

        Args:
            limit: Max number of entities to return

        Returns:
            List of entity strings
        """
        self._ensure_initialized()

        entity_store = self.hipporag.entity_embedding_store
        entity_ids = entity_store.get_all_ids()

        if limit:
            entity_ids = entity_ids[:limit]

        return [entity_store.get_row(eid)['content'] for eid in entity_ids]

    def get_facts(self, limit: Optional[int] = None) -> List[Tuple[str, str, str]]:
        """
        Get all extracted facts (triples).

        Args:
            limit: Max number of facts to return

        Returns:
            List of (subject, predicate, object) tuples
        """
        self._ensure_initialized()

        fact_store = self.hipporag.fact_embedding_store
        fact_ids = fact_store.get_all_ids()

        if limit:
            fact_ids = fact_ids[:limit]

        facts = []
        for fid in fact_ids:
            content = fact_store.get_row(fid)['content']
            try:
                triple = eval(content)
                if isinstance(triple, (list, tuple)) and len(triple) == 3:
                    facts.append(tuple(triple))
            except:
                pass

        return facts

    def get_passages(self, limit: Optional[int] = None) -> List[str]:
        """
        Get all indexed passages.

        Args:
            limit: Max number of passages to return

        Returns:
            List of passage strings
        """
        self._ensure_initialized()

        chunk_store = self.hipporag.chunk_embedding_store
        chunk_ids = chunk_store.get_all_ids()

        if limit:
            chunk_ids = chunk_ids[:limit]

        return [chunk_store.get_row(cid)['content'] for cid in chunk_ids]

    def export_graph(self, filepath: str, format: str = "graphml") -> str:
        """
        Export knowledge graph to file.

        Args:
            filepath: Output file path
            format: Export format ('graphml', 'pickle', 'edgelist')

        Returns:
            Path to exported file
        """
        self._ensure_initialized()

        graph = self.hipporag.graph

        if format == "graphml":
            graph.write_graphml(filepath)
        elif format == "pickle":
            graph.write_pickle(filepath)
        elif format == "edgelist":
            graph.write_edgelist(filepath)
        else:
            raise ValueError(f"Unsupported format: {format}")

        logger.info(f"Graph exported to {filepath}")
        return filepath

    def get_openie_results(self) -> Dict[str, Any]:
        """
        Get raw OpenIE extraction results.

        Returns:
            Dictionary with extraction data and statistics
        """
        self._ensure_initialized()

        openie_path = self.hipporag.openie_results_path
        if os.path.exists(openie_path):
            with open(openie_path, 'r') as f:
                return json.load(f)
        return {"docs": [], "avg_ent_chars": 0, "avg_ent_words": 0}

    # -------------------------------------------------------------------------
    # Configuration
    # -------------------------------------------------------------------------

    def set_damping(self, damping: float):
        """Update PPR damping factor."""
        self.damping = damping
        if self._initialized:
            self.hipporag.global_config.damping = damping

    def set_linking_top_k(self, top_k: int):
        """Update number of seed facts for PPR."""
        self.linking_top_k = top_k
        if self._initialized:
            self.hipporag.global_config.linking_top_k = top_k

    def get_config(self) -> Dict[str, Any]:
        """Get current configuration."""
        return {
            "save_dir": self.save_dir,
            "llm_model": self.llm_model,
            "embedding_model": self.embedding_model,
            "damping": self.damping,
            "linking_top_k": self.linking_top_k,
            "retrieval_top_k": self.retrieval_top_k,
            "qa_top_k": self.qa_top_k,
            "initialized": self._initialized
        }

    # -------------------------------------------------------------------------
    # Evaluation
    # -------------------------------------------------------------------------

    def evaluate_retrieval(
        self,
        questions: List[str],
        gold_docs: List[List[str]],
        k_list: List[int] = None
    ) -> Dict[str, float]:
        """
        Evaluate retrieval performance.

        Args:
            questions: List of query strings
            gold_docs: List of gold document lists per query
            k_list: List of k values for recall@k

        Returns:
            Dictionary with recall@k metrics
        """
        self._ensure_initialized()

        k_list = k_list or [1, 5, 10, 20, 50]

        results, metrics = self.hipporag.retrieve(
            queries=questions,
            gold_docs=gold_docs
        )

        return {f"recall@{k}": metrics.get(f"recall@{k}", 0) for k in k_list}

    def evaluate_qa(
        self,
        questions: List[str],
        gold_answers: List[List[str]],
        gold_docs: Optional[List[List[str]]] = None
    ) -> Dict[str, float]:
        """
        Evaluate QA performance.

        Args:
            questions: List of questions
            gold_answers: List of acceptable answer lists per question
            gold_docs: Optional gold documents for retrieval evaluation

        Returns:
            Dictionary with EM and F1 metrics
        """
        self._ensure_initialized()

        if gold_docs:
            solutions, responses, meta, retrieval_metrics, qa_metrics = \
                self.hipporag.rag_qa(
                    queries=questions,
                    gold_docs=gold_docs,
                    gold_answers=gold_answers
                )
            return {**retrieval_metrics, **qa_metrics}
        else:
            # QA-only evaluation requires gold_docs for full pipeline
            raise ValueError("gold_docs required for QA evaluation")


# -----------------------------------------------------------------------------
# Convenience Functions
# -----------------------------------------------------------------------------

def create_client(
    project_name: str = "default",
    llm: str = "gpt-4o-mini",
    **kwargs
) -> HippoRAGClient:
    """
    Create a HippoRAG client with sensible defaults.

    Args:
        project_name: Name for the project (used in save_dir)
        llm: LLM model to use
        **kwargs: Additional arguments passed to HippoRAGClient

    Returns:
        Configured HippoRAGClient instance
    """
    save_dir = f"outputs/{project_name}"
    return HippoRAGClient(save_dir=save_dir, llm_model=llm, **kwargs)


def quick_index_and_query(
    documents: List[str],
    query: str,
    **kwargs
) -> QueryResult:
    """
    Quick one-liner for indexing and querying.

    Args:
        documents: Documents to index
        query: Question to answer
        **kwargs: Arguments passed to HippoRAGClient

    Returns:
        QueryResult with answer
    """
    client = HippoRAGClient(**kwargs)
    client.index_documents(documents)
    return client.ask(query)


# -----------------------------------------------------------------------------
# CLI Entry Point
# -----------------------------------------------------------------------------

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="HippoRAG CLI")
    parser.add_argument("command", choices=["index", "query", "ask", "stats"])
    parser.add_argument("--save-dir", default="outputs/cli")
    parser.add_argument("--llm", default="gpt-4o-mini")
    parser.add_argument("--file", help="File to index")
    parser.add_argument("--question", "-q", help="Question to query/ask")
    parser.add_argument("--top-k", type=int, default=5)

    args = parser.parse_args()

    client = HippoRAGClient(
        save_dir=args.save_dir,
        llm_model=args.llm
    )

    if args.command == "index" and args.file:
        result = client.index_file(args.file)
        print(f"Indexed: {result}")

    elif args.command == "query" and args.question:
        result = client.query(args.question, top_k=args.top_k)
        print(f"Question: {result.question}")
        for i, (doc, score) in enumerate(zip(result.documents[:args.top_k], result.scores)):
            print(f"{i+1}. [{score:.4f}] {doc[:100]}...")

    elif args.command == "ask" and args.question:
        result = client.ask(args.question, top_k=args.top_k)
        print(f"Question: {result.question}")
        print(f"Answer: {result.answer}")
        print(f"\nSupporting documents:")
        for doc in result.documents[:3]:
            print(f"  - {doc[:100]}...")

    elif args.command == "stats":
        stats = client.get_graph_stats()
        print(f"Entities: {stats.num_entities}")
        print(f"Passages: {stats.num_passages}")
        print(f"Facts: {stats.num_facts}")
        print(f"Edges: {stats.num_edges}")
