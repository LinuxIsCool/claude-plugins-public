---
name: recipes-use-cases
description: Production-ready HippoRAG implementation patterns. Covers enterprise knowledge management, research synthesis, conversational memory, and domain-specific applications with complete code examples.
allowed-tools: Read, Glob, Grep, Bash, WebFetch
---

# HippoRAG Recipes & Use Cases

Production-ready patterns for real-world HippoRAG deployments.

## Use Case Categories

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      HippoRAG Use Case Landscape                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ENTERPRISE                    RESEARCH                 PERSONAL            │
│  ┌────────────┐               ┌────────────┐           ┌────────────┐      │
│  │ Knowledge  │               │ Literature │           │Conversation│      │
│  │ Management │               │  Synthesis │           │   Memory   │      │
│  └────────────┘               └────────────┘           └────────────┘      │
│  ┌────────────┐               ┌────────────┐           ┌────────────┐      │
│  │  Customer  │               │   Multi-   │           │  Learning  │      │
│  │  Support   │               │   Source   │           │   Journal  │      │
│  └────────────┘               └────────────┘           └────────────┘      │
│  ┌────────────┐               ┌────────────┐           ┌────────────┐      │
│  │  Legal     │               │   Patent   │           │    Task    │      │
│  │  Discovery │               │   Search   │           │   Memory   │      │
│  └────────────┘               └────────────┘           └────────────┘      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Recipe 1: Enterprise Knowledge Management

### Problem

Large organizations have knowledge scattered across wikis, documents, Slack, and people's heads. Finding "who knows what" requires multi-hop reasoning.

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                Enterprise Knowledge Graph                    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Sources:                                                    │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ Confluence│  │  Slack   │  │  GitHub  │  │  Notion  │   │
│  └─────┬────┘  └─────┬────┘  └─────┬────┘  └─────┬────┘   │
│        │             │             │             │          │
│        └─────────────┴─────────────┴─────────────┘          │
│                          │                                   │
│                          ▼                                   │
│                   ┌─────────────┐                           │
│                   │  HippoRAG   │                           │
│                   │   Indexer   │                           │
│                   └──────┬──────┘                           │
│                          │                                   │
│                          ▼                                   │
│              ┌───────────────────────┐                      │
│              │     Knowledge Graph   │                      │
│              │  ┌─────────────────┐  │                      │
│              │  │ People ──────┐  │  │                      │
│              │  │ Projects ────┼──│  │                      │
│              │  │ Technologies │  │  │                      │
│              │  │ Documents ───┘  │  │                      │
│              │  └─────────────────┘  │                      │
│              └───────────────────────┘                      │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Implementation

