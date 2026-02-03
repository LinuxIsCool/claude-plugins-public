---
name: agents-marketplace
description: Master the OpenAI Agents marketplace architecture with 91 specialized agents, 57 skills, and 65 plugins for Claude Code. Use when building agent systems, implementing multi-agent workflows, creating marketplace plugins, or designing modular AI agent architectures.
allowed-tools: Read, Glob, Grep, Bash
---

# OpenAI Agents Marketplace Mastery

Comprehensive expertise in the OpenAI Agents marketplace - a production-ready ecosystem combining 91 specialized AI agents, 15 multi-agent workflow orchestrators, 57 agent skills, and 45 development tools organized into 65 focused, single-purpose plugins for Claude Code.

## Territory Map

```
resources/agents/agents/
├── .claude-plugin/
│   └── marketplace.json          # Marketplace catalog (65 plugins)
├── plugins/                       # 67 isolated plugin directories
│   ├── python-development/
│   │   ├── agents/               # 3 Python experts (python-pro, django-pro, fastapi-pro)
│   │   ├── commands/             # python-scaffold tool
│   │   └── skills/               # 5 specialized skills
│   ├── kubernetes-operations/
│   │   ├── agents/               # kubernetes-architect
│   │   └── skills/               # 4 K8s skills
│   ├── llm-application-dev/
│   │   ├── agents/               # ai-engineer, prompt-engineer
│   │   ├── commands/             # 3 LLM workflow tools
│   │   └── skills/               # 4 LLM development skills
│   ├── backend-development/
│   │   ├── agents/               # backend-architect, graphql-architect, tdd-orchestrator
│   │   ├── commands/             # feature-development
│   │   └── skills/               # 5 backend architecture skills
│   └── ... (63 more plugins)
├── docs/
│   ├── architecture.md           # Design principles
│   ├── agents.md                 # Agent reference
│   ├── agent-skills.md           # Skills guide
│   ├── plugins.md                # Plugin catalog
│   └── usage.md                  # Commands and workflows
└── README.md                      # Quick start guide
```

