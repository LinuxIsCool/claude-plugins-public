---
name: project-onboard
description: Guided project onboarding - connect resources, platforms, and fill in details
argument-hint: Project name or brief description
allowed-tools: [
  "Read", "Write", "Edit", "Glob", "Grep", "Bash",
  "TodoWrite", "AskUserQuestion", "Task",
  "mcp__*"
]
---

# Project Onboarding

You are helping a user set up a new project with all its connections and context. Follow a systematic approach: gather basic info, connect to platforms, link resources, and create a complete project record.

## Core Principles

- **Interactive discovery**: Ask questions at each phase, wait for answers before proceeding
- **Connect the dots**: Link to Slack channels, Notion pages, library resources, transcripts
- **Detect available integrations**: Check which MCPs are available and offer relevant connections
- **Build context progressively**: Each phase builds on the previous
- **Use TodoWrite**: Track all progress throughout

---

## Phase 1: Project Identity

**Goal**: Establish the basic project identity

Initial request: $ARGUMENTS

**Actions**:
1. Create todo list with all phases
2. Ask the user using AskUserQuestion:

**Questions to ask**:
- Project type: Assignment (committed work) or Opportunity (potential work)?
- Pipeline stage: Lead / Proposal / Negotiation / Active / Delivered?
- Client or organization name (if applicable)?
- Brief description of the project scope?

3. Summarize understanding and confirm with user

---

## Phase 2: Timeline & Structure

**Goal**: Define deadlines, milestones, and deliverables

**Actions**:
1. Ask the user:
   - What is the main deadline? (date, hard or soft?)
   - What are the major phases/milestones?
   - Any key deliverables to track?

2. For each milestone mentioned, ask:
   - Milestone deadline?
   - Key deliverables within this milestone?

3. Confirm the timeline structure before proceeding

---

## Phase 3: Communication Channels

**Goal**: Connect to team communication platforms

**Actions**:
1. Check available MCPs for communication tools (Slack, Discord, etc.)
2. If Slack MCP is available:
   - Ask: "Is there a Slack channel for this project?"
   - If yes, ask for channel name/ID
   - Optionally: List recent channels to help identify the right one
3. If other communication MCPs available, offer those connections
4. If no communication MCPs: Skip and note this in project

**Store**: `integrations.slack.channel_id`, `integrations.slack.channel_name`

---

## Phase 4: Documentation & Knowledge Base

**Goal**: Connect to documentation platforms

**Actions**:
1. Check for Notion MCP, Confluence, or similar
2. If Notion MCP available:
   - Ask: "Is there a Notion page or database for this project?"
   - If yes, ask for the page URL or ID
   - Optionally: Search Notion for related pages
3. Ask: "Any other documentation links to associate?"
   - Project brief
   - Requirements doc
   - Design specs
   - Meeting notes

**Store**: `integrations.notion.page_id`, `integrations.notion.page_url`

---

## Phase 5: Resources & References

**Goal**: Link to library resources and external references

**Actions**:
1. Ask the user:
   - "What key resources should be associated with this project?"
   - URLs to reference (documentation, APIs, tools)
   - Research papers or articles
   - Competitor examples

2. For each URL provided:
   - Add to library with project tag (if library plugin available)
   - Store reference in project

3. Ask: "Any library tags to filter related resources?"
   - Suggest creating a project-specific tag

**Store**: `integrations.library_tags[]`, `resources[]`

---

## Phase 6: Code & Development

**Goal**: Connect to code repositories and development tools

**Actions**:
1. Check for GitHub MCP
2. If available:
   - Ask: "Is there a GitHub repository for this project?"
   - If yes, get repo name (owner/repo format)
   - Ask: "Should we track issues with a specific label?"
3. Check for Linear, Jira, or other issue trackers
4. Ask about backlog integration:
   - "Should we create backlog tasks for this project?"
   - "Link to existing backlog tasks?"

**Store**: `integrations.github.repo`, `integrations.github.issues_label`, `backlog_tasks[]`

---

## Phase 7: Financial Setup (if applicable)

**Goal**: Configure billing and financial tracking

**SKIP if**: User indicated this is not a paid engagement

**Actions**:
1. Ask the user:
   - Billing type: Hourly / Fixed / Retainer / Equity?
   - Rate amount and currency?
   - Estimated hours (if hourly)?
   - Expected total value (if fixed)?

2. If retainer:
   - Monthly amount?
   - Billing cycle start date?

3. Confirm financial setup

**Store**: `financial.rate`, `financial.total_invoiced.currency`

---

## Phase 8: Related Work

**Goal**: Connect to related projects and schedule

**Actions**:
1. List existing projects and ask:
   - "Is this related to any existing projects?"
   - If yes, link via `related_projects[]`

2. Ask about schedule integration:
   - "Do you want to block time for this project?"
   - If yes, suggest creating schedule blocks

3. Ask about transcript history:
   - "Any past conversations about this project to link?"
   - Search transcripts if available

**Store**: `related_projects[]`, `schedule_blocks[]`, `integrations.transcript_sessions[]`

---

## Phase 9: Create Project

**Goal**: Create the project with all gathered information

**DO NOT CREATE WITHOUT USER CONFIRMATION**

**Actions**:
1. Present complete project summary:
   ```
   Project: [title]
   Type: [assignment/opportunity]
   Stage: [stage]
   Client: [client]

   Timeline:
   - Main deadline: [date]
   - Milestones: [list]

   Integrations:
   - Slack: [channel]
   - Notion: [page]
   - GitHub: [repo]
   - Library tags: [tags]

   Financial:
   - Rate: [type] @ [amount]
   ```

2. Ask: "Does this look correct? Ready to create?"

3. On confirmation:
   - Call `project_create` with all gathered data
   - Add milestones via `project_add_milestone`
   - Store integration metadata in project notes or extended fields

4. Report success with project ID and file location

---

## Phase 10: Next Steps

**Goal**: Guide user on what to do next

**Actions**:
1. Mark all todos complete
2. Summarize what was set up
3. Suggest next actions:
   - "Add your first deliverable"
   - "Log time against this project"
   - "Create a kickoff task in backlog"
   - "Schedule your first work session"

4. Remind about useful commands:
   - `/projects` - View all projects
   - `project_timeline` - See deadlines
   - `project_get [id]` - View this project's details

---
