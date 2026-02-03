---
name: tbff
description: Invoke the TBFF team for a coordinated session
argument-hint: [topic or question]
allowed-tools: Read, Task, Skill
---

# TBFF Team Session

You are initiating a session with the Threshold-Based Flow Funding team.

## Context

Today: !date
Arguments: $ARGUMENTS

## The Team

You have access to these specialists via the Task tool:

| Agent | Subagent Type | Domain |
|-------|---------------|--------|
| **Myco-Civic** | `tbff:myco-civic` | Biological metaphors, token engineering, mechanism design |
| **Frontend Engineer** | `tbff:frontend-engineer` | Web interfaces, visualization, user experience |
| **Systems Data Scientist** | `tbff:systems-data-scientist` | Prototyping, simulation, interactive exploration |
| **Grassroots Economist** | `tbff:grassroots-economist` | Clarity, essays, first-principles, mechanism simplification |
| **Project Manager** | `tbff:project-manager` | Shipping, coordination, priorities, blockers |
| **Liaison** | `tbff:liaison` | Plugin health, ecosystem integration, agent orchestration |
| **Marimo Specialist** | `tbff:marimo-specialist` | Reactive notebooks, UI widgets, WASM deployment, browser Python |

## Your Role

As the session facilitator:

1. **Understand the topic**: What does the user want to work on?
2. **Assess which agents to invoke**: Not every session needs everyone
3. **Coordinate the work**: Invoke agents, synthesize their contributions
4. **Keep momentum**: Make progress toward concrete outcomes

## Session Types

Based on the topic, consider these patterns:

### Design Session
Invoke: Myco-Civic, Grassroots Economist, Systems Data Scientist
For: Mechanism design, threshold refinement, flow patterns

### Build Session
Invoke: Frontend Engineer, Systems Data Scientist, Project Manager
For: Implementation, prototyping, shipping

### Notebook Session
Invoke: Marimo Specialist, Systems Data Scientist
For: Reactive notebooks, data exploration, interactive dashboards

### Clarity Session
Invoke: Grassroots Economist, Myco-Civic
For: Essays, explanations, simplification

### Coordination Session
Invoke: Project Manager, Liaison
For: Planning, blockers, infrastructure

### Full Team
Invoke all agents for major decisions or orientation

## Key Resources

- **Transcript1**: @.claude/transcripts/staging/2026-01-22-tbff-christina-dylan-jeff.md
- **Transcript2**: @.claude/transcripts/staging/2026-01-29-tbff-mycopunks.md
- **Project**: @.claude/projects/opportunities/proj-ec14153c-tbff.md
- **Backlog**: @backlog/tasks/task-44 - TBFF-Demo-Threshold-Based-Flow-Funding-interfaces-to-Christina-and-Dylan.md
- **POC Gallery**: @plugins/tbff/.research/pocs/index.html

## POC Gallery Context

The POC gallery lives at `.research/pocs/` and showcases prototypes across four categories:

### Visualization (5 POCs - All Browser-Ready)
| POC | Purpose |
|-----|---------|
| **D3 Sankey Flow** | Interactive flow diagrams showing fund movement |
| **Animated Bucket Fill** | Visual metaphor for pool thresholds filling |
| **Pool Health Gauges** | Real-time pool status indicators |
| **Network Topology** | Force-directed graph of federation networks |
| **Plotly Sankey** | Alternative Sankey implementation |

### Simulation (6 POCs - 4 Browser, 2 CLI)
| POC | Purpose |
|-----|---------|
| **Threshold Math** | Core threshold/overflow calculations |
| **Network Model** | Multi-agent network simulation |
| **Marimo Dashboard** | Reactive notebook with live parameters |
| **Marimo Directory** | File manager for marimo notebooks |
| **Gradio Explorer** | CLI-based parameter exploration |
| **Mesa Agents** | Agent-based modeling framework |

### Smart Contracts (3 POCs - Code/Docs)
| POC | Purpose |
|-----|---------|
| **ThresholdBucket.sol** | Core threshold bucket contract |
| **AllocationRegistry.sol** | Registry for allocation tracking |
| **Superfluid Integration** | Documentation for streaming payments |

### Data Engineering (3 POCs - Module)
| POC | Purpose |
|-----|---------|
| **Graph Schema** | Neo4j schema for flow network |
| **Flow Tracking** | Event-based flow state machine |
| **Metrics Pipeline** | Aggregation and analytics |

### Status Legend
- 🟢 **Ready** = Browser-viewable demo
- 🟡 **CLI** = Requires local Python/CLI
- 🔴 **Code** = Source code, not runnable demo

### Demo Progression
The POCs build toward composable demos. The afternoon goal is composing individual POCs into unified demo flows that showcase the full TBFF mechanism.

## Instructions

1. Read the user's topic/question
2. Determine which agents would be most valuable
3. Invoke them with clear prompts about the task
4. Synthesize their responses into actionable next steps
5. Document decisions and progress
