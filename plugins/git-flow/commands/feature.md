---
description: Create feature branch + worktree, then start feature development workflow
argument-hint: <feature description - REQUIRED>
allowed-tools: Bash, Read, Write, Edit, Glob, Grep, Task, TodoWrite, AskUserQuestion
---

# Git-Flow Feature Development

This command combines isolated branch creation with the feature development workflow.

## CRITICAL: Argument Validation

Feature description: $ARGUMENTS

**If the feature description above is empty or missing:**
1. STOP immediately
2. Ask the user: "Please provide a feature description. Usage: `/git-flow:feature <description>`"
3. Example: `/git-flow:feature Add dark mode toggle to settings page`
4. Do NOT proceed until a description is provided

**If description is provided, continue below.**

---

## Step 1: Create Isolated Workspace

Before any feature work, create an isolated git worktree.

### Check Current State

Run these checks:
```bash
# Check if already in worktree
python3 ${CLAUDE_PLUGIN_ROOT}/tools/worktree.py is-worktree

# Check current branch
python3 ${CLAUDE_PLUGIN_ROOT}/tools/branch.py current

# Check for uncommitted changes
git status --porcelain
```

### Create Feature Branch + Worktree

If NOT already in a feature worktree:

1. Generate branch name from description:
```bash
python3 ${CLAUDE_PLUGIN_ROOT}/tools/branch.py generate --context "$ARGUMENTS"
```

2. Create worktree with new branch:
```bash
python3 ${CLAUDE_PLUGIN_ROOT}/tools/worktree.py create BRANCH_NAME --base develop --session-id "$CLAUDE_SESSION_ID"
```

3. Report the new workspace:
   - Branch name created
   - Worktree path
   - Confirm isolated from main repository

If ALREADY in a worktree, acknowledge and proceed.

---

## Step 2: Feature Development Workflow

Now proceed with systematic feature development.

### Feature Request

$ARGUMENTS

### Phase 2A: Discovery

**Goal**: Understand what needs to be built

**Actions**:
1. Create todo list tracking all phases
2. Summarize understanding of the feature
3. If anything is unclear, ask for clarification

### Phase 2B: Codebase Exploration

**Goal**: Understand relevant existing code and patterns

**Actions**:
1. Launch 2-3 code-explorer agents in parallel targeting:
   - Similar features and their implementation
   - Architecture and abstractions in the relevant area
   - UI patterns, testing approaches, or extension points

2. Each agent should return 5-10 key files to read
3. Read all identified files to build deep understanding
4. Present comprehensive summary of findings

### Phase 2C: Clarifying Questions

**Goal**: Fill gaps and resolve ambiguities BEFORE designing

**CRITICAL**: Do NOT skip this phase.

**Actions**:
1. Review codebase findings and feature request
2. Identify underspecified aspects:
   - Edge cases
   - Error handling
   - Integration points
   - Scope boundaries
   - Design preferences
3. Present all questions in a clear, organized list
4. **Wait for answers before proceeding**

### Phase 2D: Architecture Design

**Goal**: Design implementation approach

**Actions**:
1. Launch 2-3 code-architect agents with different focuses:
   - Minimal changes (smallest change, maximum reuse)
   - Clean architecture (maintainability, elegant abstractions)
   - Pragmatic balance (speed + quality)

2. Review approaches and form recommendation
3. Present to user:
   - Summary of each approach
   - Trade-offs comparison
   - Your recommendation with reasoning
4. **Ask user which approach they prefer**

### Phase 2E: Implementation

**Goal**: Build the feature

**DO NOT START WITHOUT USER APPROVAL**

**Actions**:
1. Wait for explicit approval
2. Read all relevant files
3. Implement following chosen architecture
4. Follow codebase conventions strictly
5. Update todos as you progress

### Phase 2F: Quality Review

**Goal**: Ensure code quality

**Actions**:
1. Launch code-reviewer agents focusing on:
   - Simplicity/DRY/elegance
   - Bugs/functional correctness
   - Project conventions

2. Present findings and ask what to fix
3. Address issues based on user decision

### Phase 2G: Summary

**Goal**: Document accomplishments

**Actions**:
1. Mark all todos complete
2. Summarize:
   - What was built
   - Key decisions made
   - Files modified
3. Remind user about PR workflow:
   - Use `/git-flow:pr-create` when ready
   - Or `gh pr create --base develop`

---

## Workflow Reminder

You are working in an isolated worktree. Changes here do not affect the main repository until merged via PR.

When feature is complete:
1. Ensure all changes committed
2. Run `/git-flow:pr-create` to submit for review
3. After PR merges, worktree can be cleaned up
