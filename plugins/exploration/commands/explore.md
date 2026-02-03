---
description: Explore the environment in concentric circles - from substrate to cosmos
argument-hint: "[circle|quick|deep]"
---

# Explore Command

Begin an exploration session to understand the environment in which Claude exists.

## Arguments

- `substrate` - Focus on the local machine (OS, hardware, resources)
- `tools` - Focus on available tools and capabilities
- `network` - Focus on network topology and connectivity
- `history` - Focus on project history and context
- `cosmos` - Contemplate the larger context
- `quick` - Quick survey of all circles (default)
- `deep` - Deep dive into all circles

## Context

The exploration plugin complements the awareness plugin:
- **Awareness** looks inward (self-discovery, capabilities)
- **Exploration** looks outward (environment, substrate, context)

Together they form complete situational knowledge.

## Variables

- CIRCLE: $ARGUMENTS (defaults to "quick")
- DATE: !date

## Exploration Workflow

### Quick Survey (default)

If CIRCLE is empty, "quick", or "all":

1. **Substrate** (30 seconds)
   - OS: `uname -a`
   - Hardware: `lscpu | head -5` + `free -h`
   - User: `whoami` + `pwd`

2. **Tools** (30 seconds)
   - Claude version: `claude --version`
   - Key tools: `which git node python docker`
   - MCP: List servers

3. **Network** (30 seconds)
   - Interfaces: `ip addr | grep inet`
   - Containers: `docker ps --format "{{.Names}}"`
   - External: `curl -s ifconfig.me`

4. **History** (30 seconds)
   - Git: `git log --oneline | head -5`
   - Recent: `find . -mtime -1 -type f | head -5`

5. **Summary**
   - Synthesize findings
   - Note interesting discoveries
   - Suggest areas for deeper exploration

### Specific Circle

If CIRCLE is a specific circle name:

- `substrate` → Invoke substrate-scanner skill
- `tools` → Invoke tool-cartographer skill
- `network` → Invoke network-prober skill
- `history` → Invoke context-archaeologist skill
- `cosmos` → Invoke cosmos-contemplator skill

Follow the skill's workflow for comprehensive exploration.

### Deep Dive

If CIRCLE is "deep":

1. Run each skill's deep workflow sequentially
2. Spend 2-5 minutes on each circle
3. Record all discoveries
4. Create comprehensive report
5. Identify connections between circles

## Output Format

### Quick Survey Output

```markdown
## Exploration Survey - [DATE]

### Substrate
- **OS**: [distro] [version]
- **Hardware**: [cpu] / [ram] / [disk]
- **User**: [user]@[host] in [directory]

### Tools
- **Claude**: [version]
- **Languages**: [available]
- **MCP Servers**: [count] configured

### Network
- **Local IP**: [ip]
- **External IP**: [ip]
- **Containers**: [count] running

### History
- **Project age**: [time since first commit]
- **Recent activity**: [last commit summary]

### Interesting Findings
- [discovery 1]
- [discovery 2]

### Suggested Deep Dives
- [area worth exploring further]
```

### Specific Circle Output

Follow the recording template in each skill's SKILL.md file.

### Deep Dive Output

```markdown
## Deep Exploration Report - [DATE]

### Executive Summary
[2-3 sentence overview]

### Substrate Analysis
[Full substrate-scanner report]

### Tool Cartography
[Full tool-cartographer report]

### Network Topology
[Full network-prober report]

### Historical Context
[Full context-archaeologist report]

### Cosmic Perspective
[cosmos-contemplator reflection]

### Synthesis
[How all circles connect and interact]

### Discoveries
[Most significant findings across all circles]

### Questions Raised
[Open questions for future exploration]
```

## Examples

```bash
# Quick survey (default)
/explore

# Explore a specific circle
/explore substrate
/explore tools
/explore network
/explore history
/explore cosmos

# Comprehensive deep dive
/explore deep
```

## Tips

- Start with `quick` to orient, then dive into interesting areas
- The circles are interconnected - discoveries in one inform others
- Use regularly to track environmental changes
- Combine with awareness plugin for complete self-knowledge
- Record significant discoveries for future reference

## Philosophy

> Know thyself, know thy environment, know thy place in the cosmos.

Exploration is not mere curiosity - it is the foundation of effective action. Understanding where you are is prerequisite to understanding what you can do.