```python
from hipporag import HippoRAG
from datetime import datetime
import json

class EnterpriseKnowledgeBase:
    def __init__(self, neo4j_uri, neo4j_password):
        self.hippo = HippoRAG(
            backend="neo4j",
            connection=neo4j_uri,
            username="neo4j",
            password=neo4j_password,
            llm_model="gpt-4o-mini",
            embedding_model="text-embedding-3-small",
            consolidation_enabled=True,
            consolidation_interval=86400  # Daily
        )

    async def index_confluence(self, confluence_client):
        """Index Confluence pages."""
        pages = confluence_client.get_all_pages()

        for page in pages:
            await self.hippo.add_episode(
                content=f"{page.title}\n\n{page.content}",
                source=f"confluence:{page.id}",
                metadata={
                    "author": page.author,
                    "space": page.space,
                    "updated": page.updated_at.isoformat(),
                    "type": "documentation"
                }
            )

    async def index_slack(self, slack_client, channels):
        """Index Slack conversations (threads with context)."""
        for channel in channels:
            threads = slack_client.get_threads(channel, days=90)

            for thread in threads:
                # Combine thread messages into coherent episode
                content = self._format_thread(thread)
                participants = [msg.user for msg in thread.messages]

                await self.hippo.add_episode(
                    content=content,
                    source=f"slack:{channel}:{thread.ts}",
                    metadata={
                        "participants": participants,
                        "channel": channel,
                        "date": thread.date.isoformat(),
                        "type": "discussion"
                    }
                )

    async def index_github(self, github_client, repos):
        """Index GitHub READMEs and important discussions."""
        for repo in repos:
            # README
            readme = github_client.get_readme(repo)
            if readme:
                await self.hippo.add_episode(
                    content=readme,
                    source=f"github:{repo}:README",
                    metadata={"type": "code_documentation", "repo": repo}
                )

            # Important issues/PRs
            issues = github_client.get_issues(repo, labels=["important", "decision"])
            for issue in issues:
                await self.hippo.add_episode(
                    content=f"{issue.title}\n\n{issue.body}",
                    source=f"github:{repo}:issue:{issue.number}",
                    metadata={
                        "type": "discussion",
                        "repo": repo,
                        "author": issue.author
                    }
                )

    async def find_expert(self, topic: str) -> list[dict]:
        """Find people who know about a topic."""
        results = await self.hippo.search(
            f"Who knows about {topic}? Who has worked on {topic}?",
            top_k=30
        )

        # Extract people from results
        experts = {}
        for edge in results.edges:
            if edge.predicate in ["authored", "contributed", "discussed", "owns"]:
                person = edge.subject
                if person not in experts:
                    experts[person] = {"score": 0, "contexts": []}
                experts[person]["score"] += edge.score
                experts[person]["contexts"].append(edge.source)

        return sorted(
            [{"name": k, **v} for k, v in experts.items()],
            key=lambda x: -x["score"]
        )[:5]

    async def answer_question(self, question: str) -> dict:
        """Answer organizational questions with sources."""
        results = await self.hippo.search(question, top_k=20)

        return {
            "facts": [
                {
                    "fact": f"{e.subject} {e.predicate} {e.object}",
                    "source": e.source,
                    "confidence": e.score
                }
                for e in results.edges[:10]
            ],
            "sources": list(set(e.source for e in results.edges[:10])),
            "context": results.assemble_context(max_tokens=4000)
        }

    def _format_thread(self, thread) -> str:
        """Format Slack thread into coherent text."""
        lines = []
        for msg in thread.messages:
            lines.append(f"{msg.user}: {msg.text}")
        return "\n".join(lines)
```

### Example Queries

```python
kb = EnterpriseKnowledgeBase(neo4j_uri, password)

# Find expert
experts = await kb.find_expert("Kubernetes deployment")
# → [{"name": "alice", "score": 2.4, "contexts": ["confluence:123", "slack:devops:..."]}]

# Answer organizational question
answer = await kb.answer_question(
    "Who should I talk to about the authentication service Bob mentioned deprecating?"
)
# Multi-hop: Bob → mentioned → auth service → owned by → Carol
```

---

## Recipe 2: Research Literature Synthesis

### Problem

Researchers need to understand how papers relate, who built on whose work, and synthesize findings across dozens of papers.

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                  Research Knowledge Graph                    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Entity Types:                                               │
│  • Paper (title, abstract, year, venue)                      │
│  • Author (name, affiliation)                                │
│  • Method (technique, approach)                              │
│  • Dataset (name, domain)                                    │
│  • Finding (claim, result)                                   │
│                                                              │
│  Relation Types:                                             │
│  • CITES, BUILDS_ON, CONTRADICTS                            │
│  • AUTHORED_BY, INTRODUCES, EVALUATES_ON                    │
│  • OUTPERFORMS, USES_METHOD                                 │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Implementation