**Key Statistics:**
- 65 focused plugins optimized for minimal token usage
- 91 specialized agents across 8 domains
- 57 agent skills with progressive disclosure
- 15 multi-agent workflow orchestrators
- 45 development tools and utilities
- 23 categories with 1-6 plugins each
- Average 3.4 components per plugin (follows Anthropic's 2-8 pattern)

## Core Capabilities

### Marketplace Architecture

**Granular Plugin Design:**
- Single-purpose plugins following Unix philosophy
- Install only what you need - minimal token usage
- Clear boundaries between plugins
- Composable for complex workflows
- 100% agent coverage across all plugins

**Three-Tier Model Strategy:**
- Opus 4.5: 42 agents for critical architecture, security, code review
- Inherit: 42 agents that use session's default model for flexibility
- Sonnet 4.5: 51 agents for intelligent support tasks
- Haiku 4.5: 18 agents for fast operational tasks

**Progressive Disclosure (Skills):**
1. Metadata - Name and activation criteria (always loaded)
2. Instructions - Core guidance (loaded when activated)
3. Resources - Examples and templates (loaded on demand)

### Domain Coverage

**Architecture & Planning (8 agents):**
- backend-architect, frontend-architect, mobile-architect
- solutions-architect, database-architect, api-architect
- system-designer, microservices-architect

**Languages (24 agents):**
- Python: python-pro, django-pro, fastapi-pro
- JavaScript/TypeScript: js-pro, typescript-pro, nextjs-pro, react-pro
- Systems: rust-pro, go-pro, cpp-pro
- JVM: java-pro, kotlin-pro, scala-pro
- Scripting: bash-pro, powershell-pro, lua-pro
- Functional: haskell-pro, elixir-pro, fsharp-pro
- Embedded: embedded-systems-pro, iot-pro
- Blockchain: solidity-pro, web3-pro
- Gaming: unity-pro, minecraft-pro

**Infrastructure & DevOps (14 agents):**
- kubernetes-architect, terraform-architect, cloud-architect
- deployment-engineer, cicd-engineer, infrastructure-validator
- observability-engineer, incident-responder, network-engineer
- sre-engineer, devops-engineer, platform-engineer
- container-architect, gitops-engineer

**Quality & Security (12 agents):**
- code-reviewer, security-auditor, compliance-officer
- test-automator, qa-engineer, performance-engineer
- accessibility-auditor, backend-security-coder, frontend-security-coder
- penetration-tester, vulnerability-scanner, security-architect

**Data & AI (9 agents):**
- data-engineer, ai-engineer, ml-engineer
- prompt-engineer, mlops-engineer, data-scientist
- analytics-engineer, etl-engineer, vector-db-architect

**Documentation (5 agents):**
- docs-architect, tutorial-engineer, api-documenter
- c4-context, c4-container, c4-component, c4-code

**Business Operations (8 agents):**
- business-analyst, hr-legal-advisor, customer-success
- sales-engineer, seo-content-writer, technical-seo
- seo-analyst, content-strategist

**Development Tools (11 agents):**
- debugger, dx-optimizer, migration-engineer
- framework-migration, dependency-upgrader, database-migrator
- tdd-orchestrator, graphql-architect, temporal-python-pro
- payment-integration, quant-trader

## Beginner Techniques

### Installing and Using Plugins

```bash
# Add the marketplace to Claude Code
/plugin marketplace add wshobson/agents

# Browse available plugins
/plugin

# Install essential development plugins
/plugin install python-development          # Python with 5 skills
/plugin install javascript-typescript       # JS/TS with 4 skills
/plugin install backend-development         # Backend with 5 architecture skills

# Install infrastructure plugins
/plugin install kubernetes-operations       # K8s with 4 deployment skills
/plugin install cloud-infrastructure        # AWS/Azure/GCP with 4 cloud skills

# Install security and quality plugins
/plugin install security-scanning           # SAST with security skill
/plugin install code-review-ai             # AI-powered code review
```

**Each installed plugin loads only its specific agents, commands, and skills** - no bloat!

### Using Slash Commands

```bash
# Development workflows
/backend-development:feature-development "user authentication API"
/python-development:python-scaffold fastapi-microservice
/unit-testing:test-generate

# Security scanning
/security-scanning:security-hardening --level comprehensive
/security-scanning:security-sast
/security-scanning:security-dependencies

# Code quality
/code-review-ai:ai-review
/comprehensive-review:full-review

# Infrastructure
/kubernetes-operations:k8s-deploy production
/cloud-infrastructure:terraform-scaffold aws
/cicd-automation:workflow-automate github-actions
```

### Natural Language Agent Invocation

```
"Use backend-architect to design the authentication API"
"Have security-auditor scan for OWASP vulnerabilities"
"Get python-pro to implement async patterns"
"Ask kubernetes-architect to create production deployment"
```

Claude Code automatically selects and coordinates appropriate agents based on requests.

### Understanding Plugin Structure

Each plugin is isolated with clear boundaries:

```
plugin-name/
├── agents/           # Specialized agents (optional)
│   └── agent-name.md
├── commands/         # Tools and workflows (optional)
│   └── command-name.md
└── skills/           # Knowledge packages (optional)
    └── skill-name/
        └── SKILL.md
```

Minimum requirements:
- At least one agent OR one command
- Clear, focused purpose
- Proper frontmatter in all files
- Entry in marketplace.json

## Intermediate Techniques

### Creating Agent Files

```markdown
---
name: agent-name
description: Expert description. Use PROACTIVELY for [use cases].
model: opus|inherit|sonnet|haiku
---

You are a [domain] expert specializing in [expertise].

## Purpose
[Clear purpose statement]

## Capabilities
- [Capability 1]
- [Capability 2]

## Best Practices
- [Practice 1]
- [Practice 2]

## Tools and Technologies
- [Tool 1]
- [Tool 2]
```

**Frontmatter Requirements:**
- `name`: Hyphen-case identifier
- `description`: What the agent does + "Use PROACTIVELY for..." clause
- `model`: opus|inherit|sonnet|haiku (model selection)

**Model Selection Guidelines:**
- **opus**: Critical architecture, security, ALL code review, production coding
- **inherit**: Complex tasks - user chooses model (AI/ML, backend, frontend)
- **sonnet**: Support with intelligence (docs, testing, debugging)
- **haiku**: Fast operational tasks (SEO, deployment, simple docs)

### Creating Skill Files

```markdown
---
name: skill-name
description: What the skill does. Use when [trigger conditions].
---

# Skill Title

[Brief introduction to the skill]

## When to Use This Skill

- [Use case 1]
- [Use case 2]
- [Use case 3]

## Core Concepts

### 1. Concept Name
[Explanation]

### 2. Another Concept
[Explanation]

## Quick Start

```language
[Simple example code]
```

## Fundamental Patterns

### Pattern 1: Pattern Name

```language
[Code example]
```

[Explanation]

### Pattern 2: Another Pattern

```language
[Code example]
```

[Explanation]

## Advanced Techniques

[Deep dive into advanced usage]

## Best Practices

- [Practice 1]
- [Practice 2]

## Common Pitfalls

- [Pitfall 1 and how to avoid it]
- [Pitfall 2 and how to avoid it]
```

**Skill Specification Requirements:**
- YAML frontmatter with `name` and `description`
- Description must include "Use when" clause
- Description under 1024 characters
- Progressive disclosure architecture
- Complete, non-truncated content

### Creating Command Files

```markdown
# Command Title

You are a [role] specializing in [domain]. [Command purpose].

## Context

[What this command does and when to use it]

## Requirements

$ARGUMENTS

## Instructions

### 1. Analyze Requirements

[Analysis steps]

### 2. Generate Artifacts

```bash
# Example commands
command-1
command-2
```

### 3. Validate Output

[Validation steps]

## Best Practices

- [Practice 1]
- [Practice 2]

## Common Patterns

[Patterns and examples]
```

Commands can use `$ARGUMENTS` to access user-provided parameters.

### Multi-Agent Orchestration Patterns

**Pattern 1: Sequential Workflow**

```
Planning Phase (Opus) → Execution Phase (Sonnet/Haiku) → Review Phase (Opus)

Example:
backend-architect (Opus) designs API
  ↓
Generate endpoints (Inherit) implements spec
  ↓
test-automator (Sonnet) creates tests
  ↓
code-reviewer (Opus) validates architecture
```

**Pattern 2: Full-Stack Feature Development**

```bash
/full-stack-orchestration:full-stack-feature "user authentication with OAuth2"
```

Coordinates 7+ agents:
1. backend-architect → API design
2. database-architect → Schema design
3. frontend-developer → UI implementation
4. test-automator → Test creation
5. security-auditor → Security review
6. deployment-engineer → CI/CD setup
7. observability-engineer → Monitoring setup

**Pattern 3: Multi-Plugin Composition**

```
Feature Development Workflow:
1. backend-development:feature-development
2. security-scanning:security-hardening
3. unit-testing:test-generate
4. code-review-ai:ai-review
5. cicd-automation:workflow-automate
6. observability-monitoring:monitor-setup
```

### Skill Activation and Progressive Disclosure

Skills are automatically activated when Claude detects matching patterns:

```
User: "Set up Kubernetes deployment with Helm chart"
→ Activates: helm-chart-scaffolding, k8s-manifest-generator

User: "Build a RAG system for document Q&A"
→ Activates: rag-implementation, prompt-engineering-patterns

User: "Optimize Python async performance"
→ Activates: async-python-patterns, python-performance-optimization
```

Skills work alongside agents:
- **Agents**: High-level reasoning and orchestration
- **Skills**: Specialized knowledge and implementation patterns

## Advanced Techniques

### Building Custom Plugins

**Step 1: Plan Plugin Structure**

```bash
# Identify plugin purpose (single responsibility)
# Determine components needed:
# - Agents: Domain experts for reasoning
# - Commands: Tools and workflows
# - Skills: Specialized knowledge packages

# Example: payment-processing plugin
plugins/payment-processing/
├── agents/
│   └── payment-integration.md
├── commands/
│   └── payment-setup.md
└── skills/
    ├── stripe-integration/
    │   └── SKILL.md
    ├── paypal-integration/
    │   └── SKILL.md
    ├── pci-compliance/
    │   └── SKILL.md
    └── billing-automation/
        └── SKILL.md
```

**Step 2: Create Plugin Directory**

```bash
mkdir -p plugins/payment-processing/{agents,commands,skills}
```

**Step 3: Add Components**

Create agent files (agents/payment-integration.md):
```markdown
---
name: payment-integration
description: Expert in payment processing integration with Stripe, PayPal, and compliance. Use PROACTIVELY for payment implementation, PCI compliance, or billing automation.
model: sonnet
---

[Agent content]
```

Create command files (commands/payment-setup.md):
```markdown
# Payment Processing Setup

[Command content with $ARGUMENTS]
```

Create skill directories and SKILL.md files:
```bash
mkdir -p plugins/payment-processing/skills/stripe-integration
```

**Step 4: Update marketplace.json**

```json
{
  "name": "payment-processing",
  "source": "./plugins/payment-processing",
  "description": "Payment processing integration with Stripe, PayPal, PCI compliance, and billing automation",
  "version": "1.0.0",
  "author": {
    "name": "Your Name",
    "url": "https://github.com/username"
  },
  "homepage": "https://github.com/username/agents",
  "repository": "https://github.com/username/agents",
  "license": "MIT",
  "keywords": [
    "payments",
    "stripe",
    "paypal",
    "billing",
    "pci-compliance"
  ],
  "category": "payments",
  "strict": false,
  "agents": [
    "./agents/payment-integration.md"
  ],
  "commands": [
    "./commands/payment-setup.md"
  ],
  "skills": [
    "./skills/stripe-integration",
    "./skills/paypal-integration",
    "./skills/pci-compliance",
    "./skills/billing-automation"
  ]
}
```

### Implementing Three-Tier Model Strategy

**Tier Assignment Logic:**

```
Critical Decisions & Security → Opus 4.5
├── Architecture decisions
├── Security audits
├── ALL code review
└── Production language coding (language-pro agents)

User-Controlled Complexity → Inherit
├── AI/ML development
├── Backend development
├── Frontend/mobile development
└── Specialized domain work

Intelligent Support → Sonnet 4.5
├── Documentation
├── Testing
├── Debugging
├── Network operations
└── API documentation

Fast Operations → Haiku 4.5
├── SEO optimization
├── Deployment automation
├── Simple documentation
├── Sales operations
└── Content generation
```

**Cost Optimization:**

```
Example Project Budget:
- Opus (architecture + review): 20% of operations
- Inherit (implementation): 50% of operations (user choice)
- Sonnet (testing + docs): 25% of operations
- Haiku (deployment): 5% of operations

Cost per million tokens:
- Opus: $5/$25 (input/output)
- Sonnet: $3/$15 (input/output)
- Haiku: $1/$5 (input/output)

Opus's 65% token reduction often offsets higher rate
```

### Advanced Skill Patterns

**Pattern 1: Nested Skill Activation**

```
User: "Build production FastAPI with async patterns and comprehensive testing"

Activates in sequence:
1. fastapi-templates (FastAPI structure)
2. async-python-patterns (Async implementation)
3. python-testing-patterns (Test suite)
4. python-packaging (Distribution)
```

**Pattern 2: Cross-Plugin Skills**

```
Full-stack development with skills:
- Backend: api-design-principles, microservices-patterns
- Frontend: typescript-advanced-types, modern-javascript-patterns
- Infrastructure: k8s-manifest-generator, terraform-module-library
- Security: sast-configuration, auth-implementation-patterns
```

**Pattern 3: Skill Resource Loading**

```markdown
# In SKILL.md

## Core Patterns
[Instructions tier - always loaded when activated]

## Advanced Examples
[Resources tier - loaded on explicit request]

## Templates and Scaffolds
[Resources tier - loaded when user needs generation]
```

### Building Multi-Agent Workflows

**Custom Orchestrator Command:**

```markdown
# Multi-Agent Security Pipeline

You are a security orchestration specialist coordinating multiple security agents for comprehensive application security assessment.

## Context

This workflow coordinates security-auditor, vulnerability-scanner, penetration-tester, and compliance-officer agents for complete security hardening.

## Requirements

$ARGUMENTS

## Instructions

### 1. Initialize Security Assessment

```bash
# Run SAST analysis
/security-scanning:security-sast

# Check dependencies
/security-scanning:security-dependencies
```

### 2. Coordinate Agent Analysis

**Phase 1: Static Analysis (security-auditor)**
- Code security review
- OWASP Top 10 assessment
- Cryptography review

**Phase 2: Dependency Analysis (vulnerability-scanner)**
- CVE scanning
- License compliance
- Outdated package detection

**Phase 3: Penetration Testing (penetration-tester)**
- Authentication testing
- Authorization boundary testing
- Input validation testing

**Phase 4: Compliance Review (compliance-officer)**
- SOC2 compliance check
- GDPR compliance assessment
- Industry-specific requirements

### 3. Generate Comprehensive Report

[Report generation steps]
```

### Marketplace Extension Patterns

**Pattern 1: Category Expansion**

Add new category to marketplace:
```json
{
  "plugins": [
    {
      "name": "new-category-plugin",
      "category": "new-category",
      "description": "Pioneering plugin for new domain"
    }
  ]
}
```

**Pattern 2: Skill Library Growth**

Extend existing plugin with new skills:
```bash
# Add skill to existing plugin
mkdir -p plugins/python-development/skills/fastapi-websockets
# Create SKILL.md
# Update marketplace.json skills array
```

**Pattern 3: Agent Specialization**

Add specialized agent variants:
```
python-pro (general Python) →
  ├── fastapi-pro (FastAPI specialist)
  ├── django-pro (Django specialist)
  └── data-science-pro (Data science specialist)
```

## When to Use Agents Marketplace

**Use this skill when:**
- Building or extending Claude Code plugin systems
- Implementing multi-agent workflows and orchestration
- Creating modular AI agent architectures
- Designing progressive disclosure knowledge systems
- Developing domain-specific AI agent marketplaces
- Understanding Claude Code plugin ecosystem
- Architecting granular, composable AI tools
- Optimizing token usage in agent systems
- Implementing three-tier model strategies
- Building production-ready development automation

**This skill provides:**
- Deep understanding of marketplace architecture
- Agent, skill, and command creation patterns
- Multi-agent orchestration strategies
- Progressive disclosure implementation
- Model selection and cost optimization
- Plugin design best practices
- Granular architecture principles
- Real-world plugin examples across 23 categories

**Integration with other systems:**
- Claude Code CLI and slash commands
- GitHub Actions and CI/CD pipelines
- Development workflow automation
- Multi-platform application development
- Infrastructure as code tools
- Security scanning and compliance
- Documentation generation systems

## Reference Files

**Core Documentation:**
- `resources/agents/agents/README.md` - Marketplace overview and quick start
- `resources/agents/agents/docs/architecture.md` - Design principles and patterns
- `resources/agents/agents/docs/agents.md` - Complete agent catalog with model assignments
- `resources/agents/agents/docs/agent-skills.md` - All 57 skills organized by plugin
- `resources/agents/agents/docs/plugins.md` - Complete plugin reference for all 65 plugins
- `resources/agents/agents/docs/usage.md` - Command reference and workflow examples

**Plugin Structure:**
- `resources/agents/agents/.claude-plugin/marketplace.json` - Marketplace catalog definition
- `resources/agents/agents/plugins/` - All 67 plugin directories

**Example Implementations:**
- `resources/agents/agents/plugins/python-development/` - Complete Python plugin with 3 agents, 1 command, 5 skills
- `resources/agents/agents/plugins/llm-application-dev/` - LLM development with 2 agents, 3 commands, 4 skills
- `resources/agents/agents/plugins/backend-development/` - Backend architecture with 4 agents, 1 command, 5 skills
- `resources/agents/agents/plugins/kubernetes-operations/` - K8s operations with 1 agent, 4 skills
- `resources/agents/agents/plugins/security-scanning/` - Security tools with 1 agent, 3 commands, 1 skill

**External Resources:**
- [Claude Code Documentation](https://docs.claude.com/en/docs/claude-code/overview) - Official Claude Code guide
- [Plugins Guide](https://docs.claude.com/en/docs/claude-code/plugins) - Plugin system documentation
- [Subagents Guide](https://docs.claude.com/en/docs/claude-code/sub-agents) - Agent orchestration patterns
- [Agent Skills Specification](https://github.com/anthropics/skills/blob/main/agent_skills_spec.md) - Anthropic's official skill spec
- [Anthropic Skills Repository](https://github.com/anthropics/skills) - Official skills repository
