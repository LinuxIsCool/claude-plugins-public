---
name: crewai
description: Multi-agent orchestration framework with roles, tasks, and collaborative workflows
allowed-tools: Read, Glob, Grep, Bash, WebFetch
---

# CrewAI Mastery

CrewAI is a standalone, high-performance Python framework for orchestrating autonomous AI agents. Built from scratch independent of LangChain, CrewAI excels at creating specialized teams of agents that work together to accomplish complex tasks through role-based collaboration.

## Territory Map

CrewAI's architecture consists of four core components:

1. **Agents**: Autonomous units with specific roles, goals, and backstories
2. **Tasks**: Specific assignments with descriptions and expected outputs
3. **Crews**: Collaborative groups of agents working toward common objectives
4. **Flows**: Event-driven workflows for precise control over execution

Additional capabilities:
- **Memory System**: Short-term, long-term, and entity memory with RAG
- **Processes**: Sequential and hierarchical execution strategies
- **Tools**: Integration with CrewAI Toolkit and LangChain Tools
- **Knowledge Sources**: Domain-specific knowledge bases for agents

## Core Capabilities

- **Multi-Agent Collaboration**: Agents with specialized roles working together
- **Flexible Execution**: Sequential processes or hierarchical management
- **State Management**: Structured and unstructured state handling in Flows
- **Memory & Learning**: Built-in memory systems for context retention
- **Tool Integration**: Extensive tool ecosystem for agent capabilities
- **Production-Ready**: Enterprise-grade reliability and scalability

## Beginner Techniques

### Creating a Basic Agent

```python
from crewai import Agent
from crewai_tools import SerperDevTool

researcher = Agent(
    role="Research Analyst",
    goal="Find and summarize information about specific topics",
    backstory="You are an experienced researcher with attention to detail",
    tools=[SerperDevTool()],
    verbose=True
)
```

### Defining a Task

```python
from crewai import Task

research_task = Task(
    description="Conduct thorough research about AI Agents",
    expected_output="A list with 10 bullet points of the most relevant information",
    agent=researcher
)
```

### Creating a Simple Crew

```python
from crewai import Crew, Process

crew = Crew(
    agents=[researcher],
    tasks=[research_task],
    process=Process.sequential,
    verbose=True
)

result = crew.kickoff()
print(result)
```

### YAML Configuration (Recommended)

**agents.yaml:**
```yaml
researcher:
  role: >
    Senior Data Researcher
  goal: >
    Uncover cutting-edge developments in {topic}
  backstory: >
    You're a seasoned researcher with a knack for uncovering the latest
    developments. Known for your ability to find the most relevant
    information and present it clearly.
```

**tasks.yaml:**
```yaml
research_task:
  description: >
    Conduct thorough research about {topic}
  expected_output: >
    A list with 10 bullet points of the most relevant information
  agent: researcher
```

**crew.py:**
```python
from crewai import Agent, Crew, Process, Task
from crewai.project import CrewBase, agent, crew, task

@CrewBase
class ResearchCrew:
    agents_config = 'config/agents.yaml'
    tasks_config = 'config/tasks.yaml'

    @agent
    def researcher(self) -> Agent:
        return Agent(
            config=self.agents_config['researcher'],
            tools=[SerperDevTool()],
            verbose=True
        )

    @task
    def research_task(self) -> Task:
        return Task(
            config=self.tasks_config['research_task']
        )

    @crew
    def crew(self) -> Crew:
        return Crew(
            agents=self.agents,
            tasks=self.tasks,
            process=Process.sequential,
            verbose=True
        )
```

## Intermediate Techniques

### Hierarchical Process with Manager

```python
from crewai import Crew, Process, Agent, Task

analyst = Agent(
    role="Data Analyst",
    goal="Analyze data and provide insights",
    backstory="Expert analyst with 10 years of experience"
)

researcher = Agent(
    role="Market Researcher",
    goal="Gather market intelligence",
    backstory="Diligent researcher with keen eye for detail"
)

crew = Crew(
    agents=[analyst, researcher],
    tasks=[analysis_task, research_task],
    process=Process.hierarchical,
    manager_llm="gpt-4o",  # Manager coordinates the team
    verbose=True
)
```

### Task Dependencies and Context