```python
from hipporag import HippoRAG
from typing import List, Dict
import arxiv

class ResearchSynthesizer:
    def __init__(self):
        self.hippo = HippoRAG(
            backend="neo4j",
            connection="bolt://localhost:7687",
            llm_model="gpt-4o",  # Better for academic text
            embedding_model="text-embedding-3-large",  # Higher dim for nuance
            consolidation_enabled=True
        )

    async def index_paper(self, paper: dict):
        """Index a research paper with structured extraction."""

        # Main content
        content = f"""
        Title: {paper['title']}
        Authors: {', '.join(paper['authors'])}
        Year: {paper['year']}
        Venue: {paper.get('venue', 'Unknown')}

        Abstract: {paper['abstract']}
        """

        await self.hippo.add_episode(
            content=content,
            source=f"paper:{paper['id']}",
            metadata={
                "type": "paper",
                "year": paper['year'],
                "venue": paper.get('venue')
            }
        )

        # If we have full text, index key sections
        if 'full_text' in paper:
            sections = self._extract_key_sections(paper['full_text'])

            for section_name, section_text in sections.items():
                await self.hippo.add_episode(
                    content=f"[{paper['title']} - {section_name}]\n{section_text}",
                    source=f"paper:{paper['id']}:{section_name}",
                    metadata={"type": "section", "paper_id": paper['id']}
                )

    async def index_from_arxiv(self, query: str, max_results: int = 50):
        """Index papers from arXiv search."""
        search = arxiv.Search(
            query=query,
            max_results=max_results,
            sort_by=arxiv.SortCriterion.Relevance
        )

        for result in search.results():
            paper = {
                "id": result.entry_id,
                "title": result.title,
                "authors": [a.name for a in result.authors],
                "abstract": result.summary,
                "year": result.published.year,
                "venue": "arXiv"
            }
            await self.index_paper(paper)

    async def trace_research_lineage(self, paper_title: str) -> dict:
        """Find what a paper builds on and what built on it."""
        results = await self.hippo.search(
            f"What does {paper_title} build on? What papers cite or extend {paper_title}?",
            top_k=30
        )

        lineage = {
            "builds_on": [],
            "built_upon_by": [],
            "related_methods": []
        }

        for edge in results.edges:
            if edge.predicate in ["cites", "builds_on", "extends"]:
                if paper_title.lower() in edge.subject.lower():
                    lineage["builds_on"].append(edge.object)
                else:
                    lineage["built_upon_by"].append(edge.subject)
            elif edge.predicate in ["uses_method", "introduces"]:
                lineage["related_methods"].append({
                    "method": edge.object,
                    "paper": edge.subject
                })

        return lineage

    async def compare_methods(self, methods: List[str]) -> dict:
        """Compare multiple research methods."""
        query = f"Compare {' and '.join(methods)}. What are their differences, advantages, and when to use each?"

        results = await self.hippo.search(query, top_k=40)

        comparison = {method: {"papers": [], "findings": []} for method in methods}

        for edge in results.edges:
            for method in methods:
                if method.lower() in edge.subject.lower() or method.lower() in edge.object.lower():
                    if edge.predicate in ["achieves", "outperforms", "reports"]:
                        comparison[method]["findings"].append(
                            f"{edge.subject} {edge.predicate} {edge.object}"
                        )
                    elif edge.predicate in ["introduced_by", "used_by"]:
                        comparison[method]["papers"].append(edge.source)

        return comparison

    async def find_research_gaps(self, topic: str) -> list:
        """Identify potential research gaps in a topic."""
        # Find what exists
        existing = await self.hippo.search(
            f"What has been done in {topic}?",
            top_k=30
        )

        # Find limitations mentioned
        limitations = await self.hippo.search(
            f"Limitations, future work, and open problems in {topic}",
            top_k=20
        )

        gaps = []
        for edge in limitations.edges:
            if edge.predicate in ["has_limitation", "lacks", "needs", "future_work"]:
                gaps.append({
                    "gap": edge.object,
                    "mentioned_in": edge.source,
                    "context": edge.subject
                })

        return gaps

    def _extract_key_sections(self, full_text: str) -> dict:
        """Extract introduction, method, results from paper."""
        # Simplified - would use better parsing in production
        sections = {}
        current_section = "other"
        current_text = []

        for line in full_text.split('\n'):
            lower = line.lower().strip()
            if lower in ["introduction", "1. introduction", "1 introduction"]:
                if current_text:
                    sections[current_section] = '\n'.join(current_text)
                current_section = "introduction"
                current_text = []
            elif lower in ["method", "methodology", "2. method", "approach"]:
                sections[current_section] = '\n'.join(current_text)
                current_section = "method"
                current_text = []
            elif lower in ["results", "experiments", "evaluation"]:
                sections[current_section] = '\n'.join(current_text)
                current_section = "results"
                current_text = []
            elif lower in ["conclusion", "discussion"]:
                sections[current_section] = '\n'.join(current_text)
                current_section = "conclusion"
                current_text = []
            else:
                current_text.append(line)

        sections[current_section] = '\n'.join(current_text)
        return {k: v for k, v in sections.items() if v.strip()}
```

