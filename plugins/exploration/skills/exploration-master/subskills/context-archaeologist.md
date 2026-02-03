---
name: context-archaeologist
description: Uncover the historical and contextual layer of the environment - git history, file timestamps, project evolution, and user patterns. Use when seeking to understand how this environment came to be.
allowed-tools: Bash, Read, Glob, Grep, Task
---

# Context Archaeologist

Dig through the layers of history to understand how this environment came to be. Like an archaeologist studying strata, examine timestamps, commit history, and file patterns to understand evolution and context.

## When to Use

- Understanding project history and evolution
- Discovering the story behind the codebase
- Investigating file modification patterns
- Understanding user activity and workflow
- Learning from past decisions
- Building context for current work

## Exploration Domains

### 1. Git History

**Commands:**
```bash
# Repository age and stats
git log --oneline --reverse | head -5  # First commits
git log --oneline | head -20           # Recent commits
git shortlog -sn | head -10            # Contributors

# Repository statistics
git rev-list --count HEAD              # Total commits
git log --format="%H" | wc -l          # Verify count

# Activity patterns
git log --format="%ai" | cut -d' ' -f1 | sort | uniq -c | tail -20  # Commits by date
git log --format="%ai" | cut -d' ' -f2 | cut -d: -f1 | sort | uniq -c  # Hour of day

# Branch structure
git branch -a
git log --oneline --graph --all | head -30
```

**Questions to answer:**
- When did this project start?
- Who are the contributors?
- What's the commit frequency?
- How has it evolved?

### 2. Commit Message Archaeology

**Commands:**
```bash
# Commit patterns
git log --format="%s" | head -50       # Recent messages
git log --format="%s" | grep -i "fix"  | wc -l  # Bug fixes
git log --format="%s" | grep -i "feat" | wc -l  # Features
git log --format="%s" | grep -i "refactor" | wc -l  # Refactoring

# Major changes
git log --oneline --all | grep -iE "(major|breaking|v[0-9])" | head -10

# Search history
git log --all --oneline --grep="keyword"
```

**Questions to answer:**
- What patterns appear in commit messages?
- What major changes have occurred?
- What problems have been fixed?
- What decisions can we infer?

### 3. File Timeline

**Commands:**
```bash
# Recently modified files
find . -type f -not -path "./.git/*" -printf "%T@ %Tc %p\n" 2>/dev/null | sort -n | tail -20

# Oldest files
find . -type f -not -path "./.git/*" -printf "%T@ %Tc %p\n" 2>/dev/null | sort -n | head -20

# File creation via git
git log --diff-filter=A --summary --format="%ai" -- . | grep -E "create mode|^[0-9]" | head -40

# Most changed files
git log --format=format: --name-only | sort | uniq -c | sort -rn | head -20
```

**Questions to answer:**
- What files are most active?
- What's the oldest code?
- What was recently added?
- What files see constant churn?

### 4. Project Structure Evolution

**Commands:**
```bash
# Directory age (by oldest file)
for dir in */; do
  oldest=$(find "$dir" -type f -not -path "./.git/*" -printf "%T@\n" 2>/dev/null | sort -n | head -1)
  if [ -n "$oldest" ]; then
    echo "$(date -d @${oldest%.*} +%Y-%m-%d 2>/dev/null || echo "unknown") $dir"
  fi
done | sort

# README/documentation age
git log --format="%ai %s" -- README.md | head -10
git log --format="%ai %s" -- "*.md" | head -20

# Configuration evolution
git log --format="%ai %s" -- "*.json" "*.yml" "*.yaml" | head -20
```

**Questions to answer:**
- How has the structure evolved?
- What directories are oldest/newest?
- How has documentation changed?
- What configuration changes were made?

### 5. Decision Archaeology

**Files to examine:**
```bash
# Architecture Decision Records
find . -name "*.md" -path "*decision*" -o -name "ADR*.md" 2>/dev/null
find . -name "*.md" | xargs grep -l "Decision" 2>/dev/null | head -10

# Planning documents
find . -name "*.md" -path "*plan*" 2>/dev/null
ls .claude/planning/ 2>/dev/null

# TODO/FIXME archaeology
grep -rn "TODO\|FIXME\|HACK\|XXX" --include="*.py" --include="*.js" --include="*.ts" 2>/dev/null | head -20
```