```python
research_task = Task(
    description="Research latest AI developments",
    expected_output="List of recent AI developments",
    agent=researcher,
    async_execution=True  # Run asynchronously
)

analysis_task = Task(
    description="Analyze the research findings",
    expected_output="Analysis report of AI trends",
    agent=analyst,
    context=[research_task]  # Waits for research_task output
)
```

### Structured Output with Pydantic

```python
from pydantic import BaseModel
from typing import List

class ResearchFindings(BaseModel):
    main_points: List[str]
    key_technologies: List[str]
    future_predictions: str

task = Task(
    description="Research AI developments",
    expected_output="Structured research findings",
    agent=researcher,
    output_pydantic=ResearchFindings
)

result = crew.kickoff()
print(result.pydantic.main_points)
```

### Task Guardrails

```python
from crewai import TaskOutput
from typing import Tuple, Any

def validate_word_count(result: TaskOutput) -> Tuple[bool, Any]:
    word_count = len(result.raw.split())
    if word_count > 200:
        return (False, "Content exceeds 200 words")
    return (True, result.raw.strip())

blog_task = Task(
    description="Write a blog post about AI",
    expected_output="A blog post under 200 words",
    agent=writer,
    guardrail=validate_word_count,
    guardrail_max_retries=3
)
```

### Memory-Enabled Crew

```python
crew = Crew(
    agents=[researcher, analyst],
    tasks=[research_task, analysis_task],
    process=Process.sequential,
    memory=True,  # Enables short-term, long-term, and entity memory
    verbose=True
)
```

## Advanced Techniques

### CrewAI Flows for Precise Control

```python
from crewai.flow.flow import Flow, listen, start, router
from pydantic import BaseModel

class MarketState(BaseModel):
    sentiment: str = "neutral"
    confidence: float = 0.0
    recommendations: list = []

class AnalysisFlow(Flow[MarketState]):
    @start()
    def fetch_data(self):
        self.state.sentiment = "analyzing"
        return {"sector": "tech", "timeframe": "1W"}

    @listen(fetch_data)
    def analyze_with_crew(self, market_data):
        analyst = Agent(
            role="Senior Market Analyst",
            goal="Conduct deep market analysis",
            backstory="Veteran analyst known for identifying patterns"
        )

        analysis_crew = Crew(
            agents=[analyst],
            tasks=[analysis_task],
            process=Process.sequential,
            verbose=True
        )
        return analysis_crew.kickoff(inputs=market_data)

    @router(analyze_with_crew)
    def route_by_confidence(self):
        if self.state.confidence > 0.8:
            return "high_confidence"
        return "low_confidence"

    @listen("high_confidence")
    def execute_strategy(self):
        # Execute high-confidence strategy
        pass

    @listen("low_confidence")
    def request_more_data(self):
        self.state.recommendations.append("Gather more data")
```

### Custom Memory Configuration

```python
crew = Crew(
    agents=[agent],
    tasks=[task],
    memory=True,
    embedder={
        "provider": "openai",
        "config": {
            "model": "text-embedding-3-small"
        }
    }
)

# Using local embeddings with Ollama
crew = Crew(
    agents=[agent],
    tasks=[task],
    memory=True,
    embedder={
        "provider": "ollama",
        "config": {
            "model": "mxbai-embed-large"
        }
    }
)
```

### External Memory with Mem0

```python
from crewai.memory.external.external_memory import ExternalMemory

external_memory = ExternalMemory(
    embedder_config={
        "provider": "mem0",
        "config": {
            "user_id": "john",
            "local_mem0_config": {
                "vector_store": {
                    "provider": "qdrant",
                    "config": {"host": "localhost", "port": 6333}
                },
                "llm": {
                    "provider": "openai",
                    "config": {"api_key": "your-key", "model": "gpt-4"}
                }
            }
        }
    }
)

crew = Crew(
    agents=[agent],
    tasks=[task],
    external_memory=external_memory,
    verbose=True
)
```

### Advanced Agent Configuration