### Example Queries

```python
synth = ResearchSynthesizer()

# Build research lineage
lineage = await synth.trace_research_lineage("Attention Is All You Need")
# → builds_on: ["Sequence to Sequence Learning", "Neural Machine Translation"]
# → built_upon_by: ["BERT", "GPT", "T5", ...]

# Compare methods
comparison = await synth.compare_methods(["Transformer", "LSTM", "CNN"])

# Find gaps
gaps = await synth.find_research_gaps("multi-hop question answering")
```

---

## Recipe 3: Conversational Memory

### Problem

AI assistants need persistent memory across conversations - remembering preferences, past interactions, and building user models.

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│               Conversational Memory System                   │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  User Session                   HippoRAG Memory             │
│  ┌──────────┐                  ┌──────────────────┐         │
│  │ Message 1│───────────────►  │ Episode 1        │         │
│  │ Message 2│───────────────►  │ Episode 2        │         │
│  │    ...   │                  │   ...            │         │
│  └──────────┘                  └────────┬─────────┘         │
│                                         │                    │
│  New Session                            ▼                    │
│  ┌──────────┐                  ┌──────────────────┐         │
│  │ Query    │───PPR Search───► │ Relevant Memory  │         │
│  └──────────┘                  └──────────────────┘         │
│       │                                 │                    │
│       └────────────────┬────────────────┘                   │
│                        │                                     │
│                        ▼                                     │
│               ┌────────────────┐                            │
│               │ Context-Aware  │                            │
│               │   Response     │                            │
│               └────────────────┘                            │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Implementation

