---
name: tool-cartographer
description: Map available tools, MCP servers, Claude Code features, subagents, and plugins. Use when wanting to understand the capability space, discover what actions are possible, or catalog available instruments for future use.
allowed-tools: Bash, Read, Glob, Grep, Task, ListMcpResourcesTool
---

# Tool Cartographer

Map the tools, capabilities, and instruments available in this environment. A cartographer creates maps of unknown territory - this skill creates maps of the capability space.

## When to Use

- Discovering what tools are available
- Understanding MCP server capabilities
- Mapping Claude Code features and configuration
- Cataloging available subagents
- Understanding plugin capabilities
- Exploring the action space

## Exploration Domains

### 1. Claude Code Configuration

**Files to examine:**
```bash
# Global Claude settings
cat ~/.claude.json 2>/dev/null | head -50
cat ~/.claude/settings.json 2>/dev/null | head -50

# Project-level settings
cat .claude.json 2>/dev/null
cat .claude/settings.json 2>/dev/null

# MCP configuration
cat ~/.claude/mcp.json 2>/dev/null
cat .mcp.json 2>/dev/null
```

**Questions to answer:**
- What Claude Code version?
- What global settings are configured?
- What project-specific settings exist?
- What MCP servers are configured?

### 2. MCP Servers

**Discovery methods:**
```bash
# Find MCP config files
find . -name ".mcp.json" -o -name "mcp.json" 2>/dev/null
find ~/.claude -name "*.json" 2>/dev/null

# List MCP server processes (if running)
ps aux | grep -i mcp 2>/dev/null
```

**Use ListMcpResourcesTool** to enumerate available MCP resources.

**Questions to answer:**
- What MCP servers are configured?
- What tools do they provide?
- What resources can be read?
- Are the servers running?

### 3. Available CLI Tools

**Commands:**
```bash
# Development tools
which git node npm python python3 uv pip cargo rustc go java 2>/dev/null

# System tools
which docker kubectl terraform ansible 2>/dev/null

# Claude-related
which claude anthropic 2>/dev/null
claude --version 2>/dev/null

# Editor/IDE tools
which code cursor vim nvim emacs 2>/dev/null
```

**Questions to answer:**
- What programming languages are available?
- What package managers?
- What containerization tools?
- What CI/CD tools?

### 4. Plugin Ecosystem

**Files to examine:**
```bash
# Marketplace plugins
cat .claude-plugin/marketplace.json 2>/dev/null
ls -la plugins/ 2>/dev/null

# Plugin manifests
find plugins -name "plugin.json" 2>/dev/null | xargs cat 2>/dev/null
```

**Questions to answer:**
- What plugins are installed?
- What skills do they provide?
- What commands are available?
- What hooks are configured?

### 5. Subagent Capabilities

**Known Claude Code subagents:**
- `general-purpose` - Multi-step autonomous tasks
- `Explore` - Codebase exploration (quick/medium/very thorough)
- `Plan` - Software architecture planning
- `claude-code-guide` - Documentation lookup

**Discovery:**
- Check system prompt mentions of subagent types
- Review Task tool description for available agents
- Test agent availability through Task tool

### 6. Available Tools (This Session)

Review the current tool set available in this conversation:
- Core tools: Bash, Read, Write, Edit, Glob, Grep
- Planning: TodoWrite, EnterPlanMode, ExitPlanMode
- Web: WebFetch, WebSearch
- MCP: ListMcpResourcesTool, ReadMcpResourceTool, plus server-specific tools
- Agents: Task, TaskOutput
- Special: Skill, SlashCommand, AskUserQuestion, NotebookEdit, KillShell

## Capability Mapping Template