```python
reasoning_agent = Agent(
    role="Strategic Planner",
    goal="Analyze complex problems and create execution plans",
    backstory="Expert strategic planner",
    reasoning=True,  # Enable planning before execution
    max_reasoning_attempts=3,
    inject_date=True,  # Auto-inject current date
    date_format="%B %d, %Y",
    multimodal=True,  # Process text and images
    allow_code_execution=True,
    code_execution_mode="safe",  # Uses Docker
    max_execution_time=300,
    respect_context_window=True,
    verbose=True
)
```

### Flow Persistence

```python
from crewai.flow.flow import Flow, persist, start, listen
from pydantic import BaseModel

class MyState(BaseModel):
    counter: int = 0

@persist  # Class-level persistence
class PersistentFlow(Flow[MyState]):
    @start()
    def initialize(self):
        self.state.counter += 1
        print(f"State ID: {self.state.id}")
        print(f"Counter: {self.state.counter}")

    @listen(initialize)
    def next_step(self):
        self.state.counter += 1
        # State automatically persisted to SQLite
```

### Custom Tools Integration

```python
from crewai_tools import BaseTool

class CustomSearchTool(BaseTool):
    name: str = "Custom Search"
    description: str = "Search custom database"

    def _run(self, query: str) -> str:
        # Custom implementation
        return f"Results for: {query}"

agent = Agent(
    role="Researcher",
    goal="Find information",
    backstory="Expert researcher",
    tools=[CustomSearchTool()]
)
```

### Callbacks and Monitoring

```python
from crewai import TaskOutput

def task_callback(output: TaskOutput):
    print(f"Task completed: {output.description}")
    print(f"Output: {output.raw}")
    # Send notification, log to database, etc.

task = Task(
    description="Research AI trends",
    expected_output="Trend analysis",
    agent=researcher,
    callback=task_callback
)

def step_callback(step_output):
    print(f"Agent step: {step_output}")

crew = Crew(
    agents=[researcher],
    tasks=[research_task],
    step_callback=step_callback,
    task_callback=task_callback
)
```

## When to Use CrewAI

**Ideal for:**
- Multi-agent systems with specialized roles
- Complex workflows requiring agent collaboration
- Production-grade AI automation at scale
- Projects needing both autonomy and precise control
- Teams wanting clean separation between agents, tasks, and orchestration
- Applications requiring persistent memory across sessions
- Workflows with conditional logic and branching
- Enterprise applications with hierarchical task management

**Choose over other frameworks when:**
- You need standalone framework without LangChain dependencies
- Performance and speed are critical (5.76x faster than LangGraph in benchmarks)
- You want both high-level simplicity and low-level customization
- You need production-ready reliability with robust community support
- You want to combine autonomous agents (Crews) with precise workflows (Flows)

**Not ideal for:**
- Simple single-agent tasks (use Agent.kickoff() directly instead)
- Projects requiring LangChain-specific features
- Ultra-lightweight applications where framework overhead matters
- Single linear workflows without collaboration needs

## Reference Files

Key documentation:
- `resources/agents/crewAI/README.md` - Overview
- `resources/agents/crewAI/docs/en/concepts/agents.mdx` - Agent guide
- `resources/agents/crewAI/docs/en/concepts/tasks.mdx` - Task guide
- `resources/agents/crewAI/docs/en/concepts/crews.mdx` - Crew guide
- `resources/agents/crewAI/docs/en/concepts/memory.mdx` - Memory system
- `resources/agents/crewAI/docs/en/concepts/flows.mdx` - Flows guide
- `resources/agents/crewAI/docs/en/concepts/processes.mdx` - Processes

Example templates:
- `resources/agents/crewAI/lib/crewai/src/crewai/cli/templates/crew/` - Crew template
- `resources/agents/crewAI/lib/crewai/src/crewai/cli/templates/flow/` - Flow template

Installation:
```bash
pip install crewai
pip install 'crewai[tools]'  # With additional tools
```

CLI commands:
```bash
crewai create crew <project_name>  # Create new crew project
crewai create flow <project_name>  # Create new flow project
crewai run                          # Run crew or flow
crewai install                      # Install dependencies
```

Key features:
- 100,000+ certified developers in community
- Sequential and hierarchical processes
- Built-in memory (short-term, long-term, entity)
- YAML configuration for maintainability
- Structured outputs with Pydantic
- Task guardrails for validation
- Async execution support
- Human-in-the-loop capabilities
- Tool integration ecosystem
- Production deployment ready