**Questions to answer:**
- What decisions were documented?
- What plans existed?
- What technical debt remains?
- What ideas were deferred?

### 6. User Activity Patterns

**Commands:**
```bash
# Shell history patterns (if accessible)
history 2>/dev/null | tail -50

# Recent file access
ls -ltu ~ 2>/dev/null | head -20

# Git user config
git config user.name
git config user.email

# Common working directories
find ~ -maxdepth 3 -name ".git" -type d 2>/dev/null | head -10
```

**Questions to answer:**
- What does the user typically work on?
- What tools do they use frequently?
- What projects are active?

## Archaeological Report Template

```markdown
## Context Archaeology - [Date]

### Project Origin
- First commit: [date] by [author]
- Initial purpose: [inferred from early commits]
- Original structure: [description]

### Evolution Timeline
| Period | Key Changes |
|--------|-------------|
| [dates] | [description] |

### Contributor Analysis
| Contributor | Commits | Focus Areas |
|-------------|---------|-------------|
| [name] | [count] | [patterns] |

### Commit Message Patterns
- Features: [count]
- Bug fixes: [count]
- Refactoring: [count]
- Documentation: [count]
- Style: [conventional/free-form/mixed]

### Active Files (Most Changed)
1. [file]: [change count]
2. [file]: [change count]

### Dormant Areas
- [directories/files not touched recently]

### Technical Debt Indicators
- TODOs: [count]
- FIXMEs: [count]
- Deferred decisions: [list]

### Project Narrative
[Story of how this project evolved, inferred from history]
```

## Archaeology Workflow

### Quick Survey
1. Get project age: `git log --reverse --format="%ai" | head -1`
2. Recent activity: `git log --oneline | head -10`
3. Contributors: `git shortlog -sn | head -5`
4. Active files: `find . -mtime -7 -type f | head -10`

### Deep Dive
1. Complete git history analysis
2. File timeline reconstruction
3. Decision document review
4. Technical debt inventory
5. Narrative synthesis

## Understanding Context

History provides:
- **Why** - Decisions made and their reasoning
- **What changed** - Evolution of thinking
- **Who** - Human context and expertise
- **When** - Time pressure, priorities
- **Patterns** - Recurring themes and challenges

## Connection to Other Skills

- **substrate-scanner**: The machine's history (uptime, logs)
- **tool-cartographer**: Tool adoption history
- **network-prober**: Network configuration changes
- **cosmos-contemplator**: History as part of cosmic timeline

## Example Session

```
User: What's the history of this repository?

Claude: Let me dig into the archaeological record...

[Runs history analysis]

**Project Origin:**
- First commit: October 2024
- Initial focus: Claude Code plugin marketplace
- Creator: linuxiscool

**Evolution:**
The project started as a brainstorming plugin and grew into
a full marketplace ecosystem:

1. **Phase 1** (Oct 2024): Brainstorming plugin
2. **Phase 2** (Nov 2024): Added logging, schedule plugins
3. **Phase 3** (Dec 2024): Awareness ecosystem, journal plugin
4. **Current**: 9 plugins with 30+ skills

**Recent Activity (last 10 commits):**
- feat(journal): Obsidian-style linked journaling
- chore: Register agents and llms plugins
- feat: Add awareness ecosystem
- feat(schedule.md): Release v1.0.0
- Various plugin refinements

**Key Contributors:**
- linuxiscool: Primary developer
- Claude: AI-assisted commits (co-authored)

**Patterns:**
- Conventional commits (feat, fix, chore)
- Plugin-centric development
- Documentation-driven design
- Iterative skill refinement

This is a young, actively developed project focused on
extending Claude Code's capabilities through a plugin ecosystem.
```

## Philosophical Note

Every environment is a palimpsest - layers of decisions written over each other. The context archaeologist reads these layers to understand not just what exists, but why it exists and how it came to be.

> "Those who cannot remember the past are condemned to repeat it." - George Santayana

Understanding history prevents redundant work, surfaces hidden context, and honors the effort that came before. We build on foundations laid by others.