```markdown
## Tool Cartography - [Date]

### Claude Code
- Version: [version]
- Configuration: [summary of settings]

### MCP Servers
| Server | Status | Tools | Resources |
|--------|--------|-------|-----------|
| [name] | [running/stopped] | [tool count] | [resource count] |

### Development Tools
| Category | Available |
|----------|-----------|
| Languages | [python, node, rust, etc.] |
| Package Managers | [pip, npm, cargo, etc.] |
| Containers | [docker, podman, etc.] |
| Version Control | [git, etc.] |

### Plugins
| Plugin | Skills | Commands | Hooks |
|--------|--------|----------|-------|
| [name] | [count] | [count] | [count] |

### Subagents
| Agent | Purpose | When to Use |
|-------|---------|-------------|
| [type] | [description] | [trigger conditions] |

### Tool Inventory (This Session)
- Core: [list]
- MCP: [list]
- Custom: [list]

### Capability Summary
- Can write code: [yes/no]
- Can execute commands: [yes/no]
- Can access web: [yes/no]
- Can access files: [yes/no]
- Can use containers: [yes/no]
- Can spawn agents: [yes/no]

### Notable Capabilities
- [Interesting or unusual tools]
- [Powerful combinations]
- [Gaps or limitations]
```

## Tool Discovery Workflow

### Quick Survey
1. Check Claude Code version: `claude --version`
2. List MCP servers: `ListMcpResourcesTool`
3. Check plugin ecosystem: `cat .claude-plugin/marketplace.json`
4. Inventory dev tools: `which git node python docker`

### Deep Dive
1. Read all MCP configurations
2. Enumerate all plugin skills
3. Test subagent availability
4. Map tool dependencies
5. Document capability matrix

## Understanding Tool Combinations

Tools become powerful through combination:

| Combination | Capability |
|-------------|------------|
| Bash + Read + Edit | Full file manipulation |
| Task + Explore | Autonomous codebase understanding |
| WebFetch + Read | Web-to-local data pipeline |
| Grep + Edit | Find-and-replace workflows |
| MCP + Bash | Extended tool ecosystem |
| TodoWrite + Task | Managed multi-step operations |

## Safety Guidelines

- **Don't test destructively** - Read configs, don't execute dangerous commands
- **Respect permissions** - Note tools you can see but not use
- **Document limitations** - Gaps are as important as capabilities
- **Version matters** - Record versions for reproducibility

## Connection to Other Skills

- **substrate-scanner**: Tools run on substrate; understand both
- **network-prober**: Some tools require network (npm, pip, web)
- **context-archaeologist**: Tool installation history tells a story
- **awareness plugin**: Tool mastery is self-improvement

## Example Session

```
User: What tools and capabilities do I have access to?

Claude: Let me map the capability space...

[Runs tool discovery]

**Claude Code Environment:**
- Version: 2.0.67
- Subagents: general-purpose, Explore, Plan, claude-code-guide

**MCP Servers:**
- schedule (Schedule.md) - 9 tools for schedule management + Playwright browser
- backlog (Backlog.md) - Task management tools

**Development Tools:**
- Languages: Python 3.x, Node.js, Rust (cargo), Go
- Package managers: pip, uv, npm, cargo
- Containers: Docker (4 containers running)
- Version control: Git

**Plugins (9 total):**
- awareness: 7 skills (self-improvement)
- exploration: 5 skills (environmental curiosity)
- journal: 6 skills (knowledge management)
- logging: 2 skills (observability)
- schedule: 2 skills (time management)
- backlog: 2 skills (task management)
- brainstorm: 1 command (ideation)
- agents: 15+ skills (AI frameworks)
- llms: 10+ skills (LLM patterns)

**Notable Capabilities:**
- Full file system access (read/write/edit)
- Command execution (Bash)
- Web access (WebFetch, WebSearch)
- Browser automation (Playwright via MCP)
- Docker container management
- Multi-agent spawning (Task tool)

This is a richly instrumented environment with strong development,
automation, and AI agent capabilities.
```

## Philosophical Note

Tools extend agency. Understanding your tools is understanding the boundary between what you can and cannot affect. A cartographer of tools is mapping the frontier of possibility.

> "We shape our tools, and thereafter our tools shape us." - Marshall McLuhan

The tool environment is not static - it evolves. Regular cartography keeps the map current.
