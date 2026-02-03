# Writing Effective Skill Descriptions

The description is the **primary signal** for Claude's skill selection. Master this and your skills will be discovered reliably.

## The Formula

```
[Primary capabilities]. [Secondary features]. Use when [scenarios]. Trigger with "[phrases]".
```

**Max length**: 1024 characters
**Voice**: Third person (NOT first person "I can..." or second person "You can...")

## Anatomy of a Great Description

### 1. Primary Capabilities (Action Verbs)
Start with what the skill DOES:
- "Extracts text and tables from PDF files"
- "Generates descriptive commit messages"
- "Analyzes code for performance bottlenecks"

### 2. Secondary Features
Add supporting capabilities:
- "fills forms, merges documents"
- "by analyzing git diffs"
- "memory leaks, and optimization opportunities"

### 3. Use Cases (When to Trigger)
Explicitly state when Claude should use it:
- "Use when working with PDF files"
- "Use when reviewing slow code"
- "Use when the user mentions document extraction"

### 4. Trigger Phrases
Include exact phrases users might say:
- "Trigger with 'process this PDF', 'extract text from document'"
- "Trigger with 'review my commit', 'write commit message'"

## Examples: Good vs Bad

### PDF Processing

**Bad:**
```yaml
description: Helps with documents
```
*Problem*: Too vague, no trigger conditions

**Good:**
```yaml
description: Extract text and tables from PDF files, fill forms, merge documents. Use when working with PDFs, converting documents, or when the user mentions PDF, form filling, or document extraction.
```

### Code Review

**Bad:**
```yaml
description: I review code for you
```
*Problem*: First person voice, vague

**Good:**
```yaml
description: Reviews Python code for PEP 8 compliance, security issues, and performance problems. Use when reviewing Python files, checking code quality, or when the user asks "is this code good?" or "review this".
```

### Commit Messages

**Bad:**
```yaml
description: Commit helper
```
*Problem*: Too short, no context

**Good:**
```yaml
description: Generate descriptive commit messages by analyzing git diffs. Follows conventional commits format. Use when the user asks for help writing commit messages, reviewing staged changes, or says "commit this" or "what should the commit message be?".
```

## Testing Your Description

### Check #1: Specificity
Can someone understand exactly what this skill does in one read?

### Check #2: Trigger Coverage
Have you included the common phrases users would say?

### Check #3: Differentiation
If you have similar skills, can Claude distinguish between them?

### Check #4: Voice
Is it third person? (NOT "I can..." or "You should...")

## Common Trigger Phrases by Category

### Analysis Skills
- "analyze this", "check this", "review this"
- "what's wrong with", "is this correct"
- "find issues in", "optimize this"

### Creation Skills
- "create a", "generate a", "make a"
- "write a", "build a", "scaffold"

### Transformation Skills
- "convert this to", "transform this"
- "change this from X to Y"

### Information Skills
- "explain", "how does", "what is"
- "show me", "find", "search for"

## Description Templates

### For Analysis Skills
```yaml
description: Analyzes [target] for [aspects]. Identifies [what it finds]. Use when [scenarios]. Trigger with "[phrases]".
```

### For Creation Skills
```yaml
description: Creates [output type] from [input]. Supports [features]. Use when [scenarios]. Trigger with "[phrases]".
```

### For Processing Skills
```yaml
description: Processes [input type] to [output type]. Handles [variations]. Use when [scenarios]. Trigger with "[phrases]".
```

### For Research Skills
```yaml
description: Researches [domain/topic]. Finds [what]. Synthesizes [output]. Use when [scenarios]. Trigger with "[phrases]".
```

## Debugging Discovery Issues

If your skill isn't being discovered:

1. **Check description length** - Under 1024 chars?
2. **Add more trigger phrases** - Match how users actually ask
3. **Be more specific** - Vague descriptions lose to specific ones
4. **Check for conflicts** - Another skill with similar description?
5. **Test directly** - Does `/skill-name` work?

If your skill triggers too often:

1. **Narrow the scope** - Add more conditions
2. **Use `disable-model-invocation: true`** - Manual only
3. **Be more specific** - Add context requirements