```python
from hipporag import HippoRAG
from datetime import datetime
import hashlib

class ConversationalMemory:
    def __init__(self, user_id: str):
        self.user_id = user_id
        self.hippo = HippoRAG(
            backend="kuzu",  # Embedded for personal use
            connection=f"./memory/{user_id}/",
            llm_model="gpt-4o-mini",
            embedding_model="text-embedding-3-small",
            consolidation_enabled=True,
            consolidation_interval=3600  # Hourly
        )
        self.session_id = None

    def start_session(self):
        """Start a new conversation session."""
        self.session_id = hashlib.md5(
            f"{self.user_id}:{datetime.now().isoformat()}".encode()
        ).hexdigest()[:8]
        return self.session_id

    async def remember(self, user_message: str, assistant_response: str):
        """Store a conversation turn in memory."""
        content = f"""
        User said: {user_message}
        Assistant responded: {assistant_response[:500]}...
        """

        await self.hippo.add_episode(
            content=content,
            source=f"conversation:{self.session_id}",
            metadata={
                "session_id": self.session_id,
                "timestamp": datetime.now().isoformat(),
                "type": "conversation"
            }
        )

    async def remember_preference(self, preference: str, context: str = ""):
        """Store a user preference."""
        content = f"""
        User preference: {preference}
        Context: {context}
        """

        await self.hippo.add_episode(
            content=content,
            source=f"preference:{self.session_id}",
            metadata={
                "type": "preference",
                "timestamp": datetime.now().isoformat()
            }
        )

    async def remember_fact(self, fact: str, source: str = "user"):
        """Store a fact about the user."""
        await self.hippo.add_episode(
            content=f"User fact: {fact}",
            source=f"fact:{source}",
            metadata={
                "type": "user_fact",
                "timestamp": datetime.now().isoformat()
            }
        )

    async def recall(self, query: str, context_tokens: int = 2000) -> dict:
        """Recall relevant memories for a query."""
        results = await self.hippo.search(query, top_k=15)

        # Categorize memories
        memories = {
            "conversations": [],
            "preferences": [],
            "facts": []
        }

        for edge in results.edges:
            source = edge.source
            if source.startswith("conversation:"):
                memories["conversations"].append({
                    "content": f"{edge.subject} {edge.predicate} {edge.object}",
                    "session": source.split(":")[1],
                    "relevance": edge.score
                })
            elif source.startswith("preference:"):
                memories["preferences"].append({
                    "content": f"{edge.subject} {edge.predicate} {edge.object}",
                    "relevance": edge.score
                })
            elif source.startswith("fact:"):
                memories["facts"].append({
                    "content": f"{edge.subject} {edge.predicate} {edge.object}",
                    "relevance": edge.score
                })

        return {
            "memories": memories,
            "context": results.assemble_context(max_tokens=context_tokens)
        }

    async def get_user_model(self) -> dict:
        """Build a model of the user from memory."""
        # Query for preferences
        prefs = await self.hippo.search(
            "User preferences, likes, dislikes, interests",
            top_k=20
        )

        # Query for facts
        facts = await self.hippo.search(
            "Facts about user: name, location, job, relationships",
            top_k=20
        )

        # Query for patterns
        patterns = await self.hippo.search(
            "User behavior patterns, common requests, typical questions",
            top_k=15
        )

        return {
            "preferences": [
                f"{e.subject} {e.predicate} {e.object}"
                for e in prefs.edges[:10]
            ],
            "facts": [
                f"{e.subject} {e.predicate} {e.object}"
                for e in facts.edges[:10]
            ],
            "patterns": [
                f"{e.subject} {e.predicate} {e.object}"
                for e in patterns.edges[:10]
            ]
        }


# Usage with an LLM
class MemoryAwareAssistant:
    def __init__(self, user_id: str):
        self.memory = ConversationalMemory(user_id)
        self.llm = OpenAI()

    async def chat(self, user_message: str) -> str:
        # Recall relevant memories
        memories = await self.memory.recall(user_message)

        # Build prompt with memory context
        system_prompt = f"""You are a helpful assistant with memory of past conversations.

Relevant memories:
{memories['context']}

Use these memories to provide personalized, contextual responses.
"""

        response = self.llm.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message}
            ]
        )

        assistant_response = response.choices[0].message.content

        # Store this conversation turn
        await self.memory.remember(user_message, assistant_response)

        return assistant_response
```

### Example Usage

```python
assistant = MemoryAwareAssistant("alice")
assistant.memory.start_session()

# First conversation
response = await assistant.chat("I prefer dark mode in all my apps")
# Memory stores: (User, prefers, dark mode)

# Later conversation (different session)
assistant.memory.start_session()
response = await assistant.chat("Can you recommend an IDE theme?")
# Recalls preference for dark mode, suggests dark themes
```

---

## Recipe 4: Multi-Source Intelligence

### Problem

Investigative scenarios require connecting information across disparate sources - documents, communications, financial records.

### Implementation

