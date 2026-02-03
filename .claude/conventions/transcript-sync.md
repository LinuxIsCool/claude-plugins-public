# Transcript-to-Organizational Sync Convention

When meeting transcripts are added to `.claude/transcripts/staging/`, process them with this workflow.

## Trigger

New `.md` files in `.claude/transcripts/staging/`

## Workflow

```
1. READ transcript with KG lens
   ├── Extract entities (people, orgs, projects)
   ├── Map relationships
   ├── Note temporal markers (dates, deadlines)
   └── List action items

2. CHECK organizational state
   ├── ls .claude/projects/active/
   ├── task_list (filter by project labels)
   └── Compare transcript vs tracked items

3. IDENTIFY gaps
   ├── Missing projects → Create project file
   ├── Missing tasks → Create from action items
   ├── Stale tasks → Update status + notes
   └── Schedule items → Add to schedule

4. LINK everything
   ├── Tasks get labels: ["project:X"]
   ├── Projects get backlog_tasks: [task-N]
   └── Transcripts get frontmatter cross-refs
```

## Frontmatter Template (Transcripts)

```yaml
---
id: tx_{context}_{date}
title: "Meeting Title"
type: meeting-synthesis
date: YYYY-MM-DD
participants:
  - name: Person Name
    role: Role
    topics: [topic1, topic2]
key_concepts:
  - concept1
  - concept2
tags:
  - project-tag
  - meeting-synthesis
---
```

## Project File Updates

After processing transcripts, update project files with:

```yaml
backlog_tasks:
  - task-N
  - task-M

current_focus: |
  Brief description of current work focus from transcript

next_actions:
  - Action item 1
  - Action item 2
```

## Task Creation Pattern

From transcript action items:

```
task_create
  title="Project: Action item description"
  labels=["project:X", "relevant-tag"]
  priority="high|medium|low"
  acceptanceCriteria=["Criterion 1", "Criterion 2"]
```

## Related

- Journal: `.claude/journal/2026/01/20/organizational-sync-process.md`
- Process Registry: `.claude/registry/processes.md` (add as Process #10)
