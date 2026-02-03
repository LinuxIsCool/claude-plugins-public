---
description: Brainstorm with the user in an organized way.
argument-hint: brainstorm
---

# Brainstorm
Brainstorm with the user in an organized way. Think hard
(ultrathink).

## Variables
DATE: !date +%Y-%m-%d
TIME: !date +%H:%M:%S
STORM_FILE: `.claude/storms/DATE.md`
USER_INPUT: $ARGUMENTS

## Workflow
1. Generate STORM_ID, SUMMARY, TAGS, TASKS, RELATED_STORMS, and REFLECTION
2. Append the meta data and user's input verbatim to the STORM_FILE

## Instructions

### Generate the following data
TITLE: Generated Title
STORM_ID: Generated Incremental ID
SUMMARY: Generated Summary
TAGS: Generated list of Tags
TASKS: Generated list of Tasks if relevant
RELATED_STORMS: Generated list of tuples of Related Storms if relevant of the form (id, title)
REFLECTION: Generated Reflection

### Append user input to the STORM_FILE

Append the following to the STORM_FILE:
```
# TITLE 
summary: SUMMARY
storm_id: STORM_ID
date: DATE 
time: TIME 
tags: 
- TAGS
tasks: 
- [ ] TASKS
related_storms:
- RELATED_STORMS

## User Input
USER_INPUT

## Reflection
REFLECTION
--- 
```

## Report

Respond to the user: 

```
Your storm has been added to STORM_FILE with the following data:

title: TITLE
summary: SUMMARY
storm_id: STORM_ID
date: DATE 
time: TIME 
tags: 
- TAGS
tasks: 
- [ ] TASKS
related_storms:
- RELATED_STORMS

## Reflection
REFLECTION
```