```python
from hipporag import HippoRAG
from typing import List, Dict
from datetime import datetime

class IntelligenceGraph:
    def __init__(self):
        self.hippo = HippoRAG(
            backend="neo4j",
            connection="bolt://localhost:7687",
            llm_model="gpt-4o",
            embedding_model="text-embedding-3-large"
        )

    async def index_documents(self, documents: List[dict], doc_type: str):
        """Index documents with provenance tracking."""
        for doc in documents:
            await self.hippo.add_episode(
                content=doc['content'],
                source=f"{doc_type}:{doc['id']}",
                metadata={
                    "type": doc_type,
                    "date": doc.get('date'),
                    "classification": doc.get('classification', 'unclassified')
                }
            )

    async def trace_connections(self, entity: str, depth: int = 3) -> dict:
        """Trace all connections to an entity."""
        results = await self.hippo.search(
            f"All connections, relationships, and mentions of {entity}",
            top_k=50,
            damping_factor=0.9  # Explore further
        )

        connections = {
            "direct": [],
            "indirect": [],
            "sources": set()
        }

        for edge in results.edges:
            connection = {
                "from": edge.subject,
                "relation": edge.predicate,
                "to": edge.object,
                "source": edge.source,
                "confidence": edge.score
            }

            if entity.lower() in edge.subject.lower() or entity.lower() in edge.object.lower():
                connections["direct"].append(connection)
            else:
                connections["indirect"].append(connection)

            connections["sources"].add(edge.source)

        connections["sources"] = list(connections["sources"])
        return connections

    async def find_patterns(self, entities: List[str]) -> dict:
        """Find patterns connecting multiple entities."""
        # Query for connections between entities
        query = f"How are {', '.join(entities)} connected? What links them?"

        results = await self.hippo.search(query, top_k=40)

        # Look for paths that include multiple target entities
        patterns = []
        for path in results.paths:
            entities_in_path = set()
            for step in path.steps:
                for entity in entities:
                    if entity.lower() in step.entity.lower():
                        entities_in_path.add(entity)

            if len(entities_in_path) >= 2:
                patterns.append({
                    "path": [s.entity for s in path.steps],
                    "entities_connected": list(entities_in_path),
                    "score": path.score
                })

        return {
            "patterns": sorted(patterns, key=lambda x: -len(x["entities_connected"])),
            "total_connections": len(results.edges)
        }

    async def timeline(self, entity: str) -> list:
        """Build a timeline of events for an entity."""
        results = await self.hippo.search(
            f"Timeline of events involving {entity}",
            top_k=50
        )

        events = []
        for edge in results.edges:
            # Extract date from metadata if available
            events.append({
                "event": f"{edge.subject} {edge.predicate} {edge.object}",
                "source": edge.source,
                "date": edge.metadata.get("date") if edge.metadata else None
            })

        # Sort by date if available
        return sorted(events, key=lambda x: x.get("date") or "9999")
```

---

## Recipe 5: Learning Management System

### Problem

Track learning progress, connect concepts across courses, and provide personalized learning paths.

### Implementation

