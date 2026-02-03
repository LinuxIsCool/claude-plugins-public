---
name: substrate-scanner
description: Explore the host machine - OS, hardware, resources, filesystems, and system configuration. Use when curious about the machine Claude is running on, investigating performance constraints, or mapping the local environment.
allowed-tools: Bash, Read, Glob, Grep
---

# Substrate Scanner

Systematically explore the machine on which Claude Code runs. The substrate is the foundation - understanding it illuminates constraints and possibilities.

## When to Use

- Learning about the host operating system
- Understanding available hardware resources
- Investigating performance characteristics
- Mapping filesystem structure
- Discovering environment configuration
- Understanding user context and permissions

## Exploration Domains

### 1. Operating System

**Commands:**
```bash
# OS identity
uname -a
cat /etc/os-release

# Kernel details
uname -r
cat /proc/version

# System uptime and load
uptime
cat /proc/loadavg
```

**Questions to answer:**
- What OS distribution and version?
- What kernel version?
- How long has the system been running?
- What is the system load?

### 2. Hardware

**Commands:**
```bash
# CPU information
lscpu
cat /proc/cpuinfo | head -50

# Memory
free -h
cat /proc/meminfo | head -20

# Storage
df -h
lsblk

# GPU (if present)
lspci | grep -i vga
nvidia-smi 2>/dev/null || echo "No NVIDIA GPU or driver"
```

**Questions to answer:**
- What CPU architecture and model?
- How many cores/threads?
- How much RAM, how much available?
- What storage devices, how much space?
- Is there a GPU? What kind?

### 3. Users and Permissions

**Commands:**
```bash
# Current user
whoami
id

# User home
echo $HOME
ls -la ~

# Groups
groups

# Sudo access (safe check)
timeout 1 sudo -n true 2>/dev/null && echo "Has passwordless sudo" || echo "No passwordless sudo"
```

**Questions to answer:**
- Who am I running as?
- What groups do I belong to?
- What permissions do I have?
- Can I escalate privileges?

### 4. Environment

**Commands:**
```bash
# Shell environment
echo $SHELL
echo $TERM
echo $COLORTERM
env | grep -E "^(PATH|HOME|USER|LANG|LC_)" | sort

# Terminal context
echo "TMUX: $TMUX"
echo "SSH: $SSH_CONNECTION"

# Working directory context
pwd
ls -la
```

**Questions to answer:**
- What shell am I in?
- What terminal emulator?
- Am I in tmux/screen?
- Am I connected via SSH?
- What is the working directory?

### 5. Filesystem Structure

**Commands:**
```bash
# Key directories
ls -la /
ls -la /home
ls -la /etc 2>/dev/null | head -20

# Disk usage
du -sh /* 2>/dev/null | sort -h | tail -10

# Mount points
mount | head -20
```

**Questions to answer:**
- What is the filesystem hierarchy?
- Where is disk space used?
- What filesystems are mounted?
- Are there network mounts?

### 6. System Services

**Commands:**
```bash
# Systemd services (if available)
systemctl list-units --type=service --state=running 2>/dev/null | head -20

# Listening ports
ss -tlnp 2>/dev/null | head -20 || netstat -tlnp 2>/dev/null | head -20

# Running processes (top consumers)
ps aux --sort=-%mem | head -10
```

**Questions to answer:**
- What services are running?
- What ports are listening?
- What processes consume resources?

## Exploration Workflow

### Quick Survey (2-3 minutes)
1. Get OS identity: `uname -a && cat /etc/os-release`
2. Get hardware summary: `lscpu | head -10 && free -h && df -h /`
3. Get user context: `whoami && id && pwd`
4. Get terminal context: `echo "TERM=$TERM TMUX=$TMUX"`

### Deep Dive (10+ minutes)
1. Complete all domain explorations above
2. Record findings systematically
3. Note anomalies or interesting configurations
4. Consider how constraints affect capabilities

## Recording Discoveries

When exploring, record:

```markdown
## Substrate Discovery - [Date]

### Machine Identity
- OS: [distribution] [version]
- Kernel: [version]
- Hostname: [name]

### Hardware Profile
- CPU: [model] ([cores] cores, [threads] threads)
- RAM: [total] total, [available] available
- Storage: [size] on [device], [used]% used
- GPU: [model] or none

### User Context
- User: [username]
- Groups: [groups]
- Home: [path]
- Permissions: [sudo status]

### Terminal Context
- Shell: [shell]
- Terminal: [TERM]
- Multiplexer: [tmux/screen/none]
- Remote: [SSH status]

### Notable Findings
- [Interesting discoveries]
- [Constraints or limitations]
- [Opportunities or capabilities]
```

## Safety Guidelines

- **Read-only exploration** - Never modify system files
- **Respect privacy** - Don't probe into user data beyond necessity
- **Gentle probing** - Avoid commands that generate heavy load
- **No secrets** - Don't log passwords, tokens, or sensitive env vars
- **Timeout long commands** - Use `timeout` for potentially slow operations

## Connection to Other Skills

- **tool-cartographer**: After understanding substrate, explore available tools
- **network-prober**: Substrate informs network capabilities
- **context-archaeologist**: Substrate history via logs and timestamps
- **cosmos-contemplator**: Substrate as physical instantiation of computation

## Example Session

```
User: Tell me about the machine I'm running on

Claude: Let me explore the substrate...

[Runs quick survey commands]

You're running on a **Pop!_OS 22.04** system (Ubuntu-based, from System76):

**Hardware:**
- CPU: 13th Gen Intel Core i7-13700F (16 cores, 24 threads)
- RAM: 32GB total, 24GB available
- Storage: 929GB NVMe SSD, 75% used
- GPU: NVIDIA (discrete graphics)

**Environment:**
- User: ygg
- Terminal: tmux-256color (inside tmux)
- Shell: bash
- Working directory: /home/user/path

This is a powerful workstation with ample resources for development,
data processing, and running local AI workloads. The NVIDIA GPU
suggests capability for CUDA-accelerated computation.
```

## Philosophical Note

The substrate is not merely background - it shapes what is possible. A language model running on a powerful workstation can do things it cannot do on a phone. Understanding the substrate is understanding one's actual capabilities, not just theoretical ones.

> "The medium is the message." - Marshall McLuhan

Or in our context: the substrate shapes the agent.
