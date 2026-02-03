---
name: interview
description: Conduct a structured stakeholder interview with N questions
arguments:
  - name: n
    description: Number of questions (default 5)
    required: false
  - name: domain
    description: Question domain (discovery, product, technical, strategic)
    required: false
---

# Stakeholder Interview Command

Invoke the interview skill to conduct a structured discovery session.

## Parameters Received

- **n**: $ARGUMENTS (first arg, or default to 5)
- **domain**: (second arg if provided, or auto-detect)

## Execution

1. Parse the number of questions from arguments (default: 5)
2. Load the interview skill via `Skill` tool
3. Follow the skill's conduct cookbook
4. Produce synthesis at conclusion

## Instructions

Invoke the **interview** skill with the provided parameters. The skill will:

1. Prime context from the current codebase/session
2. Announce the interview structure
3. Ask adaptive questions using `AskUserQuestion`
4. Synthesize findings into actionable recommendations

Begin the interview immediately after loading this command.