```python
from hipporag import HippoRAG
from typing import List

class LearningKnowledgeBase:
    def __init__(self, learner_id: str):
        self.learner_id = learner_id
        self.hippo = HippoRAG(
            backend="kuzu",
            connection=f"./learning/{learner_id}/",
            consolidation_enabled=True,
            consolidation_interval=86400
        )

    async def learn_concept(self, concept: str, content: str, source: str):
        """Record learning a new concept."""
        await self.hippo.add_episode(
            content=f"""
            Concept: {concept}

            {content}

            Learned on: {datetime.now().isoformat()}
            """,
            source=f"learning:{source}",
            metadata={
                "type": "concept",
                "learner": self.learner_id,
                "mastery_level": 1
            }
        )

    async def practice_concept(self, concept: str, result: str):
        """Record practice/review of a concept."""
        await self.hippo.add_episode(
            content=f"""
            Practice: {concept}
            Result: {result}
            Date: {datetime.now().isoformat()}
            """,
            source=f"practice:{concept}",
            metadata={"type": "practice"}
        )

    async def find_prerequisites(self, concept: str) -> list:
        """Find prerequisite concepts for learning something new."""
        results = await self.hippo.search(
            f"Prerequisites and foundational concepts for {concept}",
            top_k=20
        )

        prerequisites = []
        for edge in results.edges:
            if edge.predicate in ["requires", "builds_on", "assumes_knowledge_of"]:
                prerequisites.append({
                    "concept": edge.object,
                    "confidence": edge.score
                })

        return prerequisites

    async def suggest_next(self) -> list:
        """Suggest next concepts to learn based on current knowledge."""
        # Get current knowledge
        current = await self.hippo.search(
            "Concepts I have learned",
            top_k=50
        )

        known_concepts = set()
        for edge in current.edges:
            if edge.predicate in ["learned", "knows", "understands"]:
                known_concepts.add(edge.object.lower())

        # Find adjacent concepts
        adjacent = await self.hippo.search(
            "Concepts that build on what I know",
            top_k=30
        )

        suggestions = []
        for edge in adjacent.edges:
            if edge.predicate in ["enables", "leads_to", "prepares_for"]:
                if edge.object.lower() not in known_concepts:
                    suggestions.append({
                        "concept": edge.object,
                        "because": f"builds on {edge.subject}",
                        "score": edge.score
                    })

        return suggestions[:10]

    async def explain_connection(self, concept_a: str, concept_b: str) -> dict:
        """Explain how two concepts are connected."""
        results = await self.hippo.search(
            f"How is {concept_a} connected to {concept_b}?",
            return_paths=True,
            top_k=10
        )

        return {
            "paths": [
                {
                    "steps": [s.entity for s in path.steps],
                    "relations": [s.relation for s in path.steps[1:]],
                    "explanation": self._narrate_path(path)
                }
                for path in results.paths[:5]
            ]
        }

    def _narrate_path(self, path) -> str:
        """Generate natural language explanation of a path."""
        parts = []
        for i, step in enumerate(path.steps):
            if i > 0:
                parts.append(f"which {path.steps[i-1].relation}")
            parts.append(step.entity)
        return " → ".join(parts)
```

---

## Production Best Practices

### 1. Chunking Strategy

```python
# For documents > 2000 tokens, split intelligently
def chunk_for_hipporag(document: str, max_tokens: int = 1500) -> List[str]:
    """
    Split documents while preserving entity context.
    Each chunk should be self-contained for OpenIE.
    """
    paragraphs = document.split('\n\n')
    chunks = []
    current_chunk = []
    current_tokens = 0

    for para in paragraphs:
        para_tokens = len(para.split()) * 1.3  # Rough estimate

        if current_tokens + para_tokens > max_tokens and current_chunk:
            chunks.append('\n\n'.join(current_chunk))
            current_chunk = [para]
            current_tokens = para_tokens
        else:
            current_chunk.append(para)
            current_tokens += para_tokens

    if current_chunk:
        chunks.append('\n\n'.join(current_chunk))

    return chunks
```

### 2. Error Handling

```python
async def robust_index(hippo, document, retries=3):
    """Index with retry logic."""
    for attempt in range(retries):
        try:
            await hippo.add_episode(document)
            return True
        except RateLimitError:
            await asyncio.sleep(2 ** attempt)
        except ExtractionError as e:
            # Log but continue - some docs may fail
            logger.warning(f"Extraction failed: {e}")
            return False
    return False
```

### 3. Monitoring

```python
async def monitor_health(hippo):
    """Monitor HippoRAG health metrics."""
    health = await hippo.health_check()

    return {
        "backend_connected": health['connected'],
        "entity_count": health['entity_count'],
        "edge_count": health['edge_count'],
        "avg_query_latency_ms": health.get('avg_query_latency'),
        "last_consolidation": health.get('last_consolidation'),
        "memory_usage_mb": health.get('memory_mb')
    }
```

## Related Sub-Skills

- **core-indexing**: Deep dive into indexing patterns
- **core-retrieval**: Query optimization techniques
- **core-consolidation**: Memory management strategies
- **integration-backends**: Database selection for use case
- **integration-mcp**: Exposing HippoRAG via MCP
